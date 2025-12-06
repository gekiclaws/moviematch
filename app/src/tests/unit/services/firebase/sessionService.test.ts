import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../../../../types/session';

const {
  addDocMock,
  collectionMock,
  deleteDocMock,
  docMock,
  getDocMock,
  updateDocMock,
  queryMock,
  whereMock,
  getDocsMock,
  runTransactionMock,
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
    queryMock: vi.fn(),
    whereMock: vi.fn(),
    getDocsMock: vi.fn(),
    runTransactionMock: vi.fn(),
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
  query: queryMock,
  where: whereMock,
  getDocs: getDocsMock,
  runTransaction: runTransactionMock,
}));

vi.mock('../../../../services/firebase/index', () => ({
  db: fakeDb,
}));

import { SessionService } from '../../../../services/firebase/sessionService';

const baseSession: Omit<Session, 'id'> = {
  roomCode: '123456',
  userIds: ['user-1'],
  movieType: ['movie'],
  genres: ['action'],
  streamingServices: ['netflix'],
  favoriteTitles: ['title-1'],
  swipes: [],
  matchedTitles: [],
  createdAt: 1234567890,
  sessionStatus: 'awaiting',
  playerStatus: { 'user-1': 'awaiting' },
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
    queryMock.mockReset();
    whereMock.mockReset();
    getDocsMock.mockReset();
    runTransactionMock.mockReset();
    
    // Default implementations
    queryMock.mockReturnValue('mockQuery');
    whereMock.mockReturnValue('mockWhere');
  });

  it('creates a session when host is provided', async () => {
    // Mock room code availability check
    getDocsMock.mockResolvedValueOnce({ empty: true });
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

    const result = await SessionService.create('host-user', sessionData);

    expect(addDocMock).toHaveBeenCalledWith('sessionsCollection', expect.objectContaining({
      ...sessionData,
      userIds: ['host-user'],
      sessionStatus: 'awaiting',
      playerStatus: { 'host-user': 'awaiting' },
      roomCode: expect.stringMatching(/^\d{6}$/),
    }));
    expect(result).toEqual({
      sessionId: 'new-session-id',
      roomCode: expect.stringMatching(/^\d{6}$/),
    });
  });

  it('creates session successfully with empty hostId', async () => {
    // Note: This test checks that create() method works even with empty hostId
    const emptySessionData = {
      movieType: ['movie'] as Array<'movie' | 'show'>,
      genres: ['action'],
      streamingServices: ['netflix'],
      favoriteTitles: ['title-1'],
      swipes: [],
      createdAt: 1234567890,
      sessionStatus: 'awaiting' as const,
    };

    // Mock room code availability check
    getDocsMock.mockResolvedValueOnce({ empty: true });
    addDocMock.mockResolvedValueOnce({ id: 'new-session-id' });
    
    const result = await SessionService.create('', emptySessionData);
    
    expect(result).toEqual({
      sessionId: 'new-session-id',
      roomCode: expect.stringMatching(/^\d{6}$/),
    });
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

    // Mock room code availability check
    getDocsMock.mockResolvedValueOnce({ empty: true });
    addDocMock.mockResolvedValueOnce({ id: 'new-session-id' });
    
    const result = await SessionService.create('host-user', validSessionData);
    
    expect(result).toEqual({
      sessionId: 'new-session-id',
      roomCode: expect.stringMatching(/^\d{6}$/),
    });
  });

  it('returns the stored session when found', async () => {
    const storedSession: Omit<Session, 'id'> = {
      ...baseSession,
      genres: ['comedy'],
      sessionStatus: 'in progress',
      playerStatus: { 'user-1': 'awaiting' },
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

  // Tests for room code generation methods
  describe('generateRoomCode', () => {
    it('generates a 6-digit room code', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: true });

      const roomCode = await SessionService.generateRoomCode();

      expect(roomCode).toMatch(/^\d{6}$/);
      expect(parseInt(roomCode)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(roomCode)).toBeLessThanOrEqual(999999);
    });

    it('retries if first code is unavailable', async () => {
      getDocsMock
        .mockResolvedValueOnce({ empty: false }) // First code taken
        .mockResolvedValueOnce({ empty: true });  // Second code available

      const roomCode = await SessionService.generateRoomCode();

      expect(roomCode).toMatch(/^\d{6}$/);
      expect(getDocsMock).toHaveBeenCalledTimes(2);
    });

    it('throws error after max attempts', async () => {
      // Mock all attempts as unavailable
      for (let i = 0; i < 10; i++) {
        getDocsMock.mockResolvedValueOnce({ empty: false });
      }

      await expect(SessionService.generateRoomCode())
        .rejects.toThrow('Unable to generate unique room code after multiple attempts');

      expect(getDocsMock).toHaveBeenCalledTimes(10);
    });

    it('generates different codes on subsequent calls', async () => {
      getDocsMock
        .mockResolvedValueOnce({ empty: true })
        .mockResolvedValueOnce({ empty: true });

      const code1 = await SessionService.generateRoomCode();
      const code2 = await SessionService.generateRoomCode();

      expect(code1).toMatch(/^\d{6}$/);
      expect(code2).toMatch(/^\d{6}$/);
      // They should be different (very unlikely to be the same)
      expect(code1).not.toBe(code2);
    });
  });

  describe('isRoomCodeAvailable', () => {
    it('returns true when room code is available', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: true });

      const isAvailable = await SessionService.isRoomCodeAvailable('123456');

      expect(isAvailable).toBe(true);
      expect(queryMock).toHaveBeenCalledWith('sessionsCollection', 'mockWhere');
      expect(whereMock).toHaveBeenCalledWith('roomCode', '==', '123456');
    });

    it('returns false when room code is taken', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: false });

      const isAvailable = await SessionService.isRoomCodeAvailable('123456');

      expect(isAvailable).toBe(false);
    });
  });

  describe('getByRoomCode', () => {
    it('returns session when room code exists', async () => {
      const mockSession = {
        ...baseSession,
        roomCode: '123456',
      };
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'session-123',
          data: () => mockSession,
        }],
      });

      const result = await SessionService.getByRoomCode('123456');

      expect(result).toEqual({ id: 'session-123', ...mockSession });
      expect(queryMock).toHaveBeenCalledWith('sessionsCollection', 'mockWhere');
      expect(whereMock).toHaveBeenCalledWith('roomCode', '==', '123456');
    });

    it('returns null when room code does not exist', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: true });

      const result = await SessionService.getByRoomCode('999999');

      expect(result).toBeNull();
    });

    it('handles session without playerStatus', async () => {
      const mockSession = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['user1', 'user2'],
      };
      delete mockSession.playerStatus;
      
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'session-123',
          data: () => mockSession,
        }],
      });

      const result = await SessionService.getByRoomCode('123456');

      expect(result).toEqual({
        id: 'session-123',
        ...mockSession,
        playerStatus: {
          'user1': 'awaiting',
          'user2': 'awaiting',
        },
      });
    });
  });

  it('throws error when room code generation fails during creation', async () => {
    // Mock all room code generation attempts as unavailable
    for (let i = 0; i < 10; i++) {
      getDocsMock.mockResolvedValueOnce({ empty: false });
    }

    const sessionData = {
      movieType: ['movie'] as Array<'movie' | 'show'>,
      genres: ['action'],
      streamingServices: ['netflix'],
      favoriteTitles: ['title-1'],
      swipes: [],
      createdAt: 1234567890,
      sessionStatus: 'awaiting' as const,
    };

    await expect(SessionService.create('host-user', sessionData))
      .rejects.toThrow('Unable to generate unique room code after multiple attempts');

    expect(addDocMock).not.toHaveBeenCalled();
  });

  // Tests for getHost method
  describe('getHost', () => {
    it('returns the first user as host when session exists', async () => {
      const sessionWithUsers = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user', 'guest-user'],
        playerStatus: { 'host-user': 'awaiting', 'guest-user': 'awaiting' },
      };
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
      const emptySession = { ...baseSession, roomCode: '123456', userIds: [], playerStatus: {} };
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
    it('successfully adds user to session using room code', async () => {
      const singleUserSession = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user'],
        playerStatus: { 'host-user': 'awaiting' },
      };
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'session-123',
          data: () => singleUserSession,
        }],
      });
      updateDocMock.mockResolvedValueOnce(undefined);

      await SessionService.joinSession('123456', 'guest-user');

      expect(updateDocMock).toHaveBeenCalledWith(
        { path: 'sessions/session-123' },
        {
          userIds: ['host-user', 'guest-user'],
          playerStatus: { 'host-user': 'awaiting', 'guest-user': 'awaiting' },
        }
      );
    });

    it('throws error when room code does not exist', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: true });

      await expect(SessionService.joinSession('999999', 'user-123'))
        .rejects.toThrow('Room does not exist');

      expect(updateDocMock).not.toHaveBeenCalled();
    });

    it('throws error when user is already in room', async () => {
      const sessionWithUser = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user', 'existing-user'],
        playerStatus: { 'host-user': 'awaiting', 'existing-user': 'awaiting' },
      };
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'session-123',
          data: () => sessionWithUser,
        }],
      });

      await expect(SessionService.joinSession('123456', 'existing-user'))
        .rejects.toThrow('User already in room');

      expect(updateDocMock).not.toHaveBeenCalled();
    });

    it('throws error when room is full', async () => {
      const fullSession = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user', 'guest-user'],
        playerStatus: { 'host-user': 'awaiting', 'guest-user': 'awaiting' },
      };
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'session-123',
          data: () => fullSession,
        }],
      });

      await expect(SessionService.joinSession('123456', 'third-user'))
        .rejects.toThrow('Room is full');

      expect(updateDocMock).not.toHaveBeenCalled();
    });
  });

  describe('leaveSession', () => {
    it('removes the user from session and updates playerStatus', async () => {
      const sessionWithUsers = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user', 'guest-user'],
        playerStatus: { 'host-user': 'awaiting', 'guest-user': 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => sessionWithUsers,
      });
      updateDocMock.mockResolvedValueOnce(undefined);

      await SessionService.leaveSession('session-123', 'guest-user');

      expect(updateDocMock).toHaveBeenCalledWith(
        { path: 'sessions/session-123' },
        {
          userIds: ['host-user'],
          playerStatus: { 'host-user': 'awaiting' },
        }
      );
    });

    it('throws error when user not in session', async () => {
      const sessionWithHostOnly = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user'],
        playerStatus: { 'host-user': 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => sessionWithHostOnly,
      });

      await expect(SessionService.leaveSession('session-123', 'missing-user'))
        .rejects.toThrow('User not in room');

      expect(updateDocMock).not.toHaveBeenCalled();
    });
  });

  // Tests for startMovieMatching method
  describe('startMovieMatching', () => {
    it('successfully starts session when host has 2 users', async () => {
      const readySession = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user', 'guest-user'],
        playerStatus: { 'host-user': 'awaiting', 'guest-user': 'awaiting' },
      };
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
        {
          sessionStatus: 'in progress',
          playerStatus: { 'host-user': 'awaiting', 'guest-user': 'awaiting' },
        }
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
      const sessionWithUsers = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user', 'guest-user'],
        playerStatus: { 'host-user': 'awaiting', 'guest-user': 'awaiting' },
      };
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
      const singleUserSession = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user'],
        playerStatus: { 'host-user': 'awaiting' },
      };
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

  describe('markPlayerFinished', () => {
    it('marks the player as done without completing session if partner pending', async () => {
      const session = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user', 'guest-user'],
        playerStatus: { 'host-user': 'awaiting', 'guest-user': 'awaiting' },
        sessionStatus: 'in progress' as const,
      };

      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => session,
        }),
        update: vi.fn(),
      };

      runTransactionMock.mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await SessionService.markPlayerFinished('session-123', 'host-user');

      expect(mockTransaction.update).toHaveBeenCalledWith(
        { path: 'sessions/session-123' },
        { 'playerStatus.host-user': 'done' }
      );
    });

    it('completes session when all players are done', async () => {
      const session = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user', 'guest-user'],
        playerStatus: { 'host-user': 'done', 'guest-user': 'awaiting' },
        sessionStatus: 'in progress' as const,
        swipes: [
          {
            id: 'swipe-1',
            userId: 'host-user',
            mediaId: 'movie-1',
            mediaTitle: 'Movie 1',
            decision: 'like' as const,
            createdAt: 1,
          },
          {
            id: 'swipe-2',
            userId: 'guest-user',
            mediaId: 'movie-1',
            mediaTitle: 'Movie 1',
            decision: 'like' as const,
            createdAt: 2,
          },
          {
            id: 'swipe-3',
            userId: 'guest-user',
            mediaId: 'movie-2',
            mediaTitle: 'Movie 2',
            decision: 'dislike' as const,
            createdAt: 3,
          },
        ],
      };

      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => session,
        }),
        update: vi.fn(),
      };

      runTransactionMock.mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await SessionService.markPlayerFinished('session-123', 'guest-user');

      expect(mockTransaction.update).toHaveBeenCalledWith(
        { path: 'sessions/session-123' },
        {
          'playerStatus.guest-user': 'done',
          sessionStatus: 'complete',
          matchedTitles: [
            {
              id: 'movie-1',
              title: 'Movie 1',
            },
          ],
        }
      );
    });

    it('throws if user is not part of session', async () => {
      const session = {
        ...baseSession,
        roomCode: '123456',
        userIds: ['host-user'],
        playerStatus: { 'host-user': 'awaiting' },
      };

      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => session,
        }),
        update: vi.fn(),
      };

      runTransactionMock.mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(SessionService.markPlayerFinished('session-123', 'guest-user'))
        .rejects.toThrow('User not part of this session');

      expect(mockTransaction.update).not.toHaveBeenCalled();
    });

    it('throws if session does not exist in markPlayerFinished', async () => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => false,
        }),
        update: vi.fn(),
      };

      runTransactionMock.mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(SessionService.markPlayerFinished('nonexistent-session', 'user-123'))
        .rejects.toThrow('Session does not exist');

      expect(mockTransaction.update).not.toHaveBeenCalled();
    });
  });
});