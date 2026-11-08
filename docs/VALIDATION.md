# Validation report

Validated on 8 November 2026 in the build workspace.

| Check | Result |
|---|---|
| Dependency installation and lockfile generation | Passed |
| Domain unit tests | 5 passed |
| Firestore emulator integration tests | 12 passed |
| Mobile TypeScript | Passed |
| Admin TypeScript | Passed |
| Admin Vite production build | Passed |
| Firebase backend syntax and module import | Passed |
| Expo package compatibility check | Passed |
| Expo config plugin resolution | Passed |
| Android JavaScript/Hermes export | Passed |
| iOS JavaScript/Hermes export | Passed |
| Signed APK/IPA compilation | Not run: owner Expo/signing setup required |
| Live voice on two physical devices | Not run: Firebase/LiveKit deployment required |
| Browser visual smoke test | Not completed: browser executable was absent; automatic browser download failed with a corrupt/truncated archive |
| Real payment / cash payout | Not implemented; manual verification workflow only |

Integration tests exercised actual Firestore emulator transactions and rules: auth and admin rejection, private wallet reads, denial of client writes even by admins, concurrent duplicate gifts, concurrent overspend, blocked membership, unique payment references, daily salary idempotency and eligibility, withdrawal reservation/refund, paid-state finality, agency approval, and banned users.

Local Node was 24; the Functions deployment target and CI are Node 22. The emulator passed under Java 17; CI specifies Java 21. Metro emitted an upstream `event-target-shim` export fallback warning but completed both platform exports. Vite reported the initial client chunk above 500 kB; bundle optimization remains follow-up work.

Run again:

```sh
npm ci
npm test
npm run test:integration
npm run typecheck
npm run build:admin
cd apps/mobile
npx expo install --check
npx expo export --platform android --platform ios --output-dir /tmp/maira-export
```

Passing bundle exports verifies JavaScript packaging, not native compilation, microphone functionality, app-store approval or a deployed production service.
