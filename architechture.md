# Capsule Extension — Full Architecture Document

> A cross-browser extension that captures context from AI chat platforms (Claude, ChatGPT, Gemini, DeepSeek) and saves them as reusable "Capsules" — solving context amnesia when switching between AI tools.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Manifest V3 Configuration](#4-manifest-v3-configuration)
5. [Core Data Model](#5-core-data-model)
6. [Component Architecture](#6-component-architecture)
   - 6.1 [Background Service Worker](#61-background-service-worker)
   - 6.2 [Content Scripts](#62-content-scripts)
   - 6.3 [Platform Extractors](#63-platform-extractors)
   - 6.4 [Injector](#64-injector)
   - 6.5 [Popup UI](#65-popup-ui)
   - 6.6 [Options Page](#66-options-page)
7. [Storage Layer](#7-storage-layer)
8. [Messaging System](#8-messaging-system)
9. [Cross-Browser Compatibility](#9-cross-browser-compatibility)
10. [Build System](#10-build-system)
11. [Context Enrichment via Claude API](#11-context-enrichment-via-claude-api)
12. [Team Folders & Sync](#12-team-folders--sync)
13. [Capsule Injection (Reuse)](#13-capsule-injection-reuse)
14. [Security Considerations](#14-security-considerations)
15. [Extractor Maintenance Strategy](#15-extractor-maintenance-strategy)
16. [Roadmap](#16-roadmap)
17. [AI Builder Prompt](#17-ai-builder-prompt)

---

## 1. Project Overview

**Extension Name:** Capsule (or your brand name)
**Purpose:** Capture AI chat context into portable "Capsules" from any major AI platform, store them locally, and re-inject them into any other AI platform — eliminating repetitive project re-explanation.

**Supported Platforms (v1):**
- Claude (claude.ai)
- ChatGPT (chat.openai.com)
- Gemini (gemini.google.com)
- DeepSeek (chat.deepseek.com)

**Target Browsers:**
- Chrome / Chromium
- Firefox
- Edge
- Brave
- Opera

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Manifest | MV3 | Required for Chrome Web Store; Firefox MV3 support added |
| UI Framework | Preact + htm | Tiny (~3kb), no build step needed for popup |
| Storage | `chrome.storage.local` + IndexedDB (idb) | Local-first, no backend required for v1 |
| Cross-browser | `webextension-polyfill` | Unified `browser.*` API across Chrome and Firefox |
| Build | Vite + `vite-plugin-web-extension` | Outputs separate `/dist-chrome` and `/dist-firefox` |
| Styling | Tailwind CSS (CDN in popup) | Fast to prototype, zero config |
| AI Enrichment | Anthropic Claude API (optional) | Auto-summarizes raw chat into structured Capsule fields |

---

## 3. Folder Structure

```
capsule-ext/
│
├── manifest.json                   # MV3 manifest (Chrome base)
├── manifest.firefox.json           # Firefox overrides (merged at build)
│
├── background/
│   └── service-worker.js           # Central hub: storage, messaging, API calls
│
├── content/
│   ├── index.js                    # Entry: detects platform, loads extractor
│   ├── injector.js                 # Injects capture button into AI chat UI
│   └── extractors/
│       ├── index.js                # Extractor router (hostname → extractor)
│       ├── claude.js               # Claude-specific DOM scraper
│       ├── chatgpt.js              # ChatGPT DOM scraper
│       ├── gemini.js               # Gemini DOM scraper
│       └── deepseek.js             # DeepSeek DOM scraper
│
├── popup/
│   ├── index.html                  # Extension popup shell
│   ├── popup.js                    # Capsule list, search, copy, inject
│   └── components/
│       ├── CapsuleCard.js          # Individual capsule display component
│       ├── SearchBar.js            # Filter by title/tag/platform
│       └── FolderSidebar.js        # Team folder navigation
│
├── options/
│   ├── index.html                  # Settings page
│   └── options.js                  # API key config, sync settings, shortcuts
│
├── shared/
│   ├── capsule.js                  # Capsule data model + factory function
│   ├── storage.js                  # IndexedDB read/write wrapper
│   ├── messaging.js                # Message type constants + helpers
│   └── utils.js                    # Date formatting, text truncation, etc.
│
├── assets/
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
│
├── scripts/
│   └── build-firefox.js            # Post-build shim for FF manifest merge
│
├── vite.config.js
├── package.json
└── README.md
```

---

## 4. Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Capsule — AI Context Saver",
  "version": "1.0.0",
  "description": "Capture context from AI chats and reuse it anywhere.",
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "contextMenus",
    "notifications"
  ],
  "host_permissions": [
    "https://claude.ai/*",
    "https://chat.openai.com/*",
    "https://gemini.google.com/*",
    "https://chat.deepseek.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "https://claude.ai/*",
        "https://chat.openai.com/*",
        "https://gemini.google.com/*",
        "https://chat.deepseek.com/*"
      ],
      "js": ["content/index.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  "options_ui": {
    "page": "options/index.html",
    "open_in_tab": true
  },
  "commands": {
    "capture-capsule": {
      "suggested_key": { "default": "Ctrl+Shift+S" },
      "description": "Capture current AI chat as a Capsule"
    }
  }
}
```

**Firefox manifest override (`manifest.firefox.json`):**
```json
{
  "background": {
    "scripts": ["background/service-worker.js"]
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "capsule@yourname.dev",
      "strict_min_version": "109.0"
    }
  }
}
```

---

## 5. Core Data Model

```js
// shared/capsule.js

export function createCapsule(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: "",                   // User-editable or AI-generated title
    source: "",                  // "claude" | "chatgpt" | "gemini" | "deepseek"
    url: "",                     // Full URL at capture time
    capturedAt: Date.now(),      // Unix timestamp
    updatedAt: Date.now(),

    content: {
      summary: "",               // Short paragraph summary of the context
      goals: [],                 // string[] — what the user was trying to achieve
      constraints: [],           // string[] — limitations, requirements stated
      stack: [],                 // string[] — tech stack or tools mentioned
      keyDecisions: [],          // string[] — decisions made during the conversation
      rawTurns: [],              // { role: "user"|"assistant", text: string }[]
      rawSnippet: "",            // Last N chars of raw conversation (fallback)
    },

    meta: {
      tags: [],                  // string[] — user-added tags
      folder: null,              // string | null — team folder name
      pinned: false,             // boolean
      enriched: false,           // whether Claude API was used to enrich
    },

    ...overrides,
  };
}
```

---

## 6. Component Architecture

### 6.1 Background Service Worker

The service worker is the central brain. It handles:
- Receiving `SAVE_CAPSULE` messages from content scripts
- Optional Claude API calls for context enrichment
- Read/write to `chrome.storage.local`
- Keyboard shortcut listener (`chrome.commands`)
- Context menu setup

```js
// background/service-worker.js

import { saveCapsule, getCapsules, deleteCapsule } from '../shared/storage.js';
import { enrichCapsule } from './enricher.js'; // optional Claude API call

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SAVE_CAPSULE') {
    handleSave(msg.capsule, msg.options).then(sendResponse);
    return true; // keep channel open for async
  }
  if (msg.type === 'GET_CAPSULES') {
    getCapsules().then(sendResponse);
    return true;
  }
  if (msg.type === 'DELETE_CAPSULE') {
    deleteCapsule(msg.id).then(sendResponse);
    return true;
  }
});

async function handleSave(capsule, options = {}) {
  if (options.enrich) {
    capsule = await enrichCapsule(capsule); // calls Claude API
  }
  await saveCapsule(capsule);
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icons/icon48.png',
    title: 'Capsule saved!',
    message: capsule.title || 'Context captured successfully.',
  });
  return { success: true, capsule };
}

// Keyboard shortcut: Ctrl+Shift+S
chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-capsule') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__capsuleTriggerCapture?.(),
      });
    });
  }
});
```

---

### 6.2 Content Scripts

```js
// content/index.js

import browser from 'webextension-polyfill';
import { getExtractor } from './extractors/index.js';
import { injectButton } from './injector.js';
import { createCapsule } from '../shared/capsule.js';

const extractor = getExtractor(location.hostname);
if (!extractor) return; // unsupported platform, bail

injectButton(async () => {
  const turns = extractor.extract();
  const snippet = turns.map(t => `[${t.role}]: ${t.text}`).join('\n\n');

  const capsule = createCapsule({
    source: extractor.platform,
    url: location.href,
    content: {
      rawTurns: turns,
      rawSnippet: snippet.slice(-4000), // last 4000 chars as fallback
    },
  });

  const result = await browser.runtime.sendMessage({
    type: 'SAVE_CAPSULE',
    capsule,
    options: { enrich: true }, // set false to skip Claude API enrichment
  });

  return result;
});

// Expose trigger for keyboard shortcut
window.__capsuleTriggerCapture = () => {
  document.querySelector('#capsule-capture-btn')?.click();
};
```

---

### 6.3 Platform Extractors

```js
// content/extractors/index.js

import claudeExtractor from './claude.js';
import chatgptExtractor from './chatgpt.js';
import geminiExtractor from './gemini.js';
import deepseekExtractor from './deepseek.js';

const EXTRACTORS = {
  'claude.ai': claudeExtractor,
  'chat.openai.com': chatgptExtractor,
  'gemini.google.com': geminiExtractor,
  'chat.deepseek.com': deepseekExtractor,
};

export function getExtractor(hostname) {
  return EXTRACTORS[hostname] || null;
}
```

```js
// content/extractors/claude.js
export default {
  platform: 'claude',
  extract() {
    const turns = [...document.querySelectorAll('[data-testid="human-turn"], [data-testid="ai-turn"]')];
    return turns.map(el => ({
      role: el.dataset.testid === 'human-turn' ? 'user' : 'assistant',
      text: el.innerText.trim(),
    }));
  },
};

// content/extractors/chatgpt.js
export default {
  platform: 'chatgpt',
  extract() {
    const turns = [...document.querySelectorAll('[data-message-author-role]')];
    return turns.map(el => ({
      role: el.dataset.messageAuthorRole,
      text: el.innerText.trim(),
    }));
  },
};

// content/extractors/gemini.js
export default {
  platform: 'gemini',
  extract() {
    const userTurns = [...document.querySelectorAll('.user-query-text')];
    const aiTurns = [...document.querySelectorAll('.model-response-text')];
    const turns = [];
    const max = Math.max(userTurns.length, aiTurns.length);
    for (let i = 0; i < max; i++) {
      if (userTurns[i]) turns.push({ role: 'user', text: userTurns[i].innerText.trim() });
      if (aiTurns[i]) turns.push({ role: 'assistant', text: aiTurns[i].innerText.trim() });
    }
    return turns;
  },
};

// content/extractors/deepseek.js
export default {
  platform: 'deepseek',
  extract() {
    const turns = [...document.querySelectorAll('.chat-message')];
    return turns.map(el => ({
      role: el.classList.contains('user') ? 'user' : 'assistant',
      text: el.innerText.trim(),
    }));
  },
};
```

> **Selector Stability Note:** AI platforms update their DOM regularly. Prefer `data-testid`, `aria-*`, and semantic role attributes over class names. Review extractors every 4–6 weeks or when users report broken capture.

---

### 6.4 Injector

```js
// content/injector.js

export function injectButton(onCapture) {
  if (document.getElementById('capsule-capture-btn')) return; // already injected

  const btn = document.createElement('button');
  btn.id = 'capsule-capture-btn';
  btn.textContent = '⚡ Capture';
  btn.setAttribute('aria-label', 'Save this conversation as a Capsule');
  btn.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 2147483647;
    padding: 9px 16px;
    background: #6c47ff;
    color: #fff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
    font-family: system-ui, sans-serif;
    font-weight: 600;
    box-shadow: 0 4px 14px rgba(108,71,255,0.4);
    transition: opacity 0.2s;
  `;

  btn.addEventListener('click', async () => {
    btn.textContent = '⏳ Capturing...';
    btn.disabled = true;
    try {
      await onCapture();
      btn.textContent = '✅ Saved!';
    } catch (e) {
      btn.textContent = '❌ Failed';
      console.error('[Capsule] Capture error:', e);
    }
    setTimeout(() => {
      btn.textContent = '⚡ Capture';
      btn.disabled = false;
    }, 2500);
  });

  document.body.appendChild(btn);
}
```

---

### 6.5 Popup UI

The popup shows all saved Capsules with search, filter by platform/tag/folder, copy-to-clipboard, and inject-to-current-tab.

```js
// popup/popup.js (Preact + htm)

import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html } from 'htm/preact';
import browser from 'webextension-polyfill';

function Popup() {
  const [capsules, setCapsules] = useState([]);
  const [query, setQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState(null);

  useEffect(() => {
    browser.runtime.sendMessage({ type: 'GET_CAPSULES' }).then(setCapsules);
  }, []);

  const filtered = capsules.filter(c => {
    const matchQuery = c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.content.summary.toLowerCase().includes(query.toLowerCase());
    const matchFolder = activeFolder ? c.meta.folder === activeFolder : true;
    return matchQuery && matchFolder;
  });

  const folders = [...new Set(capsules.map(c => c.meta.folder).filter(Boolean))];

  return html`
    <div style="width:360px; padding:12px; font-family:system-ui,sans-serif;">
      <h2 style="margin:0 0 10px; font-size:16px;">⚡ Capsules</h2>
      <input
        type="text"
        placeholder="Search capsules..."
        value=${query}
        onInput=${e => setQuery(e.target.value)}
        style="width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; margin-bottom:8px;"
      />
      ${folders.length > 0 && html`
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
          <button onClick=${() => setActiveFolder(null)}
            style="padding:3px 10px; border-radius:12px; border:1px solid #ccc; cursor:pointer;
              background:${!activeFolder ? '#6c47ff' : '#fff'}; color:${!activeFolder ? '#fff' : '#333'};">
            All
          </button>
          ${folders.map(f => html`
            <button onClick=${() => setActiveFolder(f === activeFolder ? null : f)}
              style="padding:3px 10px; border-radius:12px; border:1px solid #ccc; cursor:pointer;
                background:${f === activeFolder ? '#6c47ff' : '#fff'}; color:${f === activeFolder ? '#fff' : '#333'};">
              ${f}
            </button>
          `)}
        </div>
      `}
      <div style="max-height:420px; overflow-y:auto;">
        ${filtered.length === 0
          ? html`<p style="color:#999; text-align:center;">No capsules yet. Capture one!</p>`
          : filtered.map(c => html`<${CapsuleCard} capsule=${c} key=${c.id} />`)}
      </div>
    </div>
  `;
}

function CapsuleCard({ capsule }) {
  const copy = () => navigator.clipboard.writeText(capsule.content.rawSnippet);

  return html`
    <div style="border:1px solid #eee; border-radius:10px; padding:10px; margin-bottom:8px;">
      <div style="font-weight:600; font-size:13px; margin-bottom:4px;">${capsule.title || 'Untitled Capsule'}</div>
      <div style="font-size:11px; color:#888; margin-bottom:6px;">
        ${capsule.source} • ${new Date(capsule.capturedAt).toLocaleDateString()}
      </div>
      <div style="font-size:12px; color:#444; margin-bottom:8px;">
        ${capsule.content.summary?.slice(0, 120) || capsule.content.rawSnippet?.slice(0, 120)}...
      </div>
      <div style="display:flex; gap:6px;">
        <button onClick=${copy}
          style="flex:1; padding:5px; font-size:11px; border-radius:6px; border:1px solid #ddd; cursor:pointer;">
          📋 Copy
        </button>
      </div>
    </div>
  `;
}

render(html`<${Popup} />`, document.getElementById('root'));
```

---

### 6.6 Options Page

Handles:
- Claude API key input (for enrichment feature)
- Toggle: auto-enrich on capture
- Toggle: show floating button on AI pages
- Export all Capsules as JSON
- Import Capsules from JSON file
- Clear all data

---

## 7. Storage Layer

```js
// shared/storage.js

const STORAGE_KEY = 'capsules';

export async function saveCapsule(capsule) {
  const existing = await getCapsules();
  const idx = existing.findIndex(c => c.id === capsule.id);
  if (idx > -1) {
    existing[idx] = { ...existing[idx], ...capsule, updatedAt: Date.now() };
  } else {
    existing.unshift(capsule);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: existing });
}

export async function getCapsules() {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  return res[STORAGE_KEY] || [];
}

export async function deleteCapsule(id) {
  const existing = await getCapsules();
  const filtered = existing.filter(c => c.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

export async function updateCapsule(id, updates) {
  const capsule = (await getCapsules()).find(c => c.id === id);
  if (!capsule) return;
  await saveCapsule({ ...capsule, ...updates, updatedAt: Date.now() });
}

// For larger datasets, swap to IndexedDB:
// npm install idb
// import { openDB } from 'idb';
// const db = await openDB('capsule-db', 1, { upgrade(db) { db.createObjectStore('capsules', { keyPath: 'id' }); }});
```

**Storage limits:**
- `chrome.storage.local` — 10MB (can request `unlimitedStorage` permission)
- `chrome.storage.sync` — 100KB total, 8KB per item (use for settings only, not Capsules)
- IndexedDB — no hard cap, recommended once Capsule count exceeds ~500

---

## 8. Messaging System

All communication between content scripts, background, and popup uses a typed message bus.

```js
// shared/messaging.js

export const MSG = {
  SAVE_CAPSULE:    'SAVE_CAPSULE',
  GET_CAPSULES:    'GET_CAPSULES',
  DELETE_CAPSULE:  'DELETE_CAPSULE',
  UPDATE_CAPSULE:  'UPDATE_CAPSULE',
  INJECT_CONTEXT:  'INJECT_CONTEXT',   // inject Capsule text into active tab's input
  ENRICH_CAPSULE:  'ENRICH_CAPSULE',   // trigger Claude API enrichment
};

// Helper to send with timeout safety
export function sendMessage(payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message timeout')), timeoutMs);
    chrome.runtime.sendMessage(payload, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(response);
    });
  });
}
```

---

## 9. Cross-Browser Compatibility

| Feature | Chrome | Firefox | Edge | Brave |
|---|---|---|---|---|
| MV3 | ✅ Native | ✅ Since FF 109 | ✅ Chromium | ✅ Chromium |
| `chrome.*` API | ✅ | ✅ via polyfill | ✅ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| `scripting.executeScript` | ✅ | ✅ | ✅ | ✅ |
| Sidebar (optional) | ❌ | ✅ `sidebarAction` | ✅ | ❌ |

**Key compatibility steps:**
1. Always import `webextension-polyfill` and use `browser.*` not `chrome.*` in shared code
2. Build separate `/dist-chrome` and `/dist-firefox` via Vite plugin
3. Test on Firefox using `web-ext run` CLI tool
4. For Firefox sidebar: add `sidebar_action` key to FF manifest override

```bash
npm install -g web-ext
web-ext run --source-dir dist-firefox --target firefox-desktop
```

---

## 10. Build System

```js
// vite.config.js
import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [
    webExtension({
      manifest: () => {
        const base = require('./manifest.json');
        if (process.env.BROWSER === 'firefox') {
          const ff = require('./manifest.firefox.json');
          return { ...base, ...ff };
        }
        return base;
      },
    }),
  ],
  build: {
    outDir: process.env.BROWSER === 'firefox' ? 'dist-firefox' : 'dist-chrome',
  },
});
```

```json
// package.json scripts
{
  "scripts": {
    "dev:chrome":   "BROWSER=chrome vite build --watch",
    "dev:firefox":  "BROWSER=firefox vite build --watch",
    "build:chrome": "BROWSER=chrome vite build",
    "build:firefox":"BROWSER=firefox vite build",
    "dev:run-ff":   "web-ext run --source-dir dist-firefox"
  }
}
```

---

## 11. Context Enrichment via Claude API

When `options.enrich = true`, the background worker calls the Claude API to parse raw conversation turns into structured Capsule fields.

```js
// background/enricher.js

export async function enrichCapsule(capsule) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) return capsule; // skip if no key set

  const prompt = `
You are a context extraction assistant.
Given this AI conversation, extract:
- title: A short descriptive title (max 8 words)
- summary: A 2-3 sentence summary of what the user is building or working on
- goals: Array of specific goals the user mentioned
- constraints: Array of any technical or business constraints mentioned
- stack: Array of technologies, frameworks, or tools mentioned
- keyDecisions: Array of any decisions or conclusions reached

Respond ONLY with valid JSON matching this shape:
{ "title": "", "summary": "", "goals": [], "constraints": [], "stack": [], "keyDecisions": [] }

Conversation:
${capsule.content.rawSnippet}
  `.trim();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '{}';

  try {
    const enriched = JSON.parse(text.replace(/```json|```/g, '').trim());
    return {
      ...capsule,
      title: enriched.title || capsule.title,
      content: { ...capsule.content, ...enriched },
      meta: { ...capsule.meta, enriched: true },
    };
  } catch {
    return capsule; // return unenriched if parse fails
  }
}
```

---

## 12. Team Folders & Sync

**v1 — Local only:**
- Folders are just a `meta.folder` string on each Capsule
- Managed in popup UI with create/rename/delete

**v2 — Backend sync (optional):**
- Supabase or Firebase for real-time team sync
- Auth via Google OAuth (using Chrome Identity API)
- Capsules encrypted client-side before upload using Web Crypto API
- Conflict resolution: last-write-wins with `updatedAt` timestamp

```js
// Chrome Identity API for Google OAuth
chrome.identity.getAuthToken({ interactive: true }, (token) => {
  // Use token with Supabase/Firebase SDK
});
```

---

## 13. Capsule Injection (Reuse)

Inject a saved Capsule's context directly into the active AI chat's input box:

```js
// Triggered from popup: sends message to content script
async function injectCapsule(capsule) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (contextText) => {
      // Try common input selectors across AI platforms
      const selectors = [
        'div[contenteditable="true"]',     // Claude, ChatGPT
        'textarea[data-id="root"]',         // some ChatGPT versions
        '#prompt-textarea',                 // ChatGPT
        'rich-textarea',                    // Gemini
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.focus();
          document.execCommand('insertText', false, contextText);
          break;
        }
      }
    },
    args: [`[Context from Capsule]\n\n${capsule.content.summary}\n\nGoals: ${capsule.content.goals.join(', ')}\n\nStack: ${capsule.content.stack.join(', ')}`],
  });
}
```

---

## 14. Security Considerations

| Risk | Mitigation |
|---|---|
| XSS via injected button | Always use `createElement`, never `innerHTML` |
| API key exposure | Store in `chrome.storage.sync` (encrypted by browser), never hardcode |
| DOM scraping scope | `host_permissions` scoped to exact AI domains only |
| Data exfiltration | All data stored locally; no network calls except optional Claude API |
| CSP violations | Extension content scripts run in isolated world; no inline scripts |
| Capsule data leak | Add optional AES-256 local encryption before any sync |

---

## 15. Extractor Maintenance Strategy

AI platforms update their DOM frequently. Build in resilience:

1. **Prefer stable selectors:** `data-testid`, `aria-role`, `data-message-author-role` over class names
2. **Fallback chain:** If primary selector returns 0 results, try 2-3 fallback selectors
3. **Health check endpoint:** On capture, log selector success/failure to local storage for debugging
4. **Version-lock selectors:** Comment each selector with the date it was verified
5. **Community updates:** Open-source the extractors so users can submit fixes via PR

```js
// Defensive extractor pattern
extract() {
  // Primary selector (verified 2025-05)
  let turns = [...document.querySelectorAll('[data-testid="human-turn"]')];
  // Fallback (older Claude UI)
  if (!turns.length) turns = [...document.querySelectorAll('.human-message')];
  // Last resort: grab all paragraphs in main content area
  if (!turns.length) turns = [...document.querySelectorAll('main p')];
  return turns.map(el => ({ role: 'user', text: el.innerText.trim() }));
}
```

---

## 16. Roadmap

### v1 — Local MVP
- [x] MV3 cross-browser manifest
- [x] Floating capture button on all 4 AI platforms
- [x] Raw turn extraction + local storage
- [x] Popup with list, search, copy
- [x] Keyboard shortcut (Ctrl+Shift+S)

### v2 — Enrichment + Inject
- [ ] Claude API enrichment (goals, stack, constraints)
- [ ] Inject Capsule into AI chat input
- [ ] Tag management in popup
- [ ] Export / import JSON

### v3 — Teams + Sync
- [ ] Google OAuth via Chrome Identity API
- [ ] Supabase backend for team Capsule sync
- [ ] Team folders with role-based access
- [ ] Capsule versioning (edit history)

### v4 — Intelligence
- [ ] Auto-detect project context changes mid-conversation
- [ ] Suggest related Capsules when opening a new AI chat
- [ ] Capsule templates (e.g., "Bug Report", "Feature Spec", "Code Review")

---

## 17. AI Builder Prompt

Use this prompt to build the extension with any AI coding assistant (Claude, ChatGPT, Cursor, etc.):

---

```
You are an expert browser extension developer. Build a production-grade cross-browser extension called "Capsule" using Manifest V3.

## Goal
The extension captures context from AI chat platforms (Claude, ChatGPT, Gemini, DeepSeek) and saves them as structured "Capsules" so users can reuse that context across different AI tools — solving the "context amnesia" problem.

## Tech Stack
- Manifest V3 (Chrome base + Firefox overlay)
- webextension-polyfill for cross-browser browser.* API
- Vite + vite-plugin-web-extension for build (outputs /dist-chrome and /dist-firefox)
- Preact + htm for popup UI (no JSX transform needed)
- chrome.storage.local for Capsule persistence
- Optional: Anthropic Claude API for context enrichment

## Folder Structure
capsule-ext/
├── manifest.json
├── manifest.firefox.json
├── background/service-worker.js
├── content/
│   ├── index.js
│   ├── injector.js
│   └── extractors/ (claude.js, chatgpt.js, gemini.js, deepseek.js, index.js)
├── popup/ (index.html, popup.js)
├── options/ (index.html, options.js)
└── shared/ (capsule.js, storage.js, messaging.js, utils.js)

## Capsule Data Model
{
  id: crypto.randomUUID(),
  title: string,
  source: "claude" | "chatgpt" | "gemini" | "deepseek",
  url: string,
  capturedAt: number,
  updatedAt: number,
  content: {
    summary: string,
    goals: string[],
    constraints: string[],
    stack: string[],
    keyDecisions: string[],
    rawTurns: { role: "user"|"assistant", text: string }[],
    rawSnippet: string,
  },
  meta: { tags: string[], folder: string|null, pinned: boolean, enriched: boolean }
}

## Core Features to Implement

1. CONTENT SCRIPT
   - Detect which AI platform is active via hostname
   - Load the correct extractor for that platform
   - Inject a floating "⚡ Capture" button (fixed position, bottom-right, z-index max)
   - On click: extract all conversation turns from the DOM, build a Capsule, send to background worker
   - Expose window.__capsuleTriggerCapture for keyboard shortcut support

2. EXTRACTORS (one per platform)
   - Use data-testid and aria attributes over class names (more stable)
   - Each extractor returns: { role: "user"|"assistant", text: string }[]
   - Include 2 fallback selectors per platform in case primary selector breaks
   - Claude: [data-testid="human-turn"] and [data-testid="ai-turn"]
   - ChatGPT: [data-message-author-role]
   - Gemini: .user-query-text and .model-response-text
   - DeepSeek: .chat-message with .user class detection

3. BACKGROUND SERVICE WORKER
   - Listen for SAVE_CAPSULE, GET_CAPSULES, DELETE_CAPSULE, UPDATE_CAPSULE messages
   - On save: optionally call Claude API to enrich the Capsule (if API key is set)
   - Fire a chrome.notifications notification on successful save
   - Register Ctrl+Shift+S keyboard shortcut to trigger capture on active tab

4. STORAGE (chrome.storage.local)
   - saveCapsule(capsule): upsert by id, newest first
   - getCapsules(): return all as array
   - deleteCapsule(id): remove by id
   - updateCapsule(id, updates): partial update

5. POPUP UI (Preact + htm)
   - Search bar filtering by title and summary
   - Filter buttons for team folders
   - Capsule cards showing: title, source platform, date, summary snippet
   - Copy button: copies rawSnippet to clipboard
   - Delete button with confirmation
   - Link to options page

6. CLAUDE API ENRICHMENT (background/enricher.js)
   - Read API key from chrome.storage.sync
   - Send rawSnippet to claude-sonnet-4-20250514
   - Prompt: extract title, summary, goals[], constraints[], stack[], keyDecisions[] as JSON
   - Merge enriched fields back into Capsule before saving

7. CAPSULE INJECTION
   - From popup, inject selected Capsule's context into active tab's AI input
   - Try selectors: div[contenteditable="true"], #prompt-textarea, rich-textarea
   - Use document.execCommand('insertText') for compatibility

8. OPTIONS PAGE
   - Claude API key input (saved to chrome.storage.sync)
   - Toggle: auto-enrich on capture (default: off)
   - Toggle: show floating button (default: on)
   - Export all Capsules as JSON download
   - Import Capsules from JSON file upload
   - Danger zone: clear all data button

## Cross-Browser Requirements
- All shared code uses browser.* via webextension-polyfill, never chrome.* directly
- vite.config.js merges manifest.firefox.json when BROWSER=firefox
- manifest.firefox.json sets background.scripts instead of background.service_worker
- Include gecko browser_specific_settings with a placeholder extension ID

## Build Scripts (package.json)
- dev:chrome, dev:firefox, build:chrome, build:firefox
- Include web-ext for Firefox live-reload testing

## Code Quality Requirements
- All async operations wrapped in try/catch with console.error('[Capsule] ...')
- No innerHTML anywhere — use createElement + textContent only
- Validate capsule schema before saving (check required fields exist)
- Storage writes should be atomic (read → modify → write in one async block)
- Each extractor should log "[Capsule Extractor] Platform: X, Turns found: N" on capture

Start by scaffolding the complete folder structure with all files stubbed out, then implement each module fully one at a time. Begin with: shared/capsule.js → shared/storage.js → background/service-worker.js → content/extractors → content/index.js → content/injector.js → popup → options.
```

---

*Document version: 1.0 — Last updated: May 2026*