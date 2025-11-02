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
  userIds: ['user-1', 'user-2'] as [string, string],
  movieType: ['movie'],
  genres: ['action'],
  streamingServices: ['netflix'],
  favoriteTitles: ['title-1'],
  swipes: [],
  createdAt: 1234567890,
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

  it('creates a session when exactly two users are provided', async () => {
    addDocMock.mockResolvedValueOnce({ id: 'new-session-id' });

    const id = await SessionService.create(baseSession);

    expect(addDocMock).toHaveBeenCalledWith('sessionsCollection', baseSession);
    expect(id).toBe('new-session-id');
  });

  it('throws when creating a session without two users', async () => {
    const invalidSession = { ...baseSession, userIds: ['only-one-user'] as unknown as [string, string] };

    await expect(SessionService.create(invalidSession)).rejects.toThrow('Session must have exactly 2 users');
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('returns the stored session when found', async () => {
    const storedSession: Omit<Session, 'id'> = {
      ...baseSession,
      genres: ['comedy'],
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
        userIds: ['user-1'] as unknown as [string, string],
      })
    ).rejects.toThrow('Session must have exactly 2 users');

    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('removes a session by id', async () => {
    deleteDocMock.mockResolvedValueOnce(undefined);

    await SessionService.remove('session-123');

    expect(docMock).toHaveBeenCalledWith(fakeDb, 'sessions', 'session-123');
    expect(deleteDocMock).toHaveBeenCalledWith({ path: 'sessions/session-123' });
  });
});
