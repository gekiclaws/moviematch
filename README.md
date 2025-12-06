# moviematch

## Env setup

In the `app` folder, copy `.env.sample`, rename it to `.env`, then insert your `MOVIE_API_KEY`.

## Expo frontend setup

1. Install Node.js 18 LTS or newer. The Expo CLI is bundled with the project, so no global install is required.
2. Install dependencies from the project root:

   ```bash
   cd app
   npm install
   ```

3. Copy `app/.env.sample` to `app/.env` and set `MOVIE_API_KEY` to your RapidAPI Streaming Availability key. Restart Expo whenever you edit this file so the new value is bundled.

4. Launch the Metro bundler:

   ```bash
   npm run start
   ```

   Expo Dev Tools will open in your browser so you can pick where to run the app:

   - `npm run ios` to open the iOS simulator (requires Xcode).
   - `npm run android` to open an Android emulator (requires Android Studio).
   - `npm run web` to run the web build in your browser.
   - Or scan the QR code with the Expo Go app on a physical device.

5. When you are done, stop the bundler with `Ctrl+C`.

## Running tests

1. From the project root, move into the Expo app workspace:

   ```bash
   cd app
   ```

2. Execute the Vitest test suite:

   ```bash
   npm run test
   ```

   To target a specific test file, pass a path to the underlying Vitest CLI. For example:

   ```bash
   npm run test -- --run src/services/firebase/sessionService.test.ts
   ```

3. Once all tests are passing, check coverage:
   ```
   npx vitest --coverage
   ```

   Ensure your service has 90%+ statement coverage before submitting a PR.