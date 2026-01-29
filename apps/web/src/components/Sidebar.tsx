import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Users,
  Building2,
  DollarSign,
  CheckSquare,
  Settings,
  Search,
  ChevronRight,
  Table2,
  Sparkles,
  X,
} from 'lucide-react';

interface NavItemProps {
  item: { name: string; href: string; icon: React.ElementType };
  compact?: boolean;
  onClick?: () => void;
}

function NavItem({ item, compact = false, onClick }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === item.href ||
    (item.href !== '/' && location.pathname.startsWith(item.href));

  return (
    <NavLink
      to={item.href}
      onClick={onClick}
      className={clsx(
        'flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors group',
        isActive
          ? 'bg-gray-800 text-white font-medium'
          : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
      )}
    >
      <div className="flex items-center gap-2.5">
        <item.icon className={clsx('h-4 w-4', isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-400')} />
        <span>{item.name}</span>
      </div>
      {!compact && <ChevronRight className={clsx('h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity', isActive && 'opacity-100')} />}
    </NavLink>
  );
}

interface NavSectionProps {
  title?: string;
  items: { name: string; href: string; icon: React.ElementType }[];
  onItemClick?: () => void;
}

function NavSection({ title, items, onItemClick }: NavSectionProps) {
  return (
    <div className="space-y-1">
      {title && (
        <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
          {title}
        </div>
      )}
      {items.map((item) => (
        <NavItem key={item.name} item={item} onClick={onItemClick} />
      ))}
    </div>
  );
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { t } = useTranslation();

  const mainNav = [
    { name: t('common:nav.dashboard'), href: '/', icon: LayoutDashboard },
  ];

  const crmNav = [
    { name: t('common:nav.contacts'), href: '/contacts', icon: Users },
    { name: t('common:nav.companies'), href: '/companies', icon: Building2 },
    { name: t('common:nav.pipeline'), href: '/deals', icon: DollarSign },
    { name: t('common:nav.workboards'), href: '/workboards', icon: Table2 },
  ];

  const productivityNav = [
    { name: t('common:nav.tasks'), href: '/tasks', icon: CheckSquare },
    { name: 'AI Chat', href: '/ai', icon: Sparkles },
  ];

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed left-0 top-0 bottom-0 w-[280px] md:w-sidebar bg-gray-900 flex flex-col z-50',
          'transition-transform duration-300 ease-in-out',
          // Mobile: slide in/out
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo & Search */}
        <div className="p-4 space-y-4">
          {/* Logo row with close button on mobile */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 px-1">
              <img src="/icon.svg" alt="Satuso" className="h-8" />
              <span className="text-lg font-semibold text-white">Satuso</span>
            </div>
            {/* Close button - mobile only */}
            <button
              onClick={onClose}
              className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <button
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
              document.dispatchEvent(event);
              if (onClose) onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 hover:text-gray-300 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">{t('common:search.quickSearch')}</span>
            <kbd className="hidden sm:inline text-xs bg-gray-600 text-gray-200 px-1.5 py-0.5 rounded border border-gray-500 font-medium">⌘K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-6">
          <NavSection items={mainNav} onItemClick={handleNavClick} />

          <div className="border-t border-gray-800 pt-4">
            <NavSection title={t('common:sections.records')} items={crmNav} onItemClick={handleNavClick} />
          </div>

          <div className="border-t border-gray-800 pt-4">
            <NavSection title={t('common:sections.productivity')} items={productivityNav} onItemClick={handleNavClick} />
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-800 p-3">
          <NavItem
            item={{ name: t('common:nav.settings'), href: '/settings', icon: Settings }}
            compact
            onClick={handleNavClick}
          />
        </div>
      </aside>
    </>
  );
}
