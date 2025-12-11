import type { Genre } from '../../types/genre';
import type { Media } from '../../types/media';
import type { User } from '../../types/user';

export type UserPreferences = User['preferences'];

export type PreferenceQueryOptions = {
  minRating?: number;
  yearMin?: number;
  yearMax?: number;
  keyword?: string;
  orderBy?: 'original_title' | 'popularity_1year' | 'popularity_1month' | 'popularity_1week' | 'popularity_alltime';
  limit?: number;
  page?: number;
};

export interface MovieProvider {
  getAvailableGenres(): Promise<Genre[]>;
  getPopularMovies(options?: { service?: 'netflix' | 'prime' | 'apple'; country?: string; limit?: number }): Promise<Media[]>;
  searchMoviesByTitle(query: string, country?: string): Promise<Media[]>;
  getMovieById(id: string, country?: string): Promise<Media>;
  getMoviesByPreferences(
    preferences: UserPreferences,
    country?: string,
    options?: PreferenceQueryOptions
  ): Promise<Media[]>;
  loadMoreMovies(page?: number): Promise<Media[]>;
}
