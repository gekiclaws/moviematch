import { MovieProvider } from './MovieProvider';
import { Media } from '@/types/media';
import staticMovies from './staticMovies';

type MoviePreferences = Parameters<MovieProvider['getMoviesByPreferences']>[0];
type CountryCode = Parameters<MovieProvider['getMoviesByPreferences']>[1];
type MovieOptions = Parameters<MovieProvider['getMoviesByPreferences']>[2];

export class StaticMovieProvider implements MovieProvider {
  async getMoviesByPreferences(
    _preferences: MoviePreferences,
    _country: CountryCode,
    _options?: MovieOptions
  ): Promise<Media[]> {
    return staticMovies;
  }
}
