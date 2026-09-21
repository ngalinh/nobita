const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const ExcelJS = require("exceljs");

const DEFAULT_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const DEFAULT_SHEET_GID = Number(process.env.GOOGLE_SHEET_GID || 0);
const CREDENTIALS_FILE =
  process.env.GOOGLE_CREDENTIALS_FILE ||
  path.join(__dirname, "..", "credentials.json");

const HEADERS = [
  "Date",
  "Website/Code",
  "Items",
  "size- màu",
  "Sub - Total",
  "Số lượng",
  "Ship web/ Discount",
  "Kho",
  "Mã ĐH",
];

/** Field ghi lên Sheet khi Gửi đơn */
const COLUMN_FIELDS = [
  { key: "date", label: "Date" },
  { key: "website", label: "Website/Code" },
  { key: "items", label: "Items (chỉ link SP)" },
  { key: "sizeColor", label: "size - màu" },
  { key: "subTotal", label: "Sub - Total (giá)" },
  { key: "qty", label: "Số lượng" },
  { key: "shipDiscount", label: "Ship web / Discount" },
  { key: "kho", label: "Kho (địa chỉ)" },
  { key: "maDh", label: "Mã ĐH" },
  // Mặc định cùng cột Date — ID ghi dòng dưới ngày; chỉ map khác nếu muốn cột riêng
  { key: "itemKey", label: "Nobita ID (mặc định dòng dưới Date)" },
];

/** Field đọc ngược từ Sheet → Nobita (Order #, Tracking) */
const REVERSE_FIELDS = [
  { key: "orderNo", label: "Order # (đọc từ Sheet)" },
  { key: "tracking", label: "Tracking (đọc từ Sheet)" },
];

const ALL_COLUMN_FIELDS = [...COLUMN_FIELDS, ...REVERSE_FIELDS];

function defaultColumnMap() {
  return {
    date: "A",
    website: "B",
    items: "C",
    sizeColor: "D",
    subTotal: "E",
    qty: "F",
    shipDiscount: "G",
    kho: "H",
    maDh: "I",
    // Cùng cột Date → không ghi ô riêng; ID nằm dòng 2 của ô Date
    itemKey: "A",
    orderNo: "J",
    tracking: "K",
  };
}

function normalizeColumnLetter(raw) {
  const col = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!col || col.length > 3) return "";
  return col;
}

function normalizeColumnMap(input) {
  const base = defaultColumnMap();
  const src = input && typeof input === "object" ? input : {};
  const out = { ...base };
  for (const f of ALL_COLUMN_FIELDS) {
    const n = normalizeColumnLetter(src[f.key]);
    if (n) out[f.key] = n;
  }
  return out;
}

