import type { MovieProvider, PreferenceQueryOptions, UserPreferences } from './MovieProvider';
import {
  getAvailableGenres as realGetAvailableGenres,
  getMovieById as realGetMovieById,
  getMoviesByPreferences as realGetMovies,
  getPopularMovies as realGetPopularMovies,
  searchMoviesByTitle as realSearchMoviesByTitle,
} from '../api/mediaApiService';

const DEFAULT_PAGE_SIZE = 20;

export class RapidApiMovieProvider implements MovieProvider {
  private lastPreferences?: UserPreferences;
  private lastCountry: string = 'us';
  private lastOptions?: PreferenceQueryOptions;

  async getAvailableGenres() {
    return realGetAvailableGenres();
  }

  async getPopularMovies(options?: { service?: 'netflix' | 'prime' | 'apple'; country?: string; limit?: number }) {
    const service = options?.service ?? 'netflix';
    const country = options?.country ?? 'us';
    const movies = await realGetPopularMovies(service, country);

    if (typeof options?.limit === 'number') {
      return movies.slice(0, options.limit);
    }

    return movies;
  }

  async searchMoviesByTitle(query: string, country: string = 'us') {
    return realSearchMoviesByTitle(query, country);
  }

  async getMovieById(id: string, country: string = 'us') {
    return realGetMovieById(id, country);
  }

  async getMoviesByPreferences(
    preferences: UserPreferences,
    country: string = 'us',
    options?: PreferenceQueryOptions
  ) {
    this.lastPreferences = preferences;
    this.lastCountry = country;
    this.lastOptions = options;
    return realGetMovies(preferences, country, options);
  }

  async loadMoreMovies(page?: number) {
    if (!this.lastPreferences) {
      throw new Error('No previous preference query to load more results from');
    }

    const options: PreferenceQueryOptions = {
      ...this.lastOptions,
      page,
      limit: this.lastOptions?.limit ?? DEFAULT_PAGE_SIZE,
    };

    return this.getMoviesByPreferences(this.lastPreferences, this.lastCountry, options);
  }
}
