import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

import { db } from './index';
import type { Session } from '../../types/session';

const collectionRef = collection(db, 'sessions');

export const SessionService = {
  async create(hostId: string, sessionData: Omit<Session, 'id' | 'userIds'>): Promise<string> {
    const data = {
      ...sessionData,
      userIds: [hostId],
      sessionStatus: 'awaiting' as const,
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

    return { id: snapshot.id, ...(snapshot.data() as Omit<Session, 'id'>) };
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
    await this.update(sessionId, { userIds: updateUserIds });
  },

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) throw new Error('Room does not exist');
    
    // Check if the user is in the session
    if (!session.userIds.includes(userId)) throw new Error('User not in room');
    // Remove user from session
    const updateUserIds = session.userIds.filter(id => id !== userId);
    await this.update(sessionId, { userIds: updateUserIds });
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
    await this.update(sessionId, { sessionStatus: 'in progress'});
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
            const session: Session = {
              id: snapshot.id,
              ...(snapshot.data() as Omit<Session, 'id'>)
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
