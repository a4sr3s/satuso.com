import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Users, Building2, DollarSign, CheckSquare, MessageSquare, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { searchApi } from '@/lib/api';

interface SearchResult {
  type: 'contact' | 'company' | 'deal' | 'activity';
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export default function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const quickActions = [
    { id: 'new-contact', label: t('common:quickActions.newContact'), icon: Users, action: '/contacts?new=true' },
    { id: 'new-company', label: t('common:quickActions.newCompany'), icon: Building2, action: '/companies?new=true' },
    { id: 'new-deal', label: t('common:quickActions.newDeal'), icon: DollarSign, action: '/deals?new=true' },
    { id: 'new-task', label: t('common:quickActions.newTask'), icon: CheckSquare, action: '/tasks?new=true' },
    { id: 'ai-chat', label: t('common:quickActions.aiChat'), icon: MessageSquare, action: '/ai' },
  ];

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const response = await searchApi.search(query);
        setResults(response.data);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(search, 200);
    return () => clearTimeout(debounce);
  }, [query]);

  type AllItemType = SearchResult | (typeof quickActions[0] & { type: 'action'; url: string });
  const allItems: AllItemType[] = query.length >= 2
    ? results
    : quickActions.map(a => ({ ...a, type: 'action' as const, url: a.action }));

  const handleSelect = (item: (typeof allItems)[0]) => {
    if ('action' in item) {
      navigate(item.action);
    } else {
      navigate(item.url);
      // Track recent
      searchApi.trackRecent({
        type: item.type,
        id: item.id,
        title: item.title,
        url: item.url,
      }).catch(() => {});
    }
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (allItems[selectedIndex]) {
          handleSelect(allItems[selectedIndex]);
        }
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'contact':
        return Users;
      case 'company':
        return Building2;
      case 'deal':
        return DollarSign;
      default:
        return Search;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={close}
      />

      {/* Palette */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50">
        <div className="bg-white rounded-lg shadow-2xl border border-border overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-5 w-5 text-text-muted" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('common:search.placeholder')}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-text-muted"
            />
            <kbd className="text-xs text-text-muted bg-surface px-1.5 py-0.5 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-text-muted">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto" />
              </div>
            ) : allItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-muted text-sm">
                {query.length >= 2 ? t('common:search.noResults') : t('common:search.startTyping')}
              </div>
            ) : (
              <div className="py-2">
                {query.length < 2 && (
                  <div className="px-3 py-1 text-xs font-medium text-text-muted uppercase">
                    {t('common:quickActions.title')}
                  </div>
                )}
                {allItems.map((item, index) => {
                  const isAction = 'icon' in item;
                  const Icon = isAction ? item.icon : getIcon(item.type);
                  const key = isAction ? item.id : item.id;
                  const label = isAction ? item.label : item.title;

                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(item)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-2 text-left',
                        index === selectedIndex ? 'bg-primary-light' : 'hover:bg-surface'
                      )}
                    >
                      <Icon className="h-4 w-4 text-text-muted" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">
                          {label}
                        </p>
                        {!isAction && item.subtitle && (
                          <p className="text-xs text-text-muted truncate">{item.subtitle}</p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-text-muted" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border bg-surface flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-border">↑↓</kbd>
              <span>{t('common:search.toNavigate')}</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-border">↵</kbd>
              <span>{t('common:search.toSelect')}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
