import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export interface RedditPost {
  title: string;
  text: string;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
  permalink: string;
  post_id: string;
  image_url?: string;
  video_url?: string;
  external_url?: string;
  created_utc?: number;
}

export class RedditAPI {
  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'DNT': '1',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Referer': 'https://www.reddit.com/',
    'X-Requested-With': 'XMLHttpRequest'
  };

  async checkCookieValidity(cookies: Map<string, string>): Promise<boolean> {
    try {
      const cookieString = Array.from(cookies.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

      const response = await fetch('https://www.reddit.com/api/me.json', {
        headers: {
          ...this.headers,
          'Cookie': cookieString
        }
      });

      if (response.status === 200) {
        const data = await response.json() as any;
        return !!(data && (data.name || data.data));
      }

      return false;
    } catch (error) {
      console.error('Cookie validation error:', error);
      return false;
    }
  }

  async fetchFeed(cookies: Map<string, string>, after?: string): Promise<RedditPost[]> {
    const cookieString = Array.from(cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');

    const url = 'https://www.reddit.com/.json';
    const params = new URLSearchParams({
      limit: '25'
    });

    if (after) {
      params.set('after', after);
    }

    try {
      const response = await fetch(`${url}?${params}`, {
        headers: {
          ...this.headers,
          'Cookie': cookieString
        }
      });

      console.log(`Response status: ${response.status}`);
      console.log(`Content-Type: ${response.headers.get('content-type')}`);

      if (response.status === 200) {
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('json')) {
          const data = await response.json() as any;
          return this.extractPostsFromJson(data);
        } else {
          const html = await response.text();
          return this.extractPostsFromHtml(html);
        }
      } else if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication error (${response.status}). Cookies may be expired.`);
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }

  private extractPostsFromJson(jsonData: any): RedditPost[] {
    const posts: RedditPost[] = [];

    try {
      if (jsonData && typeof jsonData === 'object') {
        if (jsonData.kind === 'Listing') {
          const children = jsonData.data?.children || [];
          
          for (const child of children) {
            if (child.kind === 't3') { // t3 is a link/post
              const postData = child.data;
              const post: RedditPost = {
                title: postData.title || '',
                text: postData.selftext || '',
                author: postData.author || '',
                subreddit: postData.subreddit || '',
                score: postData.score || 0,
                num_comments: postData.num_comments || 0,
                permalink: postData.permalink || '',
                post_id: postData.id || '',
                created_utc: postData.created_utc || 0
              };

              // Extract image URL from preview
              const preview = postData.preview;
              if (preview?.images?.[0]?.source?.url) {
                post.image_url = preview.images[0].source.url.replace(/&amp;/g, '&');
              }

              // Extract video URL
              const media = postData.media;
              if (media?.reddit_video?.fallback_url) {
                post.video_url = media.reddit_video.fallback_url;
              }

              // External URL
              if (postData.url && postData.url !== postData.permalink) {
                post.external_url = postData.url;
              }

              posts.push(post);
            }
          }
        }
      }

      console.log(`Extracted ${posts.length} posts from JSON`);
      return posts;
    } catch (error) {
      console.error('Error extracting from JSON:', error);
      return [];
    }
  }

  private extractPostsFromHtml(htmlContent: string): RedditPost[] {
    const posts: RedditPost[] = [];

    try {
      // Try to decode base64 if needed
      let content = htmlContent;
      if (!content.trim().startsWith('<')) {
        try {
          content = Buffer.from(content, 'base64').toString('utf-8');
        } catch {
          // Not base64, continue with original
        }
      }

      const $ = cheerio.load(content);
      
      // Find all shreddit-post elements
      const postElements = $('shreddit-post');
      console.log(`Found ${postElements.length} shreddit-post elements`);

      // Also check for article elements
      const articleElements = $('article');
      console.log(`Found ${articleElements.length} article elements`);

      // Process all elements
      [...postElements.toArray(), ...articleElements.toArray()].forEach(element => {
        const $elem = $(element);
        if ($elem.attr('aria-label') || element.tagName === 'shreddit-post') {
          const post = this.extractPostData($elem, $);
          if (post) {
            posts.push(post);
          }
        }
      });

      console.log(`Extracted ${posts.length} posts from HTML`);
      return posts;
    } catch (error) {
      console.error('Error parsing HTML:', error);
      return [];
    }
  }

  private extractPostData($element: any, $: any): RedditPost | null {
    try {
      const post: RedditPost = {
        title: '',
        text: '',
        author: '',
        subreddit: '',
        score: 0,
        num_comments: 0,
        permalink: '',
        post_id: ''
      };

      // Extract title from aria-label
      const ariaLabel = $element.attr('aria-label');
      if (ariaLabel) {
        post.title = ariaLabel;
      }

      // Extract permalink from data attribute or links
      const permalink = $element.attr('permalink');
      if (permalink) {
        post.permalink = permalink;
      } else {
        // Look for comment links
        const commentLink = $element.find('a[href*="/comments/"]').first();
        if (commentLink.length) {
          post.permalink = commentLink.attr('href') || '';
        }
      }

      // Extract post ID and subreddit from permalink
      if (post.permalink) {
        const parts = post.permalink.split('/');
        if (parts.length > 4) {
          post.subreddit = (parts[1] === 'r' && parts[2]) ? parts[2] : '';
          post.post_id = parts[4] || '';
        }
      }

      // Look for author in the HTML
      const elementText = $element.text();
      const authorMatch = elementText.match(/u\/(\w+)/);
      if (authorMatch) {
        post.author = authorMatch[1];
      }

      // Look for post content
      const contentElem = $element.find('[data-testid="post-content"]').first();
      if (contentElem.length) {
        post.text = contentElem.text().trim();
      }

      // Look for images
      const imgElem = $element.find('img').first();
      if (imgElem.length) {
        const src = imgElem.attr('src');
        if (src && (src.includes('preview.redd.it') || (src.includes('redd.it') && !src.includes('communityIcon')))) {
          post.image_url = src;
        }
      }

      // Look for videos
      const videoElem = $element.find('video').first();
      if (videoElem.length) {
        const src = videoElem.attr('src');
        if (src) {
          post.video_url = src;
        }
      }

      // Extract any external URLs from the text
      const urlMatch = elementText.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        post.external_url = urlMatch[0];
      }

      // Only return if we have meaningful data
      if (post.title || post.permalink || post.text) {
        return post;
      }

      return null;
    } catch (error) {
      console.error('Error extracting post:', error);
      return null;
    }
  }
}