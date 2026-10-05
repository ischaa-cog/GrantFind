import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const root = process.cwd();
const outputDir = path.join(root, "deliverables");
const logoPath = path.join(root, "attached_assets", "Grant Find (Logo)_1754928189806.png");
const logo = (await fs.readFile(logoPath)).toString("base64");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Labor Day Premium Trial Claims Report | GrantFind</title>
  <style>
    @page { size: letter; margin: 0; }
    :root {
      --ink: #20242a;
      --muted: #68717b;
      --gold: #eab22b;
      --gold-soft: #fff4cf;
      --teal: #0f766e;
      --teal-soft: #e9f6f3;
      --navy: #25384a;
      --paper: #fbfaf7;
      --line: #dfe3e6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #d7dadd;
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      position: relative;
      width: 8.5in;
      height: 11in;
      overflow: hidden;
      padding: 0.55in 0.62in 0.52in;
      background: var(--paper);
    }
    .topbar {
      height: 0.09in;
      margin: -0.55in -0.62in 0.32in;
      background: var(--gold);
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.25in;
    }
    .logo { width: 1.52in; height: auto; display: block; }
    .eyebrow {
      color: var(--teal);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.7px;
      text-transform: uppercase;
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 {
      max-width: 6.8in;
      margin: 0 0 0.1in;
      font-size: 31px;
      line-height: 1.06;
      letter-spacing: -1.1px;
    }
    .dek {
      margin-bottom: 0.24in;
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.45;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.45in 1fr;
      gap: 0.2in;
      align-items: center;
      margin-bottom: 0.24in;
      padding: 0.2in 0.22in;
      border-left: 5px solid var(--gold);
      border-radius: 0 10px 10px 0;
      background: var(--gold-soft);
    }
    .hero .big {
      color: var(--teal);
      font-size: 38px;
      line-height: 1;
      font-weight: 800;
    }
    .hero .label {
      margin-top: 5px;
      color: #57616a;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .hero h2 { margin-bottom: 5px; font-size: 18px; }
    .hero p { margin: 0; color: #505963; font-size: 11px; line-height: 1.4; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.14in;
      margin-bottom: 0.24in;
    }
    .metric {
      min-height: 1.08in;
      padding: 0.15in;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: white;
    }
    .metric strong {
      display: block;
      margin-bottom: 5px;
      color: var(--navy);
      font-size: 23px;
      line-height: 1;
    }
    .metric span {
      display: block;
      color: var(--muted);
      font-size: 9.5px;
      line-height: 1.3;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 9px;
      margin: 0 0 0.11in;
      font-size: 17px;
    }
    .section-title:before {
      content: "";
      width: 0.09in;
      height: 0.24in;
      border-radius: 5px;
      background: var(--teal);
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.16in; }
    .card {
      padding: 0.16in 0.17in;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: white;
    }
    .card h3 { margin-bottom: 0.08in; color: var(--teal); font-size: 13px; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 0.12in;
      padding: 0.075in 0;
      border-bottom: 1px solid #edf0f1;
      color: #56606a;
      font-size: 10px;
    }
    .row:last-child { border-bottom: 0; }
    .row b { color: var(--ink); text-align: right; }
    .callout {
      margin-top: 0.18in;
      padding: 0.14in 0.16in;
      border-radius: 8px;
      background: var(--teal-soft);
      color: #285c58;
      font-size: 10.2px;
      line-height: 1.42;
    }
    .callout strong { color: var(--teal); }
    .method {
      margin-top: 0.18in;
      padding-top: 0.13in;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 9px;
      line-height: 1.42;
    }
    .footer {
      position: absolute;
      left: 0.62in;
      right: 0.62in;
      bottom: 0.25in;
      display: flex;
      justify-content: space-between;
      padding-top: 0.08in;
      border-top: 1px solid var(--line);
      color: #8b949c;
      font-size: 8.5px;
    }
    .footer b { color: var(--teal); }
  </style>
</head>
<body>
  <section class="page">
    <div class="topbar"></div>
    <div class="brand">
      <img class="logo" src="data:image/png;base64,${logo}" alt="GrantFind">
      <div class="eyebrow">Campaign performance report</div>
    </div>
    <div class="eyebrow">Labor Day bundle · Premium trial claims</div>
    <h1>2 of 107 bundles claimed.</h1>
    <p class="dek">Live Stripe activity for the private 30-day GrantFind Premium trial offer. Report generated September 14, 2026 at 9:22 PM IST.</p>

    <div class="hero">
      <div>
        <div class="big">1.9%</div>
        <div class="label">Claim rate</div>
      </div>
      <div>
        <h2>105 bundles remain unclaimed</h2>
        <p>Confirmed claims are completed Stripe Checkouts that created a subscription carrying the Labor Day campaign marker.</p>
      </div>
    </div>

    <div class="metrics">
      <div class="metric"><strong>2</strong><span>Confirmed Premium trial claims</span></div>
      <div class="metric"><strong>2</strong><span>Active trialing subscriptions</span></div>
      <div class="metric"><strong>0</strong><span>Trial cancellations to date</span></div>
      <div class="metric"><strong>2</strong><span>Monthly plans selected</span></div>
      <div class="metric"><strong>0</strong><span>Annual plans selected</span></div>
      <div class="metric"><strong>2</strong><span>Expired, abandoned Checkout sessions</span></div>
    </div>

    <h2 class="section-title">Current claim status</h2>
    <div class="grid-2">
      <div class="card">
        <h3>Claim 1</h3>
        <div class="row"><span>Checkout completed</span><b>Sep 10, 2026 · 3:43 AM IST</b></div>
        <div class="row"><span>Plan</span><b>Monthly</b></div>
        <div class="row"><span>Status</span><b>Trialing · active</b></div>
        <div class="row"><span>Scheduled cancellation</span><b>No</b></div>
        <div class="row"><span>Trial ends</span><b>Oct 10, 2026 · 3:44 AM IST</b></div>
      </div>
      <div class="card">
        <h3>Claim 2</h3>
        <div class="row"><span>Checkout completed</span><b>Sep 10, 2026 · 10:47 PM IST</b></div>
        <div class="row"><span>Plan</span><b>Monthly</b></div>
        <div class="row"><span>Status</span><b>Trialing · active</b></div>
        <div class="row"><span>Scheduled cancellation</span><b>No</b></div>
        <div class="row"><span>Trial ends</span><b>Oct 10, 2026 · 10:48 PM IST</b></div>
      </div>
    </div>

    <div class="callout"><strong>What to watch next:</strong> Both claims are still inside their 30-day trial window, so there are no paid conversions yet. Review the subscriptions after October 10 to measure conversion, cancellation, and first successful payment.</div>

    <p class="method"><b>Methodology:</b> Stripe was queried in live mode for Checkout sessions and subscriptions tagged with campaign <b>labor-day-bundle-2026</b>. Completed Checkouts with a created subscription count as claims. Expired Checkout sessions do not count as claims. Financial conversion should be counted only after a successful paid Stripe invoice.</p>
    <div class="footer"><span><b>GRANTFIND</b> · Labor Day Premium Trial Claims</span><span>01</span></div>
  </section>
</body>
</html>`;

await fs.mkdir(outputDir, { recursive: true });
const htmlPath = path.join(outputDir, "labor-day-premium-trial-claims-report.html");
const pdfPath = path.join(outputDir, "labor-day-premium-trial-claims-report.pdf");
await fs.writeFile(htmlPath, html);

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.pdf({
  path: pdfPath,
  format: "Letter",
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();

console.log(`Created ${htmlPath}`);
console.log(`Created ${pdfPath}`);