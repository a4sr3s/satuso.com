import { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import AssistantPanel from './AssistantPanel';

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

export default function Layout() {
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

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <main className="pl-sidebar">
        <div className="p-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Assistant Toggle Button */}
      <button
        onClick={() => setAssistantOpen(true)}
        className="fixed bottom-6 right-6 p-3 bg-text-primary text-white rounded-full shadow-lg hover:bg-primary-hover transition-all z-30 group"
        title="Open Assistant (⌘J)"
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
