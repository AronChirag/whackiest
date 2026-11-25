import { GoogleGenAI } from "@google/genai";

import {
  executeFirewallTool,
  getAvailableTools,
  isMcpEnabled
} from "../../firewall/index.js";
import { runGeminiConversation } from "../services/gemini.service.js";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 8;

function validateChatInput(body) {
  if (
    !body ||
    typeof body.message !== "string" ||
    !body.message.trim() ||
    body.message.length > MAX_MESSAGE_LENGTH
  ) {
    return "A message of 1 to 2000 characters is required.";
  }

  if (body.history !== undefined) {
    if (!Array.isArray(body.history) || body.history.length > MAX_HISTORY_LENGTH) {
      return "Chat history must contain no more than 8 messages.";
    }

    const validHistory = body.history.every((item) =>
      item &&
      ["user", "model"].includes(item.role) &&
      typeof item.text === "string" &&
      item.text.length <= MAX_MESSAGE_LENGTH
    );

    if (!validHistory) {
      return "Chat history contains an invalid message.";
    }
  }

  return null;
}

export const chatWithCopilot = async (req, res) => {
  const validationError = validateChatInput(req.body);

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      success: false,
      message: "Gemini is not configured on the server."
    });
  }

  if (!isMcpEnabled() || !getAvailableTools().length) {
    return res.status(503).json({
      success: false,
      message: "Financial data tools are currently unavailable."
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const reply = await runGeminiConversation({
      generateContent: (parameters) => ai.models.generateContent({
        model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
        ...parameters
      }),
      tools: getAvailableTools(),
      executeTool: executeFirewallTool,
      userId: req.user.id,
      message: req.body.message.trim(),
      history: req.body.history || []
    });

    return res.json({
      success: true,
      reply
    });
  } catch (error) {
    console.error("Copilot request failed:", error.message);

    return res.status(502).json({
      success: false,
      message: "The copilot could not complete this request. Please try again."
    });
  }
};

export { validateChatInput };
