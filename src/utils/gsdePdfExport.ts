import jsPDF from "jspdf";
import type { GsdeTournamentDocument } from "@/formats/group-double-elimination/persistence";
import type { GroupTiebreaker } from "@/formats/group-double-elimination/groupStandings";
import { getGameNumber } from "@/formats/group-double-elimination/gameNumbers";
import {
  buildGsdeTournamentReport,
  type GsdeReportCorrection,
  type GsdeReportGroup,
  type GsdeReportMatch,
  type GsdeTournamentReport,
} from "@/formats/group-double-elimination/report";

/**
 * GSDE PDF export (A4 portrait, 12 mm margins) built directly with jsPDF.
 *
 * There is no HTML template or print stylesheet: layout/page-break behaviour is
 * implemented as deterministic drawing helpers below. All content comes from
 * the pure report builder — this module never reads tournament data itself and
 * never mutates the report, so it is presentation-only.
 */

type RGB = [number, number, number];
type Align = "left" | "center";

const BLUE: RGB = [0, 119, 182];
const ORANGE: RGB = [255, 127, 80];
const HEADER_BG: RGB = [0, 86, 130];
const WHITE: RGB = [255, 255, 255];
const LIGHT_BLUE: RGB = [224, 247, 255];
const LIGHT_ORANGE: RGB = [255, 243, 224];
const STRIP_BLUE: RGB = [232, 240, 248];
const STRIP_TEXT: RGB = [0, 70, 100];
const QUALIFIED_BG: RGB = [226, 244, 234];
const QUALIFIED_TEXT: RGB = [20, 100, 60];
const MUTED_TEXT: RGB = [132, 138, 145];
const ROW_GRAY: RGB = [250, 250, 250];
const BORDER_GRAY: RGB = [214, 221, 228];
const FOOTER_GRAY: RGB = [130, 136, 143];
const GOLD: RGB = [176, 141, 30];
const GOLD_LIGHT: RGB = [255, 246, 220];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2; // 186
const PAGE_BOTTOM = PAGE_H - MARGIN; // 285
const FIRST_CONTENT_Y = 42; // below the page-1 banner
const CONTENT_Y = 20; // directly under the slim running header

const HEADER_H = 8;
const ROW_H = 7.4;
const TABLE_FONT = 9;
const CELL_PAD = 2.5;

const CARD_W = 88;
const CARD_H = 30;
const CARD_HEADER_H = 7;
const CARD_ROW_H = 8.5;
const CARD_GAP = 10;
const CARD_COLS = [MARGIN, MARGIN + CARD_W + CARD_GAP];

/** Readable standings tiebreak labels; wins/team-id/null are intentionally blank. */
const TIEBREAK_LABEL: Partial<Record<GroupTiebreaker, string>> = {
  "head-to-head": "Head-to-head",
  "mini-league-difference": "Mini-league +/-",
  "point-difference": "Point diff",
  "points-scored": "Points for",
};

const tiebreakLabel = (value: string | null): string =>
  value ? TIEBREAK_LABEL[value as GroupTiebreaker] ?? "" : "";

interface TableColumn {
  header: string;
  width: number;
  align?: Align;
  bold?: boolean;
}

interface RowStyle {
  highlight?: boolean;
  zebra?: boolean;
  boldCols?: number[];
  mutedCols?: number[];
  height?: number;
}

interface TableOptions {
  title: string;
  columns: TableColumn[];
  rows: string[][];
  startY: number;
  accent?: RGB;
  highlightTop?: number;
  boldCols?: number[];
  rowHeight?: number;
  legend?: string;
}

interface MatchSection {
  title: string;
  matches: GsdeReportMatch[];
}

interface BracketRound {
  key: string;
  title: string;
  range: string;
  matches: GsdeReportMatch[];
}

export interface AuditGroup {
  action: string;
  matchId: string | null;
  detail: string;
  actor: string;
  at: string;
  count: number;
}

export interface BuildGsdePdfOptions {
  /** Append a grouped corrections/admin-actions page at the end. Default false. */
  includeAuditLog?: boolean;
}

// ---------------------------------------------------------------------------
// Small pure helpers (also unit-tested).
// ---------------------------------------------------------------------------

const fitFontSize = (
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  base: number,
  min: number
): number => {
  let size = base;
  pdf.setFontSize(size);
  while (pdf.getTextWidth(text) > maxWidth && size > min) {
    size -= 0.5;
    pdf.setFontSize(size);
  }
  return size;
};

const ordinal = (place: number): string => {
  const mod100 = place % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
  switch (place % 10) {
    case 1:
      return `${place}st`;
    case 2:
      return `${place}nd`;
    case 3:
      return `${place}rd`;
    default:
      return `${place}th`;
  }
};

const formatDate = (value: string): string => {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    );
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const datePart = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
};

const sanitize = (value: string): string =>
  value.replace(/[^A-Za-z0-9]+/g, "").slice(0, 48) || "Tournament";

const gameNumberOf = (match: GsdeReportMatch): number | null => {
  const fromId = getGameNumber(match.id);
  if (fromId !== null) return fromId;
  const fromLabel = /Game\s+(\d+)/i.exec(match.label);
  return fromLabel ? Number(fromLabel[1]) : null;
};

