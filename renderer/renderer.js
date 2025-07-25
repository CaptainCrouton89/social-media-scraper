let isRedditAuthenticated = false;
let isTwitterAuthenticated = false;
let isYouTubeAuthenticated = false;

// Configure marked for safe rendering
if (typeof marked !== 'undefined') {
    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false,
        smartLists: true,
        smartypants: false
    });
}

// DOM elements
const redditStatusIndicator = document.getElementById('redditStatusIndicator');
const redditStatusText = document.getElementById('redditStatusText');
const redditLoginBtn = document.getElementById('redditLoginBtn');

const twitterStatusIndicator = document.getElementById('twitterStatusIndicator');
const twitterStatusText = document.getElementById('twitterStatusText');

const youtubeStatusIndicator = document.getElementById('youtubeStatusIndicator');
const youtubeStatusText = document.getElementById('youtubeStatusText');
const youtubeLoginBtn = document.getElementById('youtubeLoginBtn');

const fetchAllBtn = document.getElementById('fetchAllBtn');
const errorContainer = document.getElementById('errorContainer');
const loadingContainer = document.getElementById('loadingContainer');
const feedContainer = document.getElementById('feedContainer');

// Utility functions
function showError(message) {
    errorContainer.innerHTML = `<div class="error">${message}</div>`;
    setTimeout(() => {
        errorContainer.innerHTML = '';
    }, 5000);
}

function showLoading(message) {
    loadingContainer.innerHTML = `<div class="loading">${message}</div>`;
}

function hideLoading() {
    loadingContainer.innerHTML = '';
}

function updateRedditAuthStatus(authenticated) {
    isRedditAuthenticated = authenticated;
    
    if (authenticated) {
        redditStatusIndicator.classList.add('authenticated');
        redditStatusText.textContent = 'Authenticated';
        redditLoginBtn.textContent = 'Re-login';
    } else {
        redditStatusIndicator.classList.remove('authenticated');
        redditStatusText.textContent = 'Not authenticated';
        redditLoginBtn.textContent = 'Login with Reddit';
    }
    
    // Update combined button availability
    fetchAllBtn.disabled = !isRedditAuthenticated && !isTwitterAuthenticated && !isYouTubeAuthenticated;
}

function updateTwitterAuthStatus(authenticated) {
    isTwitterAuthenticated = authenticated;
    
    if (authenticated) {
        twitterStatusIndicator.classList.add('authenticated');
        twitterStatusText.textContent = 'Cookie valid';
    } else {
        twitterStatusIndicator.classList.remove('authenticated');
        twitterStatusText.textContent = 'Check cookie file';
    }
    
    // Update combined button availability
    fetchAllBtn.disabled = !isRedditAuthenticated && !isTwitterAuthenticated && !isYouTubeAuthenticated;
}

function updateYouTubeAuthStatus(authenticated) {
    isYouTubeAuthenticated = authenticated;
    
    if (authenticated) {
        youtubeStatusIndicator.classList.add('authenticated');
        youtubeStatusText.textContent = 'Authenticated';
        youtubeLoginBtn.textContent = 'Re-login';
    } else {
        youtubeStatusIndicator.classList.remove('authenticated');
        youtubeStatusText.textContent = 'Not authenticated';
        youtubeLoginBtn.textContent = 'Login with YouTube';
    }
    
    // Update combined button availability
    fetchAllBtn.disabled = !isRedditAuthenticated && !isTwitterAuthenticated && !isYouTubeAuthenticated;
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now() / 1000;
    const diffSeconds = now - timestamp;
    
    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
}

