import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StaticMovieProvider } from '../../../../services/movies/StaticMovieProvider';
import { RapidApiMovieProvider } from '../../../../services/movies/RapidApiMovieProvider';
import staticMovies from '../../../../services/movies/staticMovies';
import * as mediaApiService from '../../../../services/api/mediaApiService';

vi.mock('../../../../services/api/mediaApiService', () => ({
  getMoviesByPreferences: vi.fn(),
  getAvailableGenres: vi.fn(),
  getPopularMovies: vi.fn(),
  searchMoviesByTitle: vi.fn(),
  getMovieById: vi.fn(),
}));

const mockedApi = mediaApiService as unknown as {
  getMoviesByPreferences: ReturnType<typeof vi.fn>;
  getAvailableGenres: ReturnType<typeof vi.fn>;
  getPopularMovies: ReturnType<typeof vi.fn>;
  searchMoviesByTitle: ReturnType<typeof vi.fn>;
  getMovieById: ReturnType<typeof vi.fn>;
};

describe('StaticMovieProvider', () => {
  const provider = new StaticMovieProvider();

  it('returns available genres derived from static dataset', async () => {
    const genres = await provider.getAvailableGenres();

    expect(genres.length).toBeGreaterThan(0);
    expect(genres.some((g) => g.name.toLowerCase() === 'drama')).toBe(true);
  });

  it('searches locally by title without calling network', async () => {
    const results = await provider.searchMoviesByTitle('dark');
    expect(results.some((m) => m.title.toLowerCase().includes('dark'))).toBe(true);
  });

  it('finds movies by ID and normalizes the result', async () => {
    const movie = await provider.getMovieById(staticMovies[0].id);

    expect(movie.id).toBe(staticMovies[0].id);
    expect(movie.streamingOptions.every((opt) => opt.countryCode.toLowerCase() === 'us')).toBe(true);
  });

  it('filters, sorts, and paginates preference queries', async () => {
    const prefs = {
      selectedTypes: ['movie'] as const,
      selectedGenres: ['Drama'],
      selectedPlatforms: ['Netflix'],
      favoriteMedia: [],
    };

    const firstPage = await provider.getMoviesByPreferences(prefs, 'us', {
      limit: 2,
      orderBy: 'popularity_alltime',
      page: 1,
    });

    expect(firstPage.length).toBeLessThanOrEqual(2);
    expect(firstPage.every((m) => m.genres.map((g) => g.toLowerCase()).includes('drama'))).toBe(true);

    const secondPage = await provider.loadMoreMovies();
    expect(secondPage.length).toBeGreaterThanOrEqual(0);
    if (secondPage.length > 0) {
      expect(secondPage[0].id).not.toBe(firstPage[0].id);
    }
  });

  it('returns popular movies without hitting network', async () => {
    const popular = await provider.getPopularMovies({ limit: 3 });
    expect(popular.length).toBeLessThanOrEqual(3);
  });
});

describe('RapidApiMovieProvider', () => {
  let provider: RapidApiMovieProvider;

  beforeEach(() => {
    vi.resetAllMocks();
    provider = new RapidApiMovieProvider();
  });

  it('delegates preference queries to the media API', async () => {
    mockedApi.getMoviesByPreferences.mockResolvedValueOnce(['mock-result']);

    const prefs = { selectedTypes: ['movie'], selectedGenres: ['Action'], selectedPlatforms: [], favoriteMedia: [] };
    const country = 'us';
    const options = { limit: 10, orderBy: 'popularity_1year' as const };

    const result = await provider.getMoviesByPreferences(prefs, country, options);

    expect(mockedApi.getMoviesByPreferences).toHaveBeenCalledWith(prefs, country, options);
    expect(result).toEqual(['mock-result']);
  });

  it('supports pagination via loadMoreMovies', async () => {
    mockedApi.getMoviesByPreferences.mockResolvedValueOnce(['page-1']);

    const prefs = { selectedTypes: ['movie'], selectedGenres: [], selectedPlatforms: [], favoriteMedia: [] };
    await provider.getMoviesByPreferences(prefs, 'us', { limit: 5, page: 1 });

    mockedApi.getMoviesByPreferences.mockResolvedValueOnce(['page-2']);
    const result = await provider.loadMoreMovies(2);

    expect(mockedApi.getMoviesByPreferences).toHaveBeenLastCalledWith(prefs, 'us', {
      limit: 5,
      page: 2,
    });
    expect(result).toEqual(['page-2']);
  });

  it('delegates other API methods', async () => {
    const genres = [{ id: 'action', name: 'Action' }];
    mockedApi.getAvailableGenres.mockResolvedValueOnce(genres);
    expect(await provider.getAvailableGenres()).toEqual(genres);

    mockedApi.getPopularMovies.mockResolvedValueOnce(['p1', 'p2', 'p3']);
    expect(await provider.getPopularMovies({ service: 'prime', country: 'ca', limit: 2 })).toEqual(['p1', 'p2']);
    expect(mockedApi.getPopularMovies).toHaveBeenCalledWith('prime', 'ca');

    mockedApi.searchMoviesByTitle.mockResolvedValueOnce(['search']);
    expect(await provider.searchMoviesByTitle('query', 'us')).toEqual(['search']);
    expect(mockedApi.searchMoviesByTitle).toHaveBeenCalledWith('query', 'us');

    mockedApi.getMovieById.mockResolvedValueOnce('movie');
    expect(await provider.getMovieById('id', 'us')).toEqual('movie');
    expect(mockedApi.getMovieById).toHaveBeenCalledWith('id', 'us');
  });

  it('propagates errors from the underlying API', async () => {
    mockedApi.getMoviesByPreferences.mockRejectedValueOnce(new Error('API failure'));

    await expect(
      provider.getMoviesByPreferences(
        { selectedTypes: [], selectedGenres: [], selectedPlatforms: [], favoriteMedia: [] },
        'us',
        {},
      )
    ).rejects.toThrow('API failure');
  });
});

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
