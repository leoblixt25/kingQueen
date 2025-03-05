
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback } from "react";

interface MatchNavigationProps {
  currentMatchIndex: number;
  matchesCount: number;
  hasPreviousMatch: boolean;
  hasNextMatch: boolean;
  navigationBlocked: boolean;
  handlePreviousMatch: () => void;
  handleNextMatch: () => void;
  children: React.ReactNode;
}

export function MatchNavigation({
  currentMatchIndex,
  matchesCount,
  hasPreviousMatch,
  hasNextMatch,
  navigationBlocked,
  handlePreviousMatch,
  handleNextMatch,
  children
}: MatchNavigationProps) {
  // Create memoized handlers to avoid recreation on each render
  const handlePreviousClick = useCallback(() => {
    if (navigationBlocked) {
      console.log("Navigation blocked, ignoring previous click");
      return;
    }
    console.log("Previous button clicked, calling handlePreviousMatch");
    handlePreviousMatch();
  }, [handlePreviousMatch, navigationBlocked]);

  const handleNextClick = useCallback(() => {
    if (navigationBlocked) {
      console.log("Navigation blocked, ignoring next click");
      return;
    }
    console.log("Next button clicked, calling handleNextMatch");
    handleNextMatch();
  }, [handleNextMatch, navigationBlocked]);

  return (
    <Card className="mb-8 max-w-2xl mx-auto">
      <CardHeader>
        <div className="text-center">
          <CardTitle className="text-2xl font-bold">
            Match {currentMatchIndex + 1} of {matchesCount}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handlePreviousClick}
            disabled={!hasPreviousMatch || navigationBlocked}
            className="flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <div className="flex-1 space-y-6">
            {children}
          </div>

          <Button
            variant="outline"
            onClick={handleNextClick}
            disabled={!hasNextMatch || navigationBlocked}
            className="flex-shrink-0"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
