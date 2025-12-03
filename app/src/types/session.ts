import { Swipe } from './swipe';

export type SessionStatus = 'awaiting' | 'in progress' | 'complete';

export type PlayerReadiness = 'awaiting' | 'done';

export interface MatchedTitle {
  id: string;
  title: string;
  posterUrl?: string;
  streamingServices?: string[];
}

export interface Session {
  id: string;
  roomCode: string; // 6-digit room code for easy sharing
  userIds: string[];
  movieType: Array<'movie' | 'show'>;
  genres: string[];
  streamingServices: string[];
  favoriteTitles: string[];
  swipes: Swipe[];
  matchedTitles?: MatchedTitle[];
  createdAt: number;
  sessionStatus: SessionStatus;
  playerStatus: Record<string, PlayerReadiness>;
}
