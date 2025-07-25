let isRedditAuthenticated = false;
let isTwitterAuthenticated = false;

// DOM elements
const redditStatusIndicator = document.getElementById('redditStatusIndicator');
const redditStatusText = document.getElementById('redditStatusText');
const redditLoginBtn = document.getElementById('redditLoginBtn');

const twitterStatusIndicator = document.getElementById('twitterStatusIndicator');
const twitterStatusText = document.getElementById('twitterStatusText');

const fetchBothBtn = document.getElementById('fetchBothBtn');
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
    fetchBothBtn.disabled = !isRedditAuthenticated && !isTwitterAuthenticated;
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
    fetchBothBtn.disabled = !isRedditAuthenticated && !isTwitterAuthenticated;
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
    if (num >= 1000) {
        return Math.floor(num / 1000) + 'k';
    }
    return num.toString();
}

function interleavePosts(redditPosts, twitterPosts) {
    const combined = [];
    const maxLength = Math.max(redditPosts.length, twitterPosts.length);
    
    for (let i = 0; i < maxLength; i++) {
        if (i < redditPosts.length) {
            combined.push({...redditPosts[i], platform: 'reddit'});
        }
        if (i < twitterPosts.length) {
            combined.push({...twitterPosts[i], platform: 'twitter'});
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
                <p>Try fetching from Reddit or Twitter.</p>
            </div>
        `;
        return;
    }

    const feedHTML = posts.map(post => {
        const isTwitter = post.platform === 'twitter';
        const postClass = isTwitter ? 'post twitter' : 'post';
        const url = isTwitter ? post.url : `https://reddit.com${post.permalink}`;
        
        if (isTwitter) {
            return `
                <div class="${postClass}" onclick="openPost('${url}')" data-url="${url}">
                    <div class="post-header">
                        <span style="background: #1da1f2; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">TWITTER</span>
                        <span class="author" style="color: #1da1f2;">@${post.author.screen_name}</span>
                        <span>•</span>
                        <span>${post.author.name}</span>
                        <span>•</span>
                        <span>${formatNumber(post.author.followers_count)} followers</span>
                    </div>
                    <div class="post-title">${post.text}</div>
                    <div class="post-stats">
                        <span>❤️ ${formatNumber(post.metrics.likes)}</span>
                        <span>🔄 ${formatNumber(post.metrics.retweets)}</span>
                        <span>💬 ${formatNumber(post.metrics.replies)}</span>
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
                `<div class="post-text">${post.text}</div>` : '';

            return `
                <div class="${postClass}" onclick="openPost('${url}')" data-url="${url}">
                    <div class="post-header">
                        <span style="background: #ff4500; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">REDDIT</span>
                        <span class="subreddit">r/${post.subreddit}</span>
                        <span>•</span>
                        <span class="author">u/${post.author}</span>
                        ${timeAgo ? `<span>•</span><span>${timeAgo}</span>` : ''}
                    </div>
                    <div class="post-title">${post.title}</div>
                    ${textHTML}
                    ${videoHTML}
                    ${imageHTML}
                    <div class="post-stats">
                        <span>↑ ${formatNumber(post.score)}</span>
                        <span>💬 ${formatNumber(post.num_comments)}</span>
                    </div>
                </div>
            `;
        }
    }).join('');

    feedContainer.innerHTML = `<div class="feed">${feedHTML}</div>`;
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

fetchBothBtn.addEventListener('click', async () => {
    fetchBothBtn.disabled = true;
    showLoading('Fetching combined feed from Reddit and Twitter...');
    feedContainer.innerHTML = '';
    
    try {
        // Fetch both feeds simultaneously
        const [redditResult, twitterResult] = await Promise.allSettled([
            window.electronAPI.redditFetchFeed(),
            window.electronAPI.twitterFetchFeed()
        ]);
        
        let redditPosts = [];
        let twitterPosts = [];
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
        
        // Show errors if any
        if (errors.length > 0) {
            showError(errors.join('; '));
        }
        
        // Interleave and render posts
        const combinedPosts = interleavePosts(redditPosts, twitterPosts);
        console.log('Combined feed:', combinedPosts.length, 'posts');
        renderCombinedFeed(combinedPosts);
        
    } catch (error) {
        showError('Fetch error: ' + error.message);
    } finally {
        fetchBothBtn.disabled = false;
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
    } catch (error) {
        console.error('Auth check error:', error);
        updateRedditAuthStatus(false);
        updateTwitterAuthStatus(false);
    }
});