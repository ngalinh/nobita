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
    { key: "adminCheck", label: "Checkbox tạo Admin" },
    { key: "trackingCheck", label: "Checkbox Tracking" },
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
    adminCheck: "",
    trackingCheck: "",
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
  bassoSiteUrl: "https://basso.vn",
  adminModalOpen: false,
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

function bassoNoti(message, status) {
  const ok = status !== "danger";
  const prev = document.getElementById("nobita-hulla");
  if (prev) prev.remove();
  const el = document.createElement("div");
  el.id = "nobita-hulla";
  el.className = "hullabaloo alert alert-dismissible " + (ok ? "alert-success" : "alert-danger");
  el.setAttribute("role", "alert");
  el.style.cssText = "position:fixed;top:20px;right:20px;width:250px;z-index:9999;margin:0;padding:15px 35px 15px 15px;border:1px solid;border-radius:4px;display:none;font-size:14px;";
  if (ok) {
    el.style.color = "#fff";
    el.style.backgroundColor = "#27c24c";
    el.style.borderColor = "#27c24c";
  } else {
    el.style.color = "#fff";
    el.style.backgroundColor = "#f05050";
    el.style.borderColor = "#f05050";
  }
  el.innerHTML =
    '<button type="button" class="close" aria-label="Close" style="position:absolute;top:8px;right:10px;background:none;border:0;font-size:21px;line-height:1;color:#fff;opacity:.8;text-shadow:none"><span aria-hidden="true">&times;</span></button>' +
    '<i class="fa fa-' +
    (ok ? "check" : "times-circle") +
    '"></i> ' +
    escapeHtml(message);
  document.body.appendChild(el);
  if (window.jQuery) window.jQuery(el).fadeIn();
  else el.style.display = "block";
  el.querySelector(".close").onclick = () => {
    if (window.jQuery) window.jQuery(el).fadeOut(() => el.remove());
    else el.remove();
  };
  clearTimeout(bassoNoti._t);
  bassoNoti._t = setTimeout(() => {
    if (!el.isConnected) return;
    if (window.jQuery) window.jQuery(el).fadeOut(() => el.remove());
    else el.remove();
  }, 5000);
}

function toast(msg, opts) {
  if (opts && (opts.success || opts.basso)) {
    return bassoNoti(msg, opts && opts.error ? "danger" : "success");
  }
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

function localBuyItem(order, item, bag = "") {
  return {
    buyId: `local-${item.id}`,
    itemId: item.id,
    orderId: order.id,
    bassoOrderId: order.bassoId || order.id,
    orderCode: order.id,
    website: order.website || "",
    brand: order.brand || "",
    currencySymbol: order.currencySymbol || "$",
    ptttId: item.ptttId || order.ptttId || order.ptttSuggestId || "",
    checkerUrl: item.checkerUrl || "",
    name: item.name,
    url: item.url || "",
    image: item.image || "",
    size: item.size || "",
    color: item.color || "",
    qty: Number(item.qty || 1),
    price: Number(item.price || 0),
    note: item.note || "",
    orderNo: item.orderNo || "",
    tracking: item.tracking || "",
    itemKey: item.itemKey || "",
    bag: bag || "",
  };
}

/** Add bag từ Đã quét → chỉ Đang mua. Thêm từ Cần mua (bag trống) → cả hai tab. */
function isSendBagItem(item) {
  return String((item && item.bag) || "") !== "dang_mua";
}

function isAdminBagItem(item) {
  const bag = String((item && item.bag) || "");
  return bag === "dang_mua" || bag === "" || bag === "both";
}

function sendBagItems() {
  return (state.buyList || []).filter(isSendBagItem);
}

function adminBagItems() {
  return (state.buyList || []).filter(isAdminBagItem);
}

function refreshBagView() {
  updateMeta();
  if (state.status === "dang_mua" || state.status === "gui_don") renderBuyList();
}

/** Thêm ngay từ đơn đang hiện, lưu server phía sau — không chuyển tab. */
async function addOrderItemsToBag(order, onlyItemId) {
  if (!order) return toast("Không tìm thấy đơn", { error: true });
  const items = (order.items || []).filter((it) => {
    if (it.adminOrderChecked) return false;
    return !onlyItemId || String(it.id) === String(onlyItemId);
  });
  if (!items.length) {
    return toast(onlyItemId ? "Sản phẩm đã tạo đơn Admin, không thêm lại được" : "Không còn sản phẩm để thêm", {
      error: true,
    });
  }

  let added = 0;
  for (const item of items) {
    if (state.buyList.some((x) => String(x.itemId) === String(item.id))) continue;
    state.buyList.push(localBuyItem(order, item));
    added += 1;
  }
  refreshBagView();
  if (!added) return toast("Sản phẩm đã có trong danh sách", { error: true, basso: true });
  toast(onlyItemId ? "Đã thêm sản phẩm" : `Đã thêm ${added} sản phẩm`, { success: true });

  try {
    const res = await apiFetch(
      onlyItemId ? "/api/basso/buy-list/add-item" : "/api/basso/buy-list/add-all",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          onlyItemId ? { orderId: order.id, itemId: onlyItemId } : { orderId: order.id }
        ),
      }
    );
    const data = await res.json();
    if (Array.isArray(data.items)) state.buyList = data.items;
    refreshBagView();
    if (!data.ok) toast(data.error || "Không lưu được giỏ hàng", { error: true });
  } catch (err) {
    toast("Lỗi lưu giỏ hàng: " + (err.message || String(err)), { error: true });
  }
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
    return `<span class="text-muted" title="${escapeHtml(tip)}">—</span>`;
  }
  const meta = order.ptttSuggestMeta || {};
  const tipParts = [];
  if (meta.boughtDate) tipParts.push(`Ngày mua: ${meta.boughtDate}`);
  if (meta.orderNumber) tipParts.push(`Order#: ${meta.orderNumber}`);
  tipParts.push(
    meta.source === "admin" ? "PTTT đơn Admin gần nhất cùng website" : "Gợi ý từ lần gửi Nobita"
  );
  return `
    <span class="text-info" title="${escapeHtml(tipParts.join(" · "))}">${escapeHtml(name)}</span>
    ${meta.boughtDate ? `<div class="text-muted" style="font-size:12px;line-height:1.3">${escapeHtml(meta.boughtDate)}</div>` : ""}`;
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
    gui_don: sendBagItems().length,
    dang_mua: adminBagItems().length,
    bao_cao: overdue.reduce((s, r) => s + r.orderCount, 0),
    da_quet: scannedProductRows().length,
  };
  state.orders.forEach((o) => {
    if (!orderStillBuyable(o)) return;
    if (o.status === "can_mua_order" || o.status === "can_mua_co") c.can_mua_order++;
    else if (o.status === "can_xu_ly") c.can_xu_ly++;
  });
  // Mock: đếm thêm đơn Order/CO đã gán PIC = mình
  if (state.source !== "partner") {
    c.can_xu_ly = state.orders.filter((o) => orderStillBuyable(o) && isAssignedToCurrentUser(o)).length;
  }
  Object.keys(c).forEach((k) => $(`[data-count="${k}"]`).text(c[k]));

  // Total pending theo tab đang mở — ưu tiên số từ Partner API
  let pending = 0;
  const apiPending = state.pendingByTab && state.pendingByTab[state.status];
  if (
    state.source === "partner" &&
    (state.status === "can_xu_ly" || state.status === "can_mua_order") &&
    apiPending != null &&
    !Number.isNaN(Number(apiPending))
  ) {
    // Đơn cần mua = order + CO
    if (state.status === "can_mua_order") {
      const co = Number(state.pendingByTab.can_mua_co);
      pending = Number(apiPending) + (Number.isNaN(co) ? 0 : co);
    } else {
      pending = Number(apiPending);
    }
  } else if (state.status === "can_xu_ly") {
    pending = state.orders
      .filter((o) => (state.source === "partner" ? o.status === "can_xu_ly" : isAssignedToCurrentUser(o)))
      .reduce((s, o) => s + Number(o.total || 0), 0);
  } else if (state.status === "can_mua_order") {
    pending = state.orders
      .filter((o) => o.status === "can_mua_order" || o.status === "can_mua_co")
      .reduce((s, o) => s + Number(o.total || 0), 0);
  } else if (state.status === "dang_mua" || state.status === "gui_don") {
    const bag = state.status === "dang_mua" ? adminBagItems() : sendBagItems();
    pending = bag.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
  } else if (state.status === "da_quet") {
    pending = scannedProductRows().reduce(
      (s, row) => s + Number(row.item.price || 0) * Number(row.item.qty || 1),
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
    } else if (state.status === "can_mua_order") {
      if (o.status !== "can_mua_order" && o.status !== "can_mua_co") return false;
    } else if (o.status !== state.status) {
      return false;
    }

    if (!orderStillBuyable(o)) return false;
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
    .filter((item) => !item.adminOrderChecked)
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
  const sendItems = sendBagItems();
  const adminItems = adminBagItems();
  const goodsSend = sendItems.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
  const goodsAdmin = adminItems.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
  const ship = Number($("#oi_ship").val() || 0);
  const sub = goodsSend + ship;
  $("#oi_total").val(money(goodsSend));
  $("#oi_subtotal").val(money(sub));
  $("#btnCreateOrder").prop("disabled", sendItems.length === 0);

  const shipDm = Number($("#dm_ship").val() || 0);
  const discDm = Number($("#dm_discount").val() || 0);
  const subDm = goodsAdmin - discDm + shipDm;
  $("#dm_total").val(money(goodsAdmin));
  $("#dm_subtotal").val(money(subDm));
  $("#btnCreateAdminOrder").prop("disabled", adminItems.length === 0);

  const shipAb = Number($("#ab_ship").val() || 0);
  const discAb = Number($("#ab_discount").val() || 0);
  $("#ab_total").val(money(goodsAdmin));
  $("#ab_subtotal").val(money(goodsAdmin - discAb + shipAb));
  $("#btnModalCreateAdmin").prop("disabled", adminItems.length === 0);
}

