# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Build TypeScript files
npm run build

# Run application in production mode (builds first)
npm start

# Run in development mode (builds and starts Electron)
npm run dev
```

## Architecture Overview

This is an Electron desktop application that scrapes Reddit feeds using cookie-based authentication. The app is structured as a TypeScript-based Electron application with three main components:

### Main Process (`src/main.ts`)
- Manages Electron BrowserWindow lifecycle and application events
- Handles IPC communication via `ipcMain.handle()` for three operations:
  - `reddit-login`: Opens modal login window, captures Reddit cookies, stores them in Electron's session
  - `reddit-fetch-feed`: Retrieves cookies from session and calls RedditAPI to fetch feed
  - `reddit-check-auth`: Validates stored cookies against Reddit's `/api/me.json` endpoint
- Uses Electron's `session.defaultSession.cookies` for persistent cookie storage

### Reddit API Layer (`src/reddit-api.ts`)
- TypeScript port of the original Python `fetch_reddit_direct.py` script
- `RedditAPI` class with methods for cookie validation and feed fetching
- Fetches from `https://www.reddit.com/.json` endpoint using stored session cookies
- Handles both JSON and HTML responses, parsing posts with metadata (title, author, subreddit, scores)
- Uses `node-fetch` for HTTP requests and `cheerio` for HTML parsing fallback

### Renderer Process (`renderer/`)
- Vanilla HTML/CSS/JavaScript frontend (no framework)
- Communicates with main process via `window.electronAPI` exposed through preload script
- Displays authentication status, login button, and feed with Reddit-style UI
- Real-time status updates and error handling

### Security Model
- Uses Electron's `contextIsolation: true` and `nodeIntegration: false`
- Preload script (`src/preload.ts`) provides secure IPC bridge via `contextBridge`
- Reddit authentication handled through modal window to capture cookies securely

## Key Implementation Details

- **Cookie Management**: Reddit session cookies are captured from login modal and stored in Electron's session, not files
- **Authentication Flow**: Modal window opens Reddit login, monitors navigation to detect successful login, extracts cookies automatically
- **TypeScript Configuration**: Outputs to `dist/` directory, targets ES2020, uses strict mode
- **Feed Parsing**: Supports both Reddit's JSON API response and HTML fallback parsing using cheerio for `shreddit-post` elements

## Related Files

- Original Python implementation in `fetch_reddit_direct.py` serves as reference for Reddit API interaction patterns
- Build outputs to `dist/` directory, with main entry point at `dist/main.js`