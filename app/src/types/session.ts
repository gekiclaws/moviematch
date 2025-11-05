import { Swipe } from './swipe';

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
}
