export interface User {
  id: string
  name?: string
  preferences: {
    selectedTypes: ('movie' | 'show')[]
    selectedGenres: string[]
    selectedPlatforms: string[]
    favoriteTitles: string[]
  }
  joinedRooms: string[]
  createdAt: number
}
