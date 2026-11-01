#!/usr/bin/env node
// Load test: simulated players play against a running stack the way the web client does, and the requests' latencies,
// the pushes and (with --server-stats) the stack's CPU and Postgres transactions are reported.
//   npm run load -- --players 100 --minutes 5 [--server-stats] [--cleanup]
//
// Each player signs up once as fx_load_NNN (later runs log in again), opens the game (the requests the town view makes),
// keeps a push socket open (a ping every 25 s), then every few seconds opens a screen with that screen's requests. The
// requests and their timing were read off the client: the city refetches every city tick while its population moves
// (useCity), mounted queries refetch when a push makes them stale (lib/push/handlers.ts), and a query mounted again
// within 30 s is served from the cache (main.tsx's staleTime). Some actions write: a cottage started, then cancelled or
// demolished. With --chat players also post to the world channel, which every connected player receives.
//
// Options: --players N (100), --minutes M (5), --ramp S (seconds to bring every player in, 30), --think S (mean seconds
// between screens, 8), --writes F (share of actions that write, 0.1), --chat, --server-stats (docker stats of the
// Compose project and Postgres via DATABASE_URL: only when the API runs on this machine), --cleanup (delete the
// players at the end).

import { execFile, spawn } from 'node:child_process';
import { parseArgs, promisify } from 'node:util';
import { signUpProof } from './proof.mjs';

const { values: opt } = parseArgs({
  options: {
    players: { type: 'string', default: '100' },
    minutes: { type: 'string', default: '5' },
    ramp: { type: 'string', default: '30' },
    think: { type: 'string', default: '8' },
    writes: { type: 'string', default: '0.1' },
    chat: { type: 'boolean', default: false },
    'server-stats': { type: 'boolean', default: false },
    cleanup: { type: 'boolean', default: false },
  },
});
const PLAYERS = Number(opt.players);
const RUN_MS = Number(opt.minutes) * 60_000;
const RAMP_MS = Number(opt.ramp) * 1000;
const THINK_MS = Number(opt.think) * 1000;
const WRITES = Number(opt.writes);

const API = process.env.API ?? 'http://localhost:3000';
const base = `${API}/api/v1`;
const PASSWORD = 'fx-load-test';
/** what the client's queries keep before refetching on mount (main.tsx, the map's FRESH_MS) */
const STALE_MS = 30_000;
const REPORT_EVERY_MS = 10_000;
const SIGN_UP_CONCURRENCY = 8;

const execFileAsync = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => ms * (0.5 + Math.random());
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// ---- metrics ----

/** per endpoint (`GET /cities/:id`): latencies, failures (network or 5xx) and refusals (4xx, the game saying no) */
const endpoints = new Map();
const pushes = new Map();
let tally = { requests: 0, errors: 0, pushes: 0, latencies: [] };
let measuring = false;

function endpointOf(method, path) {
  return `${method} ${path.split('?')[0].replace(/\/-?\d+(?=\/|$)/g, '/:id')}`;
}
function record(name, ms, outcome) {
  if (!measuring) return;
  let e = endpoints.get(name);
  if (!e) endpoints.set(name, (e = { latencies: [], errors: 0, refused: 0 }));
  e.latencies.push(ms);
  if (outcome === 'error') e.errors++;
  if (outcome === 'refused') e.refused++;
  tally.requests++;
  tally.latencies.push(ms);
  if (outcome === 'error') tally.errors++;
}
function quantile(sorted, q) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
}

