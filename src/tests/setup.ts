import 'reflect-metadata';

// Suppress noisy console output from email failures and auth errors during tests
const originalConsoleError = console.error;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Failed to send') ||
        args[0].includes('Authentication middleware') ||
        args[0].includes('email'))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => {
  jest.clearAllMocks();
});
