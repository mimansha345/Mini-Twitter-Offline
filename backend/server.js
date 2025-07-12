import express from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { fileURLToPath } from 'url';
import cors from 'cors';

// MaxHeap implementation for scoring and ranking posts
class MaxHeap {
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

  // Add a post to the heap
  insert(post) {
    this.heap.push(post);
    this.heapifyUp();
    return this;
  }

  // Remove and return the highest scored post
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

  // Get top N posts from the heap
  getTopN(n) {
    const result = [];
    const tempHeap = new MaxHeap();
    
    // Create a copy of the heap
    this.heap.forEach(post => tempHeap.insert(post));
    
    // Extract top N posts
    for (let i = 0; i < n && tempHeap.heap.length > 0; i++) {
      result.push(tempHeap.extractMax());
    }
    
    return result;
  }
}

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsPath = path.join(__dirname, '../data/uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

const app = express();
const PORT = 3001;

// Enable CORS
app.use(cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Paths to data files
const usersPath = path.join(__dirname, '../data/users.json');
const postsPath = path.join(__dirname, '../data/posts.json');

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve the uploads folder at multiple routes for compatibility
app.use('/image-uploads', express.static(uploadsPath));
app.use('/uploads', express.static(uploadsPath)); // For backward compatibility

// HTML routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/signup.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/home.html'));
});

app.get('/select-genres', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/select-genres.html'));
});

app.get('/suggest-users', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/suggest-users.html'));
});

// Signup route
app.post('/signup', (req, res) => {
  const { name, username, password, genre } = req.body;
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ message: 'Username already exists.' });
  }

  const newUser = {
    id: uuidv4(),
    name,
    username,
    password,
    genre,
    following: []
  };

  users.push(newUser);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.status(201).json({ message: 'Signup successful!' });
});

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

  // Send response with user data in 'data' object to match frontend expectations
  res.json({ 
    message: 'Login successful!', 
    data: {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        // Add any other user properties you need on the frontend
        // but avoid sending sensitive data like password
      }
    }
  });
});

// GET users - returns all users
app.get('/users', (req, res) => {
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  // Remove sensitive information like passwords before sending
  const safeUsers = users.map(({ id, name, username, genre, following }) => ({
    id, name, username, genre, following
  }));
  res.json(safeUsers);
});

// POST /follow
app.post('/follow', (req, res) => {
  const { userId, followId } = req.body;
  if (!userId || !followId) return res.status(400).json({ message: 'Both user IDs required' });

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (!user.following.includes(followId)) {
    user.following.push(followId);
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  }

  res.json({ message: 'Now following' });
});

// POST /unfollow
app.post('/unfollow', (req, res) => {
  const { userId, followId } = req.body;
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.following = user.following.filter(id => id !== followId);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

  res.json({ message: 'Unfollowed' });
});

// Simple image upload setup with improved filename handling
const storage = multer.diskStorage({
  destination: uploadsPath,
  filename: (req, file, cb) => {
    // Use timestamp as filename to avoid special character issues
    const timestamp = Date.now();
    // Get extension from original file or default to .png
    const fileExtension = path.extname(file.originalname) || '.png';
    cb(null, `${timestamp}${fileExtension}`);
  }
});
const upload = multer({ storage });

// Post a tweet
app.post('/tweet', upload.single('image'), (req, res) => {
  const { userId, text, genres } = req.body;
  // Always store with the new image path format
  const image = req.file ? `/image-uploads/${req.file.filename}` : null;

  if (!userId || !text) {
    return res.status(400).json({ message: 'User ID and text required' });
  }

  const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  
  // Parse genres from the request
  let postGenres = [];
  if (genres) {
    // Handle both string (comma-separated) and array formats
    postGenres = Array.isArray(genres) ? genres : genres.split(',').map(g => g.trim());
  } else {
    // If no genres provided, use user's default genres
    const user = users.find(u => u.id === userId);
    if (user && user.genre) {
      // Convert user.genre to array if it's a string
      postGenres = typeof user.genre === 'string' 
        ? user.genre.split(',').map(g => g.trim()) 
        : (Array.isArray(user.genre) ? user.genre : [user.genre]);
    }
  }

  const newPost = {
    id: uuidv4(),
    userId,
    text,
    genres: postGenres,
    image,
    timestamp: new Date().toISOString(),
    comments: [],
    likes: []
  };

  posts.push(newPost);
  fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2));
  res.status(201).json({ message: 'Tweet posted successfully', post: newPost });
});

