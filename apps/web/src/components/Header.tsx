import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Plus, LogOut } from 'lucide-react';
import { useUser, useClerk, useOrganization } from '@clerk/clerk-react';
import Avatar from './ui/Avatar';

export default function Header() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { signOut } = useClerk();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    signOut(() => navigate('/sign-in'));
  };

  return (
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <button
          onClick={() => {
            // Open command palette
            const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
            document.dispatchEvent(event);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-muted bg-surface border border-border rounded-md hover:border-gray-300 transition-colors"
        >
          <Search className="h-4 w-4" />
          <span>Search or type a command...</span>
          <kbd className="ml-auto text-xs bg-white px-1.5 py-0.5 rounded border border-border">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Quick Add */}
        <div className="relative group">
          <button className="btn-primary px-3 py-2">
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
          <div className="absolute right-0 mt-1 w-48 bg-white border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
            <button
              onClick={() => navigate('/contacts?new=true')}
              className="w-full px-3 py-2 text-sm text-left hover:bg-surface"
            >
              New Contact
            </button>
            <button
              onClick={() => navigate('/companies?new=true')}
              className="w-full px-3 py-2 text-sm text-left hover:bg-surface"
            >
              New Company
            </button>
            <button
              onClick={() => navigate('/deals?new=true')}
              className="w-full px-3 py-2 text-sm text-left hover:bg-surface"
            >
              New Deal
            </button>
            <button
              onClick={() => navigate('/tasks?new=true')}
              className="w-full px-3 py-2 text-sm text-left hover:bg-surface"
            >
              New Task
            </button>
          </div>
        </div>

        {/* Notifications */}
        <button className="btn-icon relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        </button>

        {/* User Info & Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface transition-colors"
          >
            <Avatar name={user?.fullName || 'User'} size="sm" />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-text-primary leading-tight">{user?.fullName}</p>
              <p className="text-xs text-text-muted leading-tight">{organization?.name || 'Personal'}</p>
            </div>
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white border border-border rounded-lg shadow-lg z-20">
                <div className="px-3 py-3 border-b border-border">
                  <p className="text-sm font-medium text-text-primary">{user?.fullName}</p>
                  <p className="text-xs text-text-muted">{user?.primaryEmailAddress?.emailAddress}</p>
                  {organization && (
                    <p className="text-xs text-primary mt-1">{organization.name}</p>
                  )}
                </div>
                <div className="p-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-red-50 rounded-md transition-colors"
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
    </header>
  );
}
