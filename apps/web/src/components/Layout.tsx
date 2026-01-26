import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { OrganizationSwitcher, UserButton } from '@clerk/clerk-react';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';

export default function Layout() {
  const { t } = useTranslation();
  const location = useLocation();

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
        {/* Header */}
        <header className="h-12 border-b border-border bg-white flex items-center justify-between px-6">
          <h1 className="text-sm font-medium text-text-primary">{getPageTitle()}</h1>
          <div className="flex items-center gap-2">
            <OrganizationSwitcher
              hidePersonal
              afterCreateOrganizationUrl="/"
              afterSelectOrganizationUrl="/"
              appearance={{
                elements: {
                  rootBox: 'flex items-center',
                  organizationSwitcherTrigger: 'px-2 py-1 rounded-lg hover:bg-surface',
                  organizationPreviewAvatarBox: 'hidden',
                  organizationPreviewMainIdentifier: 'text-sm font-medium text-text-primary',
                  organizationSwitcherPopoverCard: 'shadow-lg border border-border',
                  organizationSwitcherPopoverFooter: 'hidden',
                  organizationSwitcherPopoverActionButton__manageOrganization: 'hidden',
                },
              }}
            />
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: 'w-7 h-7',
                  userButtonPopoverCard: 'shadow-lg border border-border',
                  userButtonPopoverFooter: 'hidden',
                  userButtonPopoverActionButton__manageAccount: 'hidden',
                },
              }}
            />
          </div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
