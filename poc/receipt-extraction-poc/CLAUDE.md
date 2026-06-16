# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Node.js POC that extracts structured fields (date, total amount) from receipt images using Google Cloud Vision OCR. The script reads an image, calls the Vision REST API directly (not the `@google-cloud/vision` SDK), and saves the result to `output/receipt-output.json`.

Note: the `@google-cloud/vision` package is installed as a dependency but the actual HTTP call uses the native `fetch` API against the REST endpoint with an API key.

## Running

```bash
node src/receiptExtraction.js ./sample-images/sample-2.jpeg
```

Requires a `.env` file in the project root with:
```
GOOGLE_VISION_API_KEY=<your key>
```

Output is written to `output/receipt-output.json` (gitignored).

## Architecture

Everything lives in `src/receiptExtraction.js`. The flow is:

1. `main()` takes an image path from `process.argv[2]`
2. `extractTextFromReceipt()` base64-encodes the image and calls the Vision REST API with `DOCUMENT_TEXT_DETECTION` and language hints `["iw", "he", "en"]` (Hebrew + English)
3. `extractReceiptFields()` → `normalizeText()` + `extractDate()` + `extractTotalAmount()` parse the raw OCR string with regex
4. Output JSON is written to `output/receipt-output.json`

`extractTotalAmount()` first tries to match keywords like `סה"כ`, `לתשלום`, `total`; if none match, it falls back to the largest decimal number in the text.

## Gitignored Paths

- `node_modules/`
- `.env` (API key)
- `output/` (generated JSON)
- `sample-images/` (receipt photos)
