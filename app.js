/* =====================================================================
   BK phone 쇼핑몰 핵심 코드 (BumBum Company)
   - 데이터베이스: Neon Postgres (DATABASE_URL 환경변수로 연결)
   - 이 파일 하나를 두 곳에서 같이 씀
       · Vercel:      api/index.js 가 이 파일을 불러서 요청을 처리
       · 내 컴퓨터:   server.js 가 이 파일을 불러서 http://localhost:3000 으로 실행
   ===================================================================== */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

/* ---------- 설정 ---------- */
const ON_VERCEL = !!process.env.VERCEL;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
// 관리자 화면은 서버 코드와 함께 묶여 배포되도록 자바스크립트 파일로 불러옴 (Vercel에서 파일을 못 찾는 문제 방지)
const ADMIN_HTML = require('./private/admin-page.js');
const SESSION_DAYS = 14;
const IS_PROD = process.env.NODE_ENV === 'production' || ON_VERCEL;
// Vercel 같은 클라우드에서는 요청이 프록시를 거쳐 들어오므로, 실제 접속자 IP는 X-Forwarded-For 헤더에 있음
const TRUST_PROXY = !!(ON_VERCEL || process.env.TRUST_PROXY);

if (!ADMIN_PASSWORD && !ON_VERCEL) {
  // 내 컴퓨터에서 비밀번호를 정하지 않았으면 실행할 때마다 임시 비밀번호를 만들어 터미널에 보여줌
  ADMIN_PASSWORD = crypto.randomBytes(6).toString('base64url');
  console.log(`\n⚠  ADMIN_PASSWORD가 설정되지 않아 임시 관리자 비밀번호를 만들었습니다: ${ADMIN_PASSWORD}`);
  console.log('   고정하려면 .env 파일에 ADMIN_PASSWORD를 적으세요. (README 참고)\n');
}
// Vercel에서는 ADMIN_PASSWORD를 꼭 환경변수로 정해야 관리자 페이지가 열림 (아래 isAdmin 참고)

/* ---------- 상품 정보 (가격은 반드시 서버 기준으로 계산) ---------- */
const CATALOG = {
  product: 'BK phone',
  colors: [
    { id: 'black',    name: '오닉스 블랙',          hex: '#141518', frame: '#2c2e33', accent: '#a7adb7', tint: '#8fa2c8', extra: 0 },
    { id: 'graphite', name: '그래파이트',           hex: '#3b3d42', frame: '#6a6d73', accent: '#c8ccd3', tint: '#9aa3b5', extra: 0 },
    { id: 'cloud',    name: '클라우드 화이트',      hex: '#ecebe6', frame: '#d9d7d1', accent: '#c9a77c', tint: '#d9c4a3', extra: 0 },
    { id: 'sage',     name: '세이지 그린',          hex: '#b8c3ae', frame: '#a9b0a1', accent: '#e2cfa6', tint: '#9fbf9a', extra: 0 },
    { id: 'blush',    name: '블러쉬 핑크',          hex: '#ebd3cf', frame: '#d9bdb6', accent: '#c98e7c', tint: '#e3a6a0', extra: 0 },
    { id: 'ice',      name: '아이스 블루 (한정판)', hex: '#c9d9e8', frame: '#b3c3d3', accent: '#f2f4f7', tint: '#9cc6ee', extra: 50000 }
  ],
  storage: [
    { id: '256', name: '256GB', price: 1390000 },
    { id: '512', name: '512GB', price: 1590000 }
  ],
  firstOrderDiscountRate: 0.05
};

/* BK pierce (귀를 뚫지 않는 피어싱형 오디오): 색상 + 케이스 옵션 */
const PIERCE_CATALOG = {
  product: 'BK pierce',
  colors: [
    { id: 'p-silver', name: '미러 실버',          hex: '#d9dde3', base: '#1d1f24', glow: '#7fe3ff', extra: 0 },
    { id: 'p-rose',   name: '로즈 골드',          hex: '#e3b7a0', base: '#2a2224', glow: '#ffb3c7', extra: 0 },
    { id: 'p-onyx',   name: '오닉스 블랙',        hex: '#3a3b41', base: '#111215', glow: '#b18cff', extra: 0 },
    { id: 'p-pearl',  name: '펄 화이트 (한정판)', hex: '#f4f2ee', base: '#e6e3dd', glow: '#7fd0ff', extra: 30000 }
  ],
  options: [
    { id: 'std',      name: '기본 케이스',     price: 249000 },
    { id: 'wireless', name: '무선충전 케이스', price: 279000 }
  ]
};

