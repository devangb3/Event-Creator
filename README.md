# Gemini Event Creator – Chrome Extension

Turn any text on the web into a Google Calendar event in a couple of clicks.  
**Highlight → Parse (Gemini) → Create event.**

This extension injects a small, glassy popup in the bottom-right of the page (similar to Grammarly). When you highlight something that looks like an event, it offers **Quick Create** or **Edit & Create** and talks to Google Calendar through OAuth.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Prerequisites](#prerequisites)
5. [Setup & Installation](#setup--installation)
6. [Google OAuth (Calendar)](#google-oauth-calendar)
7. [How It Works (User Flow)](#how-it-works-user-flow)
8. [Build & Load in Chrome](#build--load-in-chrome)
9. [Troubleshooting](#troubleshooting)
10. [Permissions](#permissions)
11. [Future Enhancements](#future-enhancements)
12. [Contributors](#contributors)
13. [Links](#links)
14. [License](#license)

---

## Overview

**Gemini Event Creator** is a Chrome extension that:

- Listens for **text selection** on web pages
- Sends that text to the **background script**
- (Optionally) uses **Google Gemini** to extract event details
- Creates a **Google Calendar event** for the logged-in user

The goal is to remove the “copy → open Calendar → paste → fix date → save” loop and let you do it inline.

---

## Features

- ✅ **Text selection → popup**: highlight any text and get a “Create calendar event” card
- 🤖 **Smart parsing with Gemini**: extract title, date, time, and location from natural language
- 📅 **Google Calendar integration**: creates events with your own Google account
- ✏️ **Edit before create**: change title/time/location/color/reminder in a small form
- 🟣 **Inline UI**: glassmorphism, bottom-right position, consistent with popup.html style
- 🪶 **Lightweight**: pure JS; no React, no heavy UI frameworks
- 🧱 **MV3-friendly**: background is a service worker
- 🛟 **Fallback**: if no API key / parsing fails, it can still build a basic event

---

## Architecture

**Files:**

- **`content.js`**
  - Runs on web pages
  - Detects selection
  - Shows floating UI (quick + edit)
  - Sends messages to background:
    - `analyzeText`
    - `parseTextToEvent`
    - `createEventFromData`

- **`background.js`**
  - MV3 service worker
  - Receives messages from content
  - Gets Google OAuth token via `chrome.identity`
  - Calls **Gemini** (if key is present, injected via Vite)
  - Calls **Google Calendar API** to create the event
  - Returns success/failure to content

- **`popup.html` / `popup.js`**
  - UI in extension popup
  - Shows “How to use”
  - On/off toggle
  - Styled to match the glassy on-page card

- **`vite.config.js`**
  - Builds multiple entry points (`background.js`, `content.js`, `popup.js`, `auth.js`)
  - Injects `process.env.GEMINI_API_KEY` at build time
  - Can be extended to copy `icons/` into `dist/`

---

## Prerequisites

- Node.js (latest LTS recommended)
- npm
- A **Google Gemini API key** (for AI-powered parsing)
- A **Google Cloud project** with **Google Calendar API** enabled
- A **Chrome extension ID** (you get this when you load the unpacked build)

---

## Setup & Installation

### 1. Clone & install

```bash
git clone https://github.com/<your-org-or-username>/Event-Creator.git
cd Event-Creator
npm install
```

### 2. Add your Gemini API key

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_actual_api_key_here
```

Your `vite.config.js` should already contain something like:

```js
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          background: 'background.js',
          content: 'content.js',
          auth: 'auth.js',
          popup: 'popup.js'
        }
      },
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      }
    }
  };
});
```

---

## Google OAuth (Calendar)

To actually create a Google Calendar event for the user, you need OAuth. Here’s the minimal flow.

### Step-by-step

1. **Create a Google Cloud project**
    - Go to Google Cloud Console
    - Click "Select a project" → "New project"
    - Name it e.g. `gemini-event-creator`
    - Create & select it

2. **Enable Calendar API**
    - APIs & Services → Library
    - Search **Google Calendar API**
    - Click Enable

3. **Configure OAuth consent screen**
    - User type: External
    - App name: Gemini Event Creator
    - Add your email
    - Scopes:  
      `https://www.googleapis.com/auth/calendar.events`
    - Test users: Add your Google accounts
    - Save

4. **Create OAuth credentials**
    - Type: Chrome extension
    - Add your extension ID from `chrome://extensions`
    - Get client ID like: `1234567890-abcxyz123.apps.googleusercontent.com`

5. **Add to manifest.json**

```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/calendar.events"
  ]
},
"permissions": [
  "identity",
  "storage",
  "activeTab",
  "scripting",
  "tabs"
],
"background": {
  "service_worker": "background.js"
}
```

---

## How It Works (User Flow)

1. Highlight a text like:  
   _“Team sync on Friday at 10am in Walker Hall”_
2. `content.js` shows the floating card: Quick Create / Edit & Create
3. **Quick Create** → Sends message:

```js
chrome.runtime.sendMessage({ action: "analyzeText", text })
```

4. **Background handles it**:
   - Gets OAuth token
   - Optionally calls Gemini (if key present)
   - Creates Calendar event
   - Sends result back (snackbar → “Event created”)

5. **Edit & Create** → Sends:

```js
chrome.runtime.sendMessage({ action: "parseTextToEvent", text })
```

   - Shows editable form (title, time, location, etc.)
   - On submit → creates event

---

## Build & Load in Chrome

```bash
npm run build
```

- Output in `dist/`

### Load in Chrome

1. Go to `chrome://extensions/`
2. Turn on Developer mode
3. Click "Load unpacked"
4. Select `dist/` folder

---

## Troubleshooting

- **Extension Not Loading**
  - Load `dist/`, not root
  - Rebuild → `npm run build`

- **Popup Not Appearing**
  - Some sites block extensions (e.g., Chrome Web Store)
  - Open DevTools → Console: should show `>>> CONTENT.JS ATTACHED <<<`

- **OAuth Issues**
  - Ensure extension ID in Google Cloud matches real one
  - Add your Google account as test user

- **Background Not Responding**
  - MV3 service worker may be asleep
  - Trigger again by selecting text
  - Check logs in “service worker” console

---

## Permissions

```json
"permissions": [
  "storage",
  "activeTab",
  "scripting",
  "tabs",
  "identity"
],
"host_permissions": [
  "<all_urls>"
]
```

**Google scope used:**  
`https://www.googleapis.com/auth/calendar.events`

---

## Future Enhancements

- 🔁 Recurring events (RRULE)
- 🗓️ Calendar selector (primary/others)
- 🌐 Outlook / iCloud support
- 📦 Event templates
- ⚠️ Conflict detection
- 📜 Activity log in popup

---

## Contributors

| Name                  | Email                           |
|-----------------------|----------------------------------|
| Prasannadatta Kawadkar | prasannadatta2k23@gmail.com     |
| Devang Borkar         | devangborkar3@gmail.com         |
| Leeha Rachabattuni    | lrachabattuni@ucdavis.edu       |
| Hetvi Bhadani         | hbhadani@ucdavis.edu            |

GitHub handles (optional):

- @prasannadatta-k
- @devangb3

---

## Links

- **Privacy Policy**: [https://devangb3.github.io/Event-Creator/PRIVACY](https://devangb3.github.io/Event-Creator/PRIVACY)
- **License**: [LICENSE](LICENSE)

---

## License

This project is licensed under the terms described in the `LICENSE` file in this repository.
