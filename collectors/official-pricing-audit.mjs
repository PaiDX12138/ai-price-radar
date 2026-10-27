import { explicitPriceCurrency } from "./official-price-currency.mjs";
import { appStoreBillingPeriod, hasOppositeBillingEvidence, pickAppStoreItem } from "./official-appstore-match.mjs";
import { CHATGPT_WEB_PLAN_MAP, extractChatgptWebOffer, formatChatgptWebPrice } from "./official-chatgpt-web.mjs";
import { USD_REFERENCE_APPS } from "./official-usd-reference.mjs";
import { convertToCny, getFx, listEnabledApps, listEnabledRegions, listPlansForApp, rateToCny, upsertPrice } from "./official-prices-db.mjs";

export function auditOfficialPrices(db) {
  const fx = getFx(db);
  const rows = db.prepare(`SELECT q.*,p.slug plan_slug,p.billing_period,a.slug app_slug,r.country_code
    FROM official_prices q JOIN official_plans p ON p.id=q.plan_id
    JOIN official_apps a ON a.id=p.app_id JOIN official_regions r ON r.id=q.region_id
    WHERE a.slug IN ('chatgpt','claude','cursor','grok','x','kiro','gemini')`).all();
  const apps = {};
  const issues = [];
  for (const row of rows) {
    const app = apps[row.app_slug] ||= { rows: 0, plans: new Set(), currencies: new Set(), usdReference: 0, invalid: 0 };
    app.rows++; app.plans.add(row.plan_slug); app.currencies.add(row.currency_code);
    if (row.price_basis === "usd_reference") app.usdReference++;
    if (row.status === "invalid") { app.invalid++; continue; }
    const problems = [];
    const code = explicitPriceCurrency(row.price_text);
    if (code && code !== row.currency_code) problems.push("text_currency_mismatch");
    const expected = fx && convertToCny(row.price_value, row.currency_code, fx.rates);
    if (expected == null) problems.push("invalid_amount_or_fx");
    else if (Math.abs(expected - row.cny_price) > 0.011) problems.push("latest_fx_not_applied");
    if (!(row.fx_rate_to_cny > 0) || Math.abs(row.price_value * row.fx_rate_to_cny - row.cny_price) > 0.011) problems.push("stored_conversion_mismatch");
    const period = appStoreBillingPeriod(row.source_offer_id);
    if (row.channel === "ios_store" && period && period !== row.billing_period) problems.push("billing_period_mismatch");
    if (row.channel === "web_direct" && USD_REFERENCE_APPS.includes(row.app_slug) && !row.price_basis) problems.push("legacy_unverified_local_price");
    if (problems.length) issues.push({ id: row.id, app: row.app_slug, plan: row.plan_slug, country: row.country_code, channel: row.channel, problems });
  }
  return { rows: rows.length, issues, apps: Object.fromEntries(Object.entries(apps).map(([slug, app]) =>
    [slug, { ...app, plans: app.plans.size, currencies: [...app.currencies].sort() }])), fxDate: fx?.date || null };
}

