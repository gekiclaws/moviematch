import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAppMock, getAppsMock, initializeAppMock, getFirestoreMock } = vi.hoisted(() => ({
  getAppMock: vi.fn(),
  getAppsMock: vi.fn(() => []),
  initializeAppMock: vi.fn(),
  getFirestoreMock: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApp: getAppMock,
  getApps: getAppsMock,
  initializeApp: initializeAppMock,
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: getFirestoreMock,
}));

vi.mock('../../../../config/firebase', () => ({
  default: { projectId: 'test-project' },
}));

describe('firebase/index', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getAppsMock.mockReturnValue([]);
    getAppMock.mockReturnValue('existing-app');
    initializeAppMock.mockReturnValue('initialized-app');
    getFirestoreMock.mockImplementation((app) => ({ dbFrom: app }));
  });

  it('uses existing app when one is already initialized', async () => {
    getAppsMock.mockReturnValue([{ name: 'app-1' }]);

    const { app, db } = await import('../../../../services/firebase/index');

    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(getAppMock).toHaveBeenCalledTimes(1);
    expect(app).toBe('existing-app');
    expect(db).toEqual({ dbFrom: 'existing-app' });
  });

  it('initializes a new app when none exist', async () => {
    getAppsMock.mockReturnValue([]);

    const { app, db } = await import('../../../../services/firebase/index');

    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(getAppMock).not.toHaveBeenCalled();
    expect(app).toBe('initialized-app');
    expect(db).toEqual({ dbFrom: 'initialized-app' });
  });
});
