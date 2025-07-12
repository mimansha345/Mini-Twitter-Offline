# Mini-Twitter

Mini-Twitter is a simple social media web application that allows users to sign up, log in, post updates, and interact with other users. The project is built with a Node.js backend and a static HTML/CSS/JS frontend. Data is stored in JSON files for simplicity.

## Features
- User registration and login
- Home feed displaying posts
- Genre selection for personalized content
- User suggestions
- Profile image uploads
- Post image uploads

## Project Structure
```
Mini-Twitter/
├── backend/
│   └── server.js            # Node.js backend server
├── data/
│   ├── posts.json           # Stores posts data
│   ├── users.json           # Stores user data
│   └── uploads/             # Uploaded images
├── frontend/
│   ├── home.html            # Home feed page
│   ├── login.html           # Login page
│   ├── select-genres.html   # Genre selection page
│   ├── signup.html          # Signup page
│   ├── style.css            # Stylesheet
│   ├── suggest-users.html   # User suggestions page
│   └── js/
│       └── main.js          # Frontend logic
│   └── uploads/             # Profile images
├── package.json             # Node.js dependencies
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher recommended)

### Installation
1. Clone the repository:
   ```powershell
   git clone https://github.com/mimansha345/Mini-Twitter.git
   cd Mini-Twitter
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```

### Running the Application
1. Start the backend server:
   ```powershell
   node backend/server.js
   ```
2. Open `frontend/home.html` in your browser to access the app.

## Data Storage
- All user and post data is stored in the `data/` directory as JSON files.
- Uploaded images are saved in `data/uploads/` and `frontend/uploads/`.

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