const ORDER_STATUSES = ['주문접수', '결제확인', '배송준비', '배송중', '배송완료', '취소'];

/* ---------- 데이터베이스 (Neon Postgres) ---------- */
// 날짜는 예전처럼 '2026-10-29 17:00:00' 같은 한국 시간 글자로 저장 (화면 표시 그대로 사용)
const NOW_KST = "to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')";

let pool = null;
function getPool() {
  if (!DATABASE_URL) {
    throw new HttpError(500, '데이터베이스 주소(DATABASE_URL)가 설정되지 않았어요. DEPLOY.md를 확인해 주세요.');
  }
  if (!pool) {
    // 서버리스에서는 함수가 여러 개 동시에 뜰 수 있으므로 함수 하나당 연결 수를 적게 유지
    pool = new Pool({ connectionString: DATABASE_URL, max: ON_VERCEL ? 3 : 10, idleTimeoutMillis: 10_000 });
    pool.on('error', e => console.error('DB 연결 오류:', e.message));
  }
  return pool;
}

// 맨 앞의 잠금: Vercel 함수 여러 개가 동시에 처음 켜져도 테이블을 한 번에 하나씩만 만들도록 함
const SCHEMA = `
  SELECT pg_advisory_xact_lock(510518);

  CREATE TABLE IF NOT EXISTS customers (
    id            SERIAL  PRIMARY KEY,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    phone         TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    marketing     INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT ${NOW_KST}
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT    PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    expires_at  BIGINT  NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL  PRIMARY KEY,
    order_no        TEXT    NOT NULL UNIQUE,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    product         TEXT    NOT NULL DEFAULT 'BK phone',
    color_id        TEXT    NOT NULL,
    color_name      TEXT    NOT NULL,
    storage         TEXT    NOT NULL,
    unit_price      INTEGER NOT NULL,
    discount        INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL,
    recipient       TEXT    NOT NULL,
    recipient_phone TEXT    NOT NULL,
    zipcode         TEXT    NOT NULL,
    address         TEXT    NOT NULL,
    memo            TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT '주문접수',
    created_at      TEXT    NOT NULL DEFAULT ${NOW_KST},
    updated_at      TEXT    NOT NULL DEFAULT ${NOW_KST}
  );
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_customer ON sessions(customer_id);
`;

// 테이블은 처음 요청이 올 때 한 번만 만들어 둠 (이미 있으면 그대로 사용)
let readyPromise = null;
function ready() {
  if (!readyPromise) {
    readyPromise = getPool().query(SCHEMA).catch(e => { readyPromise = null; throw e; });
  }
  return readyPromise;
}

async function one(sql, params) { await ready(); return (await getPool().query(sql, params)).rows[0] || null; }
async function all(sql, params) { await ready(); return (await getPool().query(sql, params)).rows; }
async function run(sql, params) { await ready(); return getPool().query(sql, params); }

// COUNT, SUM 결과는 Postgres에서 큰 숫자형이라 ::int 로 바꿔서 화면에 숫자로 전달
const q = {
  insertCustomer: (name, email, phone, hash, marketing) =>
    one('INSERT INTO customers (name, email, phone, password_hash, marketing) VALUES ($1, $2, $3, $4, $5) RETURNING id', [name, email, phone, hash, marketing]),
  customerByEmail: email => one('SELECT * FROM customers WHERE email = $1', [email]),
  customerById: id => one('SELECT id, name, email, phone, marketing, created_at FROM customers WHERE id = $1', [id]),
  insertSession: (hash, customerId, expiresAt) =>
    run('INSERT INTO sessions (token_hash, customer_id, expires_at) VALUES ($1, $2, $3)', [hash, customerId, expiresAt]),
  sessionByHash: (hash, now) => one('SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > $2', [hash, now]),
  deleteSession: hash => run('DELETE FROM sessions WHERE token_hash = $1', [hash]),
  purgeSessions: now => run('DELETE FROM sessions WHERE expires_at <= $1', [now]),
  activeOrderCount: async customerId =>
    (await one("SELECT COUNT(*)::int AS n FROM orders WHERE customer_id = $1 AND status <> '취소'", [customerId])).n,
  insertOrder: p => one(`INSERT INTO orders
    (order_no, customer_id, product, color_id, color_name, storage, unit_price, discount, total, recipient, recipient_phone, zipcode, address, memo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`, p),
  orderById: id => one('SELECT * FROM orders WHERE id = $1', [id]),
  ordersMine: customerId => all('SELECT order_no, product, color_name, storage, total, status, created_at FROM orders WHERE customer_id = $1 ORDER BY id DESC LIMIT 20', [customerId]),
  adminOrders: () => all(`SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
    FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.id DESC LIMIT 500`),
  adminCustomers: () => all(`SELECT c.id, c.name, c.email, c.phone, c.marketing, c.created_at,
    (SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = c.id) AS order_count
    FROM customers c ORDER BY c.id DESC LIMIT 1000`),
  adminStats: () => one(`SELECT
    (SELECT COUNT(*)::int FROM customers) AS customers,
    (SELECT COUNT(*)::int FROM orders) AS orders,
    (SELECT COUNT(*)::int FROM orders WHERE status = '주문접수') AS new_orders,
    (SELECT COALESCE(SUM(total),0)::bigint::float8 FROM orders WHERE status <> '취소') AS revenue`),
  updateStatus: (status, id) =>
    one(`UPDATE orders SET status = $1, updated_at = ${NOW_KST} WHERE id = $2 RETURNING *`, [status, id])
};

