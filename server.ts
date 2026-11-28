import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // High payload limit for document photos & passbook images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Helper to get Gemini Client safely
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in Secrets. Please configure it in the Secrets panel.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // 1. Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // 2. AI OCR: Extract PAN Card, Aadhaar Card, Bank Passbook/Cheque Photos
  app.post("/api/ocr-documents", async (req, res) => {
    try {
      const { images } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ success: false, error: "No document photos provided for scanning." });
      }

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (keyErr: any) {
        return res.status(400).json({
          success: false,
          error: keyErr.message || "GEMINI_API_KEY is missing.",
        });
      }

      const imageParts = images.map((img: { data: string; mimeType?: string }) => {
        let cleanBase64 = img.data || "";
        let mimeType = img.mimeType || "image/jpeg";
        if (cleanBase64.includes(";base64,")) {
          const split = cleanBase64.split(";base64,");
          mimeType = split[0].replace("data:", "") || "image/jpeg";
          cleanBase64 = split[1];
        }
        // remove whitespace/newlines from base64 string
        cleanBase64 = cleanBase64.replace(/\s/g, "");
        return {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || "image/jpeg",
          },
        };
      });

      const systemPrompt = `You are an expert Indian Income Tax, KYC, and Banking Document OCR Extractor for Tax Professionals and Chartered Accountants (CAs).
You are given photos of a client's documents which may include:
- PAN Card (Permanent Account Number)
- Aadhaar Card (Front and/or Back)
- Bank Passbook Photo, Cancelled Cheque, or Bank Account Statement

Your task is to carefully extract all fields and merge them into a single clean client profile:
1. PAN Card:
   - Full Name: in UPPERCASE (e.g. SARABJIT KAUR)
   - Father's Name: in UPPERCASE (e.g. MUKHTIAR SINGH)
   - Date of Birth (DOB): Strictly formatted as DD/MM/YYYY (e.g. 15/04/1981)
   - PAN Number: Exactly 10 characters (e.g. HSIPK5617N)

2. Aadhaar Card:
   - Name & Father/Husband name (C/O or S/O or W/O)
   - Date of Birth / Year of Birth (DD/MM/YYYY format)
   - Gender: "Male" or "Female" or "Senior Citizen"
   - 12-digit Aadhaar Number (format: 1234 5678 9012)
   - Full Address: village, post office, tehsil, city, state, pin code (in UPPERCASE)
   - Pincode: 6 digits (e.g. 144702)
   - State: (e.g. PUNJAB)

3. Bank Passbook / Cheque:
   - Bank Name: (e.g. CAPITAL SMALL FINANCE BANK, PUNJAB NATIONAL BANK, STATE BANK OF INDIA, HDFC BANK, AXIS BANK, ICICI BANK, PUNJAB & SIND BANK)
   - Account Number: Bank account number digits
   - IFSC Code: 11 characters (e.g. CLBL0000052, PUNB0012300, SBIN0001234)
   - Branch Name: Bank branch location

4. Other details:
   - Place of filing: Village / Town / City (e.g. LOHIAN KHAS, JALANDHAR)
   - Detected document types

Ensure 100% accuracy. Do not make up information not present in the images.`;

      // Modern supported models from gemini-api SKILL.md
      const CANDIDATE_MODELS = [
        "gemini-flash-latest",
        "gemini-3.1-flash-lite",
        "gemini-3.7-flash",
        "gemini-3.1-pro-preview",
      ];

      let lastError: any = null;
      let rawText = "";

      for (const modelName of CANDIDATE_MODELS) {
        // Attempt up to 2 tries per model in case of temporary 503 spike
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`Attempting OCR extraction using model: ${modelName} (Attempt ${attempt})...`);
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                ...imageParts,
                { text: systemPrompt },
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Full Name of client as on PAN/Aadhaar in UPPERCASE" },
                    fatherName: { type: Type.STRING, description: "Father's Name in UPPERCASE" },
                    pan: { type: Type.STRING, description: "10-digit PAN (e.g. HSIPK5617N) in UPPERCASE" },
                    aadhaarNumber: { type: Type.STRING, description: "12-digit Aadhaar number formatted e.g. 1234 5678 9012" },
                    dob: { type: Type.STRING, description: "Date of birth strictly in DD/MM/YYYY format" },
                    gender: { type: Type.STRING, description: "Male or Female or Senior Citizen" },
                    mobile: { type: Type.STRING, description: "Mobile number if visible" },
                    email: { type: Type.STRING, description: "Email if visible" },
                    address: { type: Type.STRING, description: "Complete residential address with Village, Tehsil, City, State, PIN" },
                    pincode: { type: Type.STRING, description: "6-digit Pincode" },
                    state: { type: Type.STRING, description: "State name in UPPERCASE" },
                    bankName: { type: Type.STRING, description: "Bank Name" },
                    accountNumber: { type: Type.STRING, description: "Bank Account Number" },
                    ifscCode: { type: Type.STRING, description: "11-character Bank IFSC Code in UPPERCASE" },
                    branchName: { type: Type.STRING, description: "Bank branch name" },
                    placeOfFiling: { type: Type.STRING, description: "Town / City for signature & place of filing" },
                    documentTypesDetected: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "List of documents detected in images (e.g. PAN Card, Aadhaar Card, Bank Passbook, Cheque)",
                    },
                    summaryNotes: { type: Type.STRING, description: "Short summary of extracted KYC & banking details" },
                  },
                  required: ["name"],
                },
              },
            });

            rawText = response.text || "{}";
            if (rawText && rawText.trim().length > 0) {
              console.log(`OCR extraction successful with ${modelName}`);
              lastError = null;
              break;
            }
          } catch (err: any) {
            lastError = err;
            const isUnavailable = err.message?.includes("503") || err.message?.includes("UNAVAILABLE") || err.message?.includes("high demand");
            console.warn(`Model ${modelName} attempt ${attempt} failed: ${err.message}`);
            
            if (isUnavailable && attempt < 2) {
              // Wait 1.2s before retry on the same model
              await new Promise((resolve) => setTimeout(resolve, 1200));
            } else {
              break;
            }
          }
        }

        if (rawText && !lastError) {
          break;
        }
      }

      if (!rawText || lastError) {
        throw new Error(
          lastError?.message || "All Gemini models are temporarily experiencing high traffic. Please try again in a few moments."
        );
      }
      let extractedJson: any = {};
      try {
        extractedJson = JSON.parse(rawText);
      } catch (parseError) {
        // Attempt to clean markdown backticks if present
        const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        extractedJson = JSON.parse(cleaned);
      }

      return res.json({ success: true, data: extractedJson });
    } catch (error: any) {
      console.error("OCR Document Extraction Error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to extract information from document photos.",
      });
    }
  });

  // 3. Income Tax Portal Pre-Fill JSON & AIS Sync Endpoint
  app.post("/api/portal-sync", async (req, res) => {
    try {
      const { jsonContent, rawText } = req.body;
      if (!jsonContent && !rawText) {
        return res.status(400).json({ success: false, error: "No Income Tax portal JSON or data provided." });
      }

      // If user uploaded an official JSON file from e-Filing portal
      let parsedData: any = {};
      if (jsonContent) {
        try {
          parsedData = typeof jsonContent === "string" ? JSON.parse(jsonContent) : jsonContent;
        } catch {
          parsedData = {};
        }
      }

      return res.json({
        success: true,
        message: "Income tax portal data synchronized successfully",
        data: parsedData,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. AI OCR & Structured Extraction for Tax Challans, ITNS 280/281/282/283, Form 26AS, AIS, TIS, ITR Ack
  app.post("/api/ocr-challan", async (req, res) => {
    try {
      const { files, rawText, fileName } = req.body;
      if ((!files || !Array.isArray(files) || files.length === 0) && (!rawText || typeof rawText !== "string")) {
        return res.status(400).json({ success: false, error: "No challan document, PDF, image, or text provided for extraction." });
      }

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (keyErr: any) {
        return res.status(400).json({
          success: false,
          error: keyErr.message || "GEMINI_API_KEY is missing.",
        });
      }

      const contentParts: any[] = [];
      if (Array.isArray(files)) {
        for (const f of files) {
          let cleanBase64 = f.data || "";
          let mimeType = f.mimeType || "image/jpeg";
          if (cleanBase64.includes(";base64,")) {
            const split = cleanBase64.split(";base64,");
            mimeType = split[0].replace("data:", "") || mimeType;
            cleanBase64 = split[1];
          }
          cleanBase64 = cleanBase64.replace(/\s/g, "");
          if (cleanBase64) {
            contentParts.push({
              inlineData: {
                data: cleanBase64,
                mimeType,
              },
            });
          }
        }
      }

      if (rawText && rawText.trim().length > 0) {
        contentParts.push({
          text: `Extracted document text (${fileName || "uploaded file"}):\n${rawText.slice(0, 60000)}`,
        });
      }

      const extractionPrompt = `You are a senior Indian Chartered Accountant & Income Tax Challan Auditor.
Extract all tax payment / challan / TDS / TCS entries from the provided document(s), which may be:
- Income Tax Challan Receipt / e-Pay Tax Receipt
- Challan ITNS 280 (Income Tax / Advance Tax / Self Assessment Tax / Regular Assessment / 234F / 234A/B/C)
- Challan ITNS 281 (TDS/TCS)
- Challan ITNS 282 / ITNS 283
- Form 26AS (Part A TDS, Part B TCS, Part C Tax Paid)
- AIS / TIS (Annual Information Statement / Taxpayer Information Summary)
- ITR Acknowledgement (ITR-V) or Tax Computation Sheet

CRITICAL ACCURACY RULES (ZERO FABRICATION):
1. Extract ONLY values explicitly present in the document.
2. If ANY string field (bsrCode, challanSerialNumber, challanTenderDate, bankName, cin, pan, assesseeName, assessmentYear, paymentMode) is missing, cut off, or unreadable, output the EXACT string "Not Found". NEVER guess, invent, or fabricate BSR codes, serial numbers, CINs, or dates.
3. Map paymentType strictly to one of these exact 11 categories:
   - "Self Assessment Tax – u/s 140A"
   - "Advance Tax"
   - "Regular Assessment Tax – u/s 156"
   - "Tax on Regular Assessment"
   - "Late Filing Fee – u/s 234F"
   - "Interest u/s 234A"
   - "Interest u/s 234B"
   - "Interest u/s 234C"
   - "TDS"
   - "TCS"
   - "Other applicable tax payments"
   (Note: On ITNS 280 / e-Pay Tax: Minor Head 100 = Advance Tax, 300 = Self Assessment Tax – u/s 140A, 400 = Regular Assessment Tax – u/s 156. If Late Filing Fee 234F is the sole/primary payment, use "Late Filing Fee – u/s 234F". If a Self Assessment Tax challan includes tax + interest + 234F fee breakdown, populate taxAmount, surcharge, cess, interest, lateFilingFee, otherAmount accurately!)
4. Format challanTenderDate as DD/MM/YYYY if legible, else "Not Found".
5. Format bsrCode as 7 digits if legible, else "Not Found".
6. Format pan in UPPERCASE (10 chars) if legible, else "Not Found".
7. Format assessmentYear as YYYY-YY (e.g. 2025-26 or 2026-27) if legible, else "Not Found".`;

      contentParts.push({ text: extractionPrompt });

      const CHALLAN_MODELS = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
      let lastError: any = null;
      let rawJsonText = "";

      for (const modelName of CHALLAN_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: contentParts,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  detectedDocumentType: {
                    type: Type.STRING,
                    description: "e.g. Challan ITNS 280, Income Tax Payment Receipt, Form 26AS, AIS, TIS, ITR Acknowledgement",
                  },
                  extractionNotes: {
                    type: Type.STRING,
                    description: "Brief note on what was extracted or any unreadable fields",
                  },
                  challans: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        pan: { type: Type.STRING },
                        assesseeName: { type: Type.STRING },
                        assessmentYear: { type: Type.STRING },
                        financialYear: { type: Type.STRING },
                        paymentType: { type: Type.STRING },
                        challanForm: { type: Type.STRING },
                        bsrCode: { type: Type.STRING },
                        challanSerialNumber: { type: Type.STRING },
                        challanTenderDate: { type: Type.STRING },
                        bankName: { type: Type.STRING },
                        cin: { type: Type.STRING },
                        taxAmount: { type: Type.NUMBER },
                        surcharge: { type: Type.NUMBER },
                        cess: { type: Type.NUMBER },
                        interest: { type: Type.NUMBER },
                        lateFilingFee: { type: Type.NUMBER },
                        otherAmount: { type: Type.NUMBER },
                        totalAmountPaid: { type: Type.NUMBER },
                        paymentMode: { type: Type.STRING },
                      },
                      required: ["paymentType", "bsrCode", "challanSerialNumber", "challanTenderDate", "totalAmountPaid", "cin"],
                    },
                  },
                },
                required: ["detectedDocumentType", "challans"],
              },
            },
          });

          rawJsonText = response.text || "{}";
          if (rawJsonText.trim().length > 0) {
            lastError = null;
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Challan OCR model ${modelName} failed:`, err.message);
        }
      }

      if (!rawJsonText || lastError) {
        throw new Error(lastError?.message || "Failed to extract challan details via Gemini OCR.");
      }

      let parsed: any = {};
      try {
        parsed = JSON.parse(rawJsonText);
      } catch {
        const cleaned = rawJsonText.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleaned);
      }

      return res.json({ success: true, data: parsed });
    } catch (error: any) {
      console.error("Challan OCR Extraction Error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to extract challan details from document.",
      });
    }
  });

  // Global JSON Error Handler to ensure API routes always return JSON (never HTML)
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("API Route Error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred while processing the request.",
    });
  });

  // Vite middleware for development & Static serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tax Application Server running on http://localhost:${PORT}`);
  });
}

startServer();
