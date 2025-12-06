import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../../../types/user';

const { getItemMock, setItemMock, multiRemoveMock } = vi.hoisted(() => ({
  getItemMock: vi.fn(),
  setItemMock: vi.fn(),
  multiRemoveMock: vi.fn(),
}));

const {
  userServiceGetMock,
  userServiceCreateWithIdMock,
  userServiceUpdateMock,
} = vi.hoisted(() => ({
  userServiceGetMock: vi.fn(),
  userServiceCreateWithIdMock: vi.fn(),
  userServiceUpdateMock: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: getItemMock,
    setItem: setItemMock,
    multiRemove: multiRemoveMock,
  },
}));

vi.mock('../../../../services/firebase/userService', () => ({
  UserService: {
    get: userServiceGetMock,
    createWithId: userServiceCreateWithIdMock,
    update: userServiceUpdateMock,
  },
}));

import { UserManager } from '../../../../services/firebase/userManager';

const baseUser: User = {
  id: 'user-1',
  name: 'Existing User',
  preferences: {
    selectedTypes: [],
    selectedGenres: [],
    selectedPlatforms: [],
    favoriteMedia: [],
  },
  joinedRoom: '',
  createdAt: 1,
};

describe('UserManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getItemMock.mockResolvedValue(null);
    setItemMock.mockResolvedValue();
    multiRemoveMock.mockResolvedValue();
    userServiceGetMock.mockResolvedValue(null);
    userServiceCreateWithIdMock.mockResolvedValue();
    userServiceUpdateMock.mockResolvedValue();
    // @ts-expect-error - accessing private state for reset
    UserManager.currentUser = null;
  });

  it('initializes using stored user when found in Firebase', async () => {
    getItemMock.mockResolvedValueOnce('stored-id');
    userServiceGetMock.mockResolvedValueOnce(baseUser);

    const user = await UserManager.initializeUser();

    expect(user).toEqual(baseUser);
    expect(userServiceGetMock).toHaveBeenCalledWith('stored-id');
    expect(setItemMock).toHaveBeenCalledWith('moviematch_user_data', JSON.stringify(baseUser));
    expect(UserManager.getCurrentUser()).toEqual(baseUser);
  });

  it('recreates user when stored id is missing from Firebase', async () => {
    getItemMock.mockResolvedValueOnce('lost-id');
    userServiceGetMock.mockResolvedValueOnce(null);
    const recreated: User = { ...baseUser, id: 'lost-id' };
    userServiceGetMock.mockResolvedValueOnce(recreated);

    const user = await UserManager.initializeUser();

    expect(userServiceCreateWithIdMock).toHaveBeenCalledWith(
      'lost-id',
      expect.objectContaining({ joinedRoom: '' })
    );
    expect(user).toEqual(recreated);
    expect(setItemMock).toHaveBeenCalledWith('moviematch_user_id', 'lost-id');
    expect(setItemMock).toHaveBeenCalledWith('moviematch_user_data', JSON.stringify(recreated));
  });

  it('creates a new user when none is stored', async () => {
    const generatedId = 'user_generated';
    // @ts-expect-error - accessing private method for deterministic id
    const idSpy = vi.spyOn(UserManager, 'generateUniqueUserId').mockReturnValue(generatedId);
    const created: User = { ...baseUser, id: generatedId };
    userServiceGetMock.mockResolvedValueOnce(created);

    const user = await UserManager.initializeUser();

    expect(userServiceCreateWithIdMock).toHaveBeenCalledWith(
      generatedId,
      expect.objectContaining({ name: expect.stringContaining(generatedId.substring(0, 6)) })
    );
    expect(user).toEqual(created);
    expect(setItemMock).toHaveBeenCalledWith('moviematch_user_id', generatedId);
    expect(setItemMock).toHaveBeenCalledWith('moviematch_user_data', JSON.stringify(created));
    idSpy.mockRestore();
  });

  it('falls back to a new user when initialization throws', async () => {
    getItemMock.mockRejectedValueOnce(new Error('storage failure'));
    const generatedId = 'fallback-id';
    // @ts-expect-error - accessing private method for deterministic id
    const idSpy = vi.spyOn(UserManager, 'generateUniqueUserId').mockReturnValue(generatedId);
    const created: User = { ...baseUser, id: generatedId };
    userServiceGetMock.mockResolvedValueOnce(created);

    const user = await UserManager.initializeUser();

    expect(userServiceCreateWithIdMock).toHaveBeenCalledWith(generatedId, expect.any(Object));
    expect(user).toEqual(created);
    idSpy.mockRestore();
  });

  it('throws when updating without a current user', async () => {
    await expect(UserManager.updateCurrentUser({ name: 'n/a' })).rejects.toThrow('No current user to update');
  });

  it('throws when update flow cannot fetch the refreshed user', async () => {
    // @ts-expect-error - setting private state for test
    UserManager.currentUser = baseUser;
    userServiceGetMock.mockResolvedValueOnce(null);

    await expect(UserManager.updateCurrentUser({ name: 'Updated' })).rejects.toThrow('Failed to get updated user');
  });

  it('updates the current user and caches the result', async () => {
    // @ts-expect-error - setting private state for test
    UserManager.currentUser = baseUser;
    const updated: User = { ...baseUser, name: 'Updated' };
    userServiceGetMock.mockResolvedValueOnce(updated);

    const result = await UserManager.updateCurrentUser({ name: 'Updated' });

    expect(userServiceUpdateMock).toHaveBeenCalledWith(baseUser.id, { name: 'Updated' });
    expect(setItemMock).toHaveBeenCalledWith('moviematch_user_data', JSON.stringify(updated));
    expect(UserManager.getCurrentUser()).toEqual(updated);
    expect(result).toEqual(updated);
  });

  it('returns cached user data from storage', async () => {
    getItemMock.mockResolvedValueOnce(JSON.stringify(baseUser));

    const cached = await UserManager.getCachedUserData();

    expect(cached).toEqual(baseUser);
  });

  it('returns null cached data when storage fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getItemMock.mockRejectedValueOnce(new Error('read-failure'));

    const cached = await UserManager.getCachedUserData();

    expect(cached).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('exposes current user and id getters', () => {
    expect(UserManager.getCurrentUser()).toBeNull();
    expect(UserManager.getCurrentUserId()).toBeNull();
    // @ts-expect-error - setting private state for test
    UserManager.currentUser = baseUser;
    expect(UserManager.getCurrentUser()).toEqual(baseUser);
    expect(UserManager.getCurrentUserId()).toBe(baseUser.id);
  });

  it('caches user data and logs warning on failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setItemMock.mockRejectedValueOnce(new Error('cache-failure'));
    // @ts-expect-error - accessing private method
    await UserManager.cacheUserData(baseUser);

    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to cache user data:',
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  it('fails to create user when get returns null', async () => {
    userServiceGetMock.mockResolvedValueOnce(null); // initial check in createUserWithId
    userServiceGetMock.mockResolvedValueOnce(null); // post-create fetch

    // @ts-expect-error - accessing private method
    await expect(UserManager.createUserWithId('bad-id')).rejects.toThrow('Failed to create user');
  });

  it('generates unique user ids with timestamp and random', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(12345);
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    // @ts-expect-error - accessing private method
    const id = UserManager.generateUniqueUserId();

    expect(id).toMatch(/^user_12345_[a-z0-9]+$/);
    nowSpy.mockRestore();
    randSpy.mockRestore();
  });

  it('clears the user session', async () => {
    // @ts-expect-error - setting private state for test
    UserManager.currentUser = baseUser;

    await UserManager.clearUserSession();

    expect(multiRemoveMock).toHaveBeenCalledWith(['moviematch_user_id', 'moviematch_user_data']);
    expect(UserManager.getCurrentUser()).toBeNull();
  });

  it('logs errors when clearing session fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    multiRemoveMock.mockRejectedValueOnce(new Error('clear-failed'));
    // @ts-expect-error - setting private state for test
    UserManager.currentUser = baseUser;

    await UserManager.clearUserSession();

    expect(errorSpy).toHaveBeenCalledWith(
      'Error clearing user session:',
      expect.any(Error)
    );
    // currentUser remains because we failed before nulling
    expect(UserManager.getCurrentUser()).toEqual(baseUser);
    errorSpy.mockRestore();
  });
});