// POST /view - Add a view to a post and update the score
app.post('/view', (req, res) => {
  try {
    const { userId, postId } = req.body;
    
    // Load current data
    const posts = JSON.parse(fs.readFileSync(postsPath));
    const users = JSON.parse(fs.readFileSync(usersPath));
    
    // Find the post
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Initialize views array if it doesn't exist
    if (!posts[postIndex].views) {
      posts[postIndex].views = [];
    }
    
    // Always add the view (allow multiple views from same user)
    posts[postIndex].views.push(userId);
    
    // Update post score (0.5 points per view)
    posts[postIndex].score = (posts[postIndex].score || 0) + 0.5;
    
    // Update scoring factors
    if (!posts[postIndex].scoringFactors) {
      posts[postIndex].scoringFactors = {};
    }
    if (!posts[postIndex].scoringFactors.views) {
      posts[postIndex].scoringFactors.views = 0;
    }
    posts[postIndex].scoringFactors.views += 0.5;
    
    // Update user preferences based on view (but only once per user)
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      const post = posts[postIndex];
      const posterId = post.userId;
      
      // Only update preferences if this is the first view from this user
      const userViewCount = posts[postIndex].views.filter(id => id === userId).length;
      if (userViewCount === 1) {
        // Update genre preferences
        post.genres.forEach(genre => {
          if (!users[userIndex].genrePreference) {
            users[userIndex].genrePreference = {};
          }
          users[userIndex].genrePreference[genre] = (users[userIndex].genrePreference[genre] || 0) + 0.1;
        });
        
        // Update author affinity
        if (posterId !== userId) { // Don't update affinity for own posts
          if (!users[userIndex].authorAffinity) {
            users[userIndex].authorAffinity = {};
          }
          users[userIndex].authorAffinity[posterId] = (users[userIndex].authorAffinity[posterId] || 0) + 0.1;
        }
      }
    }
    
    // Save changes
    fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2));
    if (userIndex !== -1) {
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    }
    
    res.json({ 
      viewCount: posts[postIndex].views.length,
      score: posts[postIndex].score,
      userViewCount: posts[postIndex].views.filter(id => id === userId).length
    });
  } catch (error) {
    console.error('Error in /view endpoint:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /like - Like a post
app.post('/like', (req, res) => {
  const { userId, postId } = req.body;
  if (!userId || !postId) {
    return res.status(400).json({ message: 'User ID and post ID required' });
  }

  const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));
  const postIndex = posts.findIndex(p => p.id === postId);
  
  if (postIndex === -1) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  // Initialize likes array if it doesn't exist
  if (!posts[postIndex].likes) {
    posts[postIndex].likes = [];
  }
  
  const alreadyLiked = posts[postIndex].likes.includes(userId);
  
  if (alreadyLiked) {
    // Unlike: remove user ID from likes
    posts[postIndex].likes = posts[postIndex].likes.filter(id => id !== userId);
  } else {
    // Like: add user ID to likes
    posts[postIndex].likes.push(userId);
  }
  
  fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2));
  res.json({ 
    message: alreadyLiked ? 'Post unliked' : 'Post liked',
    liked: !alreadyLiked,
    likeCount: posts[postIndex].likes.length
  });
});

// POST /comment - Add a comment to a post
app.post('/comment', (req, res) => {
  const { userId, postId, text } = req.body;
  if (!userId || !postId || !text) {
    return res.status(400).json({ message: 'User ID, post ID, and comment text required' });
  }

  const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  const postIndex = posts.findIndex(p => p.id === postId);
  
  if (postIndex === -1) {
    return res.status(404).json({ message: 'Post not found' });
  }

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  // Initialize comments array if it doesn't exist
  if (!posts[postIndex].comments) {
    posts[postIndex].comments = [];
  }
  
  const newComment = {
    id: uuidv4(),
    userId,
    username: user.username,
    name: user.name,
    text,
    timestamp: new Date().toISOString()
  };
  
  posts[postIndex].comments.push(newComment);
  fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2));
  
  res.status(201).json({ 
    message: 'Comment added successfully', 
    comment: newComment 
  });
});

