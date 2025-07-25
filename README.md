# Reddit Feed Scraper - Electron App

An Electron desktop application that allows you to log into Reddit and fetch your home feed using direct API calls with cookies, similar to the Python script `fetch_reddit_direct.py`.

## Features

- **Reddit Login**: Opens a modal window for secure Reddit authentication
- **Cookie Management**: Automatically saves and manages Reddit session cookies
- **Feed Fetching**: Retrieves your personalized Reddit home feed
- **Clean UI**: Modern, Reddit-inspired interface for viewing posts
- **TypeScript**: Built with TypeScript for type safety and better development experience

## Installation

```bash
# Install dependencies
npm install

# Build the TypeScript files
npm run build

# Run the application
npm start
```

## Development

```bash
# Run in development mode (builds and starts)
npm run dev

# Build only
npm run build
```

## How It Works

1. **Login Flow**: Click "Login with Reddit" to open a modal window that navigates to Reddit's login page
2. **Cookie Capture**: Once you successfully log in, the app captures your Reddit session cookies
3. **Authentication Check**: The app verifies cookies are valid by calling Reddit's `/api/me.json` endpoint
4. **Feed Fetching**: Uses the stored cookies to fetch your home feed from `https://www.reddit.com/.json`
5. **Post Display**: Renders posts with titles, subreddit info, authors, scores, and comments

## Architecture

- **Main Process** (`src/main.ts`): Handles Electron window management and IPC communication
- **Reddit API** (`src/reddit-api.ts`): TypeScript port of the Python Reddit fetching logic
- **Preload Script** (`src/preload.ts`): Secure bridge between main and renderer processes
- **Renderer** (`renderer/`): Frontend UI built with vanilla HTML/CSS/JavaScript

## Key Differences from Python Script

- Uses Electron's session management instead of file-based cookie storage
- Modal login window instead of manual cookie extraction
- Real-time authentication status checking
- Interactive UI for viewing posts

## Files

- `src/main.ts` - Main Electron process
- `src/reddit-api.ts` - Reddit API wrapper (TypeScript port of Python script)
- `src/preload.ts` - Secure IPC bridge
- `renderer/index.html` - Frontend UI
- `renderer/renderer.js` - Frontend JavaScript
- `tsconfig.json` - TypeScript configuration
- `package.json` - Project dependencies and scripts

## Dependencies

- **Electron**: Desktop app framework
- **TypeScript**: Type-safe JavaScript
- **node-fetch**: HTTP client for API requests
- **cheerio**: HTML parsing (for fallback HTML responses)

## Usage

1. Start the application with `npm start`
2. Click "Login with Reddit" and complete the authentication
3. Once authenticated, click "Fetch Feed" to load your Reddit home feed
4. Posts will display with titles, subreddit, author, score, and comment count
5. The app remembers your login session between uses