function formatNumber(num) {
    if (typeof num === 'string') {
        // Handle string numbers like "1,234,567" or "1.2M views"
        const lowerNum = num.toLowerCase();
        
        // If it already has K, M, B formatting, extract and convert
        if (lowerNum.includes('k') || lowerNum.includes('m') || lowerNum.includes('b')) {
            const match = num.match(/([\d,\.]+)\s*([kmb])/i);
            if (match) {
                let parsedNum = parseFloat(match[1].replace(/,/g, ''));
                const unit = match[2].toLowerCase();
                if (unit === 'k') parsedNum *= 1000;
                else if (unit === 'm') parsedNum *= 1000000;
                else if (unit === 'b') parsedNum *= 1000000000;
                num = parsedNum;
            }
        } else {
            // Handle comma-separated numbers like "25,949,544"
            const match = num.match(/[\d,]+/);
            if (match) {
                const parsedNum = parseInt(match[0].replace(/,/g, ''));
                if (!isNaN(parsedNum)) {
                    num = parsedNum;
                }
            } else {
                return num; // Return original if we can't parse it
            }
        }
    }
    
    if (typeof num !== 'number' || isNaN(num)) {
        return num;
    }
    
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
}

function interleavePosts(redditPosts, twitterPosts, youtubePosts) {
    const combined = [];
    const maxLength = Math.max(redditPosts.length, twitterPosts.length, youtubePosts.length);
    
    for (let i = 0; i < maxLength; i++) {
        if (i < redditPosts.length) {
            combined.push({...redditPosts[i], platform: 'reddit'});
        }
        if (i < twitterPosts.length) {
            combined.push({...twitterPosts[i], platform: 'twitter'});
        }
        if (i < youtubePosts.length) {
            combined.push({...youtubePosts[i], platform: 'youtube'});
        }
    }
    
    return combined;
}

function openPost(url) {
    if (url) {
        window.open(url, '_blank');
    }
}

