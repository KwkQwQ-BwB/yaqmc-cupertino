/* global definePlugin */
// Cupertino script entrypoint (plain JavaScript, API v4). The visual redesign lives in styles/;
// this adds the two things CSS cannot: a host-rendered "Now Playing" page with a tappable lyric
// index, and the Home arrangement setting applied through the host's layout knobs.

const PAGE = 'now-playing';
const HOME = {
  'Stations first': { order: ['radar', 'for-you', 'recommended-playlists'] },
  'Essentials only': { hidden: ['recommended-playlists'] },
};
const LIST_WINDOW = 50; // host limit: 50 list items per block

const clock = (ms) => {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Page blocks for the current snapshot. */
function nowPlayingBlocks(track, playback, lyrics, lineIndex) {
  if (!track || !track.title) {
    return [
      { type: 'heading', text: 'Not Playing' },
      { type: 'text', text: 'Start a song and it will appear here with its lyrics.', tone: 'secondary' },
    ];
  }
  const blocks = [
    { type: 'heading', text: Array.from(track.title).slice(0, 60).join('') },
    {
      type: 'stats',
      items: [
        { label: 'Artist', value: (track.artists || []).join(', ') || '—' },
        { label: 'Album', value: track.album || '—' },
        { label: 'Time', value: `${clock(playback.positionMs)} / ${clock(playback.durationMs || track.durationMs)}` },
      ],
    },
    {
      type: 'actions',
      items: [
        { id: 'previous', label: 'Previous' },
        { id: 'toggle', label: playback.isPlaying ? 'Pause' : 'Play', variant: 'primary' },
        { id: 'next', label: 'Next' },
      ],
    },
    { type: 'divider' },
  ];
  // Keep each line's original index: it is what `currentLine` and seeking refer to.
  const lines = (lyrics.timedLines || []).map((line, index) => ({ ...line, index })).filter((line) => line.text);
  if (lines.length === 0) {
    blocks.push({ type: 'text', text: 'No lyrics for this song.', tone: 'secondary' });
    return blocks;
  }
  const current = lines.findLastIndex((line) => line.index <= (lineIndex || 0));
  const start = Math.max(0, Math.min(current - 4, lines.length - LIST_WINDOW));
  blocks.push({ type: 'heading', text: 'Lyrics' });
  blocks.push({
    type: 'list',
    items: lines.slice(start, start + LIST_WINDOW).map((line, offset) => {
      const timed = typeof line.startMs === 'number';
      return {
        id: `l${line.index}`,
        title: `${start + offset === current ? '▸ ' : ''}${line.text}`.slice(0, 200),
        subtitle: [timed ? clock(line.startMs) : '', line.translation || ''].filter(Boolean).join(' · ') || undefined,
        actionId: timed ? `seek-${line.index}` : undefined,
      };
    }),
  });
  return blocks;
}

definePlugin({
  async activate(ctx) {
    let mounted = false;
    let lineIndex = 0;
    let lyrics = { lines: [] };
    const report = (error) => void ctx.log.warn(String((error && error.message) || error));

    const render = async () => {
      if (!mounted) return;
      const [track, playback] = await Promise.all([ctx.track.get(), ctx.player.get()]);
      await ctx.pages.render(PAGE, nowPlayingBlocks(track, playback, lyrics, lineIndex));
    };
    const refresh = () => void render().catch(report);
    const reloadLyrics = async () => {
      lyrics = await ctx.lyrics.get();
      lineIndex = lyrics.currentLine || 0;
      refresh();
    };
    const applyHome = async (settings) => {
      const layout = HOME[settings && settings.homeArrangement];
      await (layout ? ctx.layout.set({ target: 'home', ...layout }) : ctx.layout.clear('home'));
    };

    const stops = [
      ctx.pages.onMount(PAGE, () => {
        mounted = true;
        void reloadLyrics().catch(report);
      }),
      ctx.pages.onUnmount(PAGE, () => {
        mounted = false;
      }),
      ctx.events.on('track.changed', refresh),
      ctx.events.on('playback.stateChanged', refresh),
      ctx.events.on('lyrics.documentChanged', () => void reloadLyrics().catch(report)),
      ctx.events.on('lyrics.lineChanged', (event) => {
        // Fires per word; the page only changes when the line does.
        if (!event || event.lineIndex === lineIndex) return;
        lineIndex = event.lineIndex;
        refresh();
      }),
      ctx.events.on('settings.changed', (settings) => void applyHome(settings).catch(report)),
      ctx.events.on('ui.action', (event) => {
        if (!event || event.slot !== 'page' || event.pageId !== PAGE) return;
        const seek = /^seek-(\d+)$/.exec(event.id);
        const line = seek && (lyrics.timedLines || [])[Number(seek[1])];
        const action = line && typeof line.startMs === 'number'
          ? ctx.player.seek(line.startMs)
          : event.id === 'toggle'
            ? ctx.player.toggle()
            : event.id === 'next'
              ? ctx.player.next()
              : event.id === 'previous'
                ? ctx.player.previous()
                : null;
        if (action) void action.then(refresh, report);
      }),
    ];

    await ctx.pages.register({ id: PAGE, title: 'Now Playing' });
    await ctx.navigation.register({ id: 'open-now-playing', label: 'Now Playing', pageId: PAGE });
    await applyHome(await ctx.settings.get()).catch(report);

    return () => stops.forEach((stop) => stop());
  },
});
