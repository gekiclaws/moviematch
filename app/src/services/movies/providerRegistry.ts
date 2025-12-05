import { StaticMovieProvider } from './StaticMovieProvider';
// import { RapidApiMovieProvider } from './RapidApiMovieProvider';

export const movieProvider = new StaticMovieProvider();

// To switch to RapidAPI, change to:
// export const movieProvider = new RapidApiMovieProvider();
