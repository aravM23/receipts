import { createRequire } from "node:module";
const require = createRequire("/Users/aravmathur/Desktop/Stan/cards/node_modules/");
const { chromium } = require("playwright");

const url = process.argv[2] || "http://localhost:3007/preview";
const out = process.argv[3] || "/tmp/receipt-preview.png";
const width = Number(process.env.VW || process.argv[4] || 520);
const height = Number(process.env.VH || process.argv[5] || 1100);
const fullPage = process.env.FULL === "1";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage });
await browser.close();
console.log("saved", out);
