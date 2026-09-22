/**
 * Basso web_order/create mock
 * - Tabs list: filter_tab
 * - Tab Gửi đơn: giỏ + form gửi Sheet
 * - Tab Đang mua: giỏ + form tạo đơn Admin (createWebOrder)
 */
const state = {
  orders: [],
  buyList: [],
  settings: { pttt: [], warehouses: [] },
  createMeta: {
    countries: [],
    payments: [],
    warehouses: [],
    web_cashbacks: [],
    brands: [],
    branches: [],
  },
  websites: [],
  fieldDefs: [
    { key: "date", label: "Date" },
    { key: "website", label: "Website/Code" },
    { key: "items", label: "Items (chỉ link SP)" },
    { key: "sizeColor", label: "size - màu" },
    { key: "subTotal", label: "Sub - Total (giá)" },
    { key: "qty", label: "Số lượng" },
    { key: "shipDiscount", label: "Ship web / Discount" },
    { key: "kho", label: "Kho (địa chỉ)" },
    { key: "maDh", label: "Mã ĐH" },
    { key: "itemKey", label: "Nobita ID (mặc định dòng dưới Date)" },
    { key: "orderNo", label: "Order #" },
    { key: "tracking", label: "Tracking" },
  ],
  defaultColumns: {
    date: "A",
    website: "B",
    items: "C",
    sizeColor: "D",
    subTotal: "E",
    qty: "F",
    shipDiscount: "G",
    kho: "H",
    maDh: "I",
    itemKey: "A",
    orderNo: "J",
    tracking: "K",
  },
  openColMapIdx: null,
  section: "orders", // orders | settings
  status: "can_mua_order",
  /** Local mock / partner buyer name / SSO session name */
  currentUser: "Vinh",
  sessionUser: null,
  authSource: "",
  picOptions: ["Lựa chọn", "Dzuong", "Thùy Linh", "Vinh", "Thuỷ", "Bình", "Tâm", "Thảo", "Vân"],
  source: "mock",
  pendingByTab: {},
  websitePttt: {},
  websitePtttSource: "",
  websitePtttError: "",
  websitePtttAdminCount: 0,
  reportReasons: {},
  query: "",
  site: "",
  page: 1,
  pageSize: 20,
};

const PIC_OPTIONS_FALLBACK = ["Lựa chọn", "Dzuong", "Thùy Linh", "Vinh", "Thuỷ", "Bình", "Tâm", "Thảo", "Vân"];

function picOptionsList() {
  const list = Array.isArray(state.picOptions) && state.picOptions.length ? state.picOptions : PIC_OPTIONS_FALLBACK;
  return list[0] === "Lựa chọn" ? list : ["Lựa chọn", ...list];
}

function money(n) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRate(rate) {
  const s = String(rate || "").trim();
  if (!s) return "";
  const m = s.match(/^([\d.,]+)\s*(đ|d)?$/i);
  if (!m) return s;
  const n = Number(String(m[1]).replace(/,/g, ""));
  if (!Number.isFinite(n)) return s;
  return `${n.toLocaleString("en-US")}đ`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Token Partner từ phiên đăng nhập ai.basso.vn (giống Doraemon). */
function getChatUser() {
  try {
    return JSON.parse(
      localStorage.getItem("ai_chat_user") || sessionStorage.getItem("ai_chat_user") || "null"
    );
  } catch {
    return null;
  }
}

function getPartnerAuthHeaders() {
  const user = getChatUser();
  if (user && user.token) return { Authorization: `Bearer ${user.token}` };
  return {};
}

/** Base path khi chạy dưới /b/<botId>/ trên ai.basso.vn (kiểu Deki). */
const API_BASE = (() => {
  const p = location.pathname.replace(/\/[^/]*\.html?$/i, "/").replace(/\/?$/, "");
  if (/\/b\/[^/]+$/i.test(p) || /\/b\/[^/]+\//i.test(location.pathname)) {
    const m = location.pathname.match(/^(\/b\/[^/]+)/i);
    return m ? m[1] : "";
  }
  return "";
})();

function apiUrl(path) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return API_BASE + clean;
}

function apiFetch(url, opts = {}) {
  const headers = {
    ...(opts.headers || {}),
    ...getPartnerAuthHeaders(),
  };
  const full = url.startsWith("http") || url.startsWith(API_BASE) ? url : apiUrl(url);
  return fetch(full, { ...opts, credentials: "include", headers });
}

function toggle_row(ele) {
  const tbody = $(ele).parent().parent().parent();
  const nextItems = $(ele).parent().parent().next().find(".item-detail");
  tbody.find(".item-detail").each(function () {
    if (!$(this).is(nextItems)) $(this).slideUp();
  });
  nextItems.slideToggle();
}

function toast(msg, opts) {
  let el = document.getElementById("nobita-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "nobita-toast";
    el.style.cssText =
      "position:fixed;right:16px;bottom:16px;max-width:min(480px,92vw);background:#3a3f51;color:#fff;padding:12px 14px;border-radius:4px;z-index:9999;opacity:0;transition:opacity .2s;line-height:1.4;font-size:13px;white-space:pre-wrap";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = opts && opts.error ? "#b42318" : "#3a3f51";
  el.style.opacity = "1";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.style.opacity = "0"), opts && opts.error ? 8000 : 2800);
}

function picOptionsHtml(selected) {
  const opts = picOptionsList();
  const cur = selected && opts.includes(selected) ? selected : "Lựa chọn";
  return opts.map((name) => {
    const sel = name === cur ? " selected" : "";
    return `<option value="${escapeHtml(name)}"${sel}>${escapeHtml(name)}</option>`;
  }).join("");
}

function ptttSuggestHtml(order) {
  const name = String(order.ptttSuggestName || "").trim();
  if (!name) {
    const err = state.websitePtttError || "";
    const tip = err
      ? `Chưa có gợi ý Admin (${err.slice(0, 120)})`
      : state.websitePtttAdminCount
        ? "Chưa có đơn Admin gần đây cho website này"
        : "Chưa lấy được PTTT từ API Đơn Admin";
    return `<span class="text-muted small" title="${escapeHtml(tip)}">—</span>`;
  }
  const meta = order.ptttSuggestMeta || {};
  const tipParts = [];
  if (meta.boughtDate) tipParts.push(`Ngày mua: ${meta.boughtDate}`);
  if (meta.orderNumber) tipParts.push(`Order#: ${meta.orderNumber}`);
  tipParts.push(
    meta.source === "admin" ? "PTTT đơn Admin gần nhất cùng website" : "Gợi ý từ lần gửi Nobita"
  );
  return `
    <span class="text-info" style="font-size:12px" title="${escapeHtml(tipParts.join(" · "))}">${escapeHtml(name)}</span>
    ${meta.boughtDate ? `<div class="text-muted" style="font-size:10px;line-height:1.2">${escapeHtml(meta.boughtDate)}</div>` : ""}`;
}

function hasSelect2() {
  return typeof $.fn.select2 === "function";
}

function initUserPicSelect2() {
  if (!hasSelect2()) return;
  $("select.user-pic").each(function () {
    const $select = $(this);
    if ($select.data("select2")) $select.select2("destroy");
    const $parent = $select.closest(".orders-table-wrap").length
      ? $select.closest(".orders-table-wrap")
      : $select.closest("td");
    $select.select2({
      width: "130px",
      theme: "bootstrap4",
      placeholder: "Lựa chọn",
      minimumResultsForSearch: 0,
      dropdownParent: $parent.length ? $parent : $(document.body),
    });
  });
}

function isBuyPoolStatus(status) {
  return status === "can_mua_order" || status === "can_mua_co";
}

function normalizeHandler(name) {
  const s = String(name || "").trim();
  return !s || s === "Lựa chọn" ? "" : s;
}

/** Cần xử lý: đơn tab need_handle từ Basso, hoặc (mock) PIC = user hiện tại */
function isAssignedToCurrentUser(order) {
  if (order.status === "can_xu_ly") return true;
  return isBuyPoolStatus(order.status) && normalizeHandler(order.handler) === state.currentUser;
}

