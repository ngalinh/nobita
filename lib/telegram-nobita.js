/**
 * Telegram alerts cho Nobita:
 * - 9h sáng VN: tổng hợp website hết sale trong ngày
 * - (tuỳ chọn) đơn mua gấp — poll theo TELEGRAM_POLL_MINUTES
 */
const fs = require("fs");
const path = require("path");

const NOTIFY_STATE_FILE = "telegram-notify-state.json";
const BUY_POOL = new Set(["can_mua_order", "can_mua_co", "can_xu_ly"]);

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readTelegramConfig(configFile) {
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(configFile, "utf8"));
  } catch {
    cfg = {};
  }
  const t = cfg.telegram || {};
  const enabled =
    t.enabled === true || String(process.env.TELEGRAM_ENABLED || "").toLowerCase() === "true";
  const scrub = (v) => {
    const s = String(v || "").trim();
    if (!s || s === "-" || /^none$/i.test(s) || /^your-/i.test(s)) return "";
    return s;
  };
  const hourRaw = Number(process.env.TELEGRAM_SALE_ENDS_HOUR || t.saleEndsHour || 9);
  return {
    enabled,
    botToken: scrub(process.env.TELEGRAM_BOT_TOKEN || t.botToken || ""),
    chatId: scrub(process.env.TELEGRAM_CHAT_ID || t.chatId || ""),
    pollMinutes: Math.max(1, Number(process.env.TELEGRAM_POLL_MINUTES || t.pollMinutes || 5)),
    saleEndsHour: Number.isFinite(hourRaw) ? Math.min(23, Math.max(0, hourRaw)) : 9,
    notifySaleEndsToday: t.notifySaleEndsToday !== false,
    notifyUrgentBuy: t.notifyUrgentBuy !== false,
    baseUrl: String(process.env.NOBITA_BASE_URL || t.baseUrl || "http://localhost:3847").replace(/\/$/, ""),
  };
}

function telegramConfigured(cfg) {
  return !!(cfg.enabled && cfg.botToken && cfg.chatId);
}

function vnDateKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function vnHour(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour");
  return Number(h && h.value != null ? h.value : 0);
}

/** "14h 26/09/2026" → "2026-09-26" */
function saleEndsDateKey(saleEnds) {
  const s = String(saleEnds || "").trim();
  if (!s || s === "—") return "";
  const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return "";
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (!day || !month || !y) return "";
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "14h 22/09/2026" → minutes from midnight for sort */
function saleEndsSortMinutes(saleEnds) {
  const s = String(saleEnds || "").trim();
  const hm = s.match(/(\d{1,2})\s*h(?:\s*(\d{1,2}))?/i);
  if (!hm) return 24 * 60;
  return Number(hm[1]) * 60 + Number(hm[2] || 0);
}

function displayWebsiteName(website) {
  let s = String(website || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0];
  if (!s) return "—";
  s = s.replace(/\.(com|net|org|co\.uk|co|us|uk|vn)$/i, "");
  // usa.tommy → Tommy
  if (s.includes(".")) {
    const parts = s.split(".").filter(Boolean);
    s = parts[parts.length - 1] || s;
  }
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function money(n) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatOrderBlock(order, { headline }) {
  const lines = [
    headline,
    `Mã ĐH: ${order.id}`,
    `Website: ${order.website || "—"}`,
    `Khách: ${order.customerName || "—"}`,
    `Tổng: $ ${money(order.total)}`,
  ];
  if (order.saleEnds && String(order.saleEnds).trim() && order.saleEnds !== "—") {
    lines.push(`Sale ends: ${order.saleEnds}`);
  }
  if (order.note) lines.push(`Ghi chú: ${String(order.note).slice(0, 200)}`);
  return lines.join("\n");
}

/**
 * Gom website hết sale hôm nay → tin tổng hợp.
 * Ví dụ:
 * ⏰ SALE ENDS HÔM NAY
 * Macys 14h 22/09/2026
 * Tommy 14h 22/09/2026
 */
function buildSaleEndsDigest(orders, today) {
  const bySite = new Map();
  for (const order of orders || []) {
    const endKey = saleEndsDateKey(order.saleEnds);
    if (!endKey || endKey !== today) continue;
    const website = String(order.website || "").trim() || "—";
    const key = website.toLowerCase();
    const saleEnds = String(order.saleEnds || "").trim();
    const sortMin = saleEndsSortMinutes(saleEnds);
    const prev = bySite.get(key);
    if (!prev || sortMin < prev.sortMin) {
      bySite.set(key, {
        display: displayWebsiteName(website),
        saleEnds,
        sortMin,
      });
    }
  }
  if (!bySite.size) return null;
  const rows = [...bySite.values()].sort((a, b) => {
    if (a.sortMin !== b.sortMin) return a.sortMin - b.sortMin;
    return a.display.localeCompare(b.display, "en");
  });
  return `⏰ SALE ENDS HÔM NAY\n${rows.map((r) => `${r.display} ${r.saleEnds}`).join("\n")}`;
}

async function sendTelegramMessage(cfg, text) {
  const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
  const chunks = [];
  const raw = String(text || "");
  for (let i = 0; i < raw.length; i += 4000) {
    chunks.push(raw.slice(i, i + 4000));
  }
  const ids = [];
  for (const chunk of chunks) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.description || `Telegram HTTP ${res.status}`);
    }
    ids.push(json.result && json.result.message_id);
  }
  return ids;
}

