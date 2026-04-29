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

    const doc = new jsPDF();
    
    // Helper to draw header on each page
    const drawPageHeader = (pageNum: number) => {
      // Blue header bar
      doc.setFillColor(0, 102, 153);
      doc.rect(0, 0, 210, 45, 'F');
      
      // Title
      doc.setFontSize(28);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('King & Queen', 105, 18, { align: 'center' });
      doc.text('Beach Volleyball Tournament', 105, 28, { align: 'center' });
      
      // Date
      if (formattedDate) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(formattedDate, 105, 37, { align: 'center' });
      }
    };
    
    // Helper to get player name from resolved player object
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
    
    // Sort matches by match_number
    const sortedFemaleMatches = [...femaleMatches].sort((a, b) => a.match_number - b.match_number);
    const sortedMaleMatches = [...maleMatches].sort((a, b) => a.match_number - b.match_number);
    
    // ====== PAGE 1: PLAYER ROSTER ======
    drawPageHeader(1);
    
    let yPosition = 55;
    
    // Player Roster Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 153);
    doc.text('Player Roster', 14, yPosition);
    yPosition += 3;
    
    // Draw line under header
    doc.setDrawColor(0, 102, 153);
    doc.setLineWidth(0.5);
    doc.line(14, yPosition, 196, yPosition);
    yPosition += 8;
    
    // Filter players by gender
    const femalePlayers = players.filter(p => p.gender === 'female');
    const malePlayers = players.filter(p => p.gender === 'male');
    
    // Female Players
    if (femalePlayers.length > 0) {
      doc.setFillColor(255, 243, 224);
      doc.rect(14, yPosition - 5, 182, 7, 'F');
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 127, 80);
      doc.text(`FEMALE DIVISION (${femalePlayers.length})`, 16, yPosition);
      yPosition += 6;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      femalePlayers.forEach((p, idx) => {
        // Alternating row colors
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(14, yPosition - 4, 182, 6, 'F');
        }
        doc.text(`${idx + 1}. ${p.name}`, 16, yPosition);
        yPosition += 6;
      });
      
      yPosition += 5;
    }
    
    // Male Players
    if (malePlayers.length > 0) {
      doc.setFillColor(224, 247, 255);
      doc.rect(14, yPosition - 5, 182, 7, 'F');
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 153, 204);
      doc.text(`MALE DIVISION (${malePlayers.length})`, 16, yPosition);
      yPosition += 6;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      malePlayers.forEach((p, idx) => {
        // Alternating row colors
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(14, yPosition - 4, 182, 6, 'F');
        }
        doc.text(`${idx + 1}. ${p.name}`, 16, yPosition);
        yPosition += 6;
      });
    }
    
    // Force page break after player roster
    doc.addPage();
    
    // ====== PAGE 2: FEMALE DIVISION MATCHES ======
    drawPageHeader(2);
    
    yPosition = 55;
    
    // Female Division Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 127, 80);
    doc.text('Female Division', 14, yPosition);
    yPosition += 3;
    
    doc.setDrawColor(255, 127, 80);
    doc.setLineWidth(0.5);
    doc.line(14, yPosition, 196, yPosition);
    yPosition += 10;
    
    // Render female matches in 2-column grid
    yPosition = renderMatchGrid(doc, sortedFemaleMatches, [255, 127, 80], getPlayerName, yPosition);
    
    // Force page break after female matches
    doc.addPage();
    
    // ====== PAGE 3: MALE DIVISION MATCHES ======
    drawPageHeader(3);
    
    yPosition = 55;
    
    // Male Division Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 153, 204);
    doc.text('Male Division', 14, yPosition);
    yPosition += 3;
    
    doc.setDrawColor(0, 153, 204);
    doc.setLineWidth(0.5);
    doc.line(14, yPosition, 196, yPosition);
    yPosition += 10;
    
    // Render male matches in 2-column grid
    yPosition = renderMatchGrid(doc, sortedMaleMatches, [0, 153, 204], getPlayerName, yPosition);
    
    // ====== FOOTER ======
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Page ${i} of ${pageCount}`,
        105,
        290,
        { align: 'center' }
      );
    }
    
    console.log('PDF generated successfully with 3 pages, saving...');
    // Save the PDF
    doc.save(`King-Queen-Beach-Volleyball-${new Date().toISOString().split('T')[0]}.pdf`);
    console.log('PDF saved!');
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert(`Failed to generate PDF: ${error.message || 'Unknown error'}\n\nPlease check the browser console for details.`);
    throw error;
  }
};

    // Helper function to render matches in 2-column grid
const renderMatchGrid = (
  doc: jsPDF,
  matchesList: Match[],
  divisionColor: [number, number, number],
  getPlayerNameFn: (match: Match, playerKey: 'player1' | 'player2' | 'player3' | 'player4') => string,
  startY: number
): number => {
  if (matchesList.length === 0) return startY;
  
  console.log(`Rendering ${matchesList.length} matches in grid`);
  console.log('First match sample:', matchesList[0]);
  
  let yPosition = startY;
  
  // Render matches in pairs (2 per row) - DO NOT SORT, use as-is
  for (let i = 0; i < matchesList.length; i += 2) {
    const match1 = matchesList[i];
    const match2 = matchesList[i + 1];
    
    const cardWidth = 88;
    const cardHeight = 32;
    const gap = 8;
    const leftX = 14;
    const rightX = 14 + cardWidth + gap;
    
    // Check if we need a new page
    if (yPosition + cardHeight + 4 > 275) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Get match number from app data
    const match1Number = match1.match_number || (i + 1);
    console.log(`Match ${match1Number}:`, {
      player1: getPlayerNameFn(match1, 'player1'),
      player2: getPlayerNameFn(match1, 'player2'),
      player3: getPlayerNameFn(match1, 'player3'),
      player4: getPlayerNameFn(match1, 'player4'),
      score1: match1.score1,
      score2: match1.score2,
      isCompleted: match1.is_completed || match1.isSubmitted
    });
    
    // ====== MATCH 1 CARD ======
    // Card background
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(leftX, yPosition, cardWidth, cardHeight, 2, 2, 'F');
    
    // Card border
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(leftX, yPosition, cardWidth, cardHeight, 2, 2, 'S');
    
    // Match number
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 153);
    doc.text(`MATCH ${match1Number}`, leftX + 3, yPosition + 5);
    
    // Team names - USE EXACT PLAYER DATA FROM APP
    const team1_1 = getPlayerNameFn(match1, 'player1') + ' & ' + getPlayerNameFn(match1, 'player2');
    const team2_1 = getPlayerNameFn(match1, 'player3') + ' & ' + getPlayerNameFn(match1, 'player4');
    
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    
    // Team 1 with score
    const isCompleted1 = match1.is_completed || match1.isSubmitted || false;
    if (isCompleted1) {
      doc.text(team1_1.substring(0, 28), leftX + 3, yPosition + 12);
      doc.text(String(match1.score1), leftX + cardWidth - 3, yPosition + 12, { align: 'right' });
    } else {
      doc.text(team1_1.substring(0, 32), leftX + 3, yPosition + 12);
    }
    
    // VS divider
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('vs', leftX + cardWidth / 2, yPosition + 17, { align: 'center' });
    
    // Team 2 with score
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    if (isCompleted1) {
      doc.text(team2_1.substring(0, 28), leftX + 3, yPosition + 22);
      doc.text(String(match1.score2), leftX + cardWidth - 3, yPosition + 22, { align: 'right' });
    } else {
      doc.text(team2_1.substring(0, 32), leftX + 3, yPosition + 22);
    }
    
    // ====== MATCH 2 CARD (if exists) ======
    if (match2) {
      const match2Number = match2.match_number || (i + 2);
      
      // Card background
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(rightX, yPosition, cardWidth, cardHeight, 2, 2, 'F');
      
      // Card border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(rightX, yPosition, cardWidth, cardHeight, 2, 2, 'S');
      
      // Match number
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 102, 153);
      doc.text(`MATCH ${match2Number}`, rightX + 3, yPosition + 5);
      
      // Team names - USE EXACT PLAYER DATA FROM APP
      const team1_2 = getPlayerNameFn(match2, 'player1') + ' & ' + getPlayerNameFn(match2, 'player2');
      const team2_2 = getPlayerNameFn(match2, 'player3') + ' & ' + getPlayerNameFn(match2, 'player4');
      
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      
      // Team 1 with score
      const isCompleted2 = match2.is_completed || match2.isSubmitted || false;
      if (isCompleted2) {
        doc.text(team1_2.substring(0, 28), rightX + 3, yPosition + 12);
        doc.text(String(match2.score1), rightX + cardWidth - 3, yPosition + 12, { align: 'right' });
      } else {
        doc.text(team1_2.substring(0, 32), rightX + 3, yPosition + 12);
      }
      
      // VS divider
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('vs', rightX + cardWidth / 2, yPosition + 17, { align: 'center' });
      
      // Team 2 with score
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      if (isCompleted2) {
        doc.text(team2_2.substring(0, 28), rightX + 3, yPosition + 22);
        doc.text(String(match2.score2), rightX + cardWidth - 3, yPosition + 22, { align: 'right' });
      } else {
        doc.text(team2_2.substring(0, 32), rightX + 3, yPosition + 22);
      }
    }
    
    yPosition += cardHeight + 4;
  }
  
  return yPosition;
};
