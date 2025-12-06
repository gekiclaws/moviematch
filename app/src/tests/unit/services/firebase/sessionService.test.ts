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

    transactionGetMock.mockReset();
    transactionUpdateMock.mockReset();
    runTransactionMock.mockReset();
    runTransactionMock.mockImplementation(async (_db, updater) =>
      updater({
        get: transactionGetMock,
        update: transactionUpdateMock,
      })
    );
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
   * GET
   * ────────────────────────────────────────────────
   */
  it('returns null when get finds no session', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false });

    const result = await SessionService.get('missing-id');
    expect(result).toBeNull();
  });

  it('returns stored session', async () => {
    const storedSession = { ...baseSession, genres: ['comedy'] };

    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'existing-id',
      data: () => storedSession,
    });

    const result = await SessionService.get('existing-id');
    expect(result).toEqual({ id: 'existing-id', ...storedSession });
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
   * ROOM CODE LOGIC (from version A)
   * ────────────────────────────────────────────────
   */
  describe('isRoomCodeAvailable', () => {
    it('returns true when available', async () => {
      getDocsMock.mockResolvedValueOnce({ empty: true });

      const ok = await SessionService.isRoomCodeAvailable('123456');
      expect(ok).toBe(true);
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

  /**
   * ────────────────────────────────────────────────
   * JOIN
   * ────────────────────────────────────────────────
   */
  describe('joinSession', () => {
    it('adds user', async () => {
      const sess = { ...baseSession, userIds: ['host'], playerStatus: { host: 'awaiting' } };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => sess,
      });

      await SessionService.joinSession('id', 'guest');

      expect(updateDocMock).toHaveBeenCalled();
    });
  });

  /**
   * ────────────────────────────────────────────────
   * LEAVE
   * ────────────────────────────────────────────────
   */
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
  });
});