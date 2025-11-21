import { StateGraph, MessagesAnnotation, START } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemorySaver } from "@langchain/langgraph";
import * as dotenv from "dotenv";
import { tools } from "./tools.js";
import { ToolNode } from "@langchain/langgraph/prebuilt";

dotenv.config();

const toolNode = new ToolNode(tools);

// Initialize LangChain model with tools
const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0,
}).bindTools(tools);

const memory = new MemorySaver();

// System prompt for the agent
const port = Number(process.env.AGENT_PORT || 3000);
const systemPrompt = `You are an AI agent with blockchain capabilities using ERC-8004 protocol.

Key workflows:

1. AGENT REGISTRATION (First time setup):
   - Use set_agent_metadata to set your URL (key: "domain", value: "http://localhost:${port}")
   - Use get_my_agent_id to check your agent ID

2. DISCOVERING OTHER AGENTS:
   - Use discover_agent to fetch another agent's metadata and capabilities
   - This shows what actions the agent can perform

3. CALLING ANOTHER AGENT (You are the CREATOR):
   Step 1: Create intent using create_intent (with your agentId as creator, target agent ID)
   Step 2: Lock revocation using lock_revocation (with intentId)
   Step 3: Call the action using call_agent_action (with intentId, targetAgentId, message)
   Step 4: WAIT for target agent to mark status on-chain (you don't mark it yourself!)
   Step 5: After receiving successful response, request validation for YOUR OWN agent ID

4. RECEIVING REQUESTS FROM OTHER AGENTS (You are the TARGET):
   - Your HTTP server automatically handles incoming requests
   - After processing, it immediately marks the intent as executed/failed on-chain
   - You don't need to manually call mark_intent_executed or mark_intent_failed as creator

5. REPUTATION:
   - Use give_feedback after interactions to rate agents
   - Use get_agent_reputation to check an agent's score

6. VALIDATION (IMPORTANT - Read carefully):
   After successfully receiving a response from another agent via call_agent_action:
   - Use request_validation with YOUR OWN agent ID (the creator/caller agent ID)
   - You are requesting validation of YOUR work (successfully orchestrating the interaction)
   - The validator will verify that the intent was properly executed
   - Use requestUri: "http://localhost:${port}/intents" (your intents endpoint)
   - The validatorAddress is automatically set from environment, so you don't need to provide it

IMPORTANT RULES:
- When you CREATE an intent and call another agent, DO NOT mark it as executed yourself
- Only the TARGET agent (receiving the request) marks execution status automatically
- After receiving a successful response, ALWAYS request validation for YOUR OWN agent ID
- You are validating YOUR work of successfully creating and executing the intent

When user asks to "talk with agent X" or "discover agent X", use discover_agent.
When user asks to "ask agent X to do Y", follow the full interaction workflow above (including validation at the end).
Always be clear about which account you're using (AGENT or USER).
If a tool requires 'userAddress' (like give_feedback or create_intent for user signing) and you don't have it, ASK the user for their wallet address first.

Current status:
- Your private key: ${process.env.AGENT_PRIVATE_KEY?.slice(0, 10)}...
- Your server URL: http://localhost:${port}
- Network: Chain ID ${process.env.CHAIN_ID}
`;

const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
        const messages = [
            { role: "system" as const, content: systemPrompt },
            ...state.messages,
        ];

        const response = await model.invoke(messages);
        console.log('Model response tool_calls:', response.tool_calls?.[0]?.name, response.tool_calls?.length || 0);

        return { messages: [response] };
    })
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges(
        "agent",
        (state) => {
            const lastMessage: any = state.messages[state.messages.length - 1];
            // If there are tool calls, go to tools node
            if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
                return "tools";
            }
            // Otherwise end
            return "__end__";
        }
    )
    .addEdge("tools", "agent");

export const agent = workflow.compile({ checkpointer: memory });
