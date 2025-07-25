import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import { RedditAPI } from './reddit-api';
import { TwitterAPI } from './twitter-api';
import { YouTubeAPI } from './youtube-api';

let mainWindow: BrowserWindow;
let redditAPI: RedditAPI;
let twitterAPI: TwitterAPI;
let youtubeAPI: YouTubeAPI;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    height: 900,
    width: 1200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  redditAPI = new RedditAPI();
  twitterAPI = new TwitterAPI();
  youtubeAPI = new YouTubeAPI();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('reddit-login', async () => {
  try {
    const loginWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Load Reddit login page
    await loginWindow.loadURL('https://www.reddit.com/login');

    return new Promise((resolve) => {
      let resolved = false;

      // Monitor for successful login by checking for redirect to reddit.com
      loginWindow.webContents.on('did-navigate', async (event, url) => {
        console.log('Navigation to:', url);
        
        // Check if we're on Reddit home page (successful login)
        if ((url === 'https://www.reddit.com/' || url.startsWith('https://www.reddit.com/?')) && !resolved) {
          resolved = true;
          
          try {
            // Get cookies from the login session
            const cookies = await loginWindow.webContents.session.cookies.get({
              domain: '.reddit.com'
            });
            
            console.log(`Found ${cookies.length} Reddit cookies`);

            // Store cookies in main session
            for (const cookie of cookies) {
              await session.defaultSession.cookies.set({
                url: `https://reddit.com`,
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                expirationDate: cookie.expirationDate
              });
            }

            loginWindow.close();
            resolve({ success: true, cookies: cookies.length });
          } catch (error) {
            console.error('Error storing cookies:', error);
            loginWindow.close();
            resolve({ success: false, error: 'Failed to store cookies' });
          }
        }
      });

      loginWindow.on('closed', () => {
        if (!resolved) {
          resolve({ success: false, error: 'Login window closed' });
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('reddit-fetch-feed', async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({
      domain: '.reddit.com'
    });
    
    const cookieMap = new Map();
    cookies.forEach(cookie => {
      cookieMap.set(cookie.name, cookie.value);
    });

    const feed = await redditAPI.fetchFeed(cookieMap);
    return { success: true, data: feed };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('reddit-check-auth', async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({
      domain: '.reddit.com'
    });
    
    if (cookies.length === 0) {
      return { authenticated: false };
    }

    const cookieMap = new Map();
    cookies.forEach(cookie => {
      cookieMap.set(cookie.name, cookie.value);
    });

    const isValid = await redditAPI.checkCookieValidity(cookieMap);
    return { authenticated: isValid };
  } catch (error) {
    return { authenticated: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Twitter IPC handlers
ipcMain.handle('twitter-check-auth', async () => {
  try {
    const isValid = await twitterAPI.checkCookieValidity();
    return { authenticated: isValid };
  } catch (error) {
    return { authenticated: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('twitter-fetch-feed', async () => {
  try {
    const tweets = await twitterAPI.fetchTimeline(20);
    return { success: true, data: tweets };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// YouTube IPC handlers
ipcMain.handle('youtube-login', async () => {
  try {
    const loginWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Load YouTube login page
    await loginWindow.loadURL('https://www.youtube.com/');

    return new Promise((resolve) => {
      let resolved = false;

      // Monitor for successful login by checking for YouTube home page
      loginWindow.webContents.on('did-navigate', async (event, url) => {
        console.log('YouTube navigation to:', url);
        
        // Check if we're on YouTube home page (successful login)
        if ((url === 'https://www.youtube.com/' || url.startsWith('https://www.youtube.com/?')) && !resolved) {
          resolved = true;
          
          try {
            // Get cookies from the login session
            const cookies = await loginWindow.webContents.session.cookies.get({
              domain: '.youtube.com'
            });
            
            console.log(`Found ${cookies.length} YouTube cookies`);

            // Store cookies in main session
            for (const cookie of cookies) {
              await session.defaultSession.cookies.set({
                url: `https://youtube.com`,
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                expirationDate: cookie.expirationDate
              });
            }

            loginWindow.close();
            resolve({ success: true, cookies: cookies.length });
          } catch (error) {
            console.error('Error storing YouTube cookies:', error);
            loginWindow.close();
            resolve({ success: false, error: 'Failed to store cookies' });
          }
        }
      });

      loginWindow.on('closed', () => {
        if (!resolved) {
          resolve({ success: false, error: 'Login window closed' });
        }
      });
    });
  } catch (error) {
    console.error('YouTube login error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('youtube-fetch-feed', async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({
      domain: '.youtube.com'
    });
    
    const cookieMap = new Map();
    cookies.forEach(cookie => {
      cookieMap.set(cookie.name, cookie.value);
    });

    const feed = await youtubeAPI.fetchFeed(cookieMap);
    return { success: true, data: feed };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('youtube-check-auth', async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({
      domain: '.youtube.com'
    });
    
    if (cookies.length === 0) {
      return { authenticated: false };
    }

    const cookieMap = new Map();
    cookies.forEach(cookie => {
      cookieMap.set(cookie.name, cookie.value);
    });

    const isValid = await youtubeAPI.checkCookieValidity(cookieMap);
    return { authenticated: isValid };
  } catch (error) {
    return { authenticated: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});