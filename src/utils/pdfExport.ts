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

const BLUE: [number, number, number] = [0, 119, 182];
const ORANGE: [number, number, number] = [255, 127, 80];
const HEADER_BLUE: [number, number, number] = [0, 86, 130];
const WHITE: [number, number, number] = [255, 255, 255];
const LIGHT_GRAY: [number, number, number] = [150, 150, 150];
const DARK_TEXT: [number, number, number] = [40, 40, 40];
const CARD_BG: [number, number, number] = [248, 249, 250];
const BORDER: [number, number, number] = [220, 225, 230];

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

    const drawHeader = () => {
      doc.setFillColor(...HEADER_BLUE);
      doc.rect(0, 0, 210, 32, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(20);
      doc.text('King & Queen', 105, 13, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text('Beach Volleyball Tournament', 105, 21, { align: 'center' });
      if (formattedDate) {
        doc.setFontSize(8);
        doc.text(formattedDate, 105, 28, { align: 'center' });
      }
    };

    const getPlayerName = (match: Match, key: 'player1' | 'player2' | 'player3' | 'player4'): string => {
      const p = match[key];
      if (p?.name) return p.name;
      const idKey = `${key}_id` as keyof Match;
      const id = match[idKey] as string;
      if (id) {
        const found = players.find(p => p.id === id);
        if (found?.name) return found.name;
      }
      return 'TBD';
    };

    // Sort by actual match_number from Firestore
    const sortByMatchNum = (a: Match, b: Match) => (a.match_number ?? 9999) - (b.match_number ?? 9999);
    const sortedFemale = [...femaleMatches].sort(sortByMatchNum);
    const sortedMale = [...maleMatches].sort(sortByMatchNum);

    // ── Page 1: Female Division ──
    drawHeader();
    renderDivision(doc, sortedFemale, 'Female Division', ORANGE, getPlayerName);

    // ── Page 2: Male Division ──
    doc.addPage();
    drawHeader();
    renderDivision(doc, sortedMale, 'Male Division', BLUE, getPlayerName);

    // Footer on all pages
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...LIGHT_GRAY);
      doc.text(
        `Generated ${new Date().toLocaleDateString()} | Page ${i} of ${total}`,
        105, 292, { align: 'center' }
      );
    }

    doc.save(`King-Queen-Beach-Volleyball-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error: any) {
    console.error('PDF export error:', error);
    alert(`Failed to generate PDF: ${error.message || 'Unknown error'}`);
  }
};

const renderDivision = (
  doc: jsPDF,
  matches: Match[],
  title: string,
  accentColor: [number, number, number],
  getPlayerName: (match: Match, key: 'player1' | 'player2' | 'player3' | 'player4') => string
) => {
  if (!matches.length) {
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`No matches available.`, 105, 55, { align: 'center' });
    return;
  }

  // Division title
  let y = 42;
  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accentColor);
  doc.text(title, 14, y);
  y += 2;
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.6);
  doc.line(14, y, 196, y);
  y += 7;

  // Card dimensions — 2 columns
  const colW = 88;
  const colGap = 10;
  const col1X = 14;
  const col2X = col1X + colW + colGap;
  const cardH = 22;
  const rowGap = 5;

  for (let i = 0; i < matches.length; i += 2) {
    if (y + cardH > 285) {
      // Add new page if overflow
      doc.addPage();
      // Redraw header + division continuation
      doc.setFillColor(0, 86, 130);
      doc.rect(0, 0, 210, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text(`${title} (continued)`, 105, 20, { align: 'center' });
      y = 40;
    }

    renderMatchCard(doc, matches[i], col1X, y, colW, cardH, getPlayerName, accentColor);
    if (matches[i + 1]) {
      renderMatchCard(doc, matches[i + 1], col2X, y, colW, cardH, getPlayerName, accentColor);
    }
    y += cardH + rowGap;
  }
};

const renderMatchCard = (
  doc: jsPDF,
  match: Match,
  x: number,
  y: number,
  w: number,
  h: number,
  getPlayerName: (match: Match, key: 'player1' | 'player2' | 'player3' | 'player4') => string,
  accentColor: [number, number, number]
) => {
  const matchNum = match.match_number ?? '?';
  const isCompleted = !!(match.is_completed || match.isSubmitted) &&
    match.score1 !== undefined && match.score2 !== undefined;

  const teamA = `${getPlayerName(match, 'player1')} & ${getPlayerName(match, 'player2')}`;
  const teamB = `${getPlayerName(match, 'player3')} & ${getPlayerName(match, 'player4')}`;

  // Card background
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Match number row
  const matchLabelH = 5;
  doc.setFillColor(240, 243, 246);
  doc.roundedRect(x, y, w, matchLabelH, 2, 2, 'F');
  // flat bottom for label strip
  doc.setFillColor(240, 243, 246);
  doc.rect(x, y + 2, w, matchLabelH - 2, 'F');

  doc.setFontSize(6.5);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 86, 130);
  doc.text(`MATCH ${matchNum}`, x + 3, y + 3.8);

  // Team bar dimensions
  const barY1 = y + matchLabelH + 1;
  const barH = (h - matchLabelH - 5) / 2; // split remaining height in 2
  const vsH = 3;
  const barY2 = barY1 + barH + vsH;
  const barX = x + 2;
  const barW = w - 4;
  const scoreW = isCompleted ? 9 : 0;
  const nameW = barW - scoreW - 4;

  // Team A bar (blue)
  doc.setFillColor(0, 119, 182);
  doc.roundedRect(barX, barY1, barW, barH, 1.5, 1.5, 'F');

  // Team A name — centered vertically, left-padded
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont(undefined, 'bold');
  const teamADisplay = fitText(doc, teamA, nameW, 6.5);
  doc.text(teamADisplay, barX + 3, barY1 + barH / 2 + 2.2);

  // Team A score — right aligned inside bar
  if (isCompleted) {
    doc.setFontSize(8);
    doc.text(String(match.score1), barX + barW - 2, barY1 + barH / 2 + 2.5, { align: 'right' });
  }

  // VS label
  doc.setFontSize(6);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accentColor);
  doc.text('VS', x + w / 2, barY1 + barH + 2.2, { align: 'center' });

  // Team B bar (orange)
  doc.setFillColor(255, 127, 80);
  doc.roundedRect(barX, barY2, barW, barH, 1.5, 1.5, 'F');

  // Team B name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont(undefined, 'bold');
  const teamBDisplay = fitText(doc, teamB, nameW, 6.5);
  doc.text(teamBDisplay, barX + 3, barY2 + barH / 2 + 2.2);

  // Team B score
  if (isCompleted) {
    doc.setFontSize(8);
    doc.text(String(match.score2), barX + barW - 2, barY2 + barH / 2 + 2.5, { align: 'right' });
  }
};

// Truncate text with ellipsis to fit within maxWidth
const fitText = (doc: jsPDF, text: string, maxWidth: number, fontSize: number): string => {
  doc.setFontSize(fontSize);
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 3 && doc.getTextWidth(t + '…') > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
};