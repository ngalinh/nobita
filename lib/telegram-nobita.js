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

/** Gửi ảnh PNG vào group (sendPhoto). */
async function sendTelegramPhoto(cfg, pngBuffer, caption = "") {
  const form = new FormData();
  form.append("chat_id", String(cfg.chatId));
  if (caption) form.append("caption", String(caption).slice(0, 1024));
  form.append(
    "photo",
    new Blob([pngBuffer], { type: "image/png" }),
    "bao-cao-mua-cham.png"
  );
  const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.description || `Telegram sendPhoto HTTP ${res.status}`);
  }
  return json.result && json.result.message_id;
}

/**
 * Gửi file PNG (sendDocument) — Telegram không nén lại như sendPhoto → chữ bảng sắc nét hơn.
 */
async function sendTelegramDocument(cfg, buffer, filename = "bao-cao.png", caption = "") {
  const form = new FormData();
  form.append("chat_id", String(cfg.chatId));
  if (caption) form.append("caption", String(caption).slice(0, 1024));
  form.append("document", new Blob([buffer], { type: "image/png" }), filename);
  const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendDocument`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.description || `Telegram sendDocument HTTP ${res.status}`);
  }
  return json.result && json.result.message_id;
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

async function telegramApi(cfg, method, body, { timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    const json = await res.json();
    if (!json.ok) {
      const err = new Error(json.description || method);
      err.code = json.error_code;
      throw err;
    }
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

function readUpdateOffset(dataDir) {
  const file = path.join(dataDir, "telegram-update-offset.json");
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const n = Number(raw && raw.offset);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeUpdateOffset(dataDir, offset) {
  const file = path.join(dataDir, "telegram-update-offset.json");
  fs.writeFileSync(file, JSON.stringify({ offset }), "utf8");
}

function sameTelegramChat(a, b) {
  const norm = (v) => String(v || "").trim().replace(/^-100/, "-");
  const x = norm(a);
  const y = norm(b);
  return !!x && x === y;
}

function textMentionsBot(msg, bot) {
  const text = String(msg.text || msg.caption || "");
  const username = String((bot && bot.username) || "").toLowerCase();
  if (!username) return false;
  const entities = msg.entities || msg.caption_entities || [];
  for (const ent of entities) {
    if (ent.type === "mention" || ent.type === "bot_command") {
      const name = text.slice(ent.offset, ent.offset + ent.length).replace(/^@/, "").replace(/^\/(?:order|od)/i, "").toLowerCase();
      if (name === username || name === "@" + username) return true;
    }
    if (ent.type === "text_mention" && ent.user && bot && ent.user.id === bot.id) return true;
  }
  const lower = text.toLowerCase();
  return lower.includes("@" + username) || /^\/(?:order|od)(?:@\w+)?\b/i.test(text.trim());
}

function extractOrderCodes(text) {
  const codes = [];
  const re = /\b([A-Za-z]{1,6}\d{4,12})\b/g;
  let m;
  const raw = String(text || "");
  while ((m = re.exec(raw))) {
    const code = m[1].toUpperCase();
    if (!codes.includes(code)) codes.push(code);
  }
  return codes.slice(0, 5);
}

function formatOrderLookupReply(codes, hits) {
  const lines = [];
  for (const code of codes) {
    const rows = (hits || []).filter((h) => String(h.maDh || "").trim().toUpperCase() === code);
    const numbers = [...new Set(rows.map((r) => String(r.orderNo || "").trim()).filter(Boolean))];
    if (!rows.length) lines.push(`${code}\nKhông thấy mã đơn này trên Excel.`);
    else if (!numbers.length) lines.push(`${code}\nĐã đồng bộ Excel. Chưa có Order number.`);
    else lines.push(`${code}\nOrder number: ${numbers.join(", ")}`);
  }
  return lines.join("\n\n");
}

function startOrderLookupListener({ configFile, dataDir, lookupOrderOnSheet }) {
  if (typeof lookupOrderOnSheet !== "function") return () => {};
  let stopped = false;
  let bot = null;
  let busy = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function reply(cfg, msg, text) {
    await telegramApi(cfg, "sendMessage", {
      chat_id: msg.chat.id,
      text: String(text || "").slice(0, 4000),
      reply_to_message_id: msg.message_id,
      disable_web_page_preview: true,
    });
  }

  async function handleMessage(cfg, msg) {
    if (!msg || !msg.chat || !sameTelegramChat(msg.chat.id, cfg.chatId)) {
      if (msg && msg.chat) console.warn("[telegram] bỏ tin ở chat", msg.chat.id);
      return;
    }
    if (bot && msg.from && msg.from.id === bot.id) return;
    if (!textMentionsBot(msg, bot)) return;
    const text = String(msg.text || msg.caption || "");
    const codes = extractOrderCodes(text);
    if (!codes.length) {
      const name = bot && bot.username ? `@${bot.username}` : "bot";
      await reply(cfg, msg, `Gửi kèm mã đơn. Ví dụ: ${name} SU29092615 hoặc /order SU29092615`);
      return;
    }
    if (busy) {
      await reply(cfg, msg, "Đang đồng bộ Excel, chờ một chút rồi tag lại.");
      return;
    }
    busy = true;
    let progressId = null;
    try {
      const sent = await telegramApi(cfg, "sendMessage", {
        chat_id: msg.chat.id,
        text: `Đang đồng bộ Excel cho ${codes.join(", ")}…`,
        reply_to_message_id: msg.message_id,
        disable_web_page_preview: true,
      });
      progressId = sent && sent.message_id;
      const result = await lookupOrderOnSheet(codes);
      const answer =
        !result || result.ok === false
          ? "Không đồng bộ được Excel: " + ((result && result.error) || "lỗi")
          : formatOrderLookupReply(codes, result.hits || []);
      if (progressId) {
        await telegramApi(cfg, "editMessageText", {
          chat_id: msg.chat.id,
          message_id: progressId,
          text: String(answer).slice(0, 4000),
          disable_web_page_preview: true,
        });
      } else {
        await reply(cfg, msg, answer);
      }
    } catch (err) {
      const fail = "Không đồng bộ được Excel: " + (err.message || String(err));
      if (progressId) {
        await telegramApi(cfg, "editMessageText", {
          chat_id: msg.chat.id,
          message_id: progressId,
          text: fail.slice(0, 4000),
        }).catch(() => {});
      }
    } finally {
      busy = false;
    }
  }

  const loop = async () => {
    while (!stopped) {
      const cfg = readTelegramConfig(configFile);
      if (!telegramConfigured(cfg)) {
        await sleep(15000);
        continue;
      }
      try {
        if (!bot) {
          bot = await telegramApi(cfg, "getMe", {});
          console.log(`[telegram] tag @${bot.username} kèm mã đơn, hoặc /order SU29092615`);
          if (bot.can_read_all_group_messages === false) {
            console.log("[telegram] Group Privacy đang bật — @tag thường không tới bot. Tắt tại BotFather → Group Privacy, rồi mời lại bot vào group.");
          }
        }
        let offset = readUpdateOffset(dataDir);
        if (offset == null) {
          const backlog = await telegramApi(cfg, "getUpdates", { timeout: 0, allowed_updates: ["message"] }, { timeoutMs: 15000 });
          const last = backlog.length ? backlog[backlog.length - 1].update_id + 1 : 0;
          writeUpdateOffset(dataDir, last);
          offset = last;
        }
        const updates = await telegramApi(
          cfg,
          "getUpdates",
          { offset, timeout: 25, allowed_updates: ["message"] },
          { timeoutMs: 35000 }
        );
        let next = offset;
        for (const update of updates) {
          next = update.update_id + 1;
          try {
            await handleMessage(cfg, update.message);
          } catch (err) {
            console.warn("[telegram] lookup:", err.message || err);
          }
        }
        if (next !== offset) writeUpdateOffset(dataDir, next);
      } catch (err) {
        const wait = err && err.code === 409 ? 20000 : 5000;
        console.warn("[telegram] listen:", err.message || err);
        await sleep(wait);
      }
    }
  };

  loop();
  console.log("[telegram] nghe tag + mã đơn trong group");
  return () => {
    stopped = true;
  };
}

function startTelegramNobitaBot({ getOrdersForApi, lookupOrderOnSheet, configFile, dataDir }) {
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
  const stopListen = startOrderLookupListener({ configFile, dataDir, lookupOrderOnSheet });

  return {
    stop: () => {
      if (timer) clearInterval(timer);
      timer = null;
      stopListen();
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
  sendTelegramPhoto,
  sendTelegramDocument,
  buildSaleEndsDigest,
  displayWebsiteName,
  vnDateKey,
  vnHour,
  saleEndsDateKey,
};
