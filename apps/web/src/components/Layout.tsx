import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser, useOrganization } from '@clerk/clerk-react';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import TrialBanner from './TrialBanner';

export default function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { organization } = useOrganization();

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
      <Sidebar />
      <main className="pl-sidebar">
        <TrialBanner />
        {/* Header */}
        <header className="h-12 border-b border-border bg-white flex items-center justify-between px-6">
          <h1 className="text-sm font-medium text-text-primary">{getPageTitle()}</h1>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface transition-colors"
          >
            <span className="text-sm font-medium text-text-primary">
              {organization?.name || 'Personal'}
            </span>
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt={user.fullName || 'User'}
                className="w-7 h-7 rounded-full object-cover"
              />
            )}
          </button>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
