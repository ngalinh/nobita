const { resolveDataset } = require("./brightdata-datasets");

const V3_BASE = "https://api.brightdata.com/datasets/v3";
const DCA_BASE = "https://api.brightdata.com/dca";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function authHeaders(apiToken) {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };
}

async function readBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      try {
        return lines.map((l) => JSON.parse(l));
      } catch {
        /* fallthrough */
      }
    }
    // Plain-text error from Bright Data, e.g. "dataset does not exist"
    return { __plain: true, message: text.trim() };
  }
}

function isCollectorId(id) {
  return String(id || "").startsWith("c_");
}

/**
 * Scraper Studio collectors (c_*): POST /dca/trigger?collector=... then poll /dca/dataset
 */
async function scrapeViaDca(productUrl, apiToken, collectorId) {
  const triggerUrl = `${DCA_BASE}/trigger?collector=${encodeURIComponent(
    collectorId
  )}&queue_next=1`;

  const triggerRes = await fetch(triggerUrl, {
    method: "POST",
    headers: authHeaders(apiToken),
    body: JSON.stringify([{ url: productUrl }]),
  });
  const triggerBody = await readBody(triggerRes);

  if (triggerBody && triggerBody.__plain) {
    throw new Error(triggerBody.message);
  }
  if (!triggerRes.ok) {
    throw new Error(
      `DCA trigger lỗi (${triggerRes.status}): ${JSON.stringify(triggerBody).slice(0, 400)}`
    );
  }

  const collectionId = triggerBody.collection_id || triggerBody.snapshot_id;
  if (!collectionId) {
    throw new Error("DCA không trả collection_id: " + JSON.stringify(triggerBody).slice(0, 300));
  }

  const maxWaitMs = 300000;
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const dsRes = await fetch(`${DCA_BASE}/dataset?id=${encodeURIComponent(collectionId)}`, {
      headers: authHeaders(apiToken),
    });
    const dsBody = await readBody(dsRes);

    if (dsBody && dsBody.__plain) {
      throw new Error(dsBody.message);
    }

    if (Array.isArray(dsBody)) {
      if (!dsBody.length) {
        // empty array can mean not ready yet OR no rows — docs say ready = non-empty array
        // keep polling a bit; if still empty near end, return empty
        if (Date.now() - started > maxWaitMs - 10000) {
          return { records: [], collectionId };
        }
      } else {
        return { records: dsBody, collectionId };
      }
    }

    if (dsBody && (dsBody.status === "failed" || dsBody.error)) {
      throw new Error(
        `DCA job failed: ${dsBody.error || dsBody.status || JSON.stringify(dsBody).slice(0, 200)}`
      );
    }

    await sleep(5000);
  }

  throw new Error(`DCA timeout sau ${maxWaitMs / 1000}s (collection ${collectionId})`);
}

/**
 * Marketplace scrapers (gd_*): POST /datasets/v3/scrape
 */
async function scrapeViaV3(productUrl, apiToken, datasetId) {
  const endpoint = `${V3_BASE}/scrape?dataset_id=${encodeURIComponent(
    datasetId
  )}&format=json&include_errors=true`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: authHeaders(apiToken),
    body: JSON.stringify([{ url: productUrl }]),
  });

  const body = await readBody(res);
  if (body && body.__plain) {
    throw new Error(body.message);
  }

  if (res.status === 401 || res.status === 403) {
    const err = new Error(`Bright Data auth lỗi (${res.status})`);
    err.body = body;
    throw err;
  }

  let records = body;
  let snapshotId = null;

  if (res.status === 202 || (body && body.snapshot_id && !Array.isArray(body))) {
    snapshotId = body.snapshot_id;
    records = await pollV3Snapshot(apiToken, snapshotId);
  } else if (!res.ok) {
    throw new Error(`V3 scrape lỗi (${res.status}): ${JSON.stringify(body).slice(0, 400)}`);
  }

  if (!Array.isArray(records)) {
    records = records ? [records] : [];
  }

  return { records, collectionId: snapshotId };
}

async function pollV3Snapshot(apiToken, snapshotId, { maxWaitMs = 180000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const progRes = await fetch(`${V3_BASE}/progress/${snapshotId}`, {
      headers: authHeaders(apiToken),
    });
    const prog = await readBody(progRes);
    if (prog && prog.__plain) throw new Error(prog.message);
    const status = prog && prog.status;

    if (status === "ready") break;
    if (status === "failed" || status === "canceled") {
      throw new Error(`Bright Data snapshot ${status}`);
    }
    await sleep(5000);
  }

  const snapRes = await fetch(`${V3_BASE}/snapshot/${snapshotId}?format=json`, {
    headers: authHeaders(apiToken),
  });
  const body = await readBody(snapRes);
  if (body && body.__plain) throw new Error(body.message);
  if (!snapRes.ok) {
    throw new Error(`Download snapshot thất bại (${snapRes.status})`);
  }
  return body;
}

/**
 * Auto-route:
 * - c_*  → Scraper Studio DCA API
 * - gd_* → Datasets v3 API
 */
