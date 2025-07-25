#!/usr/bin/env python3
"""
YouTube Direct Fetcher
Fetches YouTube home feed videos using session cookies via InnerTube API
"""

import json
import re
import requests
from typing import Dict, List, Optional, Any
import time
from datetime import datetime
from urllib.parse import parse_qs, urlparse


class YouTubeAPI:
    def __init__(self, cookie_file: str = "youtube_cookie.txt"):
        """Initialize YouTube API with cookies from file"""
        self.session = requests.Session()
        self.api_key = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"  # Extracted from HAR
        self.base_url = "https://www.youtube.com"
        self.innertube_url = f"{self.base_url}/youtubei/v1"
        
        # Load cookies from file
        self._load_cookies(cookie_file)
        
        # Set required headers
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/json',
            'Origin': 'https://www.youtube.com',
            'Referer': 'https://www.youtube.com/',
            'X-Goog-Visitor-Id': 'CgtLLUdSbHlFQXQwOCiRkI3EBjIKCgJVUxIEGgAgWA%3D%3D',
        })
        
        # Context for InnerTube API requests
        self.context = {
            "client": {
                "hl": "en",
                "gl": "US",
                "remoteHost": "136.24.64.186",
                "deviceMake": "Apple",
                "deviceModel": "",
                "visitorData": "CgtLLUdSbHlFQXQwOCiRkI3EBjIKCgJVUxIEGgAgWA%3D%3D",
                "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36,gzip(gfe)",
                "clientName": "WEB",
                "clientVersion": "2.20250724.00.00",
                "osName": "Macintosh",
                "osVersion": "10_15_7",
                "originalUrl": "https://www.youtube.com/",
                "platform": "DESKTOP",
                "clientFormFactor": "UNKNOWN_FORM_FACTOR",
                "screenDensityFloat": 2,
                "userInterfaceTheme": "USER_INTERFACE_THEME_DARK",
                "timeZone": "America/Los_Angeles",
                "browserName": "Chrome",
                "browserVersion": "137.0.0.0",
                "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "utcOffsetMinutes": -420,
                "memoryTotalKbytes": "8000000",
                "mainAppWebInfo": {
                    "graftUrl": "https://www.youtube.com/",
                    "pwaInstallabilityStatus": "PWA_INSTALLABILITY_STATUS_UNKNOWN",
                    "webDisplayMode": "WEB_DISPLAY_MODE_FULLSCREEN",
                    "isWebNativeShareAvailable": True
                }
            },
            "user": {
                "lockedSafetyMode": False
            },
            "request": {
                "useSsl": True,
                "internalExperimentFlags": [],
                "consistencyTokenJars": []
            }
        }

    def _load_cookies(self, cookie_file: str) -> None:
        """Load cookies from Netscape format file"""
        try:
            with open(cookie_file, 'r') as f:
                cookie_line = f.read().strip()
                
            # Parse cookies (they appear to be in a single line format)
            cookies = {}
            for cookie in cookie_line.split('; '):
                if '=' in cookie:
                    name, value = cookie.split('=', 1)
                    cookies[name] = value
                    
            for name, value in cookies.items():
                self.session.cookies.set(name, value, domain='.youtube.com')
                
            print(f"Loaded {len(cookies)} cookies from {cookie_file}")
                
        except FileNotFoundError:
            print(f"Cookie file {cookie_file} not found")
            raise
        except Exception as e:
            print(f"Error loading cookies: {e}")
            raise

    def check_auth(self) -> Dict[str, Any]:
        """Check if authentication is valid by calling /api/me.json equivalent"""
        try:
            # Use the guide endpoint to check authentication
            response = self.session.post(
                f"{self.innertube_url}/guide",
                params={'prettyPrint': 'false'},
                json={
                    "context": self.context
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'authenticated': True,
                    'status_code': response.status_code,
                    'response_size': len(response.text),
                    'has_sidebar': 'sidebar' in str(data) or 'guide' in str(data)
                }
            else:
                return {
                    'authenticated': False,
                    'status_code': response.status_code,
                    'error': response.text[:200]
                }
                
        except Exception as e:
            return {
                'authenticated': False,
                'error': str(e)
            }

    def get_home_feed(self, continuation_token: Optional[str] = None) -> Dict[str, Any]:
        """Fetch YouTube home feed using browse endpoint"""
        try:
            # Payload for home feed request
            payload = {
                "context": self.context,
                "browseId": "FEwhat_to_watch"  # Home feed browse ID
            }
            
            if continuation_token:
                payload["continuation"] = continuation_token
            
            response = self.session.post(
                f"{self.innertube_url}/browse",
                params={'key': self.api_key, 'prettyPrint': 'false'},
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                videos = self._parse_home_feed(data)
                
                return {
                    'success': True,
                    'videos': videos,
                    'continuation_token': self._extract_continuation_token(data),
                    'total_videos': len(videos)
                }
            else:
                return {
                    'success': False,
                    'status_code': response.status_code,
                    'error': response.text[:500]
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _parse_home_feed(self, data: Dict) -> List[Dict[str, Any]]:
        """Parse YouTube home feed data to extract video information"""
        videos = []
        
        try:
            # Navigate through the YouTube response structure
            contents = data.get('contents', {})
            
            # Look for different possible structures
            sections = []
            
            # Try twoColumnBrowseResultsRenderer structure
            if 'twoColumnBrowseResultsRenderer' in contents:
                primary_contents = contents['twoColumnBrowseResultsRenderer'].get('tabs', [{}])[0]
                tab_renderer = primary_contents.get('tabRenderer', {})
                content = tab_renderer.get('content', {})
                
                if 'richGridRenderer' in content:
                    sections = content['richGridRenderer'].get('contents', [])
                elif 'sectionListRenderer' in content:
                    sections = content['sectionListRenderer'].get('contents', [])
            
            # Try direct contents access
            elif 'richGridRenderer' in contents:
                sections = contents['richGridRenderer'].get('contents', [])
            elif 'sectionListRenderer' in contents:
                sections = contents['sectionListRenderer'].get('contents', [])
            
            # Process each section
            for section in sections:
                videos.extend(self._extract_videos_from_section(section))
                
        except Exception as e:
            print(f"Error parsing home feed: {e}")
            
        return videos

    def _extract_videos_from_section(self, section: Dict) -> List[Dict[str, Any]]:
        """Extract videos from a section of the home feed"""
        videos = []
        
        try:
            # Handle different section types
            if 'richItemRenderer' in section:
                content = section['richItemRenderer'].get('content', {})
                if 'videoRenderer' in content:
                    video = self._parse_video_renderer(content['videoRenderer'])
                    if video:
                        videos.append(video)
                        
            elif 'richSectionRenderer' in section:
                content = section['richSectionRenderer'].get('content', {})
                if 'richShelfRenderer' in content:
                    shelf_contents = content['richShelfRenderer'].get('contents', [])
                    for item in shelf_contents:
                        if 'richItemRenderer' in item:
                            item_content = item['richItemRenderer'].get('content', {})
                            if 'videoRenderer' in item_content:
                                video = self._parse_video_renderer(item_content['videoRenderer'])
                                if video:
                                    videos.append(video)
                                    
            elif 'videoRenderer' in section:
                video = self._parse_video_renderer(section['videoRenderer'])
                if video:
                    videos.append(video)
                    
        except Exception as e:
            print(f"Error extracting videos from section: {e}")
            
        return videos

    def _parse_video_renderer(self, video_data: Dict) -> Optional[Dict[str, Any]]:
        """Parse individual video data from videoRenderer"""
        try:
            video_id = video_data.get('videoId', '')
            if not video_id:
                return None
                
            # Extract title
            title = ''
            title_data = video_data.get('title', {})
            if 'runs' in title_data:
                title = ''.join([run.get('text', '') for run in title_data['runs']])
            elif 'simpleText' in title_data:
                title = title_data['simpleText']
                
            # Extract channel info
            channel_name = ''
            channel_data = video_data.get('longBylineText', {}) or video_data.get('ownerText', {})
            if 'runs' in channel_data and channel_data['runs']:
                channel_name = channel_data['runs'][0].get('text', '')
                
            # Extract view count
            view_count = ''
            view_data = video_data.get('viewCountText', {})
            if 'simpleText' in view_data:
                view_count = view_data['simpleText']
            elif 'runs' in view_data:
                view_count = ''.join([run.get('text', '') for run in view_data['runs']])
                
            # Extract published time
            published_time = ''
            published_data = video_data.get('publishedTimeText', {})
            if 'simpleText' in published_data:
                published_time = published_data['simpleText']
                
            # Extract duration
            duration = ''
            duration_data = video_data.get('lengthText', {})
            if 'simpleText' in duration_data:
                duration = duration_data['simpleText']
                
            # Extract thumbnail
            thumbnail_url = ''
            thumbnails = video_data.get('thumbnail', {}).get('thumbnails', [])
            if thumbnails:
                thumbnail_url = thumbnails[-1].get('url', '')  # Get highest quality
                
            return {
                'video_id': video_id,
                'title': title,
                'channel': channel_name,
                'views': view_count,
                'published': published_time,
                'duration': duration,
                'thumbnail': thumbnail_url,
                'url': f"https://www.youtube.com/watch?v={video_id}",
                'scraped_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error parsing video renderer: {e}")
            return None

    def _extract_continuation_token(self, data: Dict) -> Optional[str]:
        """Extract continuation token for pagination"""
        try:
            # Look for continuation tokens in various places
            def find_continuation(obj):
                if isinstance(obj, dict):
                    if 'continuationCommand' in obj:
                        return obj['continuationCommand'].get('token')
                    for value in obj.values():
                        result = find_continuation(value)
                        if result:
                            return result
                elif isinstance(obj, list):
                    for item in obj:
                        result = find_continuation(item)
                        if result:
                            return result
                return None
                
            return find_continuation(data)
            
        except Exception as e:
            print(f"Error extracting continuation token: {e}")
            return None


def main():
    """Main function to test YouTube API"""
    print("YouTube Direct Fetcher")
    print("=" * 50)
    
    try:
        # Initialize API
        api = YouTubeAPI("youtube_cookie.txt")
        
        # Check authentication
        print("Checking authentication...")
        auth_result = api.check_auth()
        print(f"Authentication result: {auth_result}")
        
        if not auth_result.get('authenticated', False):
            print("Authentication failed. Please check your cookies.")
            return
            
        print("\nAuthentication successful!")
        
        # Fetch home feed
        print("\nFetching home feed...")
        feed_result = api.get_home_feed()
        
        if feed_result.get('success', False):
            videos = feed_result['videos']
            print(f"\nFound {len(videos)} videos:")
            print("-" * 50)
            
            for i, video in enumerate(videos[:10], 1):  # Show first 10 videos
                print(f"{i}. {video['title']}")
                print(f"   Channel: {video['channel']}")
                print(f"   Views: {video['views']}")
                print(f"   Duration: {video['duration']}")
                print(f"   Published: {video['published']}")
                print(f"   URL: {video['url']}")
                print()
                
            # Save results to file
            output_file = f"youtube_videos_{int(time.time())}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(videos, f, indent=2, ensure_ascii=False)
                
            print(f"Saved {len(videos)} videos to {output_file}")
            
        else:
            print(f"Failed to fetch home feed: {feed_result}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()