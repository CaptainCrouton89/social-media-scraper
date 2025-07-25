#!/usr/bin/env python3
import json
import re
import html
import base64
from urllib.parse import unquote
from bs4 import BeautifulSoup

def extract_posts_from_har():
    """Extract Reddit post data from HAR files."""
    posts = []
    
    # Files to check for post data
    files_to_check = [
        'www.reddit.com_split/entries_document.json',
        'www.reddit.com_split/entries_fetch.json'
    ]
    
    for file_path in files_to_check:
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            print(f"\nAnalyzing {file_path}...")
            
            for entry in data.get('entries', []):
                # Check response content
                response = entry.get('response', {})
                content = response.get('content', {})
                text = content.get('text', '')
                url = entry.get('request', {}).get('url', '')
                
                if text:
                    # Special handling for Reddit feed URLs
                    if 'feeds/home-feed' in url or 'feeds/' in url:
                        posts.extend(extract_posts_from_feed(text, file_path, url))
                    else:
                        # Look for JSON data in response
                        posts.extend(extract_posts_from_text(text, file_path))
        
        except FileNotFoundError:
            print(f"File not found: {file_path}")
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    
    return posts

def extract_posts_from_feed(text, source_file, url):
    """Extract posts from Reddit feed HTML content."""
    posts = []
    
    try:
        # Try to decode base64 if it looks encoded
        if not text.strip().startswith('<'):
            try:
                decoded_text = base64.b64decode(text).decode('utf-8')
                text = decoded_text
            except Exception:
                pass  # Use original text if decode fails
        
        # Parse HTML content
        soup = BeautifulSoup(text, 'html.parser')
        
        # Find shreddit-post elements
        post_elements = soup.find_all('shreddit-post')
        
        for post_elem in post_elements:
            post_data = extract_post_from_element(post_elem, source_file, url)
            if post_data:
                posts.append(post_data)
        
        # Also look for article elements with Reddit post structure
        article_elements = soup.find_all('article')
        for article_elem in article_elements:
            if article_elem.get('aria-label'):  # Reddit posts have aria-label
                post_data = extract_post_from_element(article_elem, source_file, url)
                if post_data:
                    posts.append(post_data)
    
    except Exception as e:
        print(f"Error parsing feed content: {e}")
    
    return posts

def extract_post_from_element(element, source_file, url):
    """Extract post data from a Reddit post HTML element."""
    try:
        post = {
            'source_file': source_file,
            'source_url': url,
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
            'media_url': None
        }
        
        # Extract title from aria-label or h1/h2/h3 elements
        if element.get('aria-label'):
            post['title'] = element.get('aria-label')
        else:
            title_elem = element.find(['h1', 'h2', 'h3'])
            if title_elem:
                post['title'] = title_elem.get_text(strip=True)
        
        # Extract permalink
        permalink_elem = element.find('a', href=True)
        if permalink_elem and 'comments' in permalink_elem.get('href', ''):
            post['permalink'] = permalink_elem['href']
            # Extract post ID from permalink
            permalink_parts = post['permalink'].split('/')
            if len(permalink_parts) > 4:
                post['post_id'] = permalink_parts[4]
        
        # Extract subreddit from permalink or other elements
        if post['permalink']:
            permalink_parts = post['permalink'].split('/')
            if len(permalink_parts) > 2 and permalink_parts[1] == 'r':
                post['subreddit'] = permalink_parts[2]
        
        # Look for author information - try multiple approaches
        author_elem = element.find(attrs={'data-testid': 'post-author'}) or \
                     element.find('a', href=lambda x: x and '/user/' in x) or \
                     element.find('a', href=lambda x: x and '/u/' in x) or \
                     element.find(string=re.compile(r'u/\w+'))
        
        if author_elem:
            if hasattr(author_elem, 'get_text'):
                author_text = author_elem.get_text(strip=True)
            else:
                author_text = str(author_elem)
            
            # Extract username from various formats
            author_match = re.search(r'u/(\w+)', author_text)
            if author_match:
                post['author'] = author_match.group(1)
            else:
                post['author'] = author_text.replace('u/', '').strip()
        
        # If no author found, try searching the entire element text
        if not post['author']:
            element_text = element.get_text()
            author_match = re.search(r'u/(\w+)', element_text)
            if author_match:
                post['author'] = author_match.group(1)
        
        # Look for vote score - try multiple approaches
        score_elem = element.find(attrs={'data-testid': 'vote-score'}) or \
                    element.find('span', class_=lambda x: x and 'score' in x.lower() if x else False) or \
                    element.find(string=re.compile(r'\d+\s*(?:points?|votes?)'))
        
        if score_elem:
            if hasattr(score_elem, 'get_text'):
                score_text = score_elem.get_text(strip=True)
            else:
                score_text = str(score_elem)
            
            # Extract numeric score
            score_match = re.search(r'(\d+(?:\.\d+)?)\s*k?', score_text.lower())
            if score_match:
                score_val = float(score_match.group(1))
                if 'k' in score_text.lower():
                    score_val *= 1000
                post['score'] = int(score_val)
        
        # Look for comment count - try multiple approaches
        comments_elem = element.find(string=re.compile(r'\d+\s+comment')) or \
                       element.find(attrs={'data-testid': 'comment-count'}) or \
                       element.find('a', string=re.compile(r'\d+\s+comment'))
        
        if comments_elem:
            if hasattr(comments_elem, 'get_text'):
                comments_text = comments_elem.get_text(strip=True)
            else:
                comments_text = str(comments_elem)
            
            # Extract numeric comment count
            comments_match = re.search(r'(\d+)', comments_text)
            if comments_match:
                post['num_comments'] = int(comments_match.group(1))
        
        # Look for images
        img_elem = element.find('img')
        if img_elem and img_elem.get('src'):
            src = img_elem['src']
            if 'redd.it' in src or 'reddit' in src:
                post['image_url'] = src
        
        # Look for videos
        video_elem = element.find('video')
        if video_elem and video_elem.get('src'):
            post['video_url'] = video_elem['src']
        
        # Extract post text content
        text_elem = element.find(attrs={'data-testid': 'post-content'}) or \
                   element.find('div', class_=lambda x: x and 'text' in x.lower() if x else False)
        if text_elem:
            post['text'] = text_elem.get_text(strip=True)
        
        # Only return if we have meaningful data
        if post['title'] or post['permalink']:
            return post
    
    except Exception as e:
        print(f"Error extracting post from element: {e}")
    
    return None

