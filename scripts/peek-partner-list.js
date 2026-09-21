const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "data");

function load(name) {
  let t = fs.readFileSync(path.join(dir, name), "utf8");
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return JSON.parse(t);
}

function peek(name) {
  const j = load(`partner-create-list-${name}.json`);
  const d = j.data || {};
  console.log("===", name, "===");
  console.log(
    "tab=",
    d.tab,
    "total_pending=",
    d.total_pending,
    "orders=",
    (d.orders || []).length,
    "items=",
    (d.items || []).length
  );
  console.log("pagination=", JSON.stringify(d.pagination));
  console.log("websites=", JSON.stringify(d.websites));
  if (d.orders && d.orders[0]) {
    console.log("order0 keys=", Object.keys(d.orders[0]).join(", "));
    console.log("order0=", JSON.stringify(d.orders[0], null, 2).slice(0, 1800));
  }
  if (d.items && d.items[0]) {
    console.log("item0 keys=", Object.keys(d.items[0]).join(", "));
    console.log("item0=", JSON.stringify(d.items[0], null, 2).slice(0, 1400));
  }
  console.log("");
}

["order", "checkout", "need_handle"].forEach(peek);
