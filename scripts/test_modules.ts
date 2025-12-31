/**
 * Test script to check module structure
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

console.log("Testing pdf-parse...");
try {
  const pdfParse = require("pdf-parse");
  console.log("pdf-parse type:", typeof pdfParse);
  console.log("pdf-parse keys:", Object.keys(pdfParse));
  console.log("pdf-parse.default:", pdfParse.default);
} catch (error) {
  console.error("pdf-parse error:", error);
}

console.log("\nTesting mammoth...");
try {
  const mammoth = require("mammoth");
  console.log("mammoth type:", typeof mammoth);
  console.log("mammoth keys:", Object.keys(mammoth));
  console.log("mammoth.default:", mammoth.default);
  console.log("mammoth.extractRawText:", typeof mammoth.extractRawText);
} catch (error) {
  console.error("mammoth error:", error);
}

console.log("\nTesting pptx2json...");
try {
  const pptx2json = require("pptx2json");
  console.log("pptx2json type:", typeof pptx2json);
  console.log("pptx2json keys:", Object.keys(pptx2json));
  console.log("pptx2json.default:", pptx2json.default);
  console.log("pptx2json.PPTX2Json:", pptx2json.PPTX2Json);
} catch (error) {
  console.error("pptx2json error:", error);
}
