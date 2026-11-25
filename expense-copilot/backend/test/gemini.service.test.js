import assert from "node:assert/strict";
import test from "node:test";

import { runGeminiConversation } from "../src/services/gemini.service.js";

test("Gemini can execute an allowlisted MCP function for the authenticated user", async () => {
  const requests = [];
  const executedTools = [];
  const tools = [{
    name: "get_transactions",
    description: "Read transactions.",
    parametersJsonSchema: {
      type: "object",
      properties: { limit: { type: "integer" } }
    }
  }];

  const reply = await runGeminiConversation({
    tools,
    userId: 17,
    message: "Show my recent spending.",
    history: [{ role: "user", text: "Earlier question" }],
    executeTool: async (request) => {
      executedTools.push(request);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ transactions: [{ merchant: "Cafe", amount: 12 }] })
        }]
      };
    },
    generateContent: async (request) => {
      requests.push(request);

      if (requests.length === 1) {
        return {
          candidates: [{
            content: {
              role: "model",
              parts: [{
                functionCall: {
                  id: "call-1",
                  name: "get_transactions",
                  args: { limit: 5 }
                }
              }]
            }
          }]
        };
      }

      return {
        text: "You spent 12 at Cafe.",
        candidates: [{
          content: {
            role: "model",
            parts: [{ text: "You spent 12 at Cafe." }]
          }
        }]
      };
    }
  });

  assert.equal(reply, "You spent 12 at Cafe.");
  assert.deepEqual(executedTools, [{
    toolName: "get_transactions",
    arguments: { limit: 5 },
    userId: 17
  }]);
  assert.equal(requests[0].contents[0].role, "user");
  assert.equal(requests[0].contents[1].parts[0].text, "Show my recent spending.");
  assert.equal(
    requests[0].config.tools[0].functionDeclarations[0].name,
    "get_transactions"
  );
  assert.equal(requests[1].contents[3].parts[0].functionResponse.id, "call-1");
});

test("Gemini tool failure is returned to the model without exposing internals", async () => {
  const requests = [];
  let generation = 0;

  await runGeminiConversation({
    tools: [{
      name: "get_statement_summary",
      parametersJsonSchema: { type: "object", properties: {} }
    }],
    userId: 9,
    message: "Summarize my account.",
    executeTool: async () => {
      throw new Error("database credentials leaked");
    },
    generateContent: async (request) => {
      requests.push(request);
      generation += 1;

      if (generation === 1) {
        return {
          candidates: [{
            content: {
              role: "model",
              parts: [{
                functionCall: {
                  name: "get_statement_summary",
                  args: {}
                }
              }]
            }
          }]
        };
      }

      return {
        text: "I could not retrieve your statement.",
        candidates: [{ content: { role: "model", parts: [{ text: "Done." }] } }]
      };
    }
  });

  const functionResponse = requests[1].contents[2].parts[0].functionResponse;
  assert.deepEqual(functionResponse.response, {
    error: "The requested financial data could not be retrieved."
  });
  assert.equal(
    JSON.stringify(functionResponse).includes("database credentials leaked"),
    false
  );
});
