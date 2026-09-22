/**
 * Báo cáo mua chậm — không dùng Playwright (server thường thiếu lib Chromium).
 * Ảnh PNG được vẽ trên trình duyệt rồi POST base64 lên /api/telegram/send-report.
 */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML tham chiếu (preview / debug) — không render Chromium. */
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

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>
  <p>Tổng hợp đơn quá 3 ngày chưa Order # — ${escapeHtml(headerDate)}</p>
  <table border="1" cellpadding="6" cellspacing="0">${body || "<tr><td>Trống</td></tr>"}</table>
  </body></html>`;
}

module.exports = {
  buildReportHtml,
};
