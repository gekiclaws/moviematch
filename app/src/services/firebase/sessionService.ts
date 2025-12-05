// app/src/services/firebase/sessionService.ts

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
import type { PlayerReadiness, Session } from '../../types/session';
import { MatchingService } from '../matching/matchingService';

const collectionRef = collection(db, 'sessions');

export const SessionService = {
  async create(
    hostId: string,
    sessionData: Omit<Session, 'id' | 'userIds' | 'playerStatus'>
  ): Promise<string> {
    const data = {
      ...sessionData,
      userIds: [hostId],
      sessionStatus: 'awaiting' as const,
      playerStatus: Object.fromEntries([[hostId, 'awaiting' as PlayerReadiness]]) as Record<
        string,
        PlayerReadiness
      >,
    };

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

    const playerStatus =
      data.playerStatus ??
      (Object.fromEntries(
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
    const updateUserIds = [...session.userIds, userId];
    const updatedPlayerStatus: Record<string, PlayerReadiness> = {
      ...session.playerStatus,
      [userId]: 'awaiting',
    };

    await this.update(sessionId, { userIds: updateUserIds, playerStatus: updatedPlayerStatus });
  },

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) throw new Error('Room does not exist');

    if (!session.userIds.includes(userId)) throw new Error('User not in room');

    const updateUserIds = session.userIds.filter((id) => id !== userId);
    const { [userId]: _removed, ...remainingPlayerStatus } = session.playerStatus;

    await this.update(sessionId, { userIds: updateUserIds, playerStatus: remainingPlayerStatus });
  },

  async startMovieMatching(sessionId: string, userId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error('Session does not exist');
    }

    const hostId = await this.getHost(sessionId);
    if (hostId !== userId) {
      throw new Error('Only the host can start the session');
    }

    if (session.userIds.length !== 2) {
      throw new Error('Session must have exactly 2 users to start');
    }

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

      const existingPlayerStatus =
        session.playerStatus ??
        (Object.fromEntries(
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

      const allPlayersDone = session.userIds.every(
        (id) => updatedPlayerStatus[id] === 'done'
      );

      if (allPlayersDone) {
        const swipes = Array.isArray(session.swipes) ? session.swipes : [];

        const { matchedTitles, algorithmVersion, certainty } =
          MatchingService.matchSession(swipes, session.userIds);

        updates.sessionStatus = 'complete';
        updates.matchedTitles = matchedTitles;
        updates.matchingAlgorithmVersion = algorithmVersion;
        updates.matchCertainty = certainty;
      }

      transaction.update(sessionRef, updates);
    });
  },

  // Real-time Listeners
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
            const playerStatus =
              data.playerStatus ??
              (Object.fromEntries(
                data.userIds.map((id) => [id, 'awaiting' as PlayerReadiness])
              ) as Record<string, PlayerReadiness>);

            const session: Session = {
              id: snapshot.id,
              ...data,
              playerStatus,
            };
            onUpdate(session);
          } else {
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
          console.error('Status listener error:', error);
          onError?.(error as Error);
        }
      },
      (error) => {
        console.error('Status listener error:', error);
        onError?.(error);
      }
    );
  },

  createSessionListeners(sessionId: string) {
    const listeners: Unsubscribe[] = [];

    return {
      onSessionUpdate: (
        callback: (session: Session | null) => void,
        onError?: (error: Error) => void
      ) => {
        const unsubscribe = this.subscribeToSession(sessionId, callback, onError);
        listeners.push(unsubscribe);
        return unsubscribe;
      },

      onStatusUpdate: (
        callback: (status: Session['sessionStatus'] | null, userCount: number) => void,
        onError?: (error: Error) => void
      ) => {
        const unsubscribe = this.subscribeToSessionStatus(sessionId, callback, onError);
        listeners.push(unsubscribe);
        return unsubscribe;
      },

      cleanup: () => {
        listeners.forEach((unsubscribe) => unsubscribe());
        listeners.length = 0;
      },
    };
  },
};

export default SessionService;