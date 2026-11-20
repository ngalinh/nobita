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
      <td>${escapeHtml(row.dateLabel || "").replace(/\n/g, "<br>")}</td>
      <td>${escapeHtml(row.groupLabel || "").replace(/\n/g, "<br>")}</td>
      <td>${escapeHtml((row.staffLines || []).join("\n") || row.staff || "").replace(/\n/g, "<br>")}</td>
      <td class="reason">${escapeHtml(row.reason || "").replace(/\n/g, "<br>")}</td>
    </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>
  <h3>Báo cáo đơn chậm mua ${escapeHtml(headerDate)}</h3>
  <p>Đơn chờ mua / cần xử lý, quá 3 ngày chưa có Order # · Gom theo website</p>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead><tr><th>STT</th><th>Website</th><th>Đơn chậm</th><th>Số tiền</th><th>Ngày tạo đơn</th><th>Nhóm KH</th><th>Người xử lý</th><th>Lý do</th></tr></thead>
    <tbody>${body || "<tr><td colspan='8'>Trống</td></tr>"}</tbody>
  </table>
  </body></html>`;
}

module.exports = {
  buildReportHtml,
};
