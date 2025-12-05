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
import { buildConsensusVector, buildUserPreferenceVector, rankCandidates } from '../matching/embedding';

const MATCHING_ALGORITHM_VERSION = 2;

type CandidateSelectionMode = 'union' | 'strict' | 'hybrid';

const CANDIDATE_SELECTION_MODE: CandidateSelectionMode = 'hybrid';
const MAX_RESULTS = 3;

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

const buildMatchedTitle = (
  mediaId: string,
  swipes: Swipe[],
  similarityScore?: number,
  certainty?: number
): MatchedTitle => {
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

  if (typeof certainty === 'number') {
    match.certainty = certainty;
  }

  return match;
};

const shuffle = <T>(items: T[]) => {
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

  return shuffled.slice(0, count).map((swipe) => buildMatchedTitle(swipe.mediaId, swipes));
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
      fallback: true,
      certainty,
    };
  };

  if (candidateIds.length === 0 || consensusVector.isZero) {
    return useFallback('empty_candidates_or_zero_consensus');
  }

  const { ranked, stats, sessionCertainty } = rankCandidates(swipes, consensusVector, candidateIds, MAX_RESULTS);

  if (!stats || sessionCertainty === null) {
    return useFallback('invalid_score_distribution', stats ?? undefined);
  }

  console.log(
    '[VectorMatching] Ranking',
    JSON.stringify({
      topScores: ranked.map(({ mediaId, score }) => ({ mediaId, score: Number(score.toFixed(4)) })),
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
    matchedTitles: ranked.map(({ mediaId, score, certainty }) => buildMatchedTitle(mediaId, swipes, score, certainty)),
    algorithmVersion: MATCHING_ALGORITHM_VERSION,
    fallback: false,
    certainty: sessionCertainty,
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
              matchedTitles: getRandomFallbackMatches(swipes, MAX_RESULTS),
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