// GET /feed - returns tweets with user info, sorted by score using a max heap
app.get('/feed', (req, res) => {
  const userId = req.query.userId;
  const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

  // Create hashmaps for quick lookups
  const userMap = {};
  const commentHistoryByGenre = {};
  const commentHistoryByAuthor = {};
  const authorAffinityMap = {};
  const negativeAuthorFeedback = new Set();
  const negativeGenreFeedback = new Set();

  // Build user hashmap
  users.forEach(u => userMap[u.id] = u);

  // Get current user
  const currentUser = userMap[userId];
  if (!currentUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Initialize user preference maps if they don't exist
  if (!currentUser.genrePreference) {
    currentUser.genrePreference = {};
  }
  
  if (!currentUser.authorAffinity) {
    currentUser.authorAffinity = {};
  }

  // Convert user.genres from string to array if needed
  let userGenres = [];
  if (currentUser.genre) {
    userGenres = typeof currentUser.genre === 'string' 
      ? currentUser.genre.split(',').map(g => g.trim()) 
      : (Array.isArray(currentUser.genre) ? currentUser.genre : [currentUser.genre]);
  }

  // Build following map for quick lookups
  const following = new Set(currentUser.following || []);
  
  // Build comment history maps
  posts.forEach(post => {
    // Handle legacy posts that have genre field instead of genres array
    const postGenres = post.genres || (post.genre ? [post.genre] : []);
    
    if (post.comments && post.comments.length > 0) {
      post.comments.forEach(comment => {
        if (comment.userId === userId) {
          // Track comments by author
          if (!commentHistoryByAuthor[post.userId]) {
            commentHistoryByAuthor[post.userId] = 0;
          }
          commentHistoryByAuthor[post.userId]++;
          
          // Track comments by genre
          postGenres.forEach(genre => {
            if (genre) {
              if (!commentHistoryByGenre[genre]) {
                commentHistoryByGenre[genre] = 0;
              }
              commentHistoryByGenre[genre]++;
            }
          });
        }
      });
    }
  });

  // Build friend-of-friend map
  const friendOfFriendMap = {};
  users.forEach(user => {
    if (user.following && user.following.length > 0) {
      user.following.forEach(followedId => {
        if (following.has(user.id) && !following.has(followedId) && followedId !== userId) {
          friendOfFriendMap[followedId] = true;
        }
      });
    }
  });

  // Build reciprocity map (who follows the current user back)
  const reciprocityMap = {};
  users.forEach(user => {
    if (user.following && user.following.includes(userId)) {
      reciprocityMap[user.id] = true;
    }
  });

  // Create a max heap for scoring and ranking posts
  const postsHeap = new MaxHeap();
  
  // Score each post and add to the heap
  posts.forEach(post => {
    let score = 0;
    const scoringFactors = {};
    
    // Handle legacy posts that have genre field instead of genres array
    const postGenres = post.genres || (post.genre ? [post.genre] : []);
    
    // 1. Own Post: 0 (was +6) - Still surface but don't crowd out others
    if (post.userId === userId) {
      score += 0;
      scoringFactors.ownPost = 0;
    }
    
    // 2. Followed Author: +4 (was +5) - Prominent but not overpowering
    if (following.has(post.userId)) {
      score += 4;
      scoringFactors.followedAuthor = 4;
    }
    
         // 3. Genre Match: +5 for exact, 1 + 0.5/match (capped at +3.5) for partial
    if (postGenres.length > 0 && userGenres.length > 0) {
      const matchingGenres = postGenres.filter(genre => userGenres.includes(genre));
      const matchCount = matchingGenres.length;
      
      if (matchCount > 0) {
        let genreScore = 0;
        
                  if (matchCount === postGenres.length && matchCount === userGenres.length) {
           // Exact match (all genres match exactly): +5
           genreScore = 5;
           scoringFactors.exactGenreMatch = 5;
          } else {
           // Partial match - base score of 1 plus 0.5 for each matching genre (capped at +3.5)
           genreScore = Math.min(3.5, 1 + (matchCount * 0.5));
          scoringFactors.partialGenreMatch = genreScore;
        }
        
        score += genreScore;
      }
    }
    
    // 4. Genre Preference: Removed (was +1 per genre) - Not enough history in small dataset
    
    // 5. Author Affinity: +2 (was +3) - Simple and visible effect
    if (currentUser.authorAffinity[post.userId] > 0) {
      score += 2;
      scoringFactors.likedSameAuthor = 2;
    }
    
    // 6. Commented Same Author: Removed - Merged with Author Affinity
    
    // 7. Comments in Genre: Removed - Too fine-grained for a demo
    
    // 8. Image Bonus: +1 (unchanged) - Nice visual nudge
    if (post.image) {
      score += 1;
      scoringFactors.imageBonus = 1;
    }
    
    // 9. Recency Bonus: +3 max (linear 0-3 over 5 hours) - Less extreme for small dataset
    const postTime = new Date(post.timestamp);
    const now = new Date();
    const hoursDiff = (now - postTime) / (1000 * 60 * 60);
    if (hoursDiff < 1) {
      const recencyScore = 3; // Max +3 (was +5)
      score += recencyScore;
      scoringFactors.recencyBonus = recencyScore;
    } else if (hoursDiff < 5) {
      const recencyScore = 3 - (hoursDiff / 5) * 3; // Linear decay from +3 to 0 over 5 hours
      score += recencyScore;
      scoringFactors.recencyBonus = parseFloat(recencyScore.toFixed(1));
    }
    
    // 10. Post Engagement: Likes +1, Comments +1.5, Views +0.25 - Scales better to small numbers
    const likesCount = post.likes ? post.likes.length : 0;
    const commentsCount = post.comments ? post.comments.length : 0;
    const viewsCount = post.views ? post.views.length : 0;
    
    // Updated engagement metrics with new weights
    const likesScore = likesCount * 1;         // +1 per like (unchanged)
    const commentsScore = commentsCount * 1.5; // +1.5 per comment (was +2)
    const viewsScore = viewsCount * 0.25;      // +0.25 per view (was +0.5)
    
    // Add individual scoring factors
    if (likesCount > 0) {
      scoringFactors.likes = likesScore;
      score += likesScore;
    }
    
    if (commentsCount > 0) {
      scoringFactors.comments = commentsScore;
      score += commentsScore;
    }
    
    if (viewsCount > 0) {
      scoringFactors.views = parseFloat(viewsScore.toFixed(2));
      score += viewsScore;
    }
    
    // 11. Friend-of-Friend: Removed - Hard to see in a small network
    
    // 12. Reciprocity: Removed - Same reason as Friend-of-Friend
    
    // 14. Negative Feedback Penalty: -4 author (was -5), -2 genre (unchanged)
    let negativeFeedbackScore = 0;
    
    if (negativeAuthorFeedback.has(post.userId)) {
      negativeFeedbackScore -= 4; // -4 (was -5)
    }
    
    // Check for negative feedback on any of the post's genres
    postGenres.forEach(genre => {
      if (genre && negativeGenreFeedback.has(genre)) {
        negativeFeedbackScore -= 2; // Unchanged
      }
    });
    
    if (negativeFeedbackScore < 0) {
      score += negativeFeedbackScore; // Add because it's negative
      scoringFactors.negativeFeedback = negativeFeedbackScore;
    }
    
    // Add post with score to the heap
    postsHeap.insert({
      ...post,
      score,
      scoringFactors,
      user: userMap[post.userId] || { username: "Unknown", name: "Unknown" }
    });
  });

  // 13. Discovery Boost: +2 for 1 random non-followed post (was +2-4 for 1-2 posts)
  const nonFollowedPosts = posts.filter(post => 
    post.userId !== userId && !following.has(post.userId)
  );
  
  if (nonFollowedPosts.length > 0) {
    // Select 1 random post for discovery boost (was 1-2)
    const numDiscovery = Math.min(1, nonFollowedPosts.length);
    const shuffled = [...nonFollowedPosts].sort(() => 0.5 - Math.random());
    const discoveryPosts = shuffled.slice(0, numDiscovery);
    
    // Apply discovery boost by re-scoring and re-inserting these posts
    discoveryPosts.forEach(post => {
      // Find the post in the heap
      const postIndex = postsHeap.heap.findIndex(p => p.id === post.id);
      if (postIndex >= 0) {
        // Add fixed discovery boost of +2 (was +2 to +4 random)
        const boostValue = 2;
        postsHeap.heap[postIndex].score += boostValue;
        
        // Add to scoring factors
        if (!postsHeap.heap[postIndex].scoringFactors) {
          postsHeap.heap[postIndex].scoringFactors = {};
        }
        postsHeap.heap[postIndex].scoringFactors.discoveryBoost = boostValue;
        
        // Rebuild the heap to maintain the heap property
        postsHeap.heapifyUp();
        postsHeap.heapifyDown();
      }
    });
  }
  
  // Get posts from the heap with pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15; // Default to 15 posts per page
  const skip = (page - 1) * limit;
  
  // Get all top posts from the heap
  const allTopPosts = postsHeap.getTopN(90);
  
  // Slice the posts based on pagination parameters
  const paginatedPosts = allTopPosts.slice(skip, skip + limit);
  
  // Return posts with pagination metadata
  res.json({
    posts: paginatedPosts,
    pagination: {
      page,
      limit,
      totalPosts: allTopPosts.length,
      hasMore: skip + limit < allTopPosts.length
    }
  });
});

// Direct image serving endpoint that just needs the filename
app.get('/get-image/:filename', (req, res) => {
  const { filename } = req.params;
  if (!filename) {
    return res.status(400).send('No filename provided');
  }
  
  // Check if file exists in uploads directory
  const filePath = path.join(uploadsPath, filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  } 
  
  // If not found directly, try to find a file starting with the timestamp part
  const timestamp = filename.split('-')[0];
  if (timestamp) {
    const files = fs.readdirSync(uploadsPath);
    const matchingFile = files.find(file => file.startsWith(timestamp));
    if (matchingFile) {
      return res.sendFile(path.join(uploadsPath, matchingFile));
    }
  }
  
  // No matching file found
  return res.status(404).send('Image not found');
});

// POST /update-user - Update user information (like genres)
app.post('/update-user', (req, res) => {
  const { userId, genre } = req.body;
  if (!userId) {
    return res.status(400).json({ message: 'User ID required' });
  }

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  // Update genre if provided
  if (genre !== undefined) {
    users[userIndex].genre = genre;
  }
  
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.json({ 
    message: 'User updated successfully', 
    user: {
      id: users[userIndex].id,
      name: users[userIndex].name,
      username: users[userIndex].username,
      genre: users[userIndex].genre,
      following: users[userIndex].following
    }
  });
});

// POST /update-preferences - Update user preferences for feed personalization
app.post('/update-preferences', (req, res) => {
  const { userId, authorId, genres, action } = req.body;
  if (!userId) {
    return res.status(400).json({ message: 'User ID required' });
  }

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  // Initialize preference maps if they don't exist
  if (!users[userIndex].genrePreference) {
    users[userIndex].genrePreference = {};
  }
  
  if (!users[userIndex].authorAffinity) {
    users[userIndex].authorAffinity = {};
  }
  
  // Convert genres to array if it's a string or single value
  const genreArray = genres ? 
    (Array.isArray(genres) ? genres : 
     (typeof genres === 'string' ? genres.split(',').map(g => g.trim()) : [genres])) 
    : [];
  
  // Update preferences based on action
  switch (action) {
    case 'like':
      // Increase affinity for author
      if (authorId) {
        users[userIndex].authorAffinity[authorId] = 
          (users[userIndex].authorAffinity[authorId] || 0) + 1;
      }
      // Increase preference for each genre
      genreArray.forEach(genre => {
        if (genre) {
          users[userIndex].genrePreference[genre] = 
            (users[userIndex].genrePreference[genre] || 0) + 1;
        }
      });
      break;
      
    case 'comment':
      // Increase affinity for author more than like
      if (authorId) {
        users[userIndex].authorAffinity[authorId] = 
          (users[userIndex].authorAffinity[authorId] || 0) + 2;
      }
      // Increase preference for each genre
      genreArray.forEach(genre => {
        if (genre) {
          users[userIndex].genrePreference[genre] = 
            (users[userIndex].genrePreference[genre] || 0) + 1;
        }
      });
      break;
      
    case 'dislike':
      // Decrease affinity for author
      if (authorId) {
        users[userIndex].authorAffinity[authorId] = 
          (users[userIndex].authorAffinity[authorId] || 0) - 1;
      }
      break;
      
    case 'not_interested':
      // Strong negative signal for author or genre
      if (authorId) {
        users[userIndex].authorAffinity[authorId] = 
          (users[userIndex].authorAffinity[authorId] || 0) - 3;
      }
      genreArray.forEach(genre => {
        if (genre) {
          users[userIndex].genrePreference[genre] = 
            (users[userIndex].genrePreference[genre] || 0) - 2;
        }
      });
      break;
  }
  
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.json({ 
    message: 'Preferences updated successfully', 
    preferences: {
      genrePreference: users[userIndex].genrePreference,
      authorAffinity: users[userIndex].authorAffinity
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Ensure data files exist
  if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, '[]');
  }
  
  if (!fs.existsSync(postsPath)) {
    fs.writeFileSync(postsPath, '[]');
  }
});
