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
import type { MatchedTitle, PlayerReadiness, Session } from '../../types/session';

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
    
    const doc = querySnapshot.docs[0];
    const data = doc.data() as Omit<Session, 'id'> & {
      playerStatus?: Record<string, PlayerReadiness>;
    };

    const playerStatus = data.playerStatus ?? (Object.fromEntries(
      data.userIds.map((id) => [id, 'awaiting' as PlayerReadiness])
    ) as Record<string, PlayerReadiness>);

    return { id: doc.id, ...data, playerStatus };
  },
  async create(hostId: string, sessionData: Omit<Session, 'id' | 'roomCode' | 'userIds' | 'playerStatus'>): Promise<{ sessionId: string; roomCode: string }> {
    // Generate unique room code
    const roomCode = await this.generateRoomCode();
    
    const data = {
      ...sessionData,
      roomCode,
      userIds: [hostId],
      sessionStatus: 'awaiting' as const,
      playerStatus: Object.fromEntries([[hostId, 'awaiting' as PlayerReadiness]]) as Record<string, PlayerReadiness>,
    }

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

  async getHostByRoomCode(roomCode: string): Promise<string | null> {
    const session = await this.getByRoomCode(roomCode);
    if (!session) return null;

    return session.userIds.length > 0 ? session.userIds[0] : null;
  },

  async getStatus(sessionId: string): Promise<Session['sessionStatus'] | null> {
    const session = await this.get(sessionId);
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
    const updateUserIds = [...session.userIds, userId]; // Previous + new user
    const updatedPlayerStatus: Record<string, PlayerReadiness> = {
      ...session.playerStatus,
      [userId]: 'awaiting',
    };

    await this.update(session.id, { userIds: updateUserIds, playerStatus: updatedPlayerStatus });
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
        const likeMap = new Map<string, Set<string>>();

        swipes.forEach((swipe) => {
          if (swipe.decision !== 'like') {
            return;
          }

          if (!likeMap.has(swipe.userId)) {
            likeMap.set(swipe.userId, new Set());
          }

          likeMap.get(swipe.userId)!.add(swipe.mediaId);
        });

        const intersection = session.userIds.reduce<Set<string> | null>((acc, user) => {
          const userLikes = likeMap.get(user) ?? new Set<string>();
          if (acc === null) {
            return new Set(userLikes);
          }

          return new Set(Array.from(acc).filter((mediaId) => userLikes.has(mediaId)));
        }, null);

        const matchedIdsSet = intersection ?? new Set<string>();

        const orderedMatchedIds = swipes
          .filter((swipe) => swipe.decision === 'like' && matchedIdsSet.has(swipe.mediaId))
          .map((swipe) => swipe.mediaId)
          .filter((mediaId, index, array) => array.indexOf(mediaId) === index);

        const matchedTitles: MatchedTitle[] = orderedMatchedIds.map((mediaId) => {
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

          return match;
        });

        updates.sessionStatus = 'complete';
        updates.matchedTitles = matchedTitles;
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
