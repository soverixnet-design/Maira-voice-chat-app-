# Release acceptance checklist

This is a deployment checklist, not a claim that external tests have passed.

- [ ] Deploy to a dedicated Firebase test project and connect LiveKit.
- [ ] Register two users; verify login persistence, password reset and logout isolation.
- [ ] Verify non-admin cannot query other users/wallets, reports or withdrawal details.
- [ ] Verify no client can mutate wallets, admin claims, gifts, salary or membership directly.
- [ ] Verify admin panel sign-in and bootstrap.
- [ ] Two physical devices: join room, request mic, approve, talk, mute, demote, kick, leave and close.
- [ ] Test iOS audio interruptions, Bluetooth and background audio; Android microphone permissions.
- [ ] Test concurrent gifts and insufficient funds; reuse request UUID and confirm no double debit.
- [ ] Replay a payment reference and confirm no double credit.
- [ ] Approve a completed-day salary twice and confirm one credit; reject a second withdrawal refund.
- [ ] Verify paid withdrawals only follow independently confirmed transfers.
- [ ] Add App Check, user/IP abuse controls, monitoring and provider quotas.
- [ ] Validate token expiry/replay and implement stronger session revocation if required.
- [ ] Verify persisted request-ID recovery after network loss and app restart.
- [ ] Add server-side membership cleanup and room expiry using verified LiveKit events.
- [ ] Add account deletion, privacy policy, retention rules and store disclosures.
- [ ] Integrate and validate store billing/payment providers before selling coins publicly.
- [ ] Add payout provider/KYC/financial review before handling public cash-out traffic.
- [ ] Decide agency commission, host attendance rules and fraud review policy.
- [ ] Add pagination beyond the initial query caps.
- [ ] Sign Android/iOS builds with owner credentials and complete store review.

Consult the current official provider documentation when configuring services:
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.livekit.io/transport/sdk-platforms/expo/
- https://firebase.google.com/docs/functions/callable
- https://firebase.google.com/docs/app-check
