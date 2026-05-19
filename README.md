# ⚡ Kairo — AI Context Saver

> A cross-browser extension that captures context from AI chat platforms (Claude, ChatGPT, Gemini, DeepSeek) and saves them as reusable "Capsules" — solving context amnesia when switching between AI tools.

## Features

- 🎯 **One-click capture** — Floating button on all supported AI chat pages
- 🔍 **Smart search** — Filter capsules by title, summary, tags, or platform
- 💉 **Context injection** — Inject saved context directly into any AI chat input
- ✨ **AI enrichment** — Optional Claude API integration to auto-extract goals, stack, and decisions
- 📦 **Export/Import** — Full JSON backup and restore
- ⌨️ **Keyboard shortcut** — `Ctrl+Shift+S` to capture from anywhere
- 🌐 **Cross-browser** — Chrome, Firefox, Edge, Brave, Opera

## Supported Platforms

| Platform | Status |
|----------|--------|
| Claude (claude.ai) | ✅ |
| ChatGPT (chat.openai.com / chatgpt.com) | ✅ |
| Gemini (gemini.google.com) | ✅ |
| DeepSeek (chat.deepseek.com) | ✅ |

## Quick Start

```bash
# Install dependencies
npm install

# Development build (Chrome, with watch)
npm run dev

# Production build
npm run build

# Firefox builds
npm run dev:firefox
npm run build:firefox
```

## Loading the Extension

### Chrome / Edge / Brave
1. Run `npm run build` (or `npm run dev` for development)
2. Open `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist-chrome/` folder

### Firefox
1. Run `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select any file in the `dist-firefox/` folder

## Project Structure

```
kairo/
├── manifest.json              # MV3 manifest (Chrome base)
├── manifest.firefox.json      # Firefox overrides
├── background/
│   ├── service-worker.js      # Central hub: messaging, storage, API
│   └── enricher.js            # Claude API enrichment
├── content/
│   ├── index.js               # Entry: platform detection + capture flow
│   ├── injector.js            # Floating button injection
│   └── extractors/
│       ├── index.js           # Hostname → extractor router
│       ├── claude.js          # Claude DOM scraper
│       ├── chatgpt.js         # ChatGPT DOM scraper
│       ├── gemini.js          # Gemini DOM scraper
│       └── deepseek.js        # DeepSeek DOM scraper
├── popup/
│   ├── index.html             # Popup shell
│   └── popup.js               # Capsule list UI (Preact + htm)
├── options/
│   ├── index.html             # Settings page shell
│   └── options.js             # Settings UI (Preact + htm)
├── shared/
│   ├── capsule.js             # Data model + validator
│   ├── storage.js             # chrome.storage.local wrapper
│   ├── messaging.js           # Message type constants
│   └── utils.js               # Utilities (timeAgo, truncate, etc.)
├── assets/icons/              # Extension icons (16, 48, 128)
├── scripts/
│   └── generate-icons.js      # Icon generator
├── vite.config.js             # Build configuration
└── package.json
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Manifest | MV3 (Chrome base + Firefox overlay) |
| UI | Preact + htm (~3kb, no build transform needed) |
| Storage | chrome.storage.local (capsules) + chrome.storage.sync (settings) |
| Cross-browser | webextension-polyfill |
| Build | Vite + vite-plugin-web-extension |
| AI Enrichment | Anthropic Claude API (optional) |

## Configuration

### Claude API Enrichment (Optional)

1. Open Kairo Settings (click ⚙ in the popup)
2. Enter your Anthropic API key
3. Toggle "Auto-enrich on capture" to automatically extract structured data

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Capture current chat | `Ctrl+Shift+S` |

## License

MIT
