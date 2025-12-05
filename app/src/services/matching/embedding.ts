import type { Swipe } from '../../types/swipe';
const EMBEDDING_VERSION = 1;

const GENRE_DIM = 16;
const DIRECTOR_DIM = 16;
const CAST_DIM = 32;
const SCALAR_DIM = 3; // release year, runtime, rating
const EMBED_DIM = GENRE_DIM + DIRECTOR_DIM + CAST_DIM + SCALAR_DIM;

const GENRE_START = 0;
const RELEASE_YEAR_INDEX = GENRE_START + GENRE_DIM;
const RUNTIME_INDEX = RELEASE_YEAR_INDEX + 1;
const RATING_INDEX = RUNTIME_INDEX + 1;
const DIRECTOR_START = RATING_INDEX + 1;
const CAST_START = DIRECTOR_START + DIRECTOR_DIM;

type PreferenceVector = {
  vector: number[];
  magnitude: number;
  isZero: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const vectorMagnitude = (vector: number[]) => Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

const hashString = (value: string, seed = 0) => {
  let hash = seed + EMBEDDING_VERSION * 31;

  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return Math.abs(hash);
};

const normalizeValue = (value: number | undefined, min: number, max: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  const clamped = clamp(value, min, max);
  return (clamped - min) / (max - min);
};

const addHashedMultiHot = (
  values: string[] | undefined,
  start: number,
  size: number,
  vector: number[],
  seed: number
) => {
  if (!values || values.length === 0) {
    return;
  }

  values.forEach((item) => {
    const index = start + (hashString(item, seed) % size);
    vector[index] = 1;
  });
};

const buildEmbeddingFromSwipe = (swipe: Swipe): number[] => {
  const embedding = new Array(EMBED_DIM).fill(0);

  addHashedMultiHot(swipe.genres, GENRE_START, GENRE_DIM, embedding, 11);

  embedding[RELEASE_YEAR_INDEX] = normalizeValue(swipe.releaseYear, 1900, 2025);
  embedding[RUNTIME_INDEX] = normalizeValue(swipe.runtime, 60, 240);
  embedding[RATING_INDEX] = normalizeValue(swipe.rating, 0, 10);

  addHashedMultiHot(swipe.directors, DIRECTOR_START, DIRECTOR_DIM, embedding, 23);
  addHashedMultiHot(swipe.cast, CAST_START, CAST_DIM, embedding, 37);

  return embedding;
};

const normalizeVector = (vector: number[]): PreferenceVector => {
  const magnitude = vectorMagnitude(vector);

  if (magnitude === 0) {
    return { vector: new Array(vector.length).fill(0), magnitude, isZero: true };
  }

  return {
    vector: vector.map((value) => value / magnitude),
    magnitude,
    isZero: false,
  };
};

const buildUserPreferenceVector = (
  swipes: Swipe[],
  userId: string,
  embedFn: (swipe: Swipe) => number[] = buildEmbeddingFromSwipe
): PreferenceVector => {
  const userSwipes = swipes.filter((swipe) => swipe.userId === userId);
  const aggregate = new Array(EMBED_DIM).fill(0);

  userSwipes.forEach((swipe) => {
    const direction = swipe.decision === 'like' ? 1 : -1;
    const embedding = embedFn(swipe);

    embedding.forEach((value, index) => {
      aggregate[index] += value * direction;
    });
  });

  return normalizeVector(aggregate);
};

const buildConsensusVector = (
  vectors: PreferenceVector[],
  normalize: (vec: number[]) => PreferenceVector = normalizeVector
): PreferenceVector => {
  const aggregate = new Array(EMBED_DIM).fill(0);

  vectors.forEach(({ vector }) => {
    vector.forEach((value, index) => {
      aggregate[index] += value;
    });
  });

  return normalize(aggregate);
};

const dotProduct = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);

const computeScoreStats = (scores: number[]) => {
  if (scores.length === 0) {
    return null;
  }

  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length;
  const std = Math.sqrt(variance);
  const top = Math.max(...scores);

  if (!Number.isFinite(mean) || !Number.isFinite(std) || std <= 0) {
    return null;
  }

  return { top, mean, std };
};

const computeCertaintyForScore = (score: number, stats: { mean: number; std: number }) => {
  const raw = (score - stats.mean) / stats.std;
  const sigmoid = 1 / (1 + Math.exp(-raw));
  const certainty = clamp(0.5 + 0.5 * sigmoid, 0.5, 1);

  return certainty;
};

const rankCandidates = (
  swipes: Swipe[],
  consensusVector: PreferenceVector,
  candidateIds: string[],
  maxResults: number
) => {
  const seenOrder = new Map<string, number>();
  swipes.forEach((swipe, index) => {
    if (!seenOrder.has(swipe.mediaId)) {
      seenOrder.set(swipe.mediaId, index);
    }
  });

  const scoredMatches = candidateIds.map((mediaId) => {
    const swipe = swipes.find((s) => s.mediaId === mediaId);
    const embedding = normalizeVector(buildEmbeddingFromSwipe(swipe ?? ({ mediaId } as Swipe)));
    const score = embedding.isZero ? 0 : dotProduct(consensusVector.vector, embedding.vector);
    return { mediaId, score };
  });

  const stats = computeScoreStats(scoredMatches.map((match) => match.score));
  if (!stats) {
    return { ranked: [], stats: null, sessionCertainty: null };
  }

  const orderedMatches = scoredMatches
    .sort((a, b) => {
      if (b.score === a.score) {
        return (seenOrder.get(a.mediaId) ?? 0) - (seenOrder.get(b.mediaId) ?? 0);
      }
      return b.score - a.score;
    })
    .slice(0, maxResults);

  const sessionCertainty = computeCertaintyForScore(stats.top, stats);
  const ranked = orderedMatches.map(({ mediaId, score }) => ({
    mediaId,
    score,
    certainty: computeCertaintyForScore(score, stats),
  }));

  return { ranked, stats, sessionCertainty };
};

export {
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
};

export type { PreferenceVector };
