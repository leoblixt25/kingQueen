
import { useState, useCallback } from "react";

export function useMatchNavigation() {
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const handlePreviousMatch = useCallback((matches) => {
    if (isNavigating || !matches || matches.length === 0) {
      console.log("Navigation skipped: already navigating or no matches");
      return;
    }
    
    if (currentMatchIndex > 0) {
      setIsNavigating(true);
      console.log(`Navigation: Moving from match ${currentMatchIndex} to ${currentMatchIndex - 1}`);
      
      setCurrentMatchIndex(prevIndex => {
        const newIndex = prevIndex - 1;
        console.log(`Navigation confirmed: New index set to ${newIndex}`);
        return newIndex;
      });
      
      setTimeout(() => setIsNavigating(false), 300);
    } else {
      console.log("Navigation: Cannot go to previous match (already at first)");
    }
  }, [currentMatchIndex, isNavigating]);

  const handleNextMatch = useCallback((matches) => {
    if (isNavigating || !matches || matches.length === 0) {
      console.log("Navigation skipped: already navigating or no matches");
      return;
    }
    
    if (currentMatchIndex < matches.length - 1) {
      setIsNavigating(true);
      console.log(`Navigation: Moving from match ${currentMatchIndex} to ${currentMatchIndex + 1}`);
      console.log(`Match array length: ${matches.length}`);
      
      setCurrentMatchIndex(prevIndex => {
        const newIndex = prevIndex + 1;
        console.log(`Navigation confirmed: New index set to ${newIndex}`);
        return newIndex;
      });
      
      setTimeout(() => setIsNavigating(false), 300);
    } else {
      console.log("Navigation: Cannot go to next match (already at last)");
      console.log(`Current match index: ${currentMatchIndex}, Matches length: ${matches?.length || 0}`);
    }
  }, [currentMatchIndex, isNavigating]);

  return {
    currentMatchIndex,
    setCurrentMatchIndex,
    isNavigating,
    handlePreviousMatch,
    handleNextMatch
  };
}
