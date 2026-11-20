/**
 * Báo cáo mua chậm: chờ mua / cần xử lý, quá 3 ngày chưa Order #, gom theo website.
 */

const BUY_POOL = new Set(["can_mua_order", "can_mua_co", "can_xu_ly"]);

function parseOrderCreatedDate(order) {
  const tryParse = (raw) => {
    const s = String(raw || "").trim();
    let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const id = String(order.id || "");
  const idMatch = id.match(/[A-Za-z]+(\d{2})(\d{2})(\d{2})/);
  if (idMatch) {
    const d = new Date(2000 + Number(idMatch[3]), Number(idMatch[2]) - 1, Number(idMatch[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }

  if (order.createdAt) {
    const d = tryParse(order.createdAt);
    if (d) return d;
  }

  return tryParse(order.saleEnds);
}

function formatDayMonth(d) {
  if (!d) return "—";
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatReportDayMonth(d) {
  if (!d) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatReportHeaderDate(d = new Date()) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function isUnpurchasedOrder(order) {
  if (!BUY_POOL.has(order.status)) return false;
  const items = order.items || [];
  if (!items.length) return true;
  return items.every((it) => !String(it.orderNo || "").trim());
}

function isOverdueOrder(order, now = new Date()) {
  const created = parseOrderCreatedDate(order);
  if (!created) return false;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startCreated = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const days = Math.floor((startToday - startCreated) / (24 * 60 * 60 * 1000));
  return days > 3;
}

function money(n) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * @param {object[]} orders
 * @param {Record<string,string>} reasonsMap — website → lý do đã lưu
 * @param {Date} [now]
 */
function buildOverdueReportRows(orders, reasonsMap = {}, now = new Date()) {
  const groups = new Map();
  for (const order of orders || []) {
    if (!isUnpurchasedOrder(order) || !isOverdueOrder(order, now)) continue;
    const website = String(order.website || "—").trim() || "—";
    const created = parseOrderCreatedDate(order);
    if (!groups.has(website)) {
      groups.set(website, {
        website,
        orderCount: 0,
        amount: 0,
        dateCounts: new Map(),
        groupCounts: new Map(),
        handlers: new Set(),
        notes: [],
      });
    }
    const g = groups.get(website);
    g.orderCount += 1;
    g.amount += Number(order.total || 0);
    if (created) {
      const label = formatReportDayMonth(created);
      g.dateCounts.set(label, (g.dateCounts.get(label) || 0) + 1);
    }
    const kh = String(order.customerType || "").trim() || "Chưa phân nhóm";
    g.groupCounts.set(kh, (g.groupCounts.get(kh) || 0) + 1);
    if (order.handler && String(order.handler).trim() && order.handler !== "Lựa chọn") {
      g.handlers.add(String(order.handler).trim());
    }
    if (order.note && String(order.note).trim()) g.notes.push(String(order.note).trim());
  }

  return [...groups.values()]
    .map((g) => {
      const dateLines = [...g.dateCounts.entries()]
        .sort((a, b) => {
          const [da, ma] = a[0].split("/").map(Number);
          const [db, mb] = b[0].split("/").map(Number);
          return ma - mb || da - db;
        })
        .map(([label, count]) => `Đơn ${label} (${count} đơn)`);
      const groupLines = [...g.groupCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => `${name} (${count} đơn)`);
      const handlers = [...g.handlers].filter(Boolean);
      const saved = reasonsMap[g.website];
      const reason =
        saved != null && String(saved).trim() !== ""
          ? String(saved)
          : g.notes.filter((v, i, a) => a.indexOf(v) === i).join("\n");
      return {
        website: g.website,
        orderCount: g.orderCount,
        amount: g.amount,
        amountLabel: `$ ${money(g.amount)}`,
        dateLines,
        dateLabel: dateLines.join("\n") || "—",
        groupLines,
        groupLabel: groupLines.join("\n") || "—",
        staffLines: handlers,
        staff: handlers.join(", ") || "—",
        reason,
      };
    })
    .sort((a, b) => a.website.localeCompare(b.website));
}

module.exports = {
  BUY_POOL,
  parseOrderCreatedDate,
  formatDayMonth,
  formatReportDayMonth,
  formatReportHeaderDate,
  isUnpurchasedOrder,
  isOverdueOrder,
  buildOverdueReportRows,
  money,
};
