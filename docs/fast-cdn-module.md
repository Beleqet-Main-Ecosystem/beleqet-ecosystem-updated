# Fast CDN Module (Performance & Network)

This document describes the `Fast CDN` module implementation for static asset delivery and optimization.

## Goals

- Deliver uploaded static assets (images, videos, files) through edge locations.
- Improve latency and page load speed using caching and compression.
- Keep implementation compatible with global scaling requirements.

## Backend (NestJS) Implementation

Location: `src/modules/uploads`

### What was added

- CDN-aware URL generation via `CDN_BASE_URL`.
- Long-term cache headers for immutable static assets via `CDN_CACHE_CONTROL`.
- Automated optimization pipeline:
  - Image conversion to WebP (`sharp`)
  - Minification for JS/CSS/JSON/text assets (`terser`, `clean-css`)
  - Gzip compression for large text payloads (`zlib`)
- TSDoc comments on service and controller methods.
- i18n response messages for upload operations (`src/i18n/en/messages.json`).

### Required environment variables

```env
CDN_BASE_URL=https://cdn.your-domain.com
CDN_CACHE_CONTROL=public, max-age=31536000, immutable
```

Storage variables already supported by the module:

- AWS S3: `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`

## Frontend (Next.js) Integration

If your frontend is in a separate repository, add the following:

### 1) Configure Next Image Optimization

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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

export default nextConfig;
```

### 2) Use `next/image` with lazy loading

```tsx
import Image from 'next/image';

export function OptimizedAvatar({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={240}
      height={240}
      loading="lazy"
      sizes="(max-width: 768px) 50vw, 240px"
    />
  );
}
```

### 3) Use immutable URLs for cache busting

- Keep file names versioned (UUID/hash in key) to safely use long cache TTL.
- Re-uploading a changed file should produce a new key.

## Global Scaling Notes

- i18n: upload responses are localized through message keys.
- GDPR: no sensitive personal data is logged in this module; only metadata required for storage is processed.
- Multi-currency: this module is currency-agnostic and does not transform financial data, preserving platform-wide currency handling boundaries.

## Unit Tests

The module includes unit tests in:

- `src/modules/uploads/uploads.service.spec.ts`
- `src/modules/uploads/uploads.controller.spec.ts`

They validate:

- CDN URL generation
- Cache header usage
- Text optimization and gzip compression path
- Controller language parsing and default folder handling
