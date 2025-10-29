# 🗳️ QuickPoll - Real-Time Opinion Polling Platform

A modern, real-time polling application built with **FastAPI** (Python) and **Next.js** (React/TypeScript). Create polls,edit poll, vote, and see results update live across all connected users without page refreshes.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![Next.js](https://img.shields.io/badge/next.js-14+-black.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)

## ✨ Features

### Core Functionality
- 🎯 **Create Custom Polls** - Create polls with 2-10 options
- 🗳️ **Real-Time Voting** - Vote and see results update instantly
- 💬 **Live Updates** - All changes broadcast via WebSocket
- ❤️ **Like Polls** - Show appreciation for interesting polls
- 📊 **Visual Results** - Beautiful progress bars with percentages
- 🔄 **Vote Switching** - Change your vote anytime

### Poll Management
- ✏️ **Edit Polls** - Update title and description
- ⏸️ **Activate/Deactivate** - Control poll visibility and voting
- 🗑️ **Delete Polls** - Remove polls you've created
- 👤 **User Polls** - Filter to see only your polls
- 🔒 **Creator Controls** - Only poll creators can edit/delete

### Real-Time Features
- 🔴 **Live Vote Counts** - See vote counts update in real-time
- 📡 **WebSocket Updates** - Instant synchronization across all users
- 🎭 **Status Changes** - Poll activation/deactivation synced live
- 🚀 **Optimistic Updates** - Instant feedback on user actions
- 🔄 **Auto-Reconnect** - Automatic WebSocket reconnection

### User Experience
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS
- 📱 **Mobile Responsive** - Works seamlessly on all devices
- ⚡ **Fast Loading** - Pagination for efficient data loading
- 🔐 **Secure Authentication** - JWT-based auth system

## 🏗️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Async ORM for database operations
- **SQLite** - Lightweight database (easily swappable)
- **WebSockets** - Real-time bidirectional communication
- **Pydantic** - Data validation and serialization
- **JWT** - Secure authentication tokens
- **Bcrypt** - Password hashing

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **Zustand** - Lightweight state management
- **Axios** - HTTP client
- **Lucide Icons** - Beautiful icon library

## 📋 Prerequisites

- **Python 3.9+**
- **Node.js 18+**
- **npm** or **yarn**

## 🚀 Getting Started

### Backend Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/quickpoll.git
```

2. **Create virtual environment**
```bash
cd backend
python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Create `.env` file**
```bash
# backend/.env
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

5. **Run the backend**
```bash
python main.py
# or
uvicorn main:app --reload
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Create `.env.local` file**
```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

4. **Run the development server**
```bash
npm run dev
# or
yarn dev
```

The frontend will be available at `http://localhost:3000`

## 📁 Project Structure

```
quickpoll/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── database.py          # Database models and setup
│   ├── schemas.py           # Pydantic schemas
│   ├── crud.py              # Database operations
│   ├── auth.py              # Authentication logic
│   ├── websocket.py         # WebSocket manager
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages
│   │   │   ├── page.tsx     # Home page
│   │   │   ├── login/       # Login page
│   │   │   ├── register/    # Register page
|   |   |   └── layout.tsx   # layout.tsx
|   |   |   └── globals.css  # globals css file
│   │   ├── components/      # React components
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   ├── PollCard.tsx
│   │   │   ├── CreatePollDialog.tsx
│   │   │   └── EditPollDialog.tsx
│   │   ├── lib/             # Utilities
│   │   │   ├── api.ts       # API client
│   │   │   ├── websocket.ts # WebSocket manager
│   │   │   └── utils.ts
│   │   └── store/           # State management
│   │       └── authStore.ts
│   ├── package.json
│   └── .env.local
│
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Polls
- `GET /api/polls` - List polls (with pagination & filters)
- `POST /api/polls` - Create new poll
- `GET /api/polls/{id}` - Get poll details
- `PUT /api/polls/{id}` - Update poll
- `DELETE /api/polls/{id}` - Delete poll

### Voting & Likes
- `POST /api/polls/{id}/vote` - Vote on poll
- `POST /api/polls/{id}/like` - Toggle like on poll

### WebSocket
- `WS /ws` - WebSocket connection for real-time updates

## 🔄 WebSocket Events

### Client → Server
```javascript
// Subscribe to poll updates
{ type: "subscribe", poll_id: 1 }

// Unsubscribe from poll updates
{ type: "unsubscribe", poll_id: 1 }

// Ping for connection check
{ type: "ping" }
```

### Server → Client
```javascript
// New poll created
{ type: "poll_created", data: {...} }

// Poll updated
{ type: "poll_update", poll_id: 1, data: {...} }

// Poll deleted
{ type: "poll_deleted", poll_id: 1 }

// Vote update
{ type: "vote_update", poll_id: 1, data: {...} }

// Like update
{ type: "like_update", poll_id: 1, data: {...} }
```

## 🎯 Usage Examples

### Creating a Poll
1. Click **"Create Poll"** button
2. Enter poll title (required)
3. Add description (optional)
4. Add 2-10 options
5. Click **"Create Poll"**

### Voting
1. Click on any option to vote
2. Results update instantly for all users
3. Change your vote by clicking another option

### Managing Your Polls
1. Click **"Show My Polls"** to filter your polls
2. Use the edit icon to update title/description
3. Use the pause icon to deactivate/activate
4. Use the trash icon to delete

### Real-Time Updates
- All users see votes update instantly
- Poll status changes sync across all clients
- Deleted polls removed from all screens
- Reactivated polls appear automatically

## 🔐 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - Bcrypt with salt
- **CORS Protection** - Configurable origins
- **SQL Injection Prevention** - SQLAlchemy ORM
- **Input Validation** - Pydantic schemas
- **Authorization Checks** - User-specific operations

## 🎨 UI Components

Built with **shadcn/ui** for consistent, accessible components:
- Button
- Input
- Card
- Badge
- Dialog
- Alert
- Textarea

## 📊 Database Schema

### Users
- `id` - Primary key
- `username` - Unique username
- `email` - Unique email
- `hashed_password` - Bcrypt hashed password
- `created_at` - Timestamp

### Polls
- `id` - Primary key
- `title` - Poll question
- `description` - Optional context
- `creator_id` - Foreign key to users
- `is_active` - Active status
- `created_at` - Timestamp

### Poll Options
- `id` - Primary key
- `poll_id` - Foreign key to polls
- `text` - Option text
- `position` - Display order

### Votes
- `id` - Primary key
- `user_id` - Foreign key to users
- `poll_id` - Foreign key to polls
- `option_id` - Foreign key to options
- `created_at` - Timestamp
- Unique constraint: (user_id, poll_id)

### Likes
- `id` - Primary key
- `user_id` - Foreign key to users
- `poll_id` - Foreign key to polls
- `created_at` - Timestamp
- Unique constraint: (user_id, poll_id)
