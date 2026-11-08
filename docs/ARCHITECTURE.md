# Architecture and trust boundaries

The native app and admin use Firebase Auth, Firestore listeners and a regional callable function named `api`. All writes use that function. Firestore rules permit only scoped reads and deny client writes, including admin client writes. Admin SDK server access is authorized independently inside the callable.

LiveKit credentials remain in Secret Manager. Five-minute room-specific tokens carry subscriber permissions and microphone-only publishing for server-assigned speakers. Tokens are issued only after checking room state and member bans. The client starts with its microphone off. Host/admin moderation updates both the authoritative Firestore state and the live LiveKit participant. Provider failures are surfaced and need retry; there is no distributed transaction across Firestore and LiveKit.

Room members use periodic heartbeats as UI metadata; they are not authoritative attendance or proof of microphone time. LiveKit participant state is displayed in the audio view. Gift eligibility checks server-managed room membership. Stale membership cleanup, provider event reconciliation and automatic room expiry are follow-up operations work.

## Financial transactions

- Gift: Firestore transaction reads both wallets, room and member records, gift catalogue and idempotency event. It debits coins, credits diamonds, updates Dhaka-day earnings and creates a ledger record together.
- Recharge: admin-only unique payment-reference ledger ID prevents a second credit.
- Salary: unique day/UID document prevents repeat credit; eligibility and wallet update happen inside one transaction.
- Withdrawal: request UUID deduplicates requests; transaction reserves salary balance and creates a pending record. Final review is a one-way state transition. Rejection refunds only from pending state.
- Integer paisa and integer coins avoid fractional currency arithmetic in the database.

An operation request ID must be reused when an external client retries an uncertain gift/withdrawal result. The bundled client persists an unresolved request ID and its original payload in AsyncStorage. Retrying the same details reuses that ID; a different transaction is blocked until the pending result is resolved.

## Collections

`users`, `wallets`, `rooms/{id}/members`, `rooms/{id}/messages`, `gifts`, `agencies`, `agencyApplications`, `ledger`, `daily`, `salaries`, `withdrawals`, `settings`, `reports`, `limits`.

Daily aggregates and rate-limit documents have no client access. User profiles and wallets are visible only to their owner and admins. Reports are admin-readable only; withdrawal account details are visible to the owner and admins. Room membership and chat are readable by signed-in users.

## Deliberate limits

App Check enforcement is not enabled because native attestation has not been provisioned. Enable platform attestation and callable enforcement before public release; do not simply enable enforcement without configuring clients. Authentication and role checks remain enforced regardless.

A previously issued LiveKit bearer token may be usable until expiry. For stronger immediate revocation, use provider-supported token revocation/session controls and verify behavior in acceptance tests. Ban stops new backend actions; it does not by itself disconnect every current LiveKit session. Close affected rooms using the admin control.

The initial admin UI is intentionally small with capped live queries. Add cursor pagination, audit export, monitoring, account deletion workflows and retention policies before large-scale operation.
