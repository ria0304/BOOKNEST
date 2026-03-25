import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Library, Archive, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-3xl"
      >
        <div className="inline-flex items-center space-x-2 bg-purple-900/30 border border-purple-500/30 rounded-full px-4 py-1.5 mb-8">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-pink-300">Welcome to your personalized reading sanctuary</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-amber-400">
            Discover. Track.
          </span>
          <br />
          <span className="text-white">Immerse.</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Link to="/search">
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-purple-950/20 border border-purple-800/50 p-6 rounded-2xl hover:border-pink-500/50 transition-all group"
            >
              <div className="bg-purple-900/50 w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:bg-pink-500/20">
                <Search className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Smart Finder</h3>
              <p className="text-sm text-gray-400">Search millions of books via Google Books and add them to your collection.</p>
            </motion.div>
          </Link>

          <Link to="/library">
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-purple-950/20 border border-purple-800/50 p-6 rounded-2xl hover:border-amber-500/50 transition-all group"
            >
              <div className="bg-purple-900/50 w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:bg-amber-500/20">
                <Library className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Personal Library</h3>
              <p className="text-sm text-gray-400">Track your reading progress, rate books, and log your emotional journey.</p>
            </motion.div>
          </Link>

          <Link to="/vault">
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-purple-950/20 border border-purple-800/50 p-6 rounded-2xl hover:border-purple-400/50 transition-all group"
            >
              <div className="bg-purple-900/50 w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:bg-purple-400/20">
                <Archive className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Book Vault</h3>
              <p className="text-sm text-gray-400">Upload your own EPUBs and PDFs to keep your entire collection in one place.</p>
            </motion.div>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
