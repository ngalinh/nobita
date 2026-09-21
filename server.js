const express = require("express");
const path = require("path");
const fs = require("fs");

// Load .env trước mọi module phụ thuộc process.env
// Ưu tiên: server/.env (platform ai.basso.vn) → rồi .env gốc (local)
(() => {
  const candidates = [
    path.join(__dirname, "server", ".env"),
    path.join(__dirname, ".env"),
  ];
  for (const envPath of candidates) {
    try {
      if (!fs.existsSync(envPath)) continue;
      for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i < 1) continue;
        const key = t.slice(0, i).trim();
        let val = t.slice(i + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {
      /* ignore */
    }
  }
})();

const { chromium } = require("playwright");
const { scrapeWithBrightData, resolveDataset } = require("./lib/brightdata");
const { listDatasets } = require("./lib/brightdata-datasets");
const { sendOrderToSheets, sendBuyListToSheets, pullReverseFromSheet, SPREADSHEET_ID, defaultSheetUrl, explainGoogleError, loadCredentials, CREDENTIALS_FILE, defaultColumnMap, normalizeColumnMap, COLUMN_FIELDS, ALL_COLUMN_FIELDS } = require("./lib/sheets");
const {
  readPartnerConfig,
  partnerConfigured,
  getWebOrderCreateMeta,
  fetchAllWebOrders,
  getLastWebPaymentByWebsite,
  buildWebsitePtttFromAdmin,
  matchLocalPtttId,
  normalizeWebsiteKey,
  createWebOrder,
} = require("./lib/basso-partner");
const {
  readTelegramConfig,
  telegramConfigured,
  runTelegramNotifyCheck,
  startTelegramNobitaBot,
  sendTelegramMessage,
} = require("./lib/telegram-nobita");
const {
  getRequestUser,
  DEV_MODE: NOBITA_DEV_MODE,
  BASSO_AUTH_URL,
} = require("./lib/basso-session-auth");

const app = express();
const PORT = process.env.PORT || 3847;
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const MOCK_ORDERS_FILE = path.join(DATA_DIR, "mock-orders.json");
const BUY_LIST_FILE = path.join(DATA_DIR, "buy-list.json");
const ORDER_OVERLAYS_FILE = path.join(DATA_DIR, "order-overlays.json");
const ITEM_OVERLAYS_FILE = path.join(DATA_DIR, "item-overlays.json");
const WEBSITE_PTTT_FILE = path.join(DATA_DIR, "website-pttt.json");

function loadFallbackCreateMeta() {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "partner-create-meta.json"), "utf8")
    );
    return (raw && raw.data) || raw || null;
  } catch {
    return null;
  }
}

/** Cache đơn live từ Partner API */
let liveOrdersCache = {
  at: 0,
  orders: [],
  meta: null,
  pendingByTab: {},
  source: "mock",
  websitePttt: {},
  websitePtttSource: "",
};
const LIVE_CACHE_MS = 30_000;
let websitePtttCache = { at: 0, map: {}, source: "" };
const WEBSITE_PTTT_CACHE_MS = 5 * 60_000;

