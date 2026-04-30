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
  gender?: string;
  match_number?: number;
  player1?: Player;
  player2?: Player;
  player3?: Player;
  player4?: Player;
  player1_id?: string;
  player2_id?: string;
  player3_id?: string;
  player4_id?: string;
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

    const getName = (match: Match, key: 'player1' | 'player2' | 'player3' | 'player4'): string => {
      const p = match[key];
      if (p?.name) return p.name;
      const id = match[`${key}_id` as keyof Match] as string;
      if (id) {
        const found = players.find(pl => pl.id === id);
        if (found?.name) return found.name;
      }
      return 'TBD';
    };

    const sortByNum = (a: Match, b: Match) => (a.match_number ?? 9999) - (b.match_number ?? 9999);
    const sortedFemale = [...femaleMatches].sort(sortByNum);
    const sortedMale   = [...maleMatches].sort(sortByNum);

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

    // Page 1: Female Division
    drawPageHeader();
    renderDivision(doc, sortedFemale, 'Female Division', ORANGE, getName, drawPageHeader);

    // Page 2: Male Division
    doc.addPage();
    drawPageHeader();
    renderDivision(doc, sortedMale, 'Male Division', BLUE, getName, drawPageHeader);

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

const renderDivision = (
  doc: jsPDF,
  matches: Match[],
  title: string,
  accent: [number, number, number],
  getName: (m: Match, k: 'player1' | 'player2' | 'player3' | 'player4') => string,
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

    drawMatchCard(doc, matches[i],     COL1_X, y, CARD_W, CARD_H, accent, getName);
    if (matches[i + 1]) {
      drawMatchCard(doc, matches[i + 1], COL2_X, y, CARD_W, CARD_H, accent, getName);
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
  getName: (m: Match, k: 'player1' | 'player2' | 'player3' | 'player4') => string
) => {
  const matchNum = match.match_number ?? '?';
  const completed = !!(match.is_completed || match.isSubmitted)
    && match.score1 !== undefined && match.score2 !== undefined;

  const teamA = `${getName(match, 'player1')} & ${getName(match, 'player2')}`;
  const teamB = `${getName(match, 'player3')} & ${getName(match, 'player4')}`;

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