/* ---------- 비밀번호 / 세션 ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [algo, saltHex, hashHex] = String(stored).split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

async function createSession(res, customerId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = SESSION_DAYS * 24 * 3600;
  await q.insertSession(sha256(token), customerId, Date.now() + maxAge * 1000);
  setCookie(res, `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${IS_PROD ? '; Secure' : ''}`);
  // 서버리스에서는 '1시간마다 청소' 타이머를 쓸 수 없으므로, 로그인할 때 가끔 만료된 세션을 지움
  if (Math.random() < 0.1) q.purgeSessions(Date.now()).catch(() => {});
}
async function currentCustomer(req) {
  const token = parseCookies(req).sid;
  if (!token) return null;
  const s = await q.sessionByHash(sha256(token), Date.now());
  return s ? q.customerById(s.customer_id) : null;
}

/* ---------- 요청 / 응답 도우미 ---------- */
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) {
      try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch { /* 잘못된 쿠키는 무시 */ }
    }
  });
  return out;
}
function setCookie(res, value) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, value) : value);
}
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function readJson(req, limit = 20 * 1024) {
  // JSON 요청만 받음 → 다른 사이트의 폼 전송(CSRF) 차단에도 도움
  if (!String(req.headers['content-type'] || '').includes('application/json'))
    return Promise.reject(new HttpError(415, 'JSON 형식으로 보내 주세요.'));

  // Vercel은 요청 내용을 미리 읽어서 req.body에 넣어 주기도 함 → 그 경우 그대로 사용
  if (ON_VERCEL) {
    let body;
    try { body = req.body; } catch { return Promise.reject(new HttpError(400, '잘못된 JSON입니다.')); }
    if (body !== undefined) {
      if (Buffer.isBuffer(body) || typeof body === 'string') {
        const text = body.toString('utf8');
        if (text.length > limit) return Promise.reject(new HttpError(413, '요청이 너무 큽니다.'));
        try { return Promise.resolve(JSON.parse(text || '{}')); }
        catch { return Promise.reject(new HttpError(400, '잘못된 JSON입니다.')); }
      }
      if (JSON.stringify(body ?? {}).length > limit) return Promise.reject(new HttpError(413, '요청이 너무 큽니다.'));
      return Promise.resolve(body ?? {});
    }
  }

  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, '요청이 너무 큽니다.')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new HttpError(400, '잘못된 JSON입니다.')); }
    });
    req.on('error', reject);
  });
}

/* 간단한 요청 횟수 제한 (로그인·가입 무차별 시도 방지)
   ※ 서버리스에서는 함수마다 따로 세기 때문에 대략적인 제한임 */
