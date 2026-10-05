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
  <title>Grant Proposal Cheat Sheet | GrantFind</title>
  <style>
    @page { size: letter; margin: 0; }
    :root {
      --ink: #20242a;
      --muted: #68717b;
      --gold: #eab22b;
      --gold-soft: #fff4cf;
      --teal: #0f766e;
      --teal-soft: #e9f6f3;
      --coral: #c75b44;
      --coral-soft: #fff0ec;
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
      margin-bottom: 0.26in;
    }
    .logo {
      width: 1.52in;
      height: auto;
      display: block;
      filter: none;
    }
    .eyebrow {
      color: var(--teal);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.7px;
      text-transform: uppercase;
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 {
      max-width: 6.7in;
      margin: 0 0 0.12in;
      font-size: 35px;
      line-height: 1.04;
      letter-spacing: -1.4px;
    }
    .dek {
      max-width: 6.7in;
      margin-bottom: 0.28in;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.45;
    }
    .hero-rule {
      display: grid;
      grid-template-columns: 1.05in 1fr;
      gap: 0.18in;
      align-items: start;
      margin: 0.22in 0 0.27in;
      padding: 0.2in 0.22in;
      background: var(--gold-soft);
      border-left: 5px solid var(--gold);
      border-radius: 0 10px 10px 0;
    }
    .hero-rule strong {
      color: var(--teal);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .hero-rule p { margin: 0; font-size: 17px; line-height: 1.3; font-weight: 700; }
    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 0 0.13in;
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
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.18in; }
    .card {
      padding: 0.17in 0.18in;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: white;
    }
    .card h3 { margin-bottom: 0.08in; font-size: 13px; }
    .card p, .card li { color: #424b54; font-size: 10.5px; line-height: 1.42; }
    ul { margin: 0; padding-left: 0.18in; }
    li { margin-bottom: 0.065in; }
    .do h3 { color: var(--teal); }
    .dont h3 { color: var(--coral); }
    .checklist { margin: 0; padding: 0; list-style: none; }
    .checklist li {
      display: flex;
      gap: 9px;
      align-items: flex-start;
      margin: 0 0 0.09in;
      color: #424b54;
      font-size: 10.7px;
      line-height: 1.36;
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
    .mini-label {
      margin-bottom: 0.07in;
      color: var(--muted);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.1px;
      text-transform: uppercase;
    }
    .callout {
      margin-top: 0.16in;
      padding: 0.13in 0.16in;
      border-radius: 8px;
      background: var(--teal-soft);
      color: #285c58;
      font-size: 10.5px;
      line-height: 1.42;
    }
    .callout strong { color: var(--teal); }
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
    .structure {
      display: grid;
      grid-template-columns: 0.42in 1fr;
      gap: 0.1in 0.13in;
      margin-bottom: 0.14in;
    }
    .structure .step {
      display: grid;
      place-items: center;
      width: 0.34in;
      height: 0.34in;
      border-radius: 50%;
      background: var(--gold);
      color: #493700;
      font-size: 12px;
      font-weight: 700;
    }
    .structure h3 { margin: 0 0 2px; font-size: 12px; }
    .structure p { margin: 0; color: #59636d; font-size: 10px; line-height: 1.35; }
    .sentence {
      margin-top: 0.06in;
      padding: 0.11in 0.13in;
      border-left: 3px solid var(--gold);
      background: #fffaf0;
      color: #59636d;
      font-size: 10px;
      line-height: 1.4;
      font-style: italic;
    }
    .metric {
      display: grid;
      grid-template-columns: 0.85in 1fr;
      gap: 0.14in;
      padding: 0.11in 0;
      border-bottom: 1px solid var(--line);
    }
    .metric:last-child { border-bottom: 0; }
    .metric strong { color: var(--teal); font-size: 11px; }
    .metric span { color: #59636d; font-size: 10px; line-height: 1.35; }
    .budget-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.18in;
      margin-top: 0.16in;
    }
    .budget-row .card { min-height: 1.4in; }
    .red-flag {
      margin-bottom: 0.09in;
      padding: 0.11in 0.13in;
      border-radius: 7px;
      background: var(--coral-soft);
      color: #714638;
      font-size: 10px;
      line-height: 1.35;
    }
    .red-flag b { color: var(--coral); }
    .final-box {
      margin-top: 0.18in;
      padding: 0.18in 0.2in;
      border: 2px solid var(--teal);
      border-radius: 10px;
      background: var(--teal-soft);
    }
    .final-box h3 { margin-bottom: 0.12in; color: var(--teal); font-size: 15px; }
    .fine { color: var(--muted); font-size: 9px; line-height: 1.35; }
    .page-3 h1 { font-size: 29px; margin-bottom: 0.1in; }
    .page-3 .budget-row { margin-top: 0.12in; }
    .page-3 .budget-row .card { min-height: 1.22in; padding: 0.13in 0.16in; }
    .page-3 .red-flag { margin-bottom: 0.06in; padding: 0.08in 0.11in; }
    .page-3 .final-box { margin-top: 0.13in; padding: 0.13in 0.18in; }
    .page-3 .final-box h3 { margin-bottom: 0.08in; font-size: 14px; }
    .page-3 .final-box .checklist li { margin-bottom: 0.045in; font-size: 10px; line-height: 1.25; }
    .page-3 .fine { margin-top: 0.07in !important; line-height: 1.2; }
  </style>
</head>
<body>
  <section class="page">
    <div class="topbar"></div>
    <div class="brand">
      <img class="logo" src="data:image/png;base64,${logo}" alt="GrantFind">
      <div class="eyebrow">Practical funding guide</div>
    </div>
    <div class="eyebrow">Grant proposal cheat sheet</div>
    <h1>Make your proposal easy to fund.</h1>
    <p class="dek">Use this guide to turn a good idea into a clear, credible request that answers the funder’s questions and makes the next step obvious.</p>

    <div class="hero-rule">
      <strong>The core rule</strong>
      <p>Be specific about the problem, the plan, the people helped, and the proof that your plan can work.</p>
    </div>

    <h2 class="section-title"><span class="num">1</span>Before you write</h2>
    <div class="grid-2">
      <div class="card">
        <div class="mini-label">Do this first</div>
        <ul class="checklist">
          <li><span class="box"></span><span>Read the full guidelines, including attachments, eligibility, page limits, and formatting rules.</span></li>
          <li><span class="box"></span><span>Highlight the funder’s priorities and repeat their language accurately—not mechanically.</span></li>
          <li><span class="box"></span><span>Make a one-sentence case: “We will [do what] for [whom] so that [measurable change].”</span></li>
          <li><span class="box"></span><span>Build a deadline plan with time for documents, review, signatures, and submission.</span></li>
        </ul>
      </div>
      <div class="card dont">
        <div class="mini-label">Avoid this</div>
        <ul>
          <li>Starting with a generic template before understanding the funder.</li>
          <li>Applying when you do not meet a basic eligibility requirement.</li>
          <li>Waiting until the deadline to request letters, quotes, or financial records.</li>
          <li>Trying to solve every problem in one proposal.</li>
        </ul>
      </div>
    </div>

    <h2 class="section-title" style="margin-top:.24in"><span class="num">2</span>What reviewers need to believe</h2>
    <div class="grid-2">
      <div class="card do">
        <h3>Show a real need</h3>
        <p>Use a short story plus evidence: who is affected, what is happening now, and why action is needed.</p>
      </div>
      <div class="card do">
        <h3>Show a workable plan</h3>
        <p>Connect activities to a timeline, responsible person, partners, and the resources required.</p>
      </div>
      <div class="card do">
        <h3>Show measurable results</h3>
        <p>Define what will change, how you will count it, and when you will know you are on track.</p>
      </div>
      <div class="card do">
        <h3>Show responsible stewardship</h3>
        <p>Make the budget reasonable, explain assumptions, and show how the work continues after the grant.</p>
      </div>
    </div>
    <div class="callout"><strong>Reader test:</strong> If someone unfamiliar with your work can summarize your need, plan, cost, and expected result after one read, your proposal is doing its job.</div>
    <div class="footer"><span><b>GRANTFIND</b> · Grant Proposal Cheat Sheet</span><span>01</span></div>
  </section>

  <section class="page">
    <div class="topbar"></div>
    <div class="brand">
      <img class="logo" src="data:image/png;base64,${logo}" alt="GrantFind">
      <div class="eyebrow">Build the case</div>
    </div>
    <div class="eyebrow">A strong proposal, section by section</div>
    <h1 style="font-size:30px">Give every paragraph a job.</h1>
    <p class="dek" style="margin-bottom:.2in">A clear structure helps reviewers find the answers they are scoring. Follow the funder’s requested order when it differs.</p>

    <div class="structure">
      <div class="step">1</div><div><h3>Opening / executive summary</h3><p>State the request, the need, the people served, the solution, and the amount in plain language.</p><div class="sentence">“[Organization] requests $[amount] to [action] for [population] during [time period].”</div></div>
      <div class="step">2</div><div><h3>Need or problem</h3><p>Describe the gap with local facts, credible sources, lived experience, and the consequences of inaction.</p></div>
      <div class="step">3</div><div><h3>Project design</h3><p>Explain what will happen, who will do it, where it will happen, and why this approach fits the need.</p><div class="sentence">“By month [x], we will [activity], reaching [number] [people] through [method].”</div></div>
      <div class="step">4</div><div><h3>Goals and outcomes</h3><p>Separate activities (what you do) from outcomes (what changes). Use numbers, dates, and a measurement method.</p></div>
      <div class="step">5</div><div><h3>Team and partnerships</h3><p>Show relevant experience, roles, community trust, and any partners who make the plan stronger.</p></div>
      <div class="step">6</div><div><h3>Budget and justification</h3><p>Match each major cost to an activity. Explain unusual, shared, or one-time expenses.</p></div>
      <div class="step">7</div><div><h3>Sustainability and evaluation</h3><p>Describe what you will learn, how you will report progress, and how the work continues or scales.</p></div>
    </div>

    <div class="grid-2" style="margin-top:.17in">
      <div class="card">
        <h3>Use evidence strategically</h3>
        <ul>
          <li>Choose the strongest two or three facts instead of a data dump.</li>
          <li>Name the source and date for outside statistics.</li>
          <li>Pair numbers with a human consequence or community voice.</li>
          <li>Explain why the evidence matters to this specific project.</li>
        </ul>
      </div>
      <div class="card dont">
        <h3>Do not make reviewers work</h3>
        <ul>
          <li>Do not bury the ask at the end.</li>
          <li>Do not use acronyms without defining them.</li>
          <li>Do not promise outcomes you cannot measure.</li>
          <li>Do not copy a past proposal without updating the facts.</li>
        </ul>
      </div>
    </div>
    <div class="callout"><strong>Plain-language check:</strong> Replace “leverage,” “impactful,” and “innovative” with the concrete action, result, or evidence those words are meant to describe.</div>
    <div class="footer"><span><b>GRANTFIND</b> · Grant Proposal Cheat Sheet</span><span>02</span></div>
  </section>

  <section class="page page-3">
    <div class="topbar"></div>
    <div class="brand">
      <img class="logo" src="data:image/png;base64,${logo}" alt="GrantFind">
      <div class="eyebrow">Finish strong</div>
    </div>
    <div class="eyebrow">Budget, red flags & final review</div>
    <h1>Make the last page as convincing as the first.</h1>
    <p class="dek" style="margin-bottom:.18in">Your budget is part of the story. It should make the plan feel realistic, not simply list what you hope to buy.</p>

    <div class="card">
      <h2 class="section-title" style="margin-bottom:.05in"><span class="num">3</span>Budget sanity check</h2>
      <div class="metric"><strong>Necessary</strong><span>Could the project happen without this cost? If not, connect it to a specific activity.</span></div>
      <div class="metric"><strong>Reasonable</strong><span>Is the price supported by a quote, prior cost, market rate, or clear assumption?</span></div>
      <div class="metric"><strong>Aligned</strong><span>Do the budget, timeline, activities, staffing, and requested amount tell the same story?</span></div>
      <div class="metric"><strong>Complete</strong><span>Have you included supplies, travel, technology, accessibility, evaluation, and indirect costs where allowed?</span></div>
    </div>

    <div class="budget-row">
      <div class="card do">
        <h3>Budget justification: do</h3>
        <ul>
          <li>Explain the purpose of each major line item.</li>
          <li>Show your math: rate × quantity × time.</li>
          <li>Identify matching funds or in-kind support.</li>
          <li>Use the funder’s categories and rounding rules.</li>
        </ul>
      </div>
      <div class="card dont">
        <h3>Budget justification: don’t</h3>
        <ul>
          <li>Pad the budget “just in case.”</li>
          <li>Include costs the guidelines prohibit.</li>
          <li>Request a large equipment purchase without a use plan.</li>
          <li>Let totals conflict across forms or attachments.</li>
        </ul>
      </div>
    </div>

    <h2 class="section-title" style="margin-top:.22in"><span class="num">4</span>Red flags to remove</h2>
    <div class="red-flag"><b>Too broad:</b> “We will transform the community.” Name the population, geography, activity, and measurable change.</div>
    <div class="red-flag"><b>Too vague:</b> “We will provide support.” Say what support, how often, by whom, and how many people.</div>
    <div class="red-flag"><b>Too perfect:</b> A credible plan names assumptions, risks, and what you will do if something changes.</div>
    <div class="red-flag"><b>Too late:</b> A rushed submission often misses a required attachment or fails a formatting rule.</div>

    <div class="final-box">
      <h3>Final 10-minute submission checklist</h3>
      <div class="grid-2">
        <ul class="checklist">
          <li><span class="box"></span><span>We meet every eligibility rule.</span></li>
          <li><span class="box"></span><span>We answered every required question.</span></li>
          <li><span class="box"></span><span>The ask is clear in the first paragraph.</span></li>
          <li><span class="box"></span><span>Our numbers and dates agree everywhere.</span></li>
        </ul>
        <ul class="checklist">
          <li><span class="box"></span><span>Each outcome has a measurement plan.</span></li>
          <li><span class="box"></span><span>The budget matches the work plan.</span></li>
          <li><span class="box"></span><span>All attachments open and are labeled.</span></li>
          <li><span class="box"></span><span>Someone else proofread the final file.</span></li>
        </ul>
      </div>
    </div>
    <p class="fine" style="margin-top:.13in">Always follow the funder’s official instructions if they differ from this guide. GrantFind provides educational guidance, not a guarantee of funding.</p>
    <div class="footer"><span><b>GRANTFIND</b> · Grant Proposal Cheat Sheet</span><span>03</span></div>
  </section>
</body>
</html>`;

await fs.mkdir(outputDir, { recursive: true });
const htmlPath = path.join(outputDir, "grant-proposal-cheat-sheet.html");
const pdfPath = path.join(outputDir, "grant-proposal-cheat-sheet.pdf");
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