// Real-host check: installs the packaged plugins into a real YAQMC (Electron host + yaqmc-core) running
// in a throwaway QA profile, then walks the app and records computed styles and screenshots.
//
//   node tools/host-check.mjs <yaqmc-checkout> <out-dir> [previous.yaqmc-plugin]
//
// The checkout needs node_modules, a QA build of the desktop main (`node apps/desktop/scripts/build.mjs
// --qa`), a yaqmc-core binary (YAQMC_CORE_BIN or apps/desktop/resources/core/) and its Vite dev server
// on 127.0.0.1:1420 (`npm run dev`). Exits non-zero if any check fails.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [repo, out, previous] = process.argv.slice(2);
if (!repo || !out) throw new Error('usage: host-check.mjs <yaqmc-checkout> <out-dir> [previous-package]');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireRepo = createRequire(path.join(repo, 'package.json'));
const { _electron: electron } = requireRepo('playwright');
const qa = await import(pathToFileURL(path.join(repo, 'scripts/qa-runtime.mjs')).href);
const desktop = path.join(repo, 'apps/desktop');
const electronBinary = createRequire(path.join(desktop, 'package.json'))('electron');
const coreBin = process.env.YAQMC_CORE_BIN ?? path.join(desktop, 'resources/core/yaqmc-core');

const version = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8')).version;
const DESIGN = 'dev.cupertino.yaqmc';
const COMPANION = 'dev.cupertino.yaqmc.now-playing';
const pkg = (id) => path.join(root, 'dist', `${id}-${version}.yaqmc-plugin`);
const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  'phone-portrait': { width: 390, height: 844 },
  'phone-landscape': { width: 844, height: 390 },
  tablet: { width: 1024, height: 768 },
};

mkdirSync(out, { recursive: true });
const box = qa.createQaSandbox({ purpose: 'cupertino-host-check' });
const report = { host: {}, checks: [], states: {} };
const check = (name, ok, detail) => {
  report.checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
};

async function launch() {
  const env = qa.qaElectronEnv({ ...process.env }, box, {
    YAQMC_ELECTRON_E2E: '1',
    YAQMC_VITE_DEV: '1',
    YAQMC_E2E_NATIVE: '1',
    YAQMC_E2E_CORE: '1',
    YAQMC_CORE_BIN: coreBin,
    ELECTRON_DISABLE_GPU: '1',
  });
  const app = await electron.launch({
    executablePath: electronBinary,
    args: qa.electronQaArgs(box, ['--lang=en-US']),
    cwd: desktop,
    env,
    timeout: 90_000,
  });
  const page = await app.firstWindow();
  await page.waitForSelector('.app-shell', { timeout: 60_000 });
  for (let i = 0; i < 120 && !(await invoke(page, 'plugin_list').then(() => true, () => false)); i += 1)
    await page.waitForTimeout(500);
  return { app, page };
}

const invoke = (page, method, params) => page.evaluate(([m, p]) => window.yaqmc.invoke(m, p), [method, params]);
// The host's own renderer module (same instance the Settings → Plugins UI uses).
const runtime = (page, fn, ...args) =>
  page.evaluate(async ([name, a]) => (await import('/src/application/plugin-runtime.ts'))[name](...a), [fn, args]);