function updateMeta() {
  const overdue = buildReportRows();
  const c = {
    can_xu_ly: 0,
    can_mua_order: 0,
    can_mua_co: 0,
    gui_don: state.buyList.length,
    dang_mua: state.buyList.length,
    bao_cao: overdue.reduce((s, r) => s + r.orderCount, 0),
  };
  state.orders.forEach((o) => {
    if (o.status === "can_mua_order") c.can_mua_order++;
    else if (o.status === "can_mua_co") c.can_mua_co++;
    else if (o.status === "can_xu_ly") c.can_xu_ly++;
  });
  // Mock: đếm thêm đơn Order/CO đã gán PIC = mình
  if (state.source !== "partner") {
    c.can_xu_ly = state.orders.filter((o) => isAssignedToCurrentUser(o)).length;
  }
  Object.keys(c).forEach((k) => $(`[data-count="${k}"]`).text(c[k]));

  // Total pending theo tab đang mở — ưu tiên số từ Partner API
  let pending = 0;
  const apiPending = state.pendingByTab && state.pendingByTab[state.status];
  if (
    state.source === "partner" &&
    (state.status === "can_xu_ly" || state.status === "can_mua_order" || state.status === "can_mua_co") &&
    apiPending != null &&
    !Number.isNaN(Number(apiPending))
  ) {
    pending = Number(apiPending);
  } else if (state.status === "can_xu_ly") {
    pending = state.orders
      .filter((o) => (state.source === "partner" ? o.status === "can_xu_ly" : isAssignedToCurrentUser(o)))
      .reduce((s, o) => s + Number(o.total || 0), 0);
  } else if (state.status === "can_mua_order" || state.status === "can_mua_co") {
    pending = state.orders
      .filter((o) => o.status === state.status)
      .reduce((s, o) => s + Number(o.total || 0), 0);
  } else if (state.status === "dang_mua" || state.status === "gui_don") {
    pending = state.buyList.reduce(
      (s, it) => s + Number(it.price || 0) * Number(it.qty || 1),
      0
    );
  } else if (state.status === "bao_cao") {
    pending = overdue.reduce((s, r) => s + Number(r.amount || 0), 0);
  }
  $("#totalPending").text(money(pending));
  $("#currentUserLabel").text(state.currentUser || "—");
}

function fillSites() {
  // Ưu tiên list websites từ Partner (adidas.com / calvinklein.us) — giống dropdown Basso
  let sites = Array.isArray(state.websites) ? state.websites.filter(Boolean) : [];
  if (!sites.length) {
    sites = [...new Set(state.orders.map((o) => o.website).filter(Boolean))].sort();
  } else {
    sites = [...sites].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  }
  const $sel = $("#siteFilter");
  const cur = $sel.val() || state.site || "";
  if (hasSelect2() && $sel.data("select2")) $sel.select2("destroy");
  $sel.html('<option value="">Tất cả site</option>');
  sites.forEach((s) => $sel.append(`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`));
  if (cur && sites.includes(cur)) $sel.val(cur);
  else $sel.val("");
  initSiteFilterSelect2();
}

/** Khớp filter site đầy đủ (macys.com) với website hiển thị trên đơn (macys) */
function websiteMatchesFilter(orderWebsite, filterSite) {
  const f = String(filterSite || "").trim().toLowerCase();
  if (!f || f === "all") return true;
  const o = String(orderWebsite || "").trim().toLowerCase();
  if (!o) return false;
  if (o === f) return true;
  const stripTld = (s) => s.replace(/\.(com|net|org|co\.uk|co|us|uk|vn)$/i, "");
  const fBase = stripTld(f);
  const oBase = stripTld(o);
  return o === fBase || oBase === fBase || f.startsWith(o + ".") || f.startsWith(oBase + ".");
}

function initSiteFilterSelect2() {
  const $sel = $("#siteFilter");
  if (!$sel.length || !hasSelect2()) return;
  if ($sel.data("select2")) $sel.select2("destroy");
  $sel.select2({
    theme: "bootstrap4",
    width: "200px",
    minimumResultsForSearch: 0,
  });
}

