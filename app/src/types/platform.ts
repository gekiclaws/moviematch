export interface Platform {
  id: string;
  name: string;
  logo?: string;
}

export const STREAMING_PLATFORMS: Platform[] = [
  { id: 'netflix', name: 'Netflix' },
  { id: 'prime', name: 'Prime Video' },
  { id: 'disney', name: 'Disney+' },
  { id: 'hbo', name: 'Max' },
  { id: 'hulu', name: 'Hulu' },
  { id: 'apple', name: 'Apple TV+' },
  { id: 'paramount', name: 'Paramount+' },
  { id: 'peacock', name: 'Peacock' },
  { id: 'crunchyroll', name: 'CrunchyRoll'}
];