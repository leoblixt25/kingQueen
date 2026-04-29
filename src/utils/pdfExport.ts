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
        if (settingsData.tournament_date) {
          tournamentDate = new Date(settingsData.tournament_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      }
    } catch (error) {
      console.warn('Could not load tournament date:', error);
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
      yPosition += 8;
      
      const femaleMatches = matches.filter(m => m.gender === 'female');
      const maleMatches = matches.filter(m => m.gender === 'male');
      
      // Female Matches
      if (femaleMatches.length > 0) {
        checkPageBreak(20 + femaleMatches.length * 18);
        
        doc.setFillColor(255, 243, 224);
        doc.rect(14, yPosition - 5, 182, 8, 'F');
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 127, 80);
        doc.text('FEMALE DIVISION', 16, yPosition);
        yPosition += 7;
        
        femaleMatches.forEach((m, idx) => {
          checkPageBreak(18);
          
          const team1 = `${getPlayerName(m.player1_id)} & ${getPlayerName(m.player2_id)}`;
          const team2 = `${getPlayerName(m.player3_id)} & ${getPlayerName(m.player4_id)}`;
          const score = m.is_completed ? `${m.score1} - ${m.score2}` : 'TBD';
          
          // Match box background
          doc.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 250 : 248, idx % 2 === 0 ? 245 : 240);
          doc.rect(14, yPosition - 4, 182, 16, 'F');
          
          // Match number
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(0, 102, 153);
          doc.text(`Match ${m.match_number}`, 16, yPosition);
          
          // Team A
          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text('Team A:', 16, yPosition + 5);
          doc.setFont(undefined, 'bold');
          doc.text(team1.substring(0, 60), 32, yPosition + 5);
          
          // Team B
          doc.setFont(undefined, 'normal');
          doc.text('Team B:', 16, yPosition + 10);
          doc.setFont(undefined, 'bold');
          doc.text(team2.substring(0, 60), 32, yPosition + 10);
          
          // Result
          doc.setFont(undefined, 'bold');
          doc.setTextColor(m.is_completed ? 76 : 150, m.is_completed ? 175 : 150, m.is_completed ? 80 : 150);
          doc.text(`Result: ${score}`, 150, yPosition + 10, { align: 'right' });
          
          yPosition += 18;
        });
        
        yPosition += 5;
      }
      
      // Male Matches
      if (maleMatches.length > 0) {
        checkPageBreak(20 + maleMatches.length * 18);
        
        doc.setFillColor(224, 247, 255);
        doc.rect(14, yPosition - 5, 182, 8, 'F');
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 153, 204);
        doc.text('MALE DIVISION', 16, yPosition);
        yPosition += 7;
        
        maleMatches.forEach((m, idx) => {
          checkPageBreak(18);
          
          const team1 = `${getPlayerName(m.player1_id)} & ${getPlayerName(m.player2_id)}`;
          const team2 = `${getPlayerName(m.player3_id)} & ${getPlayerName(m.player4_id)}`;
          const score = m.is_completed ? `${m.score1} - ${m.score2}` : 'TBD';
          
          // Match box background
          doc.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 250 : 248, idx % 2 === 0 ? 245 : 240);
          doc.rect(14, yPosition - 4, 182, 16, 'F');
          
          // Match number
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(0, 102, 153);
          doc.text(`Match ${m.match_number}`, 16, yPosition);
          
          // Team A
          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text('Team A:', 16, yPosition + 5);
          doc.setFont(undefined, 'bold');
          doc.text(team1.substring(0, 60), 32, yPosition + 5);
          
          // Team B
          doc.setFont(undefined, 'normal');
          doc.text('Team B:', 16, yPosition + 10);
          doc.setFont(undefined, 'bold');
          doc.text(team2.substring(0, 60), 32, yPosition + 10);
          
          // Result
          doc.setFont(undefined, 'bold');
          doc.setTextColor(m.is_completed ? 76 : 150, m.is_completed ? 175 : 150, m.is_completed ? 80 : 150);
          doc.text(`Result: ${score}`, 150, yPosition + 10, { align: 'right' });
          
          yPosition += 18;
        });
      }
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
