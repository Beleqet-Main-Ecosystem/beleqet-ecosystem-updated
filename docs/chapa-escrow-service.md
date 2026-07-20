# Chapa Escrow Service

This feature branch integrates Chapa escrow funding into the existing Beleqet NestJS and Prisma stack.

## Backend

- `src/modules/chapa` contains the shared Chapa client used by escrow funding and wallet withdrawal transfers.
- `POST /api/v1/escrow/initiate/:gigId` creates or refreshes an escrow transaction and initializes Chapa checkout for the amount not covered by the employer wallet.
- `POST /api/v1/escrow/callback` verifies Chapa webhook signatures when configured, then queues idempotent webhook processing.
- `GET /api/v1/escrow/callback` supports the browser redirect path and relies on server-side Chapa verification before funding.
- `POST /api/v1/escrow/milestones/:id/confirm` records either employer or professional milestone confirmation.
- `POST /api/v1/escrow/milestones/:id/release` remains backward compatible for employer release, but now waits for the professional confirmation before queuing payout.

Successful webhook processing verifies the transaction against Chapa before changing escrow state to `FUNDED`. Milestone payout is queued only when the escrow is funded and both `employerApprovedAt` and `freelancerApprovedAt` are set.

## Database

Migration `20260719170000_chapa_escrow_confirmations` adds two approval timestamps to `milestones` and an event-log lookup index for webhook idempotency.

## Environment

Set these values for local and deployed environments:

```env
CHAPA_SECRET_KEY=CHASECK_TEST-...
CHAPA_PUBLIC_KEY=CHAPUBK_TEST-...
CHAPA_BASE_URL=https://api.chapa.co/v1
CHAPA_WEBHOOK_SECRET=your_webhook_secret
CHAPA_CALLBACK_URL=http://localhost:4000/api/v1/escrow/callback
CHAPA_RETURN_URL=http://localhost:3000/freelance/payment-success
```

## Local Verification

```bash
npm ci
npm run prisma:generate
npm test -- src/modules/chapa src/modules/escrow --runInBand
npm run build
```

For frontend smoke testing:

```bash
cd frontend
npm ci
npm run build
```
