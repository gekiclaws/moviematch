import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createMatchingService } from '../../../../services/matching/matchingService';
import type { Swipe } from '../../../../types/swipe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSwipe = (overrides: Partial<Swipe> = {}): Swipe =>
  ({
    id: overrides.id ?? 's1',
    userId: overrides.userId ?? 'u1',
    mediaId: overrides.mediaId ?? 'm1',
    mediaTitle: overrides.mediaTitle ?? 'Movie',
    decision: overrides.decision ?? 'like',
    createdAt: 1,
    genres: overrides.genres ?? ['Action'],
    directors: overrides.directors ?? ['DirA'],
    cast: overrides.cast ?? ['ActorA'],
    releaseYear: overrides.releaseYear ?? 2020,
    runtime: overrides.runtime ?? 120,
    rating: overrides.rating ?? 7,
    posterUrl: overrides.posterUrl,
    streamingServices: overrides.streamingServices,
  } as Swipe);

beforeEach(() => {
  // stable randomness for fallback
  vi.spyOn(global.Math, 'random').mockReturnValue(0.1);
});

// ---------------------------------------------------------------------------
// Minimal deterministic fake embeddings
// ---------------------------------------------------------------------------

// map mediaId → a simple 3d unit embedding
const simpleEmbed = (swipe: Swipe) => {
  if (swipe.mediaId === 'm1') return [1, 0, 0];
  if (swipe.mediaId === 'm2') return [0, 1, 0];
  if (swipe.mediaId === 'm3') return [0, 0, 1];
  return [0, 0, 0];
};

// normalize a vector to unit length
const norm = (vec: number[]) => {
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (mag === 0) return { vector: [0, 0, 0], magnitude: 0, isZero: true };
  return { vector: vec.map((v) => v / mag), magnitude: mag, isZero: false };
};

// buildUserPreferenceVector(fake)
const fakeUserVec = (swipes: Swipe[], userId: string) => {
  const agg = [0, 0, 0];
  swipes
    .filter((s) => s.userId === userId)
    .forEach((s) => {
      const dir = s.decision === 'like' ? 1 : -1;
      const e = simpleEmbed(s);
      agg[0] += dir * e[0];
      agg[1] += dir * e[1];
      agg[2] += dir * e[2];
    });
  return norm(agg);
};

// buildConsensusVector(fake)
const fakeConsensus = (vecs: ReturnType<typeof norm>[]) => {
  const agg = [0, 0, 0];
  vecs.forEach((v) => {
    agg[0] += v.vector[0];
    agg[1] += v.vector[1];
    agg[2] += v.vector[2];
  });
  return norm(agg);
};

