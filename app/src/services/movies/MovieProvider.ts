import type { Media } from '../../types/media';

export interface MovieProvider {
  getMoviesByPreferences(
    preferences: {
      selectedTypes: ('movie' | 'show')[];
      selectedGenres: string[];
      selectedPlatforms: string[];
    },
    country: string,
    options?: {
      minRating?: number;
      yearMin?: number;
      yearMax?: number;
      keyword?: string;
      orderBy?: string;
      limit?: number;
    }
  ): Promise<Media[]>;
}
