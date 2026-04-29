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
    const doc = new jsPDF();
    
    // Load approved players
    const playersRef = collection(db, 'players');
    const playersQuery = query(playersRef, where('status', '==', 'approved'));
    const playersSnapshot = await getDocs(playersQuery);
    const players: Player[] = playersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));

    // Load matches
    const matchesRef = collection(db, 'matches');
    const matchesQuery = query(matchesRef, orderBy('match_number'));
    const matchesSnapshot = await getDocs(matchesQuery);
    const matches: Match[] = matchesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Match));

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
    
    // Female Players Table
    doc.autoTable({
      startY: 50,
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
    
    // Male Players Table
    const afterFemaleY = (doc as any).lastAutoTable.finalY + 10;
    doc.autoTable({
      startY: afterFemaleY,
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
    
    // Match Schedule Section
    const afterMaleY = (doc as any).lastAutoTable.finalY + 15;
    
    // Check if we need a new page
    if (afterMaleY > 250) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(0, 102, 153);
      doc.text('Match Schedule', 14, 20);
    } else {
      doc.setFontSize(16);
      doc.setTextColor(0, 102, 153);
      doc.text('Match Schedule', 14, afterMaleY);
    }
    
    // Helper function to get player name by ID
    const getPlayerName = (playerId: string): string => {
      const player = players.find(p => p.id === playerId);
      return player ? player.name : 'TBD';
    };
    
    // Female Matches
    const femaleMatches = matches.filter(m => m.gender === 'female');
    const femaleMatchStartY = afterMaleY > 250 ? 25 : (doc as any).lastAutoTable?.finalY + 10 || afterMaleY + 5;
    
    doc.autoTable({
      startY: femaleMatchStartY,
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
    
    // Male Matches
    const maleMatches = matches.filter(m => m.gender === 'male');
    const maleMatchStartY = (doc as any).lastAutoTable.finalY + 10;
    
    // Check if we need a new page
    if (maleMatchStartY > 250) {
      doc.addPage();
    }
    
    doc.autoTable({
      startY: maleMatchStartY > 250 ? 20 : maleMatchStartY,
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
    
    // Save the PDF
    doc.save(`tournament-matchups-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
