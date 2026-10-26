# Local store/support UI fixture preview

Run from the repository root with existing dependencies:

```sh
node tests/store-v1-browser/server.mjs
node tests/store-v1-browser/verify.mjs
```

Open http://127.0.0.1:3101. The banner switches between the actual catalog, product detail, checkout and support components. `tier=pro` and `tier=founder` select synthetic membership. These files are isolated test tooling, never application routes. No database, authentication, real payment, SMS or notification service is used. The three source images come from the approved local source-drafts manifest; stock, prices, specifications and fulfillment are clearly marked fixtures and do not establish product readiness.

The preview adapts Next Link/Image/navigation for Vite and loads current application global CSS. Synthetic fetch responses handle every API request; unknown API requests throw, external fetches throw, and CSP blocks external connections/media/images. Playwright independently blocks external requests and records console/page errors. The preview server only serves localhost. HMR/file watching is disabled so concurrent work cannot reset an interaction mid-test; restart the preview after code changes.

Verification uses headless Chromium at 390×844 and 1440×1000, closes browsers afterward, and writes screenshots only to `/tmp/store-v1-review`. It exercises visible controls for gallery selection, stock/quantity restrictions, purchase intent, membership and exclusive coupon/coin selection, quote-change reconfirmation, same-intent order recovery, uncertain retry, support retry, attachment upload/rendering, and catalog empty/error states. Quote arithmetic verifies rendering of controlled server fixtures, not real backend pricing/security. Real auth, route integration, access isolation, private-message separation, database transactions and payment integrations require separate tests.