const LAST_ADMIN_CREATE_KEY = "nobita_last_admin_create";
const LAST_SEND_KEY = "nobita_last_sheet_send";

function loadJsonLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function saveJsonLocal(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify(payload || {}));
  } catch {
    /* ignore */
  }
}

function loadLastAdminCreate() {
  return loadJsonLocal(LAST_ADMIN_CREATE_KEY);
}

function saveLastAdminCreate(payload) {
  saveJsonLocal(LAST_ADMIN_CREATE_KEY, payload);
}

function loadLastSheetSend() {
  return loadJsonLocal(LAST_SEND_KEY);
}

function saveLastSheetSend(payload) {
  saveJsonLocal(LAST_SEND_KEY, payload);
}

function normName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Khớp tên PTTT/warehouse giữa Excel local và list Admin Basso. */
function matchMetaByName(list, name) {
  const n = normName(name);
  if (!n || !Array.isArray(list)) return null;
  return (
    list.find((x) => normName(x.name) === n) ||
    list.find((x) => {
      const xn = normName(x.name);
      return xn && (xn.includes(n) || n.includes(xn));
    }) ||
    null
  );
}

function findLocalPttt(ptttIdOrName, checkerUrl) {
  const list = state.settings.pttt || [];
  const key = String(ptttIdOrName || "").trim();
  if (key) {
    const hit = list.find((p) => String(p.id) === key || normName(p.name) === normName(key));
    if (hit) return hit;
  }
  const url = String(checkerUrl || "").trim();
  if (url) {
    const hit = list.find((p) => {
      const u = String(p.sheetUrl || "").trim();
      if (!u) return false;
      return u === url || u.includes(url) || url.includes(u);
    });
    if (hit) return hit;
  }
  return null;
}

/** PTTT từ file Excel mà SP đang nằm (ưu tiên cao nhất). */
function resolveBagLocalPttt(items) {
  for (const it of items || []) {
    const local = findLocalPttt(it.ptttId || it.ptttName, it.checkerUrl);
    if (local) return local;
  }
  return null;
}

function collectAdminCreatePayload(prefix) {
  const p = prefix === "ab" ? "ab" : "dm";
  const $pay = $(`#${p}_payment option:selected`);
  const $wh = $(`#${p}_warehouse option:selected`);
  return {
    created_time: $(`#${p}_created_time`).val(),
    country_id: $(`#${p}_country`).val(),
    warehouse_id: $(`#${p}_warehouse`).val(),
    warehouse_name: String($wh.text() || "").replace(/^[-—]\s*Lựa chọn\s*[-—]?$/i, "").trim(),
    order_number: $(`#${p}_order_number`).val(),
    note: $(`#${p}_note`).val(),
    payment_id: $(`#${p}_payment`).val(),
    payment_name: String($pay.text() || "").replace(/^[-—]\s*Lựa chọn\s*[-—]?$/i, "").trim(),
    ship_fee: $(`#${p}_ship`).val() || 0,
    discount: $(`#${p}_discount`).val() || 0,
    buy_rate: Number($pay.data("rate") || 0),
    cashback_rate: $(`#${p}_cashback_rate`).val() || 0,
    web_cashback_id: $(`#${p}_web_cashback`).val() || "",
    create_billing: true,
    branch: "ha-noi",
  };
}

