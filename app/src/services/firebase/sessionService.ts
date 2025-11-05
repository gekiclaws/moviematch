import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
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

  async getHost(sessionId: string): Promise<string | null> {
    const session = await this.get(sessionId);
    if (!session) return null;

    return session.userIds.length > 0 ? session.userIds[0] : null;
  },

  // Joining Business Logic
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
    this.update(sessionId, { sessionStatus: 'in progress'});
  },


};

export default SessionService;