async function call(token, method, path, body) {
  const t = performance.now();
  try {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    record(endpointOf(method, path), performance.now() - t, res.status >= 500 ? 'error' : json.ok === 1 ? 'ok' : 'refused');
    return { status: res.status, ...json };
  } catch (err) {
    record(endpointOf(method, path), performance.now() - t, 'error');
    return { status: 0, ok: 0, error: String(err) };
  }
}
async function ok(token, method, path, body) {
  const r = await call(token, method, path, body);
  if (r.ok !== 1) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(r).slice(0, 300)}`);
  return r.data;
}

// ---- players ----

const nameOf = (i) => `fx_load_${String(i + 1).padStart(3, '0')}`;

/** Log in as fx_load_NNN, signing it up and founding its city the first time. */
async function account(i) {
  const username = nameOf(i);
  let session = await call(null, 'POST', '/auth/login', { username, password: PASSWORD });
  if (session.ok !== 1)
    session = await call(null, 'POST', '/auth/register', { username, email: `${username}@example.test`, password: PASSWORD, proof: await signUpProof(base) });
  if (session.ok !== 1) throw new Error(`${username}: ${JSON.stringify(session).slice(0, 300)}`);
  let { token } = session.data;
  if (session.data.playerId == null) {
    const name = username.replaceAll('_', '');
    token = (await ok(token, 'POST', '/player', { userName: name, castleName: `${name} Hold`, flag: 'FX', sex: i % 2, zone: -1 })).token;
  }
  return { username, token };
}

class Player {
  constructor({ username, token }) {
    this.username = username;
    this.token = token;
    this.screen = 'town';
    /** when each query was last fetched, for the 30 s staleTime */
    this.fetched = new Map();
    this.stopped = false;
  }

  /** A query the client would serve from its cache while fresh. */
  async query(path, force = false) {
    const at = this.fetched.get(path);
    if (!force && at != null && Date.now() - at < STALE_MS) return null;
    this.fetched.set(path, Date.now());
    const r = await call(this.token, 'GET', path);
    if (r.ok !== 1) this.fetched.delete(path);
    return r.ok === 1 ? r.data : null;
  }

  async city(force = true) {
    const c = await this.query(`/cities/${this.cityId}`, force);
    if (c) this.cityData = c;
    return c;
  }

  /** Opening the game: what the town view requests on load. */
  async open() {
    const player = await this.query('/player', true);
    this.cityId = player.castles[0].id;
    this.home = { x: player.castles[0].x, y: player.castles[0].y };
    this.mapSize = player.mapSizeX || 800;
    this.cityTickMs = Math.max(1000, (6 * 60_000) / (player.gameSpeed || 1));
    await Promise.all([this.city(), this.query('/reports/unread'), this.query('/armies'), this.query('/reports?type=1&pageNo=1&pageSize=10')]);
    this.connect();
    this.populationLoop();
  }

  connect() {
    const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/ws?token=${this.token}`);
    this.ws = ws;
    ws.addEventListener('message', (e) => {
      const { cmd } = JSON.parse(e.data);
      if (measuring) {
        pushes.set(cmd, (pushes.get(cmd) ?? 0) + 1);
        tally.pushes++;
      }
      void this.onPush(cmd);
    });
    const ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ cmd: 'ping' })), 25_000);
    ws.addEventListener('close', () => {
      clearInterval(ping);
      if (!this.stopped) setTimeout(() => this.connect(), 2000);
    });
  }

  /** The refetches a push causes: only the queries on screen (or always mounted, as the city and armies are). */
  async onPush(cmd) {
    switch (cmd) {
      case 'server.BuildComplate':
      case 'server.HeroUpdate':
      case 'server.ResearchCompleteUpdate':
        await this.city();
        if (this.screen === 'research') await this.query(`/cities/${this.cityId}/research`, true);
        break;
      case 'server.SelfArmysUpdate':
      case 'server.FriendArmysUpdate':
      case 'server.EnemyArmysUpdate':
        await this.query('/armies', true);
        break;
      case 'server.TroopQueueUpdate':
        if (this.screen === 'military') await this.query(`/cities/${this.cityId}/troops/queues`, true);
        break;
      case 'server.NewReport':
        await this.query('/reports?type=1&pageNo=1&pageSize=10', true);
        if (this.screen === 'reports') await this.query('/reports?pageNo=1&pageSize=20', true);
        break;
      case 'server.MarketUpdate':
        if (this.screen === 'market') await this.market(true);
        break;
      default:
    }
  }

  /** useCity refetches every city tick while the population is still moving. */
  async populationLoop() {
    while (!this.stopped) {
      await sleep(this.cityTickMs);
      if (this.cityData?.resource.populationDirection !== 0) await this.city();
    }
  }

  async market(force = false) {
    const r = this.resType ?? 0;
    await Promise.all([
      this.query(`/market/${r}?cityId=${this.cityId}`, force),
      this.query(`/market/${r}/history?period=minute&limit=1440`, force),
      this.query('/market/summary', force),
    ]);
  }

  /** The map's 21×21 squares in a view about 60 by 50 tiles round a point (chunksFor in world-map/utils.ts). */
  async map() {
    const at = { x: this.home.x + Math.round((Math.random() - 0.5) * 40), y: this.home.y + Math.round((Math.random() - 0.5) * 40) };
    const wrap = (v) => ((v % this.mapSize) + this.mapSize) % this.mapSize;
    const chunks = new Set();
    for (let dx = -30; dx <= 30; dx += 10)
      for (let dy = -25; dy <= 25; dy += 10) chunks.add(`${Math.floor(wrap(at.x + dx) / 21) * 21},${Math.floor(wrap(at.y + dy) / 21) * 21}`);
    await Promise.all(
      [...chunks].map((c) => {
        const [x, y] = c.split(',').map(Number);
        return this.query(`/map?x1=${x}&y1=${y}&x2=${x + 20}&y2=${y + 20}`);
      }),
    );
  }

  /** Start a cottage in a free slot, then cancel it, or demolish it if it finished meanwhile. */
  async build() {
    const taken = new Set((this.cityData?.buildings ?? []).map((b) => b.positionId));
    const free = Array.from({ length: 32 }, (_, i) => i).filter((p) => !taken.has(p));
    if (!free.length) return;
    const pos = pick(free);
    const started = await call(this.token, 'POST', `/cities/${this.cityId}/buildings`, { typeId: 1, positionId: pos });
    await Promise.all([this.city(), this.query(`/cities/${this.cityId}/buildings/${pos}`, true)]);
    if (started.ok !== 1) return;
    await sleep(jitter(3000));
    const cancelled = await call(this.token, 'POST', `/cities/${this.cityId}/buildings/${pos}/cancel`);
    if (cancelled.ok !== 1) await call(this.token, 'POST', `/cities/${this.cityId}/buildings/${pos}/demolish`);
    await this.city();
  }

  async act() {
    if (Math.random() < WRITES) {
      if (opt.chat && Math.random() < 0.3) await call(this.token, 'POST', '/chat/world', { msg: 'load test' });
      else await this.build();
      return;
    }
    const screens = [
      [20, 'town', () => this.city(false)],
      [15, 'town', () => this.query(`/cities/${this.cityId}/buildings/-1`)],
      [12, 'map', () => this.map()],
      [8, 'research', () => this.query(`/cities/${this.cityId}/research`)],
      [
        8,
        'military',
        () =>
          Promise.all(
            ['troops/trainable', 'troops/queues', 'fortifications/trainable', 'fortifications/queues'].map((p) => this.query(`/cities/${this.cityId}/${p}`)),
          ).then(() => this.query('/player')),
      ],
      [6, 'reports', () => Promise.all([this.query('/reports/unread'), this.query('/reports?pageNo=1&pageSize=20')])],
      [6, 'market', () => ((this.resType = Math.floor(Math.random() * 4)), this.market())],
      [4, 'armies', () => this.query('/armies')],
      [3, 'factions', () => this.query('/factions')],
      [3, 'flows', () => this.query('/player/flows')],
      [2, 'stats', () => this.query('/player/statistics')],
      [4, 'heroes', async () => {}],
      [3, 'items', async () => {}],
    ];
    let roll = Math.random() * screens.reduce((n, [w]) => n + w, 0);
    for (const [w, screen, go] of screens) {
      if ((roll -= w) > 0) continue;
      this.screen = screen;
      await go();
      return;
    }
  }

  async play(until) {
    while (!this.stopped && Date.now() < until) {
      await sleep(jitter(THINK_MS));
      await this.act().catch(() => {});
    }
  }

  stop() {
    this.stopped = true;
    this.ws?.close();
  }
}

