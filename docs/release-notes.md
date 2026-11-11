An Apple-inspired redesign of YAQMC: **macOS** on desktop, **iOS** on Android phones, **iPadOS** on
tablets, each in **Classic** or **Liquid Glass** style.

| Classic | Liquid Glass |
| --- | --- |
| ![Desktop, Classic](https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/screenshots/pc-album-up-next.jpg) | ![Desktop, Liquid Glass](https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/screenshots/glass-pc-album.jpg) |
| ![Tablet, Classic](https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/screenshots/pad-three-pane.jpg) | ![Tablet, Liquid Glass](https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/screenshots/glass-pad-three-pane.jpg) |

<img src="https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/screenshots/phone-home.jpg" width="200" alt="Phone, Classic"> <img src="https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/screenshots/glass-phone-home.jpg" width="200" alt="Phone, Liquid Glass"> <img src="https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/screenshots/phone-now-playing.jpg" width="200" alt="Phone, Now Playing">

## Install

1. Download **`dev.cupertino.yaqmc-{{VERSION}}.yaqmc-plugin`** below.
2. YAQMC → **Settings → Plugins → Choose file**, pick the package.
3. Check the SHA-256 shown by YAQMC against `{{SHA}}`, review the permissions, then **Enable**.
4. Optional: **Plugins → Cupertino → Style** (Classic / Liquid Glass), **Home arrangement**; **Lyrics
   presets → Cupertino**.

Disabling the plugin restores the stock interface immediately.

## Supported YAQMC versions

YAQMC **0.1.1 or newer** (plugin API v4) on Windows, Linux, macOS and Android. Rendered and checked on
0.1.1; every targeted class verified in the 0.1.3-beta.3 source.

## Permissions

`style.register`, `scene.register` (the redesign and lyrics scene) · `ui.pages`, `ui.navigation` (Now
Playing page; its label also carries the style flag) · `track.read`, `player.read`, `lyrics.read` (page
content) · `player.control` (page transport and tap-to-seek; sensitive) · `ui.layout` (Home
arrangement). No network, storage or account access.

## Known limitations

- Beyond YAQMC's four documented style selectors the redesign targets host class names, which YAQMC
  does not guarantee; a future host release can break parts of the look.
- Plugins cannot add or move markup: no queue button on the phone mini player, no new tab bar items,
  no swipe gestures, no artwork in track rows, no two-pane Settings.
- The Style switch reaches CSS through the sidebar entry's label (invisible marker); one flag only.
- Liquid Glass turns on live blur for floating bars, sidebar and menus on every platform; on slow GPUs
  prefer Classic. Reduced-transparency requests fall back to solid chrome.
- The Now Playing plugin page is a host block document (no artwork, 50 lyric lines at a time) and is
  reachable from the sidebar only, not from the phone tab bar.
- Desktop Lyrics, Lyrics Island and the Lyrics Composer canvas keep the stock look.
- No iOS host exists yet; `styles/50-platform-ios.css` is the entry point for one.
- Verified in the YAQMC web client with the offline fixture provider at desktop, phone and tablet sizes;
  not yet exercised on physical Android or macOS hardware.

Full details: [README](https://github.com/{{OWNER}}/{{REPO}}#readme).
