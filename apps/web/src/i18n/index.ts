import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { DEFAULT_LANGUAGE, STORAGE_KEY } from './config';

// English translations
import commonEn from './locales/en/common.json';
import dashboardEn from './locales/en/dashboard.json';
import contactsEn from './locales/en/contacts.json';
import companiesEn from './locales/en/companies.json';
import dealsEn from './locales/en/deals.json';
import tasksEn from './locales/en/tasks.json';
import workboardsEn from './locales/en/workboards.json';
import settingsEn from './locales/en/settings.json';
import authEn from './locales/en/auth.json';

// Spanish translations
import commonEs from './locales/es/common.json';
import dashboardEs from './locales/es/dashboard.json';
import contactsEs from './locales/es/contacts.json';
import companiesEs from './locales/es/companies.json';
import dealsEs from './locales/es/deals.json';
import tasksEs from './locales/es/tasks.json';
import workboardsEs from './locales/es/workboards.json';
import settingsEs from './locales/es/settings.json';
import authEs from './locales/es/auth.json';

const resources = {
  en: {
    common: commonEn,
    dashboard: dashboardEn,
    contacts: contactsEn,
    companies: companiesEn,
    deals: dealsEn,
    tasks: tasksEn,
    workboards: workboardsEn,
    settings: settingsEn,
    auth: authEn,
  },
  es: {
    common: commonEs,
    dashboard: dashboardEs,
    contacts: contactsEs,
    companies: companiesEs,
    deals: dealsEs,
    tasks: tasksEs,
    workboards: workboardsEs,
    settings: settingsEs,
    auth: authEs,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'common',
    ns: ['common', 'dashboard', 'contacts', 'companies', 'deals', 'tasks', 'workboards', 'settings', 'auth'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

export default i18n;