// ---- server stats ----

const SERVICES = ['api', 'worker', 'postgres'];

/**
 * The CPU time and memory of the Compose project's services, read from their cgroups: `docker stats` showed a busy API at
 * 0 % on Docker Desktop. Read without blocking, since a stalled load generator makes every request in flight look slow.
 */
async function containers() {
  const read = async (service) => {
    const { stdout } = await execFileAsync('docker', ['compose', 'exec', '-T', service, 'cat', '/sys/fs/cgroup/cpu.stat', '/sys/fs/cgroup/memory.current']);
    return { usec: Number(/usage_usec (\d+)/.exec(stdout)?.[1]), bytes: Number(stdout.trim().split('\n').at(-1)) };
  };
  const readAll = async () => ({ at: Date.now(), by: Object.fromEntries(await Promise.all(SERVICES.map(async (s) => [s, await read(s)]))) });
  const share = (from, to, s) => (to.by[s].usec - from.by[s].usec) / ((to.at - from.at) * 1000);
  const first = await readAll();
  let last = first;
  return {
    async sample() {
      const now = await readAll();
      const line = SERVICES.map((s) => `${s} ${(100 * share(last, now, s)).toFixed(0)} % ${Math.round(now.by[s].bytes / 2 ** 20)} MiB`).join(', ');
      last = now;
      return line;
    },
    async total() {
      const now = await readAll();
      return SERVICES.map(
        (s) => `${s} ${((now.by[s].usec - first.by[s].usec) / 1e6).toFixed(1)} s (${(100 * share(first, now, s)).toFixed(1)} % of a core)`,
      ).join(', ');
    },
  };
}

