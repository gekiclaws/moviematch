// app/src/services/matching/embedding.test.ts
import { describe, it, expect } from 'vitest';

import type { Swipe } from '../../types/swipe';
import {
  normalizeValue,
  addHashedMultiHot,
  buildEmbeddingFromSwipe,
  normalizeVector,
  buildUserPreferenceVector,
  buildConsensusVector,
  dotProduct,
  computeScoreStats,
  computeCertaintyForScore,
  rankCandidates,
} from './embedding';

// ---------- deterministic test hash fn ----------

const mockHash = (value: string, seed: number) => {
  const map: Record<string, number> = {
    Action: 0,
    Comedy: 1,
    Horror: 2,
    'Jane Doe': 3,
    'Dir A': 4,
    'Actor A': 5,
    'Actor B': 6,
  };
  return map[value] ?? 0;
};

// ---------- test fixtures ----------

const makeSwipe = (overrides: Partial<Swipe> = {}): Swipe =>
  ({
    id: 'swipe-1',
    userId: 'user-1',
    mediaId: 'movie-1',
    mediaTitle: 'Movie 1',
    decision: 'like',
    createdAt: 1,
    genres: ['Action'],
    directors: ['Jane Doe'],
    cast: ['Actor A'],
    releaseYear: 2020,
    runtime: 120,
    rating: 7,
    ...overrides,
  } as Swipe);

// ---------- tests ----------

describe('normalizeValue', () => {
  it('maps min and max into [0,1]', () => {
    expect(normalizeValue(0, 0, 10)).toBe(0);
    expect(normalizeValue(10, 0, 10)).toBe(1);
  });

  it('clamps outside range', () => {
    expect(normalizeValue(-5, 0, 10)).toBe(0);
    expect(normalizeValue(50, 0, 10)).toBe(1);
  });

  it('returns 0 for non-numbers', () => {
    expect(normalizeValue(undefined, 0, 10)).toBe(0);
    expect(normalizeValue(NaN, 0, 10)).toBe(0);
  });
});

describe('addHashedMultiHot', () => {
  it('sets deterministic buckets via injected hash function', () => {
    const vec = new Array(8).fill(0);

    addHashedMultiHot(['Action', 'Comedy'], 0, 8, vec, 11, mockHash);

    // "Action" -> bucket 0
    // "Comedy" -> bucket 1
    expect(vec[0]).toBe(1);
    expect(vec[1]).toBe(1);

    // all others should be zero
    expect(vec.slice(2).every(v => v === 0)).toBe(true);
  });

  it('no-op for empty or undefined list', () => {
    const vec = new Array(4).fill(0);
    addHashedMultiHot([], 0, 4, vec, 11, mockHash);
    expect(vec.every((v) => v === 0)).toBe(true);
  });
});

describe('buildEmbeddingFromSwipe', () => {
  it('produces deterministic embedding with injected hashFn', () => {
    const swipe = makeSwipe({
      genres: ['Action', 'Comedy'],
      directors: ['Dir A'],
      cast: ['Actor A', 'Actor B'],
      releaseYear: 2000,
      runtime: 100,
      rating: 5,
    });

    const emb = buildEmbeddingFromSwipe(swipe, mockHash);

    expect(emb.length).toBe(67);

    // Check hashed buckets
    expect(emb[0]).toBe(1); // Action bucket
    expect(emb[1]).toBe(1); // Comedy bucket

    // Director region starts at: 16 + 3 = 19
    expect(emb[19 + 4]).toBe(1); // Dir A -> bucket 4

    // Cast region starts at 16 + 3 + 16 = 35
    const castStart = 35;
    expect(emb[castStart + 5]).toBe(1); // Actor A
    expect(emb[castStart + 6]).toBe(1); // Actor B
  });
});

