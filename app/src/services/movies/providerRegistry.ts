import type { MovieProvider } from './MovieProvider';
import { StaticMovieProvider } from './StaticMovieProvider';
import { RapidApiMovieProvider } from './RapidApiMovieProvider';

// export const movieProvider: MovieProvider = new StaticMovieProvider();
export const movieProvider: MovieProvider = new RapidApiMovieProvider();