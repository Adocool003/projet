import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import fr from './fr.js';
import en from './en.js';

const DICTS = { fr, en };
export const LANGUAGES = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
];

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? node : node[part]), dict);
}

function initialLang() {
  try {
    const saved = localStorage.getItem('amora_lang');
    if (saved && DICTS[saved]) return saved;
  } catch { /* stockage indisponible */ }
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  const setLang = useCallback((next) => {
    if (!DICTS[next]) return;
    setLangState(next);
    document.documentElement.lang = next;
    try { localStorage.setItem('amora_lang', next); } catch { /* ignoré */ }
  }, []);

  const t = useCallback((key, vars) => {
    let value = lookup(DICTS[lang], key) ?? lookup(fr, key) ?? key;
    if (typeof value === 'string' && vars) {
      value = value.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
    }
    return value;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
