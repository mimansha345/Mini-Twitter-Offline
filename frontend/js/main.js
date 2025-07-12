/**
 * Mini Twitter Offline - Main JavaScript
 * Implements a Heap + HashMap-based news feed algorithm
 */

// MinHeap implementation for sorting tweets by timestamp (most recent first)
class TweetHeap {
  constructor() {
    this.heap = [];
  }

  // Helper methods for heap operations
  getParentIndex(i) { return Math.floor((i - 1) / 2); }
  getLeftChildIndex(i) { return 2 * i + 1; }
  getRightChildIndex(i) { return 2 * i + 2; }
  
  hasParent(i) { return this.getParentIndex(i) >= 0; }
  hasLeftChild(i) { return this.getLeftChildIndex(i) < this.heap.length; }
  hasRightChild(i) { return this.getRightChildIndex(i) < this.heap.length; }
  
  parent(i) { return this.heap[this.getParentIndex(i)]; }
  leftChild(i) { return this.heap[this.getLeftChildIndex(i)]; }
  rightChild(i) { return this.heap[this.getRightChildIndex(i)]; }
  
  // Swap elements in the heap
  swap(i, j) {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }

  // Add a tweet to the heap
  insert(tweet) {
    this.heap.push(tweet);
    this.heapifyUp();
    return this;
  }

  // Remove and return the most recent tweet
  extractMax() {
    if (this.heap.length === 0) return null;
    
    const max = this.heap[0];
    const last = this.heap.pop();
    
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.heapifyDown();
    }
    
    return max;
  }

  // Maintain heap property after insertion
  heapifyUp() {
    let index = this.heap.length - 1;
    
    while (
      this.hasParent(index) && 
      this.parent(index).score < this.heap[index].score
    ) {
      const parentIndex = this.getParentIndex(index);
      this.swap(parentIndex, index);
      index = parentIndex;
    }
  }

  // Maintain heap property after extraction
  heapifyDown() {
    let index = 0;
    
    while (this.hasLeftChild(index)) {
      let largerChildIndex = this.getLeftChildIndex(index);
      
      if (
        this.hasRightChild(index) && 
        this.rightChild(index).score > this.leftChild(index).score
      ) {
        largerChildIndex = this.getRightChildIndex(index);
      }
      
      if (this.heap[index].score >= this.heap[largerChildIndex].score) {
        break;
      } else {
        this.swap(index, largerChildIndex);
      }
      
      index = largerChildIndex;
    }
  }


}

// HashMap for fast user lookup
class UserHashMap {
  constructor() {
    this.map = {};
  }

  // Add a user to the map
  set(userId, userInfo) {
    this.map[userId] = userInfo;
  }

  // Get a user from the map
  get(userId) {
    return this.map[userId] || { username: "Unknown", name: "Unknown" };
  }

  // Check if user exists in the map
  has(userId) {
    return this.map.hasOwnProperty(userId);
  }

  // Get all users
  getAll() {
    return Object.values(this.map);
  }
}

// NewsFeed class that combines the Heap and HashMap
class NewsFeed {
  constructor() {
    this.tweetHeap = new TweetHeap();
    this.userMap = new UserHashMap();
    this.currentUserId = localStorage.getItem('userId');
  }

  // Load all users
  async loadUsers() {
    try {
      const response = await fetch('/users');
      const users = await response.json();
      
      users.forEach(user => {
        this.userMap.set(user.id, user);
      });
      
      return users;
    } catch (error) {
      console.error('Error loading users:', error);
      return [];
    }
  }

  // Load feed data with pagination
  async loadFeed(page = 1, append = false) {
    try {
      const userId = this.currentUserId;
      const limit = 15; // Default to 15 posts per page
      const response = await fetch(`/feed?userId=${userId}&page=${page}&limit=${limit}`);
      const data = await response.json();
      const feed = data.posts;
      this.pagination = data.pagination;
      
      if (!append) {
        // Clear existing heap if not appending
        this.tweetHeap = new TweetHeap();
        // Reset current posts
        window.currentPosts = [];
      }
      
      // Add all tweets to the heap - they already have scores from the backend
      feed.forEach(post => {
        // Add user to the map if not already there
        if (!this.userMap.has(post.userId)) {
          this.userMap.set(post.userId, post.user);
        }
        
        // Add tweet to heap
        this.tweetHeap.insert(post);
      });
      
      // Store current posts in a global variable for the image modal
      const currentPosts = append ? [...window.currentPosts, ...feed] : feed;
      window.currentPosts = currentPosts;
      
      return feed;
    } catch (error) {
      console.error('Error loading feed:', error);
      return [];
    }
  }