interface RoundDef {
  key: string;
  title: string;
  range: string;
  includes: (number: number) => boolean;
}

const WINNER_ROUNDS: RoundDef[] = [
  { key: "wr1", title: "R1", range: "Games 1-8", includes: (n) => n >= 1 && n <= 8 },
  { key: "wr2", title: "R2", range: "Games 9-12", includes: (n) => n >= 9 && n <= 12 },
  { key: "wr3", title: "Semifinals", range: "Games 21-22", includes: (n) => n >= 21 && n <= 22 },
  { key: "wr4", title: "Final", range: "Game 27", includes: (n) => n === 27 },
];

const LOSER_ROUNDS: RoundDef[] = [
  { key: "lr1", title: "LB R1", range: "Games 13-16", includes: (n) => n >= 13 && n <= 16 },
  { key: "lr2", title: "LB R2", range: "Games 17-20", includes: (n) => n >= 17 && n <= 20 },
  { key: "lr3", title: "LB R3", range: "Games 23-24", includes: (n) => n >= 23 && n <= 24 },
  { key: "lr4", title: "LB R4", range: "Games 25-26", includes: (n) => n >= 25 && n <= 26 },
  { key: "lr5", title: "LB R5", range: "Game 28", includes: (n) => n === 28 },
  { key: "lr6", title: "LB Final", range: "Game 29", includes: (n) => n === 29 },
];

const GRAND_ROUNDS: RoundDef[] = [
  { key: "gf", title: "Grand Final", range: "Game 30", includes: (n) => n === 30 },
  { key: "rf", title: "Reset Final", range: "Game 31", includes: (n) => n === 31 },
];

type BracketGroup = "winners" | "losers" | "grand-final";

/** Group elimination matches into ordered, clearly labelled rounds. */
export const buildBracketRounds = (
  matches: GsdeReportMatch[],
  group: BracketGroup
): BracketRound[] => {
  const defs =
    group === "winners"
      ? WINNER_ROUNDS
      : group === "losers"
        ? LOSER_ROUNDS
        : GRAND_ROUNDS;
  const numbered = matches
    .map((match) => ({ match, number: gameNumberOf(match) }))
    .sort((a, b) => {
      if (a.number === null && b.number === null) return a.match.label.localeCompare(b.match.label);
      if (a.number === null) return 1;
      if (b.number === null) return -1;
      return a.number - b.number;
    });

  const rounds: BracketRound[] = defs.map((def) => ({
    key: def.key,
    title: def.title,
    range: def.range,
    matches: [],
  }));
  const fallback: BracketRound = {
    key: "other",
    title: "Additional Games",
    range: "Unnumbered",
    matches: [],
  };

  for (const entry of numbered) {
    const def = entry.number === null ? undefined : defs.find((candidate) => candidate.includes(entry.number!));
    const round = def ? rounds.find((candidate) => candidate.key === def.key) : undefined;
    (round ?? fallback).matches.push(entry.match);
  }

  return [...rounds, fallback].filter((round) => round.matches.length > 0);
};

