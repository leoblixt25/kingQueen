/**
 * Centralised translation layer.
 *
 * A tiny React context instead of an i18n dependency: it keeps the bundle
 * small and, because `es` is typed as `typeof en`, guarantees that no screen
 * can ship with a missing translation.
 *
 * This layer only ever affects rendered text. It never reads or writes
 * Firestore, so changing the language cannot alter tournament data.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { en } from './en';
import { es } from './es';

export type Lang = 'en' | 'es';

export type Dictionary = typeof en;
export type TranslateVars = Record<string, string | number>;

export const dictionaries: Record<Lang, Dictionary> = { en, es };

export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export const STORAGE_KEY = 'kq_lang';
export const DEFAULT_LANG: Lang = 'en';

/** Dot-separated paths of every leaf string in the dictionary. */
type Leaves<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
    }[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;

const isLang = (value: unknown): value is Lang => value === 'en' || value === 'es';

function readStoredLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLang(stored) ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function resolve(dictionary: Dictionary, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    dictionary
  );
  return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: TranslateVars) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((next: Lang) => {
    if (!isLang(next)) return;
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled: keep working for this session only.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey, vars?: TranslateVars) => {
      const template = resolve(dictionaries[lang], key) ?? resolve(dictionaries.en, key);
      // Falling back to the key makes a missing string obvious instead of blank.
      return template === undefined ? key : interpolate(template, vars);
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return context;
}

/** Convenience hook for components that only need the translate function. */
export function useTranslate() {
  return useLanguage().t;
}