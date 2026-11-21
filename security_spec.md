# Security Specification — ميزان المعرفة (Firestore Rules)

## 1. Data Invariants
1. All curriculum and workspace data (`quarters`, `months`, `domains`, `courses`, `bookNotes`, `unifiedTasks`, `calendarEvents`, `weeklyMeetings`, `audioCache`, `attachments`, and `chunks` subcollections) is strictly private to the authenticated, email-verified user (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. Every subcollection document MUST contain `ownerId == request.auth.uid`, validated on both `create` and `update`, and `ownerId` is immutable after creation.
3. Every subcollection `create` verifies parent `/users/{userId}` document existence via `exists(...)` (Master Gate).
4. Every document ID and user ID must match `^[a-zA-Z0-9_\-]+$` with length `<= 128` (`isValidId`).
5. Every string field has strict `.size()` bounds and arrays (`tasks`, `resources`, `thinkers`, `linkedMonths`, `completedDates`, `followUps`, `linkedTaskIds`) and maps (`calendarPrefs`, `attendanceByDate`, `notesByDate`, `exceptions`) have bounded `.size()` caps to prevent resource exhaustion.
6. All `createdAt` / `updatedAt` timestamps must strictly equal `request.time`.
7. Top-level `/users` list queries are explicitly denied (`allow list: if false`) to prevent user enumeration or PII leakage.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated read**: `get /users/uid123/months/month-1` with `auth = null`.
2. **Unverified email write**: `create /users/uid123/bookNotes/bn-1` with `auth.token.email_verified = false`.
3. **Cross-user read**: `get /users/victimUid/bookNotes/bn-1` as `attackerUid`.
4. **Cross-user list**: `list /users/victimUid/courses` as `attackerUid`.
5. **Identity spoofing**: `create /users/attackerUid/months/month-99` with `ownerId: "victimUid"`.
6. **Shadow field injection**: `create /users/uid123/courses/course-9` with extra field `isAdmin: true`.
7. **ID poisoning**: `create /users/uid123/bookNotes/../../../evil` or 200-char ID.
8. **Type poisoning**: `update /users/uid123/months/month-1` with `status: 123` or invalid enum `"hacked"`.
9. **Array bloat / Denial of Wallet**: `update /users/uid123/months/month-1` with `tasks` containing 500 items.
10. **Immutable ownerId hijack**: `update /users/uid123/bookNotes/bn-1` changing `ownerId` from `uid123` to `uid456`.
11. **Client timestamp forgery**: `create /users/uid123/bookNotes/bn-2` with `updatedAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
12. **Top-level user enumeration**: `list /users` as any signed-in user.
