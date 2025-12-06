export type SwipeDecision = 'like' | 'dislike';

export interface Swipe {
  id: string;
  userId: string;
  mediaId: string;
  mediaTitle?: string;
  posterUrl?: string;
  genres?: string[];
  releaseYear?: number;
  runtime?: number;
  rating?: number;
  directors?: string[];
  cast?: string[];
  streamingServices?: string[];
  decision: SwipeDecision;
  createdAt: number;
}
