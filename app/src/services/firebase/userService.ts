import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

import { db } from './index';
import type { User } from '../../types/user';

const collectionRef = collection(db, 'users');

export const UserService = {
  // CRUD Operations
  
  /**
   * Create a new user
   * @param userData - User data without ID
   * @returns Promise<string> - The created user's ID
   */
  async create(userData: Omit<User, 'id'>): Promise<string> {
    const docRef = await addDoc(collectionRef, userData);
    return docRef.id;
  },

  /**
   * Get user by ID
   * @param userId - The user ID to retrieve
   * @returns Promise<User | null> - User object or null if not found
   */
  async get(userId: string): Promise<User | null> {
    const ref = doc(db, 'users', userId);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return null;
    }

    return { id: snapshot.id, ...(snapshot.data() as Omit<User, 'id'>) };
  },

  /**
   * Update user data
   * @param userId - The user ID to update
   * @param data - Partial user data to update
   */
  async update(userId: string, data: Partial<Omit<User, 'id'>>): Promise<void> {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, data);
  },

  /**
   * Delete a user
   * @param userId - The user ID to delete
   */
  async delete(userId: string): Promise<void> {
    const ref = doc(db, 'users', userId);
    await deleteDoc(ref);
  },

  // Room Management Operations

  /**
   * Update user's joined room when they join a session
   * @param userId - The user ID
   * @param sessionId - The session ID they're joining
   */
  async joinRoom(userId: string, sessionId: string): Promise<void> {
    await this.update(userId, { joinedRoom: sessionId });
  },

  /**
   * Clear user's joined room when they leave a session
   * @param userId - The user ID
   */
  async leaveRoom(userId: string): Promise<void> {
    await this.update(userId, { joinedRoom: '' });
  },

  /**
   * Get user's current room
   * @param userId - The user ID
   * @returns Promise<string | null> - Current room ID or null
   */
  async getCurrentRoom(userId: string): Promise<string | null> {
    const user = await this.get(userId);
    return user?.joinedRoom || null;
  },

  /**
   * Check if user is currently in any room
   * @param userId - The user ID
   * @returns Promise<boolean> - True if user is in a room
   */
  async isInRoom(userId: string): Promise<boolean> {
    const currentRoom = await this.getCurrentRoom(userId);
    return !!currentRoom;
  },

  // User Preference Management

  /**
   * Update user's movie/show preferences
   * @param userId - The user ID
   * @param preferences - New preferences
   */
  async updatePreferences(
    userId: string, 
    preferences: Partial<User['preferences']>
  ): Promise<void> {
    const user = await this.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedPreferences = {
      ...user.preferences,
      ...preferences,
    };

    await this.update(userId, { preferences: updatedPreferences });
  },

  /**
   * Add a favorite title to user's preferences
   * @param userId - The user ID
   * @param title - Title to add to favorites
   */
  async addFavoriteTitle(userId: string, title: string): Promise<void> {
    const user = await this.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedFavorites = [...user.preferences.favoriteTitles];
    if (!updatedFavorites.includes(title)) {
      updatedFavorites.push(title);
      await this.updatePreferences(userId, { favoriteTitles: updatedFavorites });
    }
  },

  /**
   * Remove a favorite title from user's preferences
   * @param userId - The user ID  
   * @param title - Title to remove from favorites
   */
  async removeFavoriteTitle(userId: string, title: string): Promise<void> {
    const user = await this.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedFavorites = user.preferences.favoriteTitles.filter(
      t => t !== title
    );
    await this.updatePreferences(userId, { favoriteTitles: updatedFavorites });
  },

  // User Discovery and Querying

  /**
   * Find users in a specific room
   * @param sessionId - The session/room ID
   * @returns Promise<User[]> - Array of users in the room
   */
  async getUsersInRoom(sessionId: string): Promise<User[]> {
    const q = query(collectionRef, where('joinedRoom', '==', sessionId));
    const querySnapshot = await getDocs(q);
    
    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...(doc.data() as Omit<User, 'id'>) });
    });
    
    return users;
  },

  /**
   * Find user by name (case-insensitive search)
   * @param name - The name to search for
   * @returns Promise<User[]> - Array of users matching the name
   */
  async findByName(name: string): Promise<User[]> {
    // Note: Firestore doesn't support case-insensitive queries directly
    // This is a simple implementation - for production, consider using Algolia or similar
    const querySnapshot = await getDocs(collectionRef);
    
    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      const user = { id: doc.id, ...(doc.data() as Omit<User, 'id'>) };
      if (user.name?.toLowerCase().includes(name.toLowerCase())) {
        users.push(user);
      }
    });
    
    return users;
  },

  // User Authentication/Identification Logic

  /**
   * Initialize a new user with default preferences
   * @param name - Optional user name
   * @returns Promise<string> - The created user ID
   */
  async initializeUser(name?: string): Promise<string> {
    const defaultUser: Omit<User, 'id'> = {
      name,
      preferences: {
        selectedTypes: [],
        selectedGenres: [],
        selectedPlatforms: [],
        favoriteTitles: [],
      },
      joinedRoom: '',
      createdAt: Date.now(),
    };

    return await this.create(defaultUser);
  },

  /**
   * Update user's name
   * @param userId - The user ID
   * @param name - New name
   */
  async updateName(userId: string, name: string): Promise<void> {
    await this.update(userId, { name });
  },

  // Real-time User Listeners

  /**
   * Subscribe to user changes
   * @param userId - The user ID to listen to
   * @param onUpdate - Callback when user data changes
   * @param onError - Error callback
   * @returns Unsubscribe function
   */
  subscribeToUser(
    userId: string,
    onUpdate: (user: User | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const ref = doc(db, 'users', userId);
    
    return onSnapshot(
      ref,
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            const user: User = {
              id: snapshot.id,
              ...(snapshot.data() as Omit<User, 'id'>)
            };
            onUpdate(user);
          } else {
            onUpdate(null);
          }
        } catch (error) {
          console.error('Error processing user update:', error);
          onError?.(error as Error);
        }
      },
      (error) => {
        console.error('User listener error:', error);
        onError?.(error);
      }
    );
  },

  /**
   * Subscribe to users in a specific room
   * @param sessionId - The session/room ID
   * @param onUpdate - Callback when users change
   * @param onError - Error callback
   * @returns Unsubscribe function
   */
  subscribeToRoomUsers(
    sessionId: string,
    onUpdate: (users: User[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(collectionRef, where('joinedRoom', '==', sessionId));
    
    return onSnapshot(
      q,
      (querySnapshot) => {
        try {
          const users: User[] = [];
          querySnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...(doc.data() as Omit<User, 'id'>) });
          });
          onUpdate(users);
        } catch (error) {
          console.error('Error processing room users update:', error);
          onError?.(error as Error);
        }
      },
      (error) => {
        console.error('Room users listener error:', error);
        onError?.(error);
      }
    );
  },

};

export default UserService;
