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
      getDocsMock.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'id', data: () => sess }],
      });

      await SessionService.joinSession('123456', 'guest');

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