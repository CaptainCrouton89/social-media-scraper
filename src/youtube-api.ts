import fetch from 'node-fetch';

export interface YouTubeVideo {
  video_id: string;
  title: string;
  channel: string;
  views: string;
  published: string;
  duration: string;
  thumbnail: string;
  url: string;
  scraped_at: string;
  // Fields to match Reddit post structure for unified feed
  platform: 'youtube';
  author: string; // Channel name
  score: number; // Derived from views
  num_comments: number; // Not available, set to 0
  permalink: string; // YouTube URL
  post_id: string; // Video ID
  image_url: string; // Thumbnail URL
  external_url: string; // YouTube URL
  created_utc: number; // Parsed from published date
}

export interface YouTubeContext {
  client: {
    hl: string;
    gl: string;
    remoteHost: string;
    deviceMake: string;
    deviceModel: string;
    visitorData: string;
    userAgent: string;
    clientName: string;
    clientVersion: string;
    osName: string;
    osVersion: string;
    originalUrl: string;
    platform: string;
    clientFormFactor: string;
    screenDensityFloat: number;
    userInterfaceTheme: string;
    timeZone: string;
    browserName: string;
    browserVersion: string;
    acceptHeader: string;
    utcOffsetMinutes: number;
    memoryTotalKbytes: string;
    mainAppWebInfo: {
      graftUrl: string;
      pwaInstallabilityStatus: string;
      webDisplayMode: string;
      isWebNativeShareAvailable: boolean;
    };
  };
  user: {
    lockedSafetyMode: boolean;
  };
  request: {
    useSsl: boolean;
    internalExperimentFlags: any[];
    consistencyTokenJars: any[];
  };
}

