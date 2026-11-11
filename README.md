# Cupertino for YAQMC

An Apple-inspired redesign of [YAQMC](https://github.com/YAQMC/YAQMC), shipped as one plugin with three
deliberately different layout systems: **macOS** on desktop, **iOS** on phones, **iPadOS** on tablets.

| Desktop — macOS | Tablet — iPadOS | Phone — iOS |
| --- | --- | --- |
| ![Desktop home](docs/screenshots/pc-home.jpg) | ![Tablet three-pane](docs/screenshots/pad-three-pane.jpg) | <img src="docs/screenshots/phone-home.jpg" width="220" alt="Phone home"> |

<details>
<summary>More screenshots</summary>

**Desktop** — album with Up Next docked, Settings, Now Playing, dark Explore

![Album with Up Next](docs/screenshots/pc-album-up-next.jpg)
![Settings](docs/screenshots/pc-settings.jpg)
![Now Playing](docs/screenshots/pc-now-playing.jpg)
![Explore, dark](docs/screenshots/pc-explore-dark.jpg)

**Tablet** — two-pane album, grouped Settings, portrait rail

![Two-pane album](docs/screenshots/pad-album-two-pane.jpg)
![Settings](docs/screenshots/pad-settings.jpg)
<img src="docs/screenshots/pad-portrait.jpg" width="420" alt="Tablet portrait">

**Phone** — playlist, Library, Now Playing (no-lyrics state), dark Settings

<img src="docs/screenshots/phone-playlist.jpg" width="200" alt="Playlist"> <img src="docs/screenshots/phone-library.jpg" width="200" alt="Library"> <img src="docs/screenshots/phone-now-playing.jpg" width="200" alt="Now Playing"> <img src="docs/screenshots/phone-settings-dark.jpg" width="200" alt="Settings, dark">

Captured from the YAQMC 0.1.1 web client with its offline fixture provider, on Linux (so the typeface is a
fallback; on Apple devices the host's font stack resolves to San Francisco).

</details>

## Install

1. Download `dev.cupertino.yaqmc-1.0.0.yaqmc-plugin` from the [latest release](../../releases/latest).
2. In YAQMC open **Settings → Plugins → Choose file** and pick the package.
3. Review the SHA-256 and the permissions below, then **Enable**. The redesign applies immediately;
   disabling the plugin restores the stock interface.

Optional, all in YAQMC's own settings:

- **Lyrics presets → Cupertino** selects the bundled Now Playing scene (artwork rests smaller while paused).
- **Appearance → Window material → Translucent** turns bars and menus into real glass on macOS.
- **Appearance → Color palette**: the host's default palette becomes the Music red; any other palette you
  pick is respected as is.
- **Plugins → Cupertino → Home arrangement**: Default, Stations first, or Essentials only.

### Supported YAQMC versions

Plugin API v4 is required: **YAQMC 0.1.1 or newer** (`engines.yaqmc: ">=0.1.1"`), on Windows, Linux, macOS
and Android. Checked against 0.1.1 (rendered) and 0.1.3-beta.3 (every targeted class verified in source).

### Permissions

| Permission | Why |
| --- | --- |
| `style.register`, `scene.register` | The redesign itself and the Cupertino lyrics scene |
| `ui.pages`, `ui.navigation` | The host-rendered **Now Playing** page and its sidebar entry |
| `track.read`, `player.read`, `lyrics.read` | Content of that page |
| `player.control` (sensitive) | Its Previous / Play / Next buttons and tap-a-lyric-to-seek |
| `ui.layout` | Applying the Home arrangement setting |

No network, storage or account access.

## The three layout systems

| | PC — macOS | Phone — iOS on Android | Tablet — iPadOS |
| --- | --- | --- | --- |
| Applies to | Electron / browser at ≥600px | Any host below 600px | Android at ≥600px |
| Navigation | Full-height source list, accent glyphs, unified toolbar | Floating tab bar; search field and account in the navigation bar | Sidebar with a large title in landscape, icon rail in portrait |
| Player | Floating Now Playing bar; content scrolls beneath it | Mini player capsule stacked above the tab bar | Floating bar spanning content and panes |
| Panes | Up Next docks as a third column from 1240px, popover below | Up Next and comments are bottom sheets with a grabber | Up Next docks from 1180px; album, playlist and song pages pin their header beside the track list |
| Lists and controls | 44px table rows, hover menus highlighted in accent, 32px push buttons | 56px rows, 46px menu rows, horizontal snapping shelves, large titles | 54px rows, grouped white cells on a gray canvas |
| Platform fit | Reserves the macOS traffic-light corner; keeps Windows/Linux caption buttons | System back drives history (no back chevron), bars sit above the gesture inset, OLED black in dark mode | Hardware volume replaces the on-screen slider; safe-area insets on every edge |

Shared by all three: an Apple system palette in light and dark, segmented controls, iOS switches, thin
sliders with a white knob, borderless grouped Settings, a hairline that appears under the top bar once
content scrolls, and reduced-motion support.

### Coverage

| Surface | Redesigned through |
| --- | --- |
| Sidebar, top bar, player bar, bottom navigation | Layout stylesheets |
| Home, Explore, Area | Shelves, tiles, section headers; Home section order via `ui.layout` |
| Search | Search field, segmented scopes, result tables and grids |
| Library, Favorites, Playlists, Recently played | Cards, grids, profile, pagination |
| Album, Playlist, Artist, Song | Plain artwork header with accent artist, action row, track table; two-pane on tablets |
| Queue (Up Next) | Popover, docked pane or bottom sheet depending on layout |
| Lyrics / Now Playing | Transport, scrubber, chrome; the **Cupertino** scene; the **Now Playing** plugin page with a tappable lyric index |
| Comments | Inset inspector on wide screens, page sheet on phones |
| Settings, Statistics, Plugins, plugin pages | Grouped lists, tabs, metric cards |
| Menus, selects, dialogs, notices | Shared components |
| Loading, empty and error states | Skeletons, empty states, error notices, "No lyrics", unsupported comments |

Not covered: the separate Desktop Lyrics and Lyrics Island windows, and the Lyrics Composer editor canvas.

## Host API limitations

What the plugin API allows shaped this design. The constraints that matter:

1. **No markup.** Plugins cannot add, move or reorder host DOM. So there is no way to put a queue button
   on the phone mini player (the host hides it there), add or reorder tab bar items, collapse a large
   title into the navigation bar, add swipe gestures, show artwork thumbnails in track rows, or split
   Settings into a category list and a detail pane.
2. **The documented Style API is four selectors and five tokens.** A full redesign has to target the
   host's own class names, which YAQMC explicitly does not guarantee across releases. `npm test` keeps
   the package valid, and the classes were checked against 0.1.3-beta.3, but a future host refactor can
   break parts of the look. Disabling the plugin always restores the stock UI.
3. **Plugin CSS lives in a cascade layer below the app's unlayered CSS and inline theme tokens.** Every
   declaration therefore ships as `!important` (the build adds it). Side effects: a keyframe cannot
   animate a property the plugin also declares, and the user's accent can only be respected by leaving
   it alone, which is why the Music red applies to the default palette only.
4. **No setting reaches CSS.** Plugin settings are readable from the script worker only, and the worker
   has no DOM. Density, blur or accent toggles are impossible; the plugin relies on the host's own
   Appearance settings instead.
5. **Live blur is switched off by the host on Windows, Linux and Android** for rendering performance.
   Bars and menus use dense tints there; real glass is limited to macOS with the translucent material.
6. **Plugin pages are block documents** (heading, text, stats, list, actions, notice, divider; 40 blocks,
   50 list items, no images or custom layout), and navigation entries only appear in the sidebar's
   Plugins section, never in the phone tab bar. On phones the Now Playing page is therefore not
   reachable from the tab bar.
7. **Scripts see the current track, playback state and lyrics only.** There is no queue, library or
   search API, so the plugin page cannot show Up Next or browse content.
8. **`ui.layout` covers Home only**: three sections, order and visibility.
9. **Scenes are opt-in and read-only.** The plugin cannot select its scene for the user, and plugin
   scenes cannot be edited in the Composer (fork it instead).
10. **No device class signal and no iOS host.** Layouts key off `data-host-kind` plus width, so a
    large foldable in a narrow window gets the phone system, by design.
11. **No bundled or network fonts.** San Francisco is used where the OS provides it.

## Architecture

```
manifest.json            entrypoints, permissions, settings schema
styles/00-tokens.css     colour, shape, motion, type ramp (re-points host tokens)
styles/10-foundation.css shared components: buttons, sliders, menus, tables, sheets, states
styles/20-pages.css      page compositions shared by every layout
styles/30-now-playing.css  lyrics stage transport and comments
styles/40-layout-pc.css    layout system 1: macOS
styles/41-layout-phone.css layout system 2: iOS on Android
styles/42-layout-pad.css   layout system 3: iPadOS
styles/50-platform-ios.css entry point for a future iOS host
scenes/cupertino.*       lyrics scene (schema + scoped CSS)
main.js                  Now Playing page and Home arrangement (plain JS, no bundler)
tools/build.mjs          promotes declarations to !important, writes build/ and dist/*.yaqmc-plugin
test/                    build transform, package rules, script behaviour
```

Layouts are written against size classes, not against Android: compact width goes to the phone system on
any host, regular width goes to the tablet system on touch hosts and to the PC system elsewhere.

### Adding iOS

YAQMC has no iOS host yet. When one reports `data-host-kind="ios"` and `data-platform="ios"`:

- iPhone and iPad already select the phone and tablet systems (`ios` is in their selectors), the touch
  type ramp, and real glass with the translucent material (`00-tokens.css`).
- [`styles/50-platform-ios.css`](styles/50-platform-ios.css) is where iOS-only behaviour goes. It already
  restores the back chevron on phones (no system back gesture) and native rubber-band scrolling.
- Add `ios` to nothing else: `manifest.json` leaves `platforms` unset so the package is not excluded.

## Development

Requires Node.js 22.2 or newer; no dependencies.

```bash
npm run build
```

```bash
npm test
```

`build/` is the unpacked plugin (loadable with YAQMC's Developer Mode); `dist/` holds the installable
package.

## License

MIT. Not affiliated with or endorsed by Apple Inc. or the YAQMC project; no Apple fonts, icons or artwork
are included.
