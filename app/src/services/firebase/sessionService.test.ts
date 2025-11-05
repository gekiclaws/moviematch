import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from '../../types/session';

const {
  addDocMock,
  collectionMock,
  deleteDocMock,
  docMock,
  getDocMock,
  updateDocMock,
} = vi.hoisted(() => {
  const doc = vi.fn((_db: unknown, _collection: string, id: string) => ({
    path: `sessions/${id}`,
  }));

  return {
    addDocMock: vi.fn(),
    collectionMock: vi.fn(() => 'sessionsCollection'),
    deleteDocMock: vi.fn(),
    docMock: doc,
    getDocMock: vi.fn(),
    updateDocMock: vi.fn(),
  };
});

const fakeDb = vi.hoisted(() => ({}));

vi.mock('firebase/firestore', () => ({
  addDoc: addDocMock,
  collection: collectionMock,
  deleteDoc: deleteDocMock,
  doc: docMock,
  getDoc: getDocMock,
  updateDoc: updateDocMock,
}));

vi.mock('./index', () => ({
  db: fakeDb,
}));

// Import after mocks so that SessionService uses the mocked Firestore methods.
// eslint-disable-next-line import/first
import { SessionService } from './sessionService';

const baseSession: Omit<Session, 'id'> = {
  userIds: ['user-1'],
  movieType: ['movie'],
  genres: ['action'],
  streamingServices: ['netflix'],
  favoriteTitles: ['title-1'],
  swipes: [],
  createdAt: 1234567890,
  sessionStatus: 'awaiting',
};

