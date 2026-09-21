/**
 * Telegram alerts cho Nobita — sale ends hôm nay + đơn mua gấp.
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
  const enabled = t.enabled === true || String(process.env.TELEGRAM_ENABLED || "").toLowerCase() === "true";
  return {
    enabled,
    botToken: String(process.env.TELEGRAM_BOT_TOKEN || t.botToken || "").trim(),
    chatId: String(process.env.TELEGRAM_CHAT_ID || t.chatId || "").trim(),
    pollMinutes: Math.max(1, Number(process.env.TELEGRAM_POLL_MINUTES || t.pollMinutes || 5)),
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

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const raw = readJsonFile(p, { urgent: {}, saleEnds: {}, lastRunAt: null, lastError: null });
  return { path: p, data: raw };
}

function saveNotifyState(statePath, data) {
  writeJsonFile(statePath, data);
}

function listBuyPoolOrders(orders) {
  return (orders || []).filter((o) => BUY_POOL.has(o.status));
}

/**
 * Quét đơn và gửi Telegram (idempotent theo state file).
 */
async function runTelegramNotifyCheck({ getOrdersForApi, configFile, dataDir, force = false } = {}) {
  const cfg = readTelegramConfig(configFile);
  if (!telegramConfigured(cfg)) {
    return { ok: false, skipped: true, reason: "Telegram chưa bật hoặc thiếu botToken/chatId" };
  }

  const { path: statePath, data: state } = loadNotifyState(dataDir);
  const today = vnDateKey();
  const live = await getOrdersForApi({ force: !!force });
  const orders = listBuyPoolOrders(live.orders);

  const toSend = [];

  for (const order of orders) {
    if (cfg.notifyUrgentBuy && order.isUrgentBuy) {
      const key = String(order.id);
      if (!state.urgent[key]) {
        toSend.push({
          kind: "urgent",
          key: `urgent:${key}`,
          text: formatOrderBlock(order, { headline: "🔴 ĐƠN MUA GẤP" }),
        });
      }
    }

    if (cfg.notifySaleEndsToday) {
      const endKey = saleEndsDateKey(order.saleEnds);
      if (endKey && endKey === today) {
        const stateKey = `${order.id}::${today}`;
        if (!state.saleEnds[stateKey]) {
          toSend.push({
            kind: "sale",
            key: `sale:${stateKey}`,
            text: formatOrderBlock(order, { headline: "⏰ SALE ENDS HÔM NAY" }),
          });
        }
      }
    }
  }

  let sent = 0;
  const errors = [];

  if (toSend.length) {
    const batch =
      toSend.length === 1
        ? toSend[0].text
        : `Nobita — ${toSend.length} thông báo:\n\n${toSend.map((x) => x.text).join("\n\n—\n\n")}`;
    try {
      await sendTelegramMessage(cfg, batch);
      sent = toSend.length;
      for (const item of toSend) {
        if (item.kind === "urgent") {
          const id = item.key.replace(/^urgent:/, "");
          state.urgent[id] = new Date().toISOString();
        } else if (item.kind === "sale") {
          const sk = item.key.replace(/^sale:/, "");
          state.saleEnds[sk] = new Date().toISOString();
        }
      }
      state.lastError = null;
    } catch (err) {
      errors.push(err.message || String(err));
      state.lastError = errors[0];
    }
  }

  state.lastRunAt = new Date().toISOString();
  saveNotifyState(statePath, state);

  return {
    ok: errors.length === 0,
    sent,
    candidates: toSend.length,
    today,
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
        console.log(`[telegram] đã gửi ${result.sent} thông báo`);
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
    `[telegram] ON — group ${cfg.chatId}, poll ${cfg.pollMinutes} phút (VN ${vnDateKey()})`
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
  vnDateKey,
  saleEndsDateKey,
};