const hits = new Map();
function rateLimit(req, key, max, windowMs) {
  // 내 컴퓨터에서 테스트할 때는 제한하지 않음. 실제 서비스에서만 적용
  if (!IS_PROD) return;
  const fwd = TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
  const ip = fwd || (req.socket && req.socket.remoteAddress) || 'x';
  const k = `${key}:${ip}`, now = Date.now();
  if (hits.size > 5000) for (const [hk, h] of hits) if (h.reset < now) hits.delete(hk);
  const h = hits.get(k);
  if (!h || h.reset < now) { hits.set(k, { n: 1, reset: now + windowMs }); return; }
  if (++h.n > max) throw new HttpError(429, '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
}

/* ---------- 입력값 검사 ---------- */
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const digits = v => String(v ?? '').replace(/[^0-9]/g, '');
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = v => /^01[0-9]{8,9}$/.test(v);
function need(cond, msg) { if (!cond) throw new HttpError(400, msg); }

/* ---------- 관리자 인증 (HTTP Basic) ---------- */
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false; // 비밀번호를 정하지 않았으면 관리자 페이지는 잠겨 있음
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [u, ...rest] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(':');
  const p = rest.join(':');
  const a = Buffer.from(sha256(`${u}:${p}`)), b = Buffer.from(sha256(`${ADMIN_USER}:${ADMIN_PASSWORD}`));
  return crypto.timingSafeEqual(a, b);
}
function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="BumBum Admin", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(ADMIN_PASSWORD ? '관리자 인증이 필요합니다.' : '관리자 비밀번호(ADMIN_PASSWORD)가 설정되지 않았어요. Vercel 환경변수에 추가해 주세요.');
  return false;
}

/* ---------- API ---------- */
const publicCustomer = c => c && ({ id: c.id, name: c.name, email: c.email, phone: c.phone });