/** Apply already-captured public evidence; no network or guesses about absent products. */
export function applyOfficialPriceEvidence(db, evidence) {
  const fx = getFx(db);
  if (!fx) throw new Error("No FX available");
  const apps = new Map(listEnabledApps(db).map((app) => [app.slug, app]));
  const regions = new Map(listEnabledRegions(db).map((region) => [region.country_code, region]));
  const current = db.prepare("SELECT * FROM official_prices WHERE plan_id=? AND region_id=? AND channel=?");
  const stale = db.prepare("UPDATE official_prices SET status=CASE WHEN status='available' THEN 'stale' ELSE status END,last_attempt_at=? WHERE plan_id=? AND region_id=? AND channel=?");
  const invalid = db.prepare("UPDATE official_prices SET status='invalid',last_attempt_at=? WHERE id=?");
  const counts = { iosConfirmed: 0, webConfirmed: 0, quarantined: [], unavailableOrFailed: 0, missingSkuRetained: 0 };
  db.transaction(() => {
    for (const page of evidence.ios || []) {
      const app = apps.get(page.app), region = regions.get(page.country);
      if (!app || !region || !Array.isArray(page.items) && page.ok) continue;
      const plans = listPlansForApp(db, app.id).filter((plan) => plan.offer_pattern);
      const at = page.capturedAt;
      if (!at || !Number.isFinite(Date.parse(at))) continue;
      if (!page.ok || page.storefront?.cc !== region.country_code || String(page.storefront?.id) !== region.storefront_id || !page.currencyCode) {
        counts.unavailableOrFailed++;
        for (const plan of plans) stale.run(at, plan.id, region.id, "ios_store");
        continue;
      }
      for (const plan of plans) {
        const pattern = new RegExp(plan.offer_pattern);
        const item = pickAppStoreItem(page.items, { ...plan, pattern }, page.currencyCode, fx.rates);
        const row = current.get(plan.id, region.id, "ios_store");
        const cny = item && convertToCny(item.priceValue, page.currencyCode, fx.rates);
        if (!item || cny == null) {
          if (!row) continue;
          // A proven opposite-period identifier/amount is invalid, not a bargain historical year.
          if (hasOppositeBillingEvidence(row, page.items, { ...plan, pattern })) {
            invalid.run(at, row.id);
            counts.quarantined.push({ id: row.id, app: app.slug, country: region.country_code, plan: plan.slug, reason: "opposite_billing_period" });
          } else { stale.run(at, plan.id, region.id, "ios_store"); counts.missingSkuRetained++; }
          continue;
        }
        upsertPrice(db, { planId: plan.id, regionId: region.id, channel: "ios_store", priceText: item.priceText,
          priceValue: item.priceValue, currencyCode: page.currencyCode, cnyPrice: cny,
          fxRateToCny: rateToCny(page.currencyCode, fx.rates), fxDate: fx.date, sourceOfferId: item.offerName,
          sourceUrl: `https://apps.apple.com/${region.country_code.toLowerCase()}/app/${app.app_store_slug}/id${app.app_store_id}`,
          priceBasis: "observed", status: "available", lastSuccessAt: at, updatedAt: at });
        counts.iosConfirmed++;
      }
    }
    const chatgpt = apps.get("chatgpt");
    if (chatgpt) for (const page of evidence.web || []) {
      const region = regions.get(page.country);
      if (!region || !page.capturedAt || !Number.isFinite(Date.parse(page.capturedAt))) continue;
      for (const plan of listPlansForApp(db, chatgpt.id).filter((p) => CHATGPT_WEB_PLAN_MAP[p.slug])) {
        const offer = page.ok && page.config?.country_code === region.country_code && extractChatgptWebOffer(page.config, plan.slug);
        const cny = offer && convertToCny(offer.listValue, offer.currencyCode, fx.rates);
        if (!offer || cny == null) { stale.run(page.capturedAt, plan.id, region.id, "web_direct"); continue; }
        upsertPrice(db, { planId: plan.id, regionId: region.id, channel: "web_direct",
          priceText: formatChatgptWebPrice(offer.listValue, offer.currencyCode, offer.exponent),
          priceValue: offer.listValue, listPriceValue: offer.listValue, currencyCode: offer.currencyCode,
          taxMode: offer.taxMode, taxPercent: offer.taxPercent, cnyPrice: cny,
          fxRateToCny: fx.rates.CNY / (offer.currencyCode === "USD" ? 1 : fx.rates[offer.currencyCode]), fxDate: fx.date,
          sourceUrl: page.url, priceBasis: "observed", status: "available", lastSuccessAt: page.capturedAt, updatedAt: page.capturedAt });
        counts.webConfirmed++;
      }
    }
  })();
  return counts;
}