function filteredOrders() {
  const q = state.query.trim().toLowerCase();
  return state.orders.filter((o) => {
    if (o.status === "dang_mua") return false;

    if (state.status === "can_xu_ly") {
      if (state.source === "partner") {
        if (o.status !== "can_xu_ly") return false;
      } else if (!isAssignedToCurrentUser(o)) {
        return false;
      }
    } else if (o.status !== state.status) {
      return false;
    }

    if (state.site && !websiteMatchesFilter(o.website, state.site)) return false;
    if (!q) return true;
    return [o.id, o.phone, o.customerName, o.website, o.note, o.handler, o.staff, ...(o.items || []).map((i) => i.name + i.url)]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

function itemRows(order) {
  return (order.items || [])
    .map((item, i) => {
      const total = Number(item.price || 0) * Number(item.qty || 1);
      const img = item.image || "/assets/img/dummy.png";
      return `
      <tr>
        <td>${i + 1}</td>
        <td width="80"><img src="${escapeHtml(img)}" class="img-fluid" loading="lazy" style="max-height:80px" /></td>
        <td><a href="${escapeHtml(item.url || "#")}" target="_blank">${escapeHtml(item.name)}</a></td>
        <td class="text-left"><b>Size</b>: ${escapeHtml(item.size || "—")}<br /><b>Màu</b>: ${escapeHtml(item.color || "—")}</td>
        <td>${item.qty || 1}</td>
        <td>$ ${money(item.price)}</td>
        <td>$ ${money(total)}</td>
        <td>${escapeHtml(item.orderNo || "")}</td>
        <td>${escapeHtml(item.tracking || "")}</td>
        <td>${escapeHtml(item.note || "")}</td>
        <td width="50">
          <div class="d-flex flex-column justify-content-center align-items-center" style="height:100%;">
            <div class="w-100 text-center" style="border-bottom: 1px solid #dde6e9;">
              <a href="javascript:" class="text-info font-weight-bold d-inline-block w-100 py-1 js-add-item" data-item-id="${escapeHtml(item.id)}">Thêm</a>
            </div>
            <div class="w-100 text-center" style="border-top: 1px solid #dde6e9;">
              <div class="d-flex align-items-center justify-content-center" style="gap:8px;padding:6px 0">
                <input type="checkbox" />
                <a href="javascript:" class="font-weight-bold text-muted js-cancel-item">Cancel</a>
              </div>
            </div>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function calcBuyTotals() {
  const goods = state.buyList.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
  const ship = Number($("#oi_ship").val() || 0);
  const sub = goods + ship;
  $("#oi_total").val(money(goods));
  $("#oi_subtotal").val(money(sub));
  $("#btnCreateOrder").prop("disabled", state.buyList.length === 0);

  const shipDm = Number($("#dm_ship").val() || 0);
  const discDm = Number($("#dm_discount").val() || 0);
  const subDm = goods - discDm + shipDm;
  $("#dm_total").val(money(goods));
  $("#dm_subtotal").val(money(subDm));
  $("#btnCreateAdminOrder").prop("disabled", state.buyList.length === 0);
}

function buyListRowHtml(item, i, { admin } = {}) {
  const line = Number(item.price || 0) * Number(item.qty || 1);
  const img = item.image || "/assets/img/dummy.png";
  const cur = escapeHtml(item.currencySymbol || "$");
  const extraCols = admin
    ? ""
    : `<td>${escapeHtml(item.orderNo || "")}</td>
        <td>${escapeHtml(item.tracking || "")}</td>`;
  return `
      <tr data-buy-id="${escapeHtml(item.buyId)}">
        <td>${i + 1}</td>
        <td><a href="javascript:" class="order-expand">${escapeHtml(item.orderCode || item.orderId)}</a></td>
        <td width="80"><img src="${escapeHtml(img)}" class="img-fluid" style="max-height:80px" loading="lazy" /></td>
        <td class="text-left"><a href="${escapeHtml(item.url || "#")}" target="_blank">${escapeHtml(item.name)}</a></td>
        <td class="text-left"><b>Size</b>: ${escapeHtml(item.size || "—")}<br /><b>Màu</b>: ${escapeHtml(item.color || "—")}</td>
        <td>${item.qty || 1}</td>
        <td>
          <div class="input-group">
            <div class="input-group-prepend"><span class="input-group-text text-sm">${cur}</span></div>
            <input type="text" class="form-control input-sm text-center js-buy-price" value="${escapeHtml(item.price)}" style="width:30px" />
          </div>
        </td>
        <td>${cur} ${money(line)}</td>
        ${extraCols}
        <td>${escapeHtml(item.note || "")}</td>
        <td class="text-center">
          <a class="btn btn-link text-danger font-weight-bold js-buy-delete" href="javascript:">
            <i class="icon-trash"></i> Xóa
          </a>
        </td>
      </tr>`;
}

function renderBuyList() {
  const $body = $("#buyBody").empty();
  const $bodyAdmin = $("#buyBodyAdmin").empty();
  $("#buyEmpty").prop("hidden", state.buyList.length > 0);
  $("#buyEmptyAdmin").prop("hidden", state.buyList.length > 0);

  state.buyList.forEach((item, i) => {
    $body.append(buyListRowHtml(item, i, { admin: false }));
    $bodyAdmin.append(buyListRowHtml(item, i, { admin: true }));
  });

  calcBuyTotals();
}

function orderSheetStatusHtml(order) {
  const items = order.items || [];
  const n = items.length;
  if (!n) return '<span class="text-muted">—</span>';
  const withOrder = items.filter((i) => String(i.orderNo || "").trim()).length;
  const withTrack = items.filter((i) => String(i.tracking || "").trim()).length;
  const orderCls = withOrder === 0 ? "is-empty" : withOrder === n ? "is-full" : "is-partial";
  const trackCls = withTrack === 0 ? "is-empty" : withTrack === n ? "is-full" : "is-partial";
  return `
    <div class="sheet-status">
      <span class="sheet-status-pill ${orderCls}" title="Số SP đã có Order #">Order# ${withOrder}/${n}</span>
      <span class="sheet-status-pill ${trackCls}" title="Số SP đã có Tracking">Track ${withTrack}/${n}</span>
    </div>`;
}

function renderOrders() {
  const all = filteredOrders();
  const pageSize = Number(state.pageSize) || 20;
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;
  const start = (state.page - 1) * pageSize;
  const list = all.slice(start, start + pageSize);

  const $body = $("#ordersBody").empty();
  $("#emptyState").prop("hidden", all.length > 0);
  renderOrdersPager(all.length, totalPages, start, list.length);

  list.forEach((order, idx) => {
    const stt = start + idx + 1;
    $body.append(`
      <tr data-id="${escapeHtml(order.id)}">
        <th><a href="javascript:" class="toggle-hit" onclick="toggle_row(this)">${stt}</a></th>
        <th><a href="javascript:" class="order-expand" onclick="toggle_row(this)">${escapeHtml(order.id)}</a></th>
        <td>
          <a href="javascript:" class="toggle-hit" onclick="toggle_row(this)"><span>${escapeHtml(order.customerName)}</span></a>
          <div style="font-size:13px">${escapeHtml(order.customerType || "—")}</div>
        </td>
        <td><a href="javascript:" class="toggle-hit" onclick="toggle_row(this)">$ ${money(order.total)}</a></td>
        <td>
          <a href="javascript:" class="toggle-hit" onclick="toggle_row(this)">${escapeHtml(order.website)}</a>
          <p class="mb-0">${escapeHtml(formatRate(order.rate) || "")}</p>
        </td>
        <td class="sheet-status-cell">${orderSheetStatusHtml(order)}</td>
        <td>
          <a href="javascript:" class="toggle-hit" onclick="toggle_row(this)">${escapeHtml(order.saleEnds || "—")}</a>
          ${order.isUrgentBuy ? `<div class="text-primary mb-0" style="font-size:13px">Mua gấp</div>` : ""}
        </td>
        <td><a href="javascript:" class="toggle-hit" onclick="toggle_row(this)">${escapeHtml(order.staff || "Website")}</a></td>
        <td>
          <div class="input-group">
            <textarea class="form-control input-sm admin_note no-resize-fit overflow-hidden" data-note>${escapeHtml(order.note || "")}</textarea>
            <button class="btn border-0 rounded-0 btn-light btn-sm p-1 js-save-note" type="button" style="color:#545454"><span class="fa fa-save"></span></button>
          </div>
        </td>
        <td width="90" class="text-center action-cell d-flex flex-column align-items-stretch">
          <a href="javascript:" class="text-info font-weight-bold js-add-all action-link">Thêm tất cả</a>
          <a href="javascript:" class="font-weight-bold js-cancel-order action-link action-link-cancel">Cancel</a>
        </td>
        <td class="pttt-suggest-cell text-center align-middle">${ptttSuggestHtml(order)}</td>
        <td width="150" class="pic-cell">
          <div><select class="form-control user-pic">${picOptionsHtml(order.handler)}</select></div>
        </td>
      </tr>
      <tr class="tr-collapse">
        <td colspan="12" class="pl-0 pr-0">
          <div class="item-detail">
            <table class="table table-striped">
              <thead>
                <tr>
                  <th width="100">STT</th>
                  <th colspan="2">Sản phẩm</th>
                  <th>Variant</th>
                  <th>SL</th>
                  <th>Giá mua</th>
                  <th>Tổng giá mua</th>
                  <th>Order #</th>
                  <th>Tracking</th>
                  <th>Ghi chú</th>
                  <th width="150"></th>
                </tr>
              </thead>
              <tbody class="text-center">${itemRows(order) || '<tr><td colspan="11">Không có sản phẩm</td></tr>'}</tbody>
            </table>
          </div>
        </td>
      </tr>
    `);
  });
  initUserPicSelect2();
}

function renderOrdersPager(total, totalPages, start, shown) {
  const $pager = $("#ordersPager");
  if (!$pager.length) return;
  if (!total) {
    $pager.prop("hidden", true).empty();
    return;
  }
  $pager.prop("hidden", false);
  const page = state.page;
  // Giống Basso Đơn Admin / Tạo đơn mua hàng: Trước-Sau + ô nhập trang
  $pager.html(`
    <div class="row mt-3 basso-pager align-items-center">
      <div class="col-12 col-sm-6">
        <ul class="pagination mb-2 mb-sm-0">
          ${
            page > 1
              ? `<li class="page-item">
            <a href="javascript:" class="page-link js-page-prev">
              <i class="icon-arrow-left"></i>
              Trước
            </a>
          </li>`
              : ""
          }
          ${
            page < totalPages
              ? `<li class="page-item">
            <a href="javascript:" class="page-link js-page-next">
              Sau
              <i class="icon-arrow-right"></i>
            </a>
          </li>`
              : ""
          }
        </ul>
      </div>
      <div class="col-12 col-sm-6 text-sm-right basso-pager-meta">
        Trang số
        <input type="number" class="text-center js-page-input" style="width: 60px"
          value="${page}" min="1" max="${totalPages}" />
        trên <span>${totalPages}</span> trang. Tổng <span>${total}</span>
      </div>
    </div>
  `);
}

function goToOrdersPage(page) {
  const all = filteredOrders();
  const pageSize = Number(state.pageSize) || 20;
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  let p = Number(page) || 1;
  if (p < 1) p = 1;
  if (p > totalPages) p = totalPages;
  if (p === state.page) {
    // đồng bộ lại ô input nếu user gõ sai
    $("#ordersPager .js-page-input").val(state.page);
    return;
  }
  state.page = p;
  renderOrders();
  const top = document.getElementById("pane-orders");
  if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openDrawer() {
  $("#sideDrawer").addClass("is-open").attr("aria-hidden", "false");
  $("#sideBackdrop").prop("hidden", false);
  requestAnimationFrame(() => $("#sideBackdrop").addClass("is-open"));
  $("body").addClass("drawer-open");
}

function closeDrawer() {
  $("#sideDrawer").removeClass("is-open").attr("aria-hidden", "true");
  $("#sideBackdrop").removeClass("is-open");
  setTimeout(() => $("#sideBackdrop").prop("hidden", true), 200);
  $("body").removeClass("drawer-open");
}

function setSection(section) {
  state.section = section === "settings" ? "settings" : "orders";
  $(".side-nav-link").removeClass("is-active");
  $(`.side-nav-link[data-section="${state.section}"]`).addClass("is-active");
  closeDrawer();
  render();
}

function showPane() {
  const inSettings = state.section === "settings";
  $("#view-orders").prop("hidden", inSettings);
  $("#view-settings").prop("hidden", !inSettings);

  if (inSettings) {
    renderSettings();
    loadCredentialsInfo();
    return;
  }

  const buying = state.status === "dang_mua";
  const sending = state.status === "gui_don";
  const report = state.status === "bao_cao";
  $("#pane-orders").prop("hidden", buying || sending || report).toggleClass("active", !buying && !sending && !report);
  $("#pane-send").prop("hidden", !sending).toggleClass("active", sending);
  $("#pane-buying").prop("hidden", !buying).toggleClass("active", buying);
  $("#pane-report").prop("hidden", !report).toggleClass("active", report);
  if (buying || sending || report) {
    $("#ordersPager").prop("hidden", true);
  }
  if (buying || sending) {
    fillOrderFormSelects();
    fillAdminFormSelects();
    renderBuyList();
  } else if (report) {
    renderReport();
  } else {
    renderOrders();
  }
}

/** Ngày tạo đơn: ưu tiên mã ĐH (…DDMMYY…), rồi createdAt / saleEnds */
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

  // Mã ĐH Basso/Nobita: chữ + DDMMYY + đuôi (vd SU090926105 → 09/09/2026)
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

function formatReportHeaderDate(d) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function isUnpurchasedOrder(order) {
  if (!isBuyPoolStatus(order.status)) return false;
  const items = order.items || [];
  if (!items.length) return true;
  // Chưa mua = chưa có Order # trên mọi SP
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

function buildReportRows() {
  const groups = new Map();
  state.orders.forEach((order) => {
    if (!isUnpurchasedOrder(order) || !isOverdueOrder(order)) return;
    const website = String(order.website || "—").trim() || "—";
    const created = parseOrderCreatedDate(order);
    if (!groups.has(website)) {
      groups.set(website, {
        website,
        orderCount: 0,
        amount: 0,
        dates: [],
        handlers: new Set(),
        notes: [],
      });
    }
    const g = groups.get(website);
    g.orderCount += 1;
    g.amount += Number(order.total || 0);
    if (created) g.dates.push(created);
    // Người xử lý = PIC (handler), không phải nhân viên tạo/duyệt (staff)
    if (order.handler && String(order.handler).trim() && order.handler !== "Lựa chọn") {
      g.handlers.add(String(order.handler).trim());
    }
    if (order.note && String(order.note).trim()) g.notes.push(String(order.note).trim());
  });

  return [...groups.values()]
    .map((g) => {
      g.dates.sort((a, b) => a - b);
      // Hiện tất cả ngày tạo (unique), vd "9/9, 10/9" — không chỉ ngày cũ nhất
      const dateLabels = [];
      const seen = new Set();
      for (const d of g.dates) {
        const label = formatDayMonth(d);
        if (seen.has(label)) continue;
        seen.add(label);
        dateLabels.push(label);
      }
      const saved = state.reportReasons[g.website];
      const reason =
        saved != null && String(saved).trim() !== ""
          ? String(saved)
          : g.notes.filter((v, i, a) => a.indexOf(v) === i).join(" / ");
      return {
        website: g.website,
        orderCount: g.orderCount,
        amount: g.amount,
        dateLabel: dateLabels.join(", ") || "—",
        staff: [...g.handlers].filter(Boolean).join(", ") || "—",
        reason,
      };
    })
    .sort((a, b) => a.website.localeCompare(b.website));
}

function renderReport() {
  const rows = buildReportRows();
  const now = new Date();
  $("#reportDateHead").text(formatReportHeaderDate(now));
  const $body = $("#reportBody").empty();
  $("#reportEmpty").prop("hidden", rows.length > 0);

  rows.forEach((row, i) => {
    $body.append(`
      <tr data-website="${escapeHtml(row.website)}">
        <td class="text-center">${i + 1}</td>
        <td>${escapeHtml(row.website)}</td>
        <td class="text-center">${row.orderCount}</td>
        <td>$ ${money(row.amount)}</td>
        <td class="text-center">${escapeHtml(row.dateLabel)}</td>
        <td class="text-center">${escapeHtml(row.staff)}</td>
        <td>
          <div class="input-group input-group-sm">
            <textarea class="form-control form-control-sm js-report-reason" rows="2">${escapeHtml(row.reason)}</textarea>
            <div class="input-group-append">
              <button type="button" class="btn btn-light border js-save-reason" title="Lưu lý do"><i class="fa fa-save"></i></button>
            </div>
          </div>
        </td>
      </tr>`);
  });
}

/** Vẽ bảng báo cáo → PNG (Canvas) — không cần Playwright trên server. */
function wrapCanvasText(ctx, text, maxWidth) {
  const raw = String(text || "").replace(/\r/g, "");
  const paragraphs = raw.split("\n");
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width <= maxWidth) line = test;
      else {
        lines.push(line);
        line = words[i];
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

function buildReportPngBase64(rows, headerDate) {
  const scale = 2;
  const cols = [
    { key: "stt", title: "STT", w: 48, align: "center" },
    { key: "website", title: "Website", w: 120, align: "left" },
    { key: "orderCount", title: "Số đơn mua chậm", w: 110, align: "center" },
    { key: "amount", title: "Số tiền", w: 100, align: "left" },
    { key: "dateLabel", title: "Ngày tạo đơn", w: 130, align: "center" },
    { key: "staff", title: "Người xử lý", w: 110, align: "center" },
    { key: "reason", title: "Lý do", w: 360, align: "left" },
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const pad = 16;
  const captionH = 28;
  const dateRowH = 36;
  const headRowH = 40;
  const lineH = 16;
  const cellPadY = 8;
  const cellPadX = 8;

  const canvasProbe = document.createElement("canvas");
  const probe = canvasProbe.getContext("2d");
  probe.font = "13px Arial, Helvetica, sans-serif";

  const rowHeights = (rows || []).map((row) => {
    const reasonLines = wrapCanvasText(probe, row.reason || "", cols[6].w - cellPadX * 2);
    return Math.max(36, reasonLines.length * lineH + cellPadY * 2);
  });
  const bodyH = rowHeights.reduce((s, h) => s + h, 0) || 48;
  const totalH = pad + captionH + dateRowH + headRowH + bodyH + pad;
  const totalW = pad * 2 + tableW;

  const canvas = document.createElement("canvas");
  canvas.width = totalW * scale;
  canvas.height = totalH * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, totalW, totalH);

  ctx.fillStyle = "#444444";
  ctx.font = "13px Arial, Helvetica, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(
    "Tổng hợp đơn ở trạng thái chờ mua / cần xử lý, quá 3 ngày chưa có Order #, gom theo website.",
    pad,
    pad
  );

  const tableX = pad;
  const tableY = pad + captionH;

  function drawCell(x, y, w, h, text, opts = {}) {
    ctx.strokeStyle = "#222222";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    }
    ctx.fillStyle = "#111111";
    ctx.font = opts.bold ? "bold 13px Arial, Helvetica, sans-serif" : "13px Arial, Helvetica, sans-serif";
    const lines = opts.multiline
      ? wrapCanvasText(ctx, text, w - cellPadX * 2)
      : [String(text ?? "")];
    const textBlockH = lines.length * lineH;
    let ty = y + (opts.multiline ? cellPadY : (h - textBlockH) / 2);
    for (const line of lines) {
      let tx = x + cellPadX;
      if (opts.align === "center") {
        tx = x + (w - ctx.measureText(line).width) / 2;
      }
      ctx.fillText(line, tx, ty);
      ty += lineH;
    }
  }

  // Date header
  drawCell(tableX, tableY, tableW, dateRowH, headerDate, {
    bg: "#ffe600",
    bold: true,
    align: "center",
  });

  // Column headers
  let x = tableX;
  const headY = tableY + dateRowH;
  for (const col of cols) {
    drawCell(x, headY, col.w, headRowH, col.title, {
      bg: "#ffe600",
      bold: true,
      align: "center",
    });
    x += col.w;
  }

  let y = headY + headRowH;
  if (!(rows || []).length) {
    drawCell(tableX, y, tableW, 48, "Không có website nào quá 3 ngày chưa mua.", {
      align: "center",
    });
  } else {
    rows.forEach((row, i) => {
      const h = rowHeights[i];
      const values = [
        String(i + 1),
        row.website,
        String(row.orderCount),
        `$ ${money(row.amount)}`,
        row.dateLabel,
        row.staff,
        row.reason || "",
      ];
      x = tableX;
      cols.forEach((col, ci) => {
        drawCell(x, y, col.w, h, values[ci], {
          align: col.align,
          multiline: col.key === "reason",
        });
        x += col.w;
      });
      y += h;
    });
  }

  return canvas.toDataURL("image/png");
}

function websiteKeyClient(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/\s+/g, "")
    .replace(/\.(com|net|org|co|us|uk|vn)$/i, "");
}

function lookupWebsitePtttClient(website) {
  const map = state.websitePttt || {};
  const key = websiteKeyClient(website);
  if (key && map[key]) return map[key];
  if (!key) return null;
  for (const [k, row] of Object.entries(map)) {
    if (!k || !row) continue;
    if (key.startsWith(k + ".") || k.startsWith(key + ".")) return row;
    if (key.includes(k) || k.includes(key)) return row;
  }
  return null;
}

function fillOrderFormSelects() {
  const payCur = $("#oi_payment").val();
  const whCur = $("#oi_warehouse").val();
  const $pay = $("#oi_payment").empty().append('<option value="">- Lựa chọn -</option>');
  (state.settings.pttt || []).forEach((p) => {
    $pay.append(
      `<option value="${escapeHtml(p.id)}" title="${escapeHtml(p.sheetUrl || "")}">${escapeHtml(p.name)}</option>`
    );
  });
  // Ưu tiên: đang chọn → PTTT từ SP trong giỏ → gợi ý website
  const fromCart = (state.buyList || []).map((b) => b.ptttId).find(Boolean);
  const fromSite = (() => {
    const site = (state.buyList || []).map((b) => b.website).find(Boolean);
    if (!site) return "";
    const sug = lookupWebsitePtttClient(site);
    return sug ? sug.ptttId : "";
  })();
  const prefer = payCur || fromCart || fromSite || "";
  if (prefer) $pay.val(prefer);

  const $wh = $("#oi_warehouse").empty().append('<option value="">- Lựa chọn -</option>');
  (state.settings.warehouses || []).forEach((w) => {
    $wh.append(
      `<option value="${escapeHtml(w.id)}" title="${escapeHtml(w.address || "")}">${escapeHtml(w.name)}</option>`
    );
  });
  if (whCur) $wh.val(whCur);
}

function fillAdminFormSelects() {
  const meta = state.createMeta || {};
  const countryCur = $("#dm_country").val();
  const payCur = $("#dm_payment").val();
  const whCur = $("#dm_warehouse").val();
  const cbCur = $("#dm_web_cashback").val();

  const $country = $("#dm_country").empty().append('<option value="">- Lựa chọn -</option>');
  (meta.countries || []).forEach((c) => {
    $country.append(
      `<option value="${escapeHtml(c.id)}" data-symbol="${escapeHtml(c.currency_symbol || "$")}">${escapeHtml(c.name)}</option>`
    );
  });
  if (countryCur) $country.val(countryCur);
  else if ((meta.countries || []).length) $country.val(String(meta.countries[0].id));

  const $pay = $("#dm_payment").empty().append('<option value="">- Lựa chọn -</option>');
  (meta.payments || []).forEach((p) => {
    $pay.append(
      `<option value="${escapeHtml(p.id)}" data-rate="${escapeHtml(p.currency_rate || 0)}">${escapeHtml(p.name)}</option>`
    );
  });
  // Gợi ý PTTT Admin theo website trong giỏ
  const fromSitePayment = (() => {
    const site = (state.buyList || []).map((b) => b.website).find(Boolean);
    if (!site) return "";
    const sug = lookupWebsitePtttClient(site);
    return sug && sug.paymentId ? String(sug.paymentId) : "";
  })();
  if (payCur) $pay.val(payCur);
  else if (fromSitePayment) $pay.val(fromSitePayment);

  const $wh = $("#dm_warehouse").empty().append('<option value="">- Lựa chọn -</option>');
  (meta.warehouses || []).forEach((w) => {
    $wh.append(`<option value="${escapeHtml(w.id)}">${escapeHtml(w.name)}</option>`);
  });
  if (whCur) $wh.val(whCur);

  const $cb = $("#dm_web_cashback").empty().append('<option value="">- Lựa chọn -</option>');
  (meta.web_cashbacks || []).forEach((w) => {
    $cb.append(`<option value="${escapeHtml(w.id)}">${escapeHtml(w.name)}</option>`);
  });
  if (cbCur) $cb.val(cbCur);

  if (state.currentUser) $("#dm_buyer").val(state.currentUser);
  updateAdminCurrencySymbol();
}

function updateAdminCurrencySymbol() {
  const sym =
    $("#dm_country option:selected").data("symbol") ||
    (state.buyList[0] && state.buyList[0].currencySymbol) ||
    "$";
  $(".dm-cur").text(sym);
}

function renderSettings() {
  const $pttt = $("#settingsPtttBody").empty();
  (state.settings.pttt || []).forEach((row, i) => {
    const cols = { ...state.defaultColumns, ...(row.columns || {}) };
    const open = state.openColMapIdx === i;
    const mapCells = state.fieldDefs
      .map(
        (f) => `
        <div class="colmap-item">
          <label>${escapeHtml(f.label)}</label>
          <input type="text" maxlength="3" class="form-control form-control-sm js-col-letter" data-field="${escapeHtml(f.key)}" value="${escapeHtml(cols[f.key] || "")}" placeholder="A" />
        </div>`
      )
      .join("");

    $pttt.append(`
      <tr data-idx="${i}" class="pttt-main">
        <td><input type="text" class="form-control form-control-sm js-pttt-name" value="${escapeHtml(row.name)}" placeholder="Tên PTTT" /></td>
        <td><input type="text" class="form-control form-control-sm js-pttt-url" value="${escapeHtml(row.sheetUrl || "")}" placeholder="https://docs.google.com/spreadsheets/d/..." /></td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-info btn-xs btn-colmap ${open ? "is-open" : ""}" data-idx="${i}">Map cột</button>
        </td>
        <td class="text-center"><button type="button" class="btn btn-link text-danger btn-sm p-0 js-pttt-del"><i class="icon-trash"></i></button></td>
      </tr>
      <tr class="pttt-colmap" data-idx="${i}" ${open ? "" : "hidden"}>
        <td colspan="4">
          <div class="colmap-panel">
            <div class="small text-muted mb-2">Nhập chữ cột Excel (A, B, C…). Để trống field nào không dùng. Mặc định A→I theo layout cũ.</div>
            <div class="colmap-grid">${mapCells}</div>
          </div>
        </td>
      </tr>
    `);
  });

  const $wh = $("#settingsWhBody").empty();
  (state.settings.warehouses || []).forEach((row, i) => {
    $wh.append(`
      <tr data-idx="${i}">
        <td class="align-top"><input type="text" class="form-control form-control-sm js-wh-name" value="${escapeHtml(row.name)}" placeholder="Kho Hanoi" /></td>
        <td><textarea class="form-control form-control-sm js-wh-address" rows="3" placeholder="Địa chỉ dòng 1&#10;Địa chỉ dòng 2&#10;...">${escapeHtml(row.address || "")}</textarea></td>
        <td class="text-center align-top"><button type="button" class="btn btn-link text-danger btn-sm p-0 js-wh-del"><i class="icon-trash"></i></button></td>
      </tr>
    `);
  });
}

function collectSettingsFromForm() {
  const pttt = [];
  $("#settingsPtttBody tr.pttt-main").each(function () {
    const idx = Number($(this).data("idx"));
    const name = $(this).find(".js-pttt-name").val().trim();
    const sheetUrl = $(this).find(".js-pttt-url").val().trim();
    if (!name && !sheetUrl) return;
    const prev = state.settings.pttt[idx] || {};
    const columns = { ...state.defaultColumns, ...(prev.columns || {}) };
    $(`#settingsPtttBody tr.pttt-colmap[data-idx="${idx}"] .js-col-letter`).each(function () {
      const key = $(this).data("field");
      const letter = String($(this).val() || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, "");
      if (key) columns[key] = letter || columns[key] || "";
    });
    pttt.push({
      id: prev.id || `pttt-${Date.now()}-${idx}`,
      name,
      sheetUrl,
      columns,
    });
  });

  const warehouses = [];
  $("#settingsWhBody tr").each(function (i) {
    const name = $(this).find(".js-wh-name").val().trim();
    const address = $(this).find(".js-wh-address").val().trim();
    if (!name && !address) return;
    const prev = state.settings.warehouses[i];
    warehouses.push({ id: (prev && prev.id) || `wh-${Date.now()}-${i}`, name, address });
  });

  return { pttt, warehouses };
}

function render() {
  updateMeta();
  showPane();
}

function switchTab(status) {
  if (state.section !== "orders") state.section = "orders";
  state.status = status;
  state.page = 1;
  $("#tabs .nav-link").removeClass("active");
  $(`#tabs .nav-link[data-status="${status}"]`).addClass("active");
  render();
}

async function loadSessionUser() {
  try {
    const res = await apiFetch("/api/me").then((r) => r.json());
    if (res && res.ok && res.user) {
      state.sessionUser = res.user;
      state.authSource = res.user.source || "session";
      if (res.user.name) state.currentUser = res.user.name;
      return res.user;
    }
    // Fallback: tên từ ai_chat_user (platform login)
    const chat = getChatUser();
    if (chat && (chat.name || chat.email)) {
      const name = chat.name || String(chat.email || "").split("@")[0];
      state.sessionUser = { email: chat.email || "", name, source: "ai_chat_user" };
      state.authSource = "ai_chat_user";
      state.currentUser = name;
      return state.sessionUser;
    }
    state.sessionUser = null;
    state.authSource = "";
    return null;
  } catch {
    state.sessionUser = null;
    return null;
  }
}

async function loadCredentialsInfo() {
  try {
    const res = await apiFetch("/api/basso/credentials").then((r) => r.json());
    $("#credEmail").text(res.configured ? res.client_email || "—" : "Chưa cấu hình");
    $("#credHint").text(res.configured ? "" : res.error || "");
  } catch (err) {
    $("#credEmail").text("Lỗi đọc credentials");
  }
}

async function loadAll(opts = {}) {
  const refresh = opts.refresh ? "?refresh=1" : "";
  const [meUser, ordersRes, buyRes, settingsRes, reasonsRes] = await Promise.all([
    loadSessionUser(),
    apiFetch(`/api/basso/orders${refresh}`).then((r) => r.json()),
    apiFetch("/api/basso/buy-list").then((r) => r.json()),
    apiFetch("/api/basso/settings").then((r) => r.json()),
    apiFetch("/api/basso/report-reasons").then((r) => r.json()).catch(() => ({ reasons: {} })),
  ]);
  state.orders = ordersRes.orders || [];
  state.buyList = buyRes.items || [];
  state.settings = settingsRes.settings || { pttt: [], warehouses: [] };
  state.reportReasons = (reasonsRes && reasonsRes.reasons) || {};
  state.source = ordersRes.source || "mock";
  state.pendingByTab = ordersRes.pendingByTab || {};
  state.websitePttt = ordersRes.websitePttt || {};
  state.websitePtttSource = ordersRes.websitePtttSource || "";
  state.websitePtttError = ordersRes.websitePtttError || "";
  state.websitePtttAdminCount = Number(ordersRes.websitePtttAdminCount || 0);
  state.createMeta = ordersRes.createMeta || state.createMeta || {};
  state.websites = Array.isArray(ordersRes.websites) ? ordersRes.websites : [];
  // Ưu tiên SSO session (Deki-style) → rồi buyer từ orders API
  if (meUser && meUser.name) {
    state.currentUser = meUser.name;
    state.sessionUser = meUser;
  } else if (ordersRes.sessionUser && ordersRes.sessionUser.name) {
    state.currentUser = ordersRes.sessionUser.name;
    state.sessionUser = ordersRes.sessionUser;
  } else if (ordersRes.buyer) {
    state.currentUser = ordersRes.buyer;
  }
  if (Array.isArray(ordersRes.pic) && ordersRes.pic.length) {
    state.picOptions = ["Lựa chọn", ...ordersRes.pic.map((p) => p.name).filter(Boolean)];
  }
  if (ordersRes.error) {
    toast("Partner API lỗi, đang dùng mock: " + ordersRes.error, { error: true });
  } else if (opts.refresh && state.source === "partner") {
    toast(`Đã tải lại từ Basso (${state.orders.length} đơn)`);
  }
  if (Array.isArray(settingsRes.fieldDefs) && settingsRes.fieldDefs.length) {
    state.fieldDefs = settingsRes.fieldDefs;
  }
  fillSites();
  fillOrderFormSelects();
  fillAdminFormSelects();
  loadCredentialsInfo();
  const todayStr = (() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  })();
  if (!$("#oi_created_time").val()) $("#oi_created_time").val(todayStr);
  if (!$("#dm_created_time").val()) $("#dm_created_time").val(todayStr);
  if (state.currentUser) {
    $("#oi_buyer").val(state.currentUser);
    $("#dm_buyer").val(state.currentUser);
  }
  initCreatedTimePicker();
  render();
}