/** Collapse identical audit entries into a single counted line. */
export const groupAuditEntries = (entries: GsdeReportCorrection[]): AuditGroup[] => {
  const groups = new Map<string, AuditGroup>();
  for (const entry of entries) {
    const key = [entry.action, entry.matchId ?? "", entry.detail, entry.actor].join("\u0000");
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    groups.set(key, {
      action: entry.action,
      matchId: entry.matchId,
      detail: entry.detail,
      actor: entry.actor,
      at: entry.at,
      count: 1,
    });
  }
  return [...groups.values()].sort((a, b) => a.at.localeCompare(b.at));
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/** Render a report model into an in-memory PDF (also useful for smoke tests). */
export const buildGsdePdf = (
  report: GsdeTournamentReport,
  options: BuildGsdePdfOptions = {}
): jsPDF => {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const prettyDate = formatDate(report.date);
  const shortDate = datePart(report.date);
  const generatedDate = datePart(report.generatedAt);
  const runningHeader = [report.title, report.division, shortDate || "Date not set"]
    .filter(Boolean)
    .join("  ·  ");
  const tableW = (columns: TableColumn[]): number =>
    columns.reduce((sum, column) => sum + column.width, 0);

  const setDash = (pattern: number[]): void => {
    const withDash = pdf as jsPDF & {
      setLineDashPattern?: (dashArray: number[], dashPhase: number) => void;
    };
    withDash.setLineDashPattern?.(pattern, 0);
  };

  const drawBanner = (): void => {
    pdf.setFillColor(...HEADER_BG);
    pdf.rect(0, 0, PAGE_W, 33, "F");
    pdf.setTextColor(...WHITE);
    pdf.setFont(undefined, "bold");
    const titleSize = fitFontSize(pdf, report.title, 180, 18, 11);
    pdf.setFontSize(titleSize);
    pdf.text(report.title, 105, 12, { align: "center" });
    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    pdf.text("Group Stage + Double Elimination", 105, 20, { align: "center" });
    pdf.setFontSize(8);
    const subtitle = [report.category, report.division, prettyDate]
      .filter(Boolean)
      .join(" | ");
    pdf.text(subtitle, 105, 27, { align: "center" });
  };

  const addPage = (): number => {
    pdf.addPage();
    return CONTENT_Y;
  };

  /** A section title never sits alone: callers reserve room for its first content. */
  const drawSectionTitle = (
    title: string,
    y: number,
    accent: RGB = HEADER_BG
  ): number => {
    pdf.setFont(undefined, "bold");
    const size = fitFontSize(pdf, title, CONTENT_W, 12, 9);
    pdf.setFontSize(size);
    pdf.setTextColor(...accent);
    pdf.text(title, MARGIN, y, { align: "left" });
    pdf.setDrawColor(...accent);
    pdf.setLineWidth(0.5);
    pdf.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
    return y + 7;
  };

  const drawRoundHeading = (
    title: string,
    y: number,
    accent: RGB
  ): number => {
    pdf.setFont(undefined, "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...accent);
    pdf.text(title, MARGIN, y, { align: "left" });
    return y + 6;
  };

  const cellTextX = (column: TableColumn, left: number): number =>
    (column.align ?? "left") === "center" ? left + column.width / 2 : left + CELL_PAD;

  const cellAlign = (column: TableColumn): Align => column.align ?? "left";

  const vCenter = (top: number, height: number, fontPt: number): number =>
    top + height / 2 + fontPt * 0.18;

  const drawTableHeader = (
    columns: TableColumn[],
    top: number,
    accent: RGB
  ): number => {
    pdf.setFillColor(...(accent === GOLD ? GOLD_LIGHT : STRIP_BLUE));
    pdf.rect(MARGIN, top, tableW(columns), HEADER_H, "F");
    pdf.setDrawColor(...BORDER_GRAY);
    pdf.setLineWidth(0.25);
    pdf.rect(MARGIN, top, tableW(columns), HEADER_H, "S");
    pdf.setFont(undefined, "bold");
    pdf.setFontSize(TABLE_FONT);
    pdf.setTextColor(...(accent === GOLD ? GOLD : STRIP_TEXT));
    let x = MARGIN;
    columns.forEach((column) => {
      const size = fitFontSize(
        pdf,
        column.header,
        column.width - CELL_PAD * 2,
        TABLE_FONT,
        6.5
      );
      pdf.setFontSize(size);
      pdf.text(
        column.header,
        cellTextX(column, x),
        vCenter(top, HEADER_H, size),
        { align: cellAlign(column) }
      );
      x += column.width;
    });
    return top + HEADER_H;
  };

  const drawTableRow = (
    columns: TableColumn[],
    values: string[],
    top: number,
    style: RowStyle = {}
  ): number => {
    const height = style.height ?? ROW_H;
    if (style.highlight) {
      pdf.setFillColor(...QUALIFIED_BG);
    } else if (style.zebra) {
      pdf.setFillColor(...ROW_GRAY);
    } else {
      pdf.setFillColor(...WHITE);
    }
    if (style.highlight || style.zebra) {
      pdf.rect(MARGIN, top, tableW(columns), height, "F");
    }

    pdf.setDrawColor(...BORDER_GRAY);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, top + height, PAGE_W - MARGIN, top + height);
    let boundary = MARGIN + columns[0].width;
    for (let index = 0; index < columns.length - 1; index += 1) {
      pdf.line(boundary, top, boundary, top + height);
      boundary += columns[index + 1].width;
    }

    let x = MARGIN;
    columns.forEach((column, index) => {
      const value = values[index] ?? "";
      const maxWidth = column.width - CELL_PAD * 2;
      const size = fitFontSize(pdf, value, maxWidth, TABLE_FONT, 6.5);
      pdf.setFontSize(size);
      const bold = Boolean(column.bold || style.boldCols?.includes(index));
      pdf.setFont(undefined, bold ? "bold" : "normal");
      if (style.mutedCols?.includes(index)) {
        pdf.setTextColor(...MUTED_TEXT);
      } else if (style.highlight && index === 0) {
        pdf.setTextColor(...QUALIFIED_TEXT);
      } else {
        pdf.setTextColor(35, 35, 35);
      }
      pdf.text(value, cellTextX(column, x), vCenter(top, height, size), {
        align: cellAlign(column),
      });
      x += column.width;
    });
    return top + height;
  };

  const drawTable = (options: TableOptions): number => {
    const {
      title,
      columns,
      rows,
      startY,
      accent = HEADER_BG,
      highlightTop = 0,
      boldCols = [],
      rowHeight = ROW_H,
      legend,
    } = options;
    let y = startY;
    if (y + HEADER_H + rowHeight * 1.2 > PAGE_BOTTOM) y = addPage();
    y = drawSectionTitle(title, y, accent);
    let bodyY = drawTableHeader(columns, y, accent);

    rows.forEach((row, rowIndex) => {
      if (bodyY + rowHeight > PAGE_BOTTOM) {
        y = addPage();
        y = drawSectionTitle(`${title} (continued)`, y, accent);
        bodyY = drawTableHeader(columns, y, accent);
      }
      bodyY = drawTableRow(columns, row, bodyY, {
        zebra: rowIndex % 2 === 1,
        highlight: rowIndex < highlightTop,
        boldCols,
        height: rowHeight,
      });
    });

    y = bodyY + 3;
    if (legend) {
      pdf.setFont(undefined, "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(105, 110, 116);
      const lines = pdf.splitTextToSize(legend, CONTENT_W - 2) as string[];
      lines.forEach((line) => {
        pdf.text(line, MARGIN, y);
        y += 3.4;
      });
      y += 2;
    }
    return y;
  };

  const drawMatchCard = (
    match: GsdeReportMatch,
    x: number,
    y: number,
    accent: RGB
  ): void => {
    const number = gameNumberOf(match);
    const roundTitle =
      number === null
        ? match.label
        : [...WINNER_ROUNDS, ...LOSER_ROUNDS, ...GRAND_ROUNDS].find((round) =>
              round.includes(number)
            )?.title ?? match.label;
    const headerText = `${match.label} - ${roundTitle}`;
    const completed =
      match.status === "completed" &&
      match.scoreA !== null &&
      match.scoreB !== null;
    const tbdA = match.teamA === "TBD" || !completed;
    const tbdB = match.teamB === "TBD" || !completed;
    const dashed = !completed;

    if (dashed) setDash([1.2, 1.2]);
    pdf.setFillColor(...WHITE);
    pdf.setDrawColor(...(dashed ? MUTED_TEXT : BORDER_GRAY));
    pdf.setLineWidth(dashed ? 0.4 : 0.25);
    pdf.roundedRect(x, y, CARD_W, CARD_H, 2, 2, "FD");
    setDash([]);

    pdf.setFillColor(...STRIP_BLUE);
    pdf.rect(x, y, CARD_W, CARD_HEADER_H, "F");
    pdf.setFont(undefined, "bold");
    pdf.setFontSize(fitFontSize(pdf, headerText, CARD_W - 6, 8.5, 6.5));
    pdf.setTextColor(...STRIP_TEXT);
    pdf.text(headerText, x + CARD_W / 2, vCenter(y, CARD_HEADER_H, 8.5), {
      align: "center",
    });

    const accentForWinner: RGB = accent === GOLD ? GOLD : BLUE;
    const drawTeamRow = (
      top: number,
      name: string,
      isTbd: boolean,
      isWinner: boolean,
      score: number | null
    ): void => {
      if (isWinner) {
        pdf.setFillColor(...(accent === GOLD ? GOLD_LIGHT : QUALIFIED_BG));
        pdf.rect(x + 2, top, CARD_W - 4, CARD_ROW_H, "F");
      }
      const scoreW = 12;
      const scoreX = x + CARD_W - 4 - scoreW;
      pdf.setDrawColor(...BORDER_GRAY);
      pdf.setLineWidth(0.25);
      pdf.roundedRect(scoreX, top + 1, scoreW, CARD_ROW_H - 2, 1, 1, "S");

      const nameLeft = x + 4;
      const nameRight = scoreX - 2;
      const nameWidth = nameRight - nameLeft;
      const displayName = isTbd ? "TBD" : name;
      pdf.setFont(undefined, isWinner ? "bold" : "normal");
      const size = fitFontSize(pdf, displayName, nameWidth - 4, 9, 6.5);
      pdf.setFontSize(size);
      pdf.setTextColor(...(isTbd ? MUTED_TEXT : isWinner ? accentForWinner : MUTED_TEXT));
      pdf.text(
        displayName,
        nameLeft + nameWidth / 2,
        vCenter(top, CARD_ROW_H, size),
        { align: "center" }
      );

      if (isWinner) {
        // Drawn as vector strokes: jsPDF's standard fonts have no check glyph.
        const checkX = nameLeft + 1.3;
        const checkY = vCenter(top, CARD_ROW_H, 9);
        pdf.setDrawColor(...accentForWinner);
        pdf.setLineWidth(0.6);
        pdf.line(checkX - 0.9, checkY + 0.1, checkX - 0.2, checkY + 0.9);
        pdf.line(checkX - 0.2, checkY + 0.9, checkX + 1.1, checkY - 0.9);
      }

      pdf.setFont(undefined, isWinner ? "bold" : "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...(isTbd ? MUTED_TEXT : isWinner ? accentForWinner : STRIP_TEXT));
      pdf.text(
        score === null ? "-" : String(score),
        scoreX + scoreW / 2,
        vCenter(top + 1, CARD_ROW_H - 2, 9),
        { align: "center" }
      );
    };

    const rowAY = y + CARD_HEADER_H + 1;
    const rowBY = rowAY + CARD_ROW_H + 2;
    const winnerA =
      completed &&
      match.winnerId !== null &&
      match.winnerId === match.teamAId;
    const winnerB =
      completed &&
      match.winnerId !== null &&
      match.winnerId === match.teamBId;
    drawTeamRow(rowAY, match.teamA, tbdA, winnerA, match.scoreA);
    drawTeamRow(rowBY, match.teamB, tbdB, winnerB, match.scoreB);
  };

  const drawCardGrid = (
    matches: GsdeReportMatch[],
    startY: number,
    accent: RGB,
    heading: string
  ): number => {
    let y = startY;
    // Reserve a whole card row so a round heading is never left on its own.
    if (y + 6 + CARD_H > PAGE_BOTTOM) y = addPage();
    y = drawRoundHeading(heading, y, accent);
    for (let index = 0; index < matches.length; index += 2) {
      if (y + CARD_H > PAGE_BOTTOM) {
        y = addPage();
        y = drawRoundHeading(`${heading} (continued)`, y, accent);
      }
      matches.slice(index, index + 2).forEach((match, column) => {
        drawMatchCard(match, CARD_COLS[column], y, accent);
      });
      y += CARD_H + 4;
    }
    return y + 2;
  };

  const drawBracketSection = (
    title: string,
    matches: GsdeReportMatch[],
    group: BracketGroup,
    accent: RGB
  ): void => {
    let y = addPage();
    y = drawSectionTitle(title, y + 2, accent) + 3;
    buildBracketRounds(matches, group).forEach((round) => {
      y = drawCardGrid(
        round.matches,
        y,
        accent,
        `${round.title}  ·  ${round.range}`
      );
    });
  };

  const drawCompactResults = (
    matches: GsdeReportMatch[],
    startY: number
  ): number => {
    const columns: TableColumn[] = [
      { header: "Round", width: 16, align: "center" },
      { header: "Team A", width: 70 },
      { header: "Score", width: 30, align: "center" },
      { header: "Team B", width: 70 },
    ];
    let y = startY;
    if (y + HEADER_H + ROW_H * 2 > PAGE_BOTTOM) y = addPage();
    y = drawRoundHeading("Results", y, BLUE);
    let bodyY = drawTableHeader(columns, y, BLUE);
    const sorted = [...matches].sort((a, b) => a.round - b.round);

    sorted.forEach((match, index) => {
      const completed =
        match.status === "completed" &&
        match.scoreA !== null &&
        match.scoreB !== null;
      const winnerA =
        completed && match.winnerId !== null && match.winnerId === match.teamAId;
      const winnerB =
        completed && match.winnerId !== null && match.winnerId === match.teamBId;
      const score =
        match.scoreA === null || match.scoreB === null
          ? "TBD"
          : `${match.scoreA} - ${match.scoreB}`;
      if (bodyY + ROW_H > PAGE_BOTTOM) {
        y = addPage();
        y = drawRoundHeading("Results (continued)", y, BLUE);
        bodyY = drawTableHeader(columns, y, BLUE);
      }
      bodyY = drawTableRow(
        columns,
        [
          match.label,
          match.teamA === "TBD" ? "TBD" : match.teamA,
          score,
          match.teamB === "TBD" ? "TBD" : match.teamB,
        ],
        bodyY,
        {
          zebra: index % 2 === 1,
          boldCols: winnerA ? [1] : winnerB ? [3] : [],
          mutedCols: winnerA ? [3] : winnerB ? [1] : [],
        }
      );
    });
    return bodyY + 3;
  };

  const drawGroupBlock = (
    group: GsdeReportGroup,
    startY: number,
    showLegend: boolean
  ): number => {
    let y = startY;
    if (y + 34 > PAGE_BOTTOM) y = addPage();
    pdf.setFont(undefined, "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...BLUE);
    pdf.text(group.name, MARGIN, y, { align: "left" });
    pdf.setDrawColor(...BLUE);
    pdf.setLineWidth(0.7);
    pdf.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
    y += 7;

    y = drawTable({
      title: "Standings",
      accent: BLUE,
      highlightTop: 2,
      legend: showLegend
        ? "Tiebreak shows the rule that decided a position: Head-to-head, Mini-league +/-, "
            .concat("Point diff or Points for. Blank means no tiebreak was needed.")
        : undefined,
      startY: y,
      columns: [
        { header: "#", width: 10, align: "center" },
        { header: "Team", width: 58 },
        { header: "P", width: 10, align: "center" },
        { header: "W", width: 10, align: "center" },
        { header: "L", width: 10, align: "center" },
        { header: "+/-", width: 18, align: "center" },
        { header: "PF", width: 15, align: "center" },
        { header: "PA", width: 15, align: "center" },
        { header: "Tiebreak", width: 40 },
      ],
      rows: group.standings.map((row) => [
        String(row.rank),
        row.team,
        String(row.played),
        String(row.wins),
        String(row.losses),
        row.pointDifference > 0
          ? `+${row.pointDifference}`
          : String(row.pointDifference),
        String(row.pointsFor ?? 0),
        String(row.pointsAgainst ?? 0),
        tiebreakLabel(row.tiebreakUsed),
      ]),
    });

    return drawCompactResults(group.results, y + 1);
  };

  const drawPlayerRoster = (startY: number): number => {
    const female = report.players.filter((player) => player.gender === "female");
    const male = report.players.filter((player) => player.gender === "male");
    const other = report.players.filter((player) => player.gender === null);
    const twoColumns = female.length > 0 && male.length > 0;
    const columns: Array<{
      label: string;
      players: typeof report.players;
      x: number;
      w: number;
      bg: RGB;
      fg: RGB;
    }> = twoColumns
      ? [
          {
            label: "FEMALE PLAYERS",
            players: female,
            x: MARGIN,
            w: 88,
            bg: LIGHT_ORANGE,
            fg: ORANGE,
          },
          {
            label: "MALE PLAYERS",
            players: male,
            x: MARGIN + 98,
            w: 88,
            bg: LIGHT_BLUE,
            fg: BLUE,
          },
        ]
      : [
          {
            label:
              report.category === "Male"
                ? "MALE PLAYERS"
                : report.category === "Female"
                  ? "FEMALE PLAYERS"
                  : "REGISTERED PLAYERS",
            players: [...female, ...male, ...other],
            x: MARGIN,
            w: CONTENT_W,
            bg: LIGHT_BLUE,
            fg: BLUE,
          },
        ];

    let y = drawSectionTitle("Registered Players", startY);
    const rowH = 5.6;
    const bottoms = columns.map((column) => {
      let cy = y;
      pdf.setFillColor(...column.bg);
      pdf.roundedRect(column.x, cy - 4, column.w, 7, 2, 2, "F");
      pdf.setFontSize(9);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(...column.fg);
      pdf.text(`${column.label} (${column.players.length})`, column.x + 4, cy + 0.5);
      cy += 8;

      column.players.forEach((player, index) => {
        if (cy + rowH > PAGE_BOTTOM) {
          cy = addPage();
          y = drawSectionTitle("Registered Players (continued)", cy);
          cy = y + 1;
        }
        if (index % 2 === 0) {
          pdf.setFillColor(...ROW_GRAY);
          pdf.rect(column.x, cy - 4, column.w, rowH, "F");
        }
        pdf.setFontSize(8.5);
        pdf.setFont(undefined, "normal");
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${index + 1}. ${player.name}`, column.x + 4, cy, {
          maxWidth: column.w - 8,
        });
        cy += rowH;
      });
      return cy;
    });

    if (twoColumns && bottoms.length === 2) {
      pdf.setDrawColor(...BORDER_GRAY);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN + 93, y - 4, MARGIN + 93, Math.max(...bottoms));
    }
    return Math.max(...bottoms, y) + 4;
  };

  const drawChampionPanel = (startY: number): number => {
    const cardW = 90;
    const cardH = 42;
    const col2 = MARGIN + cardW + 8;
    const y = startY + 2;
    const cards = [
      {
        x: MARGIN,
        label: "CHAMPION",
        name: report.champions.join(" / ") || "TBD",
        isWinner: true,
      },
      {
        x: col2,
        label: "RUNNER-UP",
        name: report.runnersUp.join(" / ") || "TBD",
        isWinner: false,
      },
    ];

    cards.forEach((card) => {
      pdf.setFillColor(...WHITE);
      pdf.setDrawColor(...(card.isWinner ? GOLD : BORDER_GRAY));
      pdf.setLineWidth(card.isWinner ? 0.8 : 0.25);
      pdf.roundedRect(card.x, y, cardW, cardH, 2.5, 2.5, "FD");

      const labelH = 7;
      pdf.setFillColor(...(card.isWinner ? GOLD_LIGHT : STRIP_BLUE));
      pdf.rect(card.x, y, cardW, labelH, "F");
      pdf.setFontSize(9);
      pdf.setFont(undefined, "bold");
      pdf.setTextColor(...(card.isWinner ? GOLD : STRIP_TEXT));
      pdf.text(card.label, card.x + 4, vCenter(y, labelH, 9));

      pdf.setTextColor(0, 0, 0);
      const fs = fitFontSize(pdf, card.name, cardW - 10, 12, 7);
      pdf.setFontSize(fs);
      pdf.setFont(undefined, "bold");
      pdf.text(card.name, card.x + cardW / 2, y + 24, { align: "center" });

      pdf.setFontSize(8);
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(110, 110, 110);
      const note = card.isWinner
        ? report.resetWasPlayed
          ? "Won after the reset final"
          : "Tournament winner"
        : "Second place";
      pdf.text(note, card.x + cardW / 2, y + cardH - 7, { align: "center" });
    });

    let panelY = y + cardH + 8;
    if (panelY + 30 > PAGE_BOTTOM) panelY = addPage();
    pdf.setFillColor(252, 248, 235);
    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.4);
    const panelH = report.validated ? 28 : 35;
    pdf.roundedRect(MARGIN, panelY, CONTENT_W, panelH, 2.5, 2.5, "FD");
    pdf.setFontSize(9);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(...GOLD);
    pdf.text(
      report.validated
        ? "FINAL RESULT - VALIDATED"
        : "PROVISIONAL RESULT - NOT FINAL",
      105,
      panelY + 6,
      { align: "center" }
    );
    pdf.setFontSize(9);
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(40, 40, 40);
    pdf.text(`Champion: ${report.champions.join(" / ") || "TBD"}`, MARGIN + 8, panelY + 15);
    pdf.text(`Runner-up: ${report.runnersUp.join(" / ") || "TBD"}`, MARGIN + 8, panelY + 23);
    if (!report.validated) {
      pdf.setFontSize(8);
      pdf.setTextColor(...ORANGE);
      pdf.text(
        "This bracket is provisional and must not be treated as an official result.",
        MARGIN + 8,
        panelY + 30
      );
    }
    return panelY + panelH + 4;
  };

  const drawCompletionBlockers = (startY: number): number => {
    if (report.completionIssues.length === 0) return startY;
    let blockY = startY;
    const lines = report.completionIssues.flatMap((issue) =>
      pdf.splitTextToSize(`- ${issue}`, CONTENT_W - 12) as string[]
    );
    const blockH = 10 + lines.length * 4.5;
    if (blockY + blockH > PAGE_BOTTOM) blockY = addPage();
    pdf.setFillColor(...LIGHT_ORANGE);
    pdf.setDrawColor(...ORANGE);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(MARGIN, blockY, CONTENT_W, blockH, 2.5, 2.5, "FD");
    pdf.setFontSize(9);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(...ORANGE);
    pdf.text("Completion blockers", MARGIN + 5, blockY + 6);
    pdf.setFontSize(8);
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(60, 45, 30);
    lines.forEach((line, index) => {
      pdf.text(line, MARGIN + 5, blockY + 12 + index * 4.5);
    });
    return blockY + blockH + 4;
  };

  // Page 1 — banner, overview, result status/blockers and registered players.
  drawBanner();
  let y = drawSectionTitle("Tournament Overview", FIRST_CONTENT_Y);
  const infoRows = [
    ["Tournament", report.title],
    ["Division", report.division],
    ["Category", report.category],
    ["Date", prettyDate || "Not set"],
    ["Status", report.status],
    ["Result status", report.complete ? "Completed" : "In progress"],
    ["Teams / Players", `${report.counts.teams} / ${report.counts.players}`],
    ["Groups", String(report.counts.groups)],
    [
      "Progress",
      `${report.counts.groupMatchesCompleted}/${report.counts.groupMatchesTotal} group · ${report.counts.eliminationMatchesCompleted}/${report.counts.eliminationMatchesTotal} elimination`,
    ],
  ];
  infoRows.forEach((row, index) => {
    if (index % 2 === 0) {
      pdf.setFillColor(...ROW_GRAY);
      pdf.rect(MARGIN, y - 4, CONTENT_W, 6.4, "F");
    }
    pdf.setFontSize(9);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(...HEADER_BG);
    pdf.text(row[0], MARGIN + 4, y);
    pdf.setFont(undefined, "normal");
    pdf.setTextColor(35, 35, 35);
    pdf.text(row[1], MARGIN + 50, y, { maxWidth: CONTENT_W - 54 });
    y += 6.4;
  });
  y = drawCompletionBlockers(y + 5);
  if (report.players.length > 0) y = drawPlayerRoster(y + 3);

  // Teams & groups. The Players column is shown only when at least one team has
  // a custom display name; otherwise it would just repeat the Team column.
  y = addPage();
  const needsPlayers = report.teams.some(
    (team) => team.players.join(" / ") !== team.name
  );
  const teamColumns: TableColumn[] = needsPlayers
    ? [
        { header: "#", width: 12, align: "center" },
        { header: "Team", width: 66 },
        { header: "Players", width: 62 },
        { header: "Group", width: 26 },
        { header: "Seed", width: 20, align: "center" },
      ]
    : [
        { header: "#", width: 14, align: "center" },
        { header: "Team", width: 112 },
        { header: "Group", width: 34 },
        { header: "Seed", width: 26, align: "center" },
      ];
  y = drawTable({
    title: "Teams & Groups",
    columns: teamColumns,
    rows: report.teams.map((team, index) => {
      const players = team.players.join(" / ");
      const customSuffix = ` (${players})`;
      const teamLabel = team.name.endsWith(customSuffix)
        ? team.name.slice(0, -customSuffix.length)
        : team.name;
      const isAutoNamed = teamLabel === players;
      const base = [String(index + 1), teamLabel || team.name];
      if (needsPlayers) base.push(isAutoNamed ? "" : players);
      base.push(team.groupName, team.seed === null ? "-" : String(team.seed));
      return base;
    }),
    startY: y,
  });

  // Group stage: two self-contained groups per page (A/B, then C/D).
  if (report.groups.length > 0) {
    const orderedGroups = [...report.groups].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
    for (let index = 0; index < orderedGroups.length; index += 2) {
      let groupY = addPage();
      orderedGroups.slice(index, index + 2).forEach((group, position) => {
        groupY = drawGroupBlock(group, groupY, index === 0 && position === 0);
        if (position === 0) groupY += 5;
      });
    }
  }

  // Global group ranking used to seed the bracket.
  if (report.globalRanking.length > 0) {
    y = addPage();
    y = drawTable({
      title: "Global Group Ranking",
      accent: ORANGE,
      boldCols: [0],
      columns: [
        { header: "Seed", width: 16, align: "center" },
        { header: "Team", width: 84 },
        { header: "Group", width: 26 },
        { header: "W", width: 16, align: "center" },
        { header: "L", width: 16, align: "center" },
        { header: "+/-", width: 28, align: "center" },
      ],
      rows: report.globalRanking.map((row) => [
        String(row.rank),
        row.team,
        row.group,
        String(row.wins),
        String(row.losses),
        row.pointDifference > 0
          ? `+${row.pointDifference}`
          : String(row.pointDifference),
      ]),
      startY: y,
    });
  }

  if (
    report.finalPlacements.length > 0 ||
    report.eliminationMatches.length > 0 ||
    report.eliminationStandings.length > 0
  ) {
    // Final placements: one team per row, shared places shown as "5th (tie)".
    if (report.finalPlacements.length > 0) {
      y = addPage();
      const placementRows = report.finalPlacements
        .flatMap((placement) =>
          placement.teams.map((team) => ({
            place: placement.place,
            label: `${ordinal(placement.place)}${placement.teams.length > 1 ? " (tie)" : ""}`,
            team,
          }))
        )
        .sort(
          (a, b) => a.place - b.place || a.team.localeCompare(b.team)
        )
        .map((row) => [row.label, row.team]);
      y = drawTable({
        title: "Final Placements",
        accent: GOLD,
        boldCols: [0],
        columns: [
          { header: "Place", width: 36, align: "center" },
          { header: "Team", width: 150 },
        ],
        rows: placementRows,
        startY: y,
      });
      if (report.complete) y = drawChampionPanel(y);
    }

    // Brackets by round. Winners and Losers each start on a fresh page.
    if (report.eliminationMatches.length > 0) {
      const winners = report.eliminationMatches.filter(
        (match) => match.phase === "winners"
      );
      const losers = report.eliminationMatches.filter(
        (match) => match.phase === "losers"
      );
      const finals = report.eliminationMatches.filter(
        (match) => match.phase === "grand-final"
      );
      const known = winners.length + losers.length + finals.length;
      if (known === report.eliminationMatches.length) {
        if (winners.length > 0) {
          drawBracketSection("Winners Bracket", winners, "winners", BLUE);
        }
        if (losers.length > 0) {
          drawBracketSection("Losers Bracket", losers, "losers", ORANGE);
        }
        if (finals.length > 0) {
          drawBracketSection("Grand Final", finals, "grand-final", GOLD);
        }
      } else {
        drawBracketSection(
          "Elimination Results",
          report.eliminationMatches,
          "winners",
          ORANGE
        );
      }
    }

    if (report.eliminationStandings.length > 0) {
      y = addPage();
      y = drawTable({
        title: "Elimination Status",
        accent: ORANGE,
        columns: [
          { header: "Team", width: 82 },
          { header: "W", width: 16, align: "center" },
          { header: "L", width: 16, align: "center" },
          { header: "Status", width: 52 },
          { header: "Place", width: 20, align: "center" },
        ],
        rows: [...report.eliminationStandings]
          .sort((a, b) => {
            const placeDiff = (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER);
            return placeDiff !== 0 ? placeDiff : a.team.localeCompare(b.team);
          })
          .map((row) => [
            row.team,
            String(row.wins),
            String(row.losses),
            row.status,
            row.rank === null ? "TBD" : String(row.rank),
          ]),
        startY: y,
      });
    }
  }

  // Optional audit log — separate final page, repeated entries collapsed.
  if (options.includeAuditLog && report.corrections.length > 0) {
    const grouped = groupAuditEntries(report.corrections);
    let auditY = addPage();
    auditY = drawSectionTitle("Corrections & Admin Actions", auditY + 2, ORANGE) + 2;
    const columns: TableColumn[] = [
      { header: "Qty", width: 14, align: "center", bold: true },
      { header: "Action", width: 46 },
      { header: "Match", width: 32 },
      { header: "Detail", width: 52 },
      { header: "Actor", width: 42 },
    ];
    let bodyY = drawTableHeader(columns, auditY, ORANGE);
    grouped.forEach((entry, index) => {
      if (bodyY + ROW_H > PAGE_BOTTOM) {
        bodyY = addPage();
        bodyY = drawSectionTitle(
          "Corrections & Admin Actions (continued)",
          bodyY,
          ORANGE
        );
        bodyY = drawTableHeader(columns, bodyY, ORANGE);
      }
      bodyY = drawTableRow(
        columns,
        [
          entry.count > 1 ? `x${entry.count}` : "1",
          entry.action,
          entry.matchId ?? "-",
          entry.detail || "-",
          entry.actor,
        ],
        bodyY,
        { zebra: index % 2 === 1 }
      );
    });
  }

  // Running headers and footers last: the total page count is known only now.
  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    if (page > 1) {
      pdf.setFont(undefined, "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...HEADER_BG);
      const headerSize = fitFontSize(pdf, runningHeader, CONTENT_W, 8.5, 6.5);
      pdf.setFontSize(headerSize);
      pdf.text(runningHeader, MARGIN, 9, { align: "left" });
      pdf.setDrawColor(...BORDER_GRAY);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN, 12, PAGE_W - MARGIN, 12);
    }
    pdf.setFont(undefined, "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...FOOTER_GRAY);
    pdf.text(
      `Page ${page} of ${totalPages}  |  Generated ${generatedDate}`,
      105,
      PAGE_H - 6,
      { align: "center" }
    );
  }
  pdf.setPage(totalPages);

  return pdf;
};

export const exportGsdeTournamentPdf = async (
  tournament: GsdeTournamentDocument,
  options: BuildGsdePdfOptions = {}
): Promise<void> => {
  const report = buildGsdeTournamentReport(tournament);
  const hasData =
    report.teams.length > 0 ||
    report.players.length > 0 ||
    report.groups.length > 0 ||
    report.groups.some((group) => group.results.length > 0) ||
    report.eliminationMatches.length > 0;

  if (!hasData) {
    alert("No GSDE tournament data available to export.");
    return;
  }

  try {
    const pdf = buildGsdePdf(report, options);
    pdf.save(
      `GSDE-${sanitize(report.title)}-${datePart(report.date || report.generatedAt)}.pdf`
    );
  } catch (error) {
    console.error("GSDE PDF export error:", error);
    alert(
      `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
