export interface User {
  id: string
  name?: string
  preferences: {
    selectedTypes: ('movie' | 'show')[]
    selectedGenres: string[]
    selectedPlatforms: string[]
    favoriteMedia: string[]
  }
  joinedRoom: string // Current joined room ID
  createdAt: number
}
