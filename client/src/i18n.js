import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { th } from './locales/th.js';
import { en } from './locales/en.js';

const saved = (() => {
  try {
    return localStorage.getItem('andaman.lang');
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources: { th: { translation: th }, en: { translation: en } },
  lng: saved || 'th',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLang(lng) {
  i18n.changeLanguage(lng);
  try {
    localStorage.setItem('andaman.lang', lng);
  } catch {
    /* ignore */
  }
}

export default i18n;
