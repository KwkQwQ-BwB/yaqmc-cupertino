An Apple-inspired redesign of YAQMC: **macOS** on desktop, **iOS** on Android phones, **iPadOS** on
tablets, each in **Classic** or **Liquid Glass** style.

**1.1.0 fixes 1.0.0 not applying in the real app.** YAQMC 0.1.1 removes a plugin's stylesheets when it
starts that plugin's script, so 1.0.0 (styles and script in one package) only ever showed its Now
Playing entry. The redesign now ships script-free, and Liquid Glass follows YAQMC's own
**Settings → Appearance → Material** instead of a plugin setting that could not reach the stylesheets.

| Classic | Liquid Glass |
| --- | --- |
| ![Installed, Classic](https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/verification/yaqmc-0.1.1-3563bac/supplementary-desktop-light-classic-detail.jpg) | ![Installed, Liquid Glass](https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/verification/yaqmc-0.1.1-3563bac/supplementary-desktop-light-glass-detail.jpg) |
| ![Stock, before](https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/verification/yaqmc-0.1.1-3563bac/previous-1.0.0-desktop-home.jpg) | ![1.1.0 installed](https://raw.githubusercontent.com/{{OWNER}}/{{REPO}}/main/docs/verification/yaqmc-0.1.1-3563bac/desktop-light-glass-settings.jpg) |

Bottom row: 1.0.0 enabled in YAQMC 0.1.1 (stock look), and 1.1.0 after updating in the same profile.

## Packages

| File | SHA-256 | |
| --- | --- | --- |
| **`dev.cupertino.yaqmc-{{VERSION}}.yaqmc-plugin`** | `{{SHA}}` | The redesign and the lyrics scene. Stylesheets only. |
| `dev.cupertino.yaqmc.now-playing-{{VERSION}}.yaqmc-plugin` | `{{COMPANION_SHA}}` | Optional: Now Playing page and Home arrangement. Script only. |

## Install

1. Download **`dev.cupertino.yaqmc-{{VERSION}}.yaqmc-plugin`** below.
2. YAQMC → **Settings → Plugins → Choose file**, pick the package.
3. Check the SHA-256 shown by YAQMC against the table, review the permissions, then **Enable**.
4. Optional: install the Now Playing package the same way; **Appearance → Material → Translucent** for
   Liquid Glass; **Lyrics presets → Cupertino**.

**From 1.0.0:** disable Cupertino, choose the new package (YAQMC offers it as an update and lists the
permissions it drops), confirm, enable.

Disabling restores the stock interface immediately.

## Supported YAQMC versions

YAQMC **0.1.1 or newer** (plugin API v4). Verified by installing, updating, enabling, disabling and
cold-restarting in the YAQMC 0.1.1 desktop app (`3563bac`, Electron on Linux) with an isolated profile:
35/35 checks. Windows, macOS and Android hosts were not run; the phone and tablet layout systems were
exercised at those sizes inside the desktop app only.

## Permissions

Cupertino: `style.register`, `scene.register`. Now Playing: `ui.pages`, `ui.navigation` (page and its
sidebar entry) · `track.read`, `player.read`, `lyrics.read` (page content) · `player.control` (page
transport and tap-to-seek; sensitive) · `ui.layout` (Home arrangement). No network, storage or account
access.

## Known limitations

- Beyond YAQMC's four documented style selectors the redesign targets host class names, which YAQMC
  does not guarantee; a future host release can break parts of the look.
- Plugins cannot add or move markup: no queue button on the phone mini player, no new tab bar items,
  no swipe gestures, no artwork in track rows, no two-pane Settings.
- Liquid Glass turns on live blur for floating bars, sidebar and menus on every platform; on slow GPUs
  prefer Opaque. Reduced-transparency requests fall back to solid chrome.
- The Now Playing page is a host block document (no artwork, 50 lyric lines at a time), reachable from
  the desktop sidebar only; YAQMC on Android shows no plugin navigation entries.
- Desktop Lyrics, Lyrics Island and the Lyrics Composer canvas keep the stock look.
- No iOS host exists yet; `styles/50-platform-ios.css` is the entry point for one. iOS is not supported
  or tested.

Full details: [README](https://github.com/{{OWNER}}/{{REPO}}#readme).
