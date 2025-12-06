import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../../../types/user';

const {
  addDocMock,
  collectionMock,
  deleteDocMock,
  docMock,
  getDocMock,
  setDocMock,
  updateDocMock,
  queryMock,
  whereMock,
  getDocsMock,
  onSnapshotMock,
  unsubscribeMock,
} = vi.hoisted(() => ({
  addDocMock: vi.fn(),
  collectionMock: vi.fn(() => 'usersCollection'),
  deleteDocMock: vi.fn(),
  docMock: vi.fn((_db, _collection, id) => ({ path: `users/${id}` })),
  getDocMock: vi.fn(),
  setDocMock: vi.fn(),
  updateDocMock: vi.fn(),
  queryMock: vi.fn(),
  whereMock: vi.fn(),
  getDocsMock: vi.fn(),
  onSnapshotMock: vi.fn(),
  unsubscribeMock: vi.fn(),
}));

const fakeDb = vi.hoisted(() => ({}));

vi.mock('firebase/firestore', () => ({
  addDoc: addDocMock,
  collection: collectionMock,
  deleteDoc: deleteDocMock,
  doc: docMock,
  getDoc: getDocMock,
  setDoc: setDocMock,
  updateDoc: updateDocMock,
  query: queryMock,
  where: whereMock,
  getDocs: getDocsMock,
  onSnapshot: onSnapshotMock,
}));

vi.mock('../../../../services/firebase/index', () => ({
  db: fakeDb,
}));

collectionMock.mockReturnValue('usersCollection');

import { UserService } from '../../../../services/firebase/userService';

const baseUserData: Omit<User, 'id'> = {
  name: 'Tester',
  preferences: {
    selectedTypes: ['movie'],
    selectedGenres: ['action'],
    selectedPlatforms: [],
    favoriteMedia: [],
  },
  joinedRoom: '',
  createdAt: 123,
};

