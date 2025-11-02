export type SwipeDecision = 'like' | 'dislike';

export interface Swipe {
  id: string;
  userId: string;
  titleId: string;
  decision: SwipeDecision;
  createdAt: number;
}
