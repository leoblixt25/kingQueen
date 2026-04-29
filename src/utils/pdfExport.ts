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

    // Load matches
    const matchesRef = collection(db, 'matches');
    let matches: Match[] = [];
    try {
      const matchesSnapshot = await getDocs(matchesRef);
      matches = matchesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      console.log('Loaded matches:', matches.length);
    } catch (error) {
      console.error('Error loading matches:', error);
    }

    if (players.length === 0 && matches.length === 0) {
      alert('No tournament data available to export. Please ensure players are registered and matches are created.');
      return;
    }

    // Tournament Header
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 153);
    doc.text('Beach Volleyball Tournament', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
    let yPosition = 40;
    
    // Helper to add new page if needed
    const checkPageBreak = (needed: number = 20) => {
      if (yPosition + needed > 280) {
        doc.addPage();
        yPosition = 20;
      }
    };
    
    // Helper to get player name by ID
    const getPlayerName = (playerId: string): string => {
      const player = players.find(p => p.id === playerId);
      return player ? player.name : 'TBD';
    };
    
    // Player List Section
    const femalePlayers = players.filter(p => p.gender === 'female');
    const malePlayers = players.filter(p => p.gender === 'male');
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 102, 153);
    doc.text('Registered Players', 14, yPosition);
    yPosition += 10;
    
    // Female Players
    if (femalePlayers.length > 0) {
      checkPageBreak(15 + femalePlayers.length * 7);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 127, 80);
      doc.text(`Female Players (${femalePlayers.length})`, 14, yPosition);
      yPosition += 7;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      // Table header
      doc.setFont(undefined, 'bold');
      doc.text('Pos', 14, yPosition);
      doc.text('Name', 30, yPosition);
      doc.text('Email', 100, yPosition);
      yPosition += 5;
      
      doc.setFont(undefined, 'normal');
      femalePlayers.forEach((p, idx) => {
        checkPageBreak(7);
        doc.text(String(idx + 1), 14, yPosition);
        doc.text(p.name.substring(0, 30), 30, yPosition);
        doc.text((p.email || 'N/A').substring(0, 35), 100, yPosition);
        yPosition += 7;
      });
      
      yPosition += 5;
    }
    
    // Male Players
    if (malePlayers.length > 0) {
      checkPageBreak(15 + malePlayers.length * 7);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 153, 204);
      doc.text(`Male Players (${malePlayers.length})`, 14, yPosition);
      yPosition += 7;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      // Table header
      doc.setFont(undefined, 'bold');
      doc.text('Pos', 14, yPosition);
      doc.text('Name', 30, yPosition);
      doc.text('Email', 100, yPosition);
      yPosition += 5;
      
      doc.setFont(undefined, 'normal');
      malePlayers.forEach((p, idx) => {
        checkPageBreak(7);
        doc.text(String(idx + 1), 14, yPosition);
        doc.text(p.name.substring(0, 30), 30, yPosition);
        doc.text((p.email || 'N/A').substring(0, 35), 100, yPosition);
        yPosition += 7;
      });
      
      yPosition += 10;
    }
    
    // Match Schedule Section
    if (matches.length > 0) {
      checkPageBreak(20);
      
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 102, 153);
      doc.text('Match Schedule', 14, yPosition);
      yPosition += 10;
      
      const femaleMatches = matches.filter(m => m.gender === 'female');
      const maleMatches = matches.filter(m => m.gender === 'male');
      
      // Female Matches
      if (femaleMatches.length > 0) {
        checkPageBreak(15 + femaleMatches.length * 10);
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 127, 80);
        doc.text('Female Division', 14, yPosition);
        yPosition += 7;
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        
        femaleMatches.forEach(m => {
          checkPageBreak(10);
          const team1 = `${getPlayerName(m.player1_id)} & ${getPlayerName(m.player2_id)}`;
          const team2 = `${getPlayerName(m.player3_id)} & ${getPlayerName(m.player4_id)}`;
          const score = m.is_completed ? `${m.score1} - ${m.score2}` : 'TBD';
          const status = m.is_completed ? '✓' : '○';
          
          doc.setFont(undefined, 'bold');
          doc.text(`Match ${m.match_number}`, 14, yPosition);
          doc.setFont(undefined, 'normal');
          doc.text(team1.substring(0, 45), 35, yPosition);
          yPosition += 5;
          doc.text('vs', 35, yPosition);
          doc.text(team2.substring(0, 45), 45, yPosition);
          doc.text(`${status} ${score}`, 170, yPosition - 5, { align: 'right' });
          yPosition += 8;
        });
        
        yPosition += 5;
      }
      
      // Male Matches
      if (maleMatches.length > 0) {
        checkPageBreak(15 + maleMatches.length * 10);
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 153, 204);
        doc.text('Male Division', 14, yPosition);
        yPosition += 7;
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        
        maleMatches.forEach(m => {
          checkPageBreak(10);
          const team1 = `${getPlayerName(m.player1_id)} & ${getPlayerName(m.player2_id)}`;
          const team2 = `${getPlayerName(m.player3_id)} & ${getPlayerName(m.player4_id)}`;
          const score = m.is_completed ? `${m.score1} - ${m.score2}` : 'TBD';
          const status = m.is_completed ? '✓' : '○';
          
          doc.setFont(undefined, 'bold');
          doc.text(`Match ${m.match_number}`, 14, yPosition);
          doc.setFont(undefined, 'normal');
          doc.text(team1.substring(0, 45), 35, yPosition);
          yPosition += 5;
          doc.text('vs', 35, yPosition);
          doc.text(team2.substring(0, 45), 45, yPosition);
          doc.text(`${status} ${score}`, 170, yPosition - 5, { align: 'right' });
          yPosition += 8;
        });
      }
    }
    
    console.log('PDF generated successfully, saving...');
    // Save the PDF
    doc.save(`tournament-matchups-${new Date().toISOString().split('T')[0]}.pdf`);
    console.log('PDF saved!');
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert(`Failed to generate PDF: ${error.message || 'Unknown error'}\n\nPlease check the browser console for details.`);
    throw error;
  }
};
