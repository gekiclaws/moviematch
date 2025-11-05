import { Swipe } from './swipe';

export type SessionStatus = 'awaiting' | 'in progress' | 'complete';

export interface Session {
  id: string;
  userIds: string[];
  movieType: Array<'movie' | 'show'>;
  genres: string[];
  streamingServices: string[];
  favoriteTitles: string[];
  swipes: Swipe[];
  matchedTitles?: string[];
  createdAt: number;
  sessionStatus: SessionStatus;
}
