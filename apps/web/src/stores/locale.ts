import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/i18n';
import { STORAGE_KEY, type LanguageCode } from '@/i18n/config';

interface LocaleState {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      language: (i18n.language as LanguageCode) || 'en',
      setLanguage: (language: LanguageCode) => {
        i18n.changeLanguage(language);
        set({ language });
      },
    }),
    {
      name: STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state?.language) {
          i18n.changeLanguage(state.language);
        }
      },
    }
  )
);
