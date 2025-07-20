import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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
      // In a real app, you'd check against the current user's session
      const { data: confirmedPlayers, error } = await supabase
        .from('players')
        .select('*')
        .eq('is_confirmed', true);

      if (error) {
        console.error('Error checking registration:', error);
        setIsLoading(false);
        return;
      }

      // For demo purposes, if there are confirmed players, consider the user registered
      // In production, you'd check against the authenticated user's email
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