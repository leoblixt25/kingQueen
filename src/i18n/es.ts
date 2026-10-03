/**
 * Spanish dictionary.
 *
 * Typed as `typeof en`, so a missing or misspelled key is a compile error
 * rather than a blank label at runtime.
 */
import type { en } from './en';

export const es: typeof en = {
  common: {
    loading: 'Cargando...',
    error: 'Algo ha salido mal',
    retry: 'Reintentar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    save: 'Guardar',
    saved: 'Guardado',
    close: 'Cerrar',
    back: 'Atrás',
    next: 'Siguiente',
    previous: 'Anterior',
    yes: 'Sí',
    no: 'No',
    submit: 'Enviar',
    optional: 'Opcional',
    search: 'Buscar',
    none: 'Ninguno',
    of: 'de',
    vs: 'VS',
    language: 'Idioma',
  },

  nav: {
    draw: 'Sorteo',
    ranking: 'Clasificación',
    player: 'Jugador',
    info: 'Info',
    admin: 'Admin',
    signIn: 'Iniciar sesión',
    signOut: 'Cerrar sesión',
    install: 'Instalar',
  },

  language: {
    english: 'English',
    spanish: 'Español',
    change: 'Cambiar idioma',
  },

  landing: {
    draw: 'Sorteo del Torneo',
    liveRanking: 'Clasificación en Vivo',
    player: 'Jugador',
    info: 'Info',
    admin: 'Admin',
    installApp: 'Instalar App',
    madeBy: 'Diseñado y creado por {name} con amor por el voley playa',
  },
};