function loadNotifyState(dataDir) {
  const p = path.join(dataDir, NOTIFY_STATE_FILE);
  const raw = readJsonFile(p, {
    urgent: {},
    saleEnds: {},
    saleEndsDigest: {},
    lastRunAt: null,
    lastError: null,
  });
  if (!raw.saleEndsDigest || typeof raw.saleEndsDigest !== "object") raw.saleEndsDigest = {};
  return { path: p, data: raw };
}

function saveNotifyState(statePath, data) {
  writeJsonFile(statePath, data);
}

function listBuyPoolOrders(orders) {
  return (orders || []).filter((o) => BUY_POOL.has(o.status));
}

/**
 * Quét đơn và gửi Telegram.
 * Sale ends: 1 lần/ngày từ giờ TELEGRAM_SALE_ENDS_HOUR (mặc định 9h VN), gom theo website.
 */
async function runTelegramNotifyCheck({ getOrdersForApi, configFile, dataDir, force = false } = {}) {
  const cfg = readTelegramConfig(configFile);
  if (!telegramConfigured(cfg)) {
    return { ok: false, skipped: true, reason: "Telegram chưa bật hoặc thiếu botToken/chatId" };
  }

  const { path: statePath, data: state } = loadNotifyState(dataDir);
  const today = vnDateKey();
  const hour = vnHour();
  const live = await getOrdersForApi({ force: !!force });
  const orders = listBuyPoolOrders(live.orders);

  const toSend = [];
  let digestSites = 0;

  if (cfg.notifySaleEndsToday) {
    const already = !force && state.saleEndsDigest[today];
    const afterHour = hour >= cfg.saleEndsHour;
    if (!already && (force || afterHour)) {
      const digest = buildSaleEndsDigest(orders, today);
      if (digest) {
        digestSites = digest.split("\n").length - 1;
        toSend.push({ kind: "saleDigest", key: `digest:${today}`, text: digest });
      } else if (force) {
        state.saleEndsDigest[today] = new Date().toISOString();
      }
    }
  }

  for (const order of orders) {
    if (cfg.notifyUrgentBuy && order.isUrgentBuy) {
      const key = String(order.id);
      if (force || !state.urgent[key]) {
        toSend.push({
          kind: "urgent",
          key: `urgent:${key}`,
          text: formatOrderBlock(order, { headline: "🔴 ĐƠN MUA GẤP" }),
        });
      }
    }
  }

  let sent = 0;
  const errors = [];

  for (const item of toSend) {
    try {
      await sendTelegramMessage(cfg, item.text);
      sent += 1;
      if (item.kind === "urgent") {
        const id = item.key.replace(/^urgent:/, "");
        state.urgent[id] = new Date().toISOString();
      } else if (item.kind === "saleDigest") {
        state.saleEndsDigest[today] = new Date().toISOString();
      }
      state.lastError = null;
    } catch (err) {
      errors.push(err.message || String(err));
      state.lastError = errors[0];
      break;
    }
  }

  state.lastRunAt = new Date().toISOString();
  saveNotifyState(statePath, state);

  return {
    ok: errors.length === 0,
    sent,
    candidates: toSend.length,
    digestSites,
    today,
    vnHour: hour,
    saleEndsHour: cfg.saleEndsHour,
    ordersScanned: orders.length,
    lastError: state.lastError,
    errors,
  };
}

function startTelegramNobitaBot({ getOrdersForApi, configFile, dataDir }) {
  const cfg = readTelegramConfig(configFile);
  if (!telegramConfigured(cfg)) {
    console.log("[telegram] OFF — bật trong config.telegram hoặc TELEGRAM_* env");
    return { stop: () => {} };
  }

  const ms = cfg.pollMinutes * 60 * 1000;
  let timer = null;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runTelegramNotifyCheck({ getOrdersForApi, configFile, dataDir });
      if (result.sent) {
        console.log(
          `[telegram] đã gửi ${result.sent} tin` +
            (result.digestSites ? ` (sale ends ${result.digestSites} site)` : "")
        );
      }
      if (result.lastError) {
        console.warn("[telegram]", result.lastError);
      }
    } catch (err) {
      console.warn("[telegram] tick error:", err.message || err);
    } finally {
      running = false;
    }
  };

  console.log(
    `[telegram] ON — group ${cfg.chatId}, sale-ends digest ${cfg.saleEndsHour}h VN, urgent poll ${cfg.pollMinutes} phút (${vnDateKey()})`
  );
  setTimeout(tick, 15000);
  timer = setInterval(tick, ms);

  return {
    stop: () => {
      if (timer) clearInterval(timer);
      timer = null;
    },
    runNow: () => tick(),
  };
}

module.exports = {
  readTelegramConfig,
  telegramConfigured,
  runTelegramNotifyCheck,
  startTelegramNobitaBot,
  sendTelegramMessage,
  buildSaleEndsDigest,
  displayWebsiteName,
  vnDateKey,
  vnHour,
  saleEndsDateKey,
};