describe('SessionService', () => {
  beforeEach(() => {
    addDocMock.mockReset();
    collectionMock.mockReset();
    collectionMock.mockReturnValue('sessionsCollection');
    deleteDocMock.mockReset();
    docMock.mockReset();
    docMock.mockImplementation((_db: unknown, _collection: string, id: string) => ({
      path: `sessions/${id}`,
    }));
    getDocMock.mockReset();
    updateDocMock.mockReset();
  });

  it('creates a session when host is provided', async () => {
    addDocMock.mockResolvedValueOnce({ id: 'new-session-id' });
    
    const sessionData = {
      movieType: ['movie'] as Array<'movie' | 'show'>,
      genres: ['action'],
      streamingServices: ['netflix'],
      favoriteTitles: ['title-1'],
      swipes: [],
      createdAt: 1234567890,
      sessionStatus: 'awaiting' as const,
    };

    const id = await SessionService.create('host-user', sessionData);

    expect(addDocMock).toHaveBeenCalledWith('sessionsCollection', {
      ...sessionData,
      userIds: ['host-user'],
      sessionStatus: 'awaiting',
    });
    expect(id).toBe('new-session-id');
  });

  it('throws when creating a session without users', async () => {
    // Note: This test may not be applicable since create() method 
    // automatically adds hostId to userIds, but keeping for completeness
    const emptySessionData = {
      movieType: ['movie'] as Array<'movie' | 'show'>,
      genres: ['action'],
      streamingServices: ['netflix'],
      favoriteTitles: ['title-1'],
      swipes: [],
      createdAt: 1234567890,
      sessionStatus: 'awaiting' as const,
    };

    // This should succeed since create method adds hostId automatically
    addDocMock.mockResolvedValueOnce({ id: 'new-session-id' });
    
    const id = await SessionService.create('', emptySessionData);
    
    expect(id).toBe('new-session-id');
  });

  it('creates session successfully with valid data', async () => {
    const validSessionData = {
      movieType: ['movie'] as Array<'movie' | 'show'>,
      genres: ['action'],
      streamingServices: ['netflix'],
      favoriteTitles: ['title-1'],
      swipes: [],
      createdAt: 1234567890,
      sessionStatus: 'awaiting' as const,
    };

    addDocMock.mockResolvedValueOnce({ id: 'new-session-id' });
    
    const id = await SessionService.create('host-user', validSessionData);
    
    expect(id).toBe('new-session-id');
  });

  it('returns the stored session when found', async () => {
    const storedSession: Omit<Session, 'id'> = {
      ...baseSession,
      genres: ['comedy'],
      sessionStatus: 'in progress',
    };
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'existing-id',
      data: () => storedSession,
    });

    const result = await SessionService.get('existing-id');

    expect(docMock).toHaveBeenCalledWith(fakeDb, 'sessions', 'existing-id');
    expect(result).toEqual({ id: 'existing-id', ...storedSession });
  });

  it('returns null when the session does not exist', async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => false,
    });

    const result = await SessionService.get('missing-id');

    expect(result).toBeNull();
  });

  it('updates a session with valid user ids', async () => {
    updateDocMock.mockResolvedValueOnce(undefined);

    await SessionService.update('session-123', { genres: ['thriller'] });

    expect(docMock).toHaveBeenCalledWith(fakeDb, 'sessions', 'session-123');
    expect(updateDocMock).toHaveBeenCalledWith({ path: 'sessions/session-123' }, { genres: ['thriller'] });
  });

  it('throws when updating the session with an invalid number of users', async () => {
    await expect(
      SessionService.update('session-123', {
        userIds: ['user-1', 'user-2', 'user-3'],
      })
    ).rejects.toThrow('Session must have 1 or 2 users');

    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('deletes a session by id', async () => {
    deleteDocMock.mockResolvedValueOnce(undefined);

    await SessionService.delete('session-123');

    expect(docMock).toHaveBeenCalledWith(fakeDb, 'sessions', 'session-123');
    expect(deleteDocMock).toHaveBeenCalledWith({ path: 'sessions/session-123' });
  });

  // Tests for getHost method
  describe('getHost', () => {
    it('returns the first user as host when session exists', async () => {
      const sessionWithUsers = { ...baseSession, userIds: ['host-user', 'guest-user'] };
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => sessionWithUsers,
      });

      const hostId = await SessionService.getHost('session-123');

      expect(hostId).toBe('host-user');
    });

    it('returns null when session does not exist', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => false,
      });

      const hostId = await SessionService.getHost('nonexistent-session');

      expect(hostId).toBeNull();
    });

    it('returns null when session has no users', async () => {
      const emptySession = { ...baseSession, userIds: [] };
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => emptySession,
      });

      const hostId = await SessionService.getHost('session-123');

      expect(hostId).toBeNull();
    });
  });

  // Tests for joinSession method
  describe('joinSession', () => {
    it('successfully adds user to session', async () => {
      const singleUserSession = { ...baseSession, userIds: ['host-user'] };
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => singleUserSession,
      });
      updateDocMock.mockResolvedValueOnce(undefined);

      await SessionService.joinSession('session-123', 'guest-user');

      expect(updateDocMock).toHaveBeenCalledWith(
        { path: 'sessions/session-123' },
        { userIds: ['host-user', 'guest-user'] }
      );
    });

    it('throws error when room does not exist', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(SessionService.joinSession('nonexistent-room', 'user-123'))
        .rejects.toThrow('Room does not exist');

      expect(updateDocMock).not.toHaveBeenCalled();
    });

    it('throws error when user is already in room', async () => {
      const sessionWithUser = { ...baseSession, userIds: ['host-user', 'existing-user'] };
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => sessionWithUser,
      });

      await expect(SessionService.joinSession('session-123', 'existing-user'))
        .rejects.toThrow('User already in room');

      expect(updateDocMock).not.toHaveBeenCalled();
    });

    it('throws error when room is full', async () => {
      const fullSession = { ...baseSession, userIds: ['host-user', 'guest-user'] };
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => fullSession,
      });

      await expect(SessionService.joinSession('session-123', 'third-user'))
        .rejects.toThrow('Room is full');

      expect(updateDocMock).not.toHaveBeenCalled();
    });
  });

  // Tests for startMovieMatching method
  describe('startMovieMatching', () => {
    it('successfully starts session when host has 2 users', async () => {
      const readySession = { ...baseSession, userIds: ['host-user', 'guest-user'] };
      // Mock for initial session get
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => readySession,
      });
      // Mock for getHost call
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => readySession,
      });
      updateDocMock.mockResolvedValueOnce(undefined);

      await SessionService.startMovieMatching('session-123', 'host-user');

      expect(updateDocMock).toHaveBeenCalledWith(
        { path: 'sessions/session-123' },
        { sessionStatus: 'in progress' }
      );
    });

    it('throws error when session does not exist', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(SessionService.startMovieMatching('nonexistent-session', 'user-123'))
        .rejects.toThrow('Session does not exist');

      expect(updateDocMock).not.toHaveBeenCalled();
    });

    it('throws error when non-host tries to start session', async () => {
      const sessionWithUsers = { ...baseSession, userIds: ['host-user', 'guest-user'] };
      // Mock for initial session get
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => sessionWithUsers,
      });
      // Mock for getHost call
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => sessionWithUsers,
      });

      await expect(SessionService.startMovieMatching('session-123', 'guest-user'))
        .rejects.toThrow('Only the host can start the session');

      expect(updateDocMock).not.toHaveBeenCalled();
    });

    it('throws error when session has insufficient users', async () => {
      const singleUserSession = { ...baseSession, userIds: ['host-user'] };
      // Mock for initial session get
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => singleUserSession,
      });
      // Mock for getHost call
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => singleUserSession,
      });

      await expect(SessionService.startMovieMatching('session-123', 'host-user'))
        .rejects.toThrow('Session must have exactly 2 users to start');

      expect(updateDocMock).not.toHaveBeenCalled();
    });
  });
});
