import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser, useOrganization } from '@clerk/clerk-react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import NotificationsDropdown from './NotificationsDropdown';

export default function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { organization } = useOrganization();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return t('common:nav.dashboard');
    if (path === '/contacts' || path.startsWith('/contacts/')) return t('common:nav.contacts');
    if (path === '/companies' || path.startsWith('/companies/')) return t('common:nav.companies');
    if (path === '/deals' || path.startsWith('/deals/')) return t('common:nav.pipeline');
    if (path === '/tasks') return t('common:nav.tasks');
    if (path === '/workboards' || path.startsWith('/workboards/')) return t('common:nav.workboards');
    if (path === '/ai') return 'AI Chat';
    if (path === '/settings') return t('common:nav.settings');
    return '';
  };

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content - responsive padding */}
      <main className="md:pl-sidebar min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 h-14 md:h-12 border-b border-border bg-white flex items-center justify-between px-4 md:px-6">
          {/* Left side - hamburger + title */}
          <div className="flex items-center gap-3">
            {/* Hamburger menu - mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Mobile logo - shown only on mobile */}
            <div className="md:hidden flex items-center">
              <img src="/logo.svg" alt="Satuso" className="h-5" />
            </div>

            {/* Page title - hidden on mobile to save space */}
            <h1 className="hidden md:block text-sm font-medium text-text-primary">
              {getPageTitle()}
            </h1>
          </div>

          {/* Right side - notifications (desktop only) + user */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <NotificationsDropdown />
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface transition-colors"
            >
              {/* Hide org name on small mobile screens */}
              <span className="hidden sm:block text-sm font-medium text-text-primary">
                {organization?.name || 'Personal'}
              </span>
              {user?.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || 'User'}
                  className="w-8 h-8 md:w-7 md:h-7 rounded-full object-cover"
                />
              )}
            </button>
          </div>
        </header>

        {/* Page content - responsive padding */}
        <div className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}
