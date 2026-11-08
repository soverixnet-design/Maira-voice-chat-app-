# Setup and deployment

## 1. Firebase

Create your own Firebase project. Enable Authentication → Email/Password, create Firestore, and register a web app to obtain the Firebase client configuration. Copy each `.env.example` into `.env` in its own app directory. Mobile and admin must use the same Firebase project. Choose your Firestore region deliberately before creating it.

Install Firebase CLI and sign in under your own account:

```sh
npm install -g firebase-tools
firebase login
firebase use --add
```

Select your project and give it the default alias. Cloud Functions deployment may require billing; inspect your Firebase account's current requirements before enabling services.

## 2. LiveKit

Create a LiveKit project or deploy your own LiveKit server. Configure backend secrets using the CLI's interactive prompts:

```sh
firebase functions:secrets:set LIVEKIT_API_KEY
firebase functions:secrets:set LIVEKIT_API_SECRET
```

Set `LIVEKIT_URL=wss://YOUR-PROJECT.livekit.cloud` in `functions/.env.YOUR_FIREBASE_PROJECT_ID`. This file is gitignored. Never put API secrets in `EXPO_PUBLIC_` or `VITE_` variables.

Deploy the backend and deny-by-default access rules:

```sh
firebase deploy --only functions,firestore:rules,firestore:indexes,storage
```

The function region is `asia-south1` in both clients and server.

## 3. First administrator

Register an account in the mobile app first. Get that user's Firebase Authentication UID. From a trusted environment with Application Default Credentials for your project:

```sh
cd functions
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT node ../scripts/set-admin.mjs USER_UID
```

The script preserves existing claims and adds `admin: true`. It never grants admin based on email or a client-side flag. Do not commit service-account JSON. Sign out and sign back in after provisioning. Open the admin panel and click **Initialize default gifts & disabled salary settings**. This creates missing defaults without overwriting existing settings.

## 4. Web admin

```sh
npm run admin
# For deployment:
npm run build:admin
firebase deploy --only hosting
```

Only accounts with the admin claim can access the admin data. Register the admin account in the mobile app first so it has a profile and wallet.

## 5. Android and iPhone

From the repository root:

```sh
npm ci
cd apps/mobile
npx expo install --check
npx eas-cli login
npx eas-cli init
npx eas-cli build --profile development --platform android
# On macOS with Xcode, alternatively: npm run ios
# iOS cloud build (Apple developer credentials required):
npx eas-cli build --profile development --platform ios
```

`eas init` links the app to your Expo project. Add the four `EXPO_PUBLIC_FIREBASE_*` variables to the relevant EAS environment as plain public configuration before cloud builds. Local `.env` is not a dependable source for EAS remote configuration. Set `environment` in each build profile to your selected EAS environment when configuring production.

Install the resulting development build, then run `npm run mobile` at the repository root. Do not use Expo Go: LiveKit requires native WebRTC code. Microphone permissions must be accepted. Use two physical devices to test actual audio, Bluetooth routing, interruption and reconnect behavior.

For an Android preview APK:

```sh
cd apps/mobile
npx eas-cli build --profile preview --platform android
```

For store builds use the production profile. Configure unique bundle/package IDs and your signing accounts before release. Uploading code to GitHub does not create or publish an APK/IPA.

## 6. Business configuration

In Admin → Settings set minimum daily diamonds, salary in paisa, minimum withdrawal and whether withdrawals are enabled. One taka is 100 paisa. Defaults intentionally disable salary and withdrawals. Gifts spend coins and credit the same integer count as diamonds. Diamonds are a target metric and are not directly withdrawable or automatically converted to cash.

Create an agency with a registered owner UID. Users apply in the mobile app; admins approve them. After a completed Dhaka day, an admin can approve one salary credit per eligible host. Current rates and current membership apply at approval time; the resulting salary record captures the credited amount. No unattended salary scheduler is deployed.

Coin credit requires a unique independently verified payment reference. Cash withdrawals reserve salary balance immediately. Transfer money outside the app, then enter the actual transfer reference to mark paid. Rejecting a request refunds once. Do not mark paid to initiate a transfer; it is a record of a transfer already made.
