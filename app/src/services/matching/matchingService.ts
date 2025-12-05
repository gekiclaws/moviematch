// app/src/services/matching/matchingService.ts

import type { Swipe } from '../../types/swipe';
import type { MatchedTitle } from '../../types/session';
import {
  buildUserPreferenceVector,
  buildConsensusVector,
  rankCandidates,
} from './embedding';

const MATCHING_ALGORITHM_VERSION = 2;
const MAX_RESULTS = 3;

type CandidateSelectionMode = 'union' | 'strict' | 'hybrid';
const CANDIDATE_SELECTION_MODE: CandidateSelectionMode = 'hybrid';

export type MatchSessionResult = {
  matchedTitles: MatchedTitle[];
  algorithmVersion: number;
  certainty: number;
  fallback: boolean;
};

const selectCandidateIds = (swipes: Swipe[], userIds: string[]): Set<string> => {
  const userLikeSets = userIds.map((id) =>
    new Set(
      swipes
        .filter((swipe) => swipe.userId === id && swipe.decision === 'like')
        .map((swipe) => swipe.mediaId)
    )
  );

  const union = new Set<string>();
  userLikeSets.forEach((set) => set.forEach((id) => union.add(id)));

  const intersection = userLikeSets.reduce<Set<string>>((acc, set) => {
    if (acc.size === 0) return new Set(set);
    return new Set([...acc].filter((id) => set.has(id)));
  }, new Set<string>());

  if (CANDIDATE_SELECTION_MODE === 'strict') {
    return intersection;
  }

  if (CANDIDATE_SELECTION_MODE === 'hybrid' && intersection.size > 0) {
    return intersection;
  }

  return union;
};

const buildMatchedTitle = (
  mediaId: string,
  swipes: Swipe[],
  similarityScore?: number,
  certainty?: number
): MatchedTitle => {
  const swipeWithMeta = swipes.find(
    (swipe) => swipe.mediaId === mediaId && swipe.decision === 'like'
  );

  const match: MatchedTitle = {
    id: mediaId,
    title: swipeWithMeta?.mediaTitle ?? mediaId,
  };

  if (swipeWithMeta?.posterUrl) {
    match.posterUrl = swipeWithMeta.posterUrl;
  }

  if (swipeWithMeta?.streamingServices && swipeWithMeta.streamingServices.length > 0) {
    match.streamingServices = swipeWithMeta.streamingServices;
  }

  if (typeof similarityScore === 'number') {
    match.similarityScore = similarityScore;
  }

  if (typeof certainty === 'number') {
    match.certainty = certainty;
  }

  return match;
};

const shuffle = <T>(items: T[]): T[] => {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

const getRandomFallbackMatches = (swipes: Swipe[], count: number): MatchedTitle[] => {
  const uniqueByMedia = new Map<string, Swipe>();

  swipes.forEach((swipe) => {
    if (!uniqueByMedia.has(swipe.mediaId)) {
      uniqueByMedia.set(swipe.mediaId, swipe);
    }
  });

  const candidates = Array.from(uniqueByMedia.values());

  if (candidates.length === 0) {
    return [];
  }

  const shuffled = shuffle(candidates);

  return shuffled
    .slice(0, count)
    .map((swipe) => buildMatchedTitle(swipe.mediaId, swipes));
};

const computeMatchesInternal = (swipes: Swipe[], userIds: string[]): MatchSessionResult => {
  const userVectors = userIds.map((id) => buildUserPreferenceVector(swipes, id));
  const consensusVector = buildConsensusVector(userVectors);
  const candidateIds = Array.from(selectCandidateIds(swipes, userIds));

  const baseMetrics = {
    candidateCount: candidateIds.length,
    userMagnitudes: userVectors.map((vector) => Number(vector.magnitude.toFixed(4))),
    consensusMagnitude: Number(consensusVector.magnitude.toFixed(4)),
  };

  console.log('[VectorMatching] Metrics', JSON.stringify(baseMetrics));

  const useFallback = (reason: string, stats?: { top: number; mean: number; std: number }) => {
    const fallbackMatches = getRandomFallbackMatches(swipes, MAX_RESULTS);
    const certainty = 0.5;

    console.log(
      '[VectorMatching] Fallback',
      JSON.stringify({
        reason,
        fallbackUsed: true,
        certainty,
        stats,
        topMatches: fallbackMatches.map(({ id }) => id),
      })
    );

    return {
      matchedTitles: fallbackMatches,
      algorithmVersion: MATCHING_ALGORITHM_VERSION,
      certainty,
      fallback: true,
    };
  };

  if (candidateIds.length === 0 || consensusVector.isZero) {
    return useFallback('empty_candidates_or_zero_consensus');
  }

  const { ranked, stats, sessionCertainty } = rankCandidates(
    swipes,
    consensusVector,
    candidateIds,
    MAX_RESULTS
  );

  if (!stats || sessionCertainty === null) {
    return useFallback('invalid_score_distribution', stats ?? undefined);
  }

  console.log(
    '[VectorMatching] Ranking',
    JSON.stringify({
      topScores: ranked.map(({ mediaId, score }) => ({
        mediaId,
        score: Number(score.toFixed(4)),
      })),
      certainty: Number(sessionCertainty.toFixed(4)),
      stats: {
        s1: Number(stats.top.toFixed(4)),
        sMean: Number(stats.mean.toFixed(4)),
        sStd: Number(stats.std.toFixed(4)),
      },
      fallbackUsed: false,
    })
  );

  return {
    matchedTitles: ranked.map(({ mediaId, score, certainty }) =>
      buildMatchedTitle(mediaId, swipes, score, certainty)
    ),
    algorithmVersion: MATCHING_ALGORITHM_VERSION,
    certainty: sessionCertainty,
    fallback: false,
  };
};

export const MatchingService = {
  matchSession(swipes: Swipe[], userIds: string[]): MatchSessionResult {
    try {
      const result = computeMatchesInternal(swipes, userIds);
      console.log('[VectorMatching] FallbackUsed', result.fallback);
      return result;
    } catch (error) {
      console.error(
        '[VectorMatching] Error',
        error instanceof Error ? error.message : error
      );
      const fallbackMatches = getRandomFallbackMatches(swipes, MAX_RESULTS);
      return {
        matchedTitles: fallbackMatches,
        algorithmVersion: MATCHING_ALGORITHM_VERSION,
        certainty: 0.5,
        fallback: true,
      };
    }
  },
};