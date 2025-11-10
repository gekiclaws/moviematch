// src/services/api/mediaApiService.test.ts
vi.mock('@env', () => ({
  MOVIE_API_KEY: 'test-api-key',
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';


// Mock the streaming-availability package
const {
  mockGetShow,
  mockSearchByFilters,
  mockSearchByTitle,
  mockGetTopShows,
  mockGetGenres,
  mockConfiguration,
} = vi.hoisted(() => ({
  mockGetShow: vi.fn(),
  mockSearchByFilters: vi.fn(),
  mockSearchByTitle: vi.fn(),
  mockGetTopShows: vi.fn(),
  mockGetGenres: vi.fn(),
  mockConfiguration: vi.fn(),
}));

vi.mock('streaming-availability', () => ({
  Client: vi.fn().mockImplementation(() => ({
    showsApi: {
      getShow: mockGetShow,
      searchShowsByFilters: mockSearchByFilters,
      searchShowsByTitle: mockSearchByTitle,
      getTopShows: mockGetTopShows,
    },
    genresApi: {
      getGenres: mockGetGenres,
    },
  })),
  Configuration: mockConfiguration,
}));

// Import after mocks
import {
  getMovieById,
  getMoviesByPreferences,
  searchMoviesByTitle,
  getPopularMovies,
  getAvailableGenres,
} from './mediaApiService';

describe('MovieApi', () => {
  beforeEach(() => {
    mockGetShow.mockReset();
    mockSearchByFilters.mockReset();
    mockSearchByTitle.mockReset();
    mockGetTopShows.mockReset();
    mockGetGenres.mockReset();
    mockConfiguration.mockReset();
  });

  describe('getMovieById', () => {
    it('fetches a movie successfully by ID', async () => {
      const apiResponse = {
        showType: 'movie',
        title: 'The Dark Knight',
        overview: 'Batman fights crime in Gotham',
        rating: 89,
        runtime: 152,
        releaseYear: 2008,
        genres: [{ name: 'Action' }, { name: 'Crime' }],
        imageSet: {
          verticalPoster: { w720: 'https://example.com/poster.jpg' },
        },
        directors: ['Christopher Nolan'],
        cast: ['Christian Bale', 'Heath Ledger'],
        streamingOptions: {
          us: [{ service: { name: 'Netflix' } }],
        },
      };

      mockGetShow.mockResolvedValueOnce(apiResponse);

      const result = await getMovieById('tt0468569', 'us');

      expect(mockGetShow).toHaveBeenCalledWith({
        id: 'tt0468569',
        country: 'us',
      });
      expect(result.title).toBe('The Dark Knight');
      expect(result.mediaType).toBe('movie');
      expect(result.genres).toEqual(['Action', 'Crime']);
    });

    it('throws error when API fails', async () => {
      mockGetShow.mockRejectedValueOnce(new Error('API Error'));

      await expect(getMovieById('invalid-id')).rejects.toThrow('Failed to fetch movie');
    });
  });

  // TODO (Test after editing recommendation algorithm)
  describe('getMoviesByPreferences', () => {
    it('fetches movies with user preferences', async () => {
      const apiResponse = {
        shows: [
          {
            showType: 'movie',
            title: 'Action Movie 1',
            overview: 'An action-packed thriller',
            rating: 85,
            genres: [{ name: 'Action' }],
            streamingOptions: {},
          },
          {
            showType: 'movie',
            title: 'Action Movie 2',
            overview: 'Another great action film',
            rating: 80,
            genres: [{ name: 'Action' }],
            streamingOptions: {},
          },
        ],
        hasMore: false,
        nextCursor: null,
      };

      mockSearchByFilters.mockResolvedValueOnce(apiResponse);

      const result = await getMoviesByPreferences(
        {
          selectedTypes: ['movie'],
          selectedGenres: ['action'],
          selectedPlatforms: ['netflix', 'prime'],
        },
        'us'
      );

      expect(mockSearchByFilters).toHaveBeenCalledWith({
        country: 'us',
        showType: 'movie',
        catalogs: ['netflix', 'prime'],
        genres: ['action'],
      });
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Action Movie 1');
    });


    it('defaults to movie when no type selected', async () => {
      const apiResponse = {
        shows: [],
        hasMore: false,
        nextCursor: null,
      };

      mockSearchByFilters.mockResolvedValueOnce(apiResponse);

      await getMoviesByPreferences(
        {
          selectedTypes: [],
          selectedGenres: [],
          selectedPlatforms: [],
        },
        'us'
      );

      const callArgs = mockSearchByFilters.mock.calls[0][0];
      expect(callArgs.showType).toBe('movie');
    });

    it('applies optional filters correctly', async () => {
      const apiResponse = {
        shows: [],
        hasMore: false,
        nextCursor: null,
      };

      mockSearchByFilters.mockResolvedValueOnce(apiResponse);

      await getMoviesByPreferences(
        {
          selectedTypes: ['movie'],
          selectedGenres: ['action', 'comedy'],
          selectedPlatforms: ['netflix'],
        },
        'us',
        {
          minRating: 70,
          yearMin: 2010,
          yearMax: 2023,
          keyword: 'superhero',
          orderBy: 'popularity_1month',
        }
      );

      expect(mockSearchByFilters).toHaveBeenCalledWith({
        country: 'us',
        showType: 'movie',
        catalogs: ['netflix'],
        genres: ['action', 'comedy'],
        ratingMin: 70,
        yearMin: 2010,
        yearMax: 2023,
        keyword: 'superhero',
        orderBy: 'popularity_1month',
      });
    });

    it('applies limit to results', async () => {
      const apiResponse = {
        shows: Array(20)
          .fill(null)
          .map((_, i) => ({
            showType: 'movie',
            title: `Movie ${i + 1}`,
            overview: 'A great movie',
            streamingOptions: {},
          })),
        hasMore: true,
        nextCursor: 'next-page',
      };

      mockSearchByFilters.mockResolvedValueOnce(apiResponse);

      const result = await getMoviesByPreferences(
        {
          selectedTypes: ['movie'],
          selectedGenres: [],
          selectedPlatforms: [],
        },
        'us',
        { limit: 5 }
      );

      expect(result).toHaveLength(5);
    });

    it('handles empty platforms array', async () => {
      const apiResponse = {
        shows: [],
        hasMore: false,
        nextCursor: null,
      };

      mockSearchByFilters.mockResolvedValueOnce(apiResponse);

      await getMoviesByPreferences(
        {
          selectedTypes: ['movie'],
          selectedGenres: ['action'],
          selectedPlatforms: [],
        },
        'us'
      );

      const callArgs = mockSearchByFilters.mock.calls[0][0];
      expect(callArgs.catalogs).toBeUndefined();
    });

    it('throws error when API fails', async () => {
      mockSearchByFilters.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        getMoviesByPreferences({
          selectedTypes: ['movie'],
          selectedGenres: [],
          selectedPlatforms: [],
        })
      ).rejects.toThrow('Failed to fetch movies');
    });
  });

  describe('searchMoviesByTitle', () => {
    it('searches for movies by title successfully', async () => {
      const apiResponse = [  // ← Direct array, no wrapper
        {
          showType: 'movie',
          title: 'Harry Potter and the Sorcerer\'s Stone',
          overview: 'A young wizard begins his journey',
          rating: 81,
          streamingOptions: {},
        },
      ];

      mockSearchByTitle.mockResolvedValueOnce(apiResponse);

      const result = await searchMoviesByTitle('Harry Potter', 'us');

      expect(mockSearchByTitle).toHaveBeenCalledWith({
        title: 'Harry Potter',
        country: 'us',
        showType: 'movie',
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('Harry Potter');
    });

    it('returns empty array for empty query', async () => {
      const result = await searchMoviesByTitle('', 'us');

      expect(mockSearchByTitle).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('returns empty array for whitespace query', async () => {
      const result = await searchMoviesByTitle('   ', 'us');

      expect(mockSearchByTitle).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('throws error when API fails', async () => {
      mockSearchByTitle.mockRejectedValueOnce(new Error('API Error'));

      await expect(searchMoviesByTitle('Test Movie')).rejects.toThrow(
        'Failed to search movies'
      );
    });
  });

  describe('getPopularMovies', () => {
    it('fetches top movies from a streaming service', async () => {
      const apiResponse = [  // ← Direct array, no wrapper
        {
          showType: 'movie',
          title: 'Popular Movie 1',
          overview: 'A trending movie',
          rating: 90,
          streamingOptions: {},
        },
      ];

      mockGetTopShows.mockResolvedValueOnce(apiResponse);

      const result = await getPopularMovies('netflix', 'us');

      expect(mockGetTopShows).toHaveBeenCalledWith({
        country: 'us',
        service: 'netflix',
        showType: 'movie',
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Popular Movie 1');
    });

    it('throws error when API fails', async () => {
      mockGetTopShows.mockRejectedValueOnce(new Error('API Error'));

      await expect(getPopularMovies('netflix')).rejects.toThrow(
        'Failed to fetch popular movies'
      );
    });
  });

  describe('getAvailableGenres', () => {
    it('fetches list of available genres', async () => {
      const apiResponse = [
        { id: 'action', name: 'Action' },
        { id: 'comedy', name: 'Comedy' },
      ];

      mockGetGenres.mockResolvedValueOnce(apiResponse);

      const result = await getAvailableGenres();

      expect(mockGetGenres).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'action', name: 'Action' });
    });

    it('throws error when API fails', async () => {
      mockGetGenres.mockRejectedValueOnce(new Error('API Error'));

      await expect(getAvailableGenres()).rejects.toThrow('Failed to fetch genres');
    });

    it('configures the client with the RapidAPI host header', async () => {
      mockGetGenres.mockResolvedValueOnce([{ id: 'id', name: 'name' }]);

      await getAvailableGenres();

      expect(mockConfiguration).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        headers: { 'X-RapidAPI-Host': 'streaming-availability.p.rapidapi.com' },
      });
    });
  });
});
