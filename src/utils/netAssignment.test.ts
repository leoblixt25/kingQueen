import { describe, it, expect } from 'vitest';
import {
  normalizeNet,
  autoNetForMatch,
  resolveNet,
  netLabel,
  otherNet,
  netKey,
  buildNetMap,
} from './netAssignment';

describe('normalizeNet', () => {
  it('accepts the two real nets as numbers or strings', () => {
    expect(normalizeNet(1)).toBe(1);
    expect(normalizeNet(2)).toBe(2);
    expect(normalizeNet('1')).toBe(1);
    expect(normalizeNet('2')).toBe(2);
  });

  it('rejects anything that is not net 1 or 2', () => {
    [0, 3, -1, null, undefined, '', 'net 1', true, {}].forEach((v) => {
      expect(normalizeNet(v)).toBeNull();
    });
  });
});

describe('autoNetForMatch', () => {
  it('puts odd matches on net 1 and even matches on net 2', () => {
    expect(autoNetForMatch(1)).toBe(1);
    expect(autoNetForMatch(2)).toBe(2);
    expect(autoNetForMatch(3)).toBe(1);
    expect(autoNetForMatch(4)).toBe(2);
    expect(autoNetForMatch(13)).toBe(1);
    expect(autoNetForMatch(14)).toBe(2);
  });

  it('is stable and covers a full 14 match draw', () => {
    const nets = Array.from({ length: 14 }, (_, i) => autoNetForMatch(i + 1));
    expect(nets).toEqual([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2]);
    expect(nets.filter((n) => n === 1)).toHaveLength(7);
    expect(nets.filter((n) => n === 2)).toHaveLength(7);
  });
});

describe('resolveNet', () => {
  it('uses the automatic net when no override is stored', () => {
    expect(resolveNet(1)).toBe(1);
    expect(resolveNet(2)).toBe(2);
    expect(resolveNet(4, undefined)).toBe(2);
    expect(resolveNet(4, null)).toBe(2);
  });

  it('lets a valid stored override win over the automatic net', () => {
    expect(resolveNet(1, 2)).toBe(2);
    expect(resolveNet(2, 1)).toBe(1);
  });

  it('ignores an invalid stored value and falls back to automatic', () => {
    expect(resolveNet(1, 3)).toBe(1);
    expect(resolveNet(2, 99)).toBe(2);
    expect(resolveNet(1, 'nope')).toBe(1);
  });
});

describe('netLabel / otherNet', () => {
  it('labels nets for display', () => {
    expect(netLabel(1)).toBe('Net 1');
    expect(netLabel(2)).toBe('Net 2');
  });

  it('toggles between the two nets', () => {
    expect(otherNet(1)).toBe(2);
    expect(otherNet(2)).toBe(1);
    expect(otherNet(otherNet(1))).toBe(1);
  });
});

describe('buildNetMap', () => {
  it('assigns every match even when no net is stored yet', () => {
    const map = buildNetMap([
      { gender: 'female', match_number: 1 },
      { gender: 'female', match_number: 2 },
      { gender: 'male', match_number: 1 },
    ]);
    expect(map).toEqual({ female_1: 1, female_2: 2, male_1: 1 });
  });

  it('honours stored overrides', () => {
    const map = buildNetMap([
      { gender: 'female', match_number: 1, net: 2 },
      { gender: 'female', match_number: 2, net: 1 },
    ]);
    expect(map).toEqual({ female_1: 2, female_2: 1 });
  });

  it('ignores malformed documents instead of throwing', () => {
    const map = buildNetMap([
      null as never,
      { gender: 'female' },
      { match_number: 1 },
      { gender: 'female', match_number: Number.NaN },
      { gender: 'female', match_number: 'x' },
      undefined as never,
    ]);
    expect(map).toEqual({});
  });

  it('tolerates a missing list', () => {
    expect(buildNetMap(undefined as never)).toEqual({});
    expect(buildNetMap([])).toEqual({});
  });

  it('separates genders so both can hold match 1 on different nets', () => {
    const map = buildNetMap([
      { gender: 'female', match_number: 1, net: 1 },
      { gender: 'male', match_number: 1, net: 2 },
    ]);
    expect(map.female_1).toBe(1);
    expect(map.male_1).toBe(2);
  });
});

describe('netKey', () => {
  it('matches the existing match addressing convention', () => {
    expect(netKey('female', 3)).toBe('female_3');
    expect(netKey('male', 14)).toBe('male_14');
  });
});