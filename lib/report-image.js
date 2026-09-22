/**
 * Render bảng báo cáo mua chậm → PNG (Playwright).
 */
const { chromium } = require("playwright");
const { formatReportHeaderDate } = require("./report-overdue");

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReportHtml(rows, headerDate) {
  const body = (rows || [])
    .map(
      (row, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td>${escapeHtml(row.website)}</td>
      <td class="c">${row.orderCount}</td>
      <td>${escapeHtml(row.amountLabel || row.amount)}</td>
      <td class="c">${escapeHtml(row.dateLabel)}</td>
      <td class="c">${escapeHtml(row.staff)}</td>
      <td class="reason">${escapeHtml(row.reason || "").replace(/\n/g, "<br>")}</td>
    </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 16px;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #111;
  }
  .caption {
    margin: 0 0 10px;
    font-size: 13px;
    color: #444;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    border: 1px solid #222;
    background: #fff;
  }
  th, td {
    border: 1px solid #222;
    padding: 8px 10px;
    vertical-align: middle;
  }
  thead th {
    background: #ffe600;
    font-weight: 700;
    text-align: center;
  }
  .date-head {
    font-size: 16px;
    letter-spacing: 0.5px;
  }
  td.c { text-align: center; }
  td.reason {
    text-align: left;
    white-space: pre-wrap;
    max-width: 420px;
    line-height: 1.35;
  }
  .empty {
    text-align: center;
    color: #666;
    padding: 24px;
  }
</style>
</head>
<body>
  <p class="caption">Tổng hợp đơn ở trạng thái chờ mua / cần xử lý, quá 3 ngày chưa có Order #, gom theo website.</p>
  <table>
    <thead>
      <tr><th colspan="7" class="date-head">${escapeHtml(headerDate)}</th></tr>
      <tr>
        <th style="width:48px">STT</th>
        <th>Website</th>
        <th style="width:110px">Số đơn mua chậm</th>
        <th style="width:100px">Số tiền</th>
        <th style="width:120px">Ngày tạo đơn</th>
        <th style="width:100px">Người xử lý</th>
        <th>Lý do</th>
      </tr>
    </thead>
    <tbody>
      ${
        body ||
        `<tr><td colspan="7" class="empty">Không có website nào quá 3 ngày chưa mua.</td></tr>`
      }
    </tbody>
  </table>
</body>
</html>`;
}

/**
 * @param {object[]} rows
 * @param {{ headerDate?: string }} [opts]
 * @returns {Promise<Buffer>}
 */
async function renderReportPng(rows, opts = {}) {
  const headerDate = opts.headerDate || formatReportHeaderDate(new Date());
  const html = buildReportHtml(rows, headerDate);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 800 },
      deviceScaleFactor: 2,
    });
    await page.setContent(html, { waitUntil: "load" });
    const table = page.locator("table");
    await table.waitFor({ state: "visible" });
    // Chụp cả caption + bảng
    const shot = await page.locator("body").screenshot({ type: "png" });
    return Buffer.from(shot);
  } finally {
    await browser.close();
  }
}

module.exports = {
  buildReportHtml,
  renderReportPng,
};
