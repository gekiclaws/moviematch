// app/src/services/matching/embedding.test.ts
import { describe, it, expect } from 'vitest';

import type { Swipe } from '../../types/swipe';
import {
  hashString,
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

describe('hashString', () => {
  it('is deterministic for same input + seed', () => {
    const a = hashString('hello', 11);
    const b = hashString('hello', 11);
    expect(a).toBe(b);
  });

  it('differs for different strings or seeds', () => {
    const base = hashString('hello', 11);
    const diffString = hashString('world', 11);
    const diffSeed = hashString('hello', 23);

    expect(diffString).not.toBe(base);
    expect(diffSeed).not.toBe(base);
  });
});

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
  it('sets one bucket per value using hashing', () => {
    const vec = new Array(8).fill(0);
    addHashedMultiHot(['a', 'b'], 0, 8, vec, 11);

    const active = vec.filter((v) => v === 1).length;
    expect(active).toBeGreaterThan(0);
    expect(active).toBeLessThanOrEqual(2); // collisions possible
  });

  it('no-op for empty or undefined list', () => {
    const vec = new Array(4).fill(0);
    addHashedMultiHot([], 0, 4, vec, 11);
    expect(vec.every((v) => v === 0)).toBe(true);
  });
});

describe('buildEmbeddingFromSwipe', () => {
  it('produces a fixed-length embedding', () => {
    const swipe = makeSwipe();
    const emb = buildEmbeddingFromSwipe(swipe);

    // 16 genre + 3 scalars + 16 director + 32 cast = 67
    expect(emb.length).toBe(67);
  });

  it('encodes genres, scalars, and people into non-zero entries', () => {
    const swipe = makeSwipe({
      genres: ['Action', 'Comedy'],
      directors: ['Dir A'],
      cast: ['Actor A', 'Actor B'],
      releaseYear: 2000,
      runtime: 100,
      rating: 5,
    });

    const emb = buildEmbeddingFromSwipe(swipe);
    expect(emb.some((v) => v !== 0)).toBe(true);
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
    const like = makeSwipe({ id: 's1', userId: 'u', mediaId: 'm1', decision: 'like' });
    const dislike = makeSwipe({ id: 's2', userId: 'u', mediaId: 'm2', decision: 'dislike' });

    const fakeEmbedding = (swipe: Swipe) => {
      if (swipe.id === 's1') return [1, 2, 3];
      if (swipe.id === 's2') return [10, 20, 30];
      return [0, 0, 0];
    };

    const vec = buildUserPreferenceVector([like, dislike], 'u', fakeEmbedding);

    // expected raw values (first 3 dims)
    const raw = [-9, -18, -27];
    const mag = Math.sqrt(raw.reduce((s, v) => s + v*v, 0));
    const normalizedFirst3 = raw.map(v => v / mag);

    // build expected 67-length vector
    const expected = [
      ...normalizedFirst3,
      ...new Array(67 - 3).fill(0),
    ];

    expect(vec.vector).toEqual(expected);
    expect(vec.vector.length).toBe(67);
    expect(vec.isZero).toBe(false);
    expect(vec.magnitude).toBeCloseTo(mag);
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
  it('ranks candidates by similarity and returns per-title certainty', () => {
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

    const userVec = buildUserPreferenceVector(swipes, 'user-1');
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
      expect(typeof r.certainty).toBe('number');
      expect(r.certainty).toBeGreaterThanOrEqual(0.5);
      expect(r.certainty).toBeLessThanOrEqual(1);
    });

    // Top ranked should have score >= others
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('returns empty result when stats cannot be computed', () => {
    const swipes: Swipe[] = [];
    const zeroConsensus = normalizeVector([0, 0, 0]); // isZero = true but we only use vector here

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