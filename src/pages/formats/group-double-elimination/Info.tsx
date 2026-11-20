import { useEffect, useState } from "react";
import { CalendarDays, GitBranch, Users } from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { gsdeHref, useGsdeTournament } from "./shared";
import { GsdePublicShell } from "./PublicShell";

type Language = "en" | "es";

type InfoSection = {
  title: string;
  emoji: string;
  content: string;
};

type InfoContent = {
  title: string;
  intro: string;
  labels: {
    teams: string;
    groupsOf: string;
    dateTbd: string;
  };
  sections: InfoSection[];
};

const CONTENT: Record<Language, InfoContent> = {
  en: {
    title: "Tournament Info",
    intro:
      "This tournament is played in teams of two across four groups, followed by a standard double-elimination bracket. Fair play, good energy and great beach volleyball. 🏖️🏐",
    labels: {
      teams: "teams",
      groupsOf: "groups of",
      dateTbd: "Date to be confirmed",
    },
    sections: [
      {
        title: "Teams and groups",
        emoji: "🏐",
        content:
          "16 teams are split into 4 groups of 4 by seed using a snake distribution. Every team plays a single-set round robin inside its group: 6 matches per team and 24 group matches in total.",
      },
      {
        title: "Match format & scoring",
        emoji: "⚔️",
        content:
          "Every match is a single set played to 21 points with no upper cap. The winner must lead by at least 2 points, so 21–20, 25–24 and 20–18 are not winning scores. Play continues until a two-point margin is reached.",
      },
      {
        title: "Self-judgment & score submission",
        emoji: "🤝",
        content:
          "There are no referees. Players are trusted to judge their own matches fairly. After each match, both teams agree on the result and one player submits the final score in the app.",
      },
      {
        title: "Group standings & tiebreakers",
        emoji: "📊",
        content:
          "Group ranking uses wins, then head-to-head, then point difference, then points scored, then team id. All four teams in each group qualify for the elimination bracket.",
      },
      {
        title: "No group eliminations",
        emoji: "🚫",
        content:
          "Group losses never count as elimination losses. A team that loses all three group matches still enters the bracket with zero elimination losses.",
      },
      {
        title: "Elimination bracket",
        emoji: "🌳",
        content:
          "The global group ranking seeds a standard 16-team double-elimination bracket: Winners Bracket rounds of 8, 4, 2 and 1; Losers Bracket rounds of 4, 4, 2, 2, 1 and 1; then the Grand Final. A first loss drops a team to the Losers Bracket; a second loss eliminates it. A full bracket is 30 matches, or 31 when a reset final is needed.",
      },
      {
        title: "Grand Final",
        emoji: "👑",
        content:
          "The Winners Bracket champion meets the Losers Bracket champion in the Grand Final. Both finalists enter with one loss, so the winner is the champion and the loser finishes second.",
      },
      {
        title: "Grand Final reset",
        emoji: "🔁",
        content:
          "A reset final is appended only when the undefeated Winners Bracket champion loses the first Grand Final. The tournament is not complete until the required reset final is played.",
      },
      {
        title: "Two independent rankings",
        emoji: "🏆",
        content:
          "Group standings and elimination standings are calculated separately. Group wins are never added to elimination wins. Final tied places are shared; no artificial tiebreakers are invented.",
      },
      {
        title: "Player registration",
        emoji: "👥",
        content:
          "Players register individually with an account from the Player page. An admin approves each registration and assigns the player to a team. Registrations are stored only in this tournament document — King & Queen data is never touched.",
      },
    ],
  },
  es: {
    title: "Información del Torneo",
    intro:
      "Este torneo se juega en equipos de dos en cuatro grupos, seguido de una eliminatoria doble estándar. Juego limpio, buena energía y grandes partidos de vóley playa. 🏖️🏐",
    labels: {
      teams: "equipos",
      groupsOf: "grupos de",
      dateTbd: "Fecha por confirmar",
    },
    sections: [
      {
        title: "Equipos y grupos",
        emoji: "🏐",
        content:
          "Los 16 equipos se reparten en 4 grupos de 4 por cabeza de serie mediante una distribución serpiente. Cada equipo juega una liguilla a un set dentro de su grupo: 6 partidos por equipo y 24 partidos de grupo en total.",
      },
      {
        title: "Formato y puntuación",
        emoji: "⚔️",
        content:
          "Todos los partidos se juegan a un único set de 21 puntos sin límite superior. El ganador debe aventajar al menos 2 puntos, por lo que 21–20, 25–24 y 20–18 no son marcadores ganadores. El juego continúa hasta que se alcanza una diferencia de 2 puntos.",
      },
      {
        title: "Autoarbitraje y envío del resultado",
        emoji: "🤝",
        content:
          "No hay árbitros. Se confía en que los jugadores juzguen sus propios partidos con justicia. Después de cada partido, ambos equipos acuerdan el resultado y un jugador introduce el marcador final en la aplicación.",
      },
      {
        title: "Clasificación y desempates de grupo",
        emoji: "📊",
        content:
          "La clasificación del grupo usa primero las victorias, luego el enfrentamiento directo, después la diferencia de puntos, los puntos anotados y, por último, el identificador del equipo. Los cuatro equipos de cada grupo se clasifican para la eliminatoria.",
      },
      {
        title: "Sin eliminaciones en grupos",
        emoji: "🚫",
        content:
          "Las derrotas en fase de grupos no cuentan como derrotas de eliminación. Un equipo que pierda los tres partidos de grupo entra en la eliminatoria con cero derrotas.",
      },
      {
        title: "Cuadro de eliminación",
        emoji: "🌳",
        content:
          "La clasificación global de grupos determina el orden de una eliminatoria doble estándar de 16 equipos: rondas del cuadro de ganadores de 8, 4, 2 y 1; rondas del cuadro de perdedores de 4, 4, 2, 2, 1 y 1; y después la Gran Final. La primera derrota envía al equipo al cuadro de perdedores; la segunda lo elimina. Un cuadro completo son 30 partidos, o 31 si se necesita una final de desempate.",
      },
      {
        title: "Gran Final",
        emoji: "👑",
        content:
          "El campeón del cuadro de ganadores se enfrenta al campeón del cuadro de perdedores en la Gran Final. Ambos finalistas llegan con una derrota, así que el ganador es el campeón y el perdedor queda segundo.",
      },
      {
        title: "Final de desempate",
        emoji: "🔁",
        content:
          "La final de desempate solo se añade cuando el campeón invicto del cuadro de ganadores pierde la primera Gran Final. El torneo no se considera terminado hasta que se juegue la final de desempate necesaria.",
      },
      {
        title: "Dos clasificaciones independientes",
        emoji: "🏆",
        content:
          "Las clasificaciones de grupo y de eliminación se calculan por separado. Las victorias de grupo nunca se suman a las victorias de eliminación. Los puestos empatados se comparten; no se inventan desempates artificiales.",
      },
      {
        title: "Registro de jugadores",
        emoji: "👥",
        content:
          "Los jugadores se registran individualmente con una cuenta desde la página del Jugador. Un administrador aprueba cada registro y asigna al jugador a un equipo. Los registros se guardan solo en este documento del torneo; los datos de King & Queen nunca se modifican.",
      },
    ],
  },
};

