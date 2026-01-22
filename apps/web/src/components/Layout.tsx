import { useState, useEffect } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { OrganizationSwitcher, UserButton } from '@clerk/clerk-react';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import AssistantPanel from './AssistantPanel';
import LanguageSwitcher from './LanguageSwitcher';

export default function Layout() {
  const { t } = useTranslation();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const location = useLocation();
  const params = useParams();

  // Keyboard shortcut: Cmd+J to toggle assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setAssistantOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine context based on current route
  const getContext = () => {
    const path = location.pathname;

    if (path.startsWith('/deals/') && params.id) {
      return { type: 'deal' as const, id: params.id };
    }
    if (path === '/deals') {
      return { type: 'deals' as const };
    }
    if (path.startsWith('/contacts/') && params.id) {
      return { type: 'contact' as const, id: params.id };
    }
    if (path === '/contacts') {
      return { type: 'contacts' as const };
    }
    if (path.startsWith('/companies/') && params.id) {
      return { type: 'company' as const, id: params.id };
    }
    if (path === '/companies') {
      return { type: 'companies' as const };
    }
    if (path === '/tasks') {
      return { type: 'tasks' as const };
    }
    if (path === '/workboards') {
      return { type: 'workboards' as const };
    }
    if (path === '/') {
      return { type: 'dashboard' as const };
    }
    return { type: 'general' as const };
  };

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return t('common:nav.dashboard');
    if (path === '/contacts' || path.startsWith('/contacts/')) return t('common:nav.contacts');
    if (path === '/companies' || path.startsWith('/companies/')) return t('common:nav.companies');
    if (path === '/deals' || path.startsWith('/deals/')) return t('common:nav.pipeline');
    if (path === '/tasks') return t('common:nav.tasks');
    if (path === '/workboards' || path.startsWith('/workboards/')) return t('common:nav.workboards');
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
            <LanguageSwitcher />
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
                },
              }}
            />
          </div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>

      {/* Assistant Toggle Button */}
      <button
        onClick={() => setAssistantOpen(true)}
        className="fixed bottom-6 right-6 p-3 bg-text-primary text-white rounded-full shadow-lg hover:bg-primary-hover transition-all z-30 group"
        title={`${t('common:assistant.openTitle')} (⌘J)`}
      >
        <MessageSquare className="h-5 w-5" />
        <span className="absolute right-full mr-3 px-2 py-1 bg-text-primary text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          ⌘J
        </span>
      </button>

      <AssistantPanel
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        context={getContext()}
      />
      <CommandPalette />
    </div>
  );
}
