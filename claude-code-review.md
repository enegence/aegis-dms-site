# Claude Code Review

Reviewed against:

- `docs/superpowers/plans/2026-05-06-aegis-master-plan.md`
- `update.md`
- `docs/superpowers/plans/2026-05-06-aegis-saas-phase1.md`
- `docs/superpowers/plans/2026-05-08-aegis-dms-site-phase2.md`
- `docs/superpowers/plans/2026-05-08-aegis-dms-site-phase3.md` through the tasks marked complete in `update.md` (Tasks 1-10)

Verification run:

- `npm test -- --runInBand`
- Result: contracts + server tests passed, `31` server test files and `312` server tests passing. `npm` warned that `--runInBand` is an unknown npm config, so Vitest still ran normally.

## Findings

### Critical: Hosted packets are encrypted but the packet key is discarded, so claimants cannot decrypt released packets

Phase 3 is supposed to implement the commercial release layer: hosted packet generation, hosted claim API, and key/release material behavior for contacts. Task 10 says server-side release material may be presented after accepted + verified state, with `keyViewedAt` / release-material tracking (`docs/superpowers/plans/2026-05-08-aegis-dms-site-phase3.md:879`).

The implementation encrypts packets with a fresh random AES key, uploads only ciphertext, then explicitly discards the key:

- `server/src/services/hosted-packet-builder.ts:4` says `packetKey` is not persisted.
- `server/src/services/hosted-packet-builder.ts:204` creates `cryptoResult`.
- `server/src/services/hosted-packet-builder.ts:206` says the packet key is intentionally not persisted.
- `server/src/services/hosted-packet-builder.ts:250` uploads only `cryptoResult.encryptedData`.
- `server/src/routes/claim.ts:222` downloads and returns the encrypted bytes.
- `server/src/routes/claim.ts:238` `/key-view` only marks `keyViewedAt`; it does not retrieve or present decryptable release material.

This means the current hosted release flow can deliver an `.aegis.enc` blob, but no surviving key path exists to decrypt it. That is a functional gap in the claimed Phase 3 hosted packet/cascade/claim implementation, not just a future polish item.

### Critical: A claim can acknowledge and complete the release without packet download or key/release-material access, and the switch is not completed

Phase 3 Task 8 says cascade completion requires `accepted`, `packet_downloaded`, `key_viewed or release material delivered`, and `acknowledged` (`docs/superpowers/plans/2026-05-08-aegis-dms-site-phase3.md:753`). Task 10 says acknowledgement completes claim, release run, and switch when required access steps are complete (`docs/superpowers/plans/2026-05-08-aegis-dms-site-phase3.md:889`).

The implementation allows acknowledgement from `accepted` directly:

- `server/src/services/hosted-cascade.ts:153` loads the claim.
- `server/src/services/hosted-cascade.ts:155` permits `accepted`, `packet_downloaded`, or `key_viewed`.
- `server/src/services/hosted-cascade.ts:161` marks the claim `acknowledged`.
- `server/src/services/hosted-cascade.ts:166` marks the release run `completed`.

There is no requirement that the packet was downloaded or that key/release material was viewed/delivered. The implementation also does not update the triggering switch to `completed`; it only updates the claim and release run. The route test reinforces the gap by accepting then acknowledging without packet download or key-view (`server/tests/hosted-claim-routes.test.ts:290`).

### High: Public claim routes are not rate-limited

Phase 3 lists this as a security non-negotiable: public claim routes must be rate-limited and generic on invalid/expired token failures (`docs/superpowers/plans/2026-05-08-aegis-dms-site-phase3.md:71`). Task 10 also specifically requires rate limiting PIN failures (`docs/superpowers/plans/2026-05-08-aegis-dms-site-phase3.md:871`).

I found no rate-limiter plugin, dependency, middleware, in-memory limiter, or persistent attempt tracking for `/api/claim/*`. The claim routes perform direct token lookup and direct PIN comparison:

- `server/src/routes/claim.ts:85` handles token status lookup.
- `server/src/routes/claim.ts:117` handles PIN verification.
- `server/src/routes/claim.ts:135` checks `claimPinHash`.
- `server/src/routes/claim.ts:138` returns `403` for invalid PIN.

This leaves claim-token guessing and PIN brute force unthrottled. Generic invalid-token responses are present, but the rate-limit requirement is not implemented.

### High: The implemented claim notification URL points to `/claim/:token`, but that route is missing

Phase 3 Task 10 explicitly requires both `GET /claim/:token` and `GET /api/claim/:token` (`docs/superpowers/plans/2026-05-08-aegis-dms-site-phase3.md:852`). The route plugin only registers `/api/claim/:token` and other `/api/claim/*` routes (`server/src/routes/claim.ts:83`). There is no `GET /claim/:token`.

This is not just a missing convenience route. Cascade notifications build contact URLs as `/claim/:token`:

- `server/src/services/hosted-cascade.ts:268` builds `const claimUrl = `${baseUrl}/claim/${claimToken}``.
- `server/src/services/hosted-cascade.ts:294` sends that URL in the email HTML.
- `server/src/services/hosted-cascade.ts:295` sends that URL in the email text.

Until the claim portal UI is implemented, this route still needs to exist if Task 10 is considered complete. As-is, generated claim emails point contacts to a path the server does not handle.

### Medium: The Phase 3 packet schema requirement includes `releaseRunId`, but the packets table omits it

Phase 3 Task 1 says the `packets` table should support `releaseRunId nullable` (`docs/superpowers/plans/2026-05-08-aegis-dms-site-phase3.md:139`). The schema has `userId`, `switchId`, and `relayConnectionId`, but no `releaseRunId`:

- `server/src/db/schema.ts:123` starts the `packets` table.
- `server/src/db/schema.ts:125` defines `userId`.
- `server/src/db/schema.ts:126` defines `switchId`.
- `server/src/db/schema.ts:127` defines `relayConnectionId`.

The repository explicitly documents the divergence:

- `server/src/repositories/packet-repository.ts:19` says the packets table does not have a `releaseRunId` column.

This makes packet-to-release-run ownership indirect and incomplete. It also shows up in `POST /api/app/switches/:id/packets/generate`, which creates a random standalone `releaseRunId` for storage pathing without a DB release-run record or packet FK (`server/src/routes/packets.ts:99`).

### Medium: Relay heartbeat validation does not verify that the payload connection ID matches the authenticated API key

Phase 2 requires strict validation for API-key relay heartbeat routes. The contract requires `relayConnectionId` in the heartbeat payload (`packages/contracts/src/heartbeat.ts:7`).

The route authenticates the bearer key, parses the heartbeat schema, then records the heartbeat against the authenticated connection ID without checking `body.data.relayConnectionId`:

- `server/src/routes/relay.ts:95` authenticates the bearer key.
- `server/src/routes/relay.ts:101` validates the heartbeat schema.
- `server/src/routes/relay.ts:106` records the heartbeat for `connection.id`.

This avoids cross-updating another row, but it still accepts inconsistent or spoofed heartbeat payloads and stores them in `lastHeartbeatData`. A stricter implementation should reject when `body.data.relayConnectionId !== connection.id`.

## Notes

The Phase 1 and Phase 2 scaffolding, auth, billing, hosted CRUD, relay connection management, relay heartbeat, dashboard, and packet route surfaces are broadly present and covered by tests. The major gaps are concentrated in the Phase 3 release/claim path: decryptability, completion invariants, public-claim hardening, and the missing contact-facing `/claim/:token` route.
