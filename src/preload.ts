import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  redditLogin: () => ipcRenderer.invoke('reddit-login'),
  redditFetchFeed: () => ipcRenderer.invoke('reddit-fetch-feed'),
  redditCheckAuth: () => ipcRenderer.invoke('reddit-check-auth'),
  twitterFetchFeed: () => ipcRenderer.invoke('twitter-fetch-feed'),
  twitterCheckAuth: () => ipcRenderer.invoke('twitter-check-auth'),
  youtubeLogin: () => ipcRenderer.invoke('youtube-login'),
  youtubeFetchFeed: () => ipcRenderer.invoke('youtube-fetch-feed'),
  youtubeCheckAuth: () => ipcRenderer.invoke('youtube-check-auth')
});

declare global {
  interface Window {
    electronAPI: {
      redditLogin: () => Promise<{ success: boolean; cookies?: number; error?: string }>;
      redditFetchFeed: () => Promise<{ success: boolean; data?: any; error?: string }>;
      redditCheckAuth: () => Promise<{ authenticated: boolean; error?: string }>;
      twitterFetchFeed: () => Promise<{ success: boolean; data?: any; error?: string }>;
      twitterCheckAuth: () => Promise<{ authenticated: boolean; error?: string }>;
      youtubeLogin: () => Promise<{ success: boolean; cookies?: number; error?: string }>;
      youtubeFetchFeed: () => Promise<{ success: boolean; data?: any; error?: string }>;
      youtubeCheckAuth: () => Promise<{ authenticated: boolean; error?: string }>;
    };
  }
}