function renderCombinedFeed(posts) {
    if (!posts || posts.length === 0) {
        feedContainer.innerHTML = `
            <div class="empty-state">
                <h2>No posts found</h2>
                <p>Try fetching from Reddit or Twitter to see your feed.</p>
            </div>
        `;
        return;
    }

    const feedHTML = posts.map(post => {
        const platform = post.platform;
        const postClass = `post ${platform}`;
        
        let url;
        if (platform === 'twitter') {
            url = post.url;
        } else if (platform === 'youtube') {
            url = post.url;
        } else {
            // For Reddit posts, prefer external URL if it exists, otherwise use permalink
            url = post.external_url || `https://reddit.com${post.permalink}`;
        }
        
        if (platform === 'youtube') {
            // YouTube videos
            const timeAgo = formatTimeAgo(post.created_utc);
            
            return `
                <div class="${postClass}" onclick="openPost('${url}')" data-url="${url}">
                    <div class="post-header">
                        <span class="platform-badge youtube">YouTube</span>
                        <span class="author">${post.channel}</span>
                        ${timeAgo ? `<span>•</span><span>${timeAgo}</span>` : ''}
                    </div>
                    <div class="post-title">${post.title}</div>
                    <img src="${post.thumbnail}" alt="YouTube thumbnail" class="post-image" onerror="this.style.display='none'">
                    <div class="post-stats">
                        <span><i data-lucide="eye"></i> ${formatNumber(post.views)}</span>
                        ${post.duration ? `<span><i data-lucide="clock"></i> ${post.duration}</span>` : ''}
                    </div>
                </div>
            `;
        } else if (platform === 'twitter') {
            // Generate media HTML for Twitter posts
            let mediaHTML = '';
            if (post.media && post.media.length > 0) {
                const mediaItems = post.media.map((media, index) => {
                    if (media.type === 'video' || media.type === 'animated_gif') {
                        const videoId = `twitter-video-${post.id}-${index}`;
                        return `<video 
                            id="${videoId}" 
                            src="${media.url}" 
                            class="post-video twitter-video" 
                            autoplay 
                            muted 
                            loop 
                            controls 
                            onerror="this.style.display='none'"
                            onmouseenter="this.muted=false" 
                            onmouseleave="this.muted=true">
                        </video>`;
                    } else if (media.type === 'photo') {
                        return `<img src="${media.url}" alt="Tweet image" class="post-image" onerror="this.style.display='none'">`;
                    }
                    return '';
                }).join('');
                mediaHTML = mediaItems;
            }
            
            return `
                <div class="${postClass}" onclick="openPost('${url}')" data-url="${url}">
                    <div class="post-header">
                        <span class="platform-badge twitter">Twitter</span>
                        <span class="author">@${post.author.screen_name}</span>
                        <span>•</span>
                        <span>${formatNumber(post.author.followers_count)} followers</span>
                    </div>
                    <div class="post-title">${post.text}</div>
                    ${mediaHTML}
                    <div class="post-stats">
                        <span><i data-lucide="heart"></i> ${formatNumber(post.metrics.likes)}</span>
                        <span><i data-lucide="repeat"></i> ${formatNumber(post.metrics.retweets)}</span>
                        <span><i data-lucide="message-circle"></i> ${formatNumber(post.metrics.replies)}</span>
                    </div>
                </div>
            `;
        } else {
            // Reddit posts
            const timeAgo = formatTimeAgo(post.created_utc);
            
            const videoHTML = post.video_url ? 
                `<video src="${post.video_url}" class="post-video" controls autoplay muted loop onerror="this.style.display='none'"></video>` : '';
            
            const imageHTML = post.image_url && !post.video_url ? 
                `<img src="${post.image_url}" alt="Post image" class="post-image" onerror="this.style.display='none'">` : '';
            
            const textHTML = post.text ? 
                `<div class="post-text">${typeof marked !== 'undefined' ? marked.parse(post.text) : post.text.replace(/\n/g, '<br>')}</div>` : '';

            const isRedditGallery = post.external_url && post.external_url.includes('reddit.com/gallery');
            const linkHTML = post.external_url && !post.image_url && !post.video_url && !post.external_url.includes('reddit.com') ? 
                `<div class="post-link">
                    <i data-lucide="external-link"></i>
                    <span class="link-url">${post.external_url}</span>
                </div>` : '';
            
            const galleryHTML = (post.gallery_urls && post.gallery_urls.length > 0) || isRedditGallery ?
                (post.gallery_urls || []).map(url => 
                    `<img src="${url}" alt="Gallery image" class="post-image" onerror="this.style.display='none'">`
                ).join('') : '';

            return `
                <div class="${postClass}" onclick="openPost('${url}')" data-url="${url}">
                    <div class="post-header">
                        <span class="platform-badge reddit">Reddit</span>
                        <span class="subreddit">r/${post.subreddit}</span>
                        ${timeAgo ? `<span>•</span><span>${timeAgo}</span>` : ''}
                    </div>
                    <div class="post-title">${post.title}</div>
                    ${textHTML}
                    ${videoHTML}
                    ${imageHTML}
                    ${galleryHTML}
                    ${linkHTML}
                    <div class="post-stats">
                        <span><i data-lucide="arrow-up"></i> ${formatNumber(post.score)}</span>
                        <span><i data-lucide="message-circle"></i> ${formatNumber(post.num_comments)}</span>
                    </div>
                </div>
            `;
        }
    }).join('');

    feedContainer.innerHTML = `<div class="feed">${feedHTML}</div>`;
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Event handlers
redditLoginBtn.addEventListener('click', async () => {
    redditLoginBtn.disabled = true;
    showLoading('Opening Reddit login...');
    
    try {
        const result = await window.electronAPI.redditLogin();
        
        if (result.success) {
            console.log(`Login successful! Stored ${result.cookies} cookies.`);
            updateRedditAuthStatus(true);
        } else {
            showError(result.error || 'Login failed');
            updateRedditAuthStatus(false);
        }
    } catch (error) {
        showError('Login error: ' + error.message);
        updateRedditAuthStatus(false);
    } finally {
        redditLoginBtn.disabled = false;
        hideLoading();
    }
});

youtubeLoginBtn.addEventListener('click', async () => {
    youtubeLoginBtn.disabled = true;
    showLoading('Opening YouTube login...');
    
    try {
        const result = await window.electronAPI.youtubeLogin();
        
        if (result.success) {
            console.log(`YouTube login successful! Stored ${result.cookies} cookies.`);
            updateYouTubeAuthStatus(true);
        } else {
            showError(result.error || 'YouTube login failed');
            updateYouTubeAuthStatus(false);
        }
    } catch (error) {
        showError('YouTube login error: ' + error.message);
        updateYouTubeAuthStatus(false);
    } finally {
        youtubeLoginBtn.disabled = false;
        hideLoading();
    }
});

fetchAllBtn.addEventListener('click', async () => {
    fetchAllBtn.disabled = true;
    showLoading('Fetching combined feed from Reddit, Twitter, and YouTube...');
    feedContainer.innerHTML = '';
    
    try {
        // Fetch all feeds simultaneously
        const [redditResult, twitterResult, youtubeResult] = await Promise.allSettled([
            window.electronAPI.redditFetchFeed(),
            window.electronAPI.twitterFetchFeed(),
            window.electronAPI.youtubeFetchFeed()
        ]);
        
        let redditPosts = [];
        let twitterPosts = [];
        let youtubePosts = [];
        let errors = [];
        
        // Handle Reddit results
        if (redditResult.status === 'fulfilled' && redditResult.value.success) {
            redditPosts = redditResult.value.data;
            console.log('Reddit feed fetched successfully:', redditPosts.length, 'posts');
        } else {
            const error = redditResult.status === 'rejected' ? redditResult.reason.message : redditResult.value.error;
            errors.push(`Reddit: ${error}`);
            if (error && error.includes('Authentication error')) {
                updateRedditAuthStatus(false);
            }
        }
        
        // Handle Twitter results
        if (twitterResult.status === 'fulfilled' && twitterResult.value.success) {
            twitterPosts = twitterResult.value.data;
            console.log('Twitter feed fetched successfully:', twitterPosts.length, 'tweets');
            updateTwitterAuthStatus(true);
        } else {
            const error = twitterResult.status === 'rejected' ? twitterResult.reason.message : twitterResult.value.error;
            errors.push(`Twitter: ${error}`);
            updateTwitterAuthStatus(false);
        }
        
        // Handle YouTube results
        if (youtubeResult.status === 'fulfilled' && youtubeResult.value.success) {
            youtubePosts = youtubeResult.value.data;
            console.log('YouTube feed fetched successfully:', youtubePosts.length, 'videos');
            updateYouTubeAuthStatus(true);
        } else {
            const error = youtubeResult.status === 'rejected' ? youtubeResult.reason.message : youtubeResult.value.error;
            errors.push(`YouTube: ${error}`);
            if (error && error.includes('Authentication error')) {
                updateYouTubeAuthStatus(false);
            }
        }
        
        // Show errors if any
        if (errors.length > 0) {
            showError(errors.join('; '));
        }
        
        // Interleave and render posts
        const combinedPosts = interleavePosts(redditPosts, twitterPosts, youtubePosts);
        console.log('Combined feed:', combinedPosts.length, 'posts');
        renderCombinedFeed(combinedPosts);
        
    } catch (error) {
        showError('Fetch error: ' + error.message);
    } finally {
        fetchAllBtn.disabled = false;
        hideLoading();
    }
});

// Check authentication status on load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const redditResult = await window.electronAPI.redditCheckAuth();
        updateRedditAuthStatus(redditResult.authenticated);
        
        const twitterResult = await window.electronAPI.twitterCheckAuth();
        updateTwitterAuthStatus(twitterResult.authenticated);
        
        const youtubeResult = await window.electronAPI.youtubeCheckAuth();
        updateYouTubeAuthStatus(youtubeResult.authenticated);
    } catch (error) {
        console.error('Auth check error:', error);
        updateRedditAuthStatus(false);
        updateTwitterAuthStatus(false);
        updateYouTubeAuthStatus(false);
    }
});