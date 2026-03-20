import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface RegistrationStatus {
  isRegistered: boolean;
  isLoading: boolean;
  playerData: any;
}

export const useRegistrationCheck = (): RegistrationStatus => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playerData, setPlayerData] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      // For now, we'll check if there are any confirmed players
      const playersRef = collection(db, 'players');
      const q = query(playersRef, where('is_confirmed', '==', true));
      const snapshot = await getDocs(q);
      const confirmedPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const hasConfirmedPlayers = confirmedPlayers && confirmedPlayers.length > 0;
      
      setIsRegistered(hasConfirmedPlayers);
      setPlayerData(confirmedPlayers?.[0] || null);

      // Redirect to registration if not registered and not already on registration page
      if (!hasConfirmedPlayers && location.pathname !== '/register') {
        navigate('/register');
      }

    } catch (error) {
      console.error('Error in registration check:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { isRegistered, isLoading, playerData };
};