/** A→0, B→1, ..., Z→25, AA→26 */
function columnLetterToIndex(letter) {
  const col = normalizeColumnLetter(letter);
  if (!col) return -1;
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function indexToColumnLetter(index) {
  let n = Number(index) + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function formatShipDiscount(shipFee, discount) {
  const ship = Number(shipFee || 0);
  const disc = Number(discount || 0);
  const parts = [];
  if (ship !== 0) parts.push(String(ship));
  if (disc !== 0) parts.push(String(disc));
  // Cả 0 → không nhập gì; có số thì ghép "ship / discount" (bỏ số 0)
  if (!parts.length) return "";
  if (ship !== 0 && disc !== 0) return `${ship} / ${disc}`;
  return parts[0];
}

function formatSizeColor(size, color) {
  const parts = [];
  const s = String(size || "").trim();
  const c = String(color || "").trim();
  if (s) {
    parts.push(/^size\s*:/i.test(s) ? s : `Size: ${s}`);
  }
  if (c) {
    parts.push(/^(color|màu)\s*:/i.test(c) ? c : `Color: ${c}`);
  }
  return parts.join("\n");
}

/** Date ô Sheet: dòng 1 = 10/9/2026, dòng 2 = A3K9XM */
function formatSheetDate(raw) {
  // Chỉ lấy dòng đầu (phòng raw đã lẫn ID)
  const text = String(raw || "")
    .replace(/\r\n/g, "\n")
    .split("\n")[0]
    .trim();
  const m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!m) return text;
  let y = m[3];
  if (y.length === 2) y = `20${y}`;
  return `${Number(m[1])}/${Number(m[2])}/${y}`;
}

function formatItemKeyLine(itemKey) {
  return String(itemKey || "")
    .trim()
    .replace(/^ID\s*->\s*/i, "");
}

function formatDateWithItemKey(date, itemKey) {
  const d = formatSheetDate(date);
  const key = formatItemKeyLine(itemKey);
  if (d && key) return `${d}\n${key}`;
  return d || key;
}

function parseItemKeyFromDateCell(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    const only = lines[0] || "";
    const m = only.match(/^ID\s*->\s*(.+)$/i);
    if (m) return m[1].trim();
    // Một dòng chỉ ID ngắn
    if (/^[A-Z2-9]{6}$/i.test(only)) return only.toUpperCase();
    return "";
  }
  const first = lines[0];
  let rest = lines.slice(1).join(" ").trim();
  const prefixed = rest.match(/^ID\s*->\s*(.+)$/i);
  if (prefixed) rest = prefixed[1].trim();
  if (
    /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(first) ||
    /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(first)
  ) {
    return rest;
  }
  return rest || lines[lines.length - 1];
}

function orderToFieldValues(order) {
  const sizeMau = formatSizeColor(order.size, order.color);
  const link = order.productUrl || order.items || "";
  const shipDiscount = order.shipDiscount == null ? "" : String(order.shipDiscount).trim();
  const itemKey = order.itemKey || "";
  return {
    date: formatDateWithItemKey(order.date || "", itemKey),
    website: order.website || "",
    items: link,
    sizeColor: sizeMau,
    subTotal: order.subTotal ?? "",
    qty: order.qty ?? "",
    shipDiscount: shipDiscount === "0" || shipDiscount === "0 / 0" || shipDiscount === "0/0" ? "" : shipDiscount,
    kho: order.kho || "",
    maDh: order.maDh || "",
    itemKey,
  };
}

/** Build 1 hàng theo map cột (ô trống xen giữa được giữ "") */
function buildMappedRow(order, columns) {
  const map = normalizeColumnMap(columns);
  const values = orderToFieldValues(order);
  const dateCol = normalizeColumnLetter(map.date);
  const itemKeyCol = normalizeColumnLetter(map.itemKey);
  // ID đã nằm dưới Date → bỏ ghi cột itemKey riêng nếu trùng cột Date
  const skipItemKeyCol = !itemKeyCol || itemKeyCol === dateCol;
  let maxIdx = 0;
  const placements = [];
  for (const f of COLUMN_FIELDS) {
    if (f.key === "itemKey" && skipItemKeyCol) continue;
    const idx = columnLetterToIndex(map[f.key]);
    if (idx < 0) continue;
    maxIdx = Math.max(maxIdx, idx);
    placements.push({ idx, key: f.key, value: values[f.key] });
  }
  const row = Array(maxIdx + 1).fill("");
  for (const p of placements) row[p.idx] = p.value;
  return { row, map, maxCol: indexToColumnLetter(maxIdx), itemsCol: map.items || "C" };
}

const LOCAL_XLSX = path.join(__dirname, "..", "data", "don-mua.xlsx");

/** Legacy exports */
const SPREADSHEET_ID = DEFAULT_SPREADSHEET_ID;
const SHEET_GID = DEFAULT_SHEET_GID;

function parseSheetUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return {
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      sheetGid: DEFAULT_SHEET_GID,
      sheetUrl: defaultSheetUrl(),
    };
  }
  const idMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = raw.match(/[?#&]gid=(\d+)/);
  const spreadsheetId = idMatch ? idMatch[1] : raw;
  // Không có gid (vd ?usp=sharing) → lấy sheet đầu tiên
  const sheetGid = gidMatch ? Number(gidMatch[1]) : null;
  return {
    spreadsheetId,
    sheetGid,
    sheetUrl: idMatch
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${
          sheetGid != null ? `?gid=${sheetGid}#gid=${sheetGid}` : ""
        }`
      : raw,
  };
}

function defaultSheetUrl() {
  return `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit?gid=${DEFAULT_SHEET_GID}#gid=${DEFAULT_SHEET_GID}`;
}

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error(`Không thấy credentials: ${CREDENTIALS_FILE}`);
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf8"));
}

async function getSheetsClient() {
  const creds = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function parseOrderDate(raw) {
  const s = String(raw || "").trim();
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})(?:\s|$)/);
  if (m) return { day: Number(m[1]), month: Number(m[2]), year: 2000 + Number(m[3]) };
  return null;
}

function normalizeSheetTitle(title) {
  return String(title || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** Khớp tab kiểu T10/2025, T9/2025, T10-2025… theo tháng của ngày đơn */
function findSheetByOrderMonth(sheetList, orderDateRaw) {
  const parsed = parseOrderDate(orderDateRaw);
  if (!parsed || !parsed.month || !parsed.year) return null;

  const month = parsed.month;
  const year = parsed.year;
  const y2 = String(year).slice(-2);
  const candidates = new Set(
    [
      `T${month}/${year}`,
      `T${String(month).padStart(2, "0")}/${year}`,
      `T${month}/${y2}`,
      `T${String(month).padStart(2, "0")}/${y2}`,
      `T${month}-${year}`,
      `T${String(month).padStart(2, "0")}-${year}`,
      `${month}/${year}`,
      `${String(month).padStart(2, "0")}/${year}`,
    ].map(normalizeSheetTitle)
  );

  const exact = sheetList.find((s) => candidates.has(normalizeSheetTitle(s.properties && s.properties.title)));
  if (exact) return exact;

  const re = new RegExp(`(?:^|\\b)T?\\s*0?${month}\\s*[\\/\\-]\\s*(?:${year}|${y2})(?:\\b|$)`, "i");
  return sheetList.find((s) => re.test(String((s.properties && s.properties.title) || ""))) || null;
}

/**
 * Chọn tab ghi đơn:
 * 1) Theo tháng của "Thời gian" (T10/2025…)
 * 2) Theo gid trong link PTTT (nếu có)
 * 3) Tab đầu tiên
 */
async function resolveSheetTitle(sheets, spreadsheetId, sheetGid, orderDateRaw) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const list = meta.data.sheets || [];
  if (!list.length) throw new Error("Không tìm thấy worksheet trong spreadsheet");

  const byMonth = findSheetByOrderMonth(list, orderDateRaw);
  if (byMonth && byMonth.properties) {
    return { title: byMonth.properties.title, sheetGid: byMonth.properties.sheetId, matchedBy: "date" };
  }

  if (orderDateRaw && parseOrderDate(orderDateRaw) && list.length > 1) {
    const names = list.map((s) => (s.properties && s.properties.title) || "?").join(", ");
    const parsed = parseOrderDate(orderDateRaw);
    throw new Error(
      `Không tìm thấy tab tháng T${parsed.month}/${parsed.year} (theo Thời gian ${orderDateRaw}). Các tab hiện có: ${names}`
    );
  }

  if (sheetGid != null) {
    const found = list.find((s) => s.properties && s.properties.sheetId === sheetGid);
    if (found) return { title: found.properties.title, sheetGid: found.properties.sheetId, matchedBy: "gid" };
  }

  return {
    title: list[0].properties.title,
    sheetGid: list[0].properties.sheetId,
    matchedBy: "first",
  };
}

function buildRow(order) {
  return buildMappedRow(order, defaultColumnMap()).row;
}

async function ensureLocalWorkbook() {
  const dir = path.dirname(LOCAL_XLSX);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(LOCAL_XLSX)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(LOCAL_XLSX);
    return wb;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("DonMua");
  ws.addRow(HEADERS);
  ws.getRow(1).font = { bold: true };
  await wb.xlsx.writeFile(LOCAL_XLSX);
  return wb;
}

async function appendLocalExcel(order) {
  const wb = await ensureLocalWorkbook();
  const ws = wb.getWorksheet("DonMua") || wb.worksheets[0];
  const values = buildRow(order);
  const row = ws.addRow(values);

  if (order.productUrl && /^https?:/i.test(order.productUrl)) {
    const cell = row.getCell(3);
    cell.value = {
      text: order.productUrl,
      hyperlink: order.productUrl,
    };
    cell.font = { color: { argb: "FF0563C1" }, underline: true };
  }

  await wb.xlsx.writeFile(LOCAL_XLSX);
  return { file: LOCAL_XLSX, rowNumber: row.number };
}

/**
 * Tìm dòng đầu tiên (từ dòng 2) mà mọi cột trong mapping đều trống.
 * Đọc 1 lần range A:maxCol — tránh N request / cột (gây treo khi gửi đơn).
 */
async function findNextEmptyRow(sheets, spreadsheetId, title, columns) {
  const map = normalizeColumnMap(columns);
  const mappedCols = [];
  const seen = new Set();
  for (const f of COLUMN_FIELDS) {
    const col = normalizeColumnLetter(map[f.key]);
    if (!col || seen.has(col)) continue;
    // itemKey trùng Date → đã có trong date
    if (f.key === "itemKey" && col === normalizeColumnLetter(map.date)) continue;
    seen.add(col);
    mappedCols.push(col);
  }
  if (!mappedCols.length) mappedCols.push("A");

  const maxCol = mappedCols
    .slice()
    .sort((a, b) => columnLetterToIndex(b) - columnLetterToIndex(a))[0];
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A:${maxCol}`,
    majorDimension: "ROWS",
  });
  const rows = res.data.values || [];
  const startRow = 2;
  const scanTo = Math.max(rows.length + 1, startRow);

  for (let rowNum = startRow; rowNum <= scanTo; rowNum++) {
    const row = rows[rowNum - 1] || [];
    const allEmpty = mappedCols.every((col) => {
      const idx = columnLetterToIndex(col);
      const raw = row[idx] != null ? String(row[idx]).trim() : "";
      if (raw === "" || raw === "0" || raw === "0.00" || raw === "$0.00") return true;
      return false;
    });
    if (allEmpty) return rowNum;
  }
  return scanTo;
}

function buildBatchCellsForOrder(order, columns, title, rowNum) {
  const cols = normalizeColumnMap(columns);
  const fieldValues = orderToFieldValues(order);
  const data = [];
  for (const f of COLUMN_FIELDS) {
    // ID luôn nằm dòng dưới Date — không ghi cột itemKey riêng (tránh đè mất ngày)
    if (f.key === "itemKey") continue;
    const col = normalizeColumnLetter(cols[f.key]);
    if (!col) continue;
    let cellVal = fieldValues[f.key];
    if (f.key === "items" && order.productUrl) cellVal = order.productUrl;
    if (f.key === "shipDiscount" && (cellVal === "" || cellVal == null || cellVal === 0 || cellVal === "0")) {
      continue;
    }
    data.push({
      range: `'${title}'!${col}${rowNum}`,
      values: [[cellVal == null ? "" : cellVal]],
    });
  }
  return data;
}

async function appendGoogleSheet(order, target = {}) {
  const spreadsheetId = String(target.spreadsheetId || DEFAULT_SPREADSHEET_ID || "").trim();
  if (!spreadsheetId) {
    throw new Error(
      "Thiếu spreadsheetId — điền link Google Sheet vào PTTT (Cài đặt) hoặc GOOGLE_SHEET_ID"
    );
  }
  const preferredGid = target.sheetGid != null ? Number(target.sheetGid) : null;
  const columns = normalizeColumnMap(target.columns);
  const sheets = await getSheetsClient();
  const resolved = await resolveSheetTitle(sheets, spreadsheetId, preferredGid, order.date);
  const title = resolved.title;
  const sheetGid = resolved.sheetGid;
  const itemsCol = normalizeColumnLetter(columns.items) || "C";

  const rowNum = await findNextEmptyRow(sheets, spreadsheetId, title, columns);
  const data = buildBatchCellsForOrder(order, columns, title, rowNum);

  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data,
      },
    });
  }

  return {
    spreadsheetId,
    sheetGid,
    sheetTitle: title,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=${sheetGid}#gid=${sheetGid}`,
    matchedBy: resolved.matchedBy || null,
    updatedRange: data.map((d) => d.range).join(", "),
    rowNumber: rowNum,
    hyperlink: !!(order.productUrl && itemsCol),
    columns,
    serviceAccount: loadCredentials().client_email,
  };
}

