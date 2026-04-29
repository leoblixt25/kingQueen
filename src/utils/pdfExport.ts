import { db } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import jsPDF from 'jspdf';

interface Player {
  id: string;
  name: string;
  gender: string;
  position?: number;
  email?: string;
}

interface Match {
  id: string;
  gender: string;
  match_number: number;
  player1_id: string;
  player2_id: string;
  player3_id: string;
  player4_id: string;
  score1: number;
  score2: number;
  is_completed: boolean;
}

export const exportMatchupsToPDF = async () => {
  try {
    console.log('Starting PDF export...');
    
    const doc = new jsPDF();
    
    // Load approved players (fallback to is_confirmed for backward compatibility)
    const playersRef = collection(db, 'players');
    let players: Player[] = [];
    
    try {
      const playersQuery = query(playersRef, where('status', '==', 'approved'));
      const playersSnapshot = await getDocs(playersQuery);
      players = playersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      console.log('Loaded approved players:', players.length);
    } catch (error) {
      console.warn('Failed to load by status, trying is_confirmed...');
      const fallbackQuery = query(playersRef, where('is_confirmed', '==', true));
      const fallbackSnapshot = await getDocs(fallbackQuery);
      players = fallbackSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      console.log('Loaded players via fallback:', players.length);
    }

    // Load tournament settings for date
    let tournamentDate = '';
    try {
      const settingsRef = collection(db, 'tournamentSettings');
      const settingsSnapshot = await getDocs(settingsRef);
      if (!settingsSnapshot.empty) {
        const settingsData = settingsSnapshot.docs[0].data() as any;
        console.log('Tournament settings loaded:', settingsData);
        if (settingsData.tournament_date) {
          const dateObj = new Date(settingsData.tournament_date);
          tournamentDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          console.log('Tournament date formatted:', tournamentDate);
        } else {
          console.warn('No tournament_date field in settings');
        }
      } else {
        console.warn('No tournament settings found in database');
      }
    } catch (error) {
      console.error('Could not load tournament date:', error);
    }

    // Load matches
    const matchesRef = collection(db, 'matches');
    let matches: Match[] = [];
    try {
      const matchesSnapshot = await getDocs(matchesRef);
      matches = matchesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      // Sort matches by match_number
      matches.sort((a, b) => a.match_number - b.match_number);
      console.log('Loaded matches:', matches.length);
    } catch (error) {
      console.error('Error loading matches:', error);
    }

    if (players.length === 0 && matches.length === 0) {
      alert('No tournament data available to export. Please ensure players are registered and matches are created.');
      return;
    }

    // ====== PDF HEADER ======
    doc.setFillColor(0, 102, 153);
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setFontSize(28);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('King & Queen', 105, 18, { align: 'center' });
    doc.text('Beach Volleyball Tournament', 105, 28, { align: 'center' });
    
    if (tournamentDate) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text(tournamentDate, 105, 37, { align: 'center' });
    }
    
    let yPosition = 55;
    
    // Helper to add new page if needed
    const checkPageBreak = (needed: number = 20) => {
      if (yPosition + needed > 275) {
        doc.addPage();
        yPosition = 20;
      }
    };
    
    // Helper to get player name by ID
    const getPlayerName = (playerId: string): string => {
      const player = players.find(p => p.id === playerId);
      return player ? player.name : 'TBD';
    };
    
    // ====== PLAYER ROSTER ======
    const femalePlayers = players.filter(p => p.gender === 'female');
    const malePlayers = players.filter(p => p.gender === 'male');
    
    if (femalePlayers.length > 0 || malePlayers.length > 0) {
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
      
      // Female Players
      if (femalePlayers.length > 0) {
        checkPageBreak(15 + femalePlayers.length * 7);
        
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
          checkPageBreak(7);
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
        checkPageBreak(15 + malePlayers.length * 7);
        
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
          checkPageBreak(7);
          // Alternating row colors
          if (idx % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(14, yPosition - 4, 182, 6, 'F');
          }
          doc.text(`${idx + 1}. ${p.name}`, 16, yPosition);
          yPosition += 6;
        });
        
        yPosition += 8;
      }
    }
    
    // ====== MATCH SCHEDULE ======
    if (matches.length > 0) {
      checkPageBreak(25);
      
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 102, 153);
      doc.text('Match Schedule', 14, yPosition);
      yPosition += 3;
      
      doc.setDrawColor(0, 102, 153);
      doc.setLineWidth(0.5);
      doc.line(14, yPosition, 196, yPosition);
      yPosition += 10;
      
      const femaleMatches = matches.filter(m => m.gender === 'female');
      const maleMatches = matches.filter(m => m.gender === 'male');
      
      // Helper to render matches in 2-column grid
      const renderMatchGrid = (matchesList: Match[], divisionColor: [number, number, number], divisionName: string) => {
        if (matchesList.length === 0) return;
        
        // Division header
        checkPageBreak(20);
        doc.setFillColor(divisionColor[0], divisionColor[1], divisionColor[2]);
        doc.rect(14, yPosition - 5, 182, 8, 'F');
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(divisionName, 16, yPosition);
        yPosition += 8;
        
        // Render matches in pairs (2 per row)
        for (let i = 0; i < matchesList.length; i += 2) {
          const match1 = matchesList[i];
          const match2 = matchesList[i + 1];
          
          // Check if we need a new page
          checkPageBreak(40);
          
          const cardWidth = 88;
          const cardHeight = 32;
          const gap = 8;
          const leftX = 14;
          const rightX = 14 + cardWidth + gap;
          
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
          doc.text(`MATCH ${match1.match_number}`, leftX + 3, yPosition + 5);
          
          // Team names
          const team1_1 = getPlayerName(match1.player1_id) + ' & ' + getPlayerName(match1.player2_id);
          const team2_1 = getPlayerName(match1.player3_id) + ' & ' + getPlayerName(match1.player4_id);
          
          doc.setFontSize(8);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(0, 0, 0);
          
          // Team 1 with score
          if (match1.is_completed) {
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
          if (match1.is_completed) {
            doc.text(team2_1.substring(0, 28), leftX + 3, yPosition + 22);
            doc.text(String(match1.score2), leftX + cardWidth - 3, yPosition + 22, { align: 'right' });
          } else {
            doc.text(team2_1.substring(0, 32), leftX + 3, yPosition + 22);
          }
          
          // ====== MATCH 2 CARD (if exists) ======
          if (match2) {
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
            doc.text(`MATCH ${match2.match_number}`, rightX + 3, yPosition + 5);
            
            // Team names
            const team1_2 = getPlayerName(match2.player1_id) + ' & ' + getPlayerName(match2.player2_id);
            const team2_2 = getPlayerName(match2.player3_id) + ' & ' + getPlayerName(match2.player4_id);
            
            doc.setFontSize(8);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0);
            
            // Team 1 with score
            if (match2.is_completed) {
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
            if (match2.is_completed) {
              doc.text(team2_2.substring(0, 28), rightX + 3, yPosition + 22);
              doc.text(String(match2.score2), rightX + cardWidth - 3, yPosition + 22, { align: 'right' });
            } else {
              doc.text(team2_2.substring(0, 32), rightX + 3, yPosition + 22);
            }
          }
          
          yPosition += cardHeight + 4;
        }
        
        yPosition += 5;
      };
      
      // Render female matches
      renderMatchGrid(femaleMatches, [255, 127, 80], 'FEMALE DIVISION');
      
      // Render male matches
      renderMatchGrid(maleMatches, [0, 153, 204], 'MALE DIVISION');
    }
    
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
    
    console.log('PDF generated successfully, saving...');
    // Save the PDF
    doc.save(`King-Queen-Beach-Volleyball-${new Date().toISOString().split('T')[0]}.pdf`);
    console.log('PDF saved!');
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert(`Failed to generate PDF: ${error.message || 'Unknown error'}\n\nPlease check the browser console for details.`);
    throw error;
  }
};