def extract_posts_from_text(text, source_file):
    """Extract post data from response text."""
    posts = []
    
    try:
        # Try to parse as JSON directly
        if text.strip().startswith('{'):
            json_data = json.loads(text)
            posts.extend(find_posts_in_json(json_data, source_file))
    except json.JSONDecodeError:
        pass
    
    # Look for script tags with data
    script_patterns = [
        r'<script[^>]*>(.*?)</script>',
        r'<script[^>]*type="module"[^>]*>(.*?)</script>',
    ]
    
    for pattern in script_patterns:
        script_matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
        for script_content in script_matches:
            # Look for window assignments
            window_patterns = [
                r'window\.__r\s*=\s*({.*?});',
                r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
                r'window\.__PRELOADED_STATE__\s*=\s*({.*?});',
                r'window\.CLIENT_EXPERIMENTS\s*=\s*({.*?});',
                r'window\.[A-Z_]+\s*=\s*({.*?});',
            ]
            
            for window_pattern in window_patterns:
                matches = re.findall(window_pattern, script_content, re.DOTALL)
                for match in matches:
                    try:
                        json_data = json.loads(match)
                        posts.extend(find_posts_in_json(json_data, source_file))
                    except json.JSONDecodeError:
                        continue
    
    # Look for any JSON-like structures in the text
    json_patterns = [
        r'"data"\s*:\s*({.*?})',
        r'({.*?"kind"\s*:\s*"t3".*?})',
        r'({.*?"title"\s*:\s*"[^"]*".*?"author".*?})',
        r'({.*?"posts".*?})',
        r'({.*?"children".*?})',
    ]
    
    for pattern in json_patterns:
        matches = re.findall(pattern, text, re.DOTALL)
        for match in matches:
            try:
                json_data = json.loads(match)
                posts.extend(find_posts_in_json(json_data, source_file))
            except json.JSONDecodeError:
                continue
    
    return posts

def find_posts_in_json(data, source_file, path=""):
    """Recursively find post-like structures in JSON data."""
    posts = []
    
    if isinstance(data, dict):
        # Check if this looks like a Reddit post
        if is_reddit_post(data):
            post = extract_post_data(data, source_file, path)
            if post:
                posts.append(post)
        
        # Recursively search in nested objects
        for key, value in data.items():
            if key in ['data', 'children', 'posts', 'items', 'listing']:
                posts.extend(find_posts_in_json(value, source_file, f"{path}.{key}"))
            elif isinstance(value, (dict, list)):
                posts.extend(find_posts_in_json(value, source_file, f"{path}.{key}"))
    
    elif isinstance(data, list):
        for i, item in enumerate(data):
            posts.extend(find_posts_in_json(item, source_file, f"{path}[{i}]"))
    
    return posts

