import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserService } from './userService';
import type { User } from '../../types/user';

/**
 * UserManager - Handles persistent user identification using AsyncStorage
 * Manages device-based user sessions without requiring login
 */
export class UserManager {
  private static readonly USER_ID_KEY = 'moviematch_user_id';
  private static readonly USER_DATA_KEY = 'moviematch_user_data';
  
  private static currentUser: User | null = null;

  /**
   * Initialize user session on app launch
   * Checks for existing user ID, validates against Firebase, creates new user if needed
   * @returns Promise<User> - The current user object
   */
  static async initializeUser(): Promise<User> {
    try {
      // Step 1: Check for existing user ID in AsyncStorage
      let storedUserId = await AsyncStorage.getItem(this.USER_ID_KEY);
      
      if (storedUserId) {
        console.log('Found stored user ID:', storedUserId);
        
        // Step 2: Validate if user exists in Firebase
        const existingUser = await UserService.get(storedUserId);
        
        if (existingUser) {
          console.log('User exists in Firebase, loading data...');
          this.currentUser = existingUser;
          
          // Update local cache
          await this.cacheUserData(existingUser);
          return existingUser;
        } else {
          console.log('User ID not found in Firebase, creating new user...');
          // User ID exists locally but not in Firebase - create new user with this ID
          const newUser = await this.createUserWithId(storedUserId);
          return newUser;
        }
      } else {
        console.log('No stored user ID, creating new user...');
        // Step 3: No stored user ID - generate new one and create user
        const newUserId = this.generateUniqueUserId();
        const newUser = await this.createUserWithId(newUserId);
        return newUser;
      }
      
    } catch (error) {
      console.error('Error initializing user:', error);
      
      // Fallback: Generate new user if initialization fails
      const fallbackUserId = this.generateUniqueUserId();
      const fallbackUser = await this.createUserWithId(fallbackUserId);
      return fallbackUser;
    }
  }

  /**
   * Create a new user with a specific ID
   * @param userId - The ID to assign to the new user
   * @returns Promise<User> - The created user object
   */
  private static async createUserWithId(userId: string): Promise<User> {
    try {
      // Create user data
      const userData: Omit<User, 'id'> = {
        name: `User ${userId.substring(0, 6)}`, // Default name with partial ID
        preferences: {
          selectedTypes: [],
          selectedGenres: [],
          selectedPlatforms: [],
          favoriteMedia: [],
        },
        joinedRoom: '',
        createdAt: Date.now(),
      };

      // Create user in Firebase with specific ID
      await UserService.createWithId(userId, userData);
      
      // Get the created user to ensure consistency
      const createdUser = await UserService.get(userId);
      if (!createdUser) {
        throw new Error('Failed to create user');
      }

      // Store user ID and data locally
      await AsyncStorage.setItem(this.USER_ID_KEY, userId);
      await this.cacheUserData(createdUser);
      
      this.currentUser = createdUser;
      console.log('Created new user:', createdUser.id);
      
      return createdUser;
      
    } catch (error) {
      console.error('Error creating user with ID:', error);
      throw error;
    }
  }

  /**
   * Generate a unique user ID based on device characteristics and timestamp
   * @returns string - A unique user identifier
   */
  private static generateUniqueUserId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `user_${timestamp}_${random}`;
  }

  /**
   * Cache user data locally for offline access
   * @param user - The user object to cache
   */
  private static async cacheUserData(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(this.USER_DATA_KEY, JSON.stringify(user));
    } catch (error) {
      console.warn('Failed to cache user data:', error);
    }
  }

  /**
   * Get current user (from memory cache)
   * @returns User | null - The current user or null if not initialized
   */
  static getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get current user ID
   * @returns string | null - The current user ID or null if not initialized
   */
  static getCurrentUserId(): string | null {
    return this.currentUser?.id || null;
  }

  /**
   * Update current user data
   * @param updates - Partial user data to update
   * @returns Promise<User> - The updated user object
   */
  static async updateCurrentUser(updates: Partial<Omit<User, 'id'>>): Promise<User> {
    if (!this.currentUser) {
      throw new Error('No current user to update');
    }

    try {
      // Update in Firebase
      await UserService.update(this.currentUser.id, updates);
      
      // Get updated user data
      const updatedUser = await UserService.get(this.currentUser.id);
      if (!updatedUser) {
        throw new Error('Failed to get updated user');
      }

      // Update local cache
      this.currentUser = updatedUser;
      await this.cacheUserData(updatedUser);
      
      return updatedUser;
      
    } catch (error) {
      console.error('Error updating current user:', error);
      throw error;
    }
  }

  /**
   * Clear user session (for testing or logout functionality)
   */
  static async clearUserSession(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([this.USER_ID_KEY, this.USER_DATA_KEY]);
      this.currentUser = null;
      console.log('User session cleared');
    } catch (error) {
      console.error('Error clearing user session:', error);
    }
  }

  /**
   * Get cached user data (for offline scenarios)
   * @returns Promise<User | null> - Cached user data or null
   */
  static async getCachedUserData(): Promise<User | null> {
    try {
      const cachedData = await AsyncStorage.getItem(this.USER_DATA_KEY);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      console.warn('Failed to get cached user data:', error);
      return null;
    }
  }
}

export default UserManager;