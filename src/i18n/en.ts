/**
 * English dictionary — the single source of truth for all user-facing text.
 *
 * Keys are grouped by page/feature. `es.ts` is typed as `typeof en`, so the
 * build fails if any Spanish translation is missing, which makes a
 * half-translated screen impossible to ship.
 *
 * Rules:
 * - Only interface text lives here. Player names, team names, scores and any
 *   other user/tournament data are never translated.
 * - Use `{name}` placeholders for values injected at render time.
 */
export const en = {
  common: {
    loading: 'Loading...',
    error: 'Something went wrong',
    retry: 'Retry',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    saved: 'Saved',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    yes: 'Yes',
    no: 'No',
    submit: 'Submit',
    optional: 'Optional',
    search: 'Search',
    none: 'None',
    of: 'of',
    vs: 'VS',
    language: 'Language',
  },

  nav: {
    draw: 'Draw',
    ranking: 'Ranking',
    player: 'Player',
    info: 'Info',
    admin: 'Admin',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    install: 'Install',
  },

  language: {
    english: 'English',
    spanish: 'Español',
    change: 'Change language',
  },

  landing: {
    draw: 'Tournament Draw',
    liveRanking: 'Live Ranking',
    player: 'Player',
    info: 'Info',
    admin: 'Admin',
    installApp: 'Install App',
    madeBy: 'Designed and created by {name} with a love for beach volleyball',
  },
};