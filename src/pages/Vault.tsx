import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Download, Trash2, Archive, X, BookOpen, AlertCircle, Clock, Smile } from 'lucide-react';
import { apiFetch } from '../lib/api';
import ePub from 'epubjs';

interface UploadedBook {
  id: number;
  title: string;
  file_url: string;
  file_size?: number;
  file_name?: string;
  created_at: string;
}

export default function Vault() {
  const [books, setBooks] = useState<UploadedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeBook, setActiveBook] = useState<UploadedBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [pagesRead, setPagesRead] = useState(0);
  const [readingMood, setReadingMood] = useState<string | null>(null);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const epubContainerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);

  useEffect(() => {
    fetchVault();
  }, []);

  useEffect(() => {
    if (activeBook && activeBook.file_url.endsWith('.epub') && epubContainerRef.current) {
      try {
        const book = ePub(activeBook.file_url);
        const rendition = book.renderTo(epubContainerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none'
        });
        rendition.display();
        renditionRef.current = rendition;

        return () => {
          if (renditionRef.current) {
            renditionRef.current.destroy();
          }
          book.destroy();
        };
      } catch (err) {
        console.error('Error rendering EPUB:', err);
        setError('Failed to load EPUB file');
      }
    }
  }, [activeBook]);

  const nextEpubPage = () => {
    if (renditionRef.current) renditionRef.current.next();
  };

  const prevEpubPage = () => {
    if (renditionRef.current) renditionRef.current.prev();
  };

  const fetchVault = async () => {
    try {
      const data = await apiFetch('/api/vault');
      setBooks(data);
    } catch (error) {
      console.error('Failed to fetch vault', error);
      setError('Failed to load your vault');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const startReadingSession = async (book: UploadedBook, moodBefore?: string) => {
    try {
      const response = await apiFetch('/api/reading/session/start', {
        method: 'POST',
        body: JSON.stringify({
          uploaded_book_id: book.id,
          mood_before: moodBefore,
          device_type: 'web'
        })
      });
      
      if (response.success) {
        setCurrentSessionId(response.session_id);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const endReadingSession = async (moodAfter?: string) => {
    if (!currentSessionId) return;
    
    try {
      await apiFetch('/api/reading/session/end', {
        method: 'POST',
        body: JSON.stringify({
          session_id: currentSessionId,
          pages_read: pagesRead,
          mood_after: moodAfter
        })
      });
      
      setCurrentSessionId(null);
      setPagesRead(0);
      setSuccessMsg('Reading session saved!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const isEpub = file.name.toLowerCase().endsWith('.epub');
    if (!isPdf && !isEpub) {
      setError('Only PDF and EPUB files are supported.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setSuccessMsg(null);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ""));

    try {
      const token = localStorage.getItem('token');
      
      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            setUploadProgress(progress);
          }
        });
        
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('Upload failed'));
        
        xhr.open('POST', '/api/vault/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      
      const newBook = await uploadPromise;
      setBooks([newBook as UploadedBook, ...books]);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      setSuccessMsg('Book uploaded successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error) {
      console.error('Upload error', error);
      setError('Failed to upload book. Please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeBook = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}" from your vault? This action cannot be undone.`)) return;
    
    try {
      await apiFetch(`/api/vault/${id}`, { method: 'DELETE' });
      setBooks(books.filter(b => b.id !== id));
      setSuccessMsg(`"${title}" has been removed from your vault.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error) {
      console.error('Failed to remove book', error);
      setError('Failed to delete book. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const getFileIcon = (fileName?: string) => {
    if (!fileName) return <FileText className="w-8 h-8 text-pink-400" />;
    if (fileName.toLowerCase().endsWith('.pdf')) {
      return <FileText className="w-8 h-8 text-red-400" />;
    }
    if (fileName.toLowerCase().endsWith('.epub')) {
      return <BookOpen className="w-8 h-8 text-blue-400" />;
    }
    return <FileText className="w-8 h-8 text-pink-400" />;
  };

  const moods = ['😊', '😢', '😐', '❤️', '⚡', '☕', '🤔', '🎉', '😴', '🤯', '😍', '🤗'];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-2 flex items-center">
            <Archive className="w-8 h-8 mr-3 text-pink-500" /> Personal Vault
          </h1>
          <p className="text-gray-400">Securely store and read your personal EPUBs and PDFs</p>
          <p className="text-xs text-gray-500 mt-1">Files are stored permanently until you delete them</p>
        </div>
        
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            accept=".pdf,.epub" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50"
          >
            <Upload className="w-5 h-5" />
            <span>{uploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Book'}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 bg-green-900/50 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg text-center">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20 bg-purple-950/10 rounded-2xl border border-purple-900/30 border-dashed">
          <Archive className="w-16 h-16 text-purple-800 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">Your vault is empty</h3>
          <p className="text-gray-500 mb-6">Upload your personal EPUB and PDF files to keep them safe and accessible anywhere.</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-pink-500/25"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Your First Book</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {books.map((book, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={book.id}
              className="bg-purple-950/20 border border-purple-900/50 rounded-xl p-6 hover:border-pink-500/50 transition-all group relative flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {getFileIcon(book.file_name)}
              </div>
              
              <h3 className="font-semibold text-white line-clamp-2 mb-2 w-full" title={book.title}>
                {book.title}
              </h3>
              
              <div className="text-xs text-gray-500 mb-2">
                {book.file_name && (
                  <span className="block truncate max-w-full">
                    {book.file_name.length > 30 ? `${book.file_name.substring(0, 27)}...` : book.file_name}
                  </span>
                )}
                {book.file_size && (
                  <span className="flex items-center justify-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {formatFileSize(book.file_size)}
                  </span>
                )}
              </div>
              
              <p className="text-xs text-gray-500 mb-6 mt-auto">
                Added {new Date(book.created_at).toLocaleDateString()}
              </p>
              
              <div className="flex space-x-2 w-full">
                <button 
                  onClick={() => setActiveBook(book)}
                  className="flex-1 bg-pink-600/20 hover:bg-pink-600/40 text-pink-400 text-sm font-medium py-2 rounded-lg flex items-center justify-center transition-colors border border-pink-500/30"
                >
                  <BookOpen className="w-4 h-4 mr-1" /> Read
                </button>
                <a 
                  href={book.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-purple-900/30 hover:bg-purple-800/50 text-purple-400 rounded-lg transition-colors border border-purple-500/30"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button 
                  onClick={() => removeBook(book.id, book.title)}
                  className="p-2 bg-red-900/20 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors border border-red-500/30"
                  title="Delete from vault"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Reader Modal with Session Tracking */}
      <AnimatePresence>
        {activeBook && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
          >
            <div className="w-full h-full max-w-6xl bg-gray-900 rounded-2xl overflow-hidden flex flex-col border border-purple-900/50 shadow-2xl">
              <div className="flex justify-between items-center p-4 bg-gray-950 border-b border-purple-900/50">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white truncate pr-4">{activeBook.title}</h3>
                  {activeBook.file_name && (
                    <p className="text-xs text-gray-500">{activeBook.file_name}</p>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  {/* Mood Picker */}
                  <div className="relative">
                    <button
                      onClick={() => setShowMoodPicker(!showMoodPicker)}
                      className="flex items-center gap-1 px-2 py-1 bg-purple-900/50 rounded-lg text-xs hover:bg-purple-800 transition-colors"
                    >
                      <Smile className="w-4 h-4" />
                      {readingMood || 'Mood'}
                    </button>
                    {showMoodPicker && (
                      <div className="absolute top-full right-0 mt-2 bg-gray-800 rounded-lg p-2 z-10 flex gap-1">
                        {moods.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => {
                              setReadingMood(emoji);
                              setShowMoodPicker(false);
                              startReadingSession(activeBook, emoji);
                            }}
                            className="text-xl hover:scale-110 transition-transform p-1"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Page Counter */}
                  {currentSessionId && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Pages:</span>
                      <input
                        type="number"
                        value={pagesRead}
                        onChange={(e) => setPagesRead(parseInt(e.target.value) || 0)}
                        className="w-16 bg-black/50 border border-purple-900/50 rounded px-2 py-1 text-white text-xs"
                        min="0"
                      />
                    </div>
                  )}
                  
                  {/* End Session Button */}
                  {currentSessionId && (
                    <button
                      onClick={() => {
                        const moodAfter = prompt('How do you feel after reading?', readingMood || '');
                        endReadingSession(moodAfter || undefined);
                      }}
                      className="text-xs bg-red-900/50 text-white px-2 py-1 rounded hover:bg-red-800 transition-colors"
                    >
                      End Session
                    </button>
                  )}
                  
                  {activeBook.file_url.endsWith('.epub') && (
                    <div className="flex space-x-2">
                      <button onClick={prevEpubPage} className="px-3 py-1 bg-purple-900/50 text-white rounded hover:bg-purple-800 transition-colors">Prev</button>
                      <button onClick={nextEpubPage} className="px-3 py-1 bg-purple-900/50 text-white rounded hover:bg-purple-800 transition-colors">Next</button>
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      if (currentSessionId) {
                        endReadingSession(readingMood || undefined);
                      }
                      setActiveBook(null);
                      setShowMoodPicker(false);
                    }}
                    className="p-2 bg-red-900/20 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 relative bg-white overflow-hidden">
                {activeBook.file_url.endsWith('.pdf') ? (
                  <iframe 
                    src={activeBook.file_url} 
                    className="w-full h-full border-none"
                    title={activeBook.title}
                  />
                ) : activeBook.file_url.endsWith('.epub') ? (
                  <div ref={epubContainerRef} className="w-full h-full absolute inset-0 text-black"></div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Unsupported format for in-app reading.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
