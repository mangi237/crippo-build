# Crippo Security Specification (Phase 0 TDD)

## 1. Data Invariants
- Every user document `/users/{userId}` belongs strictly to `request.auth.uid == userId`; PII (`email`, `fullName`) is readable only by the owner or verified admin.
- Users cannot self-assign `admin: true`, `isVerifiedCreator: true`, `creatorId`, `totalRaisedXAF`, `currentValuationXAF`, or `completedMilestones` on create or update.
- Only verified admins (`isAdmin()`) can approve/reject `/creator_applications/{appId}`, create or modify `/creators/{creatorId}` verification/admin fields, write `/news_posts/{postId}` or `/sync_logs/{logId}`, or update `/memo_requests/{memoId}` status.
- Authenticated users creating a `/trades/{tradeId}` must set `uid == request.auth.uid`, valid `sharesHeld >= 1`, positive `totalPaidXAF`, and reference an existing `/creators/{creatorId}` document via `exists()`.
- Atomic trade creation pairs `trades/{tradeId}` creation with a valid `creators/{creatorId}` trading volume & share price update (validated via `getAfter()` / `affectedKeys()`).

## 2. Adversarial Payloads ("Dirty Dozen")
1. Self-escalation on user create (`admin: true`) -> DENIED
2. Self-escalation on user update (`isVerifiedCreator: true`) -> DENIED
3. Reading another user's `/users/{otherUid}` PII -> DENIED
4. Unauthenticated write to `/creators/{id}` -> DENIED
5. Non-admin approving their own `/creator_applications/{appId}` -> DENIED
6. Creating `/creator_applications/{appId}` with someone else's `uid` -> DENIED
7. Creating `/trades/{tradeId}` with `sharesHeld: -5` -> DENIED
8. Creating `/trades/{tradeId}` referencing non-existent `creatorId` -> DENIED
9. Querying `/trades` belonging to another user -> DENIED
10. Injecting >128 char malformed document ID -> DENIED
11. Unverified email trying to approve admin actions -> DENIED
12. Shadow update adding unknown fields to `/memo_requests/{memoId}` -> DENIED
