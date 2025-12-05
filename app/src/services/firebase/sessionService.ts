import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  Unsubscribe,
} from 'firebase/firestore';

import { db } from './index';
import type { MatchedTitle, PlayerReadiness, Session } from '../../types/session';
import type { Swipe } from '../../types/swipe';

const MATCHING_ALGORITHM_VERSION = 2;
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

type CandidateSelectionMode = 'union' | 'strict' | 'hybrid';

const CANDIDATE_SELECTION_MODE: CandidateSelectionMode = 'hybrid';
const MAX_RESULTS = 3;

const FALLBACK_RECOMMENDATIONS: MatchedTitle[] = [
  {
    id: 'tt1375666',
    title: 'Inception',
    streamingServices: ['Netflix'],
  },
  {
    id: 'tt0114369',
    title: 'Se7en',
    streamingServices: ['Prime Video'],
  },
  {
    id: 'tt0169547',
    title: 'American Beauty',
    streamingServices: ['Max'],
  },
  {
    id: 'tt0137523',
    title: 'Fight Club',
    streamingServices: ['Hulu'],
  },
  {
    id: 'tt0109830',
    title: 'Forrest Gump',
    streamingServices: ['Paramount+'],
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

const vectorMagnitude = (vector: number[]) => Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

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

const buildUserPreferenceVector = (swipes: Swipe[], userId: string): PreferenceVector => {
  const userSwipes = swipes.filter((swipe) => swipe.userId === userId);
  const aggregate = new Array(EMBED_DIM).fill(0);

  userSwipes.forEach((swipe) => {
    const direction = swipe.decision === 'like' ? 1 : -1;
    const embedding = buildEmbeddingFromSwipe(swipe);

    embedding.forEach((value, index) => {
      aggregate[index] += value * direction;
    });
  });

  return normalizeVector(aggregate);
};

const buildConsensusVector = (vectors: PreferenceVector[]): PreferenceVector => {
  const aggregate = new Array(EMBED_DIM).fill(0);

  vectors.forEach(({ vector }) => {
    vector.forEach((value, index) => {
      aggregate[index] += value;
    });
  });

  return normalizeVector(aggregate);
};

const selectCandidateIds = (swipes: Swipe[], userIds: string[]): Set<string> => {
  const userLikeSets = userIds.map((id) =>
    new Set(swipes.filter((swipe) => swipe.userId === id && swipe.decision === 'like').map((swipe) => swipe.mediaId))
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

const dotProduct = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);

const buildMatchedTitle = (mediaId: string, swipes: Swipe[], similarityScore?: number): MatchedTitle => {
  const swipeWithMeta = swipes.find((swipe) => swipe.mediaId === mediaId && swipe.decision === 'like');

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

  return match;
};

const getRandomFallbackMatches = (count: number): MatchedTitle[] => {
  const shuffled = [...FALLBACK_RECOMMENDATIONS];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
};

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

const computeCertainty = (stats: { top: number; mean: number; std: number }) => {
  const raw = (stats.top - stats.mean) / stats.std;
  const sigmoid = 1 / (1 + Math.exp(-raw));
  const certainty = clamp(0.5 + 0.5 * sigmoid, 0.5, 1);

  return certainty;
};

const computeVectorMatches = (swipes: Swipe[], userIds: string[]) => {
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
    const fallbackMatches = getRandomFallbackMatches(MAX_RESULTS);
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
      fallback: true,
      certainty,
    };
  };

  if (candidateIds.length === 0 || consensusVector.isZero) {
    return useFallback('empty_candidates_or_zero_consensus');
  }

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
    return useFallback('invalid_score_distribution');
  }

  const certainty = computeCertainty(stats);

  const orderedMatches = scoredMatches
    .sort((a, b) => {
      if (b.score === a.score) {
        return (seenOrder.get(a.mediaId) ?? 0) - (seenOrder.get(b.mediaId) ?? 0);
      }
      return b.score - a.score;
    })
    .slice(0, MAX_RESULTS);

  console.log(
    '[VectorMatching] Ranking',
    JSON.stringify({
      topScores: orderedMatches.map(({ mediaId, score }) => ({ mediaId, score: Number(score.toFixed(4)) })),
      certainty: Number(certainty.toFixed(4)),
      stats: {
        s1: Number(stats.top.toFixed(4)),
        sMean: Number(stats.mean.toFixed(4)),
        sStd: Number(stats.std.toFixed(4)),
      },
      fallbackUsed: false,
    })
  );

  return {
    matchedTitles: orderedMatches.map(({ mediaId, score }) => buildMatchedTitle(mediaId, swipes, score)),
    algorithmVersion: MATCHING_ALGORITHM_VERSION,
    fallback: false,
    certainty,
  };
};