function buyListRowHtml(item, i, { admin } = {}) {
  const line = Number(item.price || 0) * Number(item.qty || 1);
  const img = item.image || "/assets/img/dummy.png";
  const cur = escapeHtml(item.currencySymbol || "$");
  const extraCols = `<td class="text-left" style="word-break:break-all">${escapeHtml(item.orderNo || "")}</td>
        <td class="text-left" style="word-break:break-all">${escapeHtml(item.tracking || "")}</td>`;
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

function renderAdminModalBag() {
  const $body = $("#abBuyBody").empty();
  const adminItems = adminBagItems();
  $("#abBuyEmpty").prop("hidden", adminItems.length > 0);
  adminItems.forEach((item, i) => {
    $body.append(buyListRowHtml(item, i, { admin: true }));
  });
  calcBuyTotals();
}

function renderBuyList() {
  const $body = $("#buyBody").empty();
  const $bodyAdmin = $("#buyBodyAdmin").empty();
  const sendItems = sendBagItems();
  const adminItems = adminBagItems();
  $("#buyEmpty").prop("hidden", sendItems.length > 0);
  $("#buyEmptyAdmin").prop("hidden", adminItems.length > 0);

  sendItems.forEach((item, i) => {
    $body.append(buyListRowHtml(item, i, { admin: false }));
  });
  adminItems.forEach((item, i) => {
    $bodyAdmin.append(buyListRowHtml(item, i, { admin: true }));
  });

  if (state.adminModalOpen) renderAdminModalBag();
  calcBuyTotals();
}

function fillAdminModalSelects(prefs = {}, orderNo = "") {
  const meta = state.createMeta || {};
  const lastAdmin = loadLastAdminCreate();
  const lastSend = loadLastSheetSend();
  const last = { ...lastAdmin, ...(prefs || {}) };
  const bagItems = adminBagItems();

  const $country = $("#ab_country").empty().append('<option value="">- Lựa chọn -</option>');
  (meta.countries || []).forEach((c) => {
    $country.append(
      `<option value="${escapeHtml(c.id)}" data-symbol="${escapeHtml(c.currency_symbol || "$")}">${escapeHtml(c.name)}</option>`
    );
  });
  const countryVal =
    last.country_id || ($("#dm_country").val() || "") || ((meta.countries || [])[0] && meta.countries[0].id) || "";
  if (countryVal) $country.val(String(countryVal));

  const $pay = $("#ab_payment").empty().append('<option value="">- Lựa chọn -</option>');
  (meta.payments || []).forEach((p) => {
    $pay.append(
      `<option value="${escapeHtml(p.id)}" data-rate="${escapeHtml(p.currency_rate || 0)}">${escapeHtml(p.name)}</option>`
    );
  });

  // 1) File Excel SP đang nằm (vd Nguyễn Công Phước) → PTTT cùng tên
  const filePttt = resolveBagLocalPttt(bagItems);
  let payVal = "";
  if (filePttt) {
    const hit = matchMetaByName(meta.payments || [], filePttt.name);
    if (hit) payVal = String(hit.id);
  }
  // 2) Lần Gửi đơn Excel trước
  if (!payVal && lastSend.pttt_name) {
    const hit = matchMetaByName(meta.payments || [], lastSend.pttt_name);
    if (hit) payVal = String(hit.id);
  }
  // 3) Gợi ý theo website (tên PTTT / paymentId Admin)
  if (!payVal) {
    const site = bagItems.map((b) => b.website).find(Boolean);
    const sug = site ? lookupWebsitePtttClient(site) : null;
    if (sug) {
      if (sug.ptttName) {
        const hit = matchMetaByName(meta.payments || [], sug.ptttName);
        if (hit) payVal = String(hit.id);
      }
      if (!payVal && sug.paymentId) payVal = String(sug.paymentId);
      if (!payVal && sug.ptttId) {
        const local = findLocalPttt(sug.ptttId);
        const hit = local ? matchMetaByName(meta.payments || [], local.name) : null;
        if (hit) payVal = String(hit.id);
      }
    }
  }
  // 4) Lần tạo Admin trước (theo tên rồi mới id)
  if (!payVal && last.payment_name) {
    const hit = matchMetaByName(meta.payments || [], last.payment_name);
    if (hit) payVal = String(hit.id);
  }
  if (!payVal && last.payment_id) {
    const exists = (meta.payments || []).some((p) => String(p.id) === String(last.payment_id));
    if (exists) payVal = String(last.payment_id);
  }
  if (!payVal && $("#dm_payment").val()) payVal = String($("#dm_payment").val());
  if (payVal) $pay.val(payVal);

  const $wh = $("#ab_warehouse").empty().append('<option value="">- Lựa chọn -</option>');
  (meta.warehouses || []).forEach((w) => {
    $wh.append(`<option value="${escapeHtml(w.id)}">${escapeHtml(w.name)}</option>`);
  });

  // Warehouse: lần Gửi đơn → lần tạo Admin → trùng tên file PTTT (nếu có trong list) → tab Đang mua
  let whVal = "";
  const whNameCandidates = [
    lastSend.warehouse_name,
    last.warehouse_name,
    (() => {
      const id = lastSend.warehouse_id || "";
      const local = (state.settings.warehouses || []).find((w) => String(w.id) === String(id));
      return local ? local.name : "";
    })(),
    filePttt ? filePttt.name : "",
    String($("#dm_warehouse option:selected").text() || "")
      .replace(/^[-—]\s*Lựa chọn\s*[-—]?$/i, "")
      .trim(),
  ].filter(Boolean);
  for (const name of whNameCandidates) {
    const hit = matchMetaByName(meta.warehouses || [], name);
    if (hit) {
      whVal = String(hit.id);
      break;
    }
  }
  if (!whVal && last.warehouse_id) {
    const exists = (meta.warehouses || []).some((w) => String(w.id) === String(last.warehouse_id));
    if (exists) whVal = String(last.warehouse_id);
  }
  if (!whVal && $("#dm_warehouse").val()) {
    const dmId = $("#dm_warehouse").val();
    const exists = (meta.warehouses || []).some((w) => String(w.id) === String(dmId));
    if (exists) whVal = String(dmId);
  }
  if (whVal) $wh.val(whVal);

  const $cb = $("#ab_web_cashback").empty().append('<option value="">- Lựa chọn -</option>');
  (meta.web_cashbacks || []).forEach((w) => {
    $cb.append(`<option value="${escapeHtml(w.id)}">${escapeHtml(w.name)}</option>`);
  });
  if (last.web_cashback_id) $cb.val(String(last.web_cashback_id));

  const todayStr =
    $("#dm_created_time").val() ||
    (() => {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    })();
  $("#ab_created_time").val(last.created_time || todayStr);
  $("#ab_order_number").val(orderNo || last.order_number || "");
  $("#ab_buyer").val(state.currentUser || "");
  $("#ab_note").val(last.note || "");
  const shipPref = lastSend.ship_fee != null ? lastSend.ship_fee : last.ship_fee;
  $("#ab_ship").val(shipPref != null ? shipPref : 0);
  $("#ab_discount").val(last.discount != null ? last.discount : 0);
  $("#ab_cashback_rate").val(last.cashback_rate != null ? last.cashback_rate : 0);

  const countryHit = (meta.countries || []).find((c) => String(c.id) === String($("#ab_country").val()));
  const sym =
    $("#ab_country option:selected").data("symbol") ||
    (countryHit && countryHit.currency_symbol) ||
    "$";
  $(".ab-cur").text(sym);
  calcBuyTotals();
}

function closeAdminBagModal() {
  state.adminModalOpen = false;
  $("#adminBagModal").prop("hidden", true);
}

async function openAdminBagModalForOrderNo(orderNo) {
  const no = String(orderNo || "").trim();
  if (!no) return toast("Sản phẩm chưa có Order number", { error: true, basso: true });

  toast(`Đang gom SP cùng Order number ${no}…`);
  try {
    const res = await apiFetch("/api/basso/buy-list/add-scanned-group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNo: no, replace: true }),
    });
    const data = await res.json();
    if (!data.ok) return toast(data.error || "Không gom được sản phẩm", { error: true });
    if (Array.isArray(data.items)) state.buyList = data.items;
    state.adminModalOpen = true;
    $("#adminBagModal").prop("hidden", false);
    renderAdminModalBag();
    fillAdminModalSelects({}, no);
    if (typeof $.fn.datetimepicker === "function") {
      const $t = $("#ab_created_time");
      if (!$t.data("xdsoft_datetimepicker")) {
        $t.datetimepicker({
          format: "d-m-Y",
          timepicker: false,
          scrollInput: false,
          dayOfWeekStart: 1,
        });
      }
    }
    const badId = adminBagItems().filter(
      (it) => !/^\d+$/.test(String(it.bassoOrderId || it.orderId || ""))
    );
    if (badId.length) {
      toast(
        `${badId.length} SP thiếu ID Basso số — có thể không tạo Admin được. Làm mới rồi thử lại.`,
        { error: true }
      );
    } else {
      toast(data.message || `Đã gom ${data.added || 0} sản phẩm`, { success: true });
    }
  } catch (err) {
    toast("Lỗi gom sản phẩm: " + (err.message || String(err)), { error: true });
  }
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
        <td colspan="11" class="pl-0 pr-0">
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
  const scanned = state.status === "da_quet";
  const listOrders = !buying && !sending && !report && !scanned;
  $("#pane-orders").prop("hidden", !listOrders).toggleClass("active", listOrders);
  $("#pane-send").prop("hidden", !sending).toggleClass("active", sending);
  $("#pane-buying").prop("hidden", !buying).toggleClass("active", buying);
  $("#pane-report").prop("hidden", !report).toggleClass("active", report);
  $("#pane-scanned").prop("hidden", !scanned).toggleClass("active", scanned);
  if (buying || sending || report || scanned) {
    $("#ordersPager").prop("hidden", true);
  }
  if (buying || sending) {
    fillOrderFormSelects();
    fillAdminFormSelects();
    renderBuyList();
  } else if (report) {
    renderReport();
  } else if (scanned) {
    renderScanned();
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

function formatScanTime(iso, order) {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
    }
  }
  const created = parseOrderCreatedDate(order);
  return created ? formatReportHeaderDate(created) : "—";
}

