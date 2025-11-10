export type SwipeDecision = 'like' | 'dislike';

export interface Swipe {
  id: string;
  userId: string;
  mediaId: string;
  mediaTitle?: string;
  posterUrl?: string;
  streamingServices?: string[];
  decision: SwipeDecision;
  createdAt: number;
}
