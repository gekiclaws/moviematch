import { Swipe } from './swipe';

export type SessionStatus = 'awaiting' | 'in progress' | 'complete';

export type PlayerReadiness = 'awaiting' | 'done';

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
  playerStatus: Record<string, PlayerReadiness>;
}