async function scrapeWithBrightData(productUrl, apiToken) {
  const match = resolveDataset(productUrl);
  if (!match) {
    return {
      ok: false,
      error: "Không map được retailer → dataset Bright Data. Kiểm tra domain hoặc thêm mapping.",
    };
  }
  if (!apiToken) {
    return {
      ok: false,
      error: "Thiếu Bright Data API token (BRIGHTDATA_API_TOKEN hoặc nhập trên UI).",
      retailer: match.id,
      datasetId: match.datasetId,
    };
  }

  const startedAt = Date.now();
  const engine = isCollectorId(match.datasetId) ? "brightdata-dca" : "brightdata-v3";

  try {
    const { records, collectionId } = isCollectorId(match.datasetId)
      ? await scrapeViaDca(productUrl, apiToken, match.datasetId)
      : await scrapeViaV3(productUrl, apiToken, match.datasetId);

    if (!records.length) {
      return {
        ok: false,
        error: "Bright Data không trả về record nào.",
        engine,
        retailer: match.id,
        datasetId: match.datasetId,
        snapshotId: collectionId,
      };
    }

    const first = records[0];
    if (first.error || first.error_code || first.warning_code) {
      return {
        ok: false,
        error: `Bright Data record error: ${first.error || first.error_code || first.warning_code}`,
        engine,
        retailer: match.id,
        datasetId: match.datasetId,
        snapshotId: collectionId,
        raw: first,
      };
    }

    const product = normalizeBrightDataProduct(first, productUrl);

    return {
      ok: true,
      engine,
      retailer: match.id,
      datasetId: match.datasetId,
      snapshotId: collectionId,
      sourceUrl: productUrl,
      scrapedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      product,
      raw: first,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || String(err),
      engine,
      retailer: match.id,
      datasetId: match.datasetId,
    };
  }
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
    if (k.includes(".")) {
      const parts = k.split(".");
      let cur = obj;
      for (const p of parts) {
        if (cur == null) break;
        cur = cur[p];
      }
      if (cur != null && cur !== "") return cur;
    }
  }
  return null;
}

function asList(v) {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (typeof x === "string") return x.trim();
        if (x && typeof x === "object") {
          return String(x.name || x.label || x.value || x.size || x.color || "").trim();
        }
        return String(x).trim();
      })
      .filter(Boolean);
  }
  if (typeof v === "string") {
    return v
      .split(/[,|/]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [String(v)];
}

function parsePriceValue(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return raw;
  if (typeof raw === "object") {
    const nested = raw.value ?? raw.amount ?? raw.price ?? raw.current;
    return parsePriceValue(nested);
  }
  const digits = String(raw).replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isNaN(n) ? null : n;
}

function normalizeBrightDataProduct(row, fallbackUrl) {
  const name = pick(row, [
    "title",
    "name",
    "product_name",
    "product_title",
    "item_name",
  ]);
  const sku = pick(row, ["sku", "product_id", "asin", "upc", "model_number", "id"]);
  const price = parsePriceValue(
    pick(row, [
      "final_price",
      "price",
      "current_price",
      "sale_price",
      "list_price",
      "price_value",
      "product_price",
    ])
  );
  const currency = pick(row, ["currency", "currency_code"]) || "USD";

  const sizes = asList(
    pick(row, ["sizes", "size_list", "available_sizes", "variants_sizes", "size_options"])
  );
  const colors = asList(
    pick(row, ["colors", "color_list", "available_colors", "colour", "colours", "color_options"])
  );
  const size =
    pick(row, ["size", "selected_size", "variant_size"]) || sizes[0] || "";
  const color =
    pick(row, ["color", "colour", "selected_color", "variant_color"]) || colors[0] || "";

  const availability = String(
    pick(row, [
      "availability",
      "availability_status",
      "stock_status",
      "inventory_status",
      "in_stock",
      "is_available",
      "available",
    ]) ?? ""
  );

  const stockRaw = pick(row, ["stock", "quantity", "qty", "inventory", "stock_quantity"]);
  let stock = null;
  if (stockRaw != null && stockRaw !== "") {
    const n = Number(String(stockRaw).replace(/[^\d]/g, ""));
    stock = Number.isNaN(n) ? null : n;
  }

  const inStockExplicit =
    availability === true ||
    /^(true|1|yes|in.?stock|available|còn hàng)$/i.test(String(availability));
  const outStockExplicit =
    availability === false ||
    /^(false|0|no|out.?of.?stock|sold.?out|unavailable|hết hàng)$/i.test(
      String(availability)
    );

  let inStock;
  if (stock != null) inStock = stock > 0;
  else if (outStockExplicit) inStock = false;
  else if (inStockExplicit) inStock = true;
  else inStock = price != null;

  if (stock == null) stock = inStock ? 1 : 0;

  return {
    name: name ? String(name).trim() : "",
    sku: sku ? String(sku).trim() : "",
    price,
    priceRaw: pick(row, ["final_price", "price", "current_price"]) || "",
    currency: String(currency),
    size: String(size || ""),
    color: String(color || ""),
    sizes,
    colors,
    stock,
    stockStatus: inStock ? "in_stock" : "out_of_stock",
    inStock,
    url: pick(row, ["url", "input.url", "product_url"]) || fallbackUrl,
  };
}

module.exports = {
  scrapeWithBrightData,
  normalizeBrightDataProduct,
  resolveDataset,
  isCollectorId,
};