export class YouTubeAPI {
  private readonly apiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
  private readonly baseUrl = 'https://www.youtube.com';
  private readonly innertubeUrl = `${this.baseUrl}/youtubei/v1`;
  
  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/json',
    'Origin': 'https://www.youtube.com',
    'Referer': 'https://www.youtube.com/',
    'X-Goog-Visitor-Id': 'CgtLLUdSbHlFQXQwOCiRkI3EBjIKCgJVUxIEGgAgWA%3D%3D',
  };

  private readonly context: YouTubeContext = {
    client: {
      hl: 'en',
      gl: 'US',
      remoteHost: '136.24.64.186',
      deviceMake: 'Apple',
      deviceModel: '',
      visitorData: 'CgtLLUdSbHlFQXQwOCiRkI3EBjIKCgJVUxIEGgAgWA%3D%3D',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36,gzip(gfe)',
      clientName: 'WEB',
      clientVersion: '2.20250724.00.00',
      osName: 'Macintosh',
      osVersion: '10_15_7',
      originalUrl: 'https://www.youtube.com/',
      platform: 'DESKTOP',
      clientFormFactor: 'UNKNOWN_FORM_FACTOR',
      screenDensityFloat: 2,
      userInterfaceTheme: 'USER_INTERFACE_THEME_DARK',
      timeZone: 'America/Los_Angeles',
      browserName: 'Chrome',
      browserVersion: '137.0.0.0',
      acceptHeader: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      utcOffsetMinutes: -420,
      memoryTotalKbytes: '8000000',
      mainAppWebInfo: {
        graftUrl: 'https://www.youtube.com/',
        pwaInstallabilityStatus: 'PWA_INSTALLABILITY_STATUS_UNKNOWN',
        webDisplayMode: 'WEB_DISPLAY_MODE_FULLSCREEN',
        isWebNativeShareAvailable: true
      }
    },
    user: {
      lockedSafetyMode: false
    },
    request: {
      useSsl: true,
      internalExperimentFlags: [],
      consistencyTokenJars: []
    }
  };

  async checkCookieValidity(cookies: Map<string, string>): Promise<boolean> {
    try {
      const cookieString = Array.from(cookies.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

      const response = await fetch(`${this.innertubeUrl}/guide?prettyPrint=false`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Cookie': cookieString
        },
        body: JSON.stringify({
          context: this.context
        })
      });

      if (response.status === 200) {
        const data = await response.json() as any;
        // Check if we got a valid response with sidebar/guide data
        return !!(data && (JSON.stringify(data).includes('sidebar') || JSON.stringify(data).includes('guide')));
      }

      return false;
    } catch (error) {
      console.error('YouTube cookie validation error:', error);
      return false;
    }
  }

  async fetchFeed(cookies: Map<string, string>, continuationToken?: string): Promise<YouTubeVideo[]> {
    const cookieString = Array.from(cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');

    const payload: any = {
      context: this.context,
      browseId: 'FEwhat_to_watch'
    };

    if (continuationToken) {
      payload.continuation = continuationToken;
    }

    try {
      const response = await fetch(`${this.innertubeUrl}/browse?key=${this.apiKey}&prettyPrint=false`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Cookie': cookieString
        },
        body: JSON.stringify(payload)
      });

      console.log(`YouTube response status: ${response.status}`);
      console.log(`YouTube content-Type: ${response.headers.get('content-type')}`);

      if (response.status === 200) {
        const data = await response.json() as any;
        return this.parseHomeFeed(data);
      } else if (response.status === 401 || response.status === 403) {
        throw new Error(`YouTube authentication error (${response.status}). Cookies may be expired.`);
      } else {
        throw new Error(`YouTube HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      console.error('YouTube request failed:', error);
      throw error;
    }
  }

  private parseHomeFeed(data: any): YouTubeVideo[] {
    const videos: YouTubeVideo[] = [];

    try {
      // Navigate through the YouTube response structure
      const contents = data?.contents || {};
      let sections: any[] = [];

      // Try twoColumnBrowseResultsRenderer structure
      if (contents.twoColumnBrowseResultsRenderer) {
        const primaryContents = contents.twoColumnBrowseResultsRenderer?.tabs?.[0];
        const tabRenderer = primaryContents?.tabRenderer;
        const content = tabRenderer?.content;

        if (content?.richGridRenderer) {
          sections = content.richGridRenderer?.contents || [];
        } else if (content?.sectionListRenderer) {
          sections = content.sectionListRenderer?.contents || [];
        }
      }
      // Try direct contents access
      else if (contents.richGridRenderer) {
        sections = contents.richGridRenderer?.contents || [];
      } else if (contents.sectionListRenderer) {
        sections = contents.sectionListRenderer?.contents || [];
      }

      // Process each section
      for (const section of sections) {
        videos.push(...this.extractVideosFromSection(section));
      }

      console.log(`Extracted ${videos.length} YouTube videos`);
      return videos;
    } catch (error) {
      console.error('Error parsing YouTube home feed:', error);
      return [];
    }
  }

  private extractVideosFromSection(section: any): YouTubeVideo[] {
    const videos: YouTubeVideo[] = [];

    try {
      // Handle different section types
      if (section.richItemRenderer) {
        const content = section.richItemRenderer?.content;
        if (content?.videoRenderer) {
          const video = this.parseVideoRenderer(content.videoRenderer);
          if (video) {
            videos.push(video);
          }
        }
      } else if (section.richSectionRenderer) {
        const content = section.richSectionRenderer?.content;
        if (content?.richShelfRenderer) {
          const shelfContents = content.richShelfRenderer?.contents || [];
          for (const item of shelfContents) {
            if (item.richItemRenderer) {
              const itemContent = item.richItemRenderer?.content;
              if (itemContent?.videoRenderer) {
                const video = this.parseVideoRenderer(itemContent.videoRenderer);
                if (video) {
                  videos.push(video);
                }
              }
            }
          }
        }
      } else if (section.videoRenderer) {
        const video = this.parseVideoRenderer(section.videoRenderer);
        if (video) {
          videos.push(video);
        }
      }
    } catch (error) {
      console.error('Error extracting videos from section:', error);
    }

    return videos;
  }

  private parseVideoRenderer(videoData: any): YouTubeVideo | null {
    try {
      const videoId = videoData?.videoId;
      if (!videoId) {
        return null;
      }

      // Extract title
      let title = '';
      const titleData = videoData?.title;
      if (titleData?.runs) {
        title = titleData.runs.map((run: any) => run?.text || '').join('');
      } else if (titleData?.simpleText) {
        title = titleData.simpleText;
      }

      // Extract channel info
      let channelName = '';
      const channelData = videoData?.longBylineText || videoData?.ownerText;
      if (channelData?.runs && channelData.runs.length > 0) {
        channelName = channelData.runs[0]?.text || '';
      }

      // Extract view count
      let viewCount = '';
      const viewData = videoData?.viewCountText;
      if (viewData?.simpleText) {
        viewCount = viewData.simpleText;
      } else if (viewData?.runs) {
        viewCount = viewData.runs.map((run: any) => run?.text || '').join('');
      }

      // Extract published time
      let publishedTime = '';
      const publishedData = videoData?.publishedTimeText;
      if (publishedData?.simpleText) {
        publishedTime = publishedData.simpleText;
      }

      // Extract duration
      let duration = '';
      const durationData = videoData?.lengthText;
      if (durationData?.simpleText) {
        duration = durationData.simpleText;
      }

      // Extract thumbnail
      let thumbnailUrl = '';
      const thumbnails = videoData?.thumbnail?.thumbnails || [];
      if (thumbnails.length > 0) {
        thumbnailUrl = thumbnails[thumbnails.length - 1]?.url || ''; // Get highest quality
      }

      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const scrapedAt = new Date().toISOString();

      // Parse view count to generate a score (rough approximation)
      const score = this.parseViewCountToScore(viewCount);

      // Try to parse published time to UTC timestamp
      const createdUtc = this.parsePublishedTimeToUtc(publishedTime);

      return {
        video_id: videoId,
        title,
        channel: channelName,
        views: viewCount,
        published: publishedTime,
        duration,
        thumbnail: thumbnailUrl,
        url,
        scraped_at: scrapedAt,
        // Unified feed fields
        platform: 'youtube',
        author: channelName,
        score,
        num_comments: 0, // YouTube doesn't provide comment count in home feed
        permalink: url,
        post_id: videoId,
        image_url: thumbnailUrl,
        external_url: url,
        created_utc: createdUtc
      };
    } catch (error) {
      console.error('Error parsing video renderer:', error);
      return null;
    }
  }

  private parseViewCountToScore(viewCount: string): number {
    if (!viewCount) return 0;
    
    try {
      // Extract numbers from strings like "1.2M views", "850K views", "1,234 views"
      const match = viewCount.match(/[\d,\.]+/);
      if (!match) return 0;
      
      const numStr = match[0].replace(/,/g, '');
      let num = parseFloat(numStr);
      
      if (viewCount.toLowerCase().includes('k')) {
        num *= 1000;
      } else if (viewCount.toLowerCase().includes('m')) {
        num *= 1000000;
      } else if (viewCount.toLowerCase().includes('b')) {
        num *= 1000000000;
      }
      
      // Convert to a Reddit-like score (views / 1000)
      return Math.floor(num / 1000);
    } catch {
      return 0;
    }
  }

  private parsePublishedTimeToUtc(publishedTime: string): number {
    if (!publishedTime) return Math.floor(Date.now() / 1000);
    
    try {
      const now = new Date();
      const match = publishedTime.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i);
      
      if (match) {
        const amount = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        let milliseconds = 0;
        switch (unit) {
          case 'second':
            milliseconds = amount * 1000;
            break;
          case 'minute':
            milliseconds = amount * 60 * 1000;
            break;
          case 'hour':
            milliseconds = amount * 60 * 60 * 1000;
            break;
          case 'day':
            milliseconds = amount * 24 * 60 * 60 * 1000;
            break;
          case 'week':
            milliseconds = amount * 7 * 24 * 60 * 60 * 1000;
            break;
          case 'month':
            milliseconds = amount * 30 * 24 * 60 * 60 * 1000; // Approximate
            break;
          case 'year':
            milliseconds = amount * 365 * 24 * 60 * 60 * 1000; // Approximate
            break;
        }
        
        return Math.floor((now.getTime() - milliseconds) / 1000);
      }
      
      return Math.floor(Date.now() / 1000);
    } catch {
      return Math.floor(Date.now() / 1000);
    }
  }
}