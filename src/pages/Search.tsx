import React, { useState } from 'react';
import { Search as SearchIcon, Plus, Check, ExternalLink, BookOpen, X, Star, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../lib/api';

interface BookResult {
  key: string;
  title: string;
  author_name?: string[];
  cover_url?: string;
  first_sentence?: string[];
  source?: string;
  url?: string;
  description?: string;
  rating?: number;
  ratings_count?: number;
  published_date?: string;
  page_count?: number;
  categories?: string[];
  preview_link?: string;
  read_link?: string;
}

// Helper function to strip HTML tags
const stripHtml = (html: string): string => {
  if (!html) return '';
  
  // First, replace <br> and <br/> with newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n');
  
  // Replace </p> and <p> with newlines
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '');
  
  // Remove all other HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...');
  
  // Clean up extra whitespace and newlines
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.trim();
  
  return text;
};

// Helper function to detect English text
const isEnglishText = (text: string): boolean => {
  if (!text) return false;
  const englishPattern = /[a-zA-Z\s.,!?;:'"()\-]/g;
  const matches = text.match(englishPattern);
  const englishChars = matches ? matches.length : 0;
  const ratio = englishChars / text.length;
  return ratio > 0.6;
};

// Function to check if text is likely German or other non-English
const isNonEnglish = (text: string): boolean => {
  if (!text) return true;
  const germanPatterns = /[äöüßÄÖÜ]/;
  const frenchPatterns = /[éèêëàâçîïôûùÿÉÈÊËÀÂÇÎÏÔÛÙŸ]/;
  const spanishPatterns = /[áéíóúñÁÉÍÓÚÑ]/;
  
  if (germanPatterns.test(text)) return true;
  if (frenchPatterns.test(text)) return true;
  if (spanishPatterns.test(text)) return true;
  
  return false;
};

// Function to clean and get full description
const getFullDescription = (volumeInfo: any): string => {
  let description = '';
  
  if (volumeInfo.description) {
    description = volumeInfo.description;
  } else if (volumeInfo.subtitle) {
    description = volumeInfo.subtitle;
  }
  
  // Strip HTML tags
  description = stripHtml(description);
  
  return description;
};

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedBooks, setAddedBooks] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookResult | null>(null);
  const [bookDetails, setBookDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const searchBooks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    
    setLoading(true);
    setErrorMsg(null);
    try {
      const googleRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=15&orderBy=relevance`);
      const googleData = await googleRes.json();
      
      let combinedResults: BookResult[] = [];

      if (googleData.items) {
        const mapped = googleData.items.map((item: any) => {
          const volumeInfo = item.volumeInfo;
          let description = getFullDescription(volumeInfo);
          
          if (description && isNonEnglish(description)) {
            description = '';
          }
          
          if ((!description || description.length < 50) && volumeInfo.searchInfo?.textSnippet) {
            let snippet = volumeInfo.searchInfo.textSnippet;
            snippet = stripHtml(snippet);
            if (!isNonEnglish(snippet)) {
              description = snippet;
            }
          }
          
          return {
            key: item.id,
            title: volumeInfo.title,
            author_name: volumeInfo.authors || ['Unknown Author'],
            cover_url: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
            description: description,
            rating: volumeInfo.averageRating,
            ratings_count: volumeInfo.ratingsCount,
            published_date: volumeInfo.publishedDate,
            page_count: volumeInfo.pageCount,
            categories: volumeInfo.categories,
            preview_link: volumeInfo.previewLink,
            read_link: volumeInfo.infoLink,
            source: 'Google Books',
            url: `https://books.google.com/books?id=${item.id}`
          };
        });
        combinedResults = [...combinedResults, ...mapped];
      }
      
      try {
        const openLibRes = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`);
        const openLibData = await openLibRes.json();
        
        const openLibMapped = (openLibData.docs || []).map((doc: any) => {
          let firstSentence = doc.first_sentence?.[0] || '';
          if (firstSentence) {
            firstSentence = stripHtml(firstSentence);
            if (isNonEnglish(firstSentence) || !isEnglishText(firstSentence)) {
              firstSentence = '';
            }
          }
          return {
            key: doc.key,
            title: doc.title,
            author_name: doc.author_name || ['Unknown Author'],
            cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
            first_sentence: firstSentence ? [firstSentence] : undefined,
            published_date: doc.first_publish_year ? `${doc.first_publish_year}` : undefined,
            source: 'Open Library',
            url: `https://openlibrary.org${doc.key}`
          };
        });
        combinedResults = [...combinedResults, ...openLibMapped];
      } catch (e) {
        console.error('Open Library fetch failed', e);
      }
      
      const seenTitles = new Set();
      const deduplicated = combinedResults.filter(book => {
        const titleLower = book.title.toLowerCase();
        if (seenTitles.has(titleLower)) return false;
        seenTitles.add(titleLower);
        return true;
      });

      setResults(deduplicated);
    } catch (error) {
      console.error('Search failed', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookDetails = async (book: BookResult) => {
    setLoadingDetails(true);
    setSelectedBook(book);
    try {
      if (book.key && book.source === 'Google Books') {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${book.key}`);
        const data = await response.json();
        if (data.volumeInfo) {
          let fullDescription = getFullDescription(data.volumeInfo);
          
          if (!fullDescription || fullDescription.length < 100) {
            if (data.searchInfo?.textSnippet) {
              let snippet = data.searchInfo.textSnippet;
              snippet = stripHtml(snippet);
              if (!isNonEnglish(snippet)) {
                fullDescription = snippet;
              }
            }
          }
          
          setBookDetails({
            ...book,
            description: fullDescription || book.description || 'No description available.',
            rating: data.volumeInfo.averageRating || book.rating,
            ratings_count: data.volumeInfo.ratingsCount || book.ratings_count,
            published_date: data.volumeInfo.publishedDate || book.published_date,
            page_count: data.volumeInfo.pageCount,
            categories: data.volumeInfo.categories,
            preview_link: data.volumeInfo.previewLink,
            read_link: data.volumeInfo.infoLink,
            publisher: data.volumeInfo.publisher
          });
        } else {
          setBookDetails(book);
        }
      } else if (book.key && book.source === 'Open Library') {
        const workId = book.key.replace('/works/', '');
        const response = await fetch(`https://openlibrary.org/works/${workId}.json`);
        const data = await response.json();
        let description = '';
        if (data.description) {
          if (typeof data.description === 'string') {
            description = stripHtml(data.description);
          } else if (data.description.value) {
            description = stripHtml(data.description.value);
          }
        }
        setBookDetails({
          ...book,
          description: description || 'No description available.',
          published_date: data.created?.value ? new Date(data.created.value).getFullYear() : book.published_date,
          categories: data.subjects ? data.subjects.slice(0, 5) : []
        });
      } else {
        setBookDetails(book);
      }
    } catch (error) {
      console.error('Failed to fetch book details', error);
      setBookDetails(book);
    } finally {
      setLoadingDetails(false);
    }
  };

  const addToLibrary = async (book: BookResult) => {
    setErrorMsg(null);
    try {
      await apiFetch('/api/library', {
        method: 'POST',
        body: JSON.stringify({
          title: book.title,
          author: book.author_name?.[0] || 'Unknown Author',
          cover_url: book.cover_url || '',
          open_library_id: book.key,
          status: 'want_to_read'
        })
      });
      setAddedBooks(prev => new Set(prev).add(book.key));
    } catch (error: any) {
      console.error('Failed to add book', error);
      if (error.message.includes('Already in library')) {
        setErrorMsg(`"${book.title}" is already in your library!`);
      } else {
        setErrorMsg('Failed to add book. Please try again.');
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-4">
          Discover New Worlds
        </h1>
        <p className="text-gray-400">Search millions of books via Google Books & Open Library</p>
      </div>

      {errorMsg && (
        <div className="max-w-2xl mx-auto mb-6 bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-center">
          {errorMsg}
        </div>
      )}

      <form onSubmit={searchBooks} className="relative max-w-2xl mx-auto mb-12">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, author, or keyword..."
            className="relative w-full bg-black border border-purple-900/50 rounded-full py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
          />
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full font-medium hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {results.map((book, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={book.key}
            className="bg-purple-950/20 border border-purple-900/50 rounded-xl overflow-hidden hover:border-pink-500/50 transition-all group flex flex-col cursor-pointer"
            onClick={() => fetchBookDetails(book)}
          >
            <div className="aspect-[2/3] bg-purple-900/20 relative overflow-hidden">
              {book.cover_url ? (
                <img 
                  src={book.cover_url} 
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-purple-700">
                  <BookOpen className="w-12 h-12 opacity-50" />
                </div>
              )}
              
              {book.rating && (
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center space-x-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs text-white font-medium">{book.rating.toFixed(1)}</span>
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                <a 
                  href={book.url || `https://books.google.com/books?id=${book.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-white flex items-center hover:text-pink-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> View on {book.source || 'Google Books'}
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchBookDetails(book);
                  }}
                  className="text-xs bg-pink-600/80 hover:bg-pink-500 text-white px-2 py-1 rounded-lg flex items-center"
                >
                  <Info className="w-3 h-3 mr-1" /> Details
                </button>
              </div>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-semibold text-white line-clamp-2 mb-1">{book.title}</h3>
              <p className="text-sm text-gray-400 line-clamp-1 mb-2">
                {book.author_name?.[0] || 'Unknown Author'}
              </p>
              
              {book.published_date && (
                <p className="text-xs text-gray-500 mb-2">
                  {book.published_date.substring(0, 4)}
                </p>
              )}
              
              {book.description && (
                <p className="text-xs text-gray-500 line-clamp-3 mb-4 flex-1">
                  {book.description.length > 120 ? `${book.description.substring(0, 120)}...` : book.description}
                </p>
              )}
              {!book.description && book.first_sentence && book.first_sentence[0] && (
                <p className="text-xs text-gray-500 italic line-clamp-2 mb-4 flex-1">
                  "{book.first_sentence[0]}"
                </p>
              )}
              {!book.description && !book.first_sentence && (
                <div className="flex-1 mb-4"></div>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToLibrary(book);
                }}
                disabled={addedBooks.has(book.key)}
                className={`w-full py-2 rounded-lg flex items-center justify-center space-x-2 text-sm font-medium transition-all ${
                  addedBooks.has(book.key)
                    ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                    : 'bg-purple-900/30 text-pink-400 border border-purple-500/30 hover:bg-pink-600 hover:text-white hover:border-pink-500'
                }`}
              >
                {addedBooks.has(book.key) ? (
                  <><Check className="w-4 h-4" /> <span>Added</span></>
                ) : (
                  <><Plus className="w-4 h-4" /> <span>Add to Library</span></>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Book Details Modal */}
      <AnimatePresence>
        {selectedBook && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => {
              setSelectedBook(null);
              setBookDetails(null);
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-purple-900/50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {loadingDetails ? (
                <div className="flex items-center justify-center p-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
                </div>
              ) : bookDetails && (
                <>
                  <div className="relative">
                    <button
                      onClick={() => {
                        setSelectedBook(null);
                        setBookDetails(null);
                      }}
                      className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
                      <div className="md:col-span-1">
                        <div className="aspect-[2/3] rounded-xl overflow-hidden border border-purple-900/50 shadow-xl">
                          {bookDetails.cover_url ? (
                            <img 
                              src={bookDetails.cover_url.replace('zoom=1', 'zoom=2')} 
                              alt={bookDetails.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-purple-900/30 flex items-center justify-center">
                              <BookOpen className="w-16 h-16 text-purple-600" />
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-4 space-y-2">
                          <button
                            onClick={() => addToLibrary(bookDetails)}
                            disabled={addedBooks.has(bookDetails.key)}
                            className={`w-full py-2 rounded-lg flex items-center justify-center space-x-2 text-sm font-medium transition-all ${
                              addedBooks.has(bookDetails.key)
                                ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500'
                            }`}
                          >
                            {addedBooks.has(bookDetails.key) ? (
                              <><Check className="w-4 h-4" /> <span>Added to Library</span></>
                            ) : (
                              <><Plus className="w-4 h-4" /> <span>Add to My Library</span></>
                            )}
                          </button>
                          
                          {bookDetails.preview_link && (
                            <a
                              href={bookDetails.preview_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2 rounded-lg flex items-center justify-center space-x-2 text-sm font-medium bg-blue-900/30 text-blue-400 border border-blue-500/30 hover:bg-blue-800/50 transition-colors"
                            >
                              <BookOpen className="w-4 h-4" />
                              <span>Preview Book</span>
                            </a>
                          )}
                          
                          {bookDetails.read_link && (
                            <a
                              href={bookDetails.read_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2 rounded-lg flex items-center justify-center space-x-2 text-sm font-medium bg-amber-900/30 text-amber-400 border border-amber-500/30 hover:bg-amber-800/50 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span>More Info</span>
                            </a>
                          )}
                        </div>
                      </div>
                      
                      <div className="md:col-span-2 space-y-4">
                        <h2 className="text-2xl md:text-3xl font-bold text-white">{bookDetails.title}</h2>
                        <p className="text-lg text-gray-400">{bookDetails.author_name?.[0] || 'Unknown Author'}</p>
                        
                        {bookDetails.rating && (
                          <div className="flex items-center space-x-4 py-2">
                            <div className="flex items-center space-x-1">
                              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                              <span className="text-xl font-bold text-white">{bookDetails.rating.toFixed(1)}</span>
                              <span className="text-sm text-gray-400">/5</span>
                            </div>
                            {bookDetails.ratings_count && (
                              <span className="text-sm text-gray-400">({bookDetails.ratings_count.toLocaleString()} ratings)</span>
                            )}
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-3 text-sm">
                          {bookDetails.published_date && (
                            <span className="bg-purple-900/30 px-3 py-1 rounded-full text-gray-300">
                              📅 {bookDetails.published_date.substring(0, 4)}
                            </span>
                          )}
                          {bookDetails.page_count && (
                            <span className="bg-purple-900/30 px-3 py-1 rounded-full text-gray-300">
                              📄 {bookDetails.page_count} pages
                            </span>
                          )}
                          {bookDetails.publisher && (
                            <span className="bg-purple-900/30 px-3 py-1 rounded-full text-gray-300">
                              🏢 {bookDetails.publisher}
                            </span>
                          )}
                        </div>
                        
                        {bookDetails.categories && bookDetails.categories.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-400 mb-2">Genres</h3>
                            <div className="flex flex-wrap gap-2">
                              {bookDetails.categories.slice(0, 5).map((cat: string, idx: number) => (
                                <span key={idx} className="text-xs bg-pink-500/20 text-pink-300 px-2 py-1 rounded-full">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <h3 className="text-sm font-semibold text-gray-400 mb-2">Summary</h3>
                          <div className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap max-h-96 overflow-y-auto pr-2">
                            {bookDetails.description && bookDetails.description !== 'No description available.' ? (
                              <p>{bookDetails.description}</p>
                            ) : (
                              <p className="text-gray-500 italic">No summary available for this book.</p>
                            )}
                          </div>
                        </div>
                        
                        {bookDetails.first_sentence && bookDetails.first_sentence[0] && (
                          <div className="bg-purple-950/30 border-l-4 border-pink-500 p-4 rounded-r-lg">
                            <p className="text-gray-400 italic text-sm">
                              "{bookDetails.first_sentence[0]}"
                            </p>
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500 pt-4 border-t border-purple-900/50">
                          Source: {bookDetails.source || 'Google Books'}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
