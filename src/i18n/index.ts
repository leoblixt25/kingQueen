export { en } from './en';
export { es } from './es';
export {
  DEFAULT_LANG,
  LANGUAGES,
  LanguageProvider,
  STORAGE_KEY,
  dictionaries,
  useLanguage,
  useTranslate,
} from './LanguageContext';
export type { Dictionary, Lang, TranslationKey, TranslateVars } from './LanguageContext';
export { default as LanguageSelector } from './LanguageSelector';