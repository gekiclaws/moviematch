import * as streamingAvailability from "streaming-availability";
import type { Media, StreamingGroup } from "../../types/media";
import { MOVIE_API_KEY } from '@env';


// Initialize the API client
const createClient = () => {
  return new streamingAvailability.Client(
    new streamingAvailability.Configuration({
      apiKey: MOVIE_API_KEY,
    })
  );
};


// Helper function to transform API response to our Media interface
const transformShowToMedia = (show: any): Media => {
  return {
    id: show.imdbId,
    mediaType: show.showType,
    title: show.title,
    overview: show.overview || '',
    rating: show.rating,
    runtime: show.runtime,
    releaseYear: show.releaseYear,
    genres: (show.genres || []).map((g: any) => g.name || g),
    poster: show.imageSet?.verticalPoster?.w720,
    directors: show.directors || [],
    cast: show.cast || [],
    streamingOptions: Object.entries(show.streamingOptions || {}).map(
      ([countryCode, options]: [string, any]) => ({
        countryCode,
        services: (Array.isArray(options) ? options : []).map((opt: any) => ({
          serviceName: opt.service?.name || opt.service,
          logo: opt.service?.imageSet?.lightThemeImage,
        })),
      })
    ),
  };
};

/**
 * Fetches movies based on user preferences
 * This is used for the swipe screen
 * 
 * @param preferences - User's selected preferences (genres, platforms, etc.)
 * @param country - ISO 3166-1 alpha-2 country code (default: 'us')
 * @param options - Additional filtering options
 */
export const getMoviesByPreferences = async (
  preferences: {
    selectedTypes: ('movie' | 'show')[]; 
    selectedGenres: string[];
    selectedPlatforms: string[];
  },
  country: string = 'us',
  options?: {
    minRating?: number;
    yearMin?: number;
    yearMax?: number;
    keyword?: string;
    orderBy?: 'original_title' | 'popularity_1year' | 'popularity_1month' | 'popularity_1week' | 'popularity_alltime';
    limit?: number;
  }
): Promise<Media[]> => {
  try {
    const client = createClient();
    console.log('=== API CALL DEBUG ===');
    console.log('API Key exists:', !!MOVIE_API_KEY);
    console.log('API Key length:', MOVIE_API_KEY?.length);
    console.log('Country:', country);

    // Build the request parameters
    const params: any = {
      country: country,
      showType: 'movie', // Only fetch movies, not series
    };

    /* TODO

    Specific preferences work but the movies that MovieSwipeScreen fetches might be
    too specific which may cause that no movies match 
    Update the paramters of the screen file to ensure at least a few movies
    */
    // Add catalogs (streaming services) - API parameter name
    if (preferences.selectedPlatforms && preferences.selectedPlatforms.length > 0) {
      params.catalogs = preferences.selectedPlatforms; // Pass array directly
    }

    // Add genres - API parameter name
    if (preferences.selectedGenres && preferences.selectedGenres.length > 0) {
      params.genres = preferences.selectedGenres; // Pass array directly
    }

    // Add optional filters
    if (options?.minRating) {
      params.ratingMin = options.minRating;
    }

    if (options?.yearMin) {
      params.yearMin = options.yearMin;
    }

    if (options?.yearMax) {
      params.yearMax = options.yearMax;
    }

    if (options?.keyword) {
      params.keyword = options.keyword;
    }

    if (options?.orderBy) {
      params.orderBy = options.orderBy;
    }


    const response = await client.showsApi.searchShowsByFilters(params);

    // Transform the results to our Media interface
    const movies = response.shows.map(transformShowToMedia);
    
    // Apply limit if specified
    if (options?.limit) {
      return movies.slice(0, options.limit);
    }
    
    return movies;
  } catch (error: any) {
    console.error('Error fetching movies by preferences:', error);
    console.error('=== FULL ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error details:', error);
    throw new Error(`Failed to fetch movies: ${error.message}`);
  }
};

/**
 * Searches for movies by title
 * This is used in the onboarding screen for selecting favorite movies
 */
export const searchMoviesByTitle = async (
  query: string,
  country: string = 'us'
): Promise<Media[]> => {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const client = createClient();
    
    const response = await client.showsApi.searchShowsByTitle({
      title: query,
      country: country,
      showType: 'movie', // Only search for movies
    });

    
    return response.map(transformShowToMedia);
  } catch (error: any) {
    console.error('Error searching movies by title:', error);
    throw new Error(`Failed to search movies: ${error.message}`);
  }
};

/**
 * Gets a specific movie by its ID (IMDb or internal ID)
 * Useful for debugging and testing
 */
export const getMovieById = async (
  id: string,
  country: string = 'us'
): Promise<Media> => {
  try {
    const client = createClient();
    
    const show = await client.showsApi.getShow({
      id: id,
      country: country,
    });

    return transformShowToMedia(show);
  } catch (error: any) {
    console.error('Error fetching movie by ID:', error);
    throw new Error(`Failed to fetch movie: ${error.message}`);
  }
};

/**
 * Gets popular/top movies from a streaming service
 * Can be used as fallback in onboarding if search isn't working
 */
export const getPopularMovies = async (
  service: 'netflix' | 'prime' | 'apple',
  country: string = 'us'
): Promise<Media[]> => {
  try {
    const client = createClient();
    
    const response = await client.showsApi.getTopShows({
      country: country,
      service: service,
      showType: 'movie',
    });

    return response.map(transformShowToMedia);
  } catch (error: any) {
    console.error('Error fetching popular movies:', error);
    throw new Error(`Failed to fetch popular movies: ${error.message}`);
  }
};

/**
 * Gets list of available genres
 * Useful for onboarding genre selection screen
 */
export const getAvailableGenres = async (): Promise<Array<{ id: string; name: string }>> => {
  try {
    const client = createClient();
    
    const genres = await client.genresApi.getGenres();
    
    return genres.map((genre: any) => ({
      id: genre.id,
      name: genre.name,
    }));
  } catch (error: any) {
    console.error('Error fetching genres:', error);
    throw new Error(`Failed to fetch genres: ${error.message}`);
  }
};

export default {
  getMoviesByPreferences,
  searchMoviesByTitle,
  getMovieById,
  getPopularMovies,
  getAvailableGenres,
};