async function postgres() {
  if (!process.env.DATABASE_URL) return null;
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let last = null;
  return {
    async sample(seconds) {
      const { rows } = await client.query(
        `select (select xact_commit + xact_rollback from pg_stat_database where datname = current_database()) as xacts,
                (select count(*) from pg_stat_activity where datname = current_database() and state = 'active') as active,
                (select count(*) from pg_stat_activity where datname = current_database()) as conns`,
      );
      const [{ xacts, active, conns }] = rows;
      const tps = last == null ? null : (Number(xacts) - last) / seconds;
      last = Number(xacts);
      return `pg ${tps == null ? '-' : Math.round(tps)} tx/s, ${conns} conns (${Number(active) - 1} active)`;
    },
    close: () => client.end(),
  };
}

// ---- run ----

function line(cols) {
  return cols.map(([v, w]) => (typeof v === 'number' ? String(v).padStart(w) : String(v).padEnd(w))).join(' ');
}

async function main() {
  console.log(`load test against ${API}: ${PLAYERS} players for ${opt.minutes} min, ramp ${opt.ramp} s, think ${opt.think} s, writes ${WRITES}`);
  const health = await fetch(`${API}/health`).then((r) => r.json());
  if (health.ok !== 1) throw new Error('the API is not healthy');

  // sign up or log in every player first, outside the measurement (a sign-up solves a puzzle of about a second)
  const t0 = Date.now();
  const sessions = new Array(PLAYERS);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(SIGN_UP_CONCURRENCY, PLAYERS) }, async () => {
      while (next < PLAYERS) {
        const i = next++;
        sessions[i] = await account(i);
      }
    }),
  );
  console.log(`${PLAYERS} players ready in ${((Date.now() - t0) / 1000).toFixed(1)} s (${nameOf(0)} … ${nameOf(PLAYERS - 1)})`);

  const stats = opt['server-stats'] ? await postgres().catch((err) => (console.warn(`no Postgres stats: ${err.message}`), null)) : null;
  await stats?.sample(1);
  const cpu = opt['server-stats'] ? await containers().catch((err) => (console.warn(`no container stats: ${err.message}`), null)) : null;

  measuring = true;
  const start = Date.now();
  const until = start + RUN_MS;
  const players = sessions.map((s) => new Player(s));
  const running = players.map(async (p, i) => {
    await sleep((RAMP_MS * i) / PLAYERS);
    await p.open();
    await p.play(until);
  });

  const report = setInterval(async () => {
    const w = tally;
    tally = { requests: 0, errors: 0, pushes: 0, latencies: [] };
    const sorted = w.latencies.sort((a, b) => a - b);
    const online = players.filter((p) => p.ws?.readyState === WebSocket.OPEN).length;
    const server = (await Promise.all([cpu?.sample(), stats?.sample(REPORT_EVERY_MS / 1000)])).filter(Boolean).join(' | ');
    console.log(
      `${String(Math.round((Date.now() - start) / 1000)).padStart(4)} s  ${String(online).padStart(4)} online  ` +
        `${(w.requests / (REPORT_EVERY_MS / 1000)).toFixed(1).padStart(6)} req/s  p95 ${Math.round(quantile(sorted, 0.95)).toString().padStart(4)} ms  ` +
        `${w.errors} errors  ${(w.pushes / (REPORT_EVERY_MS / 1000)).toFixed(1)} pushes/s${server ? `  | ${server}` : ''}`,
    );
  }, REPORT_EVERY_MS);

  await Promise.all(running);
  measuring = false;
  clearInterval(report);
  players.forEach((p) => p.stop());
  await stats?.close();
  const seconds = (Date.now() - start) / 1000;
  const cpuTotal = await cpu?.total();

  // ---- summary ----
  const rows = [...endpoints.entries()].sort((a, b) => b[1].latencies.length - a[1].latencies.length);
  const all = rows.flatMap(([, e]) => e.latencies).sort((a, b) => a - b);
  const errors = rows.reduce((n, [, e]) => n + e.errors, 0);
  console.log(
    `\n${all.length} requests in ${seconds.toFixed(0)} s: ${(all.length / seconds).toFixed(1)} req/s, ${(all.length / seconds / PLAYERS).toFixed(3)} per player`,
  );
  console.log(
    line([
      ['endpoint', 44],
      ['count', 7],
      ['req/s', 7],
      ['err', 5],
      ['refused', 8],
      ['p50', 6],
      ['p95', 6],
      ['p99', 6],
      ['max', 6],
    ]),
  );
  for (const [name, e] of [...rows, ['all', { latencies: all, errors, refused: rows.reduce((n, [, x]) => n + x.refused, 0) }]]) {
    const s = name === 'all' ? all : e.latencies.sort((a, b) => a - b);
    console.log(
      line([
        [name, 44],
        [s.length, 7],
        [(s.length / seconds).toFixed(2), 7],
        [e.errors, 5],
        [e.refused, 8],
        [Math.round(quantile(s, 0.5)), 6],
        [Math.round(quantile(s, 0.95)), 6],
        [Math.round(quantile(s, 0.99)), 6],
        [Math.round(s[s.length - 1] ?? 0), 6],
      ]),
    );
  }
  const totalPushes = [...pushes.values()].reduce((a, b) => a + b, 0);
  console.log(`\n${totalPushes} pushes received (${(totalPushes / seconds).toFixed(1)}/s):`);
  for (const [cmd, n] of [...pushes.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${cmd.padEnd(36)} ${n}`);
  if (cpuTotal) console.log(`\nCPU over the run: ${cpuTotal}`);

  const names = sessions.map((s) => s.username);
  if (opt.cleanup) {
    await new Promise((resolve) => spawn('npm', ['run', 'delete-player', '--', ...names, '--yes'], { stdio: 'inherit' }).on('close', resolve));
  } else
    console.log(`\nThe players are kept for the next run. To delete them: npm run delete-player -- ${names.join(' ')} --yes (or run again with --cleanup)`);

  if (errors / Math.max(1, all.length) > 0.01) {
    console.log(`\nFAIL: ${errors} errors (${((100 * errors) / all.length).toFixed(1)} % of requests)`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
