// src/services/firebase/swipeService.ts
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from './index';
import type { Swipe, SwipeDecision } from '../../types/swipe';

export const SwipeService = {
  /**
   * Add a swipe decision to a session
   */
  async addSwipeToSession(
    sessionId: string,
    userId: string,
    mediaId: string,
    decision: SwipeDecision
  ): Promise<void> {
    try {
      const swipe: Swipe = {
        id: `${userId}_${mediaId}_${Date.now()}`,
        userId: userId,
        mediaId: mediaId,
        decision: decision,
        createdAt: Date.now(),
      };

      const sessionRef = doc(db, 'sessions', sessionId);
      
      await updateDoc(sessionRef, {
        swipes: arrayUnion(swipe),
      });

      console.log('Swipe added:', swipe);
    } catch (error) {
      console.error('Error adding swipe:', error);
      throw new Error('Failed to save swipe decision');
    }
  },
};

export default SwipeService;