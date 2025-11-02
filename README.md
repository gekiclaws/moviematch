# moviematch

## Expo frontend setup

1. Install Node.js 18 LTS or newer. The Expo CLI is bundled with the project, so no global install is required.
2. Install dependencies from the project root:

   ```bash
   cd app
   npm install
   ```

3. Launch the Metro bundler:

   ```bash
   npm run start
   ```

   Expo Dev Tools will open in your browser so you can pick where to run the app:

   - `npm run ios` to open the iOS simulator (requires Xcode).
   - `npm run android` to open an Android emulator (requires Android Studio).
   - `npm run web` to run the web build in your browser.
   - Or scan the QR code with the Expo Go app on a physical device.

4. When you are done, stop the bundler with `Ctrl+C`.
