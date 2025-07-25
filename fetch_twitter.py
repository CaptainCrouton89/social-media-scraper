#!/usr/bin/env python3
"""
Twitter feed scraper using GraphQL API with cookie authentication.
"""

import json
import requests
from typing import Dict, List, Optional
import sys

class TwitterAPI:
    def __init__(self, cookie_file: str = "twitter_cookie.txt"):
        """Initialize Twitter API client with cookie authentication."""
        self.session = requests.Session()
        self.cookie_file = cookie_file
        self._load_cookies()
        self._setup_headers()
    
    def _load_cookies(self):
        """Load cookies from file and set up session."""
        try:
            with open(self.cookie_file, 'r') as f:
                cookie_string = f.read().strip()
            
            # Parse cookie string into dict
            cookies = {}
            for cookie in cookie_string.split('; '):
                if '=' in cookie:
                    name, value = cookie.split('=', 1)
                    cookies[name] = value
            
            self.session.cookies.update(cookies)
            
            # Extract CSRF token from ct0 cookie for x-csrf-token header
            self.csrf_token = cookies.get('ct0', '')
            
        except FileNotFoundError:
            print(f"Error: Cookie file '{self.cookie_file}' not found")
            sys.exit(1)
        except Exception as e:
            print(f"Error loading cookies: {e}")
            sys.exit(1)
    
    def _setup_headers(self):
        """Set up common headers for Twitter API requests."""
        self.session.headers.update({
            'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
            'x-csrf-token': self.csrf_token,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'x-twitter-active-user': 'yes',
            'x-twitter-auth-type': 'OAuth2Session',
            'x-twitter-client-language': 'en'
        })
    
    def get_home_timeline(self, count: int = 20) -> Dict:
        """Fetch home timeline using GraphQL API."""
        url = "https://x.com/i/api/graphql/_qrmuYLQl79WB9oFxfs1Sw/HomeTimeline"
        
        payload = {
            "variables": {
                "count": count,
                "includePromotedContent": True,
                "latestControlAvailable": True,
                "requestContext": "launch"
            },
            "features": {
                "responsive_web_graphql_exclude_directive_enabled": True,
                "verified_phone_label_enabled": False,
                "creator_subscriptions_tweet_preview_api_enabled": True,
                "responsive_web_graphql_timeline_navigation_enabled": True,
                "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
                "communities_web_enable_tweet_community_results_fetch": True,
                "c9s_tweet_anatomy_moderator_badge_enabled": True,
                "articles_preview_enabled": True,
                "responsive_web_edit_tweet_api_enabled": True,
                "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
                "view_counts_everywhere_api_enabled": True,
                "longform_notetweets_consumption_enabled": True,
                "responsive_web_twitter_article_tweet_consumption_enabled": True,
                "tweet_awards_web_tipping_enabled": False,
                "creator_subscriptions_quote_tweet_preview_enabled": False,
                "freedom_of_speech_not_reach_fetch_enabled": True,
                "standardized_nudges_misinfo": True,
                "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
                "rweb_video_timestamps_enabled": True,
                "longform_notetweets_rich_text_read_enabled": True,
                "longform_notetweets_inline_media_enabled": True,
                "responsive_web_enhance_cards_enabled": False,
                "rweb_tipjar_consumption_enabled": True,
                "responsive_web_grok_analyze_post_followups_enabled": True,
                "responsive_web_grok_analysis_button_from_backend": True,
                "responsive_web_grok_share_attachment_enabled": True,
                "responsive_web_grok_community_note_auto_translation_is_enabled": True,
                "responsive_web_grok_analyze_button_fetch_trends_enabled": True,
                "responsive_web_jetfuel_frame": True,
                "responsive_web_grok_image_annotation_enabled": True,
                "profile_label_improvements_pcf_label_in_post_enabled": True,
                "payments_enabled": True,
                "premium_content_api_read_enabled": True,
                "rweb_video_screen_enabled": True,
                "responsive_web_grok_show_grok_translated_post": True
            }
        }
        
        try:
            response = self.session.post(url, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching timeline: {e}")
            return {}
    
    def parse_tweets(self, timeline_data: Dict) -> List[Dict]:
        """Parse tweet data from timeline response."""
        tweets = []
        
        try:
            instructions = timeline_data.get('data', {}).get('home', {}).get('home_timeline_urt', {}).get('instructions', [])
            
            for instruction in instructions:
                if instruction.get('type') == 'TimelineAddEntries':
                    entries = instruction.get('entries', [])
                    
                    for entry in entries:
                        content = entry.get('content', {})
                        if content.get('entryType') == 'TimelineTimelineItem':
                            item_content = content.get('itemContent', {})
                            if item_content.get('itemType') == 'TimelineTweet':
                                tweet_result = item_content.get('tweet_results', {}).get('result', {})
                                
                                if tweet_result.get('__typename') == 'Tweet':
                                    tweet_info = self._extract_tweet_info(tweet_result)
                                    if tweet_info:
                                        tweets.append(tweet_info)
        
        except Exception as e:
            print(f"Error parsing tweets: {e}")
        
        return tweets
    
    def _extract_tweet_info(self, tweet_data: Dict) -> Optional[Dict]:
        """Extract relevant information from tweet data."""
        try:
            # Basic tweet info
            tweet_id = tweet_data.get('rest_id')
            legacy = tweet_data.get('legacy', {})
            
            # User info
            user_result = tweet_data.get('core', {}).get('user_results', {}).get('result', {})
            user_legacy = user_result.get('legacy', {})
            user_core = user_result.get('core', {})
            
            # Extract text content
            full_text = legacy.get('full_text', '')
            
            # Extract metrics
            favorite_count = legacy.get('favorite_count', 0)
            retweet_count = legacy.get('retweet_count', 0)
            reply_count = legacy.get('reply_count', 0)
            
            return {
                'id': tweet_id,
                'text': full_text,
                'author': {
                    'name': user_core.get('name', ''),
                    'screen_name': user_core.get('screen_name', ''),
                    'followers_count': user_legacy.get('followers_count', 0)
                },
                'metrics': {
                    'likes': favorite_count,
                    'retweets': retweet_count,
                    'replies': reply_count
                },
                'created_at': legacy.get('created_at', ''),
                'url': f"https://x.com/{user_core.get('screen_name', '')}/status/{tweet_id}" if tweet_id else ''
            }
        
        except Exception as e:
            print(f"Error extracting tweet info: {e}")
            return None

def main():
    """Main function to fetch and display Twitter timeline."""
    try:
        # Initialize Twitter API
        twitter = TwitterAPI()
        
        # Fetch timeline
        print("Fetching Twitter timeline...")
        timeline_data = twitter.get_home_timeline(count=10)
        
        if not timeline_data:
            print("Failed to fetch timeline data")
            return
        
        # Parse tweets
        tweets = twitter.parse_tweets(timeline_data)
        
        if not tweets:
            print("No tweets found or failed to parse")
            return
        
        # Display tweets
        print(f"\nFound {len(tweets)} tweets:\n")
        
        for i, tweet in enumerate(tweets, 1):
            print(f"--- Tweet {i} ---")
            print(f"Author: {tweet['author']['name']} (@{tweet['author']['screen_name']})")
            print(f"Text: {tweet['text'][:200]}{'...' if len(tweet['text']) > 200 else ''}")
            print(f"Likes: {tweet['metrics']['likes']} | Retweets: {tweet['metrics']['retweets']} | Replies: {tweet['metrics']['replies']}")
            print(f"URL: {tweet['url']}")
            print()
    
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()