describe('normalizeVector', () => {
  it('returns zero vector metadata when magnitude is zero', () => {
    const result = normalizeVector([0, 0, 0]);
    expect(result.isZero).toBe(true);
    expect(result.magnitude).toBe(0);
    expect(result.vector.every((v) => v === 0)).toBe(true);
  });

  it('normalizes to unit length when non-zero', () => {
    const result = normalizeVector([3, 4, 0]);
    expect(result.isZero).toBe(false);
    expect(result.magnitude).toBeCloseTo(5, 5);
    const mag = Math.sqrt(result.vector.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });
});

describe('buildUserPreferenceVector', () => {
  it('adds likes and subtracts dislikes with injected embedding', () => {
    const like = makeSwipe({ id: 's1', userId: 'u', decision: 'like' });
    const dislike = makeSwipe({ id: 's2', userId: 'u', decision: 'dislike' });

    const fakeEmbedding = (swipe: Swipe) => {
      if (swipe.id === 's1') return [1, 2, 3];
      if (swipe.id === 's2') return [10, 20, 30];
      return [0, 0, 0];
    };

    const vec = buildUserPreferenceVector([like, dislike], 'u', fakeEmbedding);

    const raw = [-9, -18, -27];
    const mag = Math.sqrt(raw.reduce((s, v) => s + v*v, 0));
    const expected = raw.map(v => v / mag);

    expect(vec.vector.slice(0, 3)).toEqual(expected);
    expect(vec.vector.length).toBe(67); // padded out
    expect(vec.isZero).toBe(false);
  });

  it('returns zero vector when user has no swipes', () => {
    const otherSwipe = makeSwipe({ userId: 'other' });
    const vec = buildUserPreferenceVector([otherSwipe], 'user-1');

    expect(vec.isZero).toBe(true);
  });
});

describe('dotProduct', () => {
  it('computes standard dot product', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
  });
});

describe('computeScoreStats', () => {
  it('returns mean, std, and top', () => {
    const stats = computeScoreStats([1, 2, 3, 4]);
    expect(stats).not.toBeNull();
    expect(stats!.mean).toBe(2.5);
    expect(stats!.top).toBe(4);
    expect(stats!.std).toBeGreaterThan(0);
  });

  it('returns null for empty input', () => {
    expect(computeScoreStats([])).toBeNull();
  });
});

describe('computeCertaintyForScore', () => {
  const stats = { mean: 0, std: 1 };

  it('outputs value between 0.5 and 1', () => {
    const c1 = computeCertaintyForScore(0, stats);
    const c2 = computeCertaintyForScore(3, stats);

    expect(c1).toBeGreaterThanOrEqual(0.5);
    expect(c1).toBeLessThanOrEqual(1);
    expect(c2).toBeGreaterThan(c1);
  });
});

describe('rankCandidates', () => {
  it('ranks candidates by similarity and returns certainty', () => {
    const swipeA = makeSwipe({
      id: 's1',
      mediaId: 'm1',
      decision: 'like',
      genres: ['Action'],
    });
    const swipeB = makeSwipe({
      id: 's2',
      mediaId: 'm2',
      decision: 'like',
      genres: ['Comedy'],
    });
    const swipeC = makeSwipe({
      id: 's3',
      mediaId: 'm3',
      decision: 'dislike',
      genres: ['Horror'],
    });

    const swipes: Swipe[] = [swipeA, swipeB, swipeC];

    const userVec = buildUserPreferenceVector(swipes, 'user-1', (s) =>
      buildEmbeddingFromSwipe(s, mockHash)
    );
    const consensus = buildConsensusVector([userVec]);

    const { ranked, stats, sessionCertainty } = rankCandidates(
      swipes,
      consensus,
      ['m1', 'm2', 'm3'],
      3
    );

    expect(stats).not.toBeNull();
    expect(sessionCertainty).not.toBeNull();

    expect(ranked.length).toBe(3);
    ranked.forEach((r) => {
      expect(typeof r.mediaId).toBe('string');
      expect(typeof r.score).toBe('number');
      expect(r.certainty).toBeGreaterThanOrEqual(0.5);
      expect(r.certainty).toBeLessThanOrEqual(1);
    });

    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('returns empty result when stats cannot be computed', () => {
    const swipes: Swipe[] = [];
    const zeroConsensus = normalizeVector([0, 0, 0]);

    const { ranked, stats, sessionCertainty } = rankCandidates(
      swipes,
      zeroConsensus,
      [],
      3
    );

    expect(ranked.length).toBe(0);
    expect(stats).toBeNull();
    expect(sessionCertainty).toBeNull();
  });
});