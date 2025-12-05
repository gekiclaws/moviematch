// app/src/services/matching/matchingService.ts
import type { Swipe } from '../../types/swipe';
import type { MatchedTitle } from '../../types/session';
import {
  buildUserPreferenceVector as defaultBuildUserPreferenceVector,
  buildConsensusVector as defaultBuildConsensusVector,
  rankCandidates as defaultRankCandidates,
} from './embedding';

const MATCHING_ALGORITHM_VERSION = 2;
const MAX_RESULTS = 3;

export type MatchSessionResult = {
  matchedTitles: MatchedTitle[];
  algorithmVersion: number;
  certainty: number;
  fallback: boolean;
};

type CandidateSelectionMode = 'union' | 'strict' | 'hybrid';
const CANDIDATE_SELECTION_MODE: CandidateSelectionMode = 'hybrid';

//
// ---------------------- Dependency Injection Layer ----------------------
//
export function createMatchingService(deps: {
  buildUserPreferenceVector?: typeof defaultBuildUserPreferenceVector;
  buildConsensusVector?: typeof defaultBuildConsensusVector;
  rankCandidates?: typeof defaultRankCandidates;
} = {}) {
  const buildUserPreferenceVector = deps.buildUserPreferenceVector ?? defaultBuildUserPreferenceVector;
  const buildConsensusVector = deps.buildConsensusVector ?? defaultBuildConsensusVector;
  const rankCandidates = deps.rankCandidates ?? defaultRankCandidates;

  //
  // -------------------------- Internal Helpers --------------------------
  //
  const selectCandidateIds = (swipes: Swipe[], userIds: string[]): Set<string> => {
    const userLikeSets = userIds.map((id) =>
      new Set(
        swipes
          .filter((s) => s.userId === id && s.decision === 'like')
          .map((s) => s.mediaId)
      )
    );

    const union = new Set<string>();
    userLikeSets.forEach((set) => set.forEach((id) => union.add(id)));

    const intersection = userLikeSets.reduce<Set<string>>((acc, set) => {
      if (acc.size === 0) return new Set(set);
      return new Set([...acc].filter((id) => set.has(id)));
    }, new Set<string>());

    if (CANDIDATE_SELECTION_MODE === 'strict') return intersection;
    if (CANDIDATE_SELECTION_MODE === 'hybrid' && intersection.size > 0) return intersection;
    return union;
  };

  const buildMatchedTitle = (
    mediaId: string,
    swipes: Swipe[],
    similarityScore?: number,
    certainty?: number
  ): MatchedTitle => {
    const swipe = swipes.find((s) => s.mediaId === mediaId && s.decision === 'like');

    const title: MatchedTitle = {
      id: mediaId,
      title: swipe?.mediaTitle ?? mediaId,
    };

    if (swipe?.posterUrl) title.posterUrl = swipe.posterUrl;
    if (swipe?.streamingServices?.length) title.streamingServices = swipe.streamingServices;
    if (similarityScore !== undefined) title.similarityScore = similarityScore;
    if (certainty !== undefined) title.certainty = certainty;

    return title;
  };

  const shuffle = <T>(items: T[]): T[] => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const getRandomFallbackMatches = (swipes: Swipe[], count: number): MatchedTitle[] => {
    const uniq = new Map<string, Swipe>();
    for (const s of swipes) {
      if (!uniq.has(s.mediaId)) uniq.set(s.mediaId, s);
    }
    const candidates = [...uniq.values()];
    if (candidates.length === 0) return [];

    return shuffle(candidates)
      .slice(0, count)
      .map((s) => buildMatchedTitle(s.mediaId, swipes));
  };

  //
  // -------------------------- Core Matching Logic --------------------------
  //
  const computeMatchesInternal = (swipes: Swipe[], userIds: string[]): MatchSessionResult => {
    const userVectors = userIds.map((id) => buildUserPreferenceVector(swipes, id));
    const consensusVector = buildConsensusVector(userVectors);
    const candidateIds = [...selectCandidateIds(swipes, userIds)];

    if (candidateIds.length === 0 || consensusVector.isZero) {
      return {
        matchedTitles: getRandomFallbackMatches(swipes, MAX_RESULTS),
        algorithmVersion: MATCHING_ALGORITHM_VERSION,
        certainty: 0.5,
        fallback: true,
      };
    }

    const { ranked, stats, sessionCertainty } = rankCandidates(
      swipes,
      consensusVector,
      candidateIds,
      MAX_RESULTS
    );

    if (!stats || sessionCertainty === null) {
      return {
        matchedTitles: getRandomFallbackMatches(swipes, MAX_RESULTS),
        algorithmVersion: MATCHING_ALGORITHM_VERSION,
        certainty: 0.5,
        fallback: true,
      };
    }

    return {
      matchedTitles: ranked.map((r) =>
        buildMatchedTitle(r.mediaId, swipes, r.score, r.certainty)
      ),
      algorithmVersion: MATCHING_ALGORITHM_VERSION,
      certainty: sessionCertainty,
      fallback: false,
    };
  };

  //
  // --------------------------- Public API ---------------------------
  //
  return {
    matchSession(swipes: Swipe[], userIds: string[]): MatchSessionResult {
      try {
        return computeMatchesInternal(swipes ?? [], userIds);
      } catch (err) {
        return {
          matchedTitles: getRandomFallbackMatches(swipes ?? [], MAX_RESULTS),
          algorithmVersion: MATCHING_ALGORITHM_VERSION,
          certainty: 0.5,
          fallback: true,
        };
      }
    },
  };
}

//
// ------------------ Default export: production service ------------------
//
export const MatchingService = createMatchingService();
export { MATCHING_ALGORITHM_VERSION };