/**
 * Map hostname / brand → Bright Data dataset_id
 */
const DATASETS = [
  { id: "adidas", datasetId: "gd_ml5c00bomtfxs56vl", hosts: ["adidas.com", "www.adidas.com"] },
  {
    id: "bloomingdales",
    datasetId: "c_mrxccb6m18kddhsuwy",
    hosts: ["bloomingdales.com", "www.bloomingdales.com"],
  },
  {
    id: "calvinklein",
    datasetId: "c_mrx8qbhizk3wzjh76",
    hosts: ["calvinklein.us", "www.calvinklein.us", "calvinklein.com", "www.calvinklein.com"],
  },
  {
    id: "carters",
    datasetId: "c_mrncxbid1m4hl7mk3b",
    hosts: ["carters.com", "www.carters.com"],
  },
  { id: "coach", datasetId: "c_mrnd77mmza0gnemgj", hosts: ["coach.com", "www.coach.com"] },
  {
    id: "coachoutlet",
    datasetId: "c_mrnd77mmza0gnemgj",
    hosts: ["coachoutlet.com", "www.coachoutlet.com"],
  },
  {
    id: "dickssportinggoods",
    datasetId: "c_mrofw5f417vagp9cac",
    hosts: ["dickssportinggoods.com", "www.dickssportinggoods.com"],
  },
  {
    id: "lacoste",
    datasetId: "c_mromlhzi4nnd2z3cu",
    hosts: ["lacoste.com", "www.lacoste.com", "us.lacoste.com"],
  },
  {
    id: "levi",
    datasetId: "c_mromuius2ktolq0kyj",
    hosts: ["levi.com", "www.levi.com"],
  },
  {
    id: "lululemon",
    datasetId: "c_mrvsdvjd26det4qa6q",
    hosts: ["lululemon.com", "www.lululemon.com", "shop.lululemon.com"],
  },
  { id: "macys", datasetId: "c_mronlruj22vjb6jm2c", hosts: ["macys.com", "www.macys.com"] },
  {
    id: "marshalls",
    datasetId: "c_mronrc7i7yhmd4eyy",
    hosts: ["marshalls.com", "www.marshalls.com"],
  },
  {
    id: "ralphlauren",
    datasetId: "c_mroorovs107qus1t9u",
    hosts: ["ralphlauren.com", "www.ralphlauren.com"],
  },
  { id: "ssense", datasetId: "gd_mptnxfgm1ily0m3u1r", hosts: ["ssense.com", "www.ssense.com"] },
  {
    id: "tjmaxx",
    datasetId: "c_mroqjm191segd51351",
    hosts: ["tjmaxx.tjx.com", "tjmaxx.com", "www.tjmaxx.com"],
  },
  {
    id: "tommy",
    datasetId: "c_mroquuh313m9794y6y",
    hosts: ["usa.tommy.com", "tommy.com", "www.tommy.com"],
  },
  {
    id: "wilson",
    datasetId: "c_mroqxwceo81y8c83m",
    hosts: ["wilson.com", "www.wilson.com"],
  },
  { id: "puma", datasetId: "c_mrt2gvpdesf795dop", hosts: ["puma.com", "us.puma.com", "www.puma.com"] },
  { id: "ebay", datasetId: "gd_ltr9mjt81n0zzdk1fb", hosts: ["ebay.com", "www.ebay.com"] },
  {
    id: "amazon",
    datasetId: "gd_l7q7dkf244hwjntr0",
    hosts: ["amazon.com", "www.amazon.com", "a.co"],
  },
  {
    id: "walmart",
    datasetId: "gd_l95fol7l1ru6rlo116",
    hosts: ["walmart.com", "www.walmart.com"],
  },
  {
    id: "nordstrom",
    datasetId: "gd_mljj1g2v1vpljytki5",
    hosts: ["nordstrom.com", "www.nordstrom.com"],
  },
  { id: "zara", datasetId: "gd_lct4vafw1tgx27d4o0", hosts: ["zara.com", "www.zara.com"] },
  {
    id: "oldnavy",
    datasetId: "c_mrua5r881k84p85b2q",
    hosts: ["oldnavy.gap.com", "oldnavy.com", "www.oldnavy.com"],
  },
  { id: "dsw", datasetId: "c_mruav2s22lj69181y4", hosts: ["dsw.com", "www.dsw.com"] },
  {
    id: "victoriassecret",
    datasetId: "c_mrubrcz11bx1n8jtcz",
    hosts: ["victoriassecret.com", "www.victoriassecret.com"],
  },
  {
    id: "jomashop",
    datasetId: "c_mruchbos699vz6g00",
    hosts: ["jomashop.com", "www.jomashop.com"],
  },
];

function resolveDataset(productUrl) {
  let hostname;
  try {
    hostname = new URL(productUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  const exact = DATASETS.find((d) => d.hosts.includes(hostname));
  if (exact) return exact;

  const fuzzy = DATASETS.find((d) =>
    d.hosts.some((h) => hostname === h || hostname.endsWith("." + h.replace(/^www\./, "")))
  );
  if (fuzzy) return fuzzy;

  return DATASETS.find((d) => {
    const key = d.id.replace(/outlet$/, "");
    return hostname.includes(key) || hostname.includes(d.id);
  });
}

function listDatasets() {
  return DATASETS.map(({ id, datasetId, hosts }) => ({ id, datasetId, hosts }));
}

module.exports = { DATASETS, resolveDataset, listDatasets };
