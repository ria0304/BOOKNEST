import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Star, Brain, Sparkles, Compass, Plus, Check, Zap, Calendar, Lightbulb } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Link } from 'react-router-dom';

// Mood Picker Component (still used for mood logging, but the recommendation section is gone)
function MoodPicker({ onMoodSelect, currentMood }: { onMoodSelect: (mood: string) => void; currentMood?: string }) {
  const [selectedMood, setSelectedMood] = useState(currentMood || '');
  
  const moods = [
    { emoji: '😊', label: 'Happy', color: 'bg-yellow-500/20', hoverColor: 'hover:bg-yellow-500/30' },
    { emoji: '😢', label: 'Sad', color: 'bg-blue-500/20', hoverColor: 'hover:bg-blue-500/30' },
    { emoji: '😐', label: 'Neutral', color: 'bg-gray-500/20', hoverColor: 'hover:bg-gray-500/30' },
    { emoji: '❤️', label: 'Loved', color: 'bg-red-500/20', hoverColor: 'hover:bg-red-500/30' },
    { emoji: '⚡', label: 'Excited', color: 'bg-purple-500/20', hoverColor: 'hover:bg-purple-500/30' },
    { emoji: '☕', label: 'Cozy', color: 'bg-amber-500/20', hoverColor: 'hover:bg-amber-500/30' },
    { emoji: '🤔', label: 'Thoughtful', color: 'bg-indigo-500/20', hoverColor: 'hover:bg-indigo-500/30' },
    { emoji: '🎉', label: 'Celebratory', color: 'bg-pink-500/20', hoverColor: 'hover:bg-pink-500/30' },
    { emoji: '😴', label: 'Tired', color: 'bg-slate-500/20', hoverColor: 'hover:bg-slate-500/30' },
    { emoji: '🤯', label: 'Mind-blown', color: 'bg-orange-500/20', hoverColor: 'hover:bg-orange-500/30' },
    { emoji: '😍', label: 'Obsessed', color: 'bg-rose-500/20', hoverColor: 'hover:bg-rose-500/30' },
    { emoji: '🤗', label: 'Grateful', color: 'bg-teal-500/20', hoverColor: 'hover:bg-teal-500/30' },
  ];

  const handleMoodSelect = (emoji: string) => {
    setSelectedMood(emoji);
    onMoodSelect(emoji);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {moods.map((mood) => (
          <button
            key={mood.emoji}
            onClick={() => handleMoodSelect(mood.emoji)}
            className={`flex flex-col items-center p-3 rounded-xl transition-all transform hover:scale-105 ${
              selectedMood === mood.emoji
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-pink-500/25'
                : `${mood.color} ${mood.hoverColor} border border-purple-800/30`
            }`}
          >
            <span className="text-2xl mb-1">{mood.emoji}</span>
            <span className="text-xs font-medium">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Monthly Books Activity Calendar Component
function MonthlyBooksCalendar({ monthlyData, year, onYearChange }: { monthlyData: any[], year: number, onYearChange: (year: number) => void }) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const getIntensityColor = (booksCompleted: number) => {
    if (booksCompleted === 0) return 'bg-gray-800/30';
    if (booksCompleted === 1) return 'bg-green-900/50';
    if (booksCompleted === 2) return 'bg-green-700/60';
    if (booksCompleted === 3) return 'bg-green-500/70';
    return 'bg-green-400/90';
  };
  
  const getMonthData = (month: number) => {
    return monthlyData.find(m => m.month === month + 1) || {
      month: month + 1,
      books_completed: 0,
      vault_books_read: 0,
      total_books_read: 0,
      books_added: 0,
      reading_sessions: 0,
      reading_days: 0,
    };
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onYearChange(year - 1)}
            className="px-3 py-1 bg-purple-900/50 rounded-lg text-sm hover:bg-purple-800/70 transition-colors"
          >
            ← {year - 1}
          </button>
          <span className="text-xl font-bold text-white">{year}</span>
          <button
            onClick={() => onYearChange(year + 1)}
            className="px-3 py-1 bg-purple-900/50 rounded-lg text-sm hover:bg-purple-800/70 transition-colors"
          >
            {year + 1} →
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-800/30"></div>
            <div className="w-3 h-3 rounded-sm bg-green-900/50"></div>
            <div className="w-3 h-3 rounded-sm bg-green-700/60"></div>
            <div className="w-3 h-3 rounded-sm bg-green-500/70"></div>
            <div className="w-3 h-3 rounded-sm bg-green-400/90"></div>
          </div>
          <span>More books</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {monthNames.map((month, idx) => {
          const data = getMonthData(idx);
          const intensityColor = getIntensityColor(data.total_books_read || data.books_completed);
          const isHovered = hoveredMonth === idx;
          
          return (
            <div
              key={idx}
              className={`relative rounded-xl p-4 transition-all cursor-pointer transform hover:scale-105 ${
                intensityColor
              } border border-purple-800/30 hover:border-pink-500/50`}
              onMouseEnter={() => setHoveredMonth(idx)}
              onMouseLeave={() => setHoveredMonth(null)}
            >
              <h4 className="text-sm font-semibold text-white mb-2">{month}</h4>
              <div className="space-y-1">
                <p className="text-xl font-bold text-white">{data.total_books_read || data.books_completed}</p>
                <p className="text-xs text-gray-400">books read</p>
              </div>
              
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10 w-56 bg-gray-900 rounded-lg p-3 shadow-xl border border-purple-800/50">
                  <p className="text-xs font-semibold text-white mb-2">{month} {year}</p>
                  <div className="space-y-1 text-xs">
                    <p className="text-gray-300">✅ <span className="text-white font-medium">{data.books_completed}</span> library books</p>
                    <p className="text-gray-300">📁 <span className="text-white font-medium">{data.vault_books_read || 0}</span> vault books</p>
                    <p className="text-gray-300">➕ <span className="text-white font-medium">{data.books_added}</span> books added</p>
                    <p className="text-gray-300">📚 <span className="text-white font-medium">{data.reading_sessions}</span> reading sessions</p>
                    <p className="text-gray-300">📅 <span className="text-white font-medium">{data.reading_days}</span> days with reading</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <p className="text-xs text-gray-500 mt-6 text-center">
        Each card shows number of books completed per month (includes both library and vault). Hover to see detailed statistics.
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [drpa, setDrpa] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingObsession, setUpdatingObsession] = useState(false);
  const [addedBooks, setAddedBooks] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loggingMood, setLoggingMood] = useState(false);
  const [activityYear, setActivityYear] = useState<number>(new Date().getFullYear());

  const obsessionOptions = [
    'Dark Romance',
    'Dark Fantasy',
    'Cyberpunk',
    'Historical Fiction',
    'Sci-Fi Thriller',
    'Cozy Mystery',
    'Epic Fantasy',
    'Romantasy',
    'True Crime',
    'Literary Fiction',
    'Psychological Thriller',
    'Contemporary Romance',
    'Spicy Romance',
    'Gothic Horror',
    'Young Adult Fantasy',
    'Mystery'
  ];

  useEffect(() => {
    fetchData();
  }, [activityYear]);

  const fetchData = async () => {
    try {
      const [analyticsData, drpaData, monthlyActivity, aiData] = await Promise.all([
        apiFetch('/api/analytics'),
        apiFetch('/api/recommendations/drpa'),
        apiFetch(`/api/reading/monthly-books?year=${activityYear}`),
        apiFetch('/api/ai/suggestions')
      ]);
      setAnalytics(analyticsData);
      setDrpa(drpaData);
      setMonthlyData(monthlyActivity?.monthlyData || []);
      setMonthlySummary(monthlyActivity?.summary || null);
      setAiSuggestions(aiData?.suggestions || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleObsessionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newObsession = e.target.value;
    
    setUpdatingObsession(true);
    try {
      await apiFetch('/api/preferences/obsession', {
        method: 'PUT',
        body: JSON.stringify({ obsession: newObsession || null })
      });
      await fetchData();
    } catch (error) {
      console.error('Failed to update obsession', error);
    } finally {
      setUpdatingObsession(false);
    }
  };

  const logMood = async (mood: string) => {
    setLoggingMood(true);
    try {
      await apiFetch('/api/preferences/mood', {
        method: 'POST',
        body: JSON.stringify({ mood })
      });
      const analyticsData = await apiFetch('/api/analytics');
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to log mood', error);
    } finally {
      setLoggingMood(false);
    }
  };

  const addToLibrary = async (book: any) => {
    setErrorMsg(null);
    try {
      await apiFetch('/api/library', {
        method: 'POST',
        body: JSON.stringify({
          title: book.title,
          author: book.author || 'Unknown Author',
          cover_url: book.cover_url || '',
          open_library_id: book.key,
          status: 'want_to_read'
        })
      });
      setAddedBooks(prev => new Set(prev).add(book.key));
      setErrorMsg(`"${book.title}" added to your library!`);
      setTimeout(() => setErrorMsg(null), 3000);
    } catch (error: any) {
      console.error('Failed to add book', error);
      if (error.message.includes('Already in library')) {
        setErrorMsg(`"${book.title}" is already in your library!`);
      } else {
        setErrorMsg('Failed to add book. Please try again.');
      }
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  if (loading) return <div className="text-center py-20 text-pink-500">Loading insights...</div>;

  const totalBooks = analytics?.statusCounts?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0;
  const completedBooks = analytics?.statusCounts?.find((s: any) => s.status === 'completed')?.count || 0;
  const readingBooks = analytics?.statusCounts?.find((s: any) => s.status === 'reading')?.count || 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
          Reading Insights
        </h1>
        <p className="text-gray-400">Analyze your reading habits and moods</p>
      </div>

      {errorMsg && (
        <div className={`max-w-2xl mx-auto mb-6 px-4 py-3 rounded-lg text-center ${
          errorMsg.includes('added') 
            ? 'bg-green-900/50 border border-green-500/50 text-green-200'
            : 'bg-red-900/50 border border-red-500/50 text-red-200'
        }`}>
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-950/20 border border-purple-900/50 p-6 rounded-2xl flex items-center space-x-4"
        >
          <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Total Books</p>
            <h3 className="text-3xl font-bold text-white">{totalBooks}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-purple-950/20 border border-purple-900/50 p-6 rounded-2xl flex items-center space-x-4"
        >
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
            <Star className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Completed</p>
            <h3 className="text-3xl font-bold text-white">{completedBooks}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-purple-950/20 border border-purple-900/50 p-6 rounded-2xl flex items-center space-x-4"
        >
          <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Currently Reading</p>
            <h3 className="text-3xl font-bold text-white">{readingBooks}</h3>
          </div>
        </motion.div>
      </div>

      {/* AI-Powered Suggestions Section */}
      {aiSuggestions && aiSuggestions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.23 }}
          className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/50 p-8 rounded-2xl mb-12"
        >
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-amber-400" /> AI-Powered Suggestions
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiSuggestions.map((suggestion, idx) => {
              // Build search URL with appropriate type parameter
              let searchQuery = '';
              let searchType = 'all';
              if (suggestion.type === 'author') {
                searchQuery = suggestion.value || suggestion.title.replace('More by ', '');
                searchType = 'author';
              } else if (suggestion.type === 'genre') {
                searchQuery = suggestion.value || suggestion.title.replace('More ', '').replace(' Books', '');
                searchType = 'genre';
              } else if (suggestion.type === 'mood') {
                searchQuery = suggestion.value ? `${suggestion.value} books` : suggestion.title;
                searchType = 'genre';
              } else if (suggestion.type === 'obsession') {
                searchQuery = suggestion.value || suggestion.title.replace('More ', '');
                searchType = 'genre';
              } else {
                searchQuery = suggestion.title;
              }
              
              const params = new URLSearchParams();
              params.set('q', searchQuery);
              if (searchType !== 'all') params.set('type', searchType);
              const searchUrl = `/search?${params.toString()}`;
              
              return (
                <Link 
                  key={idx}
                  to={searchUrl}
                  className="bg-black/40 rounded-xl p-4 border border-purple-700/50 hover:border-pink-500/70 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{suggestion.icon}</span>
                    <h4 className="font-semibold text-white">{suggestion.title}</h4>
                  </div>
                  <p className="text-sm text-gray-300 mb-3">{suggestion.description}</p>
                  <div className="text-xs text-pink-400 group-hover:text-pink-300 transition-colors flex items-center gap-1">
                    <span>Explore {suggestion.type === 'author' ? 'more books by this author' : suggestion.type === 'genre' ? 'books in this genre' : 'related books'}</span>
                    <span>→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Monthly Books Activity Calendar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl mb-12"
      >
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-pink-400" /> Reading Activity by Month
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-black/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{monthlySummary?.totalBooksCompleted || 0}</p>
            <p className="text-xs text-gray-400">Library Books</p>
          </div>
          <div className="bg-black/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{monthlySummary?.totalVaultBooksRead || 0}</p>
            <p className="text-xs text-gray-400">Vault Books</p>
          </div>
          <div className="bg-black/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{monthlySummary?.totalBooksAdded || 0}</p>
            <p className="text-xs text-gray-400">Books Added</p>
          </div>
          <div className="bg-black/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{monthlySummary?.totalReadingSessions || 0}</p>
            <p className="text-xs text-gray-400">Reading Sessions</p>
          </div>
          <div className="bg-black/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{monthlySummary?.totalReadingDays || 0}</p>
            <p className="text-xs text-gray-400">Days Read</p>
          </div>
          <div className="bg-black/30 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">
              {monthlySummary?.totalBooksCompleted > 0 ? Math.round((monthlySummary?.totalBooksCompleted || 0) / 12) : 0}
            </p>
            <p className="text-xs text-gray-400">Avg Books/Month</p>
          </div>
        </div>
        
        <MonthlyBooksCalendar 
          monthlyData={monthlyData} 
          year={activityYear}
          onYearChange={(year) => {
            setActivityYear(year);
            setLoading(true);
          }}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl"
        >
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <Brain className="w-5 h-5 mr-2 text-pink-400" /> Reader Personality
          </h3>
          <div className="flex items-center justify-center p-8 bg-black/30 rounded-xl border border-purple-800/30">
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-pulse" />
              <h4 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
                {drpa?.personality || 'The Explorer'}
              </h4>
              <p className="text-gray-400 mt-2 text-sm">Based on your reading behavior and preferences</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl relative"
        >
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-pink-400" /> Current Obsession
            </h3>
            <select 
              className="bg-black/50 border border-purple-800/50 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-pink-500"
              onChange={handleObsessionChange}
              disabled={updatingObsession}
              value={drpa?.preferences?.current_obsession || ''}
            >
              <option value="">Auto-detect</option>
              {obsessionOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-center p-8 bg-black/30 rounded-xl border border-purple-800/30 h-[200px]">
            <div className="text-center">
              <Compass className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h4 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-blue-500">
                {drpa?.obsession || 'Discovering new worlds'}
              </h4>
              <p className="text-gray-400 mt-2 text-sm">Your most frequent reading pattern</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl"
        >
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-pink-400" /> Reading Status
          </h3>
          
          <div className="space-y-4">
            {analytics?.statusCounts?.map((stat: any) => {
              const percentage = totalBooks > 0 ? (stat.count / totalBooks) * 100 : 0;
              const color = stat.status === 'completed' ? 'bg-green-500' : 
                            stat.status === 'reading' ? 'bg-amber-500' : 'bg-purple-500';
              
              return (
                <div key={stat.status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 capitalize">{stat.status.replace(/_/g, ' ')}</span>
                    <span className="text-gray-400">{stat.count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-purple-900/30 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
            {!analytics?.statusCounts?.length && <p className="text-gray-500 text-sm">No data available yet.</p>}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl"
        >
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-amber-400" /> Mood Tracker
          </h3>
          
          <div className="mb-8">
            <p className="text-sm text-gray-400 mb-3">How are you feeling today?</p>
            <MoodPicker onMoodSelect={logMood} />
            {loggingMood && (
              <p className="text-xs text-pink-400 mt-2 text-center">Logging your mood...</p>
            )}
          </div>
          
          <div>
            <p className="text-sm text-gray-400 mb-3">Your reading moods</p>
            <div className="flex flex-wrap gap-4">
              {analytics?.moodCounts?.map((mood: any) => (
                <div key={mood.mood} className="bg-purple-900/30 border border-purple-800/50 rounded-xl p-4 flex flex-col items-center justify-center min-w-[100px]">
                  <span className="text-4xl mb-2">{mood.mood}</span>
                  <span className="text-xl font-bold text-white">{mood.count}</span>
                  <span className="text-xs text-gray-400 uppercase tracking-wider mt-1">Books</span>
                </div>
              ))}
              {!analytics?.moodCounts?.length && (
                <p className="text-gray-500 text-sm">No mood data yet. Pick a mood above to get started!</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {drpa?.recommendations && drpa.recommendations.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl mb-12"
        >
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <Star className="w-5 h-5 mr-2 text-amber-400" /> DRPA Recommendations
          </h3>
          <p className="text-gray-400 mb-6 text-sm">Curated based on your current obsession: <span className="text-pink-400 font-medium">{drpa?.obsession}</span></p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {drpa.recommendations.map((book: any) => (
              <div key={book.key} className="group flex flex-col items-center relative">
                <div className="w-full aspect-[2/3] bg-black/50 rounded-lg overflow-hidden border border-purple-800/30 group-hover:border-pink-500/50 transition-colors mb-3 relative">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => addToLibrary(book)}
                      disabled={addedBooks.has(book.key)}
                      className="bg-pink-600 hover:bg-pink-500 text-white p-2 rounded-full transform hover:scale-110 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:bg-green-600"
                      title={addedBooks.has(book.key) ? "Added to Library" : "Add to Library"}
                    >
                      {addedBooks.has(book.key) ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <h4 className="text-sm font-medium text-white text-center line-clamp-2 group-hover:text-pink-400 transition-colors">{book.title}</h4>
                <p className="text-xs text-gray-400 text-center line-clamp-1">{book.author}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
