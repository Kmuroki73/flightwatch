import fs from 'node:fs';

const required = [
  ['src/screens/CommerceScreen.tsx', ['songa-premium-30', 'songa-premium-365', 'songa-trip-rescue', 'songa-family-watch', 'songa-gift-watch', 'songa-airside-order', 'songa-commerce-create-order']],
  ['src/screens/DashboardScreen.tsx', ['Your saved journeys', 'Active entitlements', 'Recent orders', 'Recent flight searches']],
  ['src/App.tsx', ['DashboardScreen', "id: 'dashboard'", 'songa-search-history', "get('screen') === 'commerce'"]],
  ['supabase/functions/whatsapp-webhook/index.ts', ['upper === \"SERVICES\"', 'upper === \"MYSONGA\"', 'songa_commerce_orders', 'eq(\"status\", \"verified\")']],
  ['src/index.css', ['.dashboard-grid', '.theme-dark .commerce-hero', '.commerce-hero:before']],
  ['supabase/functions/songa-commerce-create-order/index.ts', ['PayPal-Request-Id', 'verifyFlight', 'PRODUCT_CATALOG']],
  ['supabase/functions/songa-commerce-capture-order/index.ts', ['amountMatches', 'fulfilCommerceOrder', 'user_id']],
  ['supabase/functions/songa-commerce-webhook/index.ts', ['verify-webhook-signature', 'songa_claim_commerce_webhook_event', 'captureMatches', 'fulfilCommerceOrder', 'completeError']],
  ['supabase/functions/songa-redeem-gift/index.ts', ['PENDING_CLAIM', 'recipient_mismatch', 'maybeSingle']],
  ['supabase/migrations/20261109000100_songa_shared_commerce.sql', ['enable row level security', 'songa_commerce_orders_select_own', 'songa_group_flights']],
  ['supabase/migrations/20261111000100_songa_webhook_reliability.sql', ['songa_claim_commerce_webhook_event', 'processing_started_at', 'attempt_count']],
  ['supabase/migrations/20261111000200_songa_traveller_personalisation.sql', ['songa_traveller_profiles', 'enable row level security', 'songa_traveller_profiles_update_own']],
  ['supabase/functions/songa-accommodation-search/index.ts', ['ACCOMMODATION_ADAPTER_URL', 'auth.getUser', 'provider_not_configured']],
  ['supabase/functions/songa-ai-assistant/index.ts', ['songa_traveller_profiles', 'Traveller preferences supplied by the signed-in user', 'get_commerce_catalogue', 'PRODUCT_CATALOG', 'AIRSIDE_MENU', 'explicitly approve PayPal checkout']],
  ['src/screens/CommerceScreen.tsx', ['Find somewhere to land', 'songa-accommodation-search', 'Search stays']],
];
let failures = 0;
for (const [file, needles] of required) {
  const source = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!source.includes(needle)) { console.error(`FAIL ${file}: missing ${needle}`); failures++; }
  }
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.scripts?.['verify:milestone2']) { console.error('FAIL package.json: missing verify:milestone2 script'); failures++; }
if (failures) process.exit(1);
console.log(`Milestone 2 static verification passed (${required.reduce((n, [, checks]) => n + checks.length, 0)} source assertions).`);
console.log('This is a source smoke check, not a substitute for TypeScript, build, database or PayPal Sandbox tests.');
