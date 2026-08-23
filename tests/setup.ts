// React Native Testing Library v13 registers its matchers automatically;
// no `extend-expect` import is needed.

// Some Expo modules read __DEV__ at import time.
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