const STORAGE_KEY = "gsde-info-language";

/** Remembered choice wins; otherwise follow the browser language if Spanish. */
function initialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "es") return saved;
  } catch {
    // localStorage unavailable (private mode) - fall through to detection
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("es")
    ? "es"
    : "en";
}

/** Public info: K&Q-style header, intro card and emoji section cards. */
export default function GroupDoubleEliminationInfo() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const { id, doc } = useGsdeTournament();
  const config = doc?.tournament.config;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Preference simply will not persist
    }
    document.documentElement.lang = language;
  }, [language]);

  const { title, intro, labels, sections } = CONTENT[language];

  const languagePicker = (
    <div
      role="group"
      aria-label="Language / Idioma"
      className="inline-flex items-center gap-1 mt-4 p-1 rounded-full bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach"
    >
      {(["en", "es"] as Language[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          className={
            "px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide transition-all duration-200 " +
            (language === code
              ? "bg-ocean text-white shadow-beach"
              : "text-foreground/70 hover:bg-ocean/15 hover:text-ocean")
          }
        >
          {code}
        </button>
      ))}
    </div>
  );

  return (
    <GsdePublicShell
      emoji="🏐"
      title={title}
      subtitle={config?.name || GROUP_DOUBLE_ELIMINATION_FORMAT.name}
      backTo={gsdeHref(GROUP_DOUBLE_ELIMINATION_FORMAT.route, id)}
      backLabel="Tournament"
      headerExtra={languagePicker}
      showAutoFooter={false}
    >
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-beach border border-sand-dark/20">
        <p className="text-base leading-relaxed text-foreground">{intro}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {config?.teamLimit ?? 16} {labels.teams}
          </span>
          <span className="inline-flex items-center gap-1">
            <GitBranch className="h-3.5 w-3.5" /> {config?.groupCount ?? 4} {labels.groupsOf}{" "}
            {config?.teamsPerGroup ?? 4}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> {config?.date || labels.dateTbd}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-beach border border-sand-dark/20"
          >
            <h2 className="text-xl font-bold text-ocean mb-3 flex items-center gap-2">
              <span className="text-2xl">{section.emoji}</span>
              {section.title}
            </h2>
            <p className="text-base leading-relaxed text-foreground">{section.content}</p>
          </div>
        ))}
      </div>
    </GsdePublicShell>
  );
}
