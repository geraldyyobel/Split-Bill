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
    const { query, items, participants } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Command query is required." });
    }

    let client;
    try {
      client = getAiClient();
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
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

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
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
    return res.status(200).json(commandResult);
  } catch (error: any) {
    console.error("Chat command parsing failed:", error);
    return res.status(500).json({ error: error.message || "Failed to process split instruction." });
  }
}
