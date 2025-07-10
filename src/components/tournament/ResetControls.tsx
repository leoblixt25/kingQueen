import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RotateCcw, RefreshCw } from 'lucide-react';

interface ResetControlsProps {
  onResetScores: () => Promise<any>;
  onRefresh: () => Promise<any>;
  isLoading?: boolean;
}

export function ResetControls({ onResetScores, onRefresh, isLoading = false }: ResetControlsProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleResetScores = async () => {
    setIsResetting(true);
    try {
      const result = await onResetScores();
      if (result.success) {
        alert('Scores reset successfully!');
      } else {
        alert('Failed to reset scores');
      }
    } catch (error) {
      console.error('Error resetting scores:', error);
      alert('Failed to reset scores');
    } finally {
      setIsResetting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tournament Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className="w-full"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={isLoading || isResetting}
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset All Scores
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Tournament Scores</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset all match scores back to 0 and clear all player rankings.
                Player names and match combinations will remain unchanged.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleResetScores}
                className="bg-red-600 hover:bg-red-700"
              >
                {isResetting ? 'Resetting...' : 'Reset Scores'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}