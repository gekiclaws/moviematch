import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock the mediaApiService module
vi.mock('../../../../services/api/mediaApiService', () => ({
  getMoviesByPreferences: vi.fn()
}));

// modules under test
import { movieProvider } from '../../../../services/movies/providerRegistry';
import { StaticMovieProvider } from '../../../../services/movies/StaticMovieProvider';
import { RapidApiMovieProvider } from '../../../../services/movies/RapidApiMovieProvider';
import staticMovies from '../../../../services/movies/staticMovies';

// external dependency to mock
import * as mediaApiService from '../../../../services/api/mediaApiService';

describe('Movie Providers', () => {
  // ---------------------------------------------------------------------------
  // providerRegistry
  // ---------------------------------------------------------------------------
  describe('providerRegistry', () => {
    it('should default to StaticMovieProvider', () => {
      expect(movieProvider).toBeInstanceOf(StaticMovieProvider);
    });
  });

  // ---------------------------------------------------------------------------
  // StaticMovieProvider
  // ---------------------------------------------------------------------------
  describe('StaticMovieProvider', () => {
    const provider = new StaticMovieProvider();

    it('should return the staticMovies array', async () => {
      const result = await provider.getMoviesByPreferences(
        { selectedTypes: [], selectedGenres: [], selectedPlatforms: [] },
        'us',
        { limit: 10 }
      );

      expect(result).toBe(staticMovies);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should contain fully defined Media objects (no undefined fields)', () => {
      for (const movie of staticMovies) {
        for (const [key, value] of Object.entries(movie)) {
          expect(value).not.toBeUndefined();
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // RapidApiMovieProvider
  // ---------------------------------------------------------------------------
  describe('RapidApiMovieProvider', () => {
    const mockRealGetMovies = vi.spyOn(mediaApiService, 'getMoviesByPreferences');

    beforeEach(() => {
      mockRealGetMovies.mockReset();
    });

    it('should delegate to real getMoviesByPreferences with correct args', async () => {
      const provider = new RapidApiMovieProvider();

      mockRealGetMovies.mockResolvedValue(['mock-result']);

      const prefs = { selectedTypes: ["movie"], selectedGenres: ["Action"], selectedPlatforms: [] };
      const country = 'us';
      const options = { limit: 10, orderBy: 'popularity_1year' };

      const result = await provider.getMoviesByPreferences(prefs, country, options);

      expect(mockRealGetMovies).toHaveBeenCalledTimes(1);
      expect(mockRealGetMovies).toHaveBeenCalledWith(prefs, country, options);
      expect(result).toEqual(['mock-result']);
    });

    it('should propagate errors from the underlying API', async () => {
      const provider = new RapidApiMovieProvider();

      mockRealGetMovies.mockRejectedValue(new Error('API failure'));

      await expect(
        provider.getMoviesByPreferences(
          { selectedTypes: [], selectedGenres: [], selectedPlatforms: [] },
          'us',
          {},
        )
      ).rejects.toThrow('API failure');
    });
  });

  // ---------------------------------------------------------------------------
  // staticMovies dataset integrity
  // ---------------------------------------------------------------------------
  describe('staticMovies data integrity', () => {
    it('every movie should have required fields', () => {
      for (const movie of staticMovies) {
        expect(movie.id).toBeTruthy();
        expect(movie.mediaType).toBe('movie');
        expect(movie.title).toBeTruthy();
        expect(movie.overview).toBeTruthy();
        expect(movie.genres.length).toBeGreaterThan(0);
        expect(movie.directors.length).toBeGreaterThan(0);
        expect(movie.cast.length).toBeGreaterThan(0);
        expect(movie.streamingOptions.length).toBeGreaterThan(0);
        expect(typeof movie.releaseYear).toBe('number');
        expect(typeof movie.runtime).toBe('number');
        expect(typeof movie.poster).toBe('string');
        expect(typeof movie.trailerUrl).toBe('string');
      }
    });

    it('streamingOptions should be valid objects', () => {
      for (const movie of staticMovies) {
        for (const group of movie.streamingOptions) {
          expect(group.countryCode).toBeTruthy();
          expect(Array.isArray(group.services)).toBe(true);
          expect(group.services.length).toBeGreaterThan(0);

          for (const svc of group.services) {
            expect(svc.serviceName).toBeTruthy();
            expect(typeof svc.logo).toBe('string');
          }
        }
      }
    });
  });
});