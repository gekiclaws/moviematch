import { MovieProvider } from './MovieProvider';
import { getMoviesByPreferences as realGetMovies } from '../../services/api/mediaApiService';

type MoviePreferences = Parameters<MovieProvider['getMoviesByPreferences']>[0];
type CountryCode = Parameters<MovieProvider['getMoviesByPreferences']>[1];
type MovieOptions = Parameters<MovieProvider['getMoviesByPreferences']>[2];

export class RapidApiMovieProvider implements MovieProvider {
  async getMoviesByPreferences(
    preferences: MoviePreferences,
    country: CountryCode,
    options?: MovieOptions
  ) {
    return realGetMovies(preferences, country, options as Parameters<typeof realGetMovies>[2]);
  }
}