function orderStillBuyable(order) {
  return (order.items || []).some((it) => !it.adminOrderChecked);
}

/** Đã quét giữ món cả khi Basso đã gỡ khỏi Cần mua.
 *  Chỉ rời tab sau khi Cập nhật tracking thành công và checkbox Tracking được tích.
 */
function scannedProductRows() {
  const rows = (state.scannedItems || [])
    .filter((row) => !(row.adminTrackingChecked && row.adminTrackingSheetChecked))
    .filter((row) => String(row.orderNo || "").trim() || String(row.tracking || "").trim())
    .map((row) => {
      const synced = row.syncedAt ? Date.parse(row.syncedAt) : 0;
      return {
        order: { id: row.orderId, website: row.website || "" },
        item: { ...row, id: row.itemId },
        sort: Number.isFinite(synced) && synced > 0 ? synced : 0,
      };
    });
  rows.sort((a, b) => a.sort - b.sort || String(a.order.id).localeCompare(String(b.order.id)));
  return rows;
}

function scanTick(checked, title) {
  const tip = escapeHtml(title || "");
  if (checked) {
    return `<i class="fa fa-check-square" style="color:#27c24c;font-size:16px" title="${tip}"></i>`;
  }
  return `<i class="far fa-square text-muted" style="font-size:16px" title="${tip}"></i>`;
}

function resolveCheckerPttt(item) {
  const local = findLocalPttt(
    (item && (item.ptttId || item.ptttName)) || "",
    (item && item.checkerUrl) || ""
  );
  if (local) return local;
  const name = String((item && item.ptttName) || "").trim();
  if (name) return { id: "", name, sheetUrl: String((item && item.checkerUrl) || "").trim() };
  return null;
}

