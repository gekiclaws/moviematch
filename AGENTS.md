## Testing instructions

1. From the project root, move into the Expo app workspace:
```bash
cd app
```

2a. To run all tests, use the following command:
```bash
npm run test
```

2b. To run focused tests for a specific file:
```bash
cd app
npm run test -- --run src/services/firebase/sessionService.test.ts
```