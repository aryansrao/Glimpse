# Checklist: Email Verification & Forgot Password Flow

- [x] Update `src/lib/mailer.ts` with templates for verify, login, reset, and keep-alive
- [x] Refactor `src/auth.ts` to support OTP credentials authorization and block unverified users
- [x] Create API routes:
  - [x] `src/app/api/auth/otp/send-login/route.ts`
  - [x] `src/app/api/auth/otp/verify-signup/route.ts`
  - [x] `src/app/api/auth/forgot-password/send/route.ts`
  - [x] `src/app/api/auth/forgot-password/reset/route.ts`
  - [x] `src/app/api/cron/keepalive/route.ts`
- [x] Create UI pages:
  - [x] `/verify-email` page with liquid glass OTP inputs
  - [x] `/forgot-password` page
  - [x] `/reset-password` page
- [x] Update existing UI pages:
  - [x] `/sign-up` to require email and redirect to verify
  - [x] `/sign-in` to support OTP tabs and show unverified messages
- [x] Add `vercel.json` with monthly keep-alive cron job
- [x] Verify everything compiles and works
