# Stabilizing Backend E2E Tests

The backend E2E integration test suite is currently failing due to three main issues:
1. Legacy authentication routes (`/auth/login`, `/auth/register`) are still being hit in the tests instead of the separated candidate and employer routes.
2. An incomplete mock `req.user` in `analysis-routing.e2e-spec.ts` lacks the required `id` field.
3. The `mockGithubAdapter` lacks the newly introduced rate limiting methods (`getRateLimitRemaining` and `checkRateLimitOrThrow`), causing asynchronous workers to throw `TypeError` and fail.

## User Review Required

Please review the proposed plan. If it looks good, approve it so I can begin execution.

## Proposed Changes

### Auth Endpoints Updates
Update all references to legacy `/auth/...` endpoints to use `/auth/candidate/...` or `/auth/employer/...`.

#### [MODIFY] test/auth.e2e-spec.ts
- Change `POST /auth/login` to `POST /auth/employer/login`.

#### [MODIFY] test/app.e2e-spec.ts
- Change `POST /auth/login` to `POST /auth/employer/login`.

#### [MODIFY] test/jobs.e2e-spec.ts
- Change `POST /auth/login` to `POST /auth/employer/login`.

#### [MODIFY] test/auth_security.e2e-spec.ts
- Change `POST /auth/register` to `POST /auth/candidate/register`.
- Change `POST /auth/login` to `POST /auth/candidate/login`.

#### [MODIFY] test/auth_hijack.e2e-spec.ts
- Change `POST /auth/register` to `POST /auth/candidate/register`.
- Change `POST /auth/login` to `POST /auth/candidate/login`.

#### [MODIFY] test/auth_mfa.e2e-spec.ts
- Change `POST /auth/register` to `POST /auth/candidate/register`.
- Change `POST /auth/login` to `POST /auth/candidate/login`.

#### [MODIFY] test/auth_lifecycle.e2e-spec.ts
- Change `POST /auth/register` to `POST /auth/candidate/register`.
- Change `POST /auth/login` to `POST /auth/candidate/login`.

#### [MODIFY] test/auth_oauth.e2e-spec.ts
- Change `POST /auth/login` to `POST /auth/candidate/login`.

### Fix Mock Context & Adapters

#### [MODIFY] test/analysis-routing.e2e-spec.ts
- Add `id: 'test-user-id'` to the `req.user` mock injected during tests.
- Add `getRateLimitRemaining: jest.fn().mockResolvedValue(5000)` and `checkRateLimitOrThrow: jest.fn().mockResolvedValue(true)` to `mockGithubAdapter`.

#### [MODIFY] test/stage2-pipeline.e2e-spec.ts
- Add `getRateLimitRemaining: jest.fn().mockResolvedValue(5000)` and `checkRateLimitOrThrow: jest.fn().mockResolvedValue(true)` to `mockGithubAdapter`.

#### [MODIFY] test/stage2-analysis.e2e-spec.ts
- Add `getRateLimitRemaining: jest.fn().mockResolvedValue(5000)` and `checkRateLimitOrThrow: jest.fn().mockResolvedValue(true)` to `mockGithubAdapter`.

#### [MODIFY] test/vouch-lifecycle.e2e-spec.ts
- Add `getRateLimitRemaining: jest.fn().mockResolvedValue(5000)` and `checkRateLimitOrThrow: jest.fn().mockResolvedValue(true)` to `mockGithubAdapter`.

## Verification Plan

### Automated Tests
Run `npm run test:e2e` and verify that all integration suites pass successfully without any 404s or `TypeError`s.
