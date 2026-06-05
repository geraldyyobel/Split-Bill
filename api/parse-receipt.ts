import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let ai: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured on the server. Please add it to your Environment Variables.");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

export default async function handler(req: any, res: any) {
  // Only accept POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No receipt image provided." });
    }

    let client;
    try {
      client = getAiClient();
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }

    let base64Clean = image;
    let mime = "image/jpeg";
    if (image.includes(";base64,")) {
      const parts = image.split(";base64,");
      mime = parts[0].replace("data:", "");
      base64Clean = parts[1];
    }

    const imagePart = {
      inlineData: {
        mimeType: mime,
        data: base64Clean,
      },
    };

    const promptText = `Analyze this receipt image. Extract:
1. Store/restaurant name (storeName)
2. Every item listed, with name, price, and quantity (items). Price should be the total price for that item entry (quantity * unit-price if listed, or just the listed item cost).
3. Subtotal, Tax, Tip, and overall Total listed.
All monetary amounts must be numbers, not strings with currency symbols. If tax, tip, or subtotal are not found group items to approximate or set them to 0. Make sure things add up reasonably close.`;

    const response = await client.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        imagePart,
        { text: promptText }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            storeName: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  quantity: { type: Type.INTEGER }
                },
                required: ["name", "price"]
              }
            },
            subtotal: { type: Type.NUMBER },
            tax: { type: Type.NUMBER },
            tip: { type: Type.NUMBER },
            total: { type: Type.NUMBER }
          },
          required: ["items", "total"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response text from Gemini API");
    }

    const receiptResult = JSON.parse(response.text.trim());
    return res.status(200).json(receiptResult);
  } catch (error: any) {
    console.error("Receipt parsing failed:", error);
    return res.status(500).json({ error: error.message || "Failed to analyze receipt image." });
  }
}