const baseUser: User = { id: 'user-1', ...baseUserData };

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collectionMock.mockReturnValue('usersCollection');
    docMock.mockImplementation((_db, _collection, id) => ({ path: `users/${id}` }));
    addDocMock.mockResolvedValue({ id: 'new-user-id' });
    getDocMock.mockResolvedValue({
      exists: () => true,
      id: baseUser.id,
      data: () => ({ ...baseUserData }),
    });
    setDocMock.mockResolvedValue(undefined);
    updateDocMock.mockResolvedValue(undefined);
    deleteDocMock.mockResolvedValue(undefined);
    queryMock.mockReturnValue('query');
    whereMock.mockReturnValue('where');
    getDocsMock.mockResolvedValue({ forEach: () => {} });
    onSnapshotMock.mockImplementation((_ref, onNext) => {
      onNext({ exists: () => false });
      return unsubscribeMock;
    });
  });

  it('creates a user and returns the new id', async () => {
    const userData = {
      name: 'New User',
      preferences: baseUser.preferences,
      joinedRoom: '',
      createdAt: 999,
    };

    const id = await UserService.create(userData);

    expect(addDocMock).toHaveBeenCalledWith('usersCollection', userData);
    expect(id).toBe('new-user-id');
  });

  it('creates a user with a specific id', async () => {
    const userData = {
      name: 'Specific',
      preferences: baseUser.preferences,
      joinedRoom: '',
      createdAt: 1,
    };

    await UserService.createWithId('custom-id', userData);

    expect(setDocMock).toHaveBeenCalledWith({ path: 'users/custom-id' }, userData);
  });

  it('returns null when user does not exist', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false });

    const user = await UserService.get('missing');
    expect(user).toBeNull();
  });

  it('returns user data when found', async () => {
    const storedData = { ...baseUserData, name: 'Stored', preferences: { ...baseUserData.preferences } };
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'stored-id',
      data: () => ({ ...storedData }),
    });

    const user = await UserService.get('stored-id');

    expect(user).toEqual({ id: 'stored-id', ...storedData });
  });

  it('updates an existing user', async () => {
    await UserService.update('user-1', { name: 'Updated' });

    expect(updateDocMock).toHaveBeenCalledWith({ path: 'users/user-1' }, { name: 'Updated' });
  });

  it('deletes a user', async () => {
    await UserService.delete('user-1');

    expect(deleteDocMock).toHaveBeenCalledWith({ path: 'users/user-1' });
  });

  it('joins a room by updating joinedRoom', async () => {
    await UserService.joinRoom('user-1', 'room-1');

    expect(updateDocMock).toHaveBeenCalledWith({ path: 'users/user-1' }, { joinedRoom: 'room-1' });
  });

  it('clears joinedRoom when leaving', async () => {
    await UserService.leaveRoom('user-1');

    expect(updateDocMock).toHaveBeenCalledWith({ path: 'users/user-1' }, { joinedRoom: '' });
  });

  it('returns current room id for a user', async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'user-1',
      data: () => ({ ...baseUserData, joinedRoom: 'room-123' }),
    });

    const room = await UserService.getCurrentRoom('user-1');
    expect(room).toBe('room-123');
  });

  it('checks if user is in a room', async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'user-1',
      data: () => ({ ...baseUserData, joinedRoom: 'room-abc' }),
    });

    const inRoom = await UserService.isInRoom('user-1');
    expect(inRoom).toBe(true);
  });

  it('returns null room and false in-room when user does not exist', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false });
    const room = await UserService.getCurrentRoom('missing');
    expect(room).toBeNull();

    getDocMock.mockResolvedValueOnce({ exists: () => false });
    const inRoom = await UserService.isInRoom('missing');
    expect(inRoom).toBe(false);
  });

  it('merges and updates preferences', async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'user-1',
      data: () => ({ ...baseUserData }),
    });

    await UserService.updatePreferences('user-1', {
      selectedPlatforms: ['netflix'],
      favoriteMedia: ['fav-1'],
    });

    expect(updateDocMock).toHaveBeenCalledWith(
      { path: 'users/user-1' },
      {
        preferences: {
          selectedTypes: ['movie'],
          selectedGenres: ['action'],
          selectedPlatforms: ['netflix'],
          favoriteMedia: ['fav-1'],
        },
      }
    );
  });

  it('throws when updating preferences for a missing user', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false });

    await expect(
      UserService.updatePreferences('missing', { favoriteMedia: ['x'] })
    ).rejects.toThrow('User not found');
  });

  it('adds a favorite title when missing', async () => {
    const updatePreferencesSpy = vi.spyOn(UserService, 'updatePreferences').mockResolvedValue();
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'user-1',
      data: () => ({ ...baseUserData }),
    });

    await UserService.addFavoriteTitle('user-1', 'movie-1');

    expect(updatePreferencesSpy).toHaveBeenCalledWith('user-1', { favoriteMedia: ['movie-1'] });
    updatePreferencesSpy.mockRestore();
  });

  it('does not duplicate favorite titles', async () => {
    const updatePreferencesSpy = vi.spyOn(UserService, 'updatePreferences').mockResolvedValue();
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'user-1',
      data: () => ({
        ...baseUserData,
        preferences: { ...baseUserData.preferences, favoriteMedia: ['movie-1'] },
      }),
    });

    await UserService.addFavoriteTitle('user-1', 'movie-1');

    expect(updatePreferencesSpy).not.toHaveBeenCalled();
    updatePreferencesSpy.mockRestore();
  });

  it('removes a favorite title', async () => {
    const user = {
      ...baseUserData,
      preferences: { ...baseUserData.preferences, favoriteMedia: ['keep', 'remove'] },
    };
    const updatePreferencesSpy = vi.spyOn(UserService, 'updatePreferences').mockResolvedValue();
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'user-1',
      data: () => user,
    });

    await UserService.removeFavoriteTitle('user-1', 'remove');

    expect(updatePreferencesSpy).toHaveBeenCalledWith('user-1', { favoriteMedia: ['keep'] });
    updatePreferencesSpy.mockRestore();
  });

  it('throws when removing a favorite for a missing user', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false });

    await expect(UserService.removeFavoriteTitle('missing', 'any')).rejects.toThrow('User not found');
  });

  it('returns users in a room', async () => {
    const inRoomUser = { ...baseUserData, joinedRoom: 'room-1' };
    getDocsMock.mockResolvedValueOnce({
      forEach: (cb: (doc: any) => void) => {
        cb({ id: 'user-1', data: () => inRoomUser });
        cb({ id: 'user-2', data: () => ({ ...inRoomUser, name: 'Another' }) });
      },
    });

    const users = await UserService.getUsersInRoom('room-1');

    expect(queryMock).toHaveBeenCalledWith('usersCollection', 'where');
    expect(users).toHaveLength(2);
    expect(users[0].id).toBe('user-1');
  });

  it('finds users by name (case-insensitive)', async () => {
    getDocsMock.mockResolvedValueOnce({
      forEach: (cb: (doc: any) => void) => {
        cb({ id: 'u1', data: () => ({ ...baseUserData, name: 'Alice' }) });
        cb({ id: 'u2', data: () => ({ ...baseUserData, name: 'Bob' }) });
      },
    });

    const users = await UserService.findByName('ali');

    expect(users).toEqual([{ id: 'u1', ...baseUserData, name: 'Alice' }]);
  });

  it('subscribes to user updates', () => {
    const userData = { ...baseUserData, name: 'Subscriber' };
    onSnapshotMock.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        id: 'user-1',
        data: () => userData,
      });
      return unsubscribeMock;
    });

    const onUpdate = vi.fn();
    const unsubscribe = UserService.subscribeToUser('user-1', onUpdate);

    expect(onUpdate).toHaveBeenCalledWith({ id: 'user-1', ...userData });
    expect(unsubscribe).toBe(unsubscribeMock);
  });

  it('subscribes to user updates and passes null when missing', () => {
    onSnapshotMock.mockImplementation((_ref, onNext) => {
      onNext({ exists: () => false });
      return unsubscribeMock;
    });

    const onUpdate = vi.fn();
    const unsubscribe = UserService.subscribeToUser('user-1', onUpdate);

    expect(onUpdate).toHaveBeenCalledWith(null);
    expect(unsubscribe).toBe(unsubscribeMock);
  });

  it('forwards listener errors for user subscription', () => {
    onSnapshotMock.mockImplementation((_ref, _onNext, onError) => {
      onError?.(new Error('listener failed'));
      return unsubscribeMock;
    });

    const onError = vi.fn();
    UserService.subscribeToUser('user-1', vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('subscribes to room users updates', () => {
    onSnapshotMock.mockImplementation((_ref, onNext) => {
      onNext({
        forEach: (cb: (doc: any) => void) => {
          cb({ id: 'user-1', data: () => baseUserData });
        },
      });
      return unsubscribeMock;
    });

    const onUpdate = vi.fn();
    const unsubscribe = UserService.subscribeToRoomUsers('room-1', onUpdate);

    expect(onUpdate).toHaveBeenCalledWith([{ id: 'user-1', ...baseUserData }]);
    expect(unsubscribe).toBe(unsubscribeMock);
  });

  it('forwards listener errors for room user subscription', () => {
    onSnapshotMock.mockImplementation((_ref, _onNext, onError) => {
      onError?.(new Error('room listener failed'));
      return unsubscribeMock;
    });

    const onError = vi.fn();
    UserService.subscribeToRoomUsers('room-1', vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('initializes a user with defaults and optional name', async () => {
    addDocMock.mockResolvedValueOnce({ id: 'init-id' });

    const id = await UserService.initializeUser('Named User');

    expect(addDocMock).toHaveBeenCalledWith('usersCollection', expect.objectContaining({ name: 'Named User' }));
    expect(id).toBe('init-id');
  });

  it('updates user name directly', async () => {
    await UserService.updateName('user-5', 'New Name');

    expect(updateDocMock).toHaveBeenCalledWith({ path: 'users/user-5' }, { name: 'New Name' });
  });
});
