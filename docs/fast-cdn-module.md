# Fast CDN Module (Performance & Network)

This document describes the Fast CDN implementation for static asset delivery and optimization.

## Goals

- Deliver uploaded static assets through CDN edge locations.
- Improve page-load latency with immutable caching and compression.
- Keep upload behavior compatible with i18n, GDPR, and multi-currency boundaries.

## Backend Implementation

Location: `src/modules/uploads`

The module provides:

- S3/R2-compatible object upload support.
- CDN-aware URL generation through `CDN_BASE_URL`.
- Immutable cache headers through `CDN_CACHE_CONTROL`.
- Presigned upload URLs through `POST /uploads/presigned-url`.
- Direct optimized uploads through `POST /uploads/file`.
- Automatic raster image conversion to WebP through `sharp`.
- JavaScript/CSS/JSON/SVG/text minification.
- Gzip compression for large text assets when compression reduces payload size.
- User theme preference routing for theme-specific assets.

## Required Environment Variables

```env
CDN_BASE_URL=https://cdn.your-domain.com
CDN_CACHE_CONTROL=public, max-age=31536000, immutable

AWS_S3_BUCKET=beleqet-uploads
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

## Frontend Integration

For Next.js, configure the CDN host in `next.config.js` and render uploaded image URLs with `next/image`.

```js
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.your-domain.com',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },
};

module.exports = nextConfig;
```

Use lazy loading for non-critical images and rely on UUID object keys for cache busting.

## Global Scaling

- i18n: upload responses use translation keys in `src/i18n/en/messages.json`.
- GDPR: no file contents, presigned URLs, access keys, or personal data are logged.
- Multi-currency: upload responses are metadata-only and do not include or mutate currency fields.

## Deployment Checklist

- `npm test -- --runInBand`
- `npm run build`
- `docker compose config`
- `docker compose build backend`
- `docker compose up -d --no-build`

Before production deployment, replace all placeholder secrets and verify that upload routes are mapped in the backend logs.

## Test Coverage

- `src/modules/uploads/uploads.service.spec.ts`
- `src/modules/uploads/uploads.controller.spec.ts`
- `src/modules/uploads/uploads.integration.spec.ts`
