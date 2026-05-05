import jsPDF from 'jspdf';

interface Player {
  id?: string;
  name: string;
  gender?: string;
  points?: number;
  totalScores?: number;
}

interface Match {
  id?: string;
  gender?: 'male' | 'female';
  match_number?: number;
  teamA: [Player, Player];
  teamB: [Player, Player];
  score1: number;
  score2: number;
  is_completed?: boolean;
  isSubmitted?: boolean;
}

interface PDFExportData {
  players: Player[];
  femaleMatches: Match[];
  maleMatches: Match[];
  tournamentDate: string;
}

const BLUE: [number, number, number]      = [0, 119, 182];
const ORANGE: [number, number, number]    = [255, 127, 80];
const HEADER_BG: [number, number, number] = [0, 86, 130];
const WHITE: [number, number, number]     = [255, 255, 255];
const FOOTER_GRAY: [number, number, number] = [160, 160, 160];

/**
 * CRITICAL: Sort matches by match_number as NUMBER (not string)
 * This prevents Match 10 appearing before Match 2
 */
export function getOrderedMatches<T extends { match_number?: number }>(matches: T[]): T[] {
  return [...matches].sort((a, b) => Number(a.match_number ?? 9999) - Number(b.match_number ?? 9999));
}

export const exportMatchupsToPDF = async (data: PDFExportData) => {
  try {
    const { players, femaleMatches, maleMatches, tournamentDate } = data;

    if (!players || (!femaleMatches?.length && !maleMatches?.length)) {
      alert('No tournament data available to export.');
      return;
    }

    let formattedDate = '';
    if (tournamentDate) {
      const d = new Date(tournamentDate);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
      }
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const getTeamAName = (match: Match, index: 0 | 1): string => {
      return match.teamA[index]?.name || 'UNKNOWN';
    };
    const getTeamBName = (match: Match, index: 0 | 1): string => {
      return match.teamB[index]?.name || 'UNKNOWN';
    };

    // STRICT ORDERING: Sort female and male matches separately by match_number
    const sortedFemale = getOrderedMatches(femaleMatches);
    const sortedMale = getOrderedMatches(maleMatches);
    
    // DEBUG: Log exact match order before rendering
    console.log("PDF ORDER FEMALE:", sortedFemale.map(m => m.match_number));
    console.log("PDF ORDER MALE:", sortedMale.map(m => m.match_number));

    const drawPageHeader = () => {
      doc.setFillColor(...HEADER_BG);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(18);
      doc.text('King & Queen', 105, 11, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('Beach Volleyball Tournament', 105, 18, { align: 'center' });
      if (formattedDate) {
        doc.setFontSize(8);
        doc.text(formattedDate, 105, 25, { align: 'center' });
      }
    };

    // ===== Page 1: Registered Players =====
    drawPageHeader();
    renderPlayersRoster(doc, players, drawPageHeader);

    // ===== Page 2: Female Division Matches =====
    doc.addPage();
    drawPageHeader();
    renderDivision(doc, sortedFemale, 'Female Division', ORANGE, getTeamAName, getTeamBName, drawPageHeader);

    // ===== Page 3: Male Division Matches =====
    doc.addPage();
    drawPageHeader();
    renderDivision(doc, sortedMale, 'Male Division', BLUE, getTeamAName, getTeamBName, drawPageHeader);

    // Footer on all pages
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...FOOTER_GRAY);
      doc.text(
        `Generated ${new Date().toLocaleDateString()} | Page ${i} of ${total}`,
        105, 292, { align: 'center' }
      );
    }

    doc.save(`King-Queen-Beach-Volleyball-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (err: any) {
    console.error('PDF export error:', err);
    alert(`Failed to generate PDF: ${err.message || 'Unknown error'}`);
  }
};

const renderPlayersRoster = (
  doc: jsPDF,
  players: Player[],
  drawPageHeader: () => void
) => {
  // Sort players by name for consistent ordering (Female Player 1, 2, 3...)
  const femalePlayers = players
    .filter(p => p.gender === 'female')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const malePlayers = players
    .filter(p => p.gender === 'male')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  // Shared heading
  let y = 38;
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 86, 130);
  doc.text('Registered Players', 105, y, { align: 'center' });
  doc.setDrawColor(0, 86, 130);
  doc.setLineWidth(0.5);
  doc.line(11, y + 2, 199, y + 2);
  y += 10;

  // Two-column layout constants
  const COL_W = 90;       // width of each column
  const COL_GAP = 8;      // gap between columns
  const LEFT_X = 11;      // left column x (Female)
  const RIGHT_X = LEFT_X + COL_W + COL_GAP; // right column x (Male)
  const ROW_H = 5.5;      // row height per player
  const HEADER_H = 7;     // division header height

  // ── Helper: render a single division column ──
  const renderColumn = (
    list: Player[],
    colX: number,
    label: string,
    count: number,
    headerBg: [number, number, number],
    headerFg: [number, number, number]
  ) => {
    let cy = y;

    // Division header bar
    doc.setFillColor(...headerBg);
    doc.roundedRect(colX, cy - 4, COL_W, HEADER_H, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...headerFg);
    doc.text(`${label} (${count})`, colX + 4, cy + 0.5);
    cy += HEADER_H + 1;

    // Player rows
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);

    list.forEach((p, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(colX, cy - 3.5, COL_W, ROW_H, 'F');
      }
      doc.text(`${idx + 1}. ${p.name}`, colX + 4, cy);
      cy += ROW_H;
    });

    return cy; // return final y for this column
  };

  // Render both columns side by side
  const femaleEndY = renderColumn(
    femalePlayers, LEFT_X, 'FEMALE DIVISION', femalePlayers.length,
    [255, 243, 224], [255, 127, 80]
  );
  const maleEndY = renderColumn(
    malePlayers, RIGHT_X, 'MALE DIVISION', malePlayers.length,
    [224, 247, 255], [0, 119, 182]
  );

  // Vertical divider between columns
  const dividerTop = y - 4;
  const dividerBot = Math.max(femaleEndY, maleEndY);
  doc.setDrawColor(210, 218, 226);
  doc.setLineWidth(0.3);
  doc.line(LEFT_X + COL_W + COL_GAP / 2, dividerTop, LEFT_X + COL_W + COL_GAP / 2, dividerBot);
};

const renderDivision = (
  doc: jsPDF,
  matches: Match[],
  title: string,
  accent: [number, number, number],
  getTeamAName: (m: Match, i: 0 | 1) => string,
  getTeamBName: (m: Match, i: 0 | 1) => string,
  drawPageHeader: () => void
) => {
  if (!matches.length) {
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text('No matches available.', 105, 55, { align: 'center' });
    return;
  }

  // Card dimensions — large enough to clearly read names
  const CARD_W  = 88;
  const CARD_H  = 30;
  const COL_GAP = 10;
  const ROW_GAP = 4;
  const COL1_X  = 11;
  const COL2_X  = COL1_X + CARD_W + COL_GAP;
  const PAGE_BOT = 283;

  const drawTitle = (y: number, continued = false) => {
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...accent);
    doc.text(continued ? `${title} (continued)` : title, COL1_X, y);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.5);
    doc.line(COL1_X, y + 2, 199, y + 2);
    return y + 8;
  };

  let y = drawTitle(36);

  for (let i = 0; i < matches.length; i += 2) {
    if (y + CARD_H > PAGE_BOT) {
      doc.addPage();
      drawPageHeader();
      y = drawTitle(36, true);
    }

    drawMatchCard(doc, matches[i],     COL1_X, y, CARD_W, CARD_H, accent, getTeamAName, getTeamBName);
    if (matches[i + 1]) {
      drawMatchCard(doc, matches[i + 1], COL2_X, y, CARD_W, CARD_H, accent, getTeamAName, getTeamBName);
    }
    y += CARD_H + ROW_GAP;
  }
};

const drawMatchCard = (
  doc: jsPDF,
  match: Match,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: [number, number, number],
  getTeamAName: (m: Match, i: 0 | 1) => string,
  getTeamBName: (m: Match, i: 0 | 1) => string
) => {
  const matchNum = match.match_number ?? '?';
  const completed = !!(match.is_completed || match.isSubmitted)
    && match.score1 !== undefined && match.score2 !== undefined;

  const teamA = `${getTeamAName(match, 0)} & ${getTeamAName(match, 1)}`;
  const teamB = `${getTeamBName(match, 0)} & ${getTeamBName(match, 1)}`;

  // Card background
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(210, 218, 226);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');

  // Match label strip
  const labelH = 6;
  doc.setFillColor(232, 240, 248);
  doc.roundedRect(x, y, w, labelH, 2.5, 2.5, 'F');
  doc.rect(x, y + 2, w, labelH - 2, 'F'); // flatten bottom

  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 70, 110);
  doc.text(`MATCH ${matchNum}`, x + 4, y + 4.2);

  // Bar layout
  const PAD    = 2.5;
  const barX   = x + PAD;
  const barW   = w - PAD * 2;
  const inner  = h - labelH - 2;
  const barH   = (inner - 5) / 2;  // 5mm for VS gap
  const barY1  = y + labelH + 1;
  const vsY    = barY1 + barH;
  const barY2  = vsY + 5;

  // score box right-reserved width
  const scoreReserve = completed ? 11 : 0;
  const nameMaxW = barW - scoreReserve - 6;

  // ── Team A (blue) ──
  doc.setFillColor(...BLUE);
  doc.roundedRect(barX, barY1, barW, barH, 1.5, 1.5, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont(undefined, 'bold');
  const fsA = fitFontSize(doc, teamA, nameMaxW, 9, 6.5);
  doc.setFontSize(fsA);
  doc.text(teamA, barX + 3.5, barY1 + barH / 2 + fsA * 0.185);

  if (completed) {
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(String(match.score1), barX + barW - 2.5, barY1 + barH / 2 + 3.5, { align: 'right' });
  }

  // ── VS ──
  doc.setFontSize(7.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accent);
  doc.text('VS', x + w / 2, vsY + 3.5, { align: 'center' });

  // ── Team B (orange) ──
  doc.setFillColor(...ORANGE);
  doc.roundedRect(barX, barY2, barW, barH, 1.5, 1.5, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont(undefined, 'bold');
  const fsB = fitFontSize(doc, teamB, nameMaxW, 9, 6.5);
  doc.setFontSize(fsB);
  doc.text(teamB, barX + 3.5, barY2 + barH / 2 + fsB * 0.185);

  if (completed) {
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(String(match.score2), barX + barW - 2.5, barY2 + barH / 2 + 3.5, { align: 'right' });
  }
};

// Shrink font until text fits within maxWidth
const fitFontSize = (doc: jsPDF, text: string, maxW: number, base: number, min: number): number => {
  let size = base;
  doc.setFontSize(size);
  while (doc.getTextWidth(text) > maxW && size > min) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
};