async function sendOrderToSheets(order, target = {}) {
  // Ưu tiên Google Sheet (đích thật). Local Excel chỉ backup khi Google OK.
  let google = null;
  let googleError = null;
  try {
    google = await appendGoogleSheet(order, target);
  } catch (err) {
    googleError = err.message || String(err);
  }

  let local = null;
  if (google) {
    try {
      local = await appendLocalExcel(order);
    } catch (err) {
      // Google đã OK — local lỗi không làm fail đơn
      local = { error: err.message || String(err) };
    }
  }

  return { local, google, googleError };
}

function explainGoogleError(err) {
  const msg = String(err || "");
  if (/invalid_grant|Invalid JWT Signature/i.test(msg)) {
    return (
      "Credentials Google không hợp lệ (Invalid JWT Signature). " +
      "Vào Cài đặt → tải lại file JSON service account, rồi Share sheet với quyền Editor cho email service account."
    );
  }
  if (/PERMISSION_DENIED|The caller does not have permission|403/i.test(msg)) {
    return (
      "Service account chưa có quyền ghi sheet. Mở link Excel → Share → thêm email service account với quyền Editor."
    );
  }
  // Google thường trả 404 thay vì 403 khi sheet chưa share / sai ID / đã xóa
  if (/Requested entity was not found|NOT_FOUND|404/i.test(msg)) {
    return (
      "Không tìm thấy Google Sheet (sai link hoặc chưa Share). " +
      "Mở link Excel trong Cài đặt PTTT → Share → thêm email service account (Editor) → thử lại."
    );
  }
  if (/ENOENT|Không thấy credentials/i.test(msg)) {
    return "Chưa có file credentials.json. Vào Cài đặt để tải lên.";
  }
  if (/Không tìm thấy tab tháng/i.test(msg)) {
    return msg;
  }
  if (/Thiếu spreadsheetId|GOOGLE_SHEET_ID|sheetUrl/i.test(msg)) {
    return msg;
  }
  return "Không ghi được Google Sheet: " + msg;
}