def is_reddit_post(data):
    """Check if a data structure looks like a Reddit post."""
    if not isinstance(data, dict):
        return False
    
    # Common Reddit post indicators
    post_indicators = [
        'title', 'selftext', 'author', 'subreddit', 'score',
        'num_comments', 'permalink', 'url', 'created_utc'
    ]
    
    # Check for multiple indicators
    indicator_count = sum(1 for indicator in post_indicators if indicator in data)
    return indicator_count >= 3

def extract_post_data(data, source_file, path):
    """Extract clean post data from a Reddit post structure."""
    try:
        post = {
            'source_file': source_file,
            'json_path': path,
            'title': data.get('title', ''),
            'text': data.get('selftext', '') or data.get('body', ''),
            'author': data.get('author', ''),
            'subreddit': data.get('subreddit', ''),
            'score': data.get('score', 0),
            'num_comments': data.get('num_comments', 0),
            'url': data.get('url', ''),
            'permalink': data.get('permalink', ''),
            'created_utc': data.get('created_utc', 0),
            'post_id': data.get('id', ''),
            'media_url': None,
            'image_url': None,
            'video_url': None
        }
        
        # Extract media URLs
        if 'preview' in data and 'images' in data['preview']:
            images = data['preview']['images']
            if images and 'source' in images[0]:
                post['image_url'] = html.unescape(images[0]['source']['url'])
        
        if 'media' in data and data['media']:
            media = data['media']
            if 'reddit_video' in media:
                post['video_url'] = media['reddit_video'].get('fallback_url')
            elif 'oembed' in media:
                post['media_url'] = media['oembed'].get('thumbnail_url')
        
        # Clean up HTML entities
        post['title'] = html.unescape(post['title'])
        post['text'] = html.unescape(post['text'])
        
        # Only return if we have meaningful data
        if post['title'] or post['text']:
            return post
    
    except Exception as e:
        print(f"Error extracting post data: {e}")
    
    return None

def main():
    """Main function to extract and display Reddit posts."""
    print("Extracting Reddit post data from HAR files...")
    
    posts = extract_posts_from_har()
    
    print(f"\nFound {len(posts)} posts:")
    print("=" * 80)
    
    for i, post in enumerate(posts, 1):
        print(f"\nPost {i}:")
        print(f"Title: {post['title'][:100]}{'...' if len(post['title']) > 100 else ''}")
        print(f"Author: u/{post['author']}")
        print(f"Subreddit: r/{post['subreddit']}")
        print(f"Score: {post['score']}")
        print(f"Comments: {post['num_comments']}")
        
        if post['text']:
            print(f"Text: {post['text'][:200]}{'...' if len(post['text']) > 200 else ''}")
        
        if post['image_url']:
            print(f"Image: {post['image_url']}")
        
        if post['video_url']:
            print(f"Video: {post['video_url']}")
        
        if post['media_url']:
            print(f"Media: {post['media_url']}")
        
        print(f"Source: {post['source_file']}")
        print("-" * 40)
    
    # Save to JSON file
    if posts:
        with open('extracted_reddit_posts.json', 'w') as f:
            json.dump(posts, f, indent=2)
        print(f"\nSaved {len(posts)} posts to extracted_reddit_posts.json")
    else:
        print("\nNo posts found. Let me analyze the data structure...")
        analyze_data_structure()

def analyze_data_structure():
    """Analyze the structure of the HAR files to understand the data format."""
    files_to_check = [
        'www.reddit.com_split/entries_document.json',
        'www.reddit.com_split/entries_fetch.json'
    ]
    
    for file_path in files_to_check:
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            print(f"\nAnalyzing structure of {file_path}:")
            
            for i, entry in enumerate(data.get('entries', [])[:3]):  # Check first 3 entries
                response = entry.get('response', {})
                content = response.get('content', {})
                text = content.get('text', '')
                
                print(f"\nEntry {i+1}:")
                print(f"URL: {entry.get('request', {}).get('url', 'N/A')}")
                print(f"Content type: {content.get('mimeType', 'N/A')}")
                print(f"Content size: {len(text)} chars")
                
                if text:
                    # Show first few lines
                    lines = text.split('\n')[:5]
                    for j, line in enumerate(lines):
                        print(f"Line {j+1}: {line[:100]}{'...' if len(line) > 100 else ''}")
                
                print("-" * 40)
        
        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")

if __name__ == "__main__":
    main()