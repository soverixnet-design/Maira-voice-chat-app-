# Maira Voice Chat

React Native + Expo mobile app for Android/iOS, Firebase backend, LiveKit voice rooms, and a React web admin panel. Created for **shakil**.

## Included

- Email/password registration, persistent login and password reset.
- Live audio rooms with listener/speaker roles, eight speaker seats, mic requests, host moderation, room chat and reporting.
- Server-authorized gifts, coin wallets, diamond earnings and transaction records.
- Bangladesh agencies, host applications and admin approval.
- Configurable daily salary based on received diamonds per Asia/Dhaka day; explicit admin approval and once-per-day crediting.
- Withdrawal requests with reserved balances, manual payout verification and one-time refund on rejection.
- Admin controls for users, rooms, gifts, coins, agencies, salary, withdrawals and reports.
- Firestore rules deny all client mutations; backend verifies auth and admin claims.

## Run

Requires Node 22+, npm, a Firebase project, and LiveKit credentials.

```sh
npm ci
cp apps/mobile/.env.example apps/mobile/.env
cp apps/admin/.env.example apps/admin/.env
# Fill the public Firebase configuration in those files.
npm test
npm run typecheck
npm run admin
npm run mobile
```

Live voice requires an **Expo development build**, not Expo Go. See [setup and deployment](docs/SETUP.md), [architecture](docs/ARCHITECTURE.md), and [release checklist](docs/RELEASE.md).

## Honest release status

This repository contains the implementation, not a deployed production service or signed store builds. Firebase/LiveKit credentials, first administrator provisioning, provider deployment and device acceptance testing are required. There are no fake connected rooms, users or payments. Without Firebase configuration the apps show setup instructions.

Coin recharge and cash payouts are **manual admin-reviewed operations**. Apple/Google in-app billing, receipt validation, bKash/Nagad payment gateway integration, KYC, automated mic-time payroll, agency commissions and automated payouts are not implemented. Salary is disabled by default until a business rate is configured. Salary is based on received gifts, not client-reported microphone time.

Admin lists are capped at 200 records, mobile lists at 100; production-scale pagination remains follow-up work. See RELEASE.md for security and operational gates.

## Layout

```text
apps/mobile/     Expo native application
apps/admin/      React + Vite administrator application
functions/       Firebase callable backend and tests
scripts/         First administrator provisioning
firestore.rules  Client access policy
```

Public Firebase web configuration is expected in client builds. LiveKit API secrets and Firebase service-account credentials must never be committed.
