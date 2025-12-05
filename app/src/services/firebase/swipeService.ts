// src/services/firebase/swipeService.ts
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from './index';
import type { Swipe, SwipeDecision } from '../../types/swipe';
import type { Media } from '../../types/media';

export const SwipeService = {
  /**
   * Add a swipe decision to a session
   */
  async addSwipeToSession(
    sessionId: string,
    userId: string,
    media: Pick<Media, 'id' | 'title' | 'poster' | 'streamingOptions'>,
    decision: SwipeDecision
  ): Promise<void> {
    try {
      const streamingServices = (() => {
        if (!media.streamingOptions || media.streamingOptions.length === 0) {
          return undefined;
        }

        const prioritizedGroup =
          media.streamingOptions.find((group) => group.countryCode?.toLowerCase() === 'us') ||
          media.streamingOptions[0];

        if (!prioritizedGroup || !prioritizedGroup.services) {
          return undefined;
        }

        const serviceNames = prioritizedGroup.services
          .map((service) => service.serviceName)
          .filter((name): name is string => Boolean(name && name.trim()));

        return serviceNames.length > 0 ? serviceNames : undefined;
      })();

      const swipe: Swipe = {
        id: `${userId}_${media.id}_${Date.now()}`,
        userId: userId,
        mediaId: media.id,
        mediaTitle: media.title,
        posterUrl: media.poster,
        genres: 'genres' in media && Array.isArray((media as Media).genres) ? (media as Media).genres : undefined,
        releaseYear: 'releaseYear' in media ? (media as Media).releaseYear : undefined,
        runtime: 'runtime' in media ? (media as Media).runtime : undefined,
        rating: 'rating' in media ? (media as Media).rating : undefined,
        directors: 'directors' in media && Array.isArray((media as Media).directors)
          ? (media as Media).directors
          : undefined,
        cast: 'cast' in media && Array.isArray((media as Media).cast) ? (media as Media).cast : undefined,
        streamingServices,
        decision: decision,
        createdAt: Date.now(),
      };

      console.log('Constructed swipe object:', swipe);
      const sessionRef = doc(db, 'sessions', sessionId);
      
      await updateDoc(sessionRef, {
        swipes: arrayUnion(swipe),
      });
      
    } catch (error) {
      console.error('Error adding swipe:', error);
      throw new Error('Failed to save swipe decision');
    }
  },
};

export default SwipeService;