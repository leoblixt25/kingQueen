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

// Color constants matching the app UI
const COLORS = {
  ocean: [0, 119, 182] as [number, number, number],      // Blue for Team A
  sunset: [255, 127, 80] as [number, number, number],      // Orange for Team B
  header: [0, 102, 153] as [number, number, number],      // Header blue
  text: {
    white: [255, 255, 255] as [number, number, number],
    black: [0, 0, 0] as [number, number, number],
    gray: [100, 100, 100] as [number, number, number],
    lightGray: [150, 150, 150] as [number, number, number]
  }
};

export const exportMatchupsToPDF = async (data: PDFExportData) => {
  try {
    console.log('Starting PDF export with app state data...');
    console.log('PDF DATA:', data);
    console.log('Female Matches:', data.femaleMatches);
    console.log('Male Matches:', data.maleMatches);
    console.log('Players:', data.players);
    
    const { players, femaleMatches, maleMatches, tournamentDate } = data;
    
    if (!players || (!femaleMatches && !maleMatches)) {
      alert('No tournament data available to export. Please ensure players are registered and matches are created.');
      return;
    }

    // Format tournament date
    let formattedDate = '';
    if (tournamentDate) {
      const dateObj = new Date(tournamentDate);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }

    // A4 size, 300 DPI quality settings
    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
      floatPrecision: 16
    });
    
    // Helper to draw header on each page
    const drawPageHeader = (pageNum: number) => {
      // Blue header bar
      doc.setFillColor(...COLORS.header);
      doc.rect(0, 0, 210, 35, 'F');
      
      // Title
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...COLORS.text.white);
      doc.text('King & Queen', 105, 14, { align: 'center' });
      doc.setFontSize(12);
      doc.text('Beach Volleyball Tournament', 105, 22, { align: 'center' });
      
      // Date
      if (formattedDate) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(formattedDate, 105, 30, { align: 'center' });
      }
    };
    
    // Helper to get player name from resolved player object - EXACT same logic as UI
    const getPlayerName = (match: Match, playerKey: 'player1' | 'player2' | 'player3' | 'player4'): string => {
      const player = match[playerKey];
      if (player && player.name) {
        return player.name;
      }
      
      // Fallback: try player_id if player object is missing
      const playerIdKey = `${playerKey}_id` as keyof Match;
      const playerId = match[playerIdKey] as string;
      if (playerId) {
        const foundPlayer = players.find(p => p.id === playerId);
        if (foundPlayer && foundPlayer.name) {
          return foundPlayer.name;
        }
      }
      
      console.warn(`Player not found for ${playerKey} in match:`, match);
      return 'TBD';
    };
    
    // Sort matches by match_number - EXACT same sort as UI with fallback
    const sortedFemaleMatches = [...femaleMatches].sort((a, b) => (a.match_number ?? 999) - (b.match_number ?? 999));
    const sortedMaleMatches = [...maleMatches].sort((a, b) => (a.match_number ?? 999) - (b.match_number ?? 999));
    
    // ====== PAGE 1: PLAYER ROSTER ======
    drawPageHeader(1);
    
    let yPosition = 45;
    
    // Player Roster Title
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...COLORS.header);
    doc.text('Player Roster', 14, yPosition);
    yPosition += 2;
    
    // Draw line under header
    doc.setDrawColor(...COLORS.header);
    doc.setLineWidth(0.5);
    doc.line(14, yPosition, 196, yPosition);
    yPosition += 6;
    
    // Filter players by gender
    const femalePlayers = players.filter(p => p.gender === 'female');
    const malePlayers = players.filter(p => p.gender === 'male');
    
    // Female Players
    if (femalePlayers.length > 0) {
      doc.setFillColor(255, 243, 224);
      doc.rect(14, yPosition - 4, 182, 6, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...COLORS.sunset);
      doc.text(`FEMALE DIVISION (${femalePlayers.length})`, 16, yPosition);
      yPosition += 5;
      
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...COLORS.text.black);
      
      femalePlayers.forEach((p, idx) => {
        // Alternating row colors
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(14, yPosition - 3.5, 182, 5, 'F');
        }
        doc.text(`${idx + 1}. ${p.name}`, 16, yPosition);
        yPosition += 5;
      });
      
      yPosition += 4;
    }
    
    // Male Players
    if (malePlayers.length > 0) {
      doc.setFillColor(224, 247, 255);
      doc.rect(14, yPosition - 4, 182, 6, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...COLORS.ocean);
      doc.text(`MALE DIVISION (${malePlayers.length})`, 16, yPosition);
      yPosition += 5;
      
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...COLORS.text.black);
      
      malePlayers.forEach((p, idx) => {
        // Alternating row colors
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(14, yPosition - 3.5, 182, 5, 'F');
        }
        doc.text(`${idx + 1}. ${p.name}`, 16, yPosition);
        yPosition += 5;
      });
    }
    
    // Force page break after player roster
    doc.addPage();
    
    // ====== PAGE 2: FEMALE DIVISION MATCHES ======
    // Page break before division - ensures division starts on fresh page
    doc.setPage(2);
    drawPageHeader(2);
    
    // Render female matches - SINGLE PAGE ONLY
    renderDivisionMatches(doc, sortedFemaleMatches, 'Female', COLORS.sunset, getPlayerName, players);
    
    // Force page break after female division
    doc.addPage();
    
    // ====== PAGE 3: MALE DIVISION MATCHES ======
    doc.setPage(3);
    drawPageHeader(3);
    
    // Render male matches - SINGLE PAGE ONLY
    renderDivisionMatches(doc, sortedMaleMatches, 'Male', COLORS.ocean, getPlayerName, players);
    
    // ====== FOOTER ======
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...COLORS.text.lightGray);
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Page ${i} of ${pageCount}`,
        105,
        292,
        { align: 'center' }
      );
    }
    
    console.log('PDF generated successfully with 3 pages, saving...');
    doc.save(`King-Queen-Beach-Volleyball-${new Date().toISOString().split('T')[0]}.pdf`);
    console.log('PDF saved!');
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert(`Failed to generate PDF: ${error.message || 'Unknown error'}\n\nPlease check the browser console for details.`);
    throw error;
  }
};

// Helper to calculate font size to fit text within a width
const getScaledFontSize = (
  doc: jsPDF,
  text: string,
  maxWidth: number,
  baseFontSize: number,
  minFontSize: number = 6
): number => {
  let fontSize = baseFontSize;
  doc.setFontSize(fontSize);
  
  while (doc.getTextWidth(text) > maxWidth && fontSize > minFontSize) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }
  
  return fontSize;
};

// Render a complete division on ONE page - NO page breaks within division
const renderDivisionMatches = (
  doc: jsPDF,
  matches: Match[],
  divisionName: string,
  accentColor: [number, number, number],
  getPlayerNameFn: (match: Match, playerKey: 'player1' | 'player2' | 'player3' | 'player4') => string,
  players: Player[]
): void => {
  if (matches.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text.gray);
    doc.text(`No ${divisionName} matches available.`, 105, 60, { align: 'center' });
    return;
  }
  
  // Division Header
  let yPosition = 42;
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...accentColor);
  doc.text(`${divisionName} Division`, 14, yPosition);
  yPosition += 2;
  
  // Underline with accent color
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(14, yPosition, 196, yPosition);
  yPosition += 6;
  
  // Compact card dimensions - tighter but readable
  const cardWidth = 88;
  const cardHeight = 18; // Tighter but still readable
  const gapX = 10;
  const gapY = 4;
  const leftX = 14;
  const rightX = 14 + cardWidth + gapX;
  const maxY = 270; // Safer margin to guarantee single page
  
  // Calculate available space and scale if needed
  const availableHeight = maxY - yPosition;
  const rowsNeeded = Math.ceil(matches.length / 2);
  const totalHeightNeeded = rowsNeeded * (cardHeight + gapY);
  
  // FORCE FIT: Ensure all matches fit on single page
  let scaleFactor = 1;
  const maxRows = Math.floor((maxY - yPosition) / (cardHeight + gapY));
  if (rowsNeeded > maxRows) {
    scaleFactor = maxRows / rowsNeeded;
  }
  // Clamp scale factor for readability
  scaleFactor = Math.min(scaleFactor, 1);
  scaleFactor = Math.max(scaleFactor, 0.6);
  
  const scaledCardHeight = cardHeight * scaleFactor;
  const scaledGapY = gapY * scaleFactor;
  
  // Render matches in 2-column grid
  for (let i = 0; i < matches.length; i += 2) {
    const match1 = matches[i];
    const match2 = matches[i + 1];
    
    // Check if we can fit this row
    if (yPosition + scaledCardHeight > maxY) {
      // Shouldn't happen with scaling, but just in case
      console.warn('Division overflow - scaling issue');
      break;
    }
    
    // Render Match 1 (left column)
    renderCompactMatchCard(
      doc,
      match1,
      leftX,
      yPosition,
      cardWidth,
      scaledCardHeight,
      getPlayerNameFn,
      players,
      accentColor
    );
    
    // Render Match 2 (right column) if exists
    if (match2) {
      renderCompactMatchCard(
        doc,
        match2,
        rightX,
        yPosition,
        cardWidth,
        scaledCardHeight,
        getPlayerNameFn,
        players,
        accentColor
      );
    }
    
    yPosition += scaledCardHeight + scaledGapY;
  }
};

// Render a compact match card matching UI layout
const renderCompactMatchCard = (
  doc: jsPDF,
  match: Match,
  x: number,
  y: number,
  width: number,
  height: number,
  getPlayerNameFn: (match: Match, playerKey: 'player1' | 'player2' | 'player3' | 'player4') => string,
  players: Player[],
  vsColor: [number, number, number]
): void => {
  const matchNumber = match.match_number || 0;
  const isCompleted = match.score1 !== undefined && match.score2 !== undefined && (match.is_completed || match.isSubmitted);
  
  // Team names - DIRECT from match object (exact same as UI)
  const teamAName = `${match.player1?.name || ''} & ${match.player2?.name || ''}`;
  const teamBName = `${match.player3?.name || ''} & ${match.player4?.name || ''}`;
  
  // Card shadow effect (subtle)
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(x + 0.5, y + 0.5, width, height, 2, 2, 'F');
  
  // Card background - white
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, height, 2, 2, 'F');
  
  // Card border
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 2, 2, 'S');
  
  // Match number label at top
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLORS.header);
  doc.text(`MATCH ${matchNumber}`, x + 3, y + 4);
  
  // Layout: Team A card (top), VS, Team B card (bottom)
  const teamCardHeight = (height - 10) / 2; // Space for match number and VS
  const teamCardWidth = width - 6;
  const teamAX = x + 3;
  const teamAY = y + 5;
  
  // Team A Card (Blue - matching UI bg-ocean)
  doc.setFillColor(...COLORS.ocean);
  doc.roundedRect(teamAX, teamAY, teamCardWidth, teamCardHeight - 1, 1.5, 1.5, 'F');
  // Add contrast border
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(teamAX, teamAY, teamCardWidth, teamCardHeight - 1, 1.5, 1.5, 'S');
  
  // Team A name - FULL name with wrapping (no truncation)
  doc.setTextColor(...COLORS.text.white);
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.text(teamAName, teamAX + teamCardWidth / 2, teamAY + teamCardHeight / 2, {
    align: 'center',
    maxWidth: teamCardWidth - 6
  });
  
  // Score for Team A (if completed)
  if (isCompleted) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(String(match.score1), teamAX + teamCardWidth - 4, teamAY + teamCardHeight / 2 + 1, { align: 'right' });
  }
  
  // VS Divider in middle
  const vsY = teamAY + teamCardHeight + 0.5;
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...vsColor);
  doc.text('VS', x + width / 2, vsY + 2, { align: 'center' });
  
  // Team B Card (Orange - matching UI bg-sunset)
  const teamBX = x + 3;
  const teamBY = vsY + 2.5;
  
  doc.setFillColor(...COLORS.sunset);
  doc.roundedRect(teamBX, teamBY, teamCardWidth, teamCardHeight - 1, 1.5, 1.5, 'F');
  // Add contrast border
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(teamBX, teamBY, teamCardWidth, teamCardHeight - 1, 1.5, 1.5, 'S');
  
  // Team B name - FULL name with wrapping (no truncation)
  doc.setTextColor(...COLORS.text.white);
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.text(teamBName, teamBX + teamCardWidth / 2, teamBY + teamCardHeight / 2, {
    align: 'center',
    maxWidth: teamCardWidth - 6
  });
  
  // Score for Team B (if completed)
  if (isCompleted) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(String(match.score2), teamBX + teamCardWidth - 4, teamBY + teamCardHeight / 2 + 1, { align: 'right' });
  }
};