// rankCandidates(fake)
const fakeRank = (
  swipes: Swipe[],
  consensus: ReturnType<typeof norm>,
  candidateIds: string[],
  max: number
) => {
  const scored = candidateIds.map((id) => {
    const emb = norm(simpleEmbed({ mediaId: id } as Swipe));
    const score = consensus.vector[0] * emb.vector[0] +
      consensus.vector[1] * emb.vector[1] +
      consensus.vector[2] * emb.vector[2];
    return { mediaId: id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const sliced = scored.slice(0, max);

  // trivial certainty calculation
  return {
    ranked: sliced.map((x) => ({
      mediaId: x.mediaId,
      score: x.score,
      certainty: 0.7, // fixed
    })),
    stats: { top: sliced[0]?.score ?? 0, mean: 0.5, std: 1 },
    sessionCertainty: 0.8,
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MatchingService.matchSession (with DI)', () => {
  // ------------------------------
  // 1. Normal matching
  // ------------------------------
  it('returns ranked matches (no fallback)', () => {
    const service = createMatchingService({
      buildUserPreferenceVector: fakeUserVec,
      buildConsensusVector: fakeConsensus,
      rankCandidates: fakeRank,
    });

    const swipes = [
        makeSwipe({ userId: 'u1', mediaId: 'm1' }),
        makeSwipe({ userId: 'u1', mediaId: 'm2' }),
        makeSwipe({ userId: 'u1', mediaId: 'm3' }),

        makeSwipe({ userId: 'u2', mediaId: 'm1' }),
        makeSwipe({ userId: 'u2', mediaId: 'm2' }),
        makeSwipe({ userId: 'u2', mediaId: 'm3' }),
    ];

    const result = service.matchSession(swipes, ['u1', 'u2']);

    expect(result.fallback).toBe(false);
    expect(result.matchedTitles.length).toBe(3);
    expect(result.certainty).toBe(0.8);
  });

  // ------------------------------
  // 3. Hybrid mode — no intersection → union
  // ------------------------------
  it('falls back to union when there is no intersection', () => {
    const service = createMatchingService({
      buildUserPreferenceVector: fakeUserVec,
      buildConsensusVector: fakeConsensus,
      rankCandidates: fakeRank,
    });

    const swipes = [
      makeSwipe({ userId: 'u1', mediaId: 'm1' }),
      makeSwipe({ userId: 'u2', mediaId: 'm2' }),
    ];

    const result = service.matchSession(swipes, ['u1', 'u2']);

    expect(result.fallback).toBe(false);
    const ids = new Set(result.matchedTitles.map((x) => x.id));
    expect(ids).toEqual(new Set(['m1', 'm2']));
  });

  // ------------------------------
  // 4. Zero-vector → fallback
  // ------------------------------
  it('returns fallback when zero consensus', () => {
    const service = createMatchingService({
      buildUserPreferenceVector: () => ({ vector: [0, 0, 0], magnitude: 0, isZero: true }),
      buildConsensusVector: () => ({ vector: [0, 0, 0], magnitude: 0, isZero: true }),
      rankCandidates: fakeRank,
    });

    const result = service.matchSession([], ['u1', 'u2']);

    expect(result.fallback).toBe(true);
    expect(result.certainty).toBe(0.5);
  });

  // ------------------------------
  // 5. No candidates → fallback
  // ------------------------------
  it('returns fallback when no like candidates exist', () => {
    const service = createMatchingService({
      buildUserPreferenceVector: fakeUserVec,
      buildConsensusVector: fakeConsensus,
      rankCandidates: fakeRank,
    });

    const swipes = [
      makeSwipe({ userId: 'u1', mediaId: 'm1', decision: 'dislike' }),
      makeSwipe({ userId: 'u2', mediaId: 'm1', decision: 'dislike' }),
    ];

    const result = service.matchSession(swipes, ['u1', 'u2']);

    expect(result.fallback).toBe(true);
    expect(result.certainty).toBe(0.5);
  });

  // ------------------------------
  // 6. Internal scoring error → fallback
  // ------------------------------
  it('fallbacks when rankCandidates throws', () => {
    const service = createMatchingService({
      buildUserPreferenceVector: fakeUserVec,
      buildConsensusVector: fakeConsensus,
      rankCandidates: () => {
        throw new Error('boom');
      },
    });

    const swipes = [
      makeSwipe({ userId: 'u1', mediaId: 'm1' }),
      makeSwipe({ userId: 'u2', mediaId: 'm1' }),
    ];

    const result = service.matchSession(swipes, ['u1', 'u2']);

    expect(result.fallback).toBe(true);
    expect(result.certainty).toBe(0.5);
    expect(result.matchedTitles.length).toBeGreaterThan(0);
  });

  // ------------------------------
  // 7. Seeded fallback includes metadata
  // ------------------------------
  it('uses seeded fallback with full metadata when no positive signal', () => {
    const service = createMatchingService({
      buildUserPreferenceVector: () => ({ vector: [0, 0, 0], magnitude: 0, isZero: true }),
      buildConsensusVector: () => ({ vector: [0, 0, 0], magnitude: 0, isZero: true }),
      rankCandidates: fakeRank,
    });

    const swipes = [
      makeSwipe({
        id: 's1',
        userId: 'u1',
        mediaId: 'm1',
        mediaTitle: 'Title 1',
        decision: 'dislike',
        posterUrl: 'p1.jpg',
      }),
      makeSwipe({
        id: 's2',
        userId: 'u2',
        mediaId: 'm2',
        mediaTitle: 'Title 2',
        decision: 'dislike',
        posterUrl: 'p2.jpg',
      }),
      makeSwipe({
        id: 's3',
        userId: 'u1',
        mediaId: 'm3',
        mediaTitle: 'Title 3',
        decision: 'dislike',
        posterUrl: 'p3.jpg',
      }),
    ];

    const first = service.matchSession(swipes, ['u1', 'u2'], 'session-seed');
    const second = service.matchSession(swipes, ['u1', 'u2'], 'session-seed');

    expect(first.fallback).toBe(true);
    expect(first.matchedTitles.length).toBe(3);
    expect(first.matchedTitles).toEqual(second.matchedTitles);
    expect(first.matchedTitles.every((t) => t.title !== t.id)).toBe(true);
    expect(first.matchedTitles.every((t) => t.posterUrl)).toBe(true);
  });
});
