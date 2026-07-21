/**
 * k6 load baseline for VECK.
 *
 *   BASE_URL=http://localhost:3000 CRON_SECRET=... k6 run tests/load/k6-baseline.js
 *
 * Point this at a local dev server or a staging deployment — never production.
 * Scenarios B and C write data (a stage change, and cron rows being claimed),
 * so the target database should be one you are willing to dirty.
 *
 * Authenticated routes need a session. The simplest way to get one locally is
 * to run the dev server with DISABLE_AUTH=true; otherwise pass a cookie via
 * SESSION_COOKIE. Scenarios that require auth skip themselves when they see a
 * redirect to the login page, so a misconfigured run reports "skipped" rather
 * than a wall of misleading failures.
 *
 * These thresholds record where the app is today. They are a tripwire for
 * regression, not a performance target to celebrate.
 *
 * ---------------------------------------------------------------------------
 * First baseline, 2026-07-21, dev server against the ap-southeast-2 Supabase
 * pooler from India. Latency here is dominated by that distance; re-run against
 * a like-for-like staging environment before drawing conclusions about the app.
 *
 *   reads  p(95) ~22s      cron sweep ~23s      single /leads/stats ~9s
 *
 * FINDING — the pool is smaller than one request needs. Eight concurrent
 * requests to /api/v1/leads/stats returned six 503s, every one failing at
 * almost exactly 10.0s, which is Prisma's default pool_timeout:
 *
 *   503 10.03s   503 10.04s   503 10.04s   503 10.05s
 *   503 10.05s   503 10.05s   200 13.34s   200 15.80s
 *
 * That endpoint fans out seven queries through Promise.all, while DATABASE_URL
 * carries connection_limit=5. A single request therefore wants more connections
 * than the whole pool holds, and two concurrent users are already oversubscribed
 * 14:5. Long cross-region queries hold each connection for ~1s+, so the queue
 * never drains inside pool_timeout.
 *
 * Fix is configuration, not code: raise connection_limit (15-20) and consider
 * pool_timeout=20 on DATABASE_URL. Deliberately not changed here — it belongs
 * in the deployment's connection string, not in a test file.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * Second baseline, 2026-07-22, same dev server and pooler, connection_limit
 * DELIBERATELY LEFT AT 5 — this run isolates the code fix from the config fix.
 *
 * /leads/stats' Promise.all became prisma.$transaction (one reserved
 * connection instead of seven — see the route for why groupBy runs separately)
 * and middleware.ts no longer treats a session-resolution infra error as a
 * logout. Manual repro of the exact same 8-concurrent request:
 *
 *   200 12.72s   200 13.07s   200 13.96s   200 14.02s
 *   200 15.83s   200 16.48s   200 16.48s   200 17.93s
 *
 * Zero 503s (was six of eight). Full k6 run: http_req_failed 0.00% (0/75),
 * all thresholds passed. Latency is WORSE than before (reads p95 ~18.8s vs
 * ~22s baseline is actually similar, cron sweep ~15.8s) — expected, since the
 * same 8 requests are now queuing over ~2 connections per request instead of
 * failing outright over 7. connection_limit=5 was never raised for this run,
 * on purpose, per the plan's non-goal of not touching live credentials.
 *
 * Conclusion: the code fix alone eliminates the 503s. It does not fix
 * latency, and isn't meant to — that's cross-region network RTT (confirmed
 * last baseline) plus deliberately-unraised connection_limit. Raising
 * connection_limit as documented in .env.example / docs/DEPLOYMENT.md is
 * still required for acceptable latency under concurrency; that change
 * belongs in the deployment's connection string, applied by whoever holds
 * that credential.
 * ---------------------------------------------------------------------------
 */
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const CRON_SECRET = __ENV.CRON_SECRET || ''
const SESSION_COOKIE = __ENV.SESSION_COOKIE || ''
const LEAD_ID = __ENV.LEAD_ID || ''

const authSkipped = new Counter('auth_skipped')
const stageChangeDuration = new Trend('stage_change_duration', true)
const cronDuration = new Trend('cron_duration', true)

// Scenarios are registered only when their inputs exist. A scenario whose body
// returns immediately would otherwise busy-loop under a VU executor — an early
// run of this file spun 15 million no-op iterations in 30s and buried every
// aggregate metric.
const scenarios = {
  // A — the read path a salesperson hammers all day.
  reads: {
    executor: 'ramping-vus',
    exec: 'readPath',
    startVUs: 1,
    stages: [
      { duration: '15s', target: 5 },
      { duration: '30s', target: 10 },
      { duration: '15s', target: 0 },
    ],
    // Single requests can take 20s+ against a cross-region database. Without a
    // generous grace period the ramp-down aborts them mid-flight and they are
    // counted as failures, which looks like an application fault and is not.
    gracefulRampDown: '45s',
    tags: { scenario: 'reads' },
  },
}