  // Render the user list
  async renderUserList() {
    const users = await this.loadUsers();
    const list = document.getElementById('usersList');
    if (!list) return;
    
    list.innerHTML = '';
    
    const currentUser = this.userMap.get(this.currentUserId);
    
    users
      .filter(u => u.id !== this.currentUserId)
      .forEach(user => {
        const isFollowing = currentUser.following && currentUser.following.includes(user.id);
        const btnText = isFollowing ? 'Unfollow' : 'Follow';
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `
          <div class="user-info">
            <span class="tweet-user">@${user.username}</span>
            <span class="tweet-username">${user.name}</span>
          </div>
          <button class="${isFollowing ? 'btn-secondary' : ''}" 
                  onclick="newsFeed.toggleFollow('${user.id}', ${isFollowing})">
            ${btnText}
          </button>
        `;
        list.appendChild(div);
      });
  }

  // Format score for display
  formatScore(score) {
    if (score === undefined) return '';
    return score.toFixed(1);
  }

  // Format genres for display
  formatGenres(post) {
    // Handle both new 'genres' array and legacy 'genre' string
    const genres = post.genres || (post.genre ? [post.genre] : []);
    
    if (!genres.length) return '';
    
    return genres.map(genre => 
      `<span class="tweet-genre">${genre}</span>`
    ).join('');
  }

