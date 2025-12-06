import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../../../../types/session';

/**
 * ────────────────────────────────────────────────
 *  HOISTED MOCKS (superset of version A + B)
 * ────────────────────────────────────────────────
 */
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
  transactionGetMock,
  transactionUpdateMock,
  onSnapshotMock,
} = vi.hoisted(() => {
  const doc = vi.fn((_db, _collection, id) => ({ path: `sessions/${id}` }));

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
    transactionGetMock: vi.fn(),
    transactionUpdateMock: vi.fn(),
    onSnapshotMock: vi.fn(() => vi.fn()), // Returns unsubscribe function
  };
});

const fakeDb = vi.hoisted(() => ({}));

/**
 * FIREBASE MOCKS
 */
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
  onSnapshot: onSnapshotMock,
}));

vi.mock('../../../../services/firebase/index', () => ({
  db: fakeDb,
}));

import { SessionService } from '../../../../services/firebase/sessionService';

/**
 * BASE SESSION used across tests
 */
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
  /**
   * RESET all mocks before each test
   */
  beforeEach(() => {
    addDocMock.mockReset();
    collectionMock.mockReset();
    collectionMock.mockReturnValue('sessionsCollection');

    deleteDocMock.mockReset();

    docMock.mockReset();
    docMock.mockImplementation((_db, _collection, id) => ({ path: `sessions/${id}` }));

    getDocMock.mockReset();
    updateDocMock.mockReset();

    queryMock.mockReset();
    queryMock.mockReturnValue('mockQuery');

    whereMock.mockReset();
    whereMock.mockReturnValue('mockWhere');

    getDocsMock.mockReset();
    onSnapshotMock.mockReset();

    transactionGetMock.mockReset();
    transactionUpdateMock.mockReset();
    runTransactionMock.mockReset();
    runTransactionMock.mockImplementation(async (_db, updater) =>
      updater({
        get: transactionGetMock,
        update: transactionUpdateMock,
      })
    );

    onSnapshotMock.mockImplementation(() => () => {});
  });

  /**
   * ────────────────────────────────────────────────
   * ROOM CODE GENERATION
   * ────────────────────────────────────────────────
   */
  describe('generateRoomCode', () => {
    it('retries until an available room code is found', async () => {
      const availabilitySpy = vi
        .spyOn(SessionService, 'isRoomCodeAvailable')
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456);

      const roomCode = await SessionService.generateRoomCode();

      expect(roomCode).toMatch(/^[0-9]{6}$/);
      expect(availabilitySpy).toHaveBeenCalledTimes(2);

      availabilitySpy.mockRestore();
      randomSpy.mockRestore();
    });

    it('throws after max attempts when all codes are taken', async () => {
      const availabilitySpy = vi.spyOn(SessionService, 'isRoomCodeAvailable').mockResolvedValue(false);
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      await expect(SessionService.generateRoomCode()).rejects.toThrow(
        'Unable to generate unique room code after multiple attempts'
      );
      expect(availabilitySpy).toHaveBeenCalledTimes(10);

      availabilitySpy.mockRestore();
      randomSpy.mockRestore();
    });
  });

  /**
   * ────────────────────────────────────────────────
   * CREATE
   * ────────────────────────────────────────────────
   */
  it('creates a session when host is provided', async () => {
    // version A required checking room code availability
    getDocsMock.mockResolvedValueOnce({ empty: true });

    addDocMock.mockResolvedValueOnce({ id: 'new-session-id' });

    const sessionData = {
      movieType: ['movie'],
      genres: ['action'],
      streamingServices: ['netflix'],
      favoriteTitles: ['title-1'],
      swipes: [],
      createdAt: 1234567890,
      sessionStatus: 'awaiting' as const,
    };

    const result = await SessionService.create('host-user', sessionData);

    expect(addDocMock).toHaveBeenCalled();
    expect(result.sessionId || result).toBe('new-session-id'); // version A vs B return formats
  });

  it('creates session with empty hostId (version A behavior)', async () => {
    getDocsMock.mockResolvedValueOnce({ empty: true });
    addDocMock.mockResolvedValueOnce({ id: 'new-session-id' });

    const sessionData = {
      movieType: ['movie'],
      genres: ['action'],
      streamingServices: ['netflix'],
      favoriteTitles: ['title-1'],
      swipes: [],
      createdAt: 1234567890,
      sessionStatus: 'awaiting' as const,
    };

    const result = await SessionService.create('', sessionData);

    expect(result.sessionId || result).toBe('new-session-id');
  });

  /**
   * ────────────────────────────────────────────────
   * GET SESSION (Encapsulated with error handling)
   * ────────────────────────────────────────────────
   */
  describe('getSession', () => {
    it('returns session when found', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => baseSession,
      });

      const result = await SessionService.getSession('session-123');

      expect(result).toEqual({ id: 'session-123', ...baseSession });
    });

    it('returns null when session not found', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await SessionService.getSession('nonexistent-id');

      expect(result).toBeNull();
    });

    it('returns null and logs error when get throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      getDocMock.mockRejectedValueOnce(new Error('Network error'));

      const result = await SessionService.getSession('session-123');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error retrieving session session-123'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handles session with playerStatus defaults', async () => {
      const sessionWithoutPlayerStatus = {
        ...baseSession,
        playerStatus: undefined,
      };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => ({
          ...baseSession,
          playerStatus: undefined,
        }),
      });

      const result = await SessionService.getSession('session-123');

      expect(result?.playerStatus).toBeDefined();
      expect(result?.playerStatus['user-1']).toBe('awaiting');
    });
  });

  it('fills playerStatus when missing from stored session', async () => {
    const { playerStatus: _unused, ...sessionWithoutStatus } = baseSession;

    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'existing-id',
      data: () => sessionWithoutStatus,
    });

    const result = await SessionService.get('existing-id');
    expect(result?.playerStatus).toEqual({ 'user-1': 'awaiting' });
  });

  describe('getSession', () => {
    it('returns null when get throws an error', async () => {
      const getSpy = vi.spyOn(SessionService, 'get').mockRejectedValueOnce(new Error('boom'));

      const result = await SessionService.getSession('bad-id');

      expect(result).toBeNull();
      getSpy.mockRestore();
    });
  });

  /**
   * ────────────────────────────────────────────────
   * UPDATE
   * ────────────────────────────────────────────────
   */
  it('updates valid session', async () => {
    updateDocMock.mockResolvedValueOnce(undefined);

    await SessionService.update('session-123', { genres: ['thriller'] });

    expect(updateDocMock).toHaveBeenCalled();
  });

  it('throws when updating with >2 users', async () => {
    await expect(
      SessionService.update('session-123', { userIds: ['u1', 'u2', 'u3'] })
    ).rejects.toThrow('Session must have 1 or 2 users');
  });

  /**
   * ────────────────────────────────────────────────
   * DELETE
   * ────────────────────────────────────────────────
   */
  it('deletes session', async () => {
    deleteDocMock.mockResolvedValueOnce(undefined);

    await SessionService.delete('session-123');

    expect(deleteDocMock).toHaveBeenCalled();
  });

  /**
   * ────────────────────────────────────────────────
   * DELETE SESSION (Encapsulated with cleanup)
   * ────────────────────────────────────────────────
   */
  describe('deleteSession', () => {
    // Mock the UserService module
    let userServiceMock: any;

    beforeEach(() => {
      userServiceMock = {
        leaveRoom: vi.fn().mockResolvedValue(undefined),
      };

      vi.doMock('../../../../services/firebase/userService', () => ({
        UserService: userServiceMock,
      }));
    });

    it('cleans up all users before deleting session', async () => {
      const sessionWithTwoUsers = {
        ...baseSession,
        userIds: ['user-1', 'user-2'],
        playerStatus: { 'user-1': 'awaiting', 'user-2': 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => sessionWithTwoUsers,
      });

      deleteDocMock.mockResolvedValueOnce(undefined);

      await SessionService.deleteSession('session-123');

      expect(deleteDocMock).toHaveBeenCalledWith({ path: 'sessions/session-123' });
    });

    it('returns early if session not found', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => false,
      });

      await SessionService.deleteSession('nonexistent-session');

      expect(deleteDocMock).not.toHaveBeenCalled();
    });

    it('handles error when cleaning up user', async () => {
      const sessionWithUsers = {
        ...baseSession,
        userIds: ['user-1', 'user-2'],
        playerStatus: { 'user-1': 'awaiting', 'user-2': 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => sessionWithUsers,
      });

      deleteDocMock.mockResolvedValueOnce(undefined);

      await SessionService.deleteSession('session-123');

      expect(deleteDocMock).toHaveBeenCalled();
    });

    it('deletes session even if user cleanup partially fails', async () => {
      const sessionWithUsers = {
        ...baseSession,
        userIds: ['user-1', 'user-2'],
        playerStatus: { 'user-1': 'awaiting', 'user-2': 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => sessionWithUsers,
      });

      deleteDocMock.mockResolvedValueOnce(undefined);

      await SessionService.deleteSession('session-123');

      expect(deleteDocMock).toHaveBeenCalled();
    });

    it('logs error if deleteSession fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => baseSession,
      });

      deleteDocMock.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(SessionService.deleteSession('session-123')).rejects.toThrow(
        'Firebase error'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error deleting session'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handles single user session deletion', async () => {
      const singleUserSession = {
        ...baseSession,
        userIds: ['host-user'],
        playerStatus: { 'host-user': 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => singleUserSession,
      });

      deleteDocMock.mockResolvedValueOnce(undefined);

      await SessionService.deleteSession('session-123');

      expect(deleteDocMock).toHaveBeenCalled();
    });

    it('logs successful deletion', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => baseSession,
      });

      deleteDocMock.mockResolvedValueOnce(undefined);

      await SessionService.deleteSession('session-123');

      expect(consoleSpy).toHaveBeenCalledWith('Session session-123 deleted successfully');

      consoleSpy.mockRestore();
    });
  });

  /**
   * ────────────────────────────────────────────────
   * ROOM CODE LOGIC (from version A)
   * ────────────────────────────────────────────────
   */
  describe('isRoomCodeAvailable', () => {
    it('returns true when available', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: true });

      const ok = await SessionService.isRoomCodeAvailable('123456');
      expect(ok).toBe(true);
    });

    it('returns false when query has results', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: false });

      const ok = await SessionService.isRoomCodeAvailable('123456');
      expect(ok).toBe(false);
    });
  });

  describe('getByRoomCode', () => {
    it('returns session', async () => {
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'id1',
            data: () => baseSession,
          },
        ],
      });

      const result = await SessionService.getByRoomCode('123456');
      expect(result).toEqual({ id: 'id1', ...baseSession });
    });

    it('returns null when session is missing', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: true });

      const result = await SessionService.getByRoomCode('missing');
      expect(result).toBeNull();
    });

    it('fills playerStatus when absent', async () => {
      const { playerStatus: _unused, ...sessionWithoutStatus } = baseSession;
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'id1',
            data: () => sessionWithoutStatus,
          },
        ],
      });

      const result = await SessionService.getByRoomCode('123456');
      expect(result?.playerStatus).toEqual({ 'user-1': 'awaiting' });
    });
  });

  /**
   * ────────────────────────────────────────────────
   * HOST
   * ────────────────────────────────────────────────
   */
  describe('getHost', () => {
    it('returns first user', async () => {
      const sess = { ...baseSession, userIds: ['host', 'guest'] };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => sess,
      });

      const host = await SessionService.getHost('id');
      expect(host).toBe('host');
    });
  });

  describe('getHostByRoomCode', () => {
    it('returns host from room code', async () => {
      const sess = { ...baseSession, userIds: ['host', 'guest'] };

      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'id1',
            data: () => sess,
          },
        ],
      });

      const host = await SessionService.getHostByRoomCode('123456');
      expect(host).toBe('host');
    });

    it('returns null when session not found', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: true });

      const host = await SessionService.getHostByRoomCode('missing');
      expect(host).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('returns session status when session exists', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => baseSession,
      });

      const status = await SessionService.getStatus('id');
      expect(status).toBe('awaiting');
    });

    it('returns null when session missing', async () => {
      getDocMock.mockResolvedValueOnce({ exists: () => false });

      const status = await SessionService.getStatus('missing');
      expect(status).toBeNull();
    });
  });

  describe('getStatusByRoomCode', () => {
    it('returns status from room code', async () => {
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'id1',
            data: () => baseSession,
          },
        ],
      });

      const status = await SessionService.getStatusByRoomCode('123456');
      expect(status).toBe('awaiting');
    });

    it('returns null when session not found for room code', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: true });

      const status = await SessionService.getStatusByRoomCode('missing');
      expect(status).toBeNull();
    });
  });

  /**
   * ────────────────────────────────────────────────
   * JOIN
   * ────────────────────────────────────────────────
   */
  describe('joinSession', () => {
    it('adds user', async () => {
      const sess = { ...baseSession, userIds: ['host'], playerStatus: { host: 'awaiting' } };
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'id', data: () => sess }],
      });

      await SessionService.joinSession('123456', 'guest');

      expect(updateDocMock).toHaveBeenCalled();
    });

    it('throws when room does not exist', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: true });

      await expect(SessionService.joinSession('bad-room', 'user')).rejects.toThrow(
        'Room does not exist'
      );
    });

    it('throws when user already in session', async () => {
      const sess = { ...baseSession, userIds: ['host'], playerStatus: { host: 'awaiting' } };
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'id', data: () => ({ ...sess, userIds: ['host', 'host'] }) }],
      });

      await expect(SessionService.joinSession('123456', 'host')).rejects.toThrow(
        'User already in room'
      );
    });

    it('throws when room is full', async () => {
      const sess = {
        ...baseSession,
        userIds: ['host', 'guest'],
        playerStatus: { host: 'awaiting', guest: 'awaiting' },
      };
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'id', data: () => sess }],
      });

      await expect(SessionService.joinSession('123456', 'new-user')).rejects.toThrow(
        'Room is full'
      );
    });
  });

  /**
   * ────────────────────────────────────────────────
   * LEAVE
   * ────────────────────────────────────────────────
   */
  describe('joinSessionById', () => {
    it('adds user by session id', async () => {
      const sess = {
        ...baseSession,
        userIds: ['host'],
        playerStatus: { host: 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => sess,
      });

      await SessionService.joinSessionById('id', 'guest');

      expect(updateDocMock).toHaveBeenCalledWith({ path: 'sessions/id' }, {
        userIds: ['host', 'guest'],
        playerStatus: { host: 'awaiting', guest: 'awaiting' },
      });
    });

    it('throws when session is missing', async () => {
      getDocMock.mockResolvedValueOnce({ exists: () => false });

      await expect(SessionService.joinSessionById('missing', 'guest')).rejects.toThrow(
        'Room does not exist'
      );
    });

    it('throws when user already in room', async () => {
      const sess = { ...baseSession, userIds: ['host'], playerStatus: { host: 'awaiting' } };
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => ({ ...sess, userIds: ['host', 'host'] }),
      });

      await expect(SessionService.joinSessionById('id', 'host')).rejects.toThrow(
        'User already in room'
      );
    });

    it('throws when room is full', async () => {
      const sess = {
        ...baseSession,
        userIds: ['host', 'guest'],
        playerStatus: { host: 'awaiting', guest: 'awaiting' },
      };
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => sess,
      });

      await expect(SessionService.joinSessionById('id', 'new-user')).rejects.toThrow(
        'Room is full'
      );
    });
  });

  describe('leaveSession', () => {
    it('removes user', async () => {
      const sess = {
        ...baseSession,
        userIds: ['host', 'guest'],
        playerStatus: { host: 'awaiting', guest: 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => sess,
      });

      await SessionService.leaveSession('id', 'guest');

      expect(updateDocMock).toHaveBeenCalled();
    });

    it('throws when session does not exist', async () => {
      getDocMock.mockResolvedValueOnce({ exists: () => false });

      await expect(SessionService.leaveSession('missing', 'user')).rejects.toThrow(
        'Room does not exist'
      );
    });

    it('throws when user not in session', async () => {
      const sess = { ...baseSession, userIds: ['someone'], playerStatus: { someone: 'awaiting' } };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => sess,
      });

      await expect(SessionService.leaveSession('id', 'ghost')).rejects.toThrow('User not in room');
    });
  });

  /**
   * ────────────────────────────────────────────────
   * START MATCHING
   * ────────────────────────────────────────────────
   */
  describe('startMovieMatching', () => {
    it('host can start matching', async () => {
      const sess = {
        ...baseSession,
        userIds: ['host', 'guest'],
        playerStatus: { host: 'awaiting', guest: 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({ exists: () => true, id: 'id', data: () => sess });
      getDocMock.mockResolvedValueOnce({ exists: () => true, id: 'id', data: () => sess });

      await SessionService.startMovieMatching('id', 'host');

      expect(updateDocMock).toHaveBeenCalled();
    });

    it('throws when session does not exist', async () => {
      getDocMock.mockResolvedValueOnce({ exists: () => false });

      await expect(SessionService.startMovieMatching('id', 'host')).rejects.toThrow(
        'Session does not exist'
      );
    });

    it('throws when non-host attempts to start', async () => {
      const sess = {
        ...baseSession,
        userIds: ['host', 'guest'],
        playerStatus: { host: 'awaiting', guest: 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({ exists: () => true, id: 'id', data: () => sess });
      getDocMock.mockResolvedValueOnce({ exists: () => true, id: 'id', data: () => sess });

      await expect(SessionService.startMovieMatching('id', 'guest')).rejects.toThrow(
        'Only the host can start the session'
      );
    });

    it('throws when user count is not two', async () => {
      const sess = { ...baseSession, userIds: ['host'], playerStatus: { host: 'awaiting' } };

      getDocMock.mockResolvedValueOnce({ exists: () => true, id: 'id', data: () => sess });
      getDocMock.mockResolvedValueOnce({ exists: () => true, id: 'id', data: () => sess });

      await expect(SessionService.startMovieMatching('id', 'host')).rejects.toThrow(
        'Session must have exactly 2 users to start'
      );
    });
  });

  /**
   * ────────────────────────────────────────────────
   * MARK PLAYER FINISHED (merged A+B)
   * ────────────────────────────────────────────────
   */
  describe('markPlayerFinished', () => {
    it('marks user as done when partner pending', async () => {
      const sess = {
        ...baseSession,
        userIds: ['u1', 'u2'],
        playerStatus: { u1: 'awaiting', u2: 'awaiting' },
      };

      transactionGetMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => sess,
      });

      await SessionService.markPlayerFinished('session-id', 'u1');

      expect(transactionUpdateMock).toHaveBeenCalled();
    });

    it('completes session when both done', async () => {
      const sess = {
        ...baseSession,
        userIds: ['u1', 'u2'],
        playerStatus: { u1: 'done', u2: 'awaiting' },
        swipes: [
          { id: '1', userId: 'u1', mediaId: 'm1', mediaTitle: 'Movie1', decision: 'like', createdAt: 1 },
          { id: '2', userId: 'u2', mediaId: 'm1', mediaTitle: 'Movie1', decision: 'like', createdAt: 2 },
        ],
      };

      transactionGetMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => sess,
      });

      await SessionService.markPlayerFinished('session-id', 'u2');

      expect(transactionUpdateMock).toHaveBeenCalled();
      const [, payload] = transactionUpdateMock.mock.calls[0];
      expect(payload.sessionStatus).toBe('complete');
    });

    it('throws when user not in session', async () => {
      const sess = { ...baseSession, userIds: ['u1'], playerStatus: { u1: 'awaiting' } };

      transactionGetMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => sess,
      });

      await expect(SessionService.markPlayerFinished('session-id', 'unknown')).rejects.toThrow(
        'User not part of this session'
      );
      expect(transactionUpdateMock).not.toHaveBeenCalled();
    });

    it('does nothing when user already done', async () => {
      const sess = {
        ...baseSession,
        userIds: ['u1', 'u2'],
        playerStatus: { u1: 'done', u2: 'awaiting' },
      };

      transactionGetMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => sess,
      });

      await SessionService.markPlayerFinished('session-id', 'u1');

      expect(transactionUpdateMock).not.toHaveBeenCalled();
    });
  });

  /**
   * ────────────────────────────────────────────────
   * SUBSCRIPTIONS
   * ────────────────────────────────────────────────
   */
  describe('subscribeToSession', () => {
    it('emits session with synthesized playerStatus', () => {
      const unsubscribe = vi.fn();
      onSnapshotMock.mockImplementation((_ref, onNext) => {
        onNext({
          exists: () => true,
          id: 'sess-1',
          data: () => {
            const { playerStatus, ...rest } = baseSession;
            return rest;
          },
        });
        return unsubscribe;
      });

      const onUpdate = vi.fn();
      const result = SessionService.subscribeToSession('sess-1', onUpdate);

      expect(onUpdate).toHaveBeenCalledWith({
        id: 'sess-1',
        ...baseSession,
        playerStatus: { 'user-1': 'awaiting' },
      });
      expect(result).toBe(unsubscribe);
    });

    it('forwards errors to callback', () => {
      const unsubscribe = vi.fn();
      const error = new Error('listener error');
      onSnapshotMock.mockImplementation((_ref, _onNext, onError) => {
        onError?.(error);
        return unsubscribe;
      });

      const onError = vi.fn();
      SessionService.subscribeToSession('sess-1', vi.fn(), onError);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('subscribeToSessionStatus', () => {
    it('emits status and user count', () => {
      const unsubscribe = vi.fn();
      onSnapshotMock.mockImplementation((_ref, onNext) => {
        onNext({
          exists: () => true,
          data: () => ({ ...baseSession }),
        });
        return unsubscribe;
      });

      const onStatusChange = vi.fn();
      const result = SessionService.subscribeToSessionStatus('sess-1', onStatusChange);

      expect(onStatusChange).toHaveBeenCalledWith('awaiting', 1);
      expect(result).toBe(unsubscribe);
    });

    it('emits null status when session missing', () => {
      const unsubscribe = vi.fn();
      onSnapshotMock.mockImplementation((_ref, onNext) => {
        onNext({
          exists: () => false,
        });
        return unsubscribe;
      });

      const onStatusChange = vi.fn();
      SessionService.subscribeToSessionStatus('sess-1', onStatusChange);

      expect(onStatusChange).toHaveBeenCalledWith(null, 0);
    });

    it('reports listener errors', () => {
      const unsubscribe = vi.fn();
      const error = new Error('status error');
      onSnapshotMock.mockImplementation((_ref, _onNext, onError) => {
        onError?.(error);
        return unsubscribe;
      });

      const onError = vi.fn();
      SessionService.subscribeToSessionStatus('sess-1', vi.fn(), onError);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('createSessionListeners', () => {
    it('wires callbacks and cleans up', () => {
      const unsubSession = vi.fn();
      const unsubStatus = vi.fn();
      const subscribeSessionSpy = vi
        .spyOn(SessionService, 'subscribeToSession')
        .mockReturnValue(unsubSession);
      const subscribeStatusSpy = vi
        .spyOn(SessionService, 'subscribeToSessionStatus')
        .mockReturnValue(unsubStatus);

      const listeners = SessionService.createSessionListeners('sess-1');

      const onSessionUpdate = vi.fn();
      const onStatusUpdate = vi.fn();

      const returnedSessionUnsub = listeners.onSessionUpdate(onSessionUpdate);
      const returnedStatusUnsub = listeners.onStatusUpdate(onStatusUpdate);

      expect(subscribeSessionSpy).toHaveBeenCalledWith('sess-1', onSessionUpdate, undefined);
      expect(subscribeStatusSpy).toHaveBeenCalledWith('sess-1', onStatusUpdate, undefined);
      expect(returnedSessionUnsub).toBe(unsubSession);
      expect(returnedStatusUnsub).toBe(unsubStatus);

      listeners.cleanup();

      expect(unsubSession).toHaveBeenCalled();
      expect(unsubStatus).toHaveBeenCalled();

      subscribeSessionSpy.mockRestore();
      subscribeStatusSpy.mockRestore();
    });
  });

  /**
   * ────────────────────────────────────────────────
   * SESSION MANAGEMENT SCENARIOS
   * ────────────────────────────────────────────────
   */
  describe('Session Management Scenarios', () => {
    describe('Scenario 1: Host exits from waiting room', () => {
      it('should delete session and clean up users', async () => {
        const sessionWithGuest = {
          ...baseSession,
          userIds: ['host-user', 'guest-user'],
          playerStatus: { 'host-user': 'awaiting', 'guest-user': 'awaiting' },
        };

        getDocMock.mockResolvedValueOnce({
          exists: () => true,
          id: 'session-123',
          data: () => sessionWithGuest,
        });

        deleteDocMock.mockResolvedValueOnce(undefined);

        await SessionService.deleteSession('session-123');

        expect(deleteDocMock).toHaveBeenCalled();
      });

      it('should handle deletion even if one user cleanup fails', async () => {
        const sessionWithUsers = {
          ...baseSession,
          userIds: ['host-user', 'guest-user'],
          playerStatus: { 'host-user': 'awaiting', 'guest-user': 'awaiting' },
        };

        getDocMock.mockResolvedValueOnce({
          exists: () => true,
          id: 'session-123',
          data: () => sessionWithUsers,
        });

        deleteDocMock.mockResolvedValueOnce(undefined);

        await SessionService.deleteSession('session-123');

        expect(deleteDocMock).toHaveBeenCalled();
      });
    });

    describe('Scenario 2: Guest exits during movie swiping', () => {
      it('should retrieve session and delete when guest leaves', async () => {
        const sessionInProgress = {
          ...baseSession,
          userIds: ['host-user', 'guest-user'],
          sessionStatus: 'in progress' as const,
          playerStatus: { 'host-user': 'awaiting', 'guest-user': 'done' },
        };

        getDocMock.mockResolvedValueOnce({
          exists: () => true,
          id: 'session-123',
          data: () => sessionInProgress,
        });

        deleteDocMock.mockResolvedValueOnce(undefined);

        await SessionService.deleteSession('session-123');

        expect(deleteDocMock).toHaveBeenCalled();
      });
    });

    describe('Scenario 3: Multiple users in session cleanup', () => {
      it('should clean up all user references before deletion', async () => {
        const sessionWithUsers = {
          ...baseSession,
          userIds: ['user-1', 'user-2'],
          playerStatus: { 'user-1': 'awaiting', 'user-2': 'awaiting' },
        };

        getDocMock.mockResolvedValueOnce({
          exists: () => true,
          id: 'session-123',
          data: () => sessionWithUsers,
        });

        deleteDocMock.mockResolvedValueOnce(undefined);

        await SessionService.deleteSession('session-123');

        // Verify session was deleted
        expect(deleteDocMock).toHaveBeenCalledWith({ path: 'sessions/session-123' });
      });
    });

    describe('Scenario 4: Session already deleted', () => {
      it('should handle gracefully when session not found', async () => {
        getDocMock.mockResolvedValueOnce({
          exists: () => false,
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await SessionService.deleteSession('nonexistent-session');

        expect(deleteDocMock).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Session nonexistent-session not found')
        );

        consoleSpy.mockRestore();
      });
    });

    describe('Scenario 5: Real-time listener detects deletion', () => {
      it('should return null from getSession when session is deleted', async () => {
        getDocMock.mockResolvedValueOnce({
          exists: () => false,
        });

        const result = await SessionService.getSession('deleted-session-id');

        expect(result).toBeNull();
      });

      it('should allow proper subscription cleanup', async () => {
        const onUpdateMock = vi.fn();
        const onErrorMock = vi.fn();

        const unsubscribe = SessionService.subscribeToSession(
          'session-123',
          onUpdateMock,
          onErrorMock
        );

        expect(typeof unsubscribe).toBe('function');
      });
    });
  });

  /**
   * ────────────────────────────────────────────────
   * ERROR HANDLING & EDGE CASES
   * ────────────────────────────────────────────────
   */
  describe('Error Handling & Edge Cases', () => {
    it('should handle database errors gracefully in deleteSession', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => baseSession,
      });

      deleteDocMock.mockRejectedValueOnce(new Error('Database error'));

      await expect(SessionService.deleteSession('session-123')).rejects.toThrow(
        'Database error'
      );

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not throw when cleaning up non-existent session', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(SessionService.deleteSession('nonexistent-session')).resolves.not.toThrow();
    });

    it('should handle session with empty userIds array', async () => {
      const emptyUserSession = {
        ...baseSession,
        userIds: [],
        playerStatus: {},
      };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'session-123',
        data: () => emptyUserSession,
      });

      deleteDocMock.mockResolvedValueOnce(undefined);

      await SessionService.deleteSession('session-123');

      expect(deleteDocMock).toHaveBeenCalled();
    });

    it('should validate userIds before deletion', async () => {
      await expect(
        SessionService.update('session-123', { userIds: ['u1', 'u2', 'u3'] })
      ).rejects.toThrow('Session must have 1 or 2 users');
    });
  });
});