function checkerSheetUrl(item) {
  const direct = String((item && item.checkerUrl) || "").trim();
  if (/^https?:\/\//i.test(direct)) return direct;
  const pttt = resolveCheckerPttt(item);
  const url = pttt ? String(pttt.sheetUrl || "").trim() : "";
  return /^https?:\/\//i.test(url) ? url : "";
}

function checkerCellHtml(item) {
  const pttt = resolveCheckerPttt(item);
  const url = checkerSheetUrl(item);
  const label = String((pttt && pttt.name) || "").trim();
  if (!url && !label) {
    return `<span class="text-muted" title="Chưa gắn Sheet PTTT — Đồng bộ Sheet để lấy file">—</span>`;
  }
  const text = label || "Checker";
  if (!url) {
    return `<span class="text-muted" title="Chưa có link Sheet">${escapeHtml(text)}</span>`;
  }
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="text-info font-weight-bold js-open-checker" title="Mở file ${escapeHtml(text)}">${escapeHtml(text)}</a>`;
}

function adminOrderDetailUrl(item) {
  const direct = String((item && item.adminOrderUrl) || "").trim();
  if (/^https?:\/\//i.test(direct)) return direct;
  const id = String((item && item.adminWebOrderId) || "").trim();
  if (!id) return "";
  const base = String(state.bassoSiteUrl || "https://basso.vn").replace(/\/$/, "");
  return `${base}/hethong/basso/web_order/detail/${encodeURIComponent(id)}`;
}

function scanOrderNumberHtml(item) {
  const text = String((item && item.orderNo) || "").trim();
  if (!text) return "";
  const url =
    item && item.adminOrderChecked ? adminOrderDetailUrl(item) : "";
  if (!url) return escapeHtml(text);
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="text-info font-weight-bold" title="Mở đơn Admin trên Basso">${escapeHtml(text)}</a>`;
}

function renderScanned() {
  const rows = scannedProductRows();
  const $body = $("#scanBody").empty();
  $("#scanEmpty").prop("hidden", rows.length > 0);
  rows.forEach((row, i) => {
    const item = row.item;
    const order = row.order;
    const img = item.image || "/assets/img/dummy.png";
    $body.append(`
      <tr data-order-id="${escapeHtml(order.id)}" data-item-id="${escapeHtml(item.id)}" data-sheet-tracking="${escapeHtml(item.tracking || "")}" data-item-key="${escapeHtml(item.itemKey || "")}" data-url="${escapeHtml(item.url || "")}" data-size="${escapeHtml(item.size || "")}" data-color="${escapeHtml(item.color || "")}" data-pttt-id="${escapeHtml(item.ptttId || "")}" data-checker-url="${escapeHtml(item.checkerUrl || "")}">
        <td><input type="checkbox" class="js-scan-check" /></td>
        <td>${i + 1}</td>
        <td>${escapeHtml(formatScanTime(item.syncedAt, order))}</td>
        <td>${checkerCellHtml(item)}</td>
        <td>${escapeHtml(order.id)}</td>
        <td>${escapeHtml(order.website || "—")}</td>
        <td class="text-left">
          <div class="d-flex align-items-center">
            <img src="${escapeHtml(img)}" alt="" style="max-height:48px;max-width:48px;margin-right:8px" loading="lazy" />
            <a href="${escapeHtml(item.url || "#")}" target="_blank">${escapeHtml(item.name || "—")}</a>
          </div>
        </td>
        <td class="text-left"><b>Size</b>: ${escapeHtml(item.size || "—")}<br /><b>Màu</b>: ${escapeHtml(item.color || "—")}</td>
        <td>$ ${money(item.price)}</td>
        <td class="text-center" style="word-break:break-all">
          <div>${scanOrderNumberHtml(item)}</div>
          <div class="mt-1">${scanTick(item.adminOrderChecked, item.adminOrderChecked ? "Đã tạo đơn Admin từ Đang mua — bấm Order number để mở" : "Tích xanh khi tạo đơn Admin từ Đang mua thành công")}</div>
        </td>
        <td class="text-center" style="word-break:break-all">
          <div>${escapeHtml(item.tracking || "")}</div>
          <div class="mt-1">${scanTick(item.adminTrackingChecked, item.adminTrackingChecked ? "Đã cập nhật tracking cho sản phẩm" : "Tích khi bấm Cập nhật")}</div>
        </td>
        <td>${
          item.adminOrderChecked
            ? `<span class="text-muted">Đã tạo Admin</span>`
            : `<a href="javascript:" class="text-info font-weight-bold js-scan-add-bag">Add bag</a>`
        }</td>
        <td>
          <div class="input-group input-group-sm">
            <input type="text" class="form-control form-control-sm js-admin-tracking" value="${escapeHtml(item.adminOrderChecked ? item.adminTracking || "" : "")}" placeholder="Tracking" title="${item.adminOrderChecked ? escapeHtml("Tracking sản phẩm, lấy từ Tracking number") : "Tạo đơn Admin từ Đang mua trước"}" readonly ${item.adminOrderChecked ? "" : "disabled"} />
            <div class="input-group-append">
              <button type="button" class="btn btn-light border js-save-admin-tracking" title="Lấy Tracking number cập nhật vào tracking sản phẩm" ${item.adminOrderChecked && String(item.tracking || "").trim() ? "" : "disabled"}>Cập nhật</button>
            </div>
          </div>
        </td>
      </tr>`);
  });
}

function bagAnchorOrderNo() {
  const first = adminBagItems()[0];
  return first ? String(first.orderNo || "").trim() : null;
}

function sameBagOrderNoMessage(anchor) {
  return anchor
    ? `Chỉ thêm sản phẩm cùng Order number với sản phẩm đầu tiên (${anchor})`
    : "Chỉ thêm sản phẩm cùng Order number với sản phẩm đầu tiên";
}

async function addScannedToBag(pairs) {
  if (!pairs.length) return toast("Chọn sản phẩm rồi bấm Add bag", { error: true, basso: true });
  let added = 0;
  let blockedAdmin = 0;
  let blockedOrder = 0;
  const toSave = [];
  let anchor = bagAnchorOrderNo();
  for (const pair of pairs) {
    const order = (state.orders || []).find((o) => String(o.id) === String(pair.orderId));
    const item = order && (order.items || []).find((it) => String(it.id) === String(pair.itemId));
    if (!order || !item) continue;
    const orderNo = String(item.orderNo || "").trim();
    if (anchor == null) anchor = orderNo;
    if (item.adminOrderChecked) {
      blockedAdmin += 1;
      continue;
    }
    if (adminBagItems().some((x) => String(x.itemId) === String(item.id))) continue;
    if (orderNo !== anchor) {
      blockedOrder += 1;
      continue;
    }
    state.buyList.push(localBuyItem(order, item, "dang_mua"));
    toSave.push(pair);
    added += 1;
  }
  refreshBagView();
  if (!added) {
    if (blockedOrder) return toast(sameBagOrderNoMessage(anchor), { error: true, basso: true });
    return toast(blockedAdmin ? "Sản phẩm đã tạo đơn Admin, không thêm lại được" : "Sản phẩm đã có trong danh sách", {
      error: true,
      basso: true,
    });
  }
  toast(
    blockedOrder
      ? `Đã thêm ${added} sản phẩm vào Đang mua. ${blockedOrder} sản phẩm khác Order number không được thêm`
      : added === 1
        ? "Đã thêm sản phẩm vào Đang mua"
        : `Đã thêm ${added} sản phẩm vào Đang mua`,
    { success: true }
  );

  let lastItems = null;
  for (const pair of toSave) {
    try {
      const res = await apiFetch("/api/basso/buy-list/add-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: pair.orderId, itemId: pair.itemId, bag: "dang_mua" }),
      });
      const data = await res.json();
      if (Array.isArray(data.items)) lastItems = data.items;
    } catch {
      /* giỏ local vẫn hiện; F5 sẽ xóa */
    }
  }
  if (lastItems) {
    state.buyList = lastItems;
    refreshBagView();
  }
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

function formatReportDayMonth(d) {
  if (!d) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function reportStackHtml(lines) {
  const list = (lines || []).filter(Boolean);
  if (!list.length) return '<span class="text-muted">—</span>';
  return `<ul class="report-stack">${list
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("")}</ul>`;
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
  });

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
      const saved = state.reportReasons[g.website];
      const reason =
        saved != null && String(saved).trim() !== ""
          ? String(saved)
          : g.notes.filter((v, i, a) => a.indexOf(v) === i).join("\n");
      return {
        website: g.website,
        orderCount: g.orderCount,
        amount: g.amount,
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
        <td class="text-center"><span class="report-count-badge">${row.orderCount}</span></td>
        <td><span class="report-amount">$ ${money(row.amount)}</span></td>
        <td>${reportStackHtml(row.dateLines)}</td>
        <td>${reportStackHtml(row.groupLines)}</td>
        <td>${reportStackHtml(row.staffLines)}</td>
        <td>
          <textarea class="form-control form-control-sm js-report-reason" rows="3" placeholder="Nhập lý do...">${escapeHtml(row.reason)}</textarea>
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
  const scale = 3;
  const fontBody = "15px Arial, Helvetica, sans-serif";
  const fontBold = "bold 15px Arial, Helvetica, sans-serif";
  const fontTitle = "bold 20px Arial, Helvetica, sans-serif";
  const fontCaption = "14px Arial, Helvetica, sans-serif";
  const cols = [
    { key: "stt", title: "STT", w: 56, align: "center" },
    { key: "website", title: "Website", w: 170, align: "left" },
    { key: "orderCount", title: "Đơn chậm", w: 90, align: "center" },
    { key: "amount", title: "Số tiền", w: 120, align: "left" },
    { key: "dateLabel", title: "Ngày tạo đơn", w: 180, align: "left", multiline: true },
    { key: "groupLabel", title: "Nhóm KH", w: 180, align: "left", multiline: true },
    { key: "staff", title: "Người xử lý", w: 130, align: "left", multiline: true },
    { key: "reason", title: "Lý do", w: 320, align: "left", multiline: true },
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const pad = 24;
  const titleH = 28;
  const captionH = 28;
  const headRowH = 44;
  const lineH = 20;
  const cellPadY = 10;
  const cellPadX = 10;

  const canvasProbe = document.createElement("canvas");
  const probe = canvasProbe.getContext("2d");
  probe.font = fontBody;

  const rowHeights = (rows || []).map((row) => {
    const stacks = [
      wrapCanvasText(probe, row.dateLabel || "", cols[4].w - cellPadX * 2),
      wrapCanvasText(probe, row.groupLabel || "", cols[5].w - cellPadX * 2),
      wrapCanvasText(probe, (row.staffLines || []).join("\n") || row.staff || "", cols[6].w - cellPadX * 2),
      wrapCanvasText(probe, row.reason || "", cols[7].w - cellPadX * 2),
    ];
    const maxLines = Math.max(1, ...stacks.map((l) => l.length));
    return Math.max(48, maxLines * lineH + cellPadY * 2);
  });
  const bodyH = rowHeights.reduce((s, h) => s + h, 0) || 56;
  const totalH = pad + titleH + captionH + 12 + headRowH + bodyH + pad;
  const totalW = pad * 2 + tableW;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(totalW * scale);
  canvas.height = Math.round(totalH * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, totalW, totalH);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#2f353a";
  ctx.font = fontTitle;
  ctx.fillText(`Báo cáo đơn chậm mua  ${headerDate || ""}`, pad, pad);
  ctx.fillStyle = "#73818f";
  ctx.font = fontCaption;
  ctx.fillText(
    "Đơn chờ mua / cần xử lý, quá 3 ngày chưa có Order # · Gom theo website",
    pad,
    pad + titleH + 2
  );

  const tableX = pad;
  const tableY = pad + titleH + captionH + 12;

  function drawCell(x, y, w, h, text, opts = {}) {
    ctx.strokeStyle = "#e4e7ea";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    }
    ctx.fillStyle = opts.color || "#2f353a";
    ctx.font = opts.bold ? fontBold : fontBody;
    const lines = opts.multiline
      ? wrapCanvasText(ctx, text, w - cellPadX * 2)
      : [String(text ?? "")];
    const textBlockH = lines.length * lineH;
    let ty = y + (opts.multiline || opts.top ? cellPadY : (h - textBlockH) / 2);
    for (const line of lines) {
      let tx = x + cellPadX;
      if (opts.align === "center") tx = x + (w - ctx.measureText(line).width) / 2;
      ctx.fillText(line, Math.round(tx), Math.round(ty));
      ty += lineH;
    }
  }

  let x = tableX;
  for (const col of cols) {
    drawCell(x, tableY, col.w, headRowH, col.title, {
      bg: "#f6f7f9",
      bold: true,
      align: "left",
      top: true,
    });
    x += col.w;
  }

  let y = tableY + headRowH;
  if (!(rows || []).length) {
    drawCell(tableX, y, tableW, 56, "Không có website nào quá 3 ngày chưa mua.", {
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
        row.groupLabel,
        (row.staffLines || []).join("\n") || row.staff || "—",
        row.reason || "",
      ];
      x = tableX;
      cols.forEach((col, ci) => {
        drawCell(x, y, col.w, h, values[ci], {
          align: col.align,
          multiline: !!col.multiline || col.key === "reason",
          bold: col.key === "amount",
          top: !!col.multiline,
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
  // Ưu tiên: đang chọn → PTTT từ SP trong giỏ Gửi đơn → gợi ý website
  const sendItems = sendBagItems();
  const fromCart = sendItems.map((b) => b.ptttId).find(Boolean);
  const fromSite = (() => {
    const site = sendItems.map((b) => b.website).find(Boolean);
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
  // Gợi ý PTTT Admin theo website trong giỏ Đang mua
  const fromSitePayment = (() => {
    const site = adminBagItems().map((b) => b.website).find(Boolean);
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
  const adminFirst = adminBagItems()[0];
  const sym =
    $("#dm_country option:selected").data("symbol") ||
    (adminFirst && adminFirst.currencySymbol) ||
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
        <td>
          <div class="input-group input-group-sm">
            <input type="text" class="form-control form-control-sm js-pttt-url" value="${escapeHtml(row.sheetUrl || "")}" placeholder="https://docs.google.com/spreadsheets/d/..." />
            <div class="input-group-append">
              <a class="btn btn-outline-primary js-open-sheet" href="${escapeHtml(/^https?:\/\//i.test(String(row.sheetUrl || "").trim()) ? String(row.sheetUrl).trim() : "#")}" target="_blank" rel="noopener" title="Mở Sheet">Mở</a>
            </div>
          </div>
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-info btn-xs btn-colmap ${open ? "is-open" : ""}" data-idx="${i}">Map cột</button>
        </td>
        <td class="text-center"><button type="button" class="btn btn-link text-danger btn-sm p-0 js-pttt-del"><i class="icon-trash"></i></button></td>
      </tr>
      <tr class="pttt-colmap" data-idx="${i}" ${open ? "" : "hidden"}>
        <td colspan="4">
          <div class="colmap-panel">
            <div class="small text-muted mb-2">Nhập chữ cột Excel (A, B, C…). Để trống field nào không dùng. Mặc định A→I theo layout cũ. Checkbox tạo Admin và Checkbox Tracking phải map đúng cột checkbox trên Excel — khi Nobita tích thì ô Excel tích theo.</div>
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
  state.scannedItems = ordersRes.scannedItems || [];
  if (opts.clearBag) {
    await apiFetch("/api/basso/buy-list/clear", { method: "POST" }).catch(() => {});
    state.buyList = [];
  } else {
    state.buyList = buyRes.items || [];
  }
  state.settings = settingsRes.settings || { pttt: [], warehouses: [] };
  state.reportReasons = (reasonsRes && reasonsRes.reasons) || {};
  state.source = ordersRes.source || "mock";
  state.bassoSiteUrl = ordersRes.bassoSiteUrl || state.bassoSiteUrl || "https://basso.vn";
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

  async function saveReportReasonFromRow($tr, { quiet } = {}) {
    const website = $tr.data("website");
    if (!website) return;
    const reason = $tr.find(".js-report-reason").val() || "";
    if (String(state.reportReasons[website] || "") === String(reason)) return;
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
      if (!quiet) toast("Đã lưu lý do");
    } catch (err) {
      toast("Lỗi lưu lý do: " + (err.message || String(err)), { error: true });
    }
  }

  $("#pane-report").on("blur", ".js-report-reason", function () {
    saveReportReasonFromRow($(this).closest("tr"), { quiet: true });
  });
  $("#pane-report").on("click", ".js-save-reason", function () {
    saveReportReasonFromRow($(this).closest("tr"));
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

  $("#pane-scanned").on("click", ".js-scan-add-bag", async function (e) {
    e.preventDefault();
    const $tr = $(this).closest("tr");
    const orderId = String($tr.attr("data-order-id") || "");
    const itemId = String($tr.attr("data-item-id") || "");
    const scanRow = (state.scannedItems || []).find(
      (r) => String(r.orderId) === orderId && String(r.itemId) === itemId
    );
    const liveOrder = (state.orders || []).find((o) => String(o.id) === orderId);
    const liveItem = liveOrder && (liveOrder.items || []).find((it) => String(it.id) === itemId);
    const orderNo = String(
      (scanRow && scanRow.orderNo) || (liveItem && liveItem.orderNo) || ""
    ).trim();
    await openAdminBagModalForOrderNo(orderNo);
  });

  $("#pane-scanned").on("click", ".js-save-admin-tracking", async function () {
    const $tr = $(this).closest("tr");
    const orderId = String($tr.attr("data-order-id") || "");
    const itemId = String($tr.attr("data-item-id") || "");
    const tracking = String($tr.attr("data-sheet-tracking") || "").trim();
    if (!tracking) return toast("Chưa có Tracking number", { error: true });
    $tr.find(".js-admin-tracking").val(tracking);
    const $btn = $(this).prop("disabled", true);
    try {
      const res = await apiFetch("/api/basso/items/admin-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          itemId,
          tracking,
          itemKey: String($tr.attr("data-item-key") || ""),
          url: String($tr.attr("data-url") || ""),
          size: String($tr.attr("data-size") || ""),
          color: String($tr.attr("data-color") || ""),
          ptttId: String($tr.attr("data-pttt-id") || ""),
        }),
      });
      const data = await res.json();
      if (!data.ok) return toast(data.error || "Lưu tracking thất bại", { error: true });
      const order = (state.orders || []).find((o) => String(o.id) === orderId);
      const item = order && (order.items || []).find((it) => String(it.id) === itemId);
      state.scannedItems = (state.scannedItems || []).filter(
        (row) => !(String(row.orderId) === orderId && String(row.itemId) === itemId)
      );
      renderScanned();
      updateMeta();
      toast("Đã cập nhật tracking và tích checkbox Excel", { success: true });
    } catch (err) {
      toast("Lỗi lưu tracking: " + (err.message || String(err)), { error: true });
    } finally {
      $btn.prop("disabled", false);
    }
  });

  $("#btnScanAddBag").on("click", async function () {
    const orderNos = [];
    $("#scanBody .js-scan-check:checked").each(function () {
      const $tr = $(this).closest("tr");
      const orderId = String($tr.attr("data-order-id") || "");
      const itemId = String($tr.attr("data-item-id") || "");
      const scanRow = (state.scannedItems || []).find(
        (r) => String(r.orderId) === orderId && String(r.itemId) === itemId
      );
      const liveOrder = (state.orders || []).find((o) => String(o.id) === orderId);
      const liveItem = liveOrder && (liveOrder.items || []).find((it) => String(it.id) === itemId);
      const orderNo = String(
        (scanRow && scanRow.orderNo) || (liveItem && liveItem.orderNo) || ""
      ).trim();
      if (orderNo) orderNos.push(orderNo);
    });
    if (!orderNos.length) return toast("Chọn sản phẩm rồi bấm Add bag", { error: true, basso: true });
    const unique = [...new Set(orderNos)];
    if (unique.length > 1) {
      return toast("Chỉ chọn sản phẩm cùng một Order number", { error: true, basso: true });
    }
    await openAdminBagModalForOrderNo(unique[0]);
  });

  $("#adminBagModal").on("click", ".js-ab-close", function () {
    closeAdminBagModal();
  });
  $(document).on("keydown.adminBagModal", function (e) {
    if (e.key === "Escape" && state.adminModalOpen) closeAdminBagModal();
  });
  $("#adminBagModal").on("input change", "#ab_ship, #ab_discount", calcBuyTotals);
  $("#adminBagModal").on("change", "#ab_country", function () {
    const sym = $("#ab_country option:selected").data("symbol") || "$";
    $(".ab-cur").text(sym);
  });
  $("#adminBagModal").on("click", ".js-buy-delete", async function (e) {
    e.preventDefault();
    const buyId = $(this).closest("tr").attr("data-buy-id");
    if (!buyId) return;
    try {
      const res = await apiFetch(`/api/basso/buy-list/${encodeURIComponent(buyId)}`, { method: "DELETE" });
      const data = await res.json();
      if (Array.isArray(data.items)) state.buyList = data.items;
      else state.buyList = (state.buyList || []).filter((x) => String(x.buyId) !== String(buyId));
      renderBuyList();
      renderAdminModalBag();
    } catch (err) {
      toast("Lỗi xóa: " + (err.message || String(err)), { error: true });
    }
  });
  $("#adminBagModal").on("change", ".js-buy-price", async function () {
    const buyId = $(this).closest("tr").attr("data-buy-id");
    const price = Number($(this).val() || 0);
    if (!buyId) return;
    const row = (state.buyList || []).find((x) => String(x.buyId) === String(buyId));
    if (row) row.price = price;
    calcBuyTotals();
    renderAdminModalBag();
    try {
      const res = await apiFetch(`/api/basso/buy-list/${encodeURIComponent(buyId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price }),
      });
      const data = await res.json();
      if (Array.isArray(data.items)) state.buyList = data.items;
    } catch {
      /* ignore */
    }
  });

  const abRequiredFields = [
    "#ab_created_time",
    "#ab_country",
    "#ab_warehouse",
    "#ab_order_number",
    "#ab_buyer",
    "#ab_payment",
  ];
  $("#adminBagModal").on("input change", abRequiredFields.join(","), function () {
    $(this).toggleClass("validationElement", fieldIsEmpty($(this)));
  });

  $("#btnModalCreateAdmin").on("click", async function () {
    if (!adminBagItems().length) return toast("Bạn chưa chọn sản phẩm");
    if (!highlightMissingFields(abRequiredFields)) return;
    const confirmed = await bassoConfirm(
      "Xác nhận tạo đơn hàng",
      "Các sản phẩm sẽ được đánh dấu là đã mua"
    );
    if (!confirmed) return;

    const $btn = $(this);
    const oldHtml = $btn.html();
    $btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin"></i> Đang tạo…');
    toast("Đang tạo đơn Admin trên Basso…");
    const payload = collectAdminCreatePayload("ab");
    try {
      const res = await apiFetch("/api/basso/buy-list/create-admin-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        return toast(data.error || "Tạo đơn Admin thất bại", { error: true });
      }
      saveLastAdminCreate(payload);
      if (Array.isArray(data.items)) state.buyList = data.items;
      else state.buyList = (state.buyList || []).filter((x) => !isAdminBagItem(x));
      const sheetErr = data.sheetCheck && data.sheetCheck.error;
      toast(
        sheetErr
          ? `${data.message || "Tạo đơn hàng thành công"}. Excel: ${sheetErr}`
          : data.message || "Tạo đơn hàng thành công",
        sheetErr ? { error: true } : { success: true }
      );
      if (data.redirect_url) window.open(data.redirect_url, "_blank");
      closeAdminBagModal();
      await loadAll({ refresh: true });
    } catch (err) {
      toast("Lỗi tạo đơn Admin: " + (err.message || String(err)), { error: true });
    } finally {
      $btn.html(oldHtml).prop("disabled", adminBagItems().length === 0);
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
    const id = String($tr.attr("data-id") || "");
    const note = $tr.find("[data-note]").val();
    try {
      const res = await apiFetch(`/api/basso/orders/${encodeURIComponent(id)}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      const o = state.orders.find((x) => String(x.id) === id);
      if (o) o.note = note;
      if (!data.ok) return toast(data.error || "Không đồng bộ ghi chú sang Basso", { error: true });
      toast(data.synced ? "Đã lưu ghi chú sang Basso " + id : data.warning || "Đã lưu ghi chú " + id);
    } catch (err) {
      toast("Lỗi lưu ghi chú: " + (err.message || String(err)), { error: true });
    }
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

  $("#ordersBody").on("click", ".js-add-all", function (e) {
    e.preventDefault();
    const id = $(this).closest("tr").data("id");
    const order = state.orders.find((x) => String(x.id) === String(id));
    addOrderItemsToBag(order);
  });

  $("#ordersBody").on("click", ".js-add-item", function (e) {
    e.preventDefault();
    const orderId = $(this).closest("tr.tr-collapse").prev("tr").data("id");
    const itemId = $(this).data("item-id");
    const order = state.orders.find((x) => String(x.id) === String(orderId));
    addOrderItemsToBag(order, itemId);
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
    if (!sendBagItems().length) return toast("Bạn chưa chọn sản phẩm");
    if (!$("#oi_warehouse").val() || !$("#oi_payment").val()) {
      return toast("Vui lòng điền đủ các trường *");
    }
    if (!$("#oi_created_time").val()) return toast("Vui lòng chọn Thời gian");
    const confirmed = await bassoConfirm(
      "Xác nhận gửi đơn hàng",
      "Đơn sẽ được gửi vào Excel theo PTTT đã chọn"
    );
    if (!confirmed) return;

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

      saveLastSheetSend({
        warehouse_id: $("#oi_warehouse").val() || "",
        warehouse_name: String($("#oi_warehouse option:selected").text() || "")
          .replace(/^[-—]\s*Lựa chọn\s*[-—]?$/i, "")
          .trim(),
        pttt_id: $("#oi_payment").val() || "",
        pttt_name:
          data.ptttName ||
          String($("#oi_payment option:selected").text() || "")
            .replace(/^[-—]\s*Lựa chọn\s*[-—]?$/i, "")
            .trim(),
        ship_fee: $("#oi_ship").val() || 0,
        at: new Date().toISOString(),
      });

      if (Array.isArray(data.items)) state.buyList = data.items;
      else state.buyList = (state.buyList || []).filter((x) => !isSendBagItem(x));
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
      $btn.html(oldHtml).prop("disabled", sendBagItems().length === 0);
    }
  });

  const adminRequiredFields = [
    "#dm_created_time",
    "#dm_country",
    "#dm_warehouse",
    "#dm_order_number",
    "#dm_buyer",
    "#dm_payment",
  ];

  function fieldIsEmpty($el) {
    return !String($el.val() || "").trim();
  }

  function highlightMissingFields(selectors) {
    let ok = true;
    selectors.forEach((sel) => {
      const $el = $(sel);
      const missing = fieldIsEmpty($el);
      $el.toggleClass("validationElement", missing);
      if (missing) ok = false;
    });
    return ok;
  }

  $("#pane-buying").on("input change", adminRequiredFields.join(","), function () {
    $(this).toggleClass("validationElement", fieldIsEmpty($(this)));
  });

  function bassoConfirm(title, text) {
    return new Promise((resolve) => {
      const $box = $("#nobitaConfirm");
      $("#nobitaConfirmTitle").text(title);
      $("#nobitaConfirmText").text(text || "");
      $box.prop("hidden", false);
      const finish = (ok) => {
        $box.prop("hidden", true);
        $box.find(".js-ok, .js-cancel, .nobita-confirm-backdrop").off("click.nobitaConfirm");
        $(document).off("keydown.nobitaConfirm");
        resolve(ok);
      };
      $box.find(".js-ok").on("click.nobitaConfirm", () => finish(true));
      $box.find(".js-cancel, .nobita-confirm-backdrop").on("click.nobitaConfirm", () => finish(false));
      $(document).on("keydown.nobitaConfirm", (e) => {
        if (e.key === "Escape") finish(false);
        else if (e.key === "Enter") finish(true);
      });
      $box.find(".js-ok").trigger("focus");
    });
  }

  $("#btnCreateAdminOrder").on("click", async function () {
    if (!adminBagItems().length) return toast("Bạn chưa chọn sản phẩm");
    if (!highlightMissingFields(adminRequiredFields)) return;
    const confirmed = await bassoConfirm(
      "Xác nhận tạo đơn hàng",
      "Các sản phẩm sẽ được đánh dấu là đã mua"
    );
    if (!confirmed) return;

    const $btn = $(this);
    const oldHtml = $btn.html();
    $btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin"></i> Đang tạo…');
    toast("Đang tạo đơn Admin trên Basso…");
    try {
      const payload = collectAdminCreatePayload("dm");
      const res = await apiFetch("/api/basso/buy-list/create-admin-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        return toast(data.error || "Tạo đơn Admin thất bại", { error: true });
      }
      saveLastAdminCreate(payload);
      if (Array.isArray(data.items)) state.buyList = data.items;
      else state.buyList = (state.buyList || []).filter((x) => !isAdminBagItem(x));
      const sheetErr = data.sheetCheck && data.sheetCheck.error;
      toast(
        sheetErr
          ? `${data.message || "Tạo đơn hàng thành công"}. Excel: ${sheetErr}`
          : data.message || "Tạo đơn hàng thành công",
        sheetErr ? { error: true } : { success: true }
      );
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
      $btn.html(oldHtml).prop("disabled", adminBagItems().length === 0);
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

  $("#settingsPtttBody").on("input", ".js-pttt-url", function () {
    const url = String($(this).val() || "").trim();
    const $a = $(this).closest(".input-group").find(".js-open-sheet");
    $a.attr("href", /^https?:\/\//i.test(url) ? url : "#");
  });

  $("#settingsPtttBody").on("click", ".js-open-sheet", function (e) {
    const href = String($(this).attr("href") || "");
    if (!/^https?:\/\//i.test(href)) {
      e.preventDefault();
      toast("Chưa có link Sheet hợp lệ", { error: true });
    }
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

  loadAll({ clearBag: true }).catch((err) => {
    $("#emptyState").prop("hidden", false).text("Lỗi: " + err.message);
  });
});
