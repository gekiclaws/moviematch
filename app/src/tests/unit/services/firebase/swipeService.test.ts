import { beforeEach, describe, expect, it, vi } from 'vitest';

const { arrayUnionMock, docMock, updateDocMock } = vi.hoisted(() => ({
  arrayUnionMock: vi.fn((value) => ({ union: value })),
  docMock: vi.fn((_db, _collection, id) => ({ path: `sessions/${id}` })),
  updateDocMock: vi.fn(),
}));

const fakeDb = vi.hoisted(() => ({}));

vi.mock('firebase/firestore', () => ({
  arrayUnion: arrayUnionMock,
  doc: docMock,
  updateDoc: updateDocMock,
}));

vi.mock('../../../../services/firebase/index', () => ({
  db: fakeDb,
}));

import { SwipeService } from '../../../../services/firebase/swipeService';

describe('SwipeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    docMock.mockImplementation((_db, _collection, id) => ({ path: `sessions/${id}` }));
    arrayUnionMock.mockImplementation((value) => ({ union: value }));
    updateDocMock.mockResolvedValue(undefined);
  });

  it('adds swipe with prioritized US streaming services', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const media: any = {
      id: 'm1',
      title: 'Movie',
      poster: 'poster.jpg',
      streamingOptions: [
        { countryCode: 'CA', services: [{ serviceName: 'Crave' }] },
        { countryCode: 'US', services: [{ serviceName: 'Netflix' }, { serviceName: ' ' }] },
      ],
      genres: ['action'],
      releaseYear: 2024,
      runtime: 120,
      rating: 8,
      directors: ['Director'],
      cast: ['Actor'],
    };

    await SwipeService.addSwipeToSession('session-1', 'user-1', media, 'like');

    const swipe = arrayUnionMock.mock.calls[0][0];
    expect(swipe.streamingServices).toEqual(['Netflix']);
    expect(swipe.id).toBe(`user-1_m1_${nowSpy.mock.results[0].value}`);
    expect(updateDocMock).toHaveBeenCalledWith({ path: 'sessions/session-1' }, { swipes: { union: swipe } });

    nowSpy.mockRestore();
  });

  it('omits streaming services when none are provided', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(42);
    const media = {
      id: 'm2',
      title: 'No Stream',
      poster: undefined,
      streamingOptions: [],
      genres: [],
    };

    await SwipeService.addSwipeToSession('session-2', 'user-2', media as any, 'dislike');

    const swipe = arrayUnionMock.mock.calls[0][0];
    expect(swipe.streamingServices).toBeUndefined();
    expect(updateDocMock).toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('throws a wrapped error when update fails', async () => {
    updateDocMock.mockRejectedValueOnce(new Error('network'));

    await expect(
      SwipeService.addSwipeToSession(
        'session-3',
        'user-3',
        { id: 'm3', title: 'Error', poster: '', streamingOptions: [] } as any,
        'like'
      )
    ).rejects.toThrow('Failed to save swipe decision');
  });
});
