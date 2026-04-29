import { db } from '@/config/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

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
      // Fallback for backward compatibility
      const fallbackQuery = query(playersRef, where('is_confirmed', '==', true));
      const fallbackSnapshot = await getDocs(fallbackQuery);
      players = fallbackSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      console.log('Loaded players via fallback:', players.length);
    }

    // Load matches
    const matchesRef = collection(db, 'matches');
    let matches: Match[] = [];
    try {
      const matchesQuery = query(matchesRef, orderBy('match_number'));
      const matchesSnapshot = await getDocs(matchesQuery);
      matches = matchesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      console.log('Loaded matches:', matches.length);
    } catch (error) {
      console.warn('Failed to load matches with orderBy, loading without sort...');
      const matchesSnapshot = await getDocs(matchesRef);
      matches = matchesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Match));
    }

    if (players.length === 0 && matches.length === 0) {
      alert('No tournament data available to export. Please ensure players are registered and matches are created.');
      return;
    }

    // Tournament Header
    doc.setFontSize(22);
    doc.setTextColor(0, 102, 153);
    doc.text('Beach Volleyball Tournament', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });
    
    // Player List Section
    doc.setFontSize(16);
    doc.setTextColor(0, 102, 153);
    doc.text('Registered Players', 14, 45);
    
    const femalePlayers = players.filter(p => p.gender === 'female');
    const malePlayers = players.filter(p => p.gender === 'male');
    
    console.log('Female players:', femalePlayers.length, 'Male players:', malePlayers.length);
    
    let currentY = 50;
    
    // Female Players Table
    if (femalePlayers.length > 0) {
      doc.autoTable({
        startY: currentY,
        head: [['Position', 'Name', 'Email']],
        body: femalePlayers.map((p, idx) => [
          idx + 1,
          p.name,
          p.email || 'N/A'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [255, 127, 80] },
        styles: { fontSize: 10 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Male Players Table
    if (malePlayers.length > 0) {
      doc.autoTable({
        startY: currentY,
        head: [['Position', 'Name', 'Email']],
        body: malePlayers.map((p, idx) => [
          idx + 1,
          p.name,
          p.email || 'N/A'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [0, 153, 204] },
        styles: { fontSize: 10 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Match Schedule Section
    if (matches.length > 0) {
      // Check if we need a new page
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(16);
      doc.setTextColor(0, 102, 153);
      doc.text('Match Schedule', 14, currentY);
      currentY += 10;
      
      // Helper function to get player name by ID
      const getPlayerName = (playerId: string): string => {
        const player = players.find(p => p.id === playerId);
        return player ? player.name : 'TBD';
      };
      
      // Female Matches
      const femaleMatches = matches.filter(m => m.gender === 'female');
      if (femaleMatches.length > 0) {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.autoTable({
          startY: currentY,
          head: [['Match #', 'Team 1', 'vs', 'Team 2', 'Score', 'Status']],
          body: femaleMatches.map(m => [
            m.match_number,
            `${getPlayerName(m.player1_id)} & ${getPlayerName(m.player2_id)}`,
            'vs',
            `${getPlayerName(m.player3_id)} & ${getPlayerName(m.player4_id)}`,
            m.is_completed ? `${m.score1} - ${m.score2}` : 'TBD',
            m.is_completed ? 'Completed' : 'Pending'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [255, 127, 80] },
          styles: { fontSize: 9 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
      }
      
      // Male Matches
      const maleMatches = matches.filter(m => m.gender === 'male');
      if (maleMatches.length > 0) {
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.autoTable({
          startY: currentY,
          head: [['Match #', 'Team 1', 'vs', 'Team 2', 'Score', 'Status']],
          body: maleMatches.map(m => [
            m.match_number,
            `${getPlayerName(m.player1_id)} & ${getPlayerName(m.player2_id)}`,
            'vs',
            `${getPlayerName(m.player3_id)} & ${getPlayerName(m.player4_id)}`,
            m.is_completed ? `${m.score1} - ${m.score2}` : 'TBD',
            m.is_completed ? 'Completed' : 'Pending'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [0, 153, 204] },
          styles: { fontSize: 9 }
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
