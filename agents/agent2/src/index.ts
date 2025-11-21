import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { agentStorage } from './agent/agent-storage.js';
import { Hex } from 'viem';
import * as dotenv from 'dotenv';
import chalk from "chalk";
import boxen from "boxen";
import {
  agentWalletClient,
  agentAccount,
  INTENT_COORDINATOR_ADDRESS, publicClient, IDENTITY_REGISTRY_ADDRESS,
} from './contract/contract-client.js';
import { identityRegistryAbi } from './contract/contract-abis.js';
import { agentRegistryService } from './agent/agent-registry-service.js';
import { agent } from './agent-logic.js';
import {
  DefaultRequestHandler,
  JsonRpcTransportHandler,
  InMemoryTaskStore,
  DefaultExecutionEventBusManager,
  InMemoryPushNotificationStore,
  DefaultPushNotificationSender
} from '@a2a-js/sdk/server';
import { A2AAgentExecutor } from './agent/a2a-agent.js';

dotenv.config();

const app = new Hono();

app.use('/*', cors());

// Initialize A2A components
const taskStore = new InMemoryTaskStore();
const eventBusManager = new DefaultExecutionEventBusManager();
const pushNotificationStore = new InMemoryPushNotificationStore();
const pushNotificationSender = new DefaultPushNotificationSender(pushNotificationStore);
const agentExecutor = new A2AAgentExecutor();

// Placeholder Agent Card - will be updated when registration is checked
let agentCard: any = {
  kind: 'agent',
  id: 'pending-registration',
  name: 'Agent1',
  description: 'An ERC-8004 compliant AI Agent',
  protocolVersion: '0.3.0',
  version: '0.1.0',
  skills: [
    { id: 'chat', name: 'Chat', description: 'Chat with the agent', tags: ['chat'] },
    { id: 'calculate', name: 'Calculate', description: 'Perform mathematical calculations', tags: ['math'] },
    { id: 'echo', name: 'Echo', description: 'Echo back a message', tags: ['utility'] },
    { id: 'generate_text', name: 'Generate Text', description: 'Generate text based on a prompt', tags: ['ai', 'text'] }
  ],
  capabilities: {},
  defaultInputModes: ['text'],
  url: `http://localhost:${process.env.AGENT_PORT || 3000}`
};

// Initialize Request Handler (will be re-initialized if agent ID changes)
let requestHandler = new DefaultRequestHandler(
  agentCard,
  taskStore,
  agentExecutor,
  eventBusManager,
  pushNotificationStore,
  pushNotificationSender
);

let transportHandler = new JsonRpcTransportHandler(requestHandler);

// Serve Agent Card
app.get('/.well-known/agent-card.json', (c) => {
  return c.json(agentCard);
});

// A2A JSON-RPC Endpoint
app.post('/', async (c) => {
  const body = await c.req.json();
  const response = await transportHandler.handle(body);
  return c.json(response);
});

