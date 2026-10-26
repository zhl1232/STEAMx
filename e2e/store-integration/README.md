# Store integration browser verification

These checks use the real Next app layout, runtime availability endpoint and public routes. They use anonymous sessions, keep every checkout/payment flag off, and use local placeholder Supabase configuration without a service key. No remote migration or real message/payment is performed.

Build an isolated source copy so `.env*`, the user's dev output and local temporary environments cannot affect the check:

```sh
node e2e/store-integration/data-server.mjs
node scripts/start-store-integration-test-server.mjs build /tmp/chuangtan-store-integration-review
node scripts/start-store-integration-test-server.mjs start /tmp/chuangtan-store-integration-review 3112 true
node scripts/start-store-integration-test-server.mjs start /tmp/chuangtan-store-integration-review 3113 false
node e2e/store-integration/verify.mjs
```

Run the data fixture and two app servers in separate terminals. The loopback data fixture supplies empty public lists for homepage prerendering; it cannot create users or write tables. The build is created with the catalog disabled; running the same build with both flags verifies runtime catalog access while the homepage menu keeps the store entry hidden for online testing. Browser requests to external origins are blocked and reported. The only stubbed same-origin response is the catalog product list (`[]`), since its real database needs the pending schema migration. The test verifies catalog status/title, actual global headers, mobile bottom navigation, support login entry, anonymous order/profile/settings redirects, and horizontal overflow at 390px and 1440px. Screenshots are written to `/tmp/store-project-review`, outside the repository. This does not cover authenticated menus/profile content, real product SSR, pricing transactions, private storage or payment integrations; unit/database tests cover those separately.

The suite records both page exceptions and console/HTTP errors. Closed-catalog `/store` 404 responses are intentional. `/api/announcements/active` returns 500 because the isolated app has no communications service key; these failures are recorded as an environment limitation, and the suite does not claim to validate announcements. Every other HTTP failure, non-HTTP console error, page exception, or external request fails verification. For an existing owned snapshot, `rebuild WORKSPACE` reuses its compiler cache without copying new sources.
