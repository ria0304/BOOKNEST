import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Search, Library, Archive, LayoutDashboard, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Discover', path: '/search', icon: Search },
    { name: 'Library', path: '/library', icon: Library },
    { name: 'Vault', path: '/vault', icon: Archive },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Me', path: '/profile', icon: User },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-purple-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 group">
              <BookOpen className="h-8 w-8 text-pink-500 group-hover:text-pink-400 transition-colors" />
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                Booknest
              </span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'text-pink-400 bg-purple-900/30 shadow-[0_0_15px_rgba(236,72,153,0.15)]' 
                      : 'text-gray-300 hover:text-white hover:bg-purple-900/20'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
            <button
              onClick={logout}
              className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
