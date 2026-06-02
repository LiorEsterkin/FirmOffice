require("dotenv").config();
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GOOGLE_VISION_API_KEY;

if (!API_KEY) {
  throw new Error("Missing GOOGLE_VISION_API_KEY in .env file");
}

/**
 * Extract text from a receipt image using Google Cloud Vision REST API.
 * This version uses API Key from .env.
 *
 * @param {string} imagePath - Local path to the receipt image.
 * @returns {Promise<string>} Extracted OCR text.
 */
async function extractTextFromReceipt(imagePath) {
  const absolutePath = path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const imageBase64 = fs.readFileSync(absolutePath).toString("base64");

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: imageBase64,
            },
            features: [
              {
                type: "DOCUMENT_TEXT_DETECTION",
              },
            ],
            imageContext: {
              languageHints: ["iw", "he", "en"],
            },
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Google Vision API error:");
    console.error(JSON.stringify(data, null, 2));
    throw new Error("Failed to extract text from image");
  }

  return data.responses?.[0]?.fullTextAnnotation?.text || "";
}

/**
 * Normalize OCR text to make field extraction easier.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[₪]/g, " ₪ ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract date from receipt text.
 *
 * Supports examples:
 * 12/05/2026
 * 12.05.2026
 * 12-05-26
 *
 * @param {string} text
 * @returns {string | null}
 */
function extractDate(text) {
  const dateRegex = /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/;
  const match = text.match(dateRegex);

  return match ? match[1] : null;
}

/**
 * Extract total amount from receipt text.
 *
 * First tries to find amount near words like:
 * סה"כ, סהכ, סך הכל, לתשלום, total
 *
 * If it fails, it takes the largest decimal number as fallback.
 *
 * @param {string} text
 * @returns {string | null}
 */
function extractTotalAmount(text) {
  const totalRegex =
    /(?:סה["״]?כ|סהכ|סך הכל|לתשלום|סה"כ לתשלום|total|amount)[^\d]{0,40}(\d+[.,]?\d*)/i;

  const totalMatch = text.match(totalRegex);

  if (totalMatch) {
    return totalMatch[1].replace(",", ".");
  }

  const fallbackAmountRegex = /(\d+[.,]\d{2})/g;

  const amounts = [...text.matchAll(fallbackAmountRegex)]
    .map((match) => parseFloat(match[1].replace(",", ".")))
    .filter((num) => !Number.isNaN(num));

  if (amounts.length === 0) {
    return null;
  }

  return Math.max(...amounts).toFixed(2);
}

/**
 * Parse extracted OCR text into basic receipt fields.
 *
 * @param {string} rawText
 * @returns {object}
 */
function extractReceiptFields(rawText) {
  const normalizedText = normalizeText(rawText);

  return {
    documentType: "receipt",
    date: extractDate(normalizedText),
    totalAmount: extractTotalAmount(normalizedText),
    rawText,
  };
}

/**
 * Save OCR result and extracted fields to a JSON file.
 *
 * @param {object} outputData
 * @param {string} outputFilePath
 */
function saveOutputToFile(outputData, outputFilePath) {
  const outputDir = path.dirname(outputFilePath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    outputFilePath,
    JSON.stringify(outputData, null, 2),
    "utf8"
  );
}

async function main() {
  try {
    const imagePath = process.argv[2];

    if (!imagePath) {
      console.error("Usage:");
      console.error("node receiptExtraction.js ./sample-images/sample-2.jpeg");
      process.exit(1);
    }

    const rawText = await extractTextFromReceipt(imagePath);
    const receiptFields = extractReceiptFields(rawText);

    const outputData = {
  metadata: {
    ocrProvider: "google_cloud_vision",
  },
  extractedFields: {
    documentType: receiptFields.documentType,
    date: receiptFields.date,
    totalAmount: receiptFields.totalAmount,
  },
  rawText: receiptFields.rawText,
};

const outputFilePath = path.resolve("output", "receipt-output.json");

saveOutputToFile(outputData, outputFilePath);

    console.log("\n========== OCR TEXT ==========\n");
    console.log(rawText);

    console.log("\n========== EXTRACTED FIELDS ==========\n");
    console.log(JSON.stringify(receiptFields, null, 2));

    console.log("\n========== OUTPUT FILE ==========\n");
    console.log(`Output saved to: ${outputFilePath}`);
  } catch (error) {
    console.error("\nError:");
    console.error(error.message);
    process.exit(1);
  }
}

main();