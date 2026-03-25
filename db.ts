import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'bookhaven.db');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    gender TEXT,
    birthday TEXT,
    onboarded BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    cover_url TEXT,
    open_library_id TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS user_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    rating INTEGER,
    notes TEXT,
    mood TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    UNIQUE(user_id, book_id)
  );

  CREATE TABLE IF NOT EXISTS uploaded_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    file_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY,
    favorite_genres TEXT,
    reading_frequency TEXT,
    preferred_mood TEXT,
    favorite_types TEXT,
    current_obsession TEXT,
    last_mood TEXT,
    last_mood_updated DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- NEW: Reading Sessions Tracking
  CREATE TABLE IF NOT EXISTS reading_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER,
    uploaded_book_id INTEGER,
    session_start DATETIME NOT NULL,
    session_end DATETIME,
    pages_read INTEGER,
    mood_before TEXT,
    mood_after TEXT,
    reading_speed REAL,
    device_type TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (uploaded_book_id) REFERENCES uploaded_books(id)
  );

  -- NEW: Dynamic Mood-Genre Learning Matrix
  CREATE TABLE IF NOT EXISTS mood_genre_learning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mood_emoji TEXT NOT NULL,
    genre TEXT NOT NULL,
    success_rate REAL DEFAULT 0.5,
    click_count INTEGER DEFAULT 0,
    total_recommendations INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mood_emoji, genre)
  );

  -- NEW: Recommendation Feedback Loop
  CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER,
    uploaded_book_id INTEGER,
    recommended_by TEXT NOT NULL,
    user_clicked BOOLEAN DEFAULT 0,
    user_ignored BOOLEAN DEFAULT 0,
    time_to_click INTEGER,
    user_rating INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (uploaded_book_id) REFERENCES uploaded_books(id)
  );

  -- NEW: Book Genre Mapping
  CREATE TABLE IF NOT EXISTS book_genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    genre TEXT NOT NULL,
    source TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
`);

// Helper function to safely add columns
const addColumn = (table: string, column: string, type: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      console.error(`Error adding column ${column} to ${table}:`, err.message);
    }
  }
};

// Add missing columns if needed
addColumn('user_preferences', 'current_obsession', 'TEXT');
addColumn('user_preferences', 'last_mood', 'TEXT');
addColumn('user_preferences', 'last_mood_updated', 'DATETIME');
addColumn('uploaded_books', 'file_size', 'INTEGER');
addColumn('uploaded_books', 'file_name', 'TEXT');

// Initialize default mood-genre learning data
const initMoodGenreLearning = () => {
  const defaultMappings = [
    { mood: '😊', genre: 'Contemporary Fiction', weight: 0.6 },
    { mood: '😊', genre: 'Humor', weight: 0.7 },
    { mood: '😢', genre: 'Literary Fiction', weight: 0.7 },
    { mood: '😢', genre: 'Memoir', weight: 0.6 },
    { mood: '😐', genre: 'Philosophy', weight: 0.6 },
    { mood: '😐', genre: 'Classics', weight: 0.5 },
    { mood: '❤️', genre: 'Romance', weight: 0.8 },
    { mood: '❤️', genre: 'Contemporary Romance', weight: 0.7 },
    { mood: '⚡', genre: 'Thriller', weight: 0.7 },
    { mood: '⚡', genre: 'Mystery', weight: 0.6 },
    { mood: '☕', genre: 'Cozy Mystery', weight: 0.7 },
    { mood: '☕', genre: 'Slice of Life', weight: 0.6 },
    { mood: '🤔', genre: 'Science Fiction', weight: 0.6 },
    { mood: '🤔', genre: 'Philosophical Fiction', weight: 0.7 },
    { mood: '🎉', genre: 'Adventure', weight: 0.6 },
    { mood: '🎉', genre: 'Fantasy', weight: 0.6 },
    { mood: '😴', genre: 'Light Reading', weight: 0.7 },
    { mood: '😴', genre: 'Short Stories', weight: 0.6 },
    { mood: '🤯', genre: 'Dark Fantasy', weight: 0.6 },
    { mood: '🤯', genre: 'Psychological Thriller', weight: 0.7 },
    { mood: '😍', genre: 'Dark Romance', weight: 0.8 },
    { mood: '😍', genre: 'Romantasy', weight: 0.7 },
    { mood: '🤗', genre: 'Inspirational', weight: 0.6 },
    { mood: '🤗', genre: 'Self-Help', weight: 0.5 }
  ];
  
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO mood_genre_learning (mood_emoji, genre, success_rate, total_recommendations)
    VALUES (?, ?, ?, 0)
  `);
  
  for (const mapping of defaultMappings) {
    insertStmt.run(mapping.mood, mapping.genre, mapping.weight);
  }
  
  console.log(' Mood-Genre learning matrix initialized');
};

initMoodGenreLearning();

export default db;
