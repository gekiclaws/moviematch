declare module 'vitest' {
  export const describe: (...args: any[]) => void;
  export const it: (...args: any[]) => void;
  export const beforeEach: (...args: any[]) => void;
  export const expect: (...args: any[]) => any;
  export const vi: {
    fn: (...args: any[]) => any;
    mock: (...args: any[]) => any;
    clearAllMocks: (...args: any[]) => void;
    resetAllMocks: (...args: any[]) => void;
  };
}
