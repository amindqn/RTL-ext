RTL Toggle
=================

Toggle right-to-left layout on any page with one click. Code blocks stay left-to-right for readability.

Features
- One-click RTL: sets `direction: rtl` and right-aligns text.
- Code stays LTR: `pre`, `code`, and common highlight classes remain LTR.
- Per-tab state: each tab can be On/Off independently, with matching toolbar icon.
- Optional shortcut: `Alt+Shift+R` (also on macOS) to toggle the active tab.

Install (Chrome/Edge)
1) Open `chrome://extensions` and enable “Developer mode”.
2) Click “Load unpacked” and select this folder.
3) The extension icon appears in the toolbar.

Use
- Click the icon to toggle RTL for the current tab. The icon switches between On/Off.
- Or press `Alt+Shift+R` to toggle the active tab.
- State is per-tab. Switch tabs and each tab keeps its own state.

Permissions
- `activeTab`: allow CSS injection after user interaction on the active tab.
- `scripting`: needed for `insertCSS` and `removeCSS`.
- `storage`: store per-tab state and keep the icon in sync.

Limitations
- No injection on restricted pages (e.g., `chrome://`, Web Store).
- With only `activeTab`, you may need to click again after page reload. For automatic apply on all sites, add `host_permissions: ["<all_urls>"]` in `manifest.json` (requires broader access).

Customize
- Edit the `CSS` template or logic in `src/background/index.js` to tweak RTL rules or code-block handling.
- Change or remove the shortcut in `manifest.json` under `commands`.

Project Structure
```
.
├── manifest.json                # Extension manifest (MV3)
├── src/
│   └── background/
│       └── index.js             # Service worker, state, and CSS injection
└── assets/
    └── icons/                   # Toolbar + store icons (on/off and app icons)
```

Changelog
- 1.1.0: per-tab icons/state, optional shortcut, robust CSS injection, crisp icons.
- 1.0.0: initial release.
