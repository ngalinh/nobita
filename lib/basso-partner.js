/**
 * Basso Partner API client — web_order/create (admin mua hàng).
 *
 * Auth (kiểu Doraemon):
 * - Env chỉ cần BASSO_API_KEY (+ BASSO_BASE_URL)
 * - Bearer access_token lấy từ phiên đăng nhập ai.basso.vn (localStorage ai_chat_user.token)
 * - Fallback local: BASSO_EMAIL/PASS hoặc data/config.json (không nằm wizard)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TAB_TO_STATUS = {
  order: "can_mua_order",
  checkout: "can_mua_co",
  need_handle: "can_xu_ly",
};

let tokenCache = {
  accessToken: "",
  expiresAt: 0,
  user: null,
};

function readPartnerConfig(configFile) {
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(configFile, "utf8"));
  } catch {
    cfg = {};
  }
  const p = cfg.partner || {};
  const rawAdmin = String(process.env.BASSO_ADMIN_BASE_URL || p.adminBaseUrl || "")
    .trim()
    .replace(/\/$/, "");
  // Wizard mặc định "-" = tắt; không dùng localhost từ máy local lên platform
  const adminBaseUrl =
    !rawAdmin || rawAdmin === "-" || /^none$/i.test(rawAdmin) ? "" : rawAdmin;
  return {
    enabled: p.enabled !== false,
    baseUrl: String(process.env.BASSO_BASE_URL || p.baseUrl || "https://basso.vn").replace(/\/$/, ""),
    /** Base URL cho API Đơn Admin (nếu prod chưa deploy endpoint) */
    adminBaseUrl,
    apiKey: String(process.env.BASSO_API_KEY || p.apiKey || "").trim(),
    email: String(process.env.BASSO_EMAIL || p.email || "").trim(),
    password: String(process.env.BASSO_PASS || p.password || "").trim(),
  };
}

/** Wizard / deploy: chỉ cần API key. Email/pass không bắt buộc. */
function partnerConfigured(cfg) {
  return !!(cfg.enabled && cfg.baseUrl && cfg.apiKey);
}

function hasServiceCredentials(cfg) {
  return !!(cfg && cfg.email && cfg.password);
}