async function install(page, file, enable) {
  const { permissions } = await invoke(page, 'plugin_inspect_path', { path: file });
  return runtime(page, 'installPlugin', file, { enable, grant: permissions });
}
async function update(page, id, file) {
  const client = (fn, arg) => page.evaluate(async ([f, a]) => window.yaqmc.invoke(f, a), [fn, arg]);
  let op = await client('plugin_update_prepare', { request: { pluginId: id, path: file } });
  for (let i = 0; i < 60 && op.phase !== 'prepared'; i += 1) {
    if (op.error) throw new Error(`update prepare: ${op.error}`);
    await page.waitForTimeout(500);
    [op] = await client('plugin_update_status', { operationId: op.operationId });
  }
  report.update = { from: op.preview.currentVersion, to: op.preview.version, removedPermissions: op.preview.removedPermissions, confirmations: op.preview.confirmations };
  op = await client('plugin_update_apply', { request: { operationId: op.operationId, grant: op.preview.permissions, confirm: true } });
  for (let i = 0; i < 120 && !['completed', 'unchanged', 'failed', 'cancelled'].includes(op.phase); i += 1) {
    await page.waitForTimeout(500);
    [op] = await client('plugin_update_status', { operationId: op.operationId });
  }
  report.update.phase = op.phase;
  report.update.error = op.error;
  await settle(page, 2500);
  return (await invoke(page, 'plugin_list')).find((record) => record.id === id);
}
const setEnabled = async (page, id, enabled) => {
  const { permissions } = (await invoke(page, 'plugin_list')).find((record) => record.id === id);
  return runtime(page, 'setPluginEnabled', id, enabled, enabled ? permissions : []);
};
const settle = (page, ms = 1200) => page.waitForTimeout(ms);

/** Computed styles on host chrome plus the plugin style nodes as the document holds them. */
const metrics = (page) =>
  page.evaluate((designId) => {
    const css = (selector, props) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
    };
    const nodes = [...document.querySelectorAll(`style[data-yaqmc-plugin-style="${designId}"]`)];
    const html = document.documentElement;
    return {
      route: document.querySelector('.sidebar__item[data-active]')?.textContent.trim() ?? null,
      material: html.dataset.material,
      glass: getComputedStyle(html).getPropertyValue('--lg-fill').trim() !== '',
      theme: html.dataset.theme,
      hostKind: document.querySelector('.app-shell')?.dataset.hostKind,
      viewport: [innerWidth, innerHeight],
      styleNodes: nodes.length,
      layers: [...new Set(nodes.map((n) => n.sheet?.cssRules[0]?.name))],
      cssRules: nodes.reduce((sum, n) => sum + (n.sheet?.cssRules[0]?.cssRules?.length ?? 0), 0),
      accent: getComputedStyle(html).getPropertyValue('--accent').trim(),
      sidebar: css('.sidebar', ['width', 'background-color', 'border-radius', 'margin-top', 'backdrop-filter']),
      topbar: css('.topbar', ['height', 'background-color']),
      player: css('.player-bar', ['border-radius', 'background-color', 'backdrop-filter', 'box-shadow']),
      heading: css('.page h1, main h1, .page h2, main h2', ['font-size', 'font-weight', 'letter-spacing']),
      button: css('main .button, main button', ['border-radius']),
      body: css('body', ['font-family']),
    };
  }, DESIGN);

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 80 });
}

async function go(page, label) {
  // Host entries carry aria-label; plugin entries carry title "<label> · <plugin>".
  const selector = `.sidebar__item[aria-label="${label}"], .sidebar__item[title^="${label} · "], .android-bottom-nav__item[aria-label="${label}"]`;
  const item = page.locator(selector).first();
  if (await item.isVisible().catch(() => false)) await item.click();
  else await page.evaluate((sel) => document.querySelector(sel)?.click(), selector);
  await settle(page);
}

async function setTheme(page, theme) {
  const current = await page.evaluate(() => document.documentElement.dataset.theme);
  if (current !== theme) {
    await page.locator('button[aria-label="Use dark theme"], button[aria-label="Use light theme"]').first().click();
    await settle(page, 600);
  }
}

// Liquid Glass = Settings → Appearance → Material "Translucent"; same store call that row makes.
async function setStyle(page, style) {
  await page.evaluate(async (material) => {
    const { usePreferencesStore } = await import('/src/application/preferences.ts');
    usePreferencesStore.getState().updateAppearance({ material });
  }, style === 'Liquid Glass' ? 'translucent' : 'opaque');
  await settle(page, 800);
}