async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/catalog') return send(res, 200, CATALOG);
  if (route === 'GET /api/catalog/pierce' || route === 'GET /api/catalog/buds') return send(res, 200, PIERCE_CATALOG);

  // 회원가입
  if (route === 'POST /api/signup') {
    rateLimit(req, 'signup', 10, 10 * 60 * 1000);
    const b = await readJson(req);
    const name = str(b.name, 40), email = str(b.email, 120).toLowerCase(), phone = digits(b.phone);
    const pw = String(b.password ?? '');
    need(name, '이름을 입력해 주세요.');
    need(isEmail(email), '올바른 이메일 형식이 아니에요.');
    need(isPhone(phone), '휴대폰 번호를 확인해 주세요.');
    need(pw.length >= 8 && pw.length <= 100 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw), '비밀번호는 영문+숫자 포함 8자 이상이어야 해요.');
    need(b.agree === true, '필수 약관에 동의해 주세요.');
    if (await q.customerByEmail(email)) throw new HttpError(409, '이미 가입된 이메일이에요. 로그인해 주세요.');
    let r;
    try { r = await q.insertCustomer(name, email, phone, hashPassword(pw), b.marketing ? 1 : 0); }
    catch (e) {
      // 같은 이메일로 거의 동시에 두 번 가입하면 DB의 UNIQUE 규칙이 막아 줌
      if (e.code === '23505') throw new HttpError(409, '이미 가입된 이메일이에요. 로그인해 주세요.');
      throw e;
    }
    await createSession(res, r.id);
    console.log(`👤 새 회원가입: ${name} <${email}>`);
    return send(res, 201, { customer: publicCustomer(await q.customerById(r.id)), firstOrderDiscount: true });
  }

  // 로그인
  if (route === 'POST /api/login') {
    rateLimit(req, 'login', 20, 10 * 60 * 1000);
    const b = await readJson(req);
    const email = str(b.email, 120).toLowerCase(), pw = String(b.password ?? '');
    const c = await q.customerByEmail(email);
    if (!c || !verifyPassword(pw, c.password_hash)) throw new HttpError(401, '이메일 또는 비밀번호가 맞지 않아요.');
    await createSession(res, c.id);
    return send(res, 200, { customer: publicCustomer(c), firstOrderDiscount: (await q.activeOrderCount(c.id)) === 0 });
  }

  // 로그아웃
  if (route === 'POST /api/logout') {
    const token = parseCookies(req).sid;
    if (token) await q.deleteSession(sha256(token));
    setCookie(res, `sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${IS_PROD ? '; Secure' : ''}`);
    return send(res, 200, { ok: true });
  }

  // 내 정보
  if (route === 'GET /api/me') {
    const c = await currentCustomer(req);
    if (!c) return send(res, 200, { customer: null });
    return send(res, 200, { customer: publicCustomer(c), firstOrderDiscount: (await q.activeOrderCount(c.id)) === 0 });
  }

  // 주문하기
  if (route === 'POST /api/orders') {
    const c = await currentCustomer(req);
    if (!c) throw new HttpError(401, '로그인이 필요해요.');
    rateLimit(req, 'order', 30, 10 * 60 * 1000);
    const b = await readJson(req);
    // product: 'phone'(기본) 또는 'pierce'. 옵션과 가격은 서버의 상품표에서 찾음
    const isBuds = b.product === 'pierce' || b.product === 'buds';
    const cat = isBuds ? PIERCE_CATALOG : CATALOG;
    const color = cat.colors.find(x => x.id === b.colorId);
    const storage = isBuds ? PIERCE_CATALOG.options.find(x => x.id === b.optionId)
                           : CATALOG.storage.find(x => x.id === b.storageId);
    need(color && storage, '상품 옵션을 다시 선택해 주세요.');
    const recipient = str(b.recipient, 40), rphone = digits(b.recipientPhone);
    const zipcode = digits(b.zipcode).slice(0, 5), address = str(b.address, 200), memo = str(b.memo, 200);
    need(recipient, '받는 분 이름을 입력해 주세요.');
    need(isPhone(rphone), '받는 분 연락처를 확인해 주세요.');
    need(zipcode.length === 5, '우편번호 5자리를 입력해 주세요.');
    need(address.length >= 5, '배송 주소를 입력해 주세요.');

    const unit = storage.price + color.extra;
    const first = (await q.activeOrderCount(c.id)) === 0;
    const discount = first ? Math.round(unit * CATALOG.firstOrderDiscountRate / 10) * 10 : 0;
    const total = unit - discount;
    // 주문번호 날짜는 한국 시간 기준 (Vercel 서버 시계는 UTC라서 따로 맞춤)
    const kst = new Date(Date.now() + 9 * 3600 * 1000), pad = n => String(n).padStart(2, '0');
    const orderNo = `BK${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const order = await q.insertOrder([orderNo, c.id, cat.product, color.id, color.name, storage.name, unit, discount, total, recipient, rphone, zipcode, address, memo]);
    console.log(`🛒 새 주문 ${orderNo} | ${c.name} | ${cat.product} ${color.name} ${storage.name} | ₩${total.toLocaleString('ko-KR')}`);
    return send(res, 201, { order: { order_no: order.order_no, product: order.product, color_name: order.color_name, storage: order.storage, unit_price: unit, discount, total, status: order.status, created_at: order.created_at } });
  }

  // 내 주문 내역
  if (route === 'GET /api/orders/mine') {
    const c = await currentCustomer(req);
    if (!c) throw new HttpError(401, '로그인이 필요해요.');
    return send(res, 200, { orders: await q.ordersMine(c.id) });
  }

  // ----- 관리자 -----
  if (url.pathname.startsWith('/api/admin/')) {
    if (!requireAdmin(req, res)) return;
    if (route === 'GET /api/admin/stats') return send(res, 200, await q.adminStats());
    if (route === 'GET /api/admin/orders') return send(res, 200, { orders: await q.adminOrders(), statuses: ORDER_STATUSES });
    if (route === 'GET /api/admin/customers') return send(res, 200, { customers: await q.adminCustomers() });
    const m = url.pathname.match(/^\/api\/admin\/orders\/(\d+)$/);
    if (m && req.method === 'PATCH') {
      const b = await readJson(req);
      need(ORDER_STATUSES.includes(b.status), '알 수 없는 주문 상태예요.');
      const order = await q.updateStatus(b.status, Number(m[1]));
      if (!order) throw new HttpError(404, '주문을 찾을 수 없어요.');
      return send(res, 200, { order });
    }
  }

  throw new HttpError(404, '없는 주소예요.');
}

/* ---------- 화면 파일 ----------
   Vercel에서는 public 폴더를 Vercel이 직접 보여 주고, 이 코드는 /admin 만 담당함.
   내 컴퓨터에서는 이 코드가 모든 화면 파일을 보여 줌. */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };

async function serveFile(res, file) {
  let data;
  try { data = await fs.readFile(file); }
  catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(data);
}
async function serveStatic(req, res, url) {
  if (url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin.html') {
    if (!requireAdmin(req, res)) return;
    res.setHeader('X-Frame-Options', 'DENY');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(ADMIN_HTML);
  }
  if (url.pathname === '/pierce' || url.pathname === '/buds' || url.pathname === '/buds.html') return serveFile(res, path.join(PUBLIC_DIR, 'pierce.html'));
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(404); return res.end(); }
  return serveFile(res, file);
}

/* ---------- 요청 처리 (Vercel과 내 컴퓨터 공통) ---------- */
async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    await serveStatic(req, res, url);
  } catch (e) {
    if (res.headersSent) { console.error(e); return res.end(); }
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: '서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' });
  }
}

module.exports = handler;
module.exports.ADMIN_USER = ADMIN_USER;
module.exports.getAdminPassword = () => ADMIN_PASSWORD;
module.exports.hasDatabase = () => !!DATABASE_URL;
