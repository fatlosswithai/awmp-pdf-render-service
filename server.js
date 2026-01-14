const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

// Allow large HTML payloads
app.use(express.json({ limit: "15mb" }));

const PORT = process.env.PORT || 3000;

// Secret (set this in Render/Railway env vars)
const AWMP_PDF_SECRET = process.env.AWMP_PDF_SECRET || "";

/**
 * POST /render-pdf
 * Body:
 * {
 *   "secret": "xxx",
 *   "html": "<html>...</html>",
 *   "filename": "meal-plan.pdf" (optional)
 * }
 */
app.post("/render-pdf", async (req, res) => {
  try {
    const { secret, html } = req.body || {};

    if (!AWMP_PDF_SECRET) {
      return res.status(500).json({ error: "Server secret not configured" });
    }

    if (!secret || secret !== AWMP_PDF_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!html || typeof html !== "string" || html.length < 100) {
      return res.status(400).json({ error: "Invalid HTML payload" });
    }

    const browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--font-render-hinting=medium"
      ],
      headless: "new"
    });

    const page = await browser.newPage();

    // Important: ensures Hindi/Marathi fonts render in Chromium properly
    await page.setContent(html, { waitUntil: "networkidle0" });

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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="awmp-meal-plan.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({
      error: "PDF render failed",
      details: String(err && err.message ? err.message : err)
    });
  }
});

app.get("/", (req, res) => {
  res.status(200).send("AWMP PDF Render Service OK");
});

app.listen(PORT, () => {
  console.log(`✅ AWMP PDF render service running on port ${PORT}`);
});