// ── Run ─────────────────────────────────────────────────────────────────
let { app, page } = await launch();
try {
  report.host = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    url: location.href,
    platform: document.documentElement.dataset.platform,
  }));
  await page.setViewportSize(VIEWPORTS.desktop);
  await setTheme(page, 'light');
  await settle(page, 6000); // let Home load
  const stock = await metrics(page);
  report.states.stock = stock;
  await shot(page, 'stock-desktop-home');

  let design;
  if (previous) {
    // Update path: a profile that already has the previous release enabled, updated through the
    // host's update transaction (the calls Settings → Plugins → Update makes).
    const old = await install(page, previous, true);
    await settle(page, 2500);
    report.states.previousEnabled = { version: old.version, ...(await metrics(page)) };
    await shot(page, `previous-${old.version}-desktop-home`);
    design = await update(page, DESIGN, pkg(DESIGN));
  } else design = await install(page, pkg(DESIGN), true);
  const companion = await install(page, pkg(COMPANION), true);
  report.installed = [design, companion].map((r) => ({ id: r.id, version: r.version, enabled: r.enabled, sha256: r.packageSha256 }));
  await settle(page, 2500);

  const styled = await metrics(page);
  report.states.enabled = styled;
  check('enable: all design stylesheets are in the document', styled.styleNodes === 9, styled.styleNodes);
  check('enable: nodes sit in the plugin layer', styled.layers.length === 1 && styled.layers[0] === 'yaqmc-plugin-style.dev-cupertino-yaqmc', styled.layers);
  check('enable: sidebar is 228px', styled.sidebar?.width === '228px', [stock.sidebar?.width, styled.sidebar?.width]);
  check('enable: accent is the Music red', styled.accent.toLowerCase() === '#fa233b', [stock.accent, styled.accent]);
  check('enable: player bar is rounded', styled.player?.['border-radius'] !== stock.player?.['border-radius'], [stock.player?.['border-radius'], styled.player?.['border-radius']]);
  check('enable: Now Playing entry from the companion', await page.locator('.sidebar__item[title^="Now Playing · "]').count() === 1);

  // Walk every primary page at desktop size, light, Classic.
  const pages = ['Home', 'Search', 'Explore', 'Favorites', 'Playlists', 'Recently played', 'Statistics', 'Settings', 'Now Playing'];
  report.states.pages = {};
  for (const label of pages) {
    await go(page, label);
    if (label === 'Search') {
      await page.locator('.search-page__field input').fill('Jay Chou').catch(() => undefined);
      await page.keyboard.press('Enter').catch(() => undefined);
      await settle(page, 5000);
    }
    const m = await metrics(page);
    report.states.pages[label] = m;
    check(`page ${label}: reached, styles applied`, m.route === label && m.styleNodes === 9 && m.sidebar?.width === '228px', { route: m.route, nodes: m.styleNodes });
    await shot(page, `desktop-light-classic-${label.toLowerCase().replaceAll(' ', '-')}`);
  }
  // Plugins live in Settings.
  await go(page, 'Settings');
  await page.locator('.plugin-card, .plugins-tabs').first().scrollIntoViewIfNeeded().catch(() => undefined);
  await settle(page, 500);
  await shot(page, 'desktop-light-classic-plugins');

  // Detail page, playback, lyrics, queue and comments: needs provider content.
  await go(page, 'Home');
  await settle(page, 3000);
  const card = page.locator('main .media-card, main a[href], main [role="link"]').first();
  report.states.content = { homeCards: await page.locator('main .media-card').count() };
  if (await card.isVisible().catch(() => false)) {
    await card.click();
    await settle(page, 4000);
    report.states.detail = await metrics(page);
    await shot(page, 'desktop-light-classic-detail');
    const play = page.locator('.detail-hero__actions .button').first();
    if (await play.isVisible().catch(() => false)) {
      await play.click();
      await settle(page, 6000);
    }
  }
  const playing = await page.evaluate(() => !!document.querySelector('.player-bar') && !/Choose something to play/.test(document.querySelector('.player-bar').innerText));
  report.states.content.playing = playing;
  for (const [label, name] of [['Show queue', 'queue'], ['Song comments', 'comments']]) {
    const button = page.locator(`button[aria-label="${label}"]`).first();
    if (await button.isEnabled().catch(() => false)) {
      await button.click();
      await settle(page, 2500);
      report.states[name] = await metrics(page);
      await shot(page, `desktop-light-classic-${name}`);
      await page.keyboard.press('Escape');
      await button.click().catch(() => undefined);
      await settle(page, 600);
    }
  }
  const lyricsOpen = page.locator('.player-bar__artwork, .player-bar [aria-label*="lyrics" i]:not([aria-label*="desktop" i])').first();
  if (playing && (await lyricsOpen.isVisible().catch(() => false))) {
    await lyricsOpen.click();
    await settle(page, 3000);
    await shot(page, 'desktop-light-classic-lyrics');
    report.states.lyrics = await page.evaluate(() => document.querySelector('.app-shell')?.dataset.lyricsStage);
    await page.keyboard.press('Escape');
    await settle(page, 800);
  }

  // Viewports × theme × style.
  report.states.matrix = {};
  for (const [vp, size] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(size);
    for (const theme of ['light', 'dark']) {
      for (const style of ['Classic', 'Liquid Glass']) {
        await setStyle(page, style);
        await setTheme(page, theme);
        for (const label of ['Home', 'Settings', 'Now Playing']) {
          await go(page, label);
          const m = await metrics(page);
          report.states.matrix[`${vp}/${theme}/${style}/${label}`] = m;
          await shot(page, `${vp}-${theme}-${style === 'Classic' ? 'classic' : 'glass'}-${label.toLowerCase().replaceAll(' ', '-')}`);
        }
        const m = report.states.matrix[`${vp}/${theme}/${style}/Home`];
        const glass = style === 'Liquid Glass';
        const blurred = /blur/.test(m.player?.['backdrop-filter'] ?? '');
        check(`${vp}/${theme}/${style}: styles applied, theme and glass match`, m.styleNodes === 9 && m.theme === theme && m.glass === glass && blurred === glass, { nodes: m.styleNodes, theme: m.theme, material: m.material, player: m.player?.['backdrop-filter'], sidebarRadius: m.sidebar?.['border-radius'] });
      }
    }
  }
  await setStyle(page, 'Classic');
  await setTheme(page, 'light');
  await page.setViewportSize(VIEWPORTS.desktop);
  await go(page, 'Home');

  // Disable restores the stock look; re-enable brings it back.
  await setEnabled(page, DESIGN, false);
  await settle(page, 1500);
  const off = await metrics(page);
  report.states.disabled = off;
  const same = ['sidebar', 'topbar', 'player', 'body'].every((k) => JSON.stringify(off[k]) === JSON.stringify(stock[k])) && off.accent === stock.accent;
  check('disable: no style nodes and computed chrome equals stock', off.styleNodes === 0 && same, { nodes: off.styleNodes, sidebar: off.sidebar?.width, accent: off.accent });
  await shot(page, 'disabled-desktop-home');
  await setEnabled(page, DESIGN, true);
  await settle(page, 2500);
  const again = await metrics(page);
  check('re-enable: styles back', again.styleNodes === 9 && again.sidebar?.width === '228px', again.styleNodes);
} finally {
  await app.close();
}

