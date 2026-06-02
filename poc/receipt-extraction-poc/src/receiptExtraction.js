const path = require("path");
const vision = require("@google-cloud/vision");

const client = new vision.ImageAnnotatorClient();


const SAMPLE2_PATH = "/receipt-extraction-poc/sample-images/sample-2.jpeg";

async function extractTextFromReceipt(imagePath) {
  try {
    const absolutePath = path.resolve(imagePath);

    const [result] = await client.documentTextDetection({
      image: {
        source: {
          filename: absolutePath,
        },
      },
      imageContext: {
        languageHints: ["iw", "he", "en"],
      },
    });

    const fullTextAnnotation = result.fullTextAnnotation;

    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      return "";
    }

    return fullTextAnnotation.text;
  } catch (error) {
    console.error("Error while extracting text:", error.message);
    throw error;
  }
}

function extractReceiptFields(text) {
  const normalizedText = text
    .replace(/\r/g, "")
    .replace(/[₪]/g, " ₪ ")
    .replace(/\s+/g, " ")
    .trim();

  const dateRegex =
    /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/;

  const amountRegex =
    /(?:סה["״]?כ|סך הכל|לתשלום|סהכ|total)[^\d]{0,20}(\d+[.,]?\d*)/i;

  const fallbackAmountsRegex =
    /(\d+[.,]\d{2})/g;

  const dateMatch = normalizedText.match(dateRegex);
  const amountMatch = normalizedText.match(amountRegex);

  let totalAmount = null;

  if (amountMatch) {
    totalAmount = amountMatch[1].replace(",", ".");
  } else {
    const allAmounts = [...normalizedText.matchAll(fallbackAmountsRegex)]
      .map((match) => parseFloat(match[1].replace(",", ".")))
      .filter((num) => !Number.isNaN(num));

    if (allAmounts.length > 0) {
      totalAmount = Math.max(...allAmounts).toFixed(2);
    }
  }

  return {
    documentType: "receipt",
    date: dateMatch ? dateMatch[1] : null,
    totalAmount,
    rawText: text,
  };
}
async function main() {
    await extractTextFromReceipt(SAMPLE2_PATH);
}

main();