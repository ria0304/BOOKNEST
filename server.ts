import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';
import multer from 'multer';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-bookhaven';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(cors());
  app.use(express.json());

  // Setup uploads directory - Use a dedicated folder that won't sync with OneDrive
  // Option 1: Use project-relative uploads folder (won't sync if project is outside OneDrive)
  const uploadsDir = path.join(__dirname, 'uploads');
  
  // Option 2: Use system temp folder (but this may be cleaned by OS)
  // const uploadsDir = path.join(os.tmpdir(), 'book-haven-uploads');
  
  // Option 3: Use a folder outside OneDrive (adjust path as needed)
  // const uploadsDir = path.join('C:', 'BookHaven', 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  app.use('/uploads', express.static(uploadsDir));

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      // Keep original filename but add timestamp to avoid conflicts
      const timestamp = Date.now();
      const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueName = `${timestamp}-${cleanName}`;
      cb(null, uniqueName);
    }
  });
  
  const upload = multer({ 
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.pdf' || ext === '.epub') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF and EPUB files are allowed'));
      }
    }
  });

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  // Auth
  app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, name, gender, birthday } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare('INSERT INTO users (username, email, password, name, gender, birthday) VALUES (?, ?, ?, ?, ?, ?)');
      const info = stmt.run(username, email, hashedPassword, name, gender, birthday);
      const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET);
      res.json({ token, user: { id: info.lastInsertRowid, username, email, name, gender, birthday, onboarded: 0 } });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const user = stmt.get(email) as any;
      if (!user) return res.status(400).json({ error: 'User not found' });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, name: user.name, gender: user.gender, birthday: user.birthday, onboarded: user.onboarded } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    const stmt = db.prepare('SELECT id, username, email, name, gender, birthday, onboarded, created_at FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);
    res.json(user);
  });

  app.post('/api/auth/onboard', authenticateToken, (req: any, res) => {
    const { favorite_genres, reading_frequency, preferred_mood, favorite_types } = req.body;
    try {
      const stmt = db.prepare('INSERT OR REPLACE INTO user_preferences (user_id, favorite_genres, reading_frequency, preferred_mood, favorite_types) VALUES (?, ?, ?, ?, ?)');
      stmt.run(req.user.id, JSON.stringify(favorite_genres), reading_frequency, preferred_mood, JSON.stringify(favorite_types));
      
      const updateStmt = db.prepare('UPDATE users SET onboarded = 1 WHERE id = ?');
      updateStmt.run(req.user.id);
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/auth/me', authenticateToken, async (req: any, res) => {
    const { username, email, password, name, gender, birthday } = req.body;
    try {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare('UPDATE users SET username = ?, email = ?, password = ?, name = ?, gender = ?, birthday = ? WHERE id = ?');
        stmt.run(username, email, hashedPassword, name, gender, birthday, req.user.id);
      } else {
        const stmt = db.prepare('UPDATE users SET username = ?, email = ?, name = ?, gender = ?, birthday = ? WHERE id = ?');
        stmt.run(username, email, name, gender, birthday, req.user.id);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Books (Library)
  app.get('/api/library', authenticateToken, (req: any, res) => {
    const stmt = db.prepare(`
      SELECT ub.*, b.title, b.author, b.cover_url, b.open_library_id
      FROM user_books ub
      JOIN books b ON ub.book_id = b.id
      WHERE ub.user_id = ?
    `);
    const books = stmt.all(req.user.id);
    res.json(books);
  });

  app.post('/api/library', authenticateToken, (req: any, res) => {
    const { title, author, cover_url, open_library_id, status } = req.body;
    try {
      let bookStmt = db.prepare('SELECT id FROM books WHERE open_library_id = ?');
      let book = bookStmt.get(open_library_id) as any;
      
      if (!book) {
        const insertBook = db.prepare('INSERT INTO books (title, author, cover_url, open_library_id) VALUES (?, ?, ?, ?)');
        const info = insertBook.run(title, author, cover_url, open_library_id);
        book = { id: info.lastInsertRowid };
      }

      const checkStmt = db.prepare('SELECT id FROM user_books WHERE user_id = ? AND book_id = ?');
      const existing = checkStmt.get(req.user.id, book.id);
      if (existing) {
        return res.status(400).json({ error: 'Already in library' });
      }

      const insertUserBook = db.prepare('INSERT INTO user_books (user_id, book_id, status) VALUES (?, ?, ?)');
      insertUserBook.run(req.user.id, book.id, status || 'want_to_read');
      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Already in library' });
      }
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/library/:id', authenticateToken, (req: any, res) => {
    const { status, rating, notes, mood } = req.body;
    try {
      const stmt = db.prepare('UPDATE user_books SET status = ?, rating = ?, notes = ?, mood = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
      stmt.run(status, rating, notes, mood, req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/library/:id', authenticateToken, (req: any, res) => {
    try {
      const stmt = db.prepare('DELETE FROM user_books WHERE id = ? AND user_id = ?');
      stmt.run(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Vault (Uploads)
  app.post('/api/vault/upload', authenticateToken, upload.single('file'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { title } = req.body;
    const fileUrl = `/uploads/${req.file.filename}`;
    
    try {
      const stmt = db.prepare('INSERT INTO uploaded_books (user_id, title, file_url, file_size, file_name) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(
        req.user.id, 
        title || req.file.originalname.replace(/\.[^/.]+$/, ""), 
        fileUrl,
        req.file.size,
        req.file.originalname
      );
      res.json({ 
        id: info.lastInsertRowid, 
        title: title || req.file.originalname.replace(/\.[^/.]+$/, ""),
        file_url: fileUrl,
        file_size: req.file.size,
        file_name: req.file.originalname
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/vault', authenticateToken, (req: any, res) => {
    const stmt = db.prepare('SELECT * FROM uploaded_books WHERE user_id = ? ORDER BY created_at DESC');
    const books = stmt.all(req.user.id);
    res.json(books);
  });

  app.delete('/api/vault/:id', authenticateToken, (req: any, res) => {
    try {
      // First get the file path to delete the actual file
      const getStmt = db.prepare('SELECT file_url FROM uploaded_books WHERE id = ? AND user_id = ?');
      const book = getStmt.get(req.params.id, req.user.id) as any;
      
      if (book) {
        // Delete the actual file from uploads folder
        const filePath = path.join(uploadsDir, path.basename(book.file_url));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      // Delete from database
      const stmt = db.prepare('DELETE FROM uploaded_books WHERE id = ? AND user_id = ?');
      stmt.run(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/preferences/obsession', authenticateToken, (req: any, res) => {
    const { obsession } = req.body;
    try {
      const checkStmt = db.prepare('SELECT user_id FROM user_preferences WHERE user_id = ?');
      if (!checkStmt.get(req.user.id)) {
        db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(req.user.id);
      }
      
      const stmt = db.prepare('UPDATE user_preferences SET current_obsession = ? WHERE user_id = ?');
      stmt.run(obsession, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/preferences/mood', authenticateToken, (req: any, res) => {
    const { mood } = req.body;
    try {
      const checkStmt = db.prepare('SELECT user_id FROM user_preferences WHERE user_id = ?');
      if (!checkStmt.get(req.user.id)) {
        db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(req.user.id);
      }
      
      const stmt = db.prepare('UPDATE user_preferences SET last_mood = ?, last_mood_updated = CURRENT_TIMESTAMP WHERE user_id = ?');
      stmt.run(mood, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Analytics
  app.get('/api/analytics', authenticateToken, (req: any, res) => {
    try {
      const stmt = db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM user_books 
        WHERE user_id = ? 
        GROUP BY status
      `);
      const statusCounts = stmt.all(req.user.id);
      
      const moodStmt = db.prepare(`
        SELECT mood, COUNT(*) as count 
        FROM user_books 
        WHERE user_id = ? AND mood IS NOT NULL 
        GROUP BY mood
      `);
      const moodCounts = moodStmt.all(req.user.id);

      res.json({ statusCounts, moodCounts });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DRPA & Recommendations
  app.get('/api/recommendations/drpa', authenticateToken, async (req: any, res) => {
    try {
      const prefStmt = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?');
      const prefs = prefStmt.get(req.user.id) as any;
      
      const historyStmt = db.prepare(`
        SELECT b.title, b.author, ub.rating, ub.mood 
        FROM user_books ub
        JOIN books b ON ub.book_id = b.id
        WHERE ub.user_id = ? AND ub.status = 'completed'
        ORDER BY ub.updated_at DESC LIMIT 20
      `);
      const history = historyStmt.all(req.user.id) as any[];

      let obsession = prefs?.current_obsession || 'Exploring';
      if (!prefs?.current_obsession) {
        if (history.length > 0) {
          const authorCounts: Record<string, number> = {};
          history.forEach(h => {
            if (h.author) {
              authorCounts[h.author] = (authorCounts[h.author] || 0) + 1;
            }
          });
          const topAuthor = Object.keys(authorCounts).sort((a, b) => authorCounts[b] - authorCounts[a])[0];
          if (topAuthor && authorCounts[topAuthor] > 1) {
            obsession = `Obsessed with ${topAuthor}`;
          } else if (prefs && prefs.favorite_genres) {
            const genres = JSON.parse(prefs.favorite_genres);
            if (genres.length > 0) obsession = `Bingeing ${genres[0]}`;
          }
        } else if (prefs && prefs.favorite_genres) {
          const genres = JSON.parse(prefs.favorite_genres);
          if (genres.length > 0) obsession = `Craving ${genres[0]}`;
        }
      }

      let personality = 'The Newcomer';
      if (history.length > 10) personality = 'The Voracious Reader';
      else if (history.length > 5) personality = 'The Steady Scholar';
      else if (prefs && prefs.reading_frequency === 'Daily') personality = 'The Daily Devourer';
      else if (prefs && prefs.preferred_mood === 'Thought-provoking') personality = 'The Deep Thinker';

      let searchQuery = 'bestselling fiction 2024 2025';
      
      const obsessionMap: Record<string, string> = {
        'Dark Romance': 'dark romance bestselling books 2024 2025 haunting adeline cat and mouse duet',
        'Romantasy': 'romantasy fantasy romance bestsellers 2024 sarah j maas fourth wing',
        'Dark Fantasy': 'dark fantasy grimdark books bestsellers 2024 joe abercrombie',
        'Cyberpunk': 'cyberpunk science fiction bestsellers 2024 william gibson neuromancer',
        'Historical Fiction': 'historical fiction award winning books 2024',
        'Sci-Fi Thriller': 'science fiction thriller bestsellers 2024 blake crouch',
        'Cozy Mystery': 'cozy mystery books bestsellers 2024',
        'Epic Fantasy': 'epic fantasy bestsellers 2024 brandon sanderson',
        'True Crime': 'true crime bestselling books 2024',
        'Literary Fiction': 'literary fiction award winning books 2024',
        'Psychological Thriller': 'psychological thriller bestsellers 2024 freida mcfadden',
        'Contemporary Romance': 'contemporary romance bestsellers 2024 emily henry',
        'Spicy Romance': 'spicy romance steamy books bestsellers 2024',
        'Gothic Horror': 'gothic horror books bestsellers 2024',
        'Young Adult Fantasy': 'young adult fantasy bestsellers 2024',
        'Mystery': 'mystery thriller bestsellers 2024'
      };
      
      if (prefs?.current_obsession && obsessionMap[prefs.current_obsession]) {
        searchQuery = obsessionMap[prefs.current_obsession];
      } else if (prefs?.current_obsession) {
        searchQuery = `${prefs.current_obsession} bestselling books 2024`;
      } else if (prefs && prefs.favorite_genres) {
        const genres = JSON.parse(prefs.favorite_genres);
        if (genres.length > 0) {
          const genreMap: Record<string, string> = {
            'Fantasy': 'epic fantasy bestsellers 2024',
            'Sci-Fi': 'science fiction bestsellers 2024',
            'Romance': 'romance novels bestsellers 2024',
            'Thriller': 'thriller suspense bestsellers 2024',
            'Mystery': 'mystery books bestsellers 2024',
            'Horror': 'horror books bestsellers 2024 stephen king',
            'Non-Fiction': 'bestselling non-fiction 2024',
            'Historical': 'historical fiction bestsellers 2024',
            'Biography': 'bestselling biographies 2024'
          };
          searchQuery = genreMap[genres[0]] || `${genres[0]} bestselling books 2024`;
        }
      }
      
      let recommendations = [];
      try {
        const response = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=8&orderBy=relevance`
        );
        const data = await response.json();
        
        recommendations = (data.items || [])
          .map((item: any) => ({
            key: item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Unknown',
            cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
            description: item.volumeInfo.description || ''
          }))
          .filter((book: any) => book.title && book.author !== 'Unknown' && book.title.length > 3)
          .slice(0, 6);
          
        if (recommendations.length === 0) {
          const fallbackResponse = await fetch(
            'https://www.googleapis.com/books/v1/volumes?q=bestselling%20fiction%202024&maxResults=6'
          );
          const fallbackData = await fallbackResponse.json();
          recommendations = (fallbackData.items || []).map((item: any) => ({
            key: item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Unknown',
            cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null
          }));
        }
      } catch (e) {
        console.error('Failed to fetch recommendations', e);
      }

      res.json({
        obsession,
        personality,
        recommendations,
        preferences: prefs ? {
          genres: JSON.parse(prefs.favorite_genres || '[]'),
          mood: prefs.preferred_mood,
          frequency: prefs.reading_frequency
        } : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mood-based Recommendations
  app.get('/api/recommendations/mood', authenticateToken, async (req: any, res) => {
    try {
      const { mood } = req.query;
      let targetMood = mood;

      if (!targetMood) {
        const stmt = db.prepare(`
          SELECT mood FROM user_books 
          WHERE user_id = ? AND mood IS NOT NULL 
          ORDER BY updated_at DESC LIMIT 1
        `);
        const recentMood = stmt.get(req.user.id) as any;
        if (recentMood) {
          targetMood = recentMood.mood;
        }
      }

      if (!targetMood) {
        return res.json({ mood: null, recommendations: [] });
      }

      const moodMap: Record<string, string> = {
        '😊': 'feel good uplifting bestselling books 2024',
        '😢': 'emotional moving literary fiction bestsellers 2024',
        '😐': 'contemporary fiction award winning books',
        '❤️': 'romance novels bestsellers 2024',
        '⚡': 'thriller suspense bestselling books 2024',
        '☕': 'cozy mystery comfort reads bestsellers',
        '🤔': 'thought provoking philosophical fiction',
        '🎉': 'celebratory joyful books uplifting stories',
        '😴': 'light easy reading books',
        '🤯': 'mind blowing science fiction fantasy',
        '😍': 'addictive books unputdownable',
        '🤗': 'heartwarming feel good books'
      };

      const searchTerm = moodMap[targetMood as string] || `${targetMood} bestselling books 2024`;

      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchTerm)}&maxResults=6&orderBy=relevance`
      );
      const data = await response.json();
      
      const recommendations = (data.items || [])
        .map((item: any) => ({
          key: item.id,
          title: item.volumeInfo.title,
          author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Unknown',
          cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
          description: item.volumeInfo.description || ''
        }))
        .filter((book: any) => book.title && book.author !== 'Unknown');

      res.json({ mood: targetMood, recommendations });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Movies (TMDB)
  app.get('/api/movies/search', authenticateToken, async (req: any, res) => {
    const { title } = req.query;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) {
      return res.json({
        mock: true,
        results: [
          {
            id: 1,
            title: `${title} (Movie Adaptation)`,
            overview: `A cinematic adaptation of the popular book "${title}".`,
            vote_average: 7.5,
            release_date: '2023-01-01'
          }
        ]
      });
    }

    try {
      const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`);
      const data = await response.json();
      res.json({ results: data.results || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { port: PORT === 3000 ? 24678 : PORT + 21678 }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Uploads directory: ${uploadsDir}`);
  });
}

startServer();
