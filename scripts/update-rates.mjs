// Reads the live rates from charafchange.com (JS-rendered table) and writes rates.json
// Run: node scripts/update-rates.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const SOURCE = "https://www.charafchange.com/#cours";
const CODES = ["EUR", "USD", "CAD", "GBP", "SAR", "AED", "CHF"];
// Optional margin in MAD added to the copied price (0 = exact copy). Example: BUY_OFFSET=-0.02 SELL_OFFSET=0.02
const BUY_OFFSET = Number(process.env.BUY_OFFSET || 0);
const SELL_OFFSET = Number(process.env.SELL_OFFSET || 0);
const FILE = "rates.json";

const num = (s) => parseFloat(String(s).replace(",", "."));
const round3 = (n) => Math.round(n * 1000) / 1000;

const browser = await chromium.launch();
const page = await browser.newPage({ locale: "fr-FR" });
const jsonSeen = [];
page.on("response", async (r) => {
  try {
    if ((r.headers()["content-type"] || "").includes("json")) jsonSeen.push(r.url());
  } catch {}
});

await page.goto(SOURCE, { waitUntil: "networkidle", timeout: 60000 });
// wait until the "Chargement des cours…" placeholder disappears
await page.waitForFunction(() => !document.body.innerText.includes("Chargement des cours"), null, { timeout: 30000 }).catch(() => {});

const rows = await page.evaluate((codes) => {
  const out = {};
  const els = document.querySelectorAll("tr, [class*='row'], li, div");
  for (const el of els) {
    const text = (el.innerText || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 120) continue; // only small, row-like elements
    const code = codes.find((c) => new RegExp("\\b" + c + "\\b").test(text));
    if (!code || out[code]) continue;
    const nums = text.match(/\d+[.,]\d{2,4}/g);
    if (nums && nums.length >= 2) out[code] = nums.slice(0, 2);
  }
  return out;
}, CODES);

await browser.close();

const found = Object.keys(rows);
if (found.length < 3) {
  console.error("Parsed only", found, "- keeping the old rates.json. JSON endpoints seen:", jsonSeen);
  process.exit(1);
}

const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { rates: {} };
const today = new Date().toISOString().slice(0, 10);
const next = { updated: new Date().toISOString(), source: SOURCE, rates: {} };

for (const code of found) {
  let buy = num(rows[code][0]);
  let sell = num(rows[code][1]);
  if (!(buy > 0.5 && buy < 30 && sell > 0.5 && sell < 30)) {
    console.error("Suspicious value for", code, rows[code], "- skipped");
    if (old.rates[code]) next.rates[code] = old.rates[code];
    continue;
  }
  buy = round3(buy + BUY_OFFSET);
  sell = round3(sell + SELL_OFFSET);
  const o = old.rates[code] || {};
  const changed = o.buy !== undefined && (o.buy !== buy || o.sell !== sell);
  let history = o.history && o.history.length === 7 ? [...o.history] : Array(7).fill(buy);
  if (o.lastDate && o.lastDate !== today) history = [...history.slice(1), buy];
  else history[6] = buy;
  next.rates[code] = {
    buy, sell,
    prevBuy: changed ? o.buy : (o.prevBuy ?? buy),
    prevSell: changed ? o.sell : (o.prevSell ?? sell),
    history, lastDate: today,
  };
}
// keep currencies that weren't found today
for (const code of CODES) if (!next.rates[code] && old.rates[code]) next.rates[code] = old.rates[code];

fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
console.log("rates.json updated:", found.join(", "));
