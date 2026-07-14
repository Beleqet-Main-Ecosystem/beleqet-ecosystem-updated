# Pull Request Description

## 🚀 Feature: S3 Cloud Object Storage Module

**Ticket:** Performance & Network Module (Round 2 Technical Assessment)  
**Branch:** `feat/bemnet-s3-storage`

### 🎯 Objective
Implemented a secure, enterprise-grade cloud object storage module utilizing NestJS and AWS S3. This module handles user file uploads (Resumes, Portfolios) by securely routing them to a private S3 bucket and generating temporary Presigned URLs for secure access, completely bypassing direct server hosting.

### 🏗️ Architecture & Global Scaling Implementations

*   **Security & Validation:** Implemented strict backend MIME-type and size limits (5MB images/10MB documents) using Multer interceptors before hitting the AWS SDK.
*   **Infrastructure (AWS SDK v3):** Integrated `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`. 
*   **Graceful Local Fallback:** Engineered a `temp-storage` local disk fallback mechanism. If AWS S3 credentials are missing from the reviewer's `.env`, the system gracefully degrades to local storage to ensure the codebase can be tested instantly without AWS configuration.
*   **Multi-Currency Engine:** Added a strict `currency.util.ts` layer. Simulated storage fee calculations are performed entirely in integers (Santims/cents) to prevent floating-point precision errors during localized formatting.
*   **i18n Localization:** Abstracted user-facing strings and error messages into `en.json` and `am.json` dictionaries to support global scaling (English/Amharic).
*   **GDPR Compliance (Right to be Forgotten):** 
    *   Enforced a `hasConsentedToProcessing` boolean via DTOs for all uploads. 
    *   Implemented a soft-delete mechanism in the Prisma schema (`isDeleted`) combined with PII masking algorithms to sanitize metadata upon deletion requests.

### 🧪 Quality Assurance
*   Strict TypeScript enforced (`0` instances of `any`).
*   Complete `TSDoc` documentation applied across all services, utilities, and controllers.
*   Jest Unit test suite created for `storage.service.ts` and `storage.controller.ts` (19 / 19 tests passed).

### 💻 Local Testing Instructions
1. Run `npm install` in both the backend and frontend directories.
2. Run backend tests: `npm run test src/modules/storage` or `npx jest src/modules/storage`.
3. Boot the Next.js frontend to view the dark-theme UI, toggle the Amharic/English i18n switch, and test the GDPR-gated upload flow.
