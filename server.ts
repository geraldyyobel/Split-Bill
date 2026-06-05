import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Initialize Google GenAI SDK
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Endpoint to parse receipt from image (base64)
app.post("/api/parse-receipt", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No receipt image provided." });
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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
    res.json(receiptResult);
  } catch (error: any) {
    console.error("Receipt parsing failed:", error);
    res.status(500).json({ error: error.message || "Failed to analyze receipt image." });
  }
});

// Endpoint to process chat text commands
app.post("/api/chat-command", async (req, res) => {
  try {
    const { query, items, participants, history } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Command query is required." });
    }

    const promptText = `You are a smart bill splitter assistant.
Analyze the user command in the context of the split-bill state:
- Active participants (people): ${JSON.stringify(participants || [])}
- Receipt items (with current assignees in 'assignedTo'): ${JSON.stringify(items || [])}

Instructions:
1. Parse the command from the user (e.g. "Dhruv had the nachos", "Sarah, sue, and Dhruv split the double hamburger", "Dhruv split taxes", "split all remaining items equally", "reset everything").
2. Match mentioned items intelligently. If a user refers to "burger", match an item named "Cheeseburger Deluxe" or "Ham burger". If a user refers to "nachos", match "Large Loaded Nachos".
3. Extract any new people names introduced in the query that are not in the participants list and list them under 'newParticipants'. Ensure consistent uppercase for names.
4. Produce a list of assignments to update. For each updated item, return its itemId and the complete new array of assignedTo participant names.
   - If they say "sue and sarah shared the pizza", assignments should contain the pizza item ID with assignedTo: ["Sue", "Sarah"].
   - If they say "assign the drinks to frank", drink items should get assignedTo: ["Frank"]. Frank is also returned under 'newParticipants' since he is new.
   - If they say "add Dhruv to nachos", append "Dhruv" to any existing assignees on nachos.
   - If they say "remove Sue from soda", remove her name but keep others.
   - If they say "reset all assignments" or "clear", return all items in the receipt with assignedTo set to [].
   - If they say "split everything else equally", find all items where assignedTo is empty, and set their assignedTo to all current + new participants.
5. In 'explanation', explain friendly and briefly what was completed (e.g., "I've assigned the Nachos to Dhruv and split the Hamburger between Sarah, Sue, and Dhruv.").
6. In 'suggestedNextAction', suggest a friendly optional next action based on what is left unassigned (e.g., "There are still 3 items left unassigned: Fries, Soda, and Pie!").

Return the result strictly as a JSON object adhering to the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: promptText }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            assignments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemId: { type: Type.STRING },
                  assignedTo: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["itemId", "assignedTo"]
              }
            },
            newParticipants: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestedNextAction: { type: Type.STRING }
          },
          required: ["explanation", "assignments", "newParticipants"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response text from Gemini API");
    }

    const commandResult = JSON.parse(response.text.trim());
    res.json(commandResult);
  } catch (error: any) {
    console.error("Chat command parsing failed:", error);
    res.status(500).json({ error: error.message || "Failed to process split instruction." });
  }
});

// Setup Vite Dev Server / Static Asset delivery
async function start() {
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
    console.log(`Smart Bill Splitter Server is running on port ${PORT}`);
  });
}

start();
