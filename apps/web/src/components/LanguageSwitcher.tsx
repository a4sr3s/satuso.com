import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { LANGUAGES, type LanguageCode } from '@/i18n/config';
import { useLocaleStore } from '@/stores/locale';

interface LanguageSwitcherProps {
  variant?: 'header' | 'settings';
}

export default function LanguageSwitcher({ variant = 'header' }: LanguageSwitcherProps) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLocaleStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
  };

  if (variant === 'settings') {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-primary">
          {t('settings:language.title')}
        </label>
        <p className="text-sm text-text-muted mb-3">
          {t('settings:language.description')}
        </p>
        <div className="flex gap-2">
          {Object.values(LANGUAGES).map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code as LanguageCode)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                language === lang.code
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-primary border-gray-200 hover:border-gray-300'
              )}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
              {language === lang.code && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
        title={t('common:language.title')}
      >
        <Globe className="h-4 w-4" />
        <span className="text-sm">{LANGUAGES[language].flag}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-border py-1 z-50">
          {Object.values(LANGUAGES).map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code as LanguageCode)}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                language === lang.code
                  ? 'bg-primary-light text-primary font-medium'
                  : 'text-text-primary hover:bg-surface'
              )}
            >
              <span>{lang.flag}</span>
              <span className="flex-1">{lang.name}</span>
              {language === lang.code && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