// B — the write path this branch changed. Low VUs on purpose: every iteration
// mutates a real lead and writes a timeline event, so only run it deliberately.
if (LEAD_ID) {
  scenarios.stageWrites = {
    executor: 'constant-vus',
    exec: 'stageSkipWrite',
    vus: 2,
    duration: '30s',
    startTime: '20s',
    tags: { scenario: 'stage_writes' },
  }
}

// C — concurrent cron hits. The load-test complement to the DB-level proof in
// lib/__tests__/cron-concurrency.integration.test.ts: overlapping runs must
// stay correct and must not collapse under contention.
if (CRON_SECRET) {
  scenarios.cronConcurrency = {
    executor: 'constant-vus',
    exec: 'cronSweep',
    vus: 5,
    duration: '20s',
    startTime: '60s',
    tags: { scenario: 'cron' },
  }
}

export const options = {
  scenarios,
  thresholds: {
    // Deliberately loose. These record where the app sits today against a
    // cross-region database; tighten them once there is a like-for-like
    // staging environment to measure. They exist to catch a regression, not
    // to certify performance.
    // Scoped to reads: the cron scenario deliberately fires an unauthenticated
    // probe that must 401, and a blanket http_req_failed threshold counts that
    // intended rejection as a failure.
    'http_req_failed{scenario:reads}': ['rate<0.05'],
    'http_req_duration{scenario:reads}': ['p(95)<25000'],
    checks: ['rate>0.95'],
  },
}

function headers() {
  const h = { 'Content-Type': 'application/json' }
  if (SESSION_COOKIE) h.Cookie = SESSION_COOKIE
  return h
}

/** A redirect to /auth/login means the run has no usable session. */
function isUnauthenticated(res) {
  return res.status === 401 || (res.url || '').includes('/auth/login')
}

export function readPath() {
  group('reads', () => {
    const health = http.get(`${BASE_URL}/api/v1/health`)
    check(health, { 'health 200': (r) => r.status === 200 })

    const leads = http.get(`${BASE_URL}/api/v1/leads?limit=20`, { headers: headers() })
    if (isUnauthenticated(leads)) {
      authSkipped.add(1)
      return
    }
    check(leads, {
      'leads 200': (r) => r.status === 200,
      'leads enveloped': (r) => {
        try {
          return r.json('success') === true
        } catch {
          return false
        }
      },
    })

    const stats = http.get(`${BASE_URL}/api/v1/leads/stats`, { headers: headers() })
    check(stats, { 'stats 200': (r) => r.status === 200 })
  })
  // Think time — a user reads the list before acting. Without it this measures
  // how fast k6 can saturate the server, not how the server behaves in use.
  sleep(1)
}

export function stageSkipWrite() {
  if (!LEAD_ID) {
    authSkipped.add(1)
    return
  }
  group('stage skip', () => {
    // Contacted -> Deal Lost skips the SOP sequence, so this exercises the
    // out-of-sequence path: reason required, timeline flagged, audit written.
    const res = http.put(
      `${BASE_URL}/api/v1/leads/${LEAD_ID}/stage`,
      JSON.stringify({ stage: 'Deal Lost', reason: 'No Response' }),
      { headers: headers() }
    )
    if (isUnauthenticated(res)) {
      authSkipped.add(1)
      return
    }
    stageChangeDuration.add(res.timings.duration)
    // 409 is a correct answer when a previous iteration already moved the lead.
    check(res, { 'stage change resolved': (r) => r.status === 200 || r.status === 409 })
  })
}

export function cronSweep() {
  if (!CRON_SECRET) {
    authSkipped.add(1)
    return
  }
  group('cron', () => {
    const opts = { headers: { Authorization: `Bearer ${CRON_SECRET}` } }
    const sla = http.get(`${BASE_URL}/api/v1/cron/sla-check`, opts)
    cronDuration.add(sla.timings.duration)
    check(sla, { 'sla-check 200 under concurrency': (r) => r.status === 200 })

    const nudges = http.get(`${BASE_URL}/api/v1/cron/follow-up-nudges`, opts)
    check(nudges, { 'follow-up-nudges 200 under concurrency': (r) => r.status === 200 })

    sleep(1)

    // An unauthenticated call must still be rejected while under load. The 401
    // is the desired outcome, so declare it expected — otherwise k6 counts this
    // probe in http_req_failed and the run looks broken when it is behaving.
    const unauth = http.get(`${BASE_URL}/api/v1/cron/sla-check`, {
      responseCallback: http.expectedStatuses(401),
    })
    check(unauth, { 'cron rejects missing secret': (r) => r.status === 401 })
  })
}
