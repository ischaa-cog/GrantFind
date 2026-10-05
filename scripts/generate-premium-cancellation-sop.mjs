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
  <title>Premium Member Cancellation SOP | GrantFind</title>
  <style>
    @page { size: letter; margin: 0; }
    :root {
      --ink: #20242a;
      --muted: #68717b;
      --gold: #eab22b;
      --gold-soft: #fff4cf;
      --teal: #0f766e;
      --teal-dark: #075e59;
      --teal-soft: #e9f6f3;
      --coral: #c75b44;
      --coral-soft: #fff0ec;
      --paper: #fbfaf7;
      --line: #dfe3e6;
      --navy: #25384a;
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
      padding: 0.55in 0.62in 0.54in;
      background: var(--paper);
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
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
      margin: 0 0 0.12in;
      font-size: 32px;
      line-height: 1.06;
      letter-spacing: -1.2px;
    }
    .dek {
      max-width: 6.8in;
      margin-bottom: 0.25in;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.25in 1fr;
      gap: 0.18in;
      align-items: start;
      margin: 0.2in 0 0.25in;
      padding: 0.18in 0.2in;
      background: var(--gold-soft);
      border-left: 5px solid var(--gold);
      border-radius: 0 10px 10px 0;
    }
    .hero strong {
      color: var(--teal);
      font-size: 11px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .hero p { margin: 0; font-size: 16px; line-height: 1.3; font-weight: 700; }
    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 0 0.12in;
      font-size: 18px;
      letter-spacing: -0.3px;
    }
    .section-title .num {
      display: inline-grid;
      place-items: center;
      width: 0.28in;
      height: 0.28in;
      flex: 0 0 auto;
      border-radius: 50%;
      background: var(--teal);
      color: white;
      font-size: 12px;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.16in; }
    .card {
      padding: 0.16in 0.17in;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: white;
    }
    .card h3 { margin-bottom: 0.07in; font-size: 13px; }
    .card p, .card li {
      color: #424b54;
      font-size: 10.2px;
      line-height: 1.4;
    }
    ul { margin: 0; padding-left: 0.18in; }
    li { margin-bottom: 0.06in; }
    .mini-label {
      margin-bottom: 0.07in;
      color: var(--muted);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.1px;
      text-transform: uppercase;
    }
    .do h3 { color: var(--teal); }
    .dont h3 { color: var(--coral); }
    .callout {
      margin-top: 0.15in;
      padding: 0.13in 0.15in;
      border-radius: 8px;
      background: var(--teal-soft);
      color: #285c58;
      font-size: 10.2px;
      line-height: 1.42;
    }
    .callout strong { color: var(--teal); }
    .warning {
      margin-top: 0.15in;
      padding: 0.13in 0.15in;
      border-left: 4px solid var(--coral);
      border-radius: 0 8px 8px 0;
      background: var(--coral-soft);
      color: #714638;
      font-size: 10.2px;
      line-height: 1.42;
    }
    .warning strong { color: var(--coral); }
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
    .step {
      display: grid;
      grid-template-columns: 0.34in 1fr;
      gap: 0.12in;
      align-items: start;
      margin-bottom: 0.13in;
    }
    .step:last-child { margin-bottom: 0; }
    .step-num {
      display: grid;
      place-items: center;
      width: 0.32in;
      height: 0.32in;
      border-radius: 50%;
      background: var(--gold);
      color: #493700;
      font-size: 12px;
      font-weight: 700;
    }
    .step h3 { margin: 0 0 3px; font-size: 12.5px; }
    .step p { margin: 0; color: #59636d; font-size: 10.2px; line-height: 1.4; }
    .path {
      margin-top: 0.06in;
      padding: 0.09in 0.12in;
      border-left: 3px solid var(--gold);
      background: #fffaf0;
      color: #59636d;
      font-size: 9.8px;
      line-height: 1.35;
    }
    .path b { color: var(--navy); }
    .status-card {
      padding: 0.14in 0.16in;
      border-radius: 9px;
      background: var(--navy);
      color: white;
    }
    .status-card h3 { margin-bottom: 0.06in; color: var(--gold); font-size: 13px; }
    .status-card p { margin: 0; color: #e5edf2; font-size: 10.2px; line-height: 1.4; }
    .status-card b { color: white; }
    .checklist { margin: 0; padding: 0; list-style: none; }
    .checklist li {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      margin: 0 0 0.075in;
      color: #424b54;
      font-size: 10.2px;
      line-height: 1.32;
    }
    .box {
      width: 13px;
      height: 13px;
      flex: 0 0 13px;
      margin-top: 1px;
      border: 1.5px solid #8c969d;
      border-radius: 3px;
      background: white;
    }
    .tag-pill {
      display: inline-block;
      padding: 3px 7px;
      border-radius: 999px;
      background: var(--coral-soft);
      color: var(--coral);
      font-size: 9px;
      font-weight: 700;
    }
    .quote {
      margin: 0.12in 0 0;
      padding: 0.13in 0.15in;
      border: 1px solid #c9e5df;
      border-radius: 8px;
      background: var(--teal-soft);
      color: #285c58;
      font-size: 10px;
      line-height: 1.42;
    }
    .fine { color: var(--muted); font-size: 8.8px; line-height: 1.3; }
    .page-2 h1, .page-3 h1 { font-size: 29px; }
    .page-2 .dek, .page-3 .dek { margin-bottom: 0.18in; }
    .page-3 .hero { margin-top: 0.15in; margin-bottom: 0.2in; }
  </style>
</head>
<body>
  <section class="page">
    <div class="topbar"></div>
    <div class="brand">
      <img class="logo" src="data:image/png;base64,${logo}" alt="GrantFind">
      <div class="eyebrow">Internal operations guide</div>
    </div>
    <div class="eyebrow">Premium member cancellation SOP</div>
    <h1>Cancel cleanly. Close the loop.</h1>
    <p class="dek">Use this procedure whenever a GrantFind Premium member asks to cancel. The goal is to stop future billing, apply the correct access outcome, remove the member’s premium tag in GHL, and leave a clear record.</p>

    <div class="hero">
      <strong>End state</strong>
      <p>Stripe is cancelled correctly, the member knows what happens next, and the GHL premium tag is removed.</p>
    </div>

    <h2 class="section-title"><span class="num">1</span>Before you make a change</h2>
    <div class="grid-2">
      <div class="card">
        <div class="mini-label">Confirm the request</div>
        <ul class="checklist">
          <li><span class="box"></span><span>Confirm the member’s full name and account email.</span></li>
          <li><span class="box"></span><span>Confirm they want to cancel Premium—not delete their account.</span></li>
          <li><span class="box"></span><span>Check whether they are in a paid subscription or a free trial.</span></li>
          <li><span class="box"></span><span>Record the date, time, and channel of the request.</span></li>
        </ul>
      </div>
      <div class="card dont">
        <div class="mini-label">Do not</div>
        <ul>
          <li>Delete the user account to cancel billing.</li>
          <li>Change subscription fields directly in the database.</li>
          <li>Promise a refund before checking the Stripe payment record.</li>
          <li>Remove the GHL tag before confirming the correct contact.</li>
        </ul>
      </div>
    </div>

    <div class="callout"><strong>Identity check:</strong> Search by the exact account email. If the member contacts you from a different email, verify enough account details to avoid cancelling the wrong customer.</div>

    <h2 class="section-title" style="margin-top:.23in"><span class="num">2</span>Know which outcome applies</h2>
    <div class="grid-2">
      <div class="status-card">
        <h3>Paid Premium member</h3>
        <p>Cancellation ends the Stripe subscription and the member <b>loses Pro access immediately</b>. They should not be charged for a future renewal.</p>
      </div>
      <div class="status-card">
        <h3>Premium trial member</h3>
        <p>Cancellation prevents the trial from converting to a charge. The member <b>keeps Premium access through the trial end date</b>.</p>
      </div>
    </div>

    <div class="warning"><strong>Important:</strong> The paid and trial paths are not interchangeable. Always confirm the status before clicking Cancel.</div>
    <div class="footer"><span><b>GRANTFIND</b> · Premium Member Cancellation SOP</span><span>01</span></div>
  </section>

  <section class="page page-2">
    <div class="topbar"></div>
    <div class="brand">
      <img class="logo" src="data:image/png;base64,${logo}" alt="GrantFind">
      <div class="eyebrow">Stripe & account steps</div>
    </div>
    <div class="eyebrow">Complete the cancellation</div>
    <h1>Follow the right cancellation path.</h1>
    <p class="dek">Use the member’s account to make the change whenever possible. This keeps Stripe, GrantFind, and the confirmation email in sync.</p>

    <h2 class="section-title"><span class="num">3</span>Paid Premium: step by step</h2>
    <div class="card">
      <div class="step">
        <div class="step-num">1</div>
        <div><h3>Open the member’s GrantFind profile</h3><p>Have the member sign in, open <b>Profile</b>, and choose <b>Manage Subscription</b>. If you are assisting them, use the approved support/admin process—never ask for their password.</p><div class="path"><b>GrantFind:</b> Profile → Manage Subscription → Cancel My Subscription</div></div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div><h3>Confirm the warning</h3><p>Make sure the member understands that paid cancellation removes Pro features and AI tools immediately. Ask them to confirm before proceeding.</p></div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div><h3>Verify the result</h3><p>Wait for the success message. Re-open the profile if needed and confirm the account no longer shows an active Premium subscription.</p></div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div><h3>Confirm Stripe status if assisting manually</h3><p>In Stripe, search the exact customer email and confirm the subscription is cancelled. Check that there is no future renewal scheduled.</p><div class="path"><b>Stripe:</b> Customers → search email → open customer → Subscriptions → verify Cancelled</div></div>
      </div>
    </div>

    <h2 class="section-title" style="margin-top:.2in"><span class="num">4</span>Premium Trial: step by step</h2>
    <div class="card">
      <div class="step">
        <div class="step-num">1</div>
        <div><h3>Open Profile → Manage Subscription</h3><p>Confirm the account shows a Premium trial and note the displayed trial end date.</p></div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div><h3>Select Cancel My Trial</h3><p>Confirm the member understands that the saved card will not be charged, while Premium access continues through the trial end date.</p></div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div><h3>Verify Stripe shows cancellation at period end</h3><p>The subscription should remain trialing until the trial end, with cancellation scheduled and no conversion charge expected.</p><div class="path"><b>Stripe:</b> Customers → search email → open customer → Subscriptions → verify trial end and cancellation at period end</div></div>
      </div>
    </div>

    <div class="quote"><b>Member-facing wording:</b> “Your cancellation is confirmed. Your Premium access will remain available until [date]. Your saved card will not be charged for the trial.”</div>
    <div class="footer"><span><b>GRANTFIND</b> · Premium Member Cancellation SOP</span><span>02</span></div>
  </section>

  <section class="page page-3">
    <div class="topbar"></div>
    <div class="brand">
      <img class="logo" src="data:image/png;base64,${logo}" alt="GrantFind">
      <div class="eyebrow">GHL & closeout</div>
    </div>
    <div class="eyebrow">Remove the premium tag</div>
    <h1>Finish in GHL, then document it.</h1>
    <p class="dek">The Stripe cancellation is not complete operationally until the matching GoHighLevel contact is untagged and the outcome is recorded.</p>

    <div class="hero">
      <strong>Required</strong>
      <p>Remove the member’s active Premium tag from the correct GHL contact before closing the request.</p>
    </div>

    <h2 class="section-title"><span class="num">5</span>Untag the member in GHL</h2>
    <div class="card">
      <div class="step">
        <div class="step-num">1</div>
        <div><h3>Open GoHighLevel</h3><p>Go to <b>Contacts</b> and search using the same email confirmed in GrantFind and Stripe.</p><div class="path"><b>GHL:</b> Contacts → search exact email → open the matching contact</div></div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div><h3>Verify the contact</h3><p>Match the name and email. If multiple contacts appear, stop and resolve the duplicate before changing any tag.</p></div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div><h3>Remove the active premium tag</h3><p>In the contact’s <b>Tags</b> area, remove the tag used for active Premium members.</p><div class="path"><b>Tag to remove:</b> <span class="tag-pill">Premium / GrantFind Pro active tag</span><br><span class="fine">Use the exact active-member tag configured in your GHL account. Do not remove unrelated campaign, lead-source, or customer tags.</span></div></div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div><h3>Confirm it is gone</h3><p>Refresh the contact or reopen the Tags panel and verify the active Premium tag no longer appears. Take a screenshot only if your team’s records policy requires it.</p></div>
      </div>
    </div>

    <h2 class="section-title" style="margin-top:.2in"><span class="num">6</span>Close out the request</h2>
    <div class="grid-2">
      <div class="card">
        <div class="mini-label">Final checklist</div>
        <ul class="checklist">
          <li><span class="box"></span><span>Correct member and email confirmed.</span></li>
          <li><span class="box"></span><span>Stripe cancellation status verified.</span></li>
          <li><span class="box"></span><span>Access outcome explained to member.</span></li>
          <li><span class="box"></span><span>Active Premium tag removed in GHL.</span></li>
          <li><span class="box"></span><span>Request date and outcome recorded.</span></li>
        </ul>
      </div>
      <div class="card do">
        <div class="mini-label">Record this note</div>
        <p><b>Cancelled Premium — [date]</b><br>
        Member: [name]<br>
        Email: [email]<br>
        Type: [paid / trial]<br>
        Access ends: [immediately / date]<br>
        GHL active Premium tag removed: [yes]</p>
      </div>
    </div>

    <div class="warning"><strong>Escalate instead of guessing:</strong> Stripe and GrantFind disagree, the account has duplicate GHL contacts, a refund is requested, or the member says they were charged after cancellation. Preserve the details and send the case to the person responsible for billing.</div>
    <p class="fine" style="margin-top:.14in">This SOP covers cancellation handling. It does not authorize refunds, account deletion, password access, or changes to the GHL tag taxonomy.</p>
    <div class="footer"><span><b>GRANTFIND</b> · Premium Member Cancellation SOP</span><span>03</span></div>
  </section>
</body>
</html>`;

await fs.mkdir(outputDir, { recursive: true });
const htmlPath = path.join(outputDir, "premium-member-cancellation-sop.html");
const pdfPath = path.join(outputDir, "premium-member-cancellation-sop.pdf");
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