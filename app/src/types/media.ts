export interface StreamingService {
  serviceName: string;
  logo: string;
}

export interface StreamingGroup {
  countryCode: string;
  services: StreamingService[];
}

export interface Media {
  id: string, // using the imdb id
  mediaType: string;
  title: string;
  overview: string;
  rating?: number;
  runtime?: number;
  releaseYear?: number;
  genres: string[];
  poster?: string;
  backdrop?: string;
  directors: string[];
  cast: string[];
  streamingOptions: StreamingGroup[];
}