const collectionRef = collection(db, 'sessions');

export const SessionService = {
  async create(hostId: string, sessionData: Omit<Session, 'id' | 'userIds' | 'playerStatus'>): Promise<string> {
    const data = {
      ...sessionData,
      userIds: [hostId],
      sessionStatus: 'awaiting' as const,
      playerStatus: Object.fromEntries([[hostId, 'awaiting' as PlayerReadiness]]) as Record<string, PlayerReadiness>,
    }

    const docRef = await addDoc(collectionRef, data);
    return docRef.id;
  },

  async get(id: string): Promise<Session | null> {
    const ref = doc(db, 'sessions', id);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as Omit<Session, 'id'> & {
      playerStatus?: Record<string, PlayerReadiness>;
    };

    const playerStatus = data.playerStatus ?? (Object.fromEntries(
      data.userIds.map((id) => [id, 'awaiting' as PlayerReadiness])
    ) as Record<string, PlayerReadiness>);

    return { id: snapshot.id, ...data, playerStatus };
  },

  async update(id: string, data: Partial<Omit<Session, 'id'>>): Promise<void> {
    if (data.userIds && (data.userIds.length < 1 || data.userIds.length > 2)) {
      throw new Error('Session must have 1 or 2 users');
    }

    const ref = doc(db, 'sessions', id);
    await updateDoc(ref, data);
  },

  async delete(id: string): Promise<void> {
    const ref = doc(db, 'sessions', id);
    await deleteDoc(ref);
  },
  
  // Joining Business Logic
  async getHost(sessionId: string): Promise<string | null> {
    const session = await this.get(sessionId);
    if (!session) return null;

    return session.userIds.length > 0 ? session.userIds[0] : null;
  },

  async getStatus(sessionId: string): Promise<Session['sessionStatus'] | null> {
    const session = await this.get(sessionId);
    if (!session) return null;
    
    return session.sessionStatus;
  },
  async joinSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) throw new Error('Room does not exist');

    // Check if the user can join (< 2 users and not already in session)
    if (session.userIds.includes(userId)) throw new Error('User already in room');
    if (session.userIds.length >= 2) throw new Error('Room is full');

    // Update session with new user
    const updateUserIds = [...session.userIds, userId]; // Previous + new user
    const updatedPlayerStatus: Record<string, PlayerReadiness> = {
      ...session.playerStatus,
      [userId]: 'awaiting',
    };

    await this.update(sessionId, { userIds: updateUserIds, playerStatus: updatedPlayerStatus });
  },

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) throw new Error('Room does not exist');

    // Check if the user is in the session
    if (!session.userIds.includes(userId)) throw new Error('User not in room');
    // Remove user from session
    const updateUserIds = session.userIds.filter(id => id !== userId);
    const { [userId]: _removed, ...remainingPlayerStatus } = session.playerStatus;

    await this.update(sessionId, { userIds: updateUserIds, playerStatus: remainingPlayerStatus });
  },

  async startMovieMatching(sessionId: string, userId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error('Session does not exist');
    }

    // Check host permissions
    const hostId = await this.getHost(sessionId);
    if (hostId !== userId) {
      throw new Error('Only the host can start the session');
    }

    // Check if there are exactly 2 users
    if (session.userIds.length !== 2) {
      throw new Error('Session must have exactly 2 users to start');
    }

    // Update session status to 'in progress'
    const playerStatus = Object.fromEntries(
      session.userIds.map((id) => [id, 'awaiting' as PlayerReadiness])
    ) as Record<string, PlayerReadiness>;

    await this.update(sessionId, { sessionStatus: 'in progress', playerStatus });
  },

  async markPlayerFinished(sessionId: string, userId: string): Promise<void> {
    const sessionRef = doc(db, 'sessions', sessionId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(sessionRef);

      if (!snapshot.exists()) {
        throw new Error('Session does not exist');
      }

      const session = snapshot.data() as Omit<Session, 'id'> & {
        playerStatus?: Record<string, PlayerReadiness>;
      };

      if (!Array.isArray(session.userIds) || !session.userIds.includes(userId)) {
        throw new Error('User not part of this session');
      }

      const existingPlayerStatus = session.playerStatus ?? (Object.fromEntries(
        session.userIds.map((id) => [id, 'awaiting' as PlayerReadiness])
      ) as Record<string, PlayerReadiness>);

      if (existingPlayerStatus[userId] === 'done') {
        return;
      }

      const updatedPlayerStatus: Record<string, PlayerReadiness> = {
        ...existingPlayerStatus,
        [userId]: 'done',
      };

      const updates: Record<string, unknown> = {
        [`playerStatus.${userId}`]: 'done',
      };

      const allPlayersDone = session.userIds.every((id) => updatedPlayerStatus[id] === 'done');

      if (allPlayersDone) {
        const swipes = Array.isArray(session.swipes) ? session.swipes : [];

        const computeMatches = () => {
          try {
            const result = computeVectorMatches(swipes, session.userIds);
            console.log('[VectorMatching] FallbackUsed', result.fallback);
            return {
              matchedTitles: result.matchedTitles,
              algorithmVersion: result.algorithmVersion,
              certainty: result.certainty,
            };
          } catch (error) {
            console.error('[VectorMatching] Error', error instanceof Error ? error.message : error);
            return {
              matchedTitles: getRandomFallbackMatches(MAX_RESULTS),
              algorithmVersion: MATCHING_ALGORITHM_VERSION,
              certainty: 0.5,
            };
          }
        };

        const { matchedTitles, algorithmVersion, certainty } = computeMatches();

        updates.sessionStatus = 'complete';
        updates.matchedTitles = matchedTitles;
        updates.matchingAlgorithmVersion = algorithmVersion;
        updates.matchCertainty = certainty;
      }

      transaction.update(sessionRef, updates);
    });
  },

  // Real-time Listeners
  /**
   * Subscribe to real-time updates for a specific session
   * @param sessionId - The session to listen to
   * @param onUpdate - Callback function when session data changes
   * @param onError - Callback function when listener encounters an error
   * @returns Unsubscribe function to stop listening
  */
  subscribeToSession(
    sessionId: string,
    onUpdate: (session: Session | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const ref = doc(db, 'sessions', sessionId);
    
    return onSnapshot(
      ref,
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            const data = snapshot.data() as Omit<Session, 'id'> & {
              playerStatus?: Record<string, PlayerReadiness>;
            };
            const playerStatus = data.playerStatus ?? (Object.fromEntries(
              data.userIds.map((id) => [id, 'awaiting' as PlayerReadiness])
            ) as Record<string, PlayerReadiness>);

            const session: Session = {
              id: snapshot.id,
              ...data,
              playerStatus,
            };
            onUpdate(session);
          } else {
            // Session was deleted
            onUpdate(null);
          }
        } catch (error) {
          console.error('Error processing session update:', error);
          onError?.(error as Error);
        }
      },
      (error) => {
        console.error('Session listener error:', error);
        onError?.(error);
      }
    );
  },

  /**
   * Subscribe only to session status changes (more efficient for status monitoring)
   * @param sessionId - The session to monitor
   * @param onStatusChange - Callback when status changes
   * @param onError - Error callback
   * @returns Unsubscribe function
   */
  subscribeToSessionStatus(
    sessionId: string,
    onStatusChange: (status: Session['sessionStatus'] | null, userCount: number) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const ref = doc(db, 'sessions', sessionId);
    
    return onSnapshot(
      ref,
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            const data = snapshot.data() as Omit<Session, 'id'>;
            onStatusChange(data.sessionStatus, data.userIds.length);
          } else {
            onStatusChange(null, 0);
          }
        } catch (error) {
          console.error('Error processing status update:', error);
          onError?.(error as Error);
        }
      },
      (error) => {
        console.error('Status listener error:', error);
        onError?.(error);
      }
    );
  },

  /**
   * Helper to manage multiple listeners for a session
   * Useful for screens that need multiple types of updates
   */
  createSessionListeners(sessionId: string) {
    const listeners: Unsubscribe[] = [];
    
    return {
      // Subscribe to full session updates
      onSessionUpdate: (callback: (session: Session | null) => void, onError?: (error: Error) => void) => {
        const unsubscribe = this.subscribeToSession(sessionId, callback, onError);
        listeners.push(unsubscribe);
        return unsubscribe;
      },
      
      // Subscribe to status-only updates
      onStatusUpdate: (callback: (status: Session['sessionStatus'] | null, userCount: number) => void, onError?: (error: Error) => void) => {
        const unsubscribe = this.subscribeToSessionStatus(sessionId, callback, onError);
        listeners.push(unsubscribe);
        return unsubscribe;
      },
      
      // Cleanup all listeners at once
      cleanup: () => {
        listeners.forEach(unsubscribe => unsubscribe());
        listeners.length = 0; // Clear the array
      }
    };
  },


};

export default SessionService;
