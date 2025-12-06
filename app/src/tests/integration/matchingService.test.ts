// app/src/services/matching/matchingServiceInt.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MatchingService } from '../../services/matching/matchingService';
import type { Swipe } from '../../types/swipe';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const makeSwipe = (overrides: Partial<Swipe> = {}): Swipe =>
  ({
    id: overrides.id ?? crypto.randomUUID(),
    userId: overrides.userId ?? 'u1',
    mediaId: overrides.mediaId ?? 'm1',
    mediaTitle: overrides.mediaTitle ?? 'Movie',
    decision: overrides.decision ?? 'like',
    createdAt: Date.now(),
    genres: overrides.genres ?? ['Action'],
    directors: overrides.directors ?? ['DirA'],
    cast: overrides.cast ?? ['ActorA'],
    releaseYear: overrides.releaseYear ?? 2020,
    runtime: overrides.runtime ?? 120,
    rating: overrides.rating ?? 7,
    posterUrl: overrides.posterUrl,
    streamingServices: overrides.streamingServices,
  } as Swipe);

// deterministic fallback selection
beforeEach(() => {
  vi.spyOn(global.Math, 'random').mockReturnValue(0.1);
});

// ---------------------------------------------------------------------------
// INTEGRATION TESTS
// ---------------------------------------------------------------------------

describe('MatchingService (integration)', () => {
  // ---------------------------------------------------------
  // 1. happy path — two users like same items
  // ---------------------------------------------------------
  it('returns ranked matches with no fallback when consensus exists', () => {
    const swipes: Swipe[] = [
      makeSwipe({ userId: 'u1', mediaId: 'm1', genres: ['Action'] }),
      makeSwipe({ userId: 'u1', mediaId: 'm2', genres: ['Comedy'] }),
      makeSwipe({ userId: 'u1', mediaId: 'm3', genres: ['Drama'] }),

      makeSwipe({ userId: 'u2', mediaId: 'm1', genres: ['Action'] }),
      makeSwipe({ userId: 'u2', mediaId: 'm2', genres: ['Comedy'] }),
      makeSwipe({ userId: 'u2', mediaId: 'm3', genres: ['Drama'] }),
    ];

    const result = MatchingService.matchSession(swipes, ['u1', 'u2']);

    expect(result.fallback).toBe(false);
    expect(result.matchedTitles.length).toBe(3);

    result.matchedTitles.forEach((t) => {
      expect(t.certainty).toBeGreaterThanOrEqual(0.5);
      expect(t.certainty).toBeLessThanOrEqual(1);
    });

    expect(result.certainty).toBeGreaterThanOrEqual(0.5);
  });

  // ---------------------------------------------------------
  // 3. hybrid mode — no intersection → union
  // ---------------------------------------------------------
  it('hybrid mode: falls back to union when intersection is empty', () => {
    const swipes: Swipe[] = [
        makeSwipe({ userId: 'u1', mediaId: 'm1', genres:['Action'], rating: 8 }),
        makeSwipe({ userId: 'u2', mediaId: 'm2', genres:['Comedy'], rating: 1 }),
    ];

    const result = MatchingService.matchSession(swipes, ['u1', 'u2']);

    expect(result.fallback).toBe(false);
    expect(result.matchedTitles.length).toBe(2);

    const ids = result.matchedTitles.map((x) => x.id);
    expect(new Set(ids)).toEqual(new Set(['m1', 'm2']));
  });

  // ---------------------------------------------------------
  // 4. zero consensus vector → fallback
  // ---------------------------------------------------------
  it('falls back when consensus vector is zero', () => {
    const swipes: Swipe[] = []; // no swipes at all → all vectors zero

    const result = MatchingService.matchSession(swipes, ['u1', 'u2']);

    expect(result.fallback).toBe(true);
    expect(result.certainty).toBe(0.5);
  });

  // ---------------------------------------------------------
  // 5. no candidate IDs → fallback
  // ---------------------------------------------------------
  it('falls back when no candidate IDs exist', () => {
    const swipes: Swipe[] = [
      makeSwipe({ userId: 'u1', mediaId: 'm1', decision: 'dislike' }),
      makeSwipe({ userId: 'u2', mediaId: 'm1', decision: 'dislike' }),
    ];

    const result = MatchingService.matchSession(swipes, ['u1', 'u2']);

    expect(result.fallback).toBe(true);
    expect(result.certainty).toBe(0.5);
  });
});