/** Authorization: Bearer <partner access_token> từ browser (ai_chat_user). */
function extractBearerToken(req) {
  const h = (req && req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? String(m[1]).trim() : "";
}

function cacheKeyForToken(userToken) {
  if (!userToken) return "svc";
  return "u:" + crypto.createHash("sha256").update(String(userToken)).digest("hex").slice(0, 16);
}

async function partnerFetch(cfg, pathname, opts = {}) {
  const url = `${cfg.baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const headers = {
    "X-Partner-Api-Key": cfg.apiKey,
    ...(opts.headers || {}),
  };
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body: opts.body,
    signal: opts.signal,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Partner API non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  return { status: res.status, json };
}

async function login(cfg, { force = false } = {}) {
  if (!hasServiceCredentials(cfg)) {
    throw new Error(
      "Thiếu token Partner — đăng nhập ai.basso.vn rồi mở lại Nobita (hoặc set BASSO_EMAIL/PASS local)"
    );
  }
  const now = Math.floor(Date.now() / 1000);
  if (!force && tokenCache.accessToken && tokenCache.expiresAt > now + 60) {
    return tokenCache;
  }
  return loginWithCredentials(cfg, { email: cfg.email, pass: cfg.password });
}

/** Proxy login kiểu Doraemon — email/pass từ UI / platform chat-login. */
async function loginWithCredentials(cfg, { email, pass }) {
  const body = new URLSearchParams({
    email: String(email || "").trim(),
    pass: String(pass || ""),
  }).toString();
  const { json } = await partnerFetch(cfg, "/partner/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!json.success || !json.data || !json.data.access_token) {
    throw new Error(json.message || "Login Partner API thất bại");
  }
  const now = Math.floor(Date.now() / 1000);
  const auth = {
    accessToken: json.data.access_token,
    expiresAt: Number(json.data.expires_at || now + 3600),
    user: json.data.user || null,
  };
  // Cache chỉ khi đúng service credentials
  if (
    hasServiceCredentials(cfg) &&
    String(email || "").trim() === cfg.email &&
    String(pass || "") === cfg.password
  ) {
    tokenCache = auth;
  }
  return { ...auth, raw: json };
}

async function resolveAccessToken(cfg, { userToken = "", force = false } = {}) {
  if (userToken) {
    return { accessToken: userToken, expiresAt: 0, user: null, fromUser: true };
  }
  return login(cfg, { force });
}

async function withToken(cfg, fn, opts = {}) {
  let auth = await resolveAccessToken(cfg, opts);
  try {
    return await fn(auth.accessToken);
  } catch (err) {
    const msg = String(err.message || err);
    if (!opts.userToken && /access token|Unauthorized|401/i.test(msg)) {
      auth = await resolveAccessToken(cfg, { ...opts, force: true });
      return await fn(auth.accessToken);
    }
    throw err;
  }
}

async function getWebOrderCreateMeta(cfg, { userToken } = {}) {
  return withToken(
    cfg,
    async (token) => {
      const { json } = await partnerFetch(cfg, "/partner/getWebOrderCreateMeta", { token });
      if (!json.success) throw new Error(json.message || "getWebOrderCreateMeta thất bại");
      return json.data || {};
    },
    { userToken }
  );
}

async function getWebOrderCreateListPage(cfg, { tab = "order", page = 1, pageSize, userToken } = {}) {
  return withToken(
    cfg,
    async (token) => {
      const q = new URLSearchParams();
      if (tab) q.set("tab", tab);
      if (page) q.set("page", String(page));
      if (pageSize) q.set("page_size", String(pageSize));
      const qs = q.toString();
      const { json } = await partnerFetch(cfg, `/partner/getWebOrderCreateList${qs ? `?${qs}` : ""}`, {
        token,
      });
      if (!json.success) throw new Error(json.message || "getWebOrderCreateList thất bại");
      return json.data || {};
    },
    { userToken }
  );
}

/** Lấy hết trang của 1 tab */
async function getWebOrderCreateListAll(cfg, tab = "order", { userToken } = {}) {
  const first = await getWebOrderCreateListPage(cfg, { tab, page: 1, userToken });
  const orders = [...(first.orders || [])];
  const items = [...(first.items || [])];
  const totalPage = Number((first.pagination && first.pagination.total_page) || 1);
  for (let page = 2; page <= totalPage; page++) {
    const next = await getWebOrderCreateListPage(cfg, { tab, page, userToken });
    orders.push(...(next.orders || []));
    items.push(...(next.items || []));
  }
  return {
    tab: first.tab || tab,
    orders,
    items,
    total_pending: first.total_pending,
    websites: first.websites || [],
    pagination: first.pagination || null,
    user_id: first.user_id,
  };
}

function normalizeWebsiteKey(raw) {
  let s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/\s+/g, "");
  s = s.replace(/\.(com|net|org|co|us|uk|vn)$/i, "");
  return s;
}

/**
 * Gọi API trên baseUrl; nếu 404 và có adminBaseUrl thì thử lại.
 */
async function partnerFetchWithAdminFallback(cfg, pathname, opts = {}) {
  try {
    return await partnerFetch(cfg, pathname, opts);
  } catch (err) {
    if (!cfg.adminBaseUrl || cfg.adminBaseUrl === cfg.baseUrl) throw err;
    const adminCfg = { ...cfg, baseUrl: cfg.adminBaseUrl };
    return partnerFetch(adminCfg, pathname, opts);
  }
}

async function getLastWebPaymentByWebsite(cfg, { days = 180, websites = [], userToken } = {}) {
  // Ưu tiên adminBaseUrl — endpoint này thường chưa deploy trên basso.vn (404)
  const tryBases = [];
  if (cfg.adminBaseUrl) tryBases.push(cfg.adminBaseUrl);
  if (cfg.baseUrl && cfg.baseUrl !== cfg.adminBaseUrl) tryBases.push(cfg.baseUrl);
  if (!tryBases.length && cfg.baseUrl) tryBases.push(cfg.baseUrl);

  let lastErr;
  for (const base of tryBases) {
    const localCfg = { ...cfg, baseUrl: base };
    try {
      const data = await withToken(
        localCfg,
        async (token) => {
          const q = new URLSearchParams();
          if (days) q.set("days", String(days));
          if (websites && websites.length) q.set("websites", websites.join(","));
          const qs = q.toString();
          const { status, json } = await partnerFetch(
            localCfg,
            `/partner/getLastWebPaymentByWebsite${qs ? `?${qs}` : ""}`,
            { token }
          );
          if (status === 404) {
            throw Object.assign(new Error("not found"), { code: 404 });
          }
          if (!json.success) throw new Error(json.message || "getLastWebPaymentByWebsite thất bại");
          return json.data || {};
        },
        { userToken }
      );
      return { ...(data || {}), _sourceBase: base };
    } catch (err) {
      lastErr = err;
      if (err && err.code === 404) continue;
      // non-JSON 404 pages also
      if (/404|not found|non-JSON/i.test(String(err.message || ""))) continue;
      throw err;
    }
  }
  throw lastErr || new Error("getLastWebPaymentByWebsite thất bại");
}

/**
 * Tạo đơn Admin (web_orders) — POST /partner/createWebOrder
 * Ưu tiên baseUrl (prod đã có); fallback adminBaseUrl.
 */
async function createWebOrder(cfg, payload, { userToken } = {}) {
  const tryBases = [cfg.baseUrl];
  if (cfg.adminBaseUrl && cfg.adminBaseUrl !== cfg.baseUrl) {
    tryBases.push(cfg.adminBaseUrl);
  }

  let lastErr;
  for (const base of tryBases) {
    const localCfg = { ...cfg, baseUrl: base };
    try {
      return await withToken(
        localCfg,
        async (token) => {
          const { status, json } = await partnerFetch(localCfg, "/partner/createWebOrder", {
            method: "POST",
            token,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload || {}),
          });
          if (status === 404) {
            throw Object.assign(new Error("createWebOrder not found"), { code: 404 });
          }
          if (!json.success) {
            const missing =
              json.data && Array.isArray(json.data.missing) && json.data.missing.length
                ? ` (thiếu: ${json.data.missing.join(", ")})`
                : "";
            throw new Error((json.message || "createWebOrder thất bại") + missing);
          }
          return { ...(json.data || {}), message: json.message || "OK", _sourceBase: base };
        },
        { userToken }
      );
    } catch (err) {
      lastErr = err;
      if (err && err.code === 404) continue;
      if (/404|not found|non-JSON/i.test(String(err.message || ""))) continue;
      throw err;
    }
  }
  throw lastErr || new Error("createWebOrder thất bại");
}

/**
 * Map website_key → { ptttName, paymentId, ... } từ Đơn Admin.
 */
function buildWebsitePtttFromAdmin(byWebsite) {
  const map = {};
  const raw = byWebsite && typeof byWebsite === "object" ? byWebsite : {};
  for (const [key, row] of Object.entries(raw)) {
    if (!row || !row.payment) continue;
    const k = normalizeWebsiteKey(key || row.website || row.website_raw);
    if (!k) continue;
    map[k] = {
      ptttName: String(row.payment || "").trim(),
      paymentId: row.payment_id != null ? String(row.payment_id) : "",
      website: row.website || row.website_raw || k,
      orderNumber: row.order_number || "",
      boughtDate: row.bought_date || "",
      at: row.created_time ? new Date(Number(row.created_time) * 1000).toISOString() : "",
      source: "admin",
    };
  }
  return map;
}

/** Khớp tên PTTT Admin → id PTTT Excel trong settings Nobita */
function matchLocalPtttId(ptttList, paymentName) {
  const want = String(paymentName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!want) return "";
  const list = Array.isArray(ptttList) ? ptttList : [];
  const exact = list.find((p) => String(p.name || "").trim().toLowerCase().replace(/\s+/g, " ") === want);
  if (exact) return exact.id;
  const loose = list.find((p) => {
    const n = String(p.name || "").trim().toLowerCase().replace(/\s+/g, " ");
    return n && (want.includes(n) || n.includes(want));
  });
  return loose ? loose.id : "";
}

function unixToSaleEnds(raw) {
  const n = Number(raw);
  if (!n) return "";
  const d = new Date(n * 1000);
  if (Number.isNaN(d.getTime())) return "";
  const hh = d.getHours();
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${hh}h ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function variationValue(variations, names) {
  const list = Array.isArray(variations) ? variations : [];
  for (const want of names) {
    const hit = list.find((v) => String(v.name || "").toLowerCase() === want.toLowerCase());
    if (hit && hit.value) return String(hit.value);
  }
  return "";
}

function picNameById(picList, userPicId) {
  if (userPicId == null || userPicId === "" || Number(userPicId) === 0) return "";
  const id = String(userPicId);
  const hit = (picList || []).find((p) => String(p.user_id) === id);
  return hit ? String(hit.name || "").trim() : "";
}

function mapItem(raw) {
  return {
    id: String(raw.id),
    name: raw.name || "",
    url: raw.link || "",
    image: raw.image_path || "",
    size: variationValue(raw.variations, ["Size", "size"]),
    color: variationValue(raw.variations, ["Color", "color", "Màu", "Colour"]),
    qty: Number(raw.quantity || 1),
    price: Number(raw.price || 0),
    note: raw.note || "",
    orderNo: "",
    tracking: "",
    status: raw.status || "pending",
  };
}

function mapOrder(raw, status, itemsByOrderId, picList, overlay) {
  const bassoId = String(raw.id);
  const code = String(raw.order_code || raw.id);
  const ov = (overlay && (overlay[code] || overlay[bassoId])) || {};
  const handlerFromApi = picNameById(picList, raw.user_pic_id);
  const orderItems = itemsByOrderId.get(bassoId) || itemsByOrderId.get(code) || [];
  return {
    id: code,
    bassoId,
    status,
    customerName: raw.customer_name || raw.name || "",
    customerType: raw.customer_group_name || "",
    total: Number(raw.total || 0),
    website: raw.website || "",
    rate:
      raw.currency_rate != null && raw.currency_rate !== ""
        ? `${Number(raw.currency_rate).toLocaleString("en-US")}đ`
        : "",
    currencySymbol: raw.currency_symbol || "$",
    saleEnds: unixToSaleEnds(raw.sale_ends),
    staff: raw.user || "",
    handler: ov.handler != null ? ov.handler : handlerFromApi,
    handlerId: raw.user_pic_id != null ? String(raw.user_pic_id) : "",
    note: ov.note != null ? ov.note : raw.admin_note || "",
    phone: "",
    brand: raw.brand || "",
    branch: raw.branch || "",
    approveTime: raw.approve_time || "",
    isUrgentBuy: String(raw.is_urgent_buy || "0") === "1",
    items: orderItems.map(mapItem),
  };
}

function indexItemsByOrder(items) {
  const map = new Map();
  for (const it of items || []) {
    const key = String(it.order_id || "");
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  return map;
}

/**
 * Tải 3 tab order/checkout/need_handle → mảng đơn Nobita.
 */
async function fetchAllWebOrders(cfg, { picList = [], overlay = {}, userToken } = {}) {
  const tabs = ["order", "checkout", "need_handle"];
  const all = [];
  const pendingByTab = {};
  const websiteSet = new Set();
  for (const tab of tabs) {
    const data = await getWebOrderCreateListAll(cfg, tab, { userToken });
    const byOrder = indexItemsByOrder(data.items);
    const status = TAB_TO_STATUS[tab] || "can_mua_order";
    pendingByTab[status] = Number(data.total_pending || 0);
    for (const raw of data.orders || []) {
      all.push(mapOrder(raw, status, byOrder, picList, overlay));
    }
    // Dropdown site Basso: adidas.com / calvinklein.us (không lấy từ order.website đã cắt TLD)
    for (const w of data.websites || []) {
      const name = typeof w === "string" ? w : w && w.name;
      if (name && String(name).trim()) websiteSet.add(String(name).trim());
    }
  }
  return {
    orders: all,
    pendingByTab,
    websites: [...websiteSet].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
  };
}

module.exports = {
  TAB_TO_STATUS,
  readPartnerConfig,
  partnerConfigured,
  hasServiceCredentials,
  extractBearerToken,
  cacheKeyForToken,
  login,
  loginWithCredentials,
  getWebOrderCreateMeta,
  getWebOrderCreateListPage,
  getWebOrderCreateListAll,
  fetchAllWebOrders,
  getLastWebPaymentByWebsite,
  createWebOrder,
  buildWebsitePtttFromAdmin,
  matchLocalPtttId,
  normalizeWebsiteKey,
  mapOrder,
  mapItem,
  picNameById,
};
