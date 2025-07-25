#!/usr/bin/env python3
import requests
import json
import base64
import time
import os
import sys
from bs4 import BeautifulSoup
import re

def load_cookies():
    """Load cookies from cookie.txt file."""
    with open('cookie.txt', 'r') as f:
        cookie_string = f.read().strip()
    
    # Parse cookies into a dictionary
    cookies = {}
    for cookie in cookie_string.split('; '):
        if '=' in cookie:
            key, value = cookie.split('=', 1)
            cookies[key] = value
    
    return cookies

def check_cookie_validity(cookies):
    """Check if cookies are still valid by making a test request."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
    }
    
    try:
        # Test with a simple Reddit API call
        response = requests.get('https://www.reddit.com/api/me.json', 
                              headers=headers, cookies=cookies, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            # If we get user data back, cookies are valid
            return 'name' in data or 'data' in data
        
        return False
    except Exception as e:
        print(f"Cookie validation error: {e}")
        return False

def refresh_cookies(cookies):
    """Attempt to refresh Reddit session cookies."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    try:
        # Visit Reddit homepage to refresh session
        session = requests.Session()
        session.headers.update(headers)
        
        # Load existing cookies into session
        for key, value in cookies.items():
            session.cookies.set(key, value, domain='.reddit.com')
        
        # Make request to refresh session
        response = session.get('https://www.reddit.com/', timeout=10)
        
        if response.status_code == 200:
            # Extract updated cookies
            updated_cookies = {}
            for cookie in session.cookies:
                if cookie.domain in ['.reddit.com', 'reddit.com', 'www.reddit.com']:
                    updated_cookies[cookie.name] = cookie.value
            
            # Merge with original cookies (keep ones that weren't updated)
            for key, value in cookies.items():
                if key not in updated_cookies:
                    updated_cookies[key] = value
            
            print(f"Refreshed {len(updated_cookies)} cookies")
            return updated_cookies
        
        print(f"Cookie refresh failed with status {response.status_code}")
        return cookies
        
    except Exception as e:
        print(f"Cookie refresh error: {e}")
        return cookies

def save_cookies(cookies, filename='cookie.txt'):
    """Save cookies back to file."""
    try:
        # Create backup
        if os.path.exists(filename):
            backup_name = f"{filename}.backup.{int(time.time())}"
            os.rename(filename, backup_name)
            print(f"Created cookie backup: {backup_name}")
        
        # Save updated cookies
        cookie_string = '; '.join([f"{key}={value}" for key, value in cookies.items()])
        with open(filename, 'w') as f:
            f.write(cookie_string)
        
        print(f"Saved updated cookies to {filename}")
        return True
        
    except Exception as e:
        print(f"Error saving cookies: {e}")
        return False

def get_fresh_cookies():
    """Load cookies and refresh them if needed."""
    print("Loading cookies...")
    cookies = load_cookies()
    print(f"Loaded {len(cookies)} cookies")
    
    print("Checking cookie validity...")
    if check_cookie_validity(cookies):
        print("Cookies are valid!")
        return cookies
    
    print("Cookies appear invalid or expired, attempting refresh...")
    refreshed_cookies = refresh_cookies(cookies)
    
    print("Validating refreshed cookies...")
    if check_cookie_validity(refreshed_cookies):
        print("Cookie refresh successful!")
        save_cookies(refreshed_cookies)
        return refreshed_cookies
    else:
        print("Cookie refresh failed. Using original cookies anyway...")
        return cookies

def fetch_reddit_feed(cookies, after=None):
    """Fetch Reddit home feed using cookies."""
    
    # Reddit headers to mimic the actual HAR request
    headers = {
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
    }
    
    # Use the working Reddit JSON API
    endpoints = [
        {
            'url': 'https://www.reddit.com/.json',
            'params': {'limit': 25}
        }
    ]
    
    if after:
        for endpoint in endpoints:
            endpoint['params']['after'] = after
    
    for endpoint in endpoints:
        url = endpoint['url']
        params = endpoint['params']
        
        print(f"Trying: {url}")
        print(f"Params: {params}")
        
        try:
            response = requests.get(url, headers=headers, cookies=cookies, params=params)
            print(f"Response status: {response.status_code}")
            print(f"Response length: {len(response.text)} chars")
            print(f"Content-Type: {response.headers.get('content-type', 'N/A')}")
            
            if response.status_code == 200:
                # Check if it's JSON
                content_type = response.headers.get('content-type', '')
                if 'json' in content_type.lower():
                    print("Got JSON response!")
                    return response.json()
                else:
                    print("Got HTML response")
                    return response.text
            elif response.status_code == 401 or response.status_code == 403:
                print(f"Authentication error ({response.status_code}). Cookies may be expired.")
                return 'AUTH_ERROR'
            else:
                print(f"Error: {response.status_code}")
                print(f"Response: {response.text[:500]}")
                
        except Exception as e:
            print(f"Request failed: {e}")
    
    return None