// Cold restart with the same profile.
({ app, page } = await launch());
try {
  await page.setViewportSize(VIEWPORTS.desktop);
  await settle(page, 4000);
  const cold = await metrics(page);
  report.states.coldRestart = cold;
  check('cold restart: styles applied without opening Now Playing', cold.styleNodes === 9 && cold.sidebar?.width === '228px', { nodes: cold.styleNodes, route: cold.route });
  await shot(page, 'cold-restart-desktop-home');
} finally {
  await app.close();
}

// ── Supplementary: provider content ───────────────────────────────────
// The real Core's QQ Music client ignores process proxies by design, so behind a proxy its catalog
// times out and detail pages, playback, lyrics and comments cannot be reached through the install
// flow. Same Electron host, the host's offline fake catalog (which has no plugin host), and the exact
// packaged stylesheets inserted the way applyStyleSheets does. Evidence only; not a substitute.
({ app, page } = await launch());
try {
  await page.goto('http://127.0.0.1:1420/?provider=fake');
  await page.waitForSelector('.app-shell[data-provider-id="fake"]', { timeout: 60_000 });
  const manifest = JSON.parse(readFileSync(path.join(root, 'build', DESIGN, 'manifest.json'), 'utf8'));
  const sheets = manifest.entrypoints.styles.map((name) => readFileSync(path.join(root, 'build', DESIGN, name), 'utf8'));
  await page.evaluate(([id, list]) => list.forEach((css, index) => {
    const node = document.createElement('style');
    node.setAttribute('data-yaqmc-plugin-style', id);
    node.dataset.pluginResourceKey = `${id}:${index}`;
    node.textContent = `@layer yaqmc-plugin-style.${id.replace(/[^a-z0-9-]+/gi, '-')} {\n${css}\n}`;
    document.head.appendChild(node);
  }), [DESIGN, sheets]);
  report.states.supplementary = {};
  for (const vp of ['desktop', 'phone-portrait']) {
    await page.setViewportSize(VIEWPORTS[vp]);
    for (const theme of ['light', 'dark']) {
      for (const style of ['Classic', 'Liquid Glass']) {
        await setStyle(page, style);
        await setTheme(page, theme);
        const tag = `supplementary-${vp}-${theme}-${style === 'Classic' ? 'classic' : 'glass'}`;
        await go(page, 'Home');
        // Album link in the track table on wide layouts; a playlist card where the column is hidden.
        for (const target of [page.locator('main').getByText('Sun Room', { exact: true }), page.locator('main .media-card :is(a, button).media-card__title')]) {
          if (await target.first().isVisible().catch(() => false)) {
            await target.first().click({ timeout: 5000 }).catch(() => undefined);
            break;
          }
        }
        await page.waitForSelector('.detail-hero', { timeout: 10_000 }).catch(() => undefined);
        await settle(page, 1000);
        if (await page.locator('.detail-hero').count()) report.states.supplementary[`${tag}/detail`] = await metrics(page);
        await shot(page, `${tag}-detail`);
        await page.locator('.detail-hero__actions .button').first().click().catch(() => undefined);
        await settle(page, 1000);
        for (const [label, name] of [['Show queue', 'queue'], ['Song comments', 'comments'], ['Open lyrics page', 'lyrics']]) {
          const button = page.locator(`button[aria-label="${label}"]`).first();
          if (!(await button.isVisible().catch(() => false))) continue;
          await button.click();
          await settle(page, 1500);
          report.states.supplementary[`${tag}/${name}`] = await metrics(page);
          await shot(page, `${tag}-${name}`);
          await page.keyboard.press('Escape');
          await settle(page, 600);
          if (name === 'queue') await button.click().catch(() => undefined);
        }
      }
    }
  }
  const covered = Object.keys(report.states.supplementary);
  check('supplementary: detail, queue, comments and lyrics rendered with the packaged CSS', ['detail', 'queue', 'comments', 'lyrics'].every((n) => covered.some((k) => k.endsWith(`/${n}`))) && covered.every((k) => report.states.supplementary[k].styleNodes === 9), covered.length);
} finally {
  await app.close();
}

writeFileSync(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const failed = report.checks.filter((c) => !c.ok);
console.log(`\n${report.checks.length - failed.length}/${report.checks.length} checks passed; evidence in ${out}`);
process.exitCode = failed.length ? 1 : 0;
