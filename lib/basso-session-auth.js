/**
 * Auth session kiểu Deki/Xeko:
 * GET https://ai.basso.vn/platform/api/auth/session kèm Cookie trình duyệt
 * → nhận user Basso đang đăng nhập (email, tên hiển thị).
 *
 * Khi Nobita chạy dưới cùng domain ai.basso.vn (reverse proxy), cookie tự tới.
 * Localhost: bật NOBITA_DEV_MODE / NOBITA_DEV_AS để giả lập.
 */
const crypto = require("crypto");

const BASSO_AUTH_URL =
  process.env.BASSO_AUTH_URL || "https://ai.basso.vn/platform/api/auth/session";
const CACHE_TTL_MS = 30 * 1000;
const DEV_MODE = process.env.NOBITA_DEV_MODE === "1";
const DEV_AS = String(process.env.NOBITA_DEV_AS || "")
  .toLowerCase()
  .trim();

const sessionCache = new Map();

function hashCookie(cookie) {
  return crypto.createHash("sha256").update(cookie).digest("hex");
}

function displayNameFromSessionUser(u) {
  if (!u || typeof u !== "object") return "";
  const raw =
    u.full_name ||
    u.fullName ||
    u.display_name ||
    u.displayName ||
    u.name ||
    u.first_name ||
    u.username ||
    "";
  const s = String(raw).trim();
  if (!s) return "";
  // email → lấy phần trước @ (vd basso.sale@… → basso.sale; vinh@… → vinh)
  if (s.includes("@")) {
    const local = s.split("@")[0].trim();
    // Capitalize nhẹ: vinh → Vinh
    if (/^[a-z0-9._-]+$/i.test(local) && !local.includes(".")) {
      return local.charAt(0).toUpperCase() + local.slice(1);
    }
    return local;
  }
  return s;
}

function normalizeSessionUser(data) {
  if (!data || data.success !== true || !data.user) return null;
  const u = data.user;
  const email = String(u.username || u.email || "")
    .toLowerCase()
    .trim();
  if (!email) return null;
  const name = displayNameFromSessionUser(u) || email.split("@")[0];
  return {
    email,
    name,
    roles: Array.isArray(u.roles) ? u.roles : [],
    source: "ai.basso.vn/session",
    raw: u,
  };
}

async function verifyBassoSession(cookieHeader) {
  if (!cookieHeader) return null;
  const key = hashCookie(cookieHeader);
  const cached = sessionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  try {
    const response = await fetch(BASSO_AUTH_URL, {
      method: "GET",
      headers: { Cookie: cookieHeader, Accept: "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    const user = normalizeSessionUser(data);
    sessionCache.set(key, { user, expiresAt: Date.now() + CACHE_TTL_MS });
    return user;
  } catch (err) {
    console.error("[auth] verifyBassoSession:", err.message || err);
    return null;
  }
}

function resolveDevUser(req) {
  const rawAs = String(
    (req && (req.headers["x-dev-as"] || req.query.devAs)) || process.env.NOBITA_DEV_AS || ""
  ).trim();
  const override = rawAs.toLowerCase();
  if (!override) {
    return {
      email: "dev@local",
      name: "Vinh",
      roles: ["admin"],
      source: "dev",
      isDev: true,
    };
  }
  const email = override.includes("@") ? override : `${override}@basso.vn`;
  let name;
  if (rawAs.includes("@")) {
    name = displayNameFromSessionUser({ username: rawAs });
  } else {
    // Giữ casing người dùng gõ: Vinh / Thuỷ
    name = rawAs;
  }
  return {
    email,
    name: name || "Vinh",
    roles: ["admin"],
    source: "dev",
    isDev: true,
  };
}

async function getRequestUser(req) {
  if (DEV_MODE) return resolveDevUser(req);
  const cookie = req.headers.cookie || "";
  return verifyBassoSession(cookie);
}

function clearSessionCache() {
  sessionCache.clear();
}

module.exports = {
  BASSO_AUTH_URL,
  DEV_MODE,
  verifyBassoSession,
  getRequestUser,
  resolveDevUser,
  displayNameFromSessionUser,
  normalizeSessionUser,
  clearSessionCache,
};
