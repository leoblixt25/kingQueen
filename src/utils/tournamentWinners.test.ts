import { describe, it, expect } from 'vitest';
import {
  resolveTournamentWinners,
  isWinnerName,
  winnerNameClass,
  type WinnerPlayerRef,
} from './tournamentWinners';

const PLAYERS: WinnerPlayerRef[] = [
  { id: 'male_8', name: 'Eugene', gender: 'male' },
  { id: 'male_5', name: 'Leonardo', gender: 'male' },
  { id: 'female_7', name: 'Giulia', gender: 'female' },
  { id: 'female_3', name: 'Ana', gender: 'female' },
  { id: 'female_2', name: 'Giulia P', gender: 'female' },
];

const COMPLETE = { is_completed: true, male_king_id: 'male_8', female_queen_id: 'female_7' };

describe('resolveTournamentWinners', () => {
  it('returns no winners before the final is submitted', () => {
    expect(resolveTournamentWinners(null, PLAYERS)).toEqual({ kingName: null, queenName: null });
    expect(resolveTournamentWinners({ ...COMPLETE, is_completed: false }, PLAYERS))
      .toEqual({ kingName: null, queenName: null });
    expect(resolveTournamentWinners({ ...COMPLETE, is_completed: undefined }, PLAYERS))
      .toEqual({ kingName: null, queenName: null });
  });

  it('returns no winners when the final document does not exist yet', () => {
    expect(resolveTournamentWinners(undefined, PLAYERS)).toEqual({ kingName: null, queenName: null });
  });

  it('identifies the King and Queen once the final is submitted', () => {
    expect(resolveTournamentWinners(COMPLETE, PLAYERS)).toEqual({
      kingName: 'Eugene',
      queenName: 'Giulia',
    });
  });

  it('ignores a non-boolean is_completed value', () => {
    expect(resolveTournamentWinners({ ...COMPLETE, is_completed: 'yes' as never }, PLAYERS))
      .toEqual({ kingName: null, queenName: null });
  });

  it('highlights the known side when only one id resolves', () => {
    expect(resolveTournamentWinners({ ...COMPLETE, female_queen_id: 'nope' }, PLAYERS))
      .toEqual({ kingName: 'Eugene', queenName: null });
  });

  it('rejects an id whose player gender contradicts the field', () => {
    expect(resolveTournamentWinners({ ...COMPLETE, male_king_id: 'female_7' }, PLAYERS))
      .toEqual({ kingName: null, queenName: 'Giulia' });
  });

  it('ignores blank names', () => {
    const blank = [{ id: 'male_8', name: '   ', gender: 'male' }];
    expect(resolveTournamentWinners({ ...COMPLETE, female_queen_id: undefined }, blank))
      .toEqual({ kingName: null, queenName: null });
  });

  it('trims stored names', () => {
    const padded: WinnerPlayerRef[] = [
      { id: 'male_8', name: '  Eugene  ', gender: 'male' },
      { id: 'female_7', name: ' Giulia', gender: 'female' },
    ];
    expect(resolveTournamentWinners(COMPLETE, padded)).toEqual({
      kingName: 'Eugene',
      queenName: 'Giulia',
    });
  });

  it('returns nothing when the player list is unavailable', () => {
    expect(resolveTournamentWinners(COMPLETE, [])).toEqual({ kingName: null, queenName: null });
  });
});

describe('isWinnerName', () => {
  const winners = resolveTournamentWinners(COMPLETE, PLAYERS);

  it('matches the King and Queen', () => {
    expect(isWinnerName('Eugene', winners)).toBe(true);
    expect(isWinnerName('Giulia', winners)).toBe(true);
  });

  it('does not match other players', () => {
    expect(isWinnerName('Leonardo', winners)).toBe(false);
    expect(isWinnerName('Ana', winners)).toBe(false);
  });

  it('never confuses players with overlapping names', () => {
    // "Giulia P" is a different player from the Queen "Giulia".
    expect(isWinnerName('Giulia P', winners)).toBe(false);
    expect(isWinnerName('Giulia P.', winners)).toBe(false);
  });

  it('is case sensitive and whitespace tolerant at the edges', () => {
    expect(isWinnerName('eugene', winners)).toBe(false);
    expect(isWinnerName('EUGENE', winners)).toBe(false);
    expect(isWinnerName('  Eugene  ', winners)).toBe(true);
  });

  it('handles empty and non-string input safely', () => {
    expect(isWinnerName('', winners)).toBe(false);
    expect(isWinnerName('   ', winners)).toBe(false);
    expect(isWinnerName(null, winners)).toBe(false);
    expect(isWinnerName(undefined, winners)).toBe(false);
  });

  it('matches nothing when the tournament is unfinished', () => {
    const none = resolveTournamentWinners({ is_completed: false }, PLAYERS);
    expect(isWinnerName('Eugene', none)).toBe(false);
    expect(isWinnerName('Giulia', none)).toBe(false);
  });
});

describe('winnerNameClass', () => {
  const winners = resolveTournamentWinners(COMPLETE, PLAYERS);

  it('emits only font-bold for winners and nothing for everyone else', () => {
    expect(winnerNameClass('Eugene', winners)).toBe('font-bold');
    expect(winnerNameClass('Giulia', winners)).toBe('font-bold');
    expect(winnerNameClass('Leonardo', winners)).toBe('');
    expect(winnerNameClass('Ana', winners)).toBe('');
  });

  it('emits no class before the final is submitted', () => {
    const none = resolveTournamentWinners({ is_completed: false }, PLAYERS);
    expect(winnerNameClass('Eugene', none)).toBe('');
  });
});