// Chat endpoint (Legacy/Direct)
app.post('/chat', async (c) => {
  const body = await c.req.json();
  const { message, threadId = 'conversation-1', userAddress } = body;

  if (!message) {
    return c.json({ error: 'Message is required' }, 400);
  }

  try {
    const config = {
      configurable: { thread_id: threadId }
    };

    const agentResponse = await agent.invoke(
      { messages: [{ role: "user", content: message + "\n\nUser Address: " + userAddress }] },
      config
    );

    const lastMessage = agentResponse.messages[agentResponse.messages.length - 1];
    const toolCalls = (lastMessage as any).tool_calls || [];

    // Check if any tool call result contains a signature request
    let signatureRequest = null;
    for (const msg of agentResponse.messages) {
      if (msg.content && typeof msg.content === 'string') {
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed.requiresSignature && parsed.signatureRequest) {
            signatureRequest = parsed.signatureRequest;
            break;
          }
        } catch (e) {
          // Not JSON, continue
        }
      }
    }

    const response: any = {
      response: lastMessage.content,
      toolCalls: toolCalls,
      threadId
    };

    // If there's a signature request, add it to the response
    if (signatureRequest) {
      response.signatureRequest = signatureRequest;
    }

    return c.json(response);
  } catch (error: any) {
    console.error('Chat error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get executed intents
app.get('/intents', (c) => {
  const intents = agentStorage.getAllExecutions();
  // Convert BigInt values to strings for JSON serialization
  const serializedIntents = intents.map(intent => ({
    ...intent,
    targetAgentId: intent.targetAgentId?.toString(),
    creatorAgentId: intent.creatorAgentId?.toString(),
  }));
  return c.json({ intents: serializedIntents });
});


// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

async function checkRegistration() {
  console.log('Checking registration status...');
  try {
    // Check local storage first (fastest)
    let agentId = agentStorage.getMyAgentId();

    // If we have an ID, verify ownership and proceed
    if (agentId) {
      console.log(`Using cached/configured Agent ID: ${agentId}`);

      // Verify ownership (optional but good practice)
      try {
        const owner = await agentRegistryService.getOwner(agentId);
        if (owner.toLowerCase() !== agentAccount.address.toLowerCase()) {
          console.warn(`Warning: Agent ${agentId} is owned by ${owner}, but current account is ${agentAccount.address}`);
        }
      } catch (e) {
        console.warn('Could not verify ownership of cached agent ID');
      }

      await initializeAgent(agentId);
      return;
    }

    // If no ID, check balance on chain
    const balance = await agentRegistryService.getBalanceOf(agentAccount.address);

    if (balance > 0n) {
      console.log('Agent detected on chain, but ID is unknown locally.');

      try {
        agentId = await agentRegistryService.getAgentIdByOwner(agentAccount.address);

        console.log(`Discovered Agent ID from chain: ${agentId}`);
        agentStorage.setMyAgentId(agentId);
        await initializeAgent(agentId);
      } catch (error) {
        console.error('Failed to discover Agent ID from chain:', error);
        console.log('Please set AGENT_ID in .env to skip discovery.');
      }

    } else {
      console.log('Agent is not registered yet.');
    }
  } catch (error) {
    console.error('Failed to check registration:', error);
  }
}

async function initializeAgent(agentId: bigint) {
  // Fetch metadata from blockchain
  const [name, description, url] = await agentRegistryService.getMetadataBatch(agentId, ['name', 'description', 'domain']);

  // Update Agent Card with real ID and metadata if available
  agentCard.id = agentId.toString();

  if (name) agentCard.name = name;
  if (description) agentCard.description = description;
  if (url) agentCard.url = url;

  console.log('Updated Agent Card:', {
    id: agentCard.id,
    name: agentCard.name,
    description: agentCard.description,
    url: agentCard.url
  });

  requestHandler = new DefaultRequestHandler(
    agentCard,
    taskStore,
    agentExecutor,
    eventBusManager,
    pushNotificationStore,
    pushNotificationSender
  );
  transportHandler = new JsonRpcTransportHandler(requestHandler);
}


// Run check immediately and then every 30 seconds
checkRegistration();
// setInterval(checkRegistration, 30 * 1000);

// Start server
const port = Number(process.env.AGENT_PORT || 3000);
serve({
  fetch: app.fetch,
  port,
});

console.log(chalk.green(`✅ Agent HTTP server started on port ${port}`));

// Display welcome banner
console.clear();
console.log(
  boxen(
    chalk.bold.cyan('🤖 ERC-8004 AI Agent Server\n') +
    chalk.gray('Blockchain-powered autonomous agent with\n') +
    chalk.gray('Identity, Reputation, Validation & Intent systems\n\n') +
    chalk.yellow('Status: ') + chalk.green('Online') + '\n' +
    chalk.yellow('Port: ') + chalk.white(port),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  )
);