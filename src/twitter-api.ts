import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

export interface TwitterTweet {
  id: string;
  text: string;
  author: {
    name: string;
    screen_name: string;
    followers_count: number;
  };
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  created_at: string;
  url: string;
  media?: {
    type: 'video' | 'photo' | 'animated_gif';
    url: string;
    thumbnail_url?: string;
  }[];
}

export class TwitterAPI {
  private session: Map<string, string> = new Map();
  private csrfToken: string = '';
  
  private readonly headers = {
    'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en'
  };

  constructor() {
    this.loadCookiesFromFile();
  }

  private loadCookiesFromFile(): void {
    try {
      const cookieFile = path.join(process.cwd(), 'twitter_cookie.txt');
      const cookieString = fs.readFileSync(cookieFile, 'utf-8').trim();
      
      // Parse cookie string into Map
      const cookies = cookieString.split('; ');
      for (const cookie of cookies) {
        if (cookie.includes('=')) {
          const [name, value] = cookie.split('=', 2);
          this.session.set(name, value);
        }
      }
      
      // Extract CSRF token from ct0 cookie
      this.csrfToken = this.session.get('ct0') || '';
      
      console.log(`Loaded ${this.session.size} Twitter cookies`);
    } catch (error) {
      console.error('Error loading Twitter cookies:', error);
    }
  }

  async checkCookieValidity(): Promise<boolean> {
    try {
      const cookieString = Array.from(this.session.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

      const response = await fetch('https://x.com/i/api/1.1/account/verify_credentials.json', {
        headers: {
          ...this.headers,
          'Cookie': cookieString,
          'x-csrf-token': this.csrfToken
        }
      });

      return response.status === 200;
    } catch (error) {
      console.error('Twitter cookie validation error:', error);
      return false;
    }
  }

  async fetchTimeline(count: number = 20): Promise<TwitterTweet[]> {
    const cookieString = Array.from(this.session.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');

    const url = "https://x.com/i/api/graphql/_qrmuYLQl79WB9oFxfs1Sw/HomeTimeline";
    
    const payload = {
      variables: {
        count,
        includePromotedContent: true,
        latestControlAvailable: true,
        requestContext: "launch"
      },
      features: {
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        articles_preview_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        rweb_video_timestamps_enabled: true,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        responsive_web_enhance_cards_enabled: false,
        rweb_tipjar_consumption_enabled: true,
        responsive_web_grok_analyze_post_followups_enabled: true,
        responsive_web_grok_analysis_button_from_backend: true,
        responsive_web_grok_share_attachment_enabled: true,
        responsive_web_grok_community_note_auto_translation_is_enabled: true,
        responsive_web_grok_analyze_button_fetch_trends_enabled: true,
        responsive_web_jetfuel_frame: true,
        responsive_web_grok_image_annotation_enabled: true,
        profile_label_improvements_pcf_label_in_post_enabled: true,
        payments_enabled: true,
        premium_content_api_read_enabled: true,
        rweb_video_screen_enabled: true,
        responsive_web_grok_show_grok_translated_post: true
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Cookie': cookieString,
          'x-csrf-token': this.csrfToken,
        },
        body: JSON.stringify(payload)
      });

      console.log(`Twitter API response status: ${response.status}`);

      if (response.status === 200) {
        const data = await response.json() as any;
        return this.parseTweets(data);
      } else if (response.status === 401 || response.status === 403) {
        throw new Error(`Twitter authentication error (${response.status}). Cookies may be expired.`);
      } else {
        const errorText = await response.text();
        throw new Error(`Twitter API error ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('Twitter API request failed:', error);
      throw error;
    }
  }

  private parseTweets(timelineData: any): TwitterTweet[] {
    const tweets: TwitterTweet[] = [];
    
    try {
      const instructions = timelineData?.data?.home?.home_timeline_urt?.instructions || [];
      
      for (const instruction of instructions) {
        if (instruction.type === 'TimelineAddEntries') {
          const entries = instruction.entries || [];
          
          for (const entry of entries) {
            const content = entry.content || {};
            if (content.entryType === 'TimelineTimelineItem') {
              const itemContent = content.itemContent || {};
              if (itemContent.itemType === 'TimelineTweet') {
                const tweetResult = itemContent.tweet_results?.result;
                
                if (tweetResult?.__typename === 'Tweet') {
                  const tweet = this.extractTweetInfo(tweetResult);
                  if (tweet) {
                    tweets.push(tweet);
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing Twitter timeline:', error);
    }
    
    console.log(`Extracted ${tweets.length} tweets from Twitter timeline`);
    return tweets;
  }

  private extractTweetInfo(tweetData: any): TwitterTweet | null {
    try {
      const tweetId = tweetData.rest_id;
      const legacy = tweetData.legacy || {};
      
      // User info
      const userResult = tweetData.core?.user_results?.result || {};
      const userLegacy = userResult.legacy || {};
      const userCore = userResult.core || {};
      
      // Extract text content
      const fullText = legacy.full_text || '';
      
      // Extract metrics
      const favoriteCount = legacy.favorite_count || 0;
      const retweetCount = legacy.retweet_count || 0;
      const replyCount = legacy.reply_count || 0;
      
      // Extract media content
      const media = this.extractMediaContent(legacy);
      
      const tweet: TwitterTweet = {
        id: tweetId,
        text: fullText,
        author: {
          name: userCore.name || '',
          screen_name: userCore.screen_name || '',
          followers_count: userLegacy.followers_count || 0
        },
        metrics: {
          likes: favoriteCount,
          retweets: retweetCount,
          replies: replyCount
        },
        created_at: legacy.created_at || '',
        url: `https://x.com/${userCore.screen_name}/status/${tweetId}`
      };
      
      if (media && media.length > 0) {
        tweet.media = media;
      }
      
      return tweet;
    } catch (error) {
      console.error('Error extracting tweet info:', error);
      return null;
    }
  }

  private extractMediaContent(legacy: any): { type: 'video' | 'photo' | 'animated_gif'; url: string; thumbnail_url?: string; }[] {
    try {
      const media = [];
      
      // Check extended_entities.media first (more complete media info)
      const extendedMedia = legacy.extended_entities?.media || [];
      const entitiesMedia = legacy.entities?.media || [];
      
      // Use extended_entities if available, otherwise fall back to entities
      const mediaArray = extendedMedia.length > 0 ? extendedMedia : entitiesMedia;
      
      for (const mediaItem of mediaArray) {
        const mediaType = mediaItem.type;
        
        if (mediaType === 'video' || mediaType === 'animated_gif') {
          // Get the highest quality video variant
          const variants = mediaItem.video_info?.variants || [];
          const mp4Variants = variants.filter((v: any) => v.content_type === 'video/mp4');
          
          if (mp4Variants.length > 0) {
            // Sort by bitrate (highest first) and take the best quality
            const bestVariant = mp4Variants.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
            
            media.push({
              type: mediaType as 'video' | 'animated_gif',
              url: bestVariant.url,
              thumbnail_url: mediaItem.media_url_https
            });
          }
        } else if (mediaType === 'photo') {
          media.push({
            type: 'photo' as const,
            url: mediaItem.media_url_https,
            thumbnail_url: mediaItem.media_url_https
          });
        }
      }
      
      return media;
    } catch (error) {
      console.error('Error extracting media content:', error);
      return [];
    }
  }
}