def extract_posts_from_html(html_content):
    """Extract posts from HTML content."""
    posts = []
    
    try:
        # Try to decode base64 if needed
        if not html_content.strip().startswith('<'):
            try:
                decoded_html = base64.b64decode(html_content).decode('utf-8')
                html_content = decoded_html
            except Exception:
                pass
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find all shreddit-post elements
        post_elements = soup.find_all('shreddit-post')
        print(f"Found {len(post_elements)} shreddit-post elements")
        
        # Also check for article elements
        article_elements = soup.find_all('article')
        print(f"Found {len(article_elements)} article elements")
        
        # Process all elements
        for element in post_elements + article_elements:
            if element.get('aria-label') or element.name == 'shreddit-post':
                post = extract_post_data(element)
                if post:
                    posts.append(post)
    
    except Exception as e:
        print(f"Error parsing HTML: {e}")
    
    return posts

def extract_post_data(element):
    """Extract data from a post element."""
    try:
        post = {
            'title': '',
            'text': '',
            'author': '',
            'subreddit': '',
            'score': 0,
            'num_comments': 0,
            'permalink': '',
            'post_id': '',
            'image_url': None,
            'video_url': None,
            'external_url': None,
            'created_utc': None
        }
        
        # Extract title from aria-label
        if element.get('aria-label'):
            post['title'] = element.get('aria-label')
        
        # Extract permalink from data attribute or links
        if element.get('permalink'):
            post['permalink'] = element['permalink']
        else:
            # Look for comment links
            comment_link = element.find('a', href=lambda x: x and '/comments/' in x)
            if comment_link:
                post['permalink'] = comment_link['href']
        
        # Extract post ID and subreddit from permalink
        if post['permalink']:
            parts = post['permalink'].split('/')
            if len(parts) > 4:
                post['subreddit'] = parts[2] if parts[1] == 'r' else ''
                post['post_id'] = parts[4] if len(parts) > 4 else ''
        
        # Look for author in the HTML
        element_text = element.get_text()
        author_match = re.search(r'u/(\w+)', element_text)
        if author_match:
            post['author'] = author_match.group(1)
        
        # Look for post content
        content_elem = element.find(attrs={'data-testid': 'post-content'})
        if content_elem:
            post['text'] = content_elem.get_text(strip=True)
        
        # Look for images
        img_elem = element.find('img')
        if img_elem and img_elem.get('src'):
            src = img_elem['src']
            # Skip community icons, get actual post images
            if 'preview.redd.it' in src or ('redd.it' in src and 'communityIcon' not in src):
                post['image_url'] = src
        
        # Look for videos
        video_elem = element.find('video')
        if video_elem and video_elem.get('src'):
            post['video_url'] = video_elem['src']
        
        # Extract any external URLs from the text
        url_match = re.search(r'https?://[^\s]+', element_text)
        if url_match:
            post['external_url'] = url_match.group(0)
        
        # Only return if we have meaningful data
        if post['title'] or post['permalink'] or post['text']:
            return post
    
    except Exception as e:
        print(f"Error extracting post: {e}")
    
    return None

