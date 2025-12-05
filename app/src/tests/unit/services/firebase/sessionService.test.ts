import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../../../../types/session';

const {
  addDocMock,
  collectionMock,
  deleteDocMock,
  docMock,
  getDocMock,
  runTransactionMock,
  transactionGetMock,
  transactionUpdateMock,
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
    runTransactionMock: vi.fn(),
    transactionGetMock: vi.fn(),
    transactionUpdateMock: vi.fn(),
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
  runTransaction: runTransactionMock,
  updateDoc: updateDocMock,
}));

vi.mock('../../../../services/firebase/index', () => ({
  db: fakeDb,
}));

import { SessionService } from '../../../../services/firebase/sessionService';

const baseSession: Omit<Session, 'id'> = {
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
    runTransactionMock.mockReset();
    transactionGetMock.mockReset();
    transactionUpdateMock.mockReset();
    runTransactionMock.mockImplementation(async (_db, updater) =>
      updater({
        get: transactionGetMock,
        update: transactionUpdateMock,
      })
    );
    updateDocMock.mockReset();
  });

  //
  // ────────────────────────────────────────────────
  // CREATE
  // ────────────────────────────────────────────────
  //
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
      playerStatus: { 'host-user': 'awaiting' },
    });

    expect(id).toBe('new-session-id');
  });

  it('returns null when get finds no session', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false });

    const result = await SessionService.get('missing-id');
    expect(result).toBeNull();
  });

  it('returns a session when it exists', async () => {
    const storedSession = { ...baseSession, genres: ['comedy'] };

    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'existing-id',
      data: () => storedSession,
    });

    const result = await SessionService.get('existing-id');

    expect(result).toEqual({ id: 'existing-id', ...storedSession });
  });

  //
  // ────────────────────────────────────────────────
  // UPDATE / DELETE
  // ────────────────────────────────────────────────
  //

  it('updates a session with valid data', async () => {
    await SessionService.update('session-123', { genres: ['thriller'] });

    expect(updateDocMock).toHaveBeenCalledWith(
      { path: 'sessions/session-123' },
      { genres: ['thriller'] }
    );
  });

  it('throws when updating with > 2 users', async () => {
    await expect(
      SessionService.update('session-123', {
        userIds: ['u1', 'u2', 'u3'],
      })
    ).rejects.toThrow('Session must have 1 or 2 users');
  });

  it('deletes a session', async () => {
    await SessionService.delete('session-123');

    expect(deleteDocMock).toHaveBeenCalledWith({ path: 'sessions/session-123' });
  });

  //
  // ────────────────────────────────────────────────
  // HOST & JOIN / LEAVE
  // ────────────────────────────────────────────────
  //

  describe('getHost', () => {
    it('returns host when session exists', async () => {
      const sess = { ...baseSession, userIds: ['host', 'guest'] };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => sess,
      });

      const result = await SessionService.getHost('id');
      expect(result).toBe('host');
    });

    it('returns null when no users', async () => {
      const sess = { ...baseSession, userIds: [] };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => sess,
      });

      const result = await SessionService.getHost('id');
      expect(result).toBeNull();
    });
  });

  describe('joinSession', () => {
    it('adds user to session', async () => {
      const sess = { ...baseSession, userIds: ['host'], playerStatus: { host: 'awaiting' } };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => sess,
      });

      await SessionService.joinSession('id', 'guest');

      expect(updateDocMock).toHaveBeenCalledWith(
        { path: 'sessions/id' },
        {
          userIds: ['host', 'guest'],
          playerStatus: { host: 'awaiting', guest: 'awaiting' },
        }
      );
    });

    it('errors on full session', async () => {
      const sess = { ...baseSession, userIds: ['host', 'guest'] };

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        id: 'id',
        data: () => sess,
      });

      await expect(SessionService.joinSession('id', 'user3')).rejects.toThrow('Room is full');
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

      expect(updateDocMock).toHaveBeenCalledWith(
        { path: 'sessions/id' },
        {
          userIds: ['host'],
          playerStatus: { host: 'awaiting' },
        }
      );
    });
  });

  //
  // ────────────────────────────────────────────────
  // START MATCHING (permission logic only)
  // ────────────────────────────────────────────────
  //

  describe('startMovieMatching', () => {
    it('starts session when host + 2 users', async () => {
      const sess = {
        ...baseSession,
        userIds: ['host', 'guest'],
        playerStatus: { host: 'awaiting', guest: 'awaiting' },
      };

      getDocMock.mockResolvedValueOnce({ exists: () => true, id: 'id', data: () => sess });
      getDocMock.mockResolvedValueOnce({ exists: () => true, id: 'id', data: () => sess });

      await SessionService.startMovieMatching('id', 'host');

      expect(updateDocMock).toHaveBeenCalledWith(
        { path: 'sessions/id' },
        {
          sessionStatus: 'in progress',
          playerStatus: { host: 'awaiting', guest: 'awaiting' },
        }
      );
    });

    it('rejects non-host', async () => {
      const sess = { ...baseSession, userIds: ['host', 'guest'] };

      getDocMock.mockResolvedValueOnce({ exists: () => true, id: 'id', data: () => sess });
      getDocMock.mockResolvedValueOnce({ exists: () => true, id: 'id', data: () => sess });

      await expect(
        SessionService.startMovieMatching('id', 'guest')
      ).rejects.toThrow('Only the host can start the session');
    });
  });

  //
  // ────────────────────────────────────────────────
  // markPlayerFinished — trimmed down (state only)
  // ────────────────────────────────────────────────
  //

  describe('markPlayerFinished', () => {
    it('marks user as done but does not complete session if other user pending', async () => {
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

      expect(transactionUpdateMock).toHaveBeenCalledWith(
        { path: 'sessions/session-id' },
        { 'playerStatus.u1': 'done' }
      );
    });

    it('completes session when both users done (does not inspect matches)', async () => {
      const sess = {
        ...baseSession,
        userIds: ['u1', 'u2'],
        playerStatus: { u1: 'done', u2: 'awaiting' },
        swipes: [], // details irrelevant to this test
      };

      transactionGetMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => sess,
      });

      await SessionService.markPlayerFinished('session-id', 'u2');

      expect(transactionUpdateMock).toHaveBeenCalled();
      const [, payload] = transactionUpdateMock.mock.calls[0];

      expect(payload.sessionStatus).toBe('complete');
      expect(payload.matchingAlgorithmVersion).toBe(2);
    });
  });
});
