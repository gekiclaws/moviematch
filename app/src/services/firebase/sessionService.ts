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
  query,
  where,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';

import { db } from './index';
import type { PlayerReadiness, Session } from '../../types/session';
import { MatchingService } from '../matching/matchingService';

const collectionRef = collection(db, 'sessions');

export const SessionService = {
  /**
   * Generate a unique 6-digit room code
   */
  async generateRoomCode(): Promise<string> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Generate 6-digit code (100000 - 999999)
      const roomCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Check if code is already in use
      const isAvailable = await this.isRoomCodeAvailable(roomCode);
      if (isAvailable) {
        return roomCode;
      }

      attempts++;
    }

    throw new Error('Unable to generate unique room code after multiple attempts');
  },

  /**
   * Check if a room code is available
   */
  async isRoomCodeAvailable(roomCode: string): Promise<boolean> {
    const q = query(collectionRef, where('roomCode', '==', roomCode));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  },

  /**
   * Get session by room code
   */
  async getByRoomCode(roomCode: string): Promise<Session | null> {
    const q = query(collectionRef, where('roomCode', '==', roomCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data() as Omit<Session, 'id'> & {
      playerStatus?: Record<string, PlayerReadiness>;
    };

    const playerStatus =
      data.playerStatus ??
      (Object.fromEntries(
        data.userIds.map((id) => [id, 'awaiting' as PlayerReadiness])
      ) as Record<string, PlayerReadiness>);

    return { id: docSnap.id, ...data, playerStatus };
  },

  async create(
    hostId: string,
    sessionData: Omit<Session, 'id' | 'roomCode' | 'userIds' | 'playerStatus'>
  ): Promise<{ sessionId: string; roomCode: string }> {
    // Generate unique room code
    const roomCode = await this.generateRoomCode();

    const data = {
      ...sessionData,
      roomCode,
      userIds: [hostId],
      sessionStatus: 'awaiting' as const,
      playerStatus: Object.fromEntries([[hostId, 'awaiting' as PlayerReadiness]]) as Record<
        string,
        PlayerReadiness
      >,
    };

    const docRef = await addDoc(collectionRef, data);
    return { sessionId: docRef.id, roomCode };
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

  /**
   * Get session with proper error handling and encapsulation
   * @param sessionId - The session ID to retrieve
   * @returns Promise<Session | null> - Session object or null if not found
   */
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      return await this.get(sessionId);
    } catch (error) {
      console.error(`Error retrieving session ${sessionId}:`, error);
      return null;
    }
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

  /**
   * Delete session with proper error handling and user cleanup
   * This method ensures all users are removed from the session before deletion
   * @param sessionId - The session ID to delete
   * @returns Promise<void>
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        console.warn(`Session ${sessionId} not found, may already be deleted`);
        return;
      }

      // Clean up all users' joinedRoom field before deletion
      // This prevents the listener from firing multiple times
      const { UserService } = await import('./userService');
      
      await Promise.all(
        session.userIds.map(async (userId) => {
          try {
            await UserService.leaveRoom(userId);
          } catch (error) {
            console.error(`Error cleaning up user ${userId}:`, error);
          }
        })
      );

      // Delete the session
      await this.delete(sessionId);
      console.log(`Session ${sessionId} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error);
      throw error;
    }
  },

  // Joining Business Logic
  async getHost(sessionId: string): Promise<string | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    return session.userIds.length > 0 ? session.userIds[0] : null;
  },

  async getHostByRoomCode(roomCode: string): Promise<string | null> {
    const session = await this.getByRoomCode(roomCode);
    if (!session) return null;

    return session.userIds.length > 0 ? session.userIds[0] : null;
  },

  async getStatus(sessionId: string): Promise<Session['sessionStatus'] | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    return session.sessionStatus;
  },

  async getStatusByRoomCode(roomCode: string): Promise<Session['sessionStatus'] | null> {
    const session = await this.getByRoomCode(roomCode);
    if (!session) return null;

    return session.sessionStatus;
  },

  async joinSession(roomCode: string, userId: string): Promise<void> {
    const session = await this.getByRoomCode(roomCode);
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

    await this.update(session.id, { userIds: updateUserIds, playerStatus: updatedPlayerStatus });
  },

  // Optional helper if you still need to join by sessionId elsewhere
  async joinSessionById(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Room does not exist');

    if (session.userIds.includes(userId)) throw new Error('User already in room');
    if (session.userIds.length >= 2) throw new Error('Room is full');

    const updateUserIds = [...session.userIds, userId];
    const updatedPlayerStatus: Record<string, PlayerReadiness> = {
      ...session.playerStatus,
      [userId]: 'awaiting',
    };

    await this.update(sessionId, { userIds: updateUserIds, playerStatus: updatedPlayerStatus });
  },

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Room does not exist');

    if (!session.userIds.includes(userId)) throw new Error('User not in room');

    const updateUserIds = session.userIds.filter((id) => id !== userId);
    const { [userId]: _removed, ...remainingPlayerStatus } = session.playerStatus;

    await this.update(sessionId, { userIds: updateUserIds, playerStatus: remainingPlayerStatus });
  },

  async startMovieMatching(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId);
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

  async markPlayerFinished(
    sessionId: string,
    userId: string,
    expectedSwipeCount?: number
  ): Promise<void> {
    const sessionRef = doc(db, 'sessions', sessionId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(sessionRef);

      if (!snapshot.exists()) {
        throw new Error('Session does not exist');
      }

      const session = snapshot.data() as Omit<Session, 'id'> & {
        playerStatus?: Record<string, PlayerReadiness>;
        expectedSwipeCounts?: Record<string, number>;
      };

      if (!Array.isArray(session.userIds) || !session.userIds.includes(userId)) {
        throw new Error('User not part of this session');
      }

      const existingPlayerStatus =
        session.playerStatus ??
        (Object.fromEntries(
          session.userIds.map((id) => [id, 'awaiting' as PlayerReadiness])
        ) as Record<string, PlayerReadiness>);
      const existingExpectedCounts = session.expectedSwipeCounts ?? {};

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

      const shouldStoreExpected =
        typeof expectedSwipeCount === 'number' && expectedSwipeCount >= 0;
      const updatedExpectedCounts: Record<string, number> = {
        ...existingExpectedCounts,
        ...(shouldStoreExpected ? { [userId]: expectedSwipeCount } : {}),
      };
      if (shouldStoreExpected) {
        updates[`expectedSwipeCounts.${userId}`] = expectedSwipeCount;
      }

      const allPlayersDone = session.userIds.every(
        (id) => updatedPlayerStatus[id] === 'done'
      );

      const swipes = Array.isArray(session.swipes) ? session.swipes : [];
      const swipeCounts: Record<string, number> = session.userIds.reduce((acc, id) => {
        acc[id] = swipes.filter((s) => s.userId === id).length;
        return acc;
      }, {} as Record<string, number>);

      const allSwipeCountsSatisfied = session.userIds.every((id) => {
        const expected = updatedExpectedCounts[id];
        if (expected === undefined) return false;
        return swipeCounts[id] >= expected;
      });

      if (allPlayersDone && allSwipeCountsSatisfied) {
        const { matchedTitles, algorithmVersion, certainty } =
          MatchingService.matchSession(swipes, session.userIds, sessionId);

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
