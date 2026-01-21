import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Search,
  Bell,
  Plus,
  LogOut,
  Home,
  Users,
  Building2,
  DollarSign,
  CheckSquare,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { useUser, useClerk } from '@clerk/clerk-react';
import Avatar from './ui/Avatar';

const mainNav = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Companies', href: '/companies', icon: Building2 },
  { name: 'Pipeline', href: '/deals', icon: DollarSign },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
];

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleLogout = () => {
    signOut(() => navigate('/sign-in'));
  };

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-border z-40">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-lg font-semibold text-text-primary hidden sm:block">Satuso</span>
          </NavLink>

          {/* Main Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {mainNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  isActive(item.href)
                    ? 'bg-primary-light text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: Search + Actions */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <button
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
              document.dispatchEvent(event);
            }}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted bg-surface border border-border rounded-lg hover:border-gray-300 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="hidden lg:inline">Search...</span>
            <kbd className="hidden lg:inline text-xs bg-white px-1.5 py-0.5 rounded border border-border ml-2">
              ⌘K
            </kbd>
          </button>

          {/* Quick Add */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </button>

            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white border border-border rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => { navigate('/contacts?new=true'); setShowAddMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface"
                  >
                    <Users className="h-4 w-4 text-text-muted" />
                    New Contact
                  </button>
                  <button
                    onClick={() => { navigate('/companies?new=true'); setShowAddMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface"
                  >
                    <Building2 className="h-4 w-4 text-text-muted" />
                    New Company
                  </button>
                  <button
                    onClick={() => { navigate('/deals?new=true'); setShowAddMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface"
                  >
                    <DollarSign className="h-4 w-4 text-text-muted" />
                    New Deal
                  </button>
                  <button
                    onClick={() => { navigate('/tasks?new=true'); setShowAddMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface"
                  >
                    <CheckSquare className="h-4 w-4 text-text-muted" />
                    New Task
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-surface transition-colors"
            >
              <Avatar name={user?.fullName || 'User'} size="sm" />
              <ChevronDown className="h-3 w-3 text-text-muted hidden sm:block" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-border rounded-lg shadow-lg z-20">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium text-text-primary">{user?.fullName}</p>
                    <p className="text-xs text-text-muted">{user?.primaryEmailAddress?.emailAddress}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface"
                    >
                      <Settings className="h-4 w-4 text-text-muted" />
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40">
        <nav className="flex items-center justify-around py-2">
          {mainNav.slice(0, 5).map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={clsx(
                'flex flex-col items-center gap-1 px-3 py-1 text-xs rounded-lg transition-colors',
                isActive(item.href)
                  ? 'text-primary'
                  : 'text-text-muted'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
