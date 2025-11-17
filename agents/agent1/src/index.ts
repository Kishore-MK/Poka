import { StateGraph, MessagesAnnotation, START } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemorySaver } from "@langchain/langgraph";
import * as dotenv from "dotenv";
import { tools } from "./tools.js";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import boxen from "boxen";
import { serve } from '@hono/node-server';
import app from './agent/agent-server.js';
import { ToolNode } from "@langchain/langgraph/prebuilt";

dotenv.config();

// Start Hono server in background
const port = Number(process.env.AGENT_PORT || 3000);
serve({
  fetch: app.fetch,
  port,
});

console.log(chalk.green(`✅ Agent HTTP server started on port ${port}`));


const toolNode = new ToolNode(tools);

// Initialize LangChain model with tools
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0,
}).bindTools(tools);
 

const memory = new MemorySaver();

// System prompt for the agent
const systemPrompt = `You are an AI agent with blockchain capabilities using ERC-8004 protocol.

Key workflows:

1. AGENT REGISTRATION (First time setup):
   - Use register_agent with a tokenURI (e.g., "https://example.com/agent.json")
   - Use set_agent_metadata to set your URL (key: "URL", value: "http://localhost:${port}")
   - Use get_my_agent_id to check your agent ID

2. DISCOVERING OTHER AGENTS:
   - Use discover_agent to fetch another agent's metadata and capabilities
   - This shows what actions the agent can perform

3. CALLING ANOTHER AGENT (You are the CREATOR):
   Step 1: Create intent using create_intent (with your agentId as creator, target agent ID)
   Step 2: Lock revocation using lock_revocation (with intentId)
   Step 3: Call the action using call_agent_action (with intentId, targetAgentId, actionName, params)
   Step 4: WAIT for target agent to mark status on-chain (you don't mark it yourself!)

4. RECEIVING REQUESTS FROM OTHER AGENTS (You are the TARGET):
   - Your HTTP server automatically handles incoming requests
   - After processing, it immediately marks the intent as executed/failed on-chain
   - You don't need to manually call mark_intent_executed or mark_intent_failed as creator

5. REPUTATION:
   - Use give_feedback after interactions to rate agents
   - Use get_agent_reputation to check an agent's score

6. VALIDATION:
   - Use request_validation to request verification of your work (use dummy URI for now)

IMPORTANT RULES:
- When you CREATE an intent and call another agent, DO NOT mark it as executed yourself
- Only the TARGET agent (receiving the request) marks execution status automatically
- The tools mark_intent_executed and mark_intent_failed are only for if you were to manually handle incoming requests (which is already automated in your HTTP server)

After receiving a successful response from another agent, you should:
1. Request validation using request_validation tool
2. Provide the target agent's ID, a validator address, and a URI(use a dummy one) describing the work
3. This creates an on-chain validation request for the interaction

When user asks to "talk with agent X" or "discover agent X", use discover_agent.
When user asks to "ask agent X to do Y", follow the full interaction workflow above.
Always be clear about which account you're using (AGENT or USER).

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
    console.log('🤖 Model response tool_calls:',response.tool_calls[0]?.name, response.tool_calls?.length || 0);
    
    return { messages: [response] };
  })
  .addNode("tools", toolNode)  
  .addEdge(START, "agent")
  .addConditionalEdges(
    "agent",
    (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      // If there are tool calls, go to tools node
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return "tools";
      }
      // Otherwise end
      return "__end__";
    }
  )
  .addEdge("tools", "agent");

const agent = workflow.compile({ checkpointer: memory });

const config = {
  configurable: { thread_id: "conversation-1" }
};

// Display welcome banner
console.clear();
console.log(
  boxen(
    chalk.bold.cyan('🤖 ERC-8004 AI Agent Chat\n') +
    chalk.gray('Blockchain-powered autonomous agent with\n') +
    chalk.gray('Identity, Reputation, Validation & Intent systems\n\n') +
    chalk.yellow('Commands:\n') +
    chalk.white('- "register me" - Register this agent\n') +
    chalk.white('- "discover agent [ID]" - Find another agent\n') +
    chalk.white('- "ask agent [ID] to [action]" - Call agent action\n') +
    chalk.white('- "my id" - Get your agent ID\n') +
    chalk.white('- "exit" - Quit\n'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  )
);

async function chat() {
  const response = await prompts({
    type: 'text',
    name: 'input',
    message: chalk.bold.blue('You'),
    validate: (value: any) => value.length > 0 ? true : 'Please enter a message'
  });

  if (!response.input || response.input.toLowerCase() === 'exit' || response.input.toLowerCase() === 'quit') {
    console.log(
      boxen(chalk.green.bold('👋 Goodbye! Agent server is still running.'), {
        padding: 0.5,
        borderColor: 'green',
        borderStyle: 'round'
      })
    );
    process.exit(0);
  }

  const spinner = ora(chalk.cyan('Agent thinking...')).start();

  try {
    const agentResponse = await agent.invoke(
      { messages: [{ role: "user", content: response.input }] },
      config
    );

    spinner.stop();

    const lastMessage = agentResponse.messages[agentResponse.messages.length - 1];
    
    // Check if there were tool calls
    const toolCalls = lastMessage.tool_calls || [];
    
    let displayContent = lastMessage.content;
    
    if (toolCalls.length > 0) {
      displayContent += '\n\n' + chalk.gray('🔧 Tools used: ') + 
        toolCalls.map((tc: any) => chalk.yellow(tc.name)).join(', ');
    }
    
    console.log(
      boxen(
        chalk.bold.magenta('🤖 Agent\n\n') + chalk.white(displayContent),
        {
          padding: 1,
          margin: { top: 1, bottom: 1 },
          borderStyle: 'round',
          borderColor: 'magenta'
        }
      )
    );

  } catch (error: any) {
    spinner.fail(chalk.red.bold('Error occurred'));
    console.log(chalk.red(`\n❌ ${error.message}\n`));
  }

  // Continue chat
  chat();
}

// Start chat after server is ready
setTimeout(() => {
  chat();
}, 500);