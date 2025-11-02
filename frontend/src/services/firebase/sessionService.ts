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
  async create(data: Omit<Session, 'id'>): Promise<string> {
    if (data.userIds.length !== 2) {
      throw new Error('Session must have exactly 2 users');
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
    if (data.userIds && data.userIds.length !== 2) {
      throw new Error('Session must have exactly 2 users');
    }

    const ref = doc(db, 'sessions', id);
    await updateDoc(ref, data);
  },

  async remove(id: string): Promise<void> {
    const ref = doc(db, 'sessions', id);
    await deleteDoc(ref);
  },
};

export default SessionService;
