export type SwipeDecision = 'like' | 'dislike';

export interface Swipe {
  id: string;
  userId: string;
  mediaId: string;
  decision: SwipeDecision;
  createdAt: number;
}