  // Show scoring factors in debug view
  showScoringFactors(postId) {
    const post = window.currentPosts.find(p => p.id === postId);
    console.log('Debug - Post:', post);
    console.log('Debug - Scoring Factors:', post?.scoringFactors);
    
    if (!post || !post.scoringFactors) {
      console.error('Error: Post or scoring factors not found');
      alert('Scoring factors not available for this post');
      return;
    }
    
    // Get the existing modal and content elements
    const debugModal = document.getElementById('debugModal');
    const content = document.getElementById('debugContent');
    
    if (!debugModal || !content) {
      console.error('Debug modal elements not found in the DOM');
      alert('Debug view not available');
      return;
    }
    
    const factors = post.scoringFactors;
    
    let html = `
      <h3>Scoring Factors for Post</h3>
      <p><strong>Total Score:</strong> ${this.formatScore(post.score)}</p>
      <table class="debug-table">
        <thead>
          <tr>
            <th>Factor</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    // Add each factor with proper formatting
    const factorMap = {
      'ownPost': 'Own Post',
      'followedAuthor': 'Followed Author',
      'genreMatch': 'Genre Match',
      'genrePreference': 'Genre Preference',
      'likedSameAuthor': 'Liked Same Author',
      'commentedSameAuthor': 'Commented on Author',
      'commentsInGenre': 'Comments in Genre',
      'imageBonus': 'Image Bonus',
      'recencyBonus': 'Recency Bonus',
      'popularity': 'Post Popularity',
      'friendOfFriend': 'Friend-of-Friend',
      'reciprocity': 'Reciprocity',
      'discoveryBoost': 'Discovery Boost',
      'views': 'Views',
      'likes': 'Likes',
      'comments': 'Comments'
    };

    // Sort factors by points (highest first)
    const sortedFactors = Object.entries(factors).sort((a, b) => b[1] - a[1]);
    
    // Display each factor
    sortedFactors.forEach(([key, value]) => {
      if (value === undefined || value === 0) return;
      
      const displayName = factorMap[key] || key;
      const isNegative = value < 0;
      const sign = isNegative ? '' : '+';
      const points = typeof value === 'number' ? value.toFixed(1) : value;
      
      // Special handling for negative values (like negative feedback)
      const valueDisplay = isNegative ? value : `${sign}${points}`;
      
      html += `<tr>
        <td>${displayName}</td>
        <td class="${isNegative ? 'negative-points' : 'positive-points'}">${valueDisplay}</td>
      </tr>`;
    });
    
    html += `
        </tbody>
      </table>
      <p class="debug-note">This debug view shows how this post was scored by the algorithm.</p>
    `;
    
    content.innerHTML = html;
    debugModal.style.display = 'block';
  }

  // Render the feed
  async renderFeed(page = 1, append = false) {
    const feed = await this.loadFeed(page, append);
    const feedDiv = document.getElementById('feed');
    if (!feedDiv) return;
    
    // Remove existing load more button if it exists
    const existingLoadMoreBtn = document.getElementById('load-more-btn');
    if (existingLoadMoreBtn) {
      existingLoadMoreBtn.remove();
    }
    
    if (!append) {
      feedDiv.innerHTML = ''; // clear old content only if not appending
    }
    
    if (feed.length === 0 && !append) {
      feedDiv.innerHTML = `
        <div class="feed-empty">
          <p>No tweets to display.</p>
          <p>Follow users or post something!</p>
        </div>
      `;
      return;
    }

    feed.forEach((post, index) => {
      const user = this.userMap.get(post.userId);
      const div = document.createElement('div');
      div.className = 'tweet';
      div.style.animationDelay = `${index * 0.1}s`;
      
      // Check if current user has liked this post
      const isLiked = post.likes && post.likes.includes(this.currentUserId);
      const likeCount = post.likes ? post.likes.length : 0;
      const commentCount = post.comments ? post.comments.length : 0;
      
      // Get user's first letter for avatar
      const firstLetter = user.name.charAt(0).toUpperCase();
      
      // Create tweet HTML
      let tweetHTML = `
        <div class="tweet-header">
          <div class="tweet-avatar">${firstLetter}</div>
          <div class="tweet-user-info">
            <span class="tweet-user">${user.name}</span>
            <span class="tweet-username">@${user.username}</span>
          </div>
          <span class="tweet-score" title="Click to see scoring factors" onclick="newsFeed.showScoringFactors('${post.id}')">🔥 ${post.score ? post.score.toFixed(1) : ''}</span>
        </div>
        <div class="tweet-content">${post.text}</div>
      `;
      
      // Add genres if available
      const genresHTML = this.formatGenres(post);
      if (genresHTML) {
        tweetHTML += `<div class="tweet-genres">${genresHTML}</div>`;
      }
      
      // Add image if available
      if (post.image) {
        tweetHTML += `
          <div class="tweet-image-container" onclick="openImageModal('${post.id}')">
            <img 
              src="${post.image}" 
              alt="Tweet image" 
              class="tweet-image"
              onload="this.classList.add(this.naturalHeight > this.naturalWidth ? 'portrait' : 'landscape')"
              onerror="if(!this.dataset.attempt){this.dataset.attempt='1';this.src='/image-uploads/${post.image.split('/').pop()}'} else if(this.dataset.attempt==='1'){this.dataset.attempt='2';this.src='/uploads/${post.image.split('/').pop()}'}"
            >
          </div>
        `;
      }
      
      // Add timestamp and actions
      // Get view count
      const viewCount = post.views ? post.views.length : 0;
      
      tweetHTML += `
        <div class="tweet-footer">
          <span>${new Date(post.timestamp).toLocaleString()}</span>
        </div>
        <div class="tweet-actions">
          <button class="btn-action ${isLiked ? 'liked' : ''}" onclick="newsFeed.toggleLike('${post.id}')">
            ${isLiked ? '❤️' : '🤍'} <span>${likeCount || 0}</span>
          </button>
          <button class="btn-action" onclick="newsFeed.toggleComments('${post.id}')">
            💬 <span>${commentCount || 0}</span>
          </button>
          <button id="view-btn-${post.id}" class="btn-action ${post.views && post.views.includes(this.currentUserId) ? 'viewed' : ''}" onclick="newsFeed.addView('${post.id}')">
            👁️ <span id="view-count-${post.id}">${viewCount || 0}</span>
          </button>
        </div>
      `;
      
      // Add comments section if there are comments
      if (post.comments && post.comments.length > 0) {
        tweetHTML += `
          <div id="comments-${post.id}" class="comments-section" style="display: none;">
            <div class="comments-list">
              ${this.renderComments(post.comments)}
          </div>
          <div class="comment-form">
            <input type="text" id="comment-input-${post.id}" placeholder="Add a comment..." class="comment-input">
              <button onclick="newsFeed.addComment('${post.id}')" class="comment-btn">Post</button>
            </div>
          </div>
        `;
      } else {
        tweetHTML += `
          <div id="comments-${post.id}" class="comments-section" style="display: none;">
            <div class="comments-list">
              <p>No comments yet.</p>
            </div>
            <div class="comment-form">
              <input type="text" id="comment-input-${post.id}" placeholder="Add a comment..." class="comment-input">
              <button onclick="newsFeed.addComment('${post.id}')" class="comment-btn">Post</button>
          </div>
        </div>
      `;
      }
      
      div.innerHTML = tweetHTML;
      feedDiv.appendChild(div);
    });
    
    // Add "Load More" button if there are more posts to load
    if (this.pagination && this.pagination.hasMore) {
      const loadMoreBtn = document.createElement('div');
      loadMoreBtn.id = 'load-more-btn';
      loadMoreBtn.className = 'load-more-container';
      loadMoreBtn.innerHTML = `
        <button class="load-more-btn" onclick="newsFeed.loadMore()">
          Load More
        </button>
      `;
      feedDiv.appendChild(loadMoreBtn);
    }
  }
  
  // Load more posts
  async loadMore() {
    const nextPage = (this.pagination?.page || 1) + 1;
    await this.renderFeed(nextPage, true);
  }

  // Render comments for a post
  renderComments(comments) {
    if (!comments.length) {
      return '<p class="no-comments">No comments yet. Be the first to comment!</p>';
    }
    
    return comments.map(comment => `
      <div class="comment">
        <div class="comment-header">
          <span class="tweet-user">@${comment.username}</span>
          <span class="tweet-username">${comment.name}</span>
          <span class="comment-time">${new Date(comment.timestamp).toLocaleString()}</span>
        </div>
        <div class="comment-content">${comment.text}</div>
      </div>
    `).join('');
  }

  // Add a view to a post
  async addView(postId) {
    try {
      // Get the post from the current posts
      const post = window.currentPosts.find(p => p.id === postId);
      if (!post) return;
      
      const response = await fetch('/view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.currentUserId,
          postId
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to add view');
      }
      
      // Update the view count in the UI
      const viewCountElement = document.getElementById(`view-count-${postId}`);
      if (viewCountElement) {
        viewCountElement.textContent = result.viewCount || 0;
      }
      
      // Update the view button state
      const viewButton = document.getElementById(`view-btn-${postId}`);
      if (viewButton) {
        viewButton.classList.add('viewed');
      }
      
      // Update the post in the current posts array
      if (!post.views) {
        post.views = [];
      }
      post.views.push(this.currentUserId);
      
      // Update the score display to reflect the new view
      const scoreElement = document.querySelector(`[onclick*="showScoringFactors('${postId}')"]`);
      if (scoreElement) {
        const currentScore = parseFloat(scoreElement.textContent.split(' ')[1]) || 0;
        const newScore = currentScore + 0.5; // +0.5 for the new view
        scoreElement.textContent = `🔥 ${newScore.toFixed(1)}`;
      }
      
      return result;
    } catch (error) {
      console.error('Error adding view:', error);
      throw error;
    }
  }

  // Toggle like on a post
  async toggleLike(postId) {
    try {
      const response = await fetch('/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.currentUserId, postId })
      });
      
      if (response.ok) {
        // Get post details for preference update
        const post = window.currentPosts.find(p => p.id === postId);
        if (post) {
          // Update user preferences
          await fetch('/update-preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: this.currentUserId,
              authorId: post.userId,
              genres: post.genres || post.genre,
              action: 'like'
            })
          });
        }
        
        // Update the feed to reflect the like
        await this.renderFeed();
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }

  // Toggle comments section visibility
  toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (commentsSection) {
      const isVisible = commentsSection.style.display !== 'none';
      commentsSection.style.display = isVisible ? 'none' : 'block';
    }
  }

  // Add a comment to a post
  async addComment(postId) {
    const commentInput = document.getElementById(`comment-input-${postId}`);
    const commentText = commentInput.value.trim();
    
    if (!commentText) return;
    
    try {
      const response = await fetch('/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: this.currentUserId, 
          postId, 
          text: commentText 
        })
      });
      
      if (response.ok) {
        // Get post details for preference update
        const post = window.currentPosts.find(p => p.id === postId);
        if (post) {
          // Update user preferences - commenting is a stronger signal than liking
          await fetch('/update-preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: this.currentUserId,
              authorId: post.userId,
              genres: post.genres || post.genre,
              action: 'comment'
            })
          });
        }
        
        // Clear the input
        commentInput.value = '';
        
        // Update the feed to show the new comment
        await this.renderFeed();
        
        // Keep comments section open
        this.toggleComments(postId);
        this.toggleComments(postId);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }

  // Toggle follow/unfollow
  async toggleFollow(targetId, isFollowing) {
    try {
      const url = isFollowing ? '/unfollow' : '/follow';
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.currentUserId, followId: targetId })
      });
      
      await this.renderUserList();
      await this.renderFeed();
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  }

  // Post a tweet
  async postTweet(form) {
    try {
      // Create FormData and append all form data
      const formData = new FormData(form);
      formData.append('userId', this.currentUserId);
      
      // The checkboxes will automatically be included as an array by the browser
      // but we'll handle them manually for clarity
      
      // Remove existing genres (if any) to avoid duplication
      const existingGenres = formData.getAll('genres');
      existingGenres.forEach(() => {
        formData.delete('genres');
      });
      
      // Get all checked genre checkboxes and add them to the formData
      const checkedGenres = form.querySelectorAll('input[name="genres"]:checked');
      if (checkedGenres.length > 0) {
        checkedGenres.forEach(checkbox => {
          formData.append('genres', checkbox.value);
        });
      }
      
      const response = await fetch('/tweet', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      alert(result.message);
      
      if (response.ok) {
        form.reset();
        await this.renderFeed();
      }
    } catch (error) {
      console.error('Error posting tweet:', error);
      alert('Failed to post tweet. Please try again.');
    }
  }

  // Mark a post as "Not Interested"
  async markNotInterested(postId) {
    try {
      // Get post details
      const post = window.currentPosts.find(p => p.id === postId);
      if (!post) return;
      
      // Update user preferences with negative feedback
      await fetch('/update-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUserId,
          authorId: post.userId,
          genres: post.genres || post.genre,
          action: 'not_interested'
        })
      });
      
      // Find and animate the tweet element
      const buttons = document.querySelectorAll(`.btn-action.not-interested`);
      let tweetElement = null;
      
      // Find the button with the matching onclick attribute
      for (let button of buttons) {
        if (button.getAttribute('onclick') === `newsFeed.markNotInterested('${postId}')`) {
          tweetElement = button.closest('.tweet');
          break;
        }
      }
      
      if (tweetElement) {
        tweetElement.style.transition = 'opacity 0.5s, transform 0.5s';
        tweetElement.style.opacity = '0';
        tweetElement.style.transform = 'translateX(100px)';
        
        setTimeout(() => {
          // Refresh feed after animation completes
          this.renderFeed();
        }, 500);
      } else {
        // If animation doesn't work, just refresh the feed
        this.renderFeed();
      }
    } catch (error) {
      console.error('Error marking as not interested:', error);
    }
  }

  // Initialize the app
  init() {
    // Check if user is logged in
    if (!this.currentUserId && window.location.pathname !== '/' && window.location.pathname !== '/signup') {
      window.location.href = '/';
      return;
    }

    // Setup tweet form
    const tweetForm = document.getElementById('tweetForm');
    if (tweetForm) {
      tweetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.postTweet(e.target);
      });
    }

    // Load initial data
    this.renderUserList();
    this.renderFeed();
  }
}

// Initialize the news feed
const newsFeed = new NewsFeed();

// Start the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  newsFeed.init();
});