/**
 * Gửi giỏ Đang mua → Excel/Sheet theo cột đã giao ước.
 * Một lần auth + resolve tab + tìm dòng trống, rồi batch ghi tất cả dòng.
 */
async function sendBuyListToSheets(buyList, meta = {}) {
  const date = String(meta.date || meta.created_time || "").trim();
  const ship = Number(meta.ship_fee || 0);
  const discount = Number(meta.discount || 0);
  const shipDiscount =
    meta.shipDiscount != null ? String(meta.shipDiscount) : formatShipDiscount(ship, discount);
  const kho = String(meta.kho || meta.warehouse || "").trim();
  const target = {
    ...parseSheetUrl(meta.sheetUrl || meta.excelUrl || ""),
    columns: normalizeColumnMap(meta.columns),
  };

  const orders = [];
  for (let i = 0; i < buyList.length; i++) {
    const item = buyList[i];
    const qty = Number(item.qty || 1);
    const price = Number(item.price || 0);
    const itemKeyRaw =
      item.itemKey ||
      item.buyId ||
      Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01IO]/g, "X");
    // Ép ID ngắn; bỏ format dài cũ
    let itemKey = String(itemKeyRaw).replace(/^ID\s*->\s*/i, "").trim();
    if (!/^[A-Z2-9]{6}$/.test(itemKey)) {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      itemKey = "";
      for (let k = 0; k < 6; k++) itemKey += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    item.itemKey = itemKey;
    orders.push({
      date,
      website: item.website || meta.website || "",
      items: item.url || "",
      productUrl: item.url || "",
      size: item.size || "",
      color: item.color || "",
      subTotal: (price * qty).toFixed(2),
      qty,
      shipDiscount: i === 0 ? shipDiscount : "",
      kho,
      maDh: item.orderCode || item.orderId || "",
      itemKey: item.itemKey,
      payment: meta.payment_id || meta.payment || "",
      buyer: meta.buyer || "",
      note: meta.note || "",
    });
  }

  let google = null;
  let googleError = null;
  try {
    if (!target.spreadsheetId) {
      throw new Error(
        "Thiếu spreadsheetId — điền link Google Sheet vào PTTT (Cài đặt) hoặc GOOGLE_SHEET_ID"
      );
    }
    const sheets = await getSheetsClient();
    const resolved = await resolveSheetTitle(
      sheets,
      target.spreadsheetId,
      target.sheetGid != null ? Number(target.sheetGid) : null,
      date
    );
    let rowNum = await findNextEmptyRow(
      sheets,
      target.spreadsheetId,
      resolved.title,
      target.columns
    );

    const data = [];
    const written = [];
    for (const order of orders) {
      data.push(...buildBatchCellsForOrder(order, target.columns, resolved.title, rowNum));
      written.push({ order, rowNumber: rowNum, sheetTitle: resolved.title });
      rowNum += 1;
    }

    if (data.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: target.spreadsheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data },
      });
    }

    google = {
      spreadsheetId: target.spreadsheetId,
      sheetGid: resolved.sheetGid,
      sheetTitle: resolved.title,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${target.spreadsheetId}/edit?gid=${resolved.sheetGid}#gid=${resolved.sheetGid}`,
      matchedBy: resolved.matchedBy || null,
      count: orders.length,
      serviceAccount: loadCredentials().client_email,
    };

    for (const w of written) {
      try {
        await appendLocalExcel(w.order);
      } catch {
        /* local backup optional */
      }
    }

    return {
      count: orders.length,
      rows: written.map((w) => ({ order: w.order, google: { ...google, rowNumber: w.rowNumber }, googleError: null })),
      spreadsheetId: target.spreadsheetId,
      sheetUrl: google.sheetUrl,
      columns: target.columns,
      localFile: LOCAL_XLSX,
      googleOk: true,
      googleError: null,
    };
  } catch (err) {
    googleError = err.message || String(err);
    return {
      count: 0,
      rows: orders.map((order) => ({ order, google: null, googleError })),
      spreadsheetId: target.spreadsheetId,
      sheetUrl: target.sheetUrl,
      columns: target.columns,
      localFile: LOCAL_XLSX,
      googleOk: false,
      googleError,
    };
  }
}

