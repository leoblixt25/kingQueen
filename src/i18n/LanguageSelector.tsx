/**
 * Compact language selector (🌐) for the public pages.
 *
 * Visually minimal and self-contained: it renders in a corner, touches no
 * navigation and no tournament data, and only swaps rendered text.
 */
import { Globe, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LANGUAGES, useLanguage } from './LanguageContext';

type Props = {
  className?: string;
};

export default function LanguageSelector({ className = '' }: Props) {
  const { lang, setLang, t } = useLanguage();
  const active = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('language.change')}
        title={t('language.change')}
        className={
          'inline-flex h-9 w-9 items-center justify-center rounded-full border border-sand-dark/30 ' +
          'bg-white/70 text-foreground/70 shadow-sm backdrop-blur-sm transition-colors ' +
          'hover:bg-white hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ocean/50 ' +
          'disabled:pointer-events-none ' +
          className
        }
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[9.5rem]">
        {LANGUAGES.map((option) => (
          <DropdownMenuItem
            key={option.code}
            onSelect={() => setLang(option.code)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span aria-hidden="true">{option.flag}</span>
            <span className="flex-1">{option.label}</span>
            {option.code === active.code && <Check className="h-4 w-4 text-ocean" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}