function initCreatedTimePicker() {
  const bindPicker = ($el) => {
    if (!$el.length || $el.data("xdsoft_datetimepicker")) return;
    $.datetimepicker.setLocale("vi");
    $el.datetimepicker({
      format: "d-m-Y",
      formatDate: "d-m-Y",
      timepicker: false,
      datepicker: true,
      yearStart: 2000,
      yearEnd: new Date().getFullYear(),
      maxDate: 0,
      scrollMonth: false,
      scrollInput: false,
      dayOfWeekStart: 0,
      closeOnDateSelect: true,
      validateOnBlur: true,
    });
    $el.on("change blur", function () {
      const val = String($(this).val() || "").trim();
      const m = val.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (!m) return;
      const picked = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (picked > today) {
        const d = new Date();
        $(this).val(
          `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`
        );
        toast("Chỉ chọn hôm nay hoặc ngày trước", { error: true });
      }
    });
  };
  bindPicker($("#oi_created_time"));
  bindPicker($("#dm_created_time"));
}

$(function () {
  $("#btnMenu").on("click", function () {
    if ($("#sideDrawer").hasClass("is-open")) closeDrawer();
    else openDrawer();
  });

  $("#sideBackdrop").on("click", closeDrawer);

  $(document).on("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  $(".side-nav-link").on("click", function (e) {
    e.preventDefault();
    setSection($(this).data("section"));
  });

  $("#tabs").on("click", ".nav-link", function (e) {
    e.preventDefault();
    switchTab($(this).data("status"));
  });

  $("#btnSearch").on("click", function () {
    state.query = $("#searchInput").val();
    state.site = $("#siteFilter").val() || "";
    state.page = 1;
    render();
  });

  $("#siteFilter").on("change", function () {
    state.site = $(this).val() || "";
  });

  $("#ordersPager").on("click", ".js-page-prev", function (e) {
    e.preventDefault();
    if ($(this).closest(".page-item").hasClass("disabled")) return;
    goToOrdersPage(state.page - 1);
  });

  $("#ordersPager").on("click", ".js-page-next", function (e) {
    e.preventDefault();
    if ($(this).closest(".page-item").hasClass("disabled")) return;
    goToOrdersPage(state.page + 1);
  });

  $("#ordersPager").on("change", ".js-page-input", function () {
    let v = Number($(this).val());
    if (!v || v < 1) v = 1;
    goToOrdersPage(v);
  });

  $("#ordersPager").on("keypress", ".js-page-input", function (e) {
    if (e.key === "Enter" || e.keyCode === 13) {
      e.preventDefault();
      $(this).blur();
    }
  });

  $("#pane-report").on("click", ".js-save-reason", async function () {
    const $tr = $(this).closest("tr");
    const website = $tr.data("website");
    const reason = $tr.find(".js-report-reason").val() || "";
    try {
      const res = await apiFetch("/api/basso/report-reasons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website, reason }),
      });
      const data = await res.json();
      if (!data.ok) return toast(data.error || "Lưu lý do thất bại", { error: true });
      state.reportReasons = data.reasons || state.reportReasons;
      state.reportReasons[website] = reason;
      toast("Đã lưu lý do");
    } catch (err) {
      toast("Lỗi lưu lý do: " + (err.message || String(err)), { error: true });
    }
  });

  $("#btnSendReportTelegram").on("click", async function () {
    const $btn = $(this).prop("disabled", true);
    const reasons = {};
    $("#reportBody tr").each(function () {
      const website = $(this).data("website");
      if (!website) return;
      reasons[website] = $(this).find(".js-report-reason").val() || "";
    });
    Object.keys(reasons).forEach((w) => {
      state.reportReasons[w] = reasons[w];
    });
    try {
      toast("Đang tạo ảnh báo cáo…");
      const rows = buildReportRows();
      const headerDate = formatReportHeaderDate(new Date());
      const imageBase64 = buildReportPngBase64(rows, headerDate);
      const res = await apiFetch("/api/telegram/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          reasons,
          headerDate,
          websites: rows.length,
          orders: rows.reduce((s, r) => s + r.orderCount, 0),
        }),
      });
      const data = await res.json();
      if (!data.ok) return toast(data.error || "Gửi Telegram thất bại", { error: true });
      toast(`Đã gửi báo cáo ${data.headerDate} (${data.websites} website)`);
    } catch (err) {
      toast("Lỗi gửi Telegram: " + (err.message || String(err)), { error: true });
    } finally {
      $btn.prop("disabled", false);
    }
  });

  $("#btnSyncSheet").on("click", async function () {
    const $btn = $(this).prop("disabled", true);
    try {
      const res = await apiFetch("/api/basso/sync-from-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: $("#oi_created_time").val() || "",
        }),
      });
      const data = await res.json();
      if (!data.ok) return toast(data.error || "Đồng bộ thất bại", { error: true });

      let msg = data.message || "Đã đồng bộ";
      if (data.matches && data.matches.length) {
        const sample = data.matches
          .slice(0, 5)
          .map((m) => `${m.maDh} → ${m.orderNo || "—"} / ${m.tracking || "—"}`)
          .join("\n");
        msg += `\n${sample}`;
        if (data.matches.length > 5) msg += `\n… +${data.matches.length - 5} SP khác`;
      }
      toast(msg);
      await loadAll({ refresh: true });
    } catch (err) {
      toast("Lỗi đồng bộ: " + (err.message || String(err)), { error: true });
    } finally {
      $btn.prop("disabled", false);
    }
  });

  $("#searchInput").on("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      $("#btnSearch").click();
    }
  });

  $("#ordersBody").on("click", ".js-save-note", async function () {
    const $tr = $(this).closest("tr");
    const id = $tr.data("id");
    const note = $tr.find("[data-note]").val();
    await apiFetch(`/api/basso/orders/${encodeURIComponent(id)}/note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const o = state.orders.find((x) => x.id === id);
    if (o) o.note = note;
    toast("Đã lưu ghi chú " + id);
  });

  // Cột PIC bên phải = Người xử lý (handler) — không đụng Nhân viên (staff)
  $("#ordersBody").on("change", "select.user-pic", async function () {
    const $tr = $(this).closest("tr[data-id]");
    const id = $tr.data("id");
    let handler = String($(this).val() || "").trim();
    if (handler === "Lựa chọn") handler = "";
    try {
      const res = await apiFetch(`/api/basso/orders/${encodeURIComponent(id)}/handler`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handler }),
      });
      const data = await res.json();
      if (!data.ok) return toast(data.error || "Lưu người xử lý thất bại", { error: true });
      const o = state.orders.find((x) => x.id === id);
      if (o) {
        o.handler = handler;
        updateMeta();
        // Đang ở Cần xử lý mà đổi PIC khỏi mình → biến mất khỏi list
        if (state.status === "can_xu_ly" && handler !== state.currentUser) {
          renderOrders();
        }
      }
    } catch (err) {
      toast("Lỗi lưu người xử lý: " + (err.message || String(err)), { error: true });
    }
  });

  $("#ordersBody").on("click", ".js-add-all", async function (e) {
    e.preventDefault();
    const id = $(this).closest("tr").data("id");
    const res = await apiFetch(`/api/basso/buy-list/add-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id }),
    });
    const data = await res.json();
    if (!data.ok) return toast(data.error || "Thêm thất bại");
    state.buyList = data.items || [];
    toast(data.message || "Đã thêm sản phẩm");
    switchTab("dang_mua");
  });

  $("#ordersBody").on("click", ".js-add-item", async function (e) {
    e.preventDefault();
    const orderId = $(this).closest("tr.tr-collapse").prev("tr").data("id");
    const itemId = $(this).data("item-id");
    const res = await apiFetch(`/api/basso/buy-list/add-item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, itemId }),
    });
    const data = await res.json();
    if (!data.ok) return toast(data.error || "Thêm SP thất bại");
    state.buyList = data.items || [];
    toast(data.message || "Đã thêm sản phẩm");
    switchTab("dang_mua");
  });

  $("#ordersBody").on("click", ".js-cancel-order", function (e) {
    e.preventDefault();
    toast("Cancel (mock)");
  });

  $("#ordersBody").on("click", ".js-cancel-item", function (e) {
    e.preventDefault();
    toast("Cancel item (mock)");
  });

  $("#buyBody, #buyBodyAdmin").on("click", ".js-buy-delete", async function (e) {
    e.preventDefault();
    const buyId = $(this).closest("tr").data("buy-id");
    const res = await apiFetch(`/api/basso/buy-list/${encodeURIComponent(buyId)}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) return toast(data.error || "Xóa thất bại");
    state.buyList = data.items || [];
    render();
  });

  $("#buyBody, #buyBodyAdmin").on("change", ".js-buy-price", async function () {
    const buyId = $(this).closest("tr").data("buy-id");
    const price = Number(String($(this).val()).replace(/,/g, "")) || 0;
    const res = await apiFetch(`/api/basso/buy-list/${encodeURIComponent(buyId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    });
    const data = await res.json();
    if (data.ok) {
      state.buyList = data.items || [];
      renderBuyList();
    }
  });

  $("#oi_ship").on("input change", calcBuyTotals);
  $("#dm_ship, #dm_discount").on("input change", calcBuyTotals);
  $("#dm_country").on("change", updateAdminCurrencySymbol);

  $("#btnCreateOrder").on("click", async function () {
    if (!state.buyList.length) return toast("Bạn chưa chọn sản phẩm");
    if (!$("#oi_warehouse").val() || !$("#oi_payment").val()) {
      return toast("Vui lòng điền đủ các trường *");
    }
    if (!$("#oi_created_time").val()) return toast("Vui lòng chọn Thời gian");
    if (!confirm("Xác nhận gửi đơn hàng vào Excel / Google Sheet theo PTTT đã chọn?")) return;

    const $btn = $(this);
    const oldHtml = $btn.html();
    $btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin"></i> Đang gửi…');
    toast("Đang gửi đơn lên Google Sheet…");
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ac ? setTimeout(() => ac.abort(), 60000) : null;
    try {
      const res = await apiFetch("/api/basso/buy-list/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac ? ac.signal : undefined,
        body: JSON.stringify({
          created_time: $("#oi_created_time").val(),
          date: $("#oi_created_time").val(),
          warehouse_id: $("#oi_warehouse").val(),
          note: $("#oi_note").val(),
          payment_id: $("#oi_payment").val(),
          buyer: $("#oi_buyer").val(),
          ship_fee: $("#oi_ship").val(),
          discount: 0,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        let msg = data.error || "Gửi đơn thất bại";
        if (data.ptttName) msg += `\nPTTT: ${data.ptttName}`;
        if (data.sheetUrl) msg += `\nSheet: ${data.sheetUrl}`;
        if (data.serviceAccount) msg += `\nShare sheet với: ${data.serviceAccount}`;
        return toast(msg, { error: true });
      }

      state.buyList = [];
      if (data.websitePttt) state.websitePttt = data.websitePttt;
      toast(data.message || "Đã gửi đơn");
      if (data.sheet && data.sheet.sheetUrl) {
        window.open(data.sheet.sheetUrl, "_blank");
      }
      $("#oi_note").val("");
      $("#oi_ship").val(0);
      await loadAll({ refresh: true });
      render();
    } catch (err) {
      const aborted = err && (err.name === "AbortError" || /aborted/i.test(String(err.message || "")));
      toast(
        aborted
          ? "Gửi đơn quá lâu (timeout 60s). Kiểm tra credentials / mạng / quyền Share sheet."
          : "Lỗi gửi đơn: " + (err.message || String(err)),
        { error: true }
      );
    } finally {
      if (timer) clearTimeout(timer);
      $btn.html(oldHtml).prop("disabled", state.buyList.length === 0);
    }
  });

  $("#btnCreateAdminOrder").on("click", async function () {
    if (!state.buyList.length) return toast("Bạn chưa chọn sản phẩm");
    if (!$("#dm_country").val() || !$("#dm_warehouse").val() || !$("#dm_payment").val()) {
      return toast("Vui lòng điền đủ các trường *");
    }
    if (!$("#dm_created_time").val()) return toast("Vui lòng chọn Thời gian order");
    if (!String($("#dm_order_number").val() || "").trim()) return toast("Vui lòng nhập Order number");
    if (!confirm("Xác nhận tạo đơn hàng Admin?\nCác sản phẩm sẽ được đánh dấu là đã mua.")) return;

    const $btn = $(this);
    const oldHtml = $btn.html();
    $btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin"></i> Đang tạo…');
    toast("Đang tạo đơn Admin trên Basso…");
    try {
      const buyRate = Number($("#dm_payment option:selected").data("rate") || 0);
      const res = await apiFetch("/api/basso/buy-list/create-admin-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          created_time: $("#dm_created_time").val(),
          country_id: $("#dm_country").val(),
          warehouse_id: $("#dm_warehouse").val(),
          order_number: $("#dm_order_number").val(),
          note: $("#dm_note").val(),
          payment_id: $("#dm_payment").val(),
          ship_fee: $("#dm_ship").val() || 0,
          discount: $("#dm_discount").val() || 0,
          buy_rate: buyRate,
          cashback_rate: $("#dm_cashback_rate").val() || 0,
          web_cashback_id: $("#dm_web_cashback").val() || "",
          create_billing: true,
          branch: "ha-noi",
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        return toast(data.error || "Tạo đơn Admin thất bại", { error: true });
      }
      state.buyList = [];
      toast(data.message || "Tạo đơn hàng thành công");
      $("#dm_note").val("");
      $("#dm_order_number").val("");
      $("#dm_ship").val(0);
      $("#dm_discount").val(0);
      $("#dm_cashback_rate").val(0);
      if (data.redirect_url) {
        window.open(data.redirect_url, "_blank");
      }
      await loadAll({ refresh: true });
      render();
    } catch (err) {
      toast("Lỗi tạo đơn Admin: " + (err.message || String(err)), { error: true });
    } finally {
      $btn.html(oldHtml).prop("disabled", state.buyList.length === 0);
    }
  });

  $("#btnAddPttt").on("click", function () {
    state.settings.pttt = collectSettingsFromForm().pttt;
    state.settings.pttt.push({
      id: `pttt-${Date.now()}`,
      name: "",
      sheetUrl: "",
      columns: { ...state.defaultColumns },
    });
    state.openColMapIdx = state.settings.pttt.length - 1;
    renderSettings();
  });

  $("#btnAddWarehouse").on("click", function () {
    state.settings.warehouses = collectSettingsFromForm().warehouses;
    state.settings.warehouses.push({ id: `wh-${Date.now()}`, name: "", address: "" });
    renderSettings();
  });

  $("#settingsPtttBody").on("click", ".btn-colmap", function () {
    const idx = Number($(this).data("idx"));
    state.settings.pttt = collectSettingsFromForm().pttt;
    state.openColMapIdx = state.openColMapIdx === idx ? null : idx;
    renderSettings();
  });

  $("#settingsPtttBody").on("click", ".js-pttt-del", function () {
    const idx = Number($(this).closest("tr").data("idx"));
    state.settings.pttt = collectSettingsFromForm().pttt;
    state.settings.pttt.splice(idx, 1);
    state.openColMapIdx = null;
    renderSettings();
  });

  $("#settingsPtttBody").on("input", ".js-col-letter", function () {
    this.value = String(this.value || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);
  });

  $("#settingsWhBody").on("click", ".js-wh-del", function () {
    const idx = Number($(this).closest("tr").data("idx"));
    state.settings.warehouses = collectSettingsFromForm().warehouses;
    state.settings.warehouses.splice(idx, 1);
    renderSettings();
  });

  $("#btnSaveSettings").on("click", async function () {
    const settings = collectSettingsFromForm();
    if (!settings.pttt.length) return toast("Cần ít nhất 1 PTTT");
    if (!settings.warehouses.length) return toast("Cần ít nhất 1 warehouse");
    const res = await apiFetch("/api/basso/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    const data = await res.json();
    if (!data.ok) return toast(data.error || "Lưu thất bại", { error: true });
    state.settings = data.settings;
    fillOrderFormSelects();
    $("#settingsSaveHint").text("Đã lưu " + new Date().toLocaleTimeString());
    toast("Đã lưu cài đặt");
    renderSettings();
  });

  $("#btnUploadCred").on("click", async function () {
    const file = document.getElementById("credFile").files[0];
    if (!file) return toast("Chọn file JSON service account trước", { error: true });
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await apiFetch("/api/basso/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json }),
      });
      const data = await res.json();
      if (!data.ok) return toast(data.error || "Upload thất bại", { error: true });
      $("#credEmail").text(data.client_email || "—");
      $("#credHint").text(data.message || "Đã lưu");
      toast("Đã cập nhật credentials");
    } catch (err) {
      toast("File JSON không đọc được: " + (err.message || String(err)), { error: true });
    }
  });

  $("#btnRefreshOrders").on("click", async function () {
    const $btn = $(this);
    $btn.prop("disabled", true);
    try {
      await loadAll({ refresh: true });
    } catch (err) {
      toast(err.message || String(err), { error: true });
    } finally {
      $btn.prop("disabled", false);
    }
  });

  $("#btnExport").on("click", function () {
    toast("Xuất Excel (mock)");
  });

  loadAll().catch((err) => {
    $("#emptyState").prop("hidden", false).text("Lỗi: " + err.message);
  });
});