/**
 * Đọc ngược Order # + Tracking từ Sheet, khớp theo Mã ĐH (+ link SP nếu có).
 * Quét các tab Tm/yyyy hoặc toàn bộ tab nếu không chỉ định ngày.
 */
async function pullReverseFromSheet(meta = {}) {
  const target = {
    ...parseSheetUrl(meta.sheetUrl || meta.excelUrl || ""),
    columns: normalizeColumnMap(meta.columns),
  };
  const columns = target.columns;
  const maDhCol = normalizeColumnLetter(columns.maDh);
  const orderNoCol = normalizeColumnLetter(columns.orderNo);
  const trackingCol = normalizeColumnLetter(columns.tracking);
  const itemsCol = normalizeColumnLetter(columns.items);
  const sizeColorCol = normalizeColumnLetter(columns.sizeColor);
  const dateCol = normalizeColumnLetter(columns.date);
  const itemKeyCol = normalizeColumnLetter(columns.itemKey);

  if (!maDhCol) throw new Error("Chưa map cột Mã ĐH trong Cài đặt");
  if (!orderNoCol && !trackingCol) throw new Error("Chưa map cột Order # / Tracking trong Cài đặt");

  const sheets = await getSheetsClient();
  const spreadsheetMeta = await sheets.spreadsheets.get({
    spreadsheetId: target.spreadsheetId,
    fields: "sheets.properties",
  });
  const list = spreadsheetMeta.data.sheets || [];
  if (!list.length) throw new Error("Spreadsheet không có tab");

  let tabs = list;
  if (meta.orderDate || meta.date || meta.created_time) {
    const matched = findSheetByOrderMonth(list, meta.orderDate || meta.date || meta.created_time);
    if (matched) tabs = [matched];
  }

  const records = [];
  for (const tab of tabs) {
    const title = tab.properties.title;
    const colsNeeded = [maDhCol, orderNoCol, trackingCol, itemsCol, sizeColorCol, dateCol, itemKeyCol].filter(
      Boolean
    );
    const maxCol = colsNeeded.sort((a, b) => columnLetterToIndex(b) - columnLetterToIndex(a))[0];
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: target.spreadsheetId,
      range: `'${title}'!A:${maxCol}`,
      majorDimension: "ROWS",
    });
    const rows = res.data.values || [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const maDh = String(row[columnLetterToIndex(maDhCol)] || "").trim();
      if (!maDh || /^mã\s*đh$/i.test(maDh) || /^ma\s*dh$/i.test(maDh)) continue;
      const orderNo = orderNoCol ? String(row[columnLetterToIndex(orderNoCol)] || "").trim() : "";
      const tracking = trackingCol ? String(row[columnLetterToIndex(trackingCol)] || "").trim() : "";
      const itemsUrl = itemsCol ? String(row[columnLetterToIndex(itemsCol)] || "").trim() : "";
      const sizeColor = sizeColorCol ? String(row[columnLetterToIndex(sizeColorCol)] || "").trim() : "";
      const dateCell = dateCol ? String(row[columnLetterToIndex(dateCol)] || "") : "";
      let itemKey = "";
      if (itemKeyCol && itemKeyCol !== dateCol) {
        itemKey = String(row[columnLetterToIndex(itemKeyCol)] || "").trim();
      }
      if (!itemKey) itemKey = parseItemKeyFromDateCell(dateCell);
      if (!orderNo && !tracking && !itemKey) continue;
      records.push({
        sheetTitle: title,
        rowNumber: i + 1,
        maDh,
        orderNo,
        tracking,
        itemsUrl,
        sizeColor,
        itemKey,
      });
    }
  }

  return {
    spreadsheetId: target.spreadsheetId,
    count: records.length,
    records,
  };
}

module.exports = {
  HEADERS,
  COLUMN_FIELDS,
  REVERSE_FIELDS,
  ALL_COLUMN_FIELDS,
  SPREADSHEET_ID,
  SHEET_GID,
  parseSheetUrl,
  defaultSheetUrl,
  defaultColumnMap,
  normalizeColumnMap,
  sendOrderToSheets,
  sendBuyListToSheets,
  pullReverseFromSheet,
  appendLocalExcel,
  appendGoogleSheet,
  buildRow,
  buildMappedRow,
  formatShipDiscount,
  explainGoogleError,
  loadCredentials,
  CREDENTIALS_FILE,
};