function readOrderOverlays() {
  try {
    const raw = JSON.parse(fs.readFileSync(ORDER_OVERLAYS_FILE, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeOrderOverlays(map) {
  fs.writeFileSync(ORDER_OVERLAYS_FILE, JSON.stringify(map || {}, null, 2), "utf8");
}

function readItemOverlays() {
  try {
    const raw = JSON.parse(fs.readFileSync(ITEM_OVERLAYS_FILE, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeItemOverlays(map) {
  fs.writeFileSync(ITEM_OVERLAYS_FILE, JSON.stringify(map || {}, null, 2), "utf8");
}

function normalizeWebsiteKeyLocal(raw) {
  return normalizeWebsiteKey(raw);
}

function readWebsitePttt() {
  try {
    const raw = JSON.parse(fs.readFileSync(WEBSITE_PTTT_FILE, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeWebsitePttt(map) {
  fs.writeFileSync(WEBSITE_PTTT_FILE, JSON.stringify(map || {}, null, 2), "utf8");
}

/** Ghi nhớ PTTT vừa gửi theo website → fallback nếu API Admin lỗi */
function rememberWebsitePttt(websites, pttt) {
  if (!pttt || !pttt.id) return;
  const map = readWebsitePttt();
  const at = new Date().toISOString();
  const list = Array.isArray(websites) ? websites : [websites];
  for (const w of list) {
    const key = normalizeWebsiteKeyLocal(w);
    if (!key) continue;
    map[key] = {
      ptttId: String(pttt.id),
      ptttName: String(pttt.name || ""),
      website: String(w || "").trim(),
      at,
      source: "local_send",
    };
  }
  writeWebsitePttt(map);
}

/**
 * Ưu tiên: Đơn Admin Basso → file local (lần gửi Nobita).
 * Gắn ptttId Excel nếu tên PTTT khớp settings.
 */
function resolveWebsitePtttMap(adminMap, settingsPttt) {
  const local = readWebsitePttt();
  const merged = { ...local };
  for (const [key, row] of Object.entries(adminMap || {})) {
    const name = row.ptttName || row.payment || "";
    merged[key] = {
      ...row,
      ptttName: name,
      ptttId: matchLocalPtttId(settingsPttt, name) || row.ptttId || "",
      source: row.source || "admin",
    };
  }
  // local_send: bổ sung ptttId nếu thiếu
  for (const [key, row] of Object.entries(merged)) {
    if (!row.ptttId && row.ptttName) {
      row.ptttId = matchLocalPtttId(settingsPttt, row.ptttName) || "";
    }
  }
  return merged;
}

async function loadWebsitePtttSuggestions(partner, { force = false } = {}) {
  if (!force && websitePtttCache.at && Date.now() - websitePtttCache.at < WEBSITE_PTTT_CACHE_MS) {
    return websitePtttCache;
  }
  const settings = getSettings();
  let adminMap = {};
  let source = "local";
  try {
    const data = await getLastWebPaymentByWebsite(partner, { days: 180 });
    adminMap = buildWebsitePtttFromAdmin(data.by_website || {});
    source = data._sourceBase || partner.adminBaseUrl || partner.baseUrl || "admin";
  } catch (err) {
    console.warn("[partner] getLastWebPaymentByWebsite:", err.message || err);
  }
  const map = resolveWebsitePtttMap(adminMap, settings.pttt || []);
  websitePtttCache = { at: Date.now(), map, source };
  return websitePtttCache;
}

function applyOrderOverlays(orders, websitePtttMap) {
  const overlays = readOrderOverlays();
  const suggestions = websitePtttMap || websitePtttCache.map || readWebsitePttt();
  for (const order of orders || []) {
    const ov = overlays[order.id] || overlays[order.bassoId] || {};
    if (ov.note != null) order.note = ov.note;
    if (ov.handler != null) order.handler = ov.handler;
    const sug = suggestions[normalizeWebsiteKeyLocal(order.website)];
    order.ptttSuggestId = sug ? sug.ptttId || "" : "";
    order.ptttSuggestName = sug ? sug.ptttName || "" : "";
    order.ptttSuggestMeta = sug
      ? {
          source: sug.source || "",
          orderNumber: sug.orderNumber || "",
          boughtDate: sug.boughtDate || "",
        }
      : null;
    if (Object.prototype.hasOwnProperty.call(ov, "ptttId")) {
      order.ptttId = ov.ptttId || "";
    } else {
      order.ptttId = order.ptttSuggestId || "";
    }
    if (Object.prototype.hasOwnProperty.call(ov, "warehouseId")) {
      order.warehouseId = ov.warehouseId || "";
    } else if (!order.warehouseId) {
      order.warehouseId = "";
    }
  }
  return orders;
}

function itemOverlayKey(orderId, itemId) {
  return `${orderId}::${itemId}`;
}

function applyItemOverlays(orders) {
  const overlays = readItemOverlays();
  for (const order of orders || []) {
    for (const item of order.items || []) {
      const ov = overlays[itemOverlayKey(order.id, item.id)];
      if (!ov) continue;
      if (ov.orderNo != null) item.orderNo = ov.orderNo;
      if (ov.tracking != null) item.tracking = ov.tracking;
      if (ov.itemKey != null) item.itemKey = ov.itemKey;
    }
  }
  return orders;
}

function findOrderInList(orders, id) {
  const key = String(id);
  return (orders || []).find((o) => String(o.id) === key || String(o.bassoId) === key);
}

async function loadLiveOrders({ force = false } = {}) {
  const partner = readPartnerConfig(CONFIG_FILE);
  if (!partnerConfigured(partner)) {
    const localMap = resolveWebsitePtttMap({}, getSettings().pttt || []);
    const orders = applyOrderOverlays(applyItemOverlays(readMockOrders()), localMap);
    liveOrdersCache = {
      at: Date.now(),
      orders,
      meta: null,
      pendingByTab: {},
      source: "mock",
      websitePttt: localMap,
      websitePtttSource: "local",
    };
    return liveOrdersCache;
  }

  if (!force && liveOrdersCache.source === "partner" && Date.now() - liveOrdersCache.at < LIVE_CACHE_MS) {
    return liveOrdersCache;
  }

  const [meta, ptttSug] = await Promise.all([
    getWebOrderCreateMeta(partner),
    loadWebsitePtttSuggestions(partner, { force }),
  ]);
  const overlay = readOrderOverlays();
  const { orders, pendingByTab, websites } = await fetchAllWebOrders(partner, {
    picList: meta.pic || [],
    overlay,
  });
  applyItemOverlays(orders);
  applyOrderOverlays(orders, ptttSug.map);
  liveOrdersCache = {
    at: Date.now(),
    orders,
    meta,
    pendingByTab,
    websites: websites || [],
    source: "partner",
    buyer: meta.buyer || "",
    buyerUserId: meta.buyer_user_id || null,
    websitePttt: ptttSug.map,
    websitePtttSource: ptttSug.source,
  };
  return liveOrdersCache;
}

async function getOrdersForApi({ force = false } = {}) {
  try {
    return await loadLiveOrders({ force });
  } catch (err) {
    console.error("[partner] fallback mock:", err.message || err);
    const orders = applyOrderOverlays(applyItemOverlays(readMockOrders()));
    return {
      at: Date.now(),
      orders,
      meta: null,
      pendingByTab: {},
      source: "mock",
      error: err.message || String(err),
    };
  }
}

function readMockOrders() {
  try {
    return JSON.parse(fs.readFileSync(MOCK_ORDERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeMockOrders(orders) {
  fs.writeFileSync(MOCK_ORDERS_FILE, JSON.stringify(orders, null, 2), "utf8");
}

function readBuyList() {
  try {
    const data = JSON.parse(fs.readFileSync(BUY_LIST_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeBuyList(items) {
  fs.writeFileSync(BUY_LIST_FILE, JSON.stringify(items, null, 2), "utf8");
}

function toBuyItem(order, item) {
  const shortId = makeShortNobitaId();
  // Không tái dùng ID dài kiểu cũ (b-i1-…); chỉ giữ ID ngắn 6 ký tự
  const existing = String(item.itemKey || "").trim();
  const itemKey = isShortNobitaId(existing) ? existing : shortId;
  return {
    buyId: shortId,
    itemId: item.id,
    orderId: order.id,
    bassoOrderId: order.bassoId || order.id,
    orderCode: order.id,
    website: order.website || "",
    brand: order.brand || "",
    currencySymbol: order.currencySymbol || "$",
    ptttId: order.ptttId || order.ptttSuggestId || "",
    name: item.name,
    url: item.url || "",
    image: item.image || "",
    size: item.size || "",
    color: item.color || "",
    qty: Number(item.qty || 1),
    price: Number(item.price || 0),
    note: item.note || "",
    orderNo: item.orderNo || "",
    tracking: item.tracking || "",
    itemKey,
  };
}

/** Gửi danh sách SP lên Sheet theo PTTT (dùng chung create-order + gửi đơn 1 dòng) */
async function sendItemsToPtttSheet(buyList, body = {}) {
  const settings = getSettings();
  const ptttId = String(body.payment_id || body.pttt_id || "");
  const pttt =
    settings.pttt.find((x) => x.id === ptttId || x.name === ptttId) || null;
  if (!pttt) {
    return { ok: false, error: "PTTT không hợp lệ — kiểm tra tab Cài đặt / cột PTTT" };
  }
  if (!pttt.sheetUrl) {
    return {
      ok: false,
      error: `PTTT "${pttt.name}" chưa map link Excel — vào tab Cài đặt để điền`,
    };
  }

  let whId = String(body.warehouse_id || "").trim();
  let warehouse =
    settings.warehouses.find((x) => x.id === whId || x.name === whId) || null;
  if (!warehouse && settings.warehouses.length === 1) {
    warehouse = settings.warehouses[0];
    whId = warehouse.id;
  }
  if (!warehouse && settings.warehouses.length) {
    warehouse = settings.warehouses[0];
  }
  if (!warehouse) {
    return { ok: false, error: "Chưa có Warehouse — kiểm tra tab Cài đặt" };
  }

  const khoValue = warehouse.address || warehouse.name;
  const created =
    body.created_time ||
    body.date ||
    (() => {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    })();

  const sheet = await sendBuyListToSheets(buyList, {
    created_time: created,
    date: body.date || created,
    ship_fee: body.ship_fee != null ? body.ship_fee : 0,
    discount: body.discount != null ? body.discount : 0,
    kho: khoValue,
    warehouse: warehouse.name,
    payment_id: pttt.name,
    buyer: body.buyer || "",
    note: body.note || "",
    sheetUrl: pttt.sheetUrl,
    columns: pttt.columns || defaultColumnMap(),
  });

  if (!sheet.googleOk) {
    let serviceEmail = "";
    try {
      serviceEmail = loadCredentials().client_email || "";
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: explainGoogleError(sheet.googleError),
      googleError: sheet.googleError,
      serviceAccount: serviceEmail,
      sheetUrl: pttt.sheetUrl,
      cleared: 0,
    };
  }

  const itemOverlays = readItemOverlays();
  for (const bi of buyList) {
    if (!bi.itemKey) continue;
    const orderCode = bi.orderCode || bi.orderId;
    if (!orderCode || !bi.itemId) continue;
    const k = itemOverlayKey(orderCode, bi.itemId);
    itemOverlays[k] = {
      ...(itemOverlays[k] || {}),
      itemKey: bi.itemKey,
      orderNo: bi.orderNo || (itemOverlays[k] && itemOverlays[k].orderNo) || "",
      tracking: bi.tracking || (itemOverlays[k] && itemOverlays[k].tracking) || "",
    };
  }
  writeItemOverlays(itemOverlays);
  if (liveOrdersCache.orders && liveOrdersCache.orders.length) {
    applyItemOverlays(liveOrdersCache.orders);
  }

  const websites = [...new Set(buyList.map((b) => b.website).filter(Boolean))];
  rememberWebsitePttt(websites, pttt);
  websitePtttCache = { at: 0, map: {}, source: "" };
  if (liveOrdersCache.orders && liveOrdersCache.orders.length) {
    applyOrderOverlays(liveOrdersCache.orders);
  }

  if (liveOrdersCache.source === "mock") {
    const orders = readMockOrders();
    for (const bi of buyList) {
      if (!bi.itemKey) continue;
      const order = orders.find((o) => String(o.id) === String(bi.orderId || bi.orderCode));
      if (!order) continue;
      const item = (order.items || []).find((it) => String(it.id) === String(bi.itemId));
      if (item) item.itemKey = bi.itemKey;
    }
    writeMockOrders(orders);
  }

  return {
    ok: true,
    message: `Đã gửi ${sheet.count} dòng vào sheet của ${pttt.name} (đã đánh dấu Nobita ID)`,
    pttt,
    warehouse,
    sheet,
    websitePttt: readWebsitePttt(),
  };
}

/** ID ngắn 6 ký tự (vd A3K9XM) — ghi dưới ngày trên Sheet */
function makeShortNobitaId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

function isShortNobitaId(raw) {
  return /^[A-Z2-9]{6}$/.test(String(raw || "").trim());
}

/** Proxy HTTP cho scrape Playwright (fallback). Chỉ dùng khi set PROXY_URL. */
const DEFAULT_PROXY_URL = process.env.PROXY_URL || "";

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(partial) {
  const next = { ...loadConfig(), ...partial };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function defaultSettings() {
  return {
    pttt: [
      {
        id: "pttt-1",
        name: "Nguyen Cong Phuoc",
        sheetUrl: defaultSheetUrl(),
        columns: defaultColumnMap(),
      },
      {
        id: "pttt-2",
        name: "Trancy Le",
        sheetUrl: "",
        columns: defaultColumnMap(),
      },
    ],
    warehouses: [
      {
        id: "wh-1",
        name: "Kho Hanoi",
        address: "",
      },
      {
        id: "wh-2",
        name: "Kho HCM",
        address: "",
      },
      {
        id: "wh-3",
        name: "Kho khách",
        address: "",
      },
    ],
  };
}

function getSettings() {
  const cfg = loadConfig();
  const base = defaultSettings();
  const saved = cfg.settings || {};
  const ptttRaw =
    Array.isArray(saved.pttt) && saved.pttt.length ? saved.pttt : base.pttt;
  const warehouses =
    Array.isArray(saved.warehouses) && saved.warehouses.length
      ? saved.warehouses
      : base.warehouses;

  return {
    pttt: ptttRaw.map((row, i) => ({
      id: String(row.id || `pttt-${i + 1}`),
      name: String(row.name || "").trim(),
      sheetUrl: String(row.sheetUrl || row.excelUrl || "").trim(),
      columns: normalizeColumnMap(row.columns),
    })),
    warehouses: warehouses.map((row, i) => ({
      id: String(row.id || `wh-${i + 1}`),
      name: String(row.name || "").trim(),
      address: String(row.address || "").trim(),
    })),
    fieldDefs: ALL_COLUMN_FIELDS,
  };
}

function normalizeSettings(input) {
  const base = defaultSettings();
  const pttt = Array.isArray(input && input.pttt) ? input.pttt : base.pttt;
  const warehouses = Array.isArray(input && input.warehouses)
    ? input.warehouses
    : base.warehouses;

  return {
    pttt: pttt
      .map((row, i) => ({
        id: String(row.id || `pttt-${i + 1}`),
        name: String(row.name || "").trim(),
        sheetUrl: String(row.sheetUrl || row.excelUrl || "").trim(),
        columns: normalizeColumnMap(row.columns),
      }))
      .filter((row) => row.name),
    warehouses: warehouses
      .map((row, i) => ({
        id: String(row.id || `wh-${i + 1}`),
        name: String(row.name || "").trim(),
        address: String(row.address || "").trim(),
      }))
      .filter((row) => row.name),
  };
}

function getBrightToken(override) {
  return (
    String(override || "").trim() ||
    process.env.BRIGHTDATA_API_TOKEN ||
    process.env.BRIGHT_DATA_API_TOKEN ||
    loadConfig().brightdataApiToken ||
    ""
  );
}

function parseProxyUrl(proxyUrl) {
  if (!proxyUrl) return null;
  try {
    const u = new URL(proxyUrl);
    if (!u.hostname) return null;
    return {
      server: `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`,
      username: decodeURIComponent(u.username || ""),
      password: decodeURIComponent(u.password || ""),
      display: `${u.hostname}${u.port ? `:${u.port}` : ""}`,
    };
  } catch {
    return null;
  }
}

function isLocalUrl(targetUrl) {
  try {
    const u = new URL(targetUrl);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]", "utf8");
}

function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf8");
}

ensureData();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

/**
 * Playwright scrape: ưu tiên data-* trên trang mẫu;
 * fallback heuristic cho trang thật (title, giá dạng VND/USD).
 * URL ngoài localhost đi qua HTTP proxy để giảm access denied / chặn IP.
 */
async function scrapeProductPage(targetUrl, options = {}) {
  const useProxy = options.useProxy !== false && !isLocalUrl(targetUrl);
  const proxyCfg = useProxy ? parseProxyUrl(options.proxyUrl || DEFAULT_PROXY_URL) : null;

  const launchOptions = {
    headless: true,
  };

  if (proxyCfg) {
    launchOptions.proxy = {
      server: proxyCfg.server,
      username: proxyCfg.username || undefined,
      password: proxyCfg.password || undefined,
    };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    locale: "vi-VN",
    viewport: { width: 1365, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  const page = await context.newPage();
  const startedAt = Date.now();

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(1200);

    const status = response ? response.status() : null;
    const finalUrl = page.url();
    const title = await page.title();
    const bodySnippet = await page.evaluate(() =>
      (document.body && document.body.innerText ? document.body.innerText : "").slice(0, 1200)
    );

    const blocked =
      status === 403 ||
      status === 429 ||
      /access denied|accessdenied|just a moment|cf-browser-verification|attention required|blocked|forbidden|đăng nhập để tiếp tục|verify you are human/i.test(
        `${title}\n${bodySnippet}`
      );

    if (blocked) {
      return {
        ok: false,
        error: `Access denied / bị chặn (HTTP ${status || "?"} · proxy ${
          proxyCfg ? proxyCfg.display : "off"
        })`,
        sourceUrl: targetUrl,
        finalUrl,
        httpStatus: status,
        proxyUsed: Boolean(proxyCfg),
        proxy: proxyCfg ? proxyCfg.display : null,
        scrapedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        raw: { title, bodySnippet },
      };
    }

    const extracted = await page.evaluate(() => {
      const text = (sel) => {
        const n = document.querySelector(sel);
        return n ? n.textContent.trim() : "";
      };
      const attr = (sel, name) => {
        const n = document.querySelector(sel);
        return n ? n.getAttribute(name) || "" : "";
      };

      const name =
        attr("[data-nobita-product]", "data-name") ||
        text("[data-testid='product-title']") ||
        text("h1") ||
        document.title;

      const priceRaw =
        attr("[data-nobita-product]", "data-price") ||
        text("[data-testid='product-price']") ||
        text("[itemprop='price']") ||
        "";

      const currency =
        attr("[data-nobita-product]", "data-currency") ||
        text("[data-testid='product-currency']") ||
        "VND";

      const size =
        attr("[data-nobita-product]", "data-size") ||
        text("[data-testid='product-size']") ||
        text("[data-size]") ||
        "";

      const color =
        attr("[data-nobita-product]", "data-color") ||
        text("[data-testid='product-color']") ||
        text("[data-color]") ||
        "";

      const stockRaw =
        attr("[data-nobita-product]", "data-stock") ||
        text("[data-testid='product-stock']") ||
        "";

      const stockStatus =
        attr("[data-nobita-product]", "data-stock-status") ||
        attr("[data-testid='stock-status']", "data-stock-status") ||
        text("[data-testid='stock-status']") ||
        "";

      const sku =
        attr("[data-nobita-product]", "data-sku") ||
        text("[data-testid='product-sku']") ||
        "";

      const sizes = Array.from(
        document.querySelectorAll("[data-testid='size-option'], [data-size-option]")
      ).map((el) => el.getAttribute("data-size-option") || el.textContent.trim());

      const colors = Array.from(
        document.querySelectorAll("[data-testid='color-option'], [data-color-option]")
      ).map((el) => el.getAttribute("data-color-option") || el.textContent.trim());

      let priceText = priceRaw;
      if (!priceText) {
        const body = document.body.innerText;
        const m = body.match(/(?:₫|VND|\$|USD)\s*[\d.,]+|[\d.,]+\s*(?:₫|VND|đ)/i);
        priceText = m ? m[0] : "";
      }

      return {
        name,
        sku,
        priceRaw: priceText,
        currency,
        size: size || sizes[0] || "",
        color: color || colors[0] || "",
        sizes,
        colors,
        stockRaw,
        stockStatus,
        pageTitle: document.title,
        url: location.href,
      };
    });

    const price = parsePrice(extracted.priceRaw);
    const stock = parseStock(extracted.stockRaw, extracted.stockStatus);
    const inStock = stock > 0;

    return {
      ok: true,
      sourceUrl: targetUrl,
      finalUrl,
      httpStatus: status,
      proxyUsed: Boolean(proxyCfg),
      proxy: proxyCfg ? proxyCfg.display : null,
      scrapedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      product: {
        name: clean(extracted.name),
        sku: clean(extracted.sku),
        price,
        priceRaw: extracted.priceRaw,
        currency: extracted.currency || "VND",
        size: clean(extracted.size),
        color: clean(extracted.color),
        sizes: extracted.sizes || [],
        colors: extracted.colors || [],
        stock,
        stockStatus: clean(extracted.stockStatus) || (inStock ? "Còn hàng" : "Hết hàng"),
        inStock,
      },
      raw: extracted,
    };
  } finally {
    await browser.close();
  }
}

function clean(v) {
  return String(v || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return raw;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits);
}

function parseStock(stockRaw, stockStatus) {
  const n = Number(String(stockRaw).replace(/[^\d]/g, ""));
  if (!Number.isNaN(n) && String(stockRaw).match(/\d/)) return n;
  if (/hết hàng|out.?of.?stock|sold.?out/i.test(stockStatus || "")) return 0;
  if (/còn hàng|in.?stock/i.test(stockStatus || "")) return 1;
  return 0;
}

app.post("/api/scrape", async (req, res) => {
  const url = String((req.body && req.body.url) || "").trim();
  if (!url) {
    return res.status(400).json({ ok: false, error: "Thiếu link sản phẩm" });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ ok: false, error: "URL không hợp lệ" });
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    return res.status(400).json({ ok: false, error: "Chỉ hỗ trợ http/https" });
  }

  const mode = String((req.body && req.body.mode) || "auto").toLowerCase();
  const useProxy = req.body && req.body.useProxy !== false;
  const tokenFromBody = req.body && req.body.brightdataApiToken;
  if (tokenFromBody && req.body.saveToken) {
    saveConfig({ brightdataApiToken: String(tokenFromBody).trim() });
  }
  const apiToken = getBrightToken(tokenFromBody);
  const dataset = resolveDataset(url);

  try {
    const preferBright =
      mode === "brightdata" || (mode === "auto" && !isLocalUrl(url) && dataset);

    if (preferBright) {
      const result = await scrapeWithBrightData(url, apiToken);
      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.json(result);
    }

    if (mode === "brightdata" && !dataset) {
      return res.status(400).json({
        ok: false,
        error: "Domain chưa có trong map Bright Data.",
        datasets: listDatasets(),
      });
    }

    const result = await scrapeProductPage(url, { useProxy });
    if (!result.ok) {
      return res
        .status(result.httpStatus && result.httpStatus >= 400 ? result.httpStatus : 403)
        .json(result);
    }
    result.engine = "playwright";
    res.json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Scrape thất bại: " + (err.message || String(err)),
    });
  }
});

app.get("/api/brightdata/status", (_req, res) => {
  const token = getBrightToken();
  res.json({
    ok: true,
    hasToken: Boolean(token),
    tokenHint: token ? `${token.slice(0, 4)}…${token.slice(-4)}` : null,
    datasets: listDatasets(),
  });
});

app.post("/api/brightdata/token", (req, res) => {
  const token = String((req.body && req.body.token) || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "Thiếu token" });
  saveConfig({ brightdataApiToken: token });
  res.json({ ok: true, hasToken: true });
});

app.get("/api/resolve-dataset", (req, res) => {
  const url = String(req.query.url || "").trim();
  if (!url) return res.status(400).json({ ok: false, error: "Thiếu url" });
  const match = resolveDataset(url);
  res.json({ ok: true, match });
});

app.get("/api/proxy-info", (_req, res) => {
  const cfg = parseProxyUrl(DEFAULT_PROXY_URL);
  res.json({
    ok: true,
    enabledDefault: true,
    proxy: cfg ? cfg.display : null,
  });
});

app.post("/api/orders", async (req, res) => {
  const body = req.body || {};
  const required = ["date", "website", "productUrl", "items", "subTotal", "qty", "maDh"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === "") {
      return res.status(400).json({ ok: false, error: `Thiếu trường: ${key}` });
    }
  }

  const order = {
    id: `ORD-${Date.now()}`,
    status: "accepted",
    date: String(body.date).trim(),
    website: String(body.website).trim(),
    productUrl: String(body.productUrl).trim(),
    items: String(body.items).trim(),
    size: String(body.size || "").trim(),
    color: String(body.color || "").trim(),
    subTotal: String(body.subTotal).trim(),
    qty: Math.max(1, Number(body.qty) || 1),
    shipDiscount: String(body.shipDiscount || "").trim(),
    kho: String(body.kho || "").trim(),
    maDh: String(body.maDh).trim(),
    createdAt: new Date().toISOString(),
  };

  try {
    const sheet = await sendOrderToSheets(order);
    order.sheet = {
      local: sheet.local,
      google: sheet.google,
      googleError: sheet.googleError,
    };

    const orders = readOrders();
    orders.unshift(order);
    writeOrders(orders);

    if (sheet.googleError && !sheet.google) {
      return res.status(200).json({
        ok: true,
        warning: sheet.googleError,
        order,
        sheet,
      });
    }

    res.json({ ok: true, order, sheet });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Ghi đơn thất bại: " + (err.message || String(err)),
    });
  }
});

app.get("/api/orders", (_req, res) => {
  res.json({ ok: true, orders: readOrders() });
});

app.delete("/api/orders", (_req, res) => {
  writeOrders([]);
  res.json({ ok: true });
});

app.get("/api/basso/settings", (_req, res) => {
  const settings = getSettings();
  res.json({
    ok: true,
    settings: {
      pttt: settings.pttt,
      warehouses: settings.warehouses,
    },
    fieldDefs: settings.fieldDefs || ALL_COLUMN_FIELDS,
  });
});

const REPORT_REASONS_FILE = path.join(__dirname, "data", "report-reasons.json");

function readReportReasons() {
  try {
    if (!fs.existsSync(REPORT_REASONS_FILE)) return {};
    const raw = JSON.parse(fs.readFileSync(REPORT_REASONS_FILE, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeReportReasons(map) {
  fs.writeFileSync(REPORT_REASONS_FILE, JSON.stringify(map || {}, null, 2), "utf8");
}

app.get("/api/basso/report-reasons", (_req, res) => {
  res.json({ ok: true, reasons: readReportReasons() });
});

app.put("/api/basso/report-reasons", (req, res) => {
  const website = String((req.body && req.body.website) || "").trim();
  if (!website) return res.status(400).json({ ok: false, error: "Thiếu website" });
  const reason = String((req.body && req.body.reason) || "");
  const map = readReportReasons();
  map[website] = reason;
  writeReportReasons(map);
  res.json({ ok: true, reasons: map });
});

app.put("/api/basso/settings", (req, res) => {
  const settings = normalizeSettings(req.body && req.body.settings ? req.body.settings : req.body);
  if (!settings.pttt.length) {
    return res.status(400).json({ ok: false, error: "Cần ít nhất 1 PTTT" });
  }
  if (!settings.warehouses.length) {
    return res.status(400).json({ ok: false, error: "Cần ít nhất 1 warehouse" });
  }
  saveConfig({ settings });
  res.json({ ok: true, settings: getSettings() });
});

/** Đọc Order # + Tracking từ Sheet → gắn theo Nobita ID (ưu tiên), rồi mới fallback link/size */
app.post("/api/basso/sync-from-sheet", async (req, res) => {
  const settings = getSettings();
  const body = req.body || {};
  const ptttId = String(body.payment_id || body.pttt_id || "");
  const ptttList = ptttId
    ? settings.pttt.filter((x) => x.id === ptttId || x.name === ptttId)
    : settings.pttt.filter((x) => x.sheetUrl);

  if (!ptttList.length) {
    return res.status(400).json({ ok: false, error: "Chưa có PTTT nào map link Sheet" });
  }

  function normUrl(u) {
    return String(u || "")
      .trim()
      .toLowerCase()
      .replace(/\/$/, "")
      .replace(/^https?:\/\//, "");
  }

  function urlsMatch(a, b) {
    const x = normUrl(a);
    const y = normUrl(b);
    if (!x || !y) return false;
    return x === y || x.includes(y) || y.includes(x);
  }

  function normVariant(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/size\s*:/gi, "")
      .replace(/color\s*:/gi, "")
      .replace(/màu\s*:/gi, "")
      .trim();
  }

  function variantMatch(item, sheetSizeColor) {
    const sheetVar = normVariant(sheetSizeColor);
    if (!sheetVar) return true;
    const sizeOk = !item.size || sheetVar.includes(normVariant(item.size));
    const colorOk = !item.color || sheetVar.includes(normVariant(item.color));
    return sizeOk && colorOk;
  }

  function itemToken(item) {
    return item.itemKey || item.buyId || item.id || item.itemId || "";
  }

  try {
    const live = await getOrdersForApi();
    const orders = live.orders || [];
    const buyList = readBuyList();
    let updatedItems = 0;
    let matchedByKey = 0;
    let matchedByFallback = 0;
    let skippedNoLink = 0;
    let unmatched = 0;
    let ambiguous = 0;
    const matches = [];
    const allRecords = [];
    const usedItems = new Set(); // đã gán trong lượt sync này
    const usedSheetRows = new Set();
    const itemOverlays = readItemOverlays();

    function applyToItem(item, rec, how, orderCode) {
      const token = itemToken(item);
      if (token && usedItems.has(token)) return false;
      const rowToken = `${rec.sheetTitle}:${rec.rowNumber}`;
      if (usedSheetRows.has(rowToken)) return false;

      if (rec.orderNo) item.orderNo = rec.orderNo;
      if (rec.tracking) item.tracking = rec.tracking;
      if (rec.itemKey && !item.itemKey) item.itemKey = rec.itemKey;

      if (token) usedItems.add(token);
      usedSheetRows.add(rowToken);
      updatedItems += 1;
      if (how === "key") matchedByKey += 1;
      else matchedByFallback += 1;

      if (orderCode && item.id) {
        const k = itemOverlayKey(orderCode, item.id);
        itemOverlays[k] = {
          ...(itemOverlays[k] || {}),
          orderNo: item.orderNo || "",
          tracking: item.tracking || "",
          itemKey: item.itemKey || "",
        };
      }

      matches.push({
        how,
        maDh: rec.maDh,
        itemKey: item.itemKey || token || "",
        itemId: item.id || item.itemId || item.buyId,
        itemName: item.name,
        size: item.size || "",
        color: item.color || "",
        itemsUrl: item.url || rec.itemsUrl,
        orderNo: item.orderNo || "",
        tracking: item.tracking || "",
        sheetRow: rec.rowNumber,
        sheetTitle: rec.sheetTitle,
      });
      return true;
    }

    function findByItemKey(key) {
      if (!key) return null;
      for (const order of orders) {
        for (const item of order.items || []) {
          if (String(item.itemKey || "") === String(key)) return { item, order };
        }
      }
      for (const item of buyList) {
        if (String(item.itemKey || item.buyId || "") === String(key)) return { item, order: null };
      }
      return null;
    }

    for (const pttt of ptttList) {
      const pulled = await pullReverseFromSheet({
        sheetUrl: pttt.sheetUrl,
        columns: pttt.columns,
        orderDate: body.date || body.created_time || "",
      });
      allRecords.push(...pulled.records);

      for (const rec of pulled.records) {
        // 1) Ưu tiên Nobita ID — chắc chắn từng dòng
        if (rec.itemKey) {
          const found = findByItemKey(rec.itemKey);
          if (found && applyToItem(found.item, rec, "key", found.order ? found.order.id : found.item.orderCode)) {
            continue;
          }
        }

        // 2) Fallback: Mã ĐH + link + size/màu
        if (!rec.itemsUrl) {
          skippedNoLink += 1;
          unmatched += 1;
          continue;
        }

        let applied = false;
        for (const order of orders) {
          if (String(order.id) !== String(rec.maDh)) continue;
          const candidates = (order.items || []).filter((item) => {
            const token = itemToken(item);
            if (token && usedItems.has(token)) return false;
            return urlsMatch(item.url, rec.itemsUrl) && variantMatch(item, rec.sizeColor);
          });
          if (candidates.length > 1) {
            const unset = candidates.find((it) => !it.orderNo && !it.tracking) || candidates[0];
            if (applyToItem(unset, rec, "fallback", order.id)) applied = true;
            else ambiguous += 1;
          } else if (candidates.length === 1) {
            if (applyToItem(candidates[0], rec, "fallback", order.id)) applied = true;
          }
        }

        if (!applied) {
          const buyCandidates = buyList.filter((item) => {
            const token = itemToken(item);
            if (token && usedItems.has(token)) return false;
            if (String(item.orderId || item.orderCode) !== String(rec.maDh)) return false;
            return urlsMatch(item.url, rec.itemsUrl) && variantMatch(item, rec.sizeColor);
          });
          if (buyCandidates.length >= 1) {
            const chosen =
              buyCandidates.find((it) => !it.orderNo && !it.tracking) || buyCandidates[0];
            if (applyToItem(chosen, rec, "fallback", chosen.orderCode || chosen.orderId)) applied = true;
            else if (buyCandidates.length > 1) ambiguous += 1;
          }
        }

        if (!applied) unmatched += 1;
      }
    }

    writeItemOverlays(itemOverlays);
    if (live.source === "mock") writeMockOrders(orders);
    writeBuyList(buyList);
    res.json({
      ok: true,
      message:
        `Đã gắn ${updatedItems} SP` +
        ` (ID: ${matchedByKey}, fallback: ${matchedByFallback})` +
        (skippedNoLink ? `; bỏ ${skippedNoLink} dòng thiếu link/ID` : "") +
        (ambiguous ? `; ${ambiguous} dòng trùng khó tách` : "") +
        (unmatched ? `; ${unmatched} dòng không khớp` : ""),
      updatedItems,
      matchedByKey,
      matchedByFallback,
      skippedNoLink,
      unmatched,
      ambiguous,
      records: allRecords.length,
      matches,
    });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: explainGoogleError(err.message || String(err)),
    });
  }
});

app.get("/api/basso/credentials", (_req, res) => {
  try {
    const creds = loadCredentials();
    res.json({
      ok: true,
      configured: true,
      client_email: creds.client_email || "",
      project_id: creds.project_id || "",
      path: CREDENTIALS_FILE,
    });
  } catch (err) {
    res.json({
      ok: true,
      configured: false,
      error: err.message || String(err),
      path: CREDENTIALS_FILE,
    });
  }
});

app.post("/api/basso/credentials", (req, res) => {
  const raw = req.body && (req.body.json || req.body.credentials || req.body);
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return res.status(400).json({ ok: false, error: "JSON credentials không hợp lệ" });
  }
  if (!parsed || parsed.type !== "service_account" || !parsed.private_key || !parsed.client_email) {
    return res.status(400).json({
      ok: false,
      error: "Cần file service account (type, client_email, private_key)",
    });
  }
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(parsed, null, 2), "utf8");
  res.json({
    ok: true,
    client_email: parsed.client_email,
    project_id: parsed.project_id || "",
    message: "Đã lưu credentials. Hãy Share sheet với email này (Editor).",
  });
});

app.get("/api/basso/orders", async (req, res) => {
  const force = String(req.query.refresh || "") === "1";
  const live = await getOrdersForApi({ force });
  const buyList = readBuyList();
  const orders = live.orders || [];
  const pic = ((live.meta && live.meta.pic) || [])
    .filter((p) => p && Number(p.user_id) !== 0)
    .map((p) => ({ id: String(p.user_id), name: String(p.name || "").trim() }))
    .filter((p) => p.name);

  // SSO kiểu Deki: ưu tiên tên user đăng nhập ai.basso.vn; fallback Partner buyer
  let sessionUser = null;
  try {
    sessionUser = await getRequestUser(req);
  } catch {
    sessionUser = null;
  }
  const partnerBuyer = live.buyer || (live.meta && live.meta.buyer) || "";
  const displayBuyer = (sessionUser && sessionUser.name) || partnerBuyer || "";

  res.json({
    ok: true,
    source: live.source || "mock",
    error: live.error || null,
    buyer: displayBuyer,
    buyerUserId: live.buyerUserId || (live.meta && live.meta.buyer_user_id) || null,
    partnerBuyer,
    sessionUser: sessionUser
      ? { email: sessionUser.email, name: sessionUser.name, source: sessionUser.source }
      : null,
    pic,
    pendingByTab: live.pendingByTab || {},
    websitePttt: live.websitePttt || websitePtttCache.map || readWebsitePttt(),
    websitePtttSource: live.websitePtttSource || websitePtttCache.source || "",
    websites: live.websites || [],
    createMeta: (() => {
      const meta = live.meta || loadFallbackCreateMeta() || {};
      return {
        countries: meta.countries || [],
        payments: meta.payments || [],
        warehouses: meta.warehouses || [],
        web_cashbacks: meta.web_cashbacks || [],
        brands: meta.brands || [],
        branches: meta.branches || [],
      };
    })(),
    orders,
    counts: {
      can_xu_ly: orders.filter((o) => o.status === "can_xu_ly").length,
      can_mua_order: orders.filter((o) => o.status === "can_mua_order").length,
      can_mua_co: orders.filter((o) => o.status === "can_mua_co").length,
      gui_don: buyList.length,
      dang_mua: buyList.length,
    },
  });
});

app.patch("/api/basso/orders/:id/note", async (req, res) => {
  const id = req.params.id;
  const note = String((req.body && req.body.note) || "");
  const live = await getOrdersForApi();
  const order = findOrderInList(live.orders, id);
  if (!order) return res.status(404).json({ ok: false, error: "Không tìm thấy đơn" });

  const overlays = readOrderOverlays();
  const key = order.id;
  overlays[key] = { ...(overlays[key] || {}), note };
  writeOrderOverlays(overlays);
  order.note = note;

  // Mock fallback: vẫn ghi file mock nếu đang dùng mock
  if (live.source === "mock") {
    const orders = readMockOrders();
    const row = findOrderInList(orders, id);
    if (row) {
      row.note = note;
      writeMockOrders(orders);
    }
  }

  res.json({ ok: true, order });
});

app.patch("/api/basso/orders/:id/handler", async (req, res) => {
  const id = req.params.id;
  let handler = String((req.body && req.body.handler) || "").trim();
  if (handler === "Lựa chọn") handler = "";
  const live = await getOrdersForApi();
  const order = findOrderInList(live.orders, id);
  if (!order) return res.status(404).json({ ok: false, error: "Không tìm thấy đơn" });

  const overlays = readOrderOverlays();
  const key = order.id;
  overlays[key] = { ...(overlays[key] || {}), handler };
  writeOrderOverlays(overlays);
  order.handler = handler;

  if (live.source === "mock") {
    const orders = readMockOrders();
    const row = findOrderInList(orders, id);
    if (row) {
      row.handler = handler;
      writeMockOrders(orders);
    }
  }

  res.json({
    ok: true,
    order,
    warning:
      live.source === "partner"
        ? "PIC lưu local trên Nobita (chưa push lên Basso). Tab Cần xử lý vẫn theo PIC trên Basso khi refresh."
        : null,
  });
});

app.patch("/api/basso/orders/:id/pttt", async (req, res) => {
  const id = req.params.id;
  let ptttId = String((req.body && req.body.ptttId) || "").trim();
  const live = await getOrdersForApi();
  const order = findOrderInList(live.orders, id);
  if (!order) return res.status(404).json({ ok: false, error: "Không tìm thấy đơn" });

  const settings = getSettings();
  const pttt = settings.pttt.find((x) => x.id === ptttId || x.name === ptttId) || null;
  if (ptttId && !pttt) {
    return res.status(400).json({ ok: false, error: "PTTT không hợp lệ" });
  }
  ptttId = pttt ? pttt.id : "";

  const overlays = readOrderOverlays();
  const key = order.id;
  overlays[key] = { ...(overlays[key] || {}), ptttId };
  writeOrderOverlays(overlays);
  order.ptttId = ptttId;

  res.json({
    ok: true,
    order,
    pttt: pttt ? { id: pttt.id, name: pttt.name } : null,
  });
});

app.patch("/api/basso/orders/:id/warehouse", async (req, res) => {
  const id = req.params.id;
  let warehouseId = String((req.body && req.body.warehouseId) || "").trim();
  const live = await getOrdersForApi();
  const order = findOrderInList(live.orders, id);
  if (!order) return res.status(404).json({ ok: false, error: "Không tìm thấy đơn" });

  const settings = getSettings();
  const warehouse =
    settings.warehouses.find((x) => x.id === warehouseId || x.name === warehouseId) || null;
  if (warehouseId && !warehouse) {
    return res.status(400).json({ ok: false, error: "Warehouse không hợp lệ" });
  }
  warehouseId = warehouse ? warehouse.id : "";

  const overlays = readOrderOverlays();
  const key = order.id;
  overlays[key] = { ...(overlays[key] || {}), warehouseId };
  writeOrderOverlays(overlays);
  order.warehouseId = warehouseId;

  res.json({
    ok: true,
    order,
    warehouse: warehouse ? { id: warehouse.id, name: warehouse.name } : null,
  });
});

/** Giỏ Đang mua (result_tab) — không đổi status đơn gốc */
app.get("/api/basso/buy-list", (_req, res) => {
  res.json({ ok: true, items: readBuyList() });
});

app.post("/api/basso/buy-list/add-all", async (req, res) => {
  const orderId = String((req.body && req.body.orderId) || "");
  const live = await getOrdersForApi();
  const order = findOrderInList(live.orders, orderId);
  if (!order) return res.status(404).json({ ok: false, error: "Không tìm thấy đơn" });
  if (!order.items || !order.items.length) {
    return res.status(400).json({ ok: false, error: "Đơn không có sản phẩm" });
  }

  const buyList = readBuyList();
  let added = 0;
  let skipped = 0;
  for (const item of order.items) {
    if (buyList.some((x) => x.itemId === item.id)) {
      skipped += 1;
      continue;
    }
    buyList.push(toBuyItem(order, item));
    added += 1;
  }
  writeBuyList(buyList);

  if (!added && skipped) {
    return res.json({ ok: false, error: "Sản phẩm đã có trong danh sách", items: buyList });
  }
  res.json({
    ok: true,
    items: buyList,
    message: skipped
      ? `Đã thêm ${added} SP (${skipped} đã có trong giỏ)`
      : `Đã thêm ${added} sản phẩm`,
  });
});

app.post("/api/basso/buy-list/add-item", async (req, res) => {
  const orderId = String((req.body && req.body.orderId) || "");
  const itemId = String((req.body && req.body.itemId) || "");
  const live = await getOrdersForApi();
  const order = findOrderInList(live.orders, orderId);
  if (!order) return res.status(404).json({ ok: false, error: "Không tìm thấy đơn" });

  const item = (order.items || []).find((it) => String(it.id) === itemId);
  if (!item) return res.status(404).json({ ok: false, error: "Không tìm thấy sản phẩm" });

  const buyList = readBuyList();
  if (buyList.some((x) => x.itemId === item.id)) {
    return res.json({ ok: false, error: "Sản phẩm đã có trong danh sách", items: buyList });
  }

  buyList.push(toBuyItem(order, item));
  writeBuyList(buyList);
  res.json({ ok: true, items: buyList, message: "Đã thêm sản phẩm" });
});

app.patch("/api/basso/buy-list/:buyId", (req, res) => {
  const buyId = req.params.buyId;
  const buyList = readBuyList();
  const row = buyList.find((x) => x.buyId === buyId);
  if (!row) return res.status(404).json({ ok: false, error: "Không tìm thấy SP trong giỏ" });

  if (req.body && req.body.price != null) {
    row.price = Number(req.body.price) || 0;
  }
  writeBuyList(buyList);
  res.json({ ok: true, items: buyList });
});

app.delete("/api/basso/buy-list/:buyId", (req, res) => {
  const buyId = req.params.buyId;
  let buyList = readBuyList();
  const before = buyList.length;
  buyList = buyList.filter((x) => x.buyId !== buyId);
  if (buyList.length === before) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy SP trong giỏ" });
  }
  writeBuyList(buyList);
  res.json({ ok: true, items: buyList });
});

app.post("/api/basso/buy-list/create-order", async (req, res) => {
  const buyList = readBuyList();
  if (!buyList.length) {
    return res.status(400).json({ ok: false, error: "Bạn chưa chọn sản phẩm" });
  }

  const body = req.body || {};
  try {
    const result = await sendItemsToPtttSheet(buyList, body);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    writeBuyList([]);
    res.json({
      ...result,
      cleared: buyList.length,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Gửi đơn thất bại: " + (err.message || String(err)),
    });
  }
});

/** Tạo đơn Admin trên Basso (POST /partner/createWebOrder) — tab Đang mua */
app.post("/api/basso/buy-list/create-admin-order", async (req, res) => {
  const buyList = readBuyList();
  if (!buyList.length) {
    return res.status(400).json({ ok: false, error: "Bạn chưa chọn sản phẩm" });
  }

  const partner = readPartnerConfig(CONFIG_FILE);
  if (!partnerConfigured(partner)) {
    return res.status(400).json({
      ok: false,
      error: "Chưa cấu hình Partner API — không tạo được đơn Admin",
    });
  }

  const body = req.body || {};
  const missing = [];
  for (const k of [
    "country_id",
    "payment_id",
    "created_time",
    "order_number",
    "warehouse_id",
  ]) {
    if (body[k] == null || String(body[k]).trim() === "") missing.push(k);
  }
  if (missing.length) {
    return res.status(400).json({
      ok: false,
      error: "Thiếu thông tin bắt buộc: " + missing.join(", "),
    });
  }

  const websites = [...new Set(buyList.map((b) => b.website).filter(Boolean))];
  const brands = [...new Set(buyList.map((b) => b.brand).filter(Boolean))];
  let brand = String(body.brand || brands[0] || "basso").trim() || "basso";
  if (brands.some((b) => String(b).toLowerCase() === "checkout")) brand = "checkout";

  const items = [];
  for (const bi of buyList) {
    const orderId = bi.bassoOrderId || bi.orderId;
    if (!orderId || !/^\d+$/.test(String(orderId))) {
      return res.status(400).json({
        ok: false,
        error: `SP "${bi.name}" thiếu ID đơn Basso (bassoOrderId) — chỉ tạo Admin từ đơn live Partner`,
      });
    }
    if (!bi.itemId || !/^\d+$/.test(String(bi.itemId))) {
      return res.status(400).json({
        ok: false,
        error: `SP "${bi.name}" thiếu item id số từ Basso`,
      });
    }
    const variations = [
      { name: "Size", value: bi.size || "" },
      { name: "Color", value: bi.color || "" },
    ];
    items.push({
      order_id: String(orderId),
      id: String(bi.itemId),
      name: bi.name || "",
      note: bi.note || "",
      link: bi.url || "",
      quantity: Number(bi.qty || 1),
      price: Number(bi.price || 0),
      variations: JSON.stringify(variations),
    });
  }

  try {
    const result = await createWebOrder(partner, {
      items,
      created_time: body.created_time,
      create_billing:
        body.create_billing === false || body.create_billing === "0" ? false : true,
      order_number: String(body.order_number || "").trim(),
      note: body.note || "",
      branch: body.branch || "ha-noi",
      country_id: Number(body.country_id),
      ship_fee: Number(body.ship_fee || 0),
      discount: Number(body.discount || 0),
      buy_rate: Number(body.buy_rate || 0),
      website: body.website || websites[0] || "",
      warehouse_id: Number(body.warehouse_id),
      payment_id: Number(body.payment_id),
      brand,
      cashback_rate: Number(body.cashback_rate || 0),
      web_cashback_id: body.web_cashback_id || "",
    });
    writeBuyList([]);
    res.json({
      ok: true,
      message: result.message || "Tạo đơn hàng thành công",
      web_order_id: result.web_order_id || result.id || null,
      redirect_url: result.redirect_url || null,
      cleared: buyList.length,
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message || String(err),
    });
  }
});

/**
 * Gửi 1 đơn (tất cả SP) thẳng lên Sheet theo PTTT đã chọn ở cột Thao tác.
 * Không đụng giỏ Đang mua.
 */
app.post("/api/basso/orders/:id/send-to-sheet", async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const live = await getOrdersForApi();
  const order = findOrderInList(live.orders, id);
  if (!order) return res.status(404).json({ ok: false, error: "Không tìm thấy đơn" });
  if (!order.items || !order.items.length) {
    return res.status(400).json({ ok: false, error: "Đơn không có sản phẩm" });
  }

  const ptttId = String(body.payment_id || body.pttt_id || order.ptttId || "").trim();
  if (!ptttId) {
    return res.status(400).json({
      ok: false,
      error: "Chưa chọn PTTT / Excel — chọn ở cột PTTT / Kho rồi bấm Gửi đơn",
    });
  }
  const warehouseId = String(
    body.warehouse_id || body.warehouseId || order.warehouseId || ""
  ).trim();
  if (!warehouseId) {
    return res.status(400).json({
      ok: false,
      error: "Chưa chọn Kho — chọn ở cột PTTT / Kho rồi bấm Gửi đơn",
    });
  }

  // Lưu lựa chọn PTTT + Kho lên overlay
  const overlays = readOrderOverlays();
  overlays[order.id] = {
    ...(overlays[order.id] || {}),
    ptttId,
    warehouseId,
  };
  writeOrderOverlays(overlays);
  order.ptttId = ptttId;
  order.warehouseId = warehouseId;

  const items = order.items.map((it) => toBuyItem(order, it));
  try {
    const result = await sendItemsToPtttSheet(items, {
      ...body,
      payment_id: ptttId,
      warehouse_id: warehouseId,
      note: body.note != null ? body.note : order.note || "",
      buyer: body.buyer || live.buyer || "",
    });
    if (!result.ok) return res.status(400).json(result);
    res.json({
      ...result,
      orderId: order.id,
      message: result.message || `Đã gửi đơn ${order.id} lên Sheet`,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Gửi đơn thất bại: " + (err.message || String(err)),
    });
  }
});

app.get("/api/me", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({
        ok: false,
        success: false,
        error: "Chưa đăng nhập ai.basso.vn",
        code: "NOT_LOGGED_IN",
        authUrl: BASSO_AUTH_URL,
        hint: NOBITA_DEV_MODE
          ? null
          : "Mở Nobita dưới domain ai.basso.vn (cookie SSO) hoặc bật NOBITA_DEV_MODE=1 khi test local",
      });
    }
    res.json({
      ok: true,
      success: true,
      user: {
        email: user.email,
        name: user.name,
        roles: user.roles || [],
        source: user.source,
        isDev: !!user.isDev,
      },
      devMode: NOBITA_DEV_MODE,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

app.get("/api/telegram/status", (_req, res) => {
  const cfg = readTelegramConfig(CONFIG_FILE);
  const state = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(DATA_DIR, "telegram-notify-state.json"), "utf8"));
    } catch {
      return {};
    }
  })();
  res.json({
    ok: true,
    configured: telegramConfigured(cfg),
    enabled: cfg.enabled,
    chatId: cfg.chatId ? `${cfg.chatId.slice(0, 4)}…` : "",
    pollMinutes: cfg.pollMinutes,
    notifySaleEndsToday: cfg.notifySaleEndsToday,
    notifyUrgentBuy: cfg.notifyUrgentBuy,
    lastRunAt: state.lastRunAt || null,
    lastError: state.lastError || null,
    notifiedUrgent: Object.keys(state.urgent || {}).length,
    notifiedSaleEnds: Object.keys(state.saleEnds || {}).length,
  });
});

app.post("/api/telegram/test", async (_req, res) => {
  const cfg = readTelegramConfig(CONFIG_FILE);
  if (!telegramConfigured(cfg)) {
    return res.status(400).json({
      ok: false,
      error: "Chưa cấu hình Telegram (telegram.enabled + botToken + chatId hoặc TELEGRAM_* env)",
    });
  }
  try {
    await sendTelegramMessage(
      cfg,
      `✅ Nobita Telegram OK\nThời gian: ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
    );
    res.json({ ok: true, message: "Đã gửi tin thử vào group" });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

app.post("/api/telegram/run-check", async (req, res) => {
  const cfg = readTelegramConfig(CONFIG_FILE);
  if (!telegramConfigured(cfg)) {
    return res.status(400).json({ ok: false, error: "Telegram chưa cấu hình" });
  }
  try {
    const result = await runTelegramNotifyCheck({
      getOrdersForApi,
      configFile: CONFIG_FILE,
      dataDir: DATA_DIR,
      force: String(req.query.refresh || "") === "1",
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Nobita order mock: http://localhost:${PORT}`);
  console.log(`Google Sheet: ${SPREADSHEET_ID}`);
  const partner = readPartnerConfig(CONFIG_FILE);
  console.log(
    partnerConfigured(partner)
      ? `Partner API: ${partner.baseUrl} (${partner.email})`
      : "Partner API: OFF (dùng mock-orders.json)"
  );
  console.log(`Mock orders: ${readMockOrders().length}`);
  console.log(`Buy list: ${readBuyList().length}`);
  console.log(
    NOBITA_DEV_MODE
      ? "[auth] DEV MODE — /api/me giả lập user (NOBITA_DEV_AS / mặc định Vinh)"
      : `[auth] SSO session: ${BASSO_AUTH_URL}`
  );
  global.__telegramNobita = startTelegramNobitaBot({
    getOrdersForApi,
    configFile: CONFIG_FILE,
    dataDir: DATA_DIR,
  });
});
