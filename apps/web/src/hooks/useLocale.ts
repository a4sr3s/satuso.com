import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format as formatDate, formatDistanceToNow as formatDistance } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

const dateLocales = {
  en: enUS,
  es: es,
};

export function useLocale() {
  const { i18n } = useTranslation();
  const language = i18n.language as 'en' | 'es';
  const dateLocale = dateLocales[language] || dateLocales.en;

  const formatters = useMemo(() => ({
    formatCurrency: (value: number, currency = 'USD') => {
      return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    },

    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', options).format(value);
    },

    formatPercent: (value: number) => {
      return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(value / 100);
    },

    formatDate: (date: Date | string, formatStr = 'PP') => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return formatDate(d, formatStr, { locale: dateLocale });
    },

    formatDistanceToNow: (date: Date | string, options?: { addSuffix?: boolean }) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return formatDistance(d, { ...options, locale: dateLocale });
    },

    formatRelativeDate: (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return formatDistance(d, { addSuffix: true, locale: dateLocale });
    },
  }), [language, dateLocale]);

  return {
    language,
    dateLocale,
    ...formatters,
  };
}
