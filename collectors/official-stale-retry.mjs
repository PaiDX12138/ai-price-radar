export const STALE_RETRY_INTERVAL_MS = 60 * 60 * 1000;

export function initStaleRetry(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS official_stale_retry_schedule (id INTEGER PRIMARY KEY CHECK(id=1), next_at TEXT, lease_until TEXT);
    INSERT OR IGNORE INTO official_stale_retry_schedule(id) VALUES (1);`);
}

export function listStaleRetryTargets(db) {
  return db.prepare(`SELECT pr.plan_id, pr.region_id, pr.channel FROM official_prices pr
    JOIN official_plans p ON p.id=pr.plan_id JOIN official_apps a ON a.id=p.app_id
    JOIN official_regions r ON r.id=pr.region_id
    WHERE pr.status='stale' AND a.enabled=1 AND r.enabled=1
    AND ((pr.channel='web_direct' AND a.slug='chatgpt') OR (pr.channel='ios_store' AND a.app_store_id IS NOT NULL))`).all();
}

export function staleRetryDue(db, nowMs = Date.now()) {
  initStaleRetry(db);
  const row = db.prepare('SELECT * FROM official_stale_retry_schedule WHERE id=1').get();
  return (!row.next_at || Date.parse(row.next_at) <= nowMs) && (!row.lease_until || Date.parse(row.lease_until) <= nowMs) && listStaleRetryTargets(db).length > 0;
}

export function claimStaleRetry(db, nowMs = Date.now()) {
  initStaleRetry(db);
  return db.transaction(() => {
    if (!staleRetryDue(db, nowMs)) return false;
    db.prepare('UPDATE official_stale_retry_schedule SET next_at=?, lease_until=? WHERE id=1')
      .run(new Date(nowMs + STALE_RETRY_INTERVAL_MS).toISOString(), new Date(nowMs + STALE_RETRY_INTERVAL_MS).toISOString());
    return true;
  }).immediate();
}

export function finishStaleRetry(db, nowMs = Date.now()) {
  db.prepare('UPDATE official_stale_retry_schedule SET next_at=?, lease_until=NULL WHERE id=1').run(new Date(nowMs + STALE_RETRY_INTERVAL_MS).toISOString());
}

export const retryTargetKey = (planId, regionId, channel) => `${planId}:${regionId}:${channel}`;
