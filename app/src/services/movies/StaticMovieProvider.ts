import type { MovieProvider, PreferenceQueryOptions, UserPreferences } from './MovieProvider';
import type { Genre } from '../../types/genre';
import type { Media } from '../../types/media';
import staticMovies from './staticMovies';

const DEFAULT_PAGE_SIZE = 20;

export class StaticMovieProvider implements MovieProvider {
  private readonly movies: Media[];
  private readonly genres: Genre[];
  private lastPreferences?: UserPreferences;
  private lastCountry: string = 'us';
  private lastOptions?: PreferenceQueryOptions;

  constructor(data: Media[] = staticMovies) {
    this.movies = data;
    this.genres = this.buildGenres(data);
  }

  async getAvailableGenres() {
    return this.genres;
  }

  async getPopularMovies(options?: { service?: 'netflix' | 'prime' | 'apple'; country?: string; limit?: number }) {
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
    const country = options?.country ?? 'us';
    const sorted = [...this.movies].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return this.normalizeForCountry(sorted.slice(0, limit), country);
  }

  async searchMoviesByTitle(query: string, country: string = 'us') {
    if (!query.trim()) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results = this.movies.filter(
      (movie) =>
        movie.title.toLowerCase().includes(lowerQuery) ||
        movie.overview?.toLowerCase().includes(lowerQuery)
    );

    return this.normalizeForCountry(results, country);
  }

  async getMovieById(id: string, country: string = 'us') {
    const match = this.movies.find((movie) => movie.id === id);
    return match ? this.normalizeForCountry([match], country)[0] : this.createFallbackMovie(id);
  }

  async getMoviesByPreferences(
    preferences: UserPreferences,
    country: string = 'us',
    options?: PreferenceQueryOptions
  ): Promise<Media[]> {
    this.lastPreferences = preferences;
    this.lastCountry = country;
    this.lastOptions = options;

    const filtered = this.movies.filter((movie) => {
      if (preferences.selectedTypes?.length && !preferences.selectedTypes.includes(movie.mediaType)) {
        return false;
      }

      if (!this.matchesGenres(movie, preferences.selectedGenres)) {
        return false;
      }

      if (!this.matchesPlatforms(movie, preferences.selectedPlatforms)) {
        return false;
      }

      if (options?.minRating !== undefined && (movie.rating ?? 0) < options.minRating) {
        return false;
      }

      if (options?.yearMin !== undefined && movie.releaseYear && movie.releaseYear < options.yearMin) {
        return false;
      }

      if (options?.yearMax !== undefined && movie.releaseYear && movie.releaseYear > options.yearMax) {
        return false;
      }

      if (options?.keyword) {
        const keyword = options.keyword.toLowerCase();
        if (
          !movie.title.toLowerCase().includes(keyword) &&
          !movie.overview?.toLowerCase().includes(keyword)
        ) {
          return false;
        }
      }

      return true;
    });

    const sorted = this.sortMovies(filtered, options?.orderBy);
    return this.paginateAndNormalize(sorted, country, options);
  }

  async loadMoreMovies(page?: number): Promise<Media[]> {
    const hasPreviousQuery = !!this.lastPreferences;
    const nextPage = page ?? (hasPreviousQuery ? (this.lastOptions?.page ?? 1) + 1 : 1);
    const fallbackPreferences: UserPreferences = this.lastPreferences ?? {
      selectedTypes: ['movie'],
      selectedGenres: [],
      selectedPlatforms: [],
      favoriteMedia: [],
    };

    const fallbackOptions: PreferenceQueryOptions = this.lastOptions ?? {
      limit: DEFAULT_PAGE_SIZE,
      page: nextPage,
    };

    return this.getMoviesByPreferences(fallbackPreferences, this.lastCountry, {
      ...fallbackOptions,
      page: nextPage,
      limit: fallbackOptions.limit ?? DEFAULT_PAGE_SIZE,
    });
  }

  private buildGenres(data: Media[]): Genre[] {
    const seen = new Map<string, string>();
    data.forEach((movie) => {
      movie.genres.forEach((name) => {
        const id = name.toLowerCase();
        if (!seen.has(id)) {
          seen.set(id, name);
        }
      });
    });

    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }

  private matchesGenres(movie: Media, selectedGenres: string[]) {
    if (!selectedGenres?.length) return true;
    const movieGenres = movie.genres.map((g) => g.toLowerCase());
    return selectedGenres.every((genre) => movieGenres.includes(genre.toLowerCase()));
  }

  private matchesPlatforms(movie: Media, selectedPlatforms: string[]) {
    if (!selectedPlatforms?.length) return true;
    const movieServices = movie.streamingOptions.flatMap((option) =>
      option.services.map((svc) => svc.serviceName.toLowerCase())
    );
    return selectedPlatforms.some((platform) => movieServices.includes(platform.toLowerCase()));
  }

  private sortMovies(movies: Media[], orderBy?: PreferenceQueryOptions['orderBy']) {
    const ordered = [...movies];
    if (!orderBy) {
      return ordered;
    }

    switch (orderBy) {
      case 'popularity_1year':
      case 'popularity_1month':
      case 'popularity_1week':
      case 'popularity_alltime':
        return ordered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      case 'original_title':
        return ordered.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return ordered;
    }
  }

  private paginateAndNormalize(movies: Media[], country: string, options?: PreferenceQueryOptions) {
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
    const page = options?.page && options.page > 0 ? options.page : 1;
    const start = (page - 1) * limit;
    const end = start + limit;

    const pageItems = movies.slice(start, end);
    return this.normalizeForCountry(pageItems, country);
  }

  private normalizeForCountry(movies: Media[], country: string) {
    return movies.map((movie) => ({
      ...movie,
      streamingOptions: movie.streamingOptions.filter(
        (option) => option.countryCode.toLowerCase() === country.toLowerCase()
      ),
    }));
  }

  private createFallbackMovie(id: string): Media {
    return {
      id,
      mediaType: 'movie',
      title: 'Unknown Title',
      overview: 'Details unavailable in offline mode.',
      genres: [],
      directors: [],
      cast: [],
      streamingOptions: [],
      releaseYear: new Date().getFullYear(),
      runtime: 0,
      rating: 0,
      poster: undefined,
      trailerUrl: undefined,
    };
  }
}
