const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 3000;
const AWMP_PDF_SECRET = process.env.AWMP_PDF_SECRET || "";

app.get("/", (req, res) => res.status(200).send("AWMP PDF Render Service OK"));
app.get("/health", (req, res) => res.status(200).json({ ok: true }));

app.post("/render-pdf", async (req, res) => {
  let browser;

  try {
    const { secret, html } = req.body || {};

    if (!AWMP_PDF_SECRET) {
      return res.status(500).json({ error: "Server secret not configured" });
    }

    if (!secret || secret !== AWMP_PDF_SECRET) {
      return res.status(401).json({ error: "Unauthorized (bad secret)" });
    }

    if (!html || typeof html !== "string" || html.length < 100) {
      return res.status(400).json({ error: "Invalid HTML payload" });
    }

    // ✅ Launch Chromium compatible with restricted environments
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    // No external asset fetching → stable + fast
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith("data:") || url.startsWith("about:")) {
        request.continue();
      } else {
        request.abort();
      }
    });

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "16mm",
        right: "14mm",
        bottom: "16mm",
        left: "14mm"
      }
    });

    await browser.close();
    browser = null;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="awmp-meal-plan.pdf"');
    return res.status(200).send(pdfBuffer);

  } catch (err) {
    try {
      if (browser) await browser.close();
    } catch (e) {}

    return res.status(500).json({
      error: "PDF render failed",
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ AWMP PDF render service running on port ${PORT}`);
});