def extract_posts_from_json(json_data):
    """Extract posts from Reddit JSON API response."""
    posts = []
    
    try:
        # Handle Reddit's JSON structure
        if isinstance(json_data, dict):
            # Check if it's a listing
            if json_data.get('kind') == 'Listing':
                children = json_data.get('data', {}).get('children', [])
                for child in children:
                    if child.get('kind') == 't3':  # t3 is a link/post
                        post_data = child.get('data', {})
                        post = {
                            'title': post_data.get('title', ''),
                            'text': post_data.get('selftext', ''),
                            'author': post_data.get('author', ''),
                            'subreddit': post_data.get('subreddit', ''),
                            'score': post_data.get('score', 0),
                            'num_comments': post_data.get('num_comments', 0),
                            'permalink': post_data.get('permalink', ''),
                            'post_id': post_data.get('id', ''),
                            'url': post_data.get('url', ''),
                            'image_url': None,
                            'video_url': None,
                            'created_utc': post_data.get('created_utc', 0)
                        }
                        
                        # Extract image URL from preview
                        preview = post_data.get('preview', {})
                        if 'images' in preview and preview['images']:
                            image = preview['images'][0]
                            if 'source' in image:
                                post['image_url'] = image['source'].get('url', '').replace('&amp;', '&')
                        
                        # Extract video URL
                        media = post_data.get('media', {})
                        if media and 'reddit_video' in media:
                            post['video_url'] = media['reddit_video'].get('fallback_url')
                        
                        posts.append(post)
        
        print(f"Extracted {len(posts)} posts from JSON")
        return posts
        
    except Exception as e:
        print(f"Error extracting from JSON: {e}")
        return []

def main():
    """Main function to fetch Reddit posts directly."""
    # Check for force refresh flag
    force_refresh = '--refresh-cookies' in sys.argv or '-r' in sys.argv
    
    if force_refresh:
        print("Force refreshing cookies...")
        cookies = load_cookies()
        cookies = refresh_cookies(cookies)
        save_cookies(cookies)
    else:
        # Load and refresh cookies if needed
        cookies = get_fresh_cookies()
    
    print("\nFetching Reddit home feed...")
    content = fetch_reddit_feed(cookies)
    
    # If we get an auth error, try refreshing cookies once more
    if content == 'AUTH_ERROR':
        print("Authentication failed. Forcing cookie refresh...")
        cookies = refresh_cookies(cookies)
        save_cookies(cookies)
        print("Retrying with refreshed cookies...")
        content = fetch_reddit_feed(cookies)
    
    if content and content != 'AUTH_ERROR':
        posts = []
        
        # Handle JSON response
        if isinstance(content, dict):
            print("Processing JSON response...")
            posts = extract_posts_from_json(content)
        else:
            print(f"\nGot HTML response, first 200 chars:")
            print(repr(content[:200]))
            
            print("\nExtracting posts from HTML...")
            posts = extract_posts_from_html(content)
        
        print(f"\nFound {len(posts)} posts:")
        print("=" * 80)
        
        for i, post in enumerate(posts, 1):
            print(f"\nPost {i}:")
            print(f"Title: {post['title'][:100]}{'...' if len(post['title']) > 100 else ''}")
            print(f"Subreddit: r/{post['subreddit']}")
            print(f"Author: u/{post['author']}")
            print(f"Score: {post['score']}")
            print(f"Comments: {post['num_comments']}")
            
            if post['text']:
                print(f"Text: {post['text'][:200]}{'...' if len(post['text']) > 200 else ''}")
            
            if post.get('url') and post['url'] != post.get('permalink', ''):
                print(f"URL: {post['url']}")
            
            if post['image_url']:
                print(f"Image: {post['image_url']}")
            
            if post['video_url']:
                print(f"Video: {post['video_url']}")
            
            print("-" * 40)
        
        # Save to JSON
        if posts:
            with open('reddit_posts_direct.json', 'w') as f:
                json.dump(posts, f, indent=2)
            print(f"\nSaved {len(posts)} posts to reddit_posts_direct.json")
        else:
            print("\nNo posts extracted. Let me show you the raw content structure...")
            if isinstance(content, dict):
                print("JSON keys:", list(content.keys()))
                print("JSON structure:", json.dumps(content, indent=2)[:1000])
            else:
                print(f"Content type: {type(content)}")
                print(f"Starts with: {content[:500]}")
                
                # Try to save raw content for debugging
                with open('reddit_raw_response.html', 'w') as f:
                    f.write(content)
                print("Saved raw response to reddit_raw_response.html for debugging")
    
    else:
        print("Failed to fetch content")

if __name__ == "__main__":
    if '--help' in sys.argv or '-h' in sys.argv:
        print("Reddit Post Fetcher")
        print("Usage: python3 fetch_reddit_direct.py [options]")
        print("\nOptions:")
        print("  -r, --refresh-cookies    Force refresh cookies before fetching")
        print("  -h, --help              Show this help message")
        print("\nThe script will automatically check and refresh cookies if they appear invalid.")
        sys.exit(0)
    
    main()