import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { agentStorage } from './agent-storage.js';
import { Hex } from 'viem';
import * as dotenv from 'dotenv';
import {
  agentWalletClient,
  agentAccount,
  INTENT_COORDINATOR_ADDRESS, publicClient, IDENTITY_REGISTRY_ADDRESS,
} from '../contract/contract-client.js';
import { intentCoordinatorAbi,identityRegistryAbi } from '../contract/contract-abis.js';
import { agent } from '../agent-logic.js';

dotenv.config();

const app = new Hono();

app.use('/*', cors());

// Chat endpoint
app.post('/chat', async (c) => {
  const body = await c.req.json();
  const { message, threadId = 'conversation-1' } = body;

  if (!message) {
    return c.json({ error: 'Message is required' }, 400);
  }

  try {
    const config = {
      configurable: { thread_id: threadId }
    };

    const agentResponse = await agent.invoke(
      { messages: [{ role: "user", content: message }] },
      config
    );

    const lastMessage = agentResponse.messages[agentResponse.messages.length - 1];
    const toolCalls = lastMessage.tool_calls || [];

    return c.json({
      response: lastMessage.content,
      toolCalls: toolCalls,
      threadId
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get executed intents
app.get('/intents', (c) => {
  const intents = agentStorage.getAllExecutions();
  return c.json({ intents });
});

// Agent capabilities endpoint
app.get('/', (c) => {
  const capabilities = {
    agentId: agentStorage.getMyAgentId()?.toString() || 'Not registered',
    actions: [
      {
        name: 'calculate',
        endpoint: '/actions/calculate',
        method: 'POST',
        params: ['expression'],
        description: 'Perform mathematical calculations',
      },
      {
        name: 'echo',
        endpoint: '/actions/echo',
        method: 'POST',
        params: ['message'],
        description: 'Echo back a message',
      },
      {
        name: 'generate_text',
        endpoint: '/actions/generate_text',
        method: 'POST',
        params: ['prompt'],
        description: 'Generate text based on a prompt',
      },
    ],
  };

  return c.json(capabilities);
});

// Action: Calculate
app.post('/actions/calculate', async (c) => {
  console.log('\n=== Calculate Action Called ===');
  const intentId = c.req.header('x-intent-id') as Hex;
  console.log(`Intent ID: ${intentId}`);

  try {
    if (!intentId) {
      console.log('❌ Missing intent ID');
      return c.json({ success: false, error: 'Missing intent ID in header' }, 400);
    }

    const body = await c.req.json();
    console.log('Request body:', body);
    const { expression } = body;

    if (!expression) {
      console.log('❌ Missing expression');
      return c.json({ success: false, error: 'Missing expression parameter' }, 400);
    }

    let result;
    try {
      result = Function(`'use strict'; return (${expression})`)();
      console.log(`✅ Calculation result: ${expression} = ${result}`);
    } catch (error) {
      console.log('❌ Invalid expression:', error);

      // Mark failed on-chain immediately
      console.log('📝 Marking intent as failed on-chain...');
      await agentWalletClient.writeContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'markFailed',
        args: [intentId, 'Invalid expression'],
        account: agentAccount,
      });
      console.log('✅ Intent marked as failed on-chain');

      return c.json({ success: false, error: 'Invalid expression', intentId }, 400);
    }


    // Mark executed on-chain immediately
    console.log('📝 Marking intent as executed on-chain...');
    const hash = await agentWalletClient.writeContract({
      address: INTENT_COORDINATOR_ADDRESS,
      abi: intentCoordinatorAbi,
      functionName: 'markExecuted',
      args: [intentId],
      account: agentAccount,
    });
    console.log(`✅ Intent marked as executed on-chain. Tx: ${hash}`);

    // Update execution result with transaction hash
    agentStorage.storeIntentExecution({
      intentId,
      result: { expression, answer: result },
      timestamp: Date.now(),
      success: true,
      transactionHash: hash,
    });

    return c.json({
      success: true,
      intentId,
      action: 'calculate',
      result: { expression, answer: result },
    });
  } catch (error: any) {
    console.log('❌ Error:', error.message);

    // Mark failed on-chain immediately
    try {
      console.log('📝 Marking intent as failed on-chain...');
      await agentWalletClient.writeContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'markFailed',
        args: [intentId, error.message],
        account: agentAccount,
      });
      console.log('✅ Intent marked as failed on-chain');
    } catch (onChainError: any) {
      console.log('❌ Failed to mark intent as failed on-chain:', onChainError.message);
    }

    return c.json({ success: false, error: error.message }, 500);
  }
});

// Action: Echo
app.post('/actions/echo', async (c) => {
  console.log('\n=== Echo Action Called ===');
  const intentId = c.req.header('x-intent-id') as Hex;
  console.log(`Intent ID: ${intentId}`);

  try {
    if (!intentId) {
      console.log('❌ Missing intent ID');
      return c.json({ success: false, error: 'Missing intent ID in header' }, 400);
    }

    const body = await c.req.json();
    console.log('Request body:', body);
    const { message } = body;

    if (!message) {
      console.log('❌ Missing message');
      return c.json({ success: false, error: 'Missing message parameter' }, 400);
    }

    const result = { echo: message };
    console.log(`✅ Echo result:`, result);


    // Mark executed on-chain immediately
    console.log('📝 Marking intent as executed on-chain...');
    const hash = await agentWalletClient.writeContract({
      address: INTENT_COORDINATOR_ADDRESS,
      abi: intentCoordinatorAbi,
      functionName: 'markExecuted',
      args: [intentId],
      account: agentAccount,
    });
    console.log(`✅ Intent marked as executed on-chain. Tx: ${hash}`);

    // Update execution result with transaction hash
    agentStorage.storeIntentExecution({
      intentId,
      result,
      timestamp: Date.now(),
      success: true,
      transactionHash: hash,
    });

    return c.json({
      success: true,
      intentId,
      action: 'echo',
      result,
    });
  } catch (error: any) {
    console.log('❌ Error:', error.message);

    // Mark failed on-chain immediately
    try {
      console.log('📝 Marking intent as failed on-chain...');
      await agentWalletClient.writeContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'markFailed',
        args: [intentId, error.message],
        account: agentAccount,
      });
      console.log('✅ Intent marked as failed on-chain');
    } catch (onChainError: any) {
      console.log('❌ Failed to mark intent as failed on-chain:', onChainError.message);
    }

    return c.json({ success: false, error: error.message }, 500);
  }
});

// Action: Generate Text
app.post('/actions/generate_text', async (c) => {
  console.log('\n=== Generate Text Action Called ===');
  const intentId = c.req.header('x-intent-id') as Hex;
  console.log(`Intent ID: ${intentId}`);

  try {
    if (!intentId) {
      console.log('❌ Missing intent ID');
      return c.json({ success: false, error: 'Missing intent ID in header' }, 400);
    }

    const body = await c.req.json();
    console.log('Request body:', body);
    const { prompt } = body;

    if (!prompt) {
      console.log('❌ Missing prompt');
      return c.json({ success: false, error: 'Missing prompt parameter' }, 400);
    }

    const result = {
      prompt,
      generatedText: `Generated response for: ${prompt}`,
    };
    console.log(`✅ Generated text result:`, result);


    // Mark executed on-chain immediately
    console.log('📝 Marking intent as executed on-chain...');
    const hash = await agentWalletClient.writeContract({
      address: INTENT_COORDINATOR_ADDRESS,
      abi: intentCoordinatorAbi,
      functionName: 'markExecuted',
      args: [intentId],
      account: agentAccount,
    });
    console.log(`✅ Intent marked as executed on-chain. Tx: ${hash}`);

    // Update execution result with transaction hash
    agentStorage.storeIntentExecution({
      intentId,
      result,
      timestamp: Date.now(),
      success: true,
      transactionHash: hash,
    });

    return c.json({
      success: true,
      intentId,
      action: 'generate_text',
      result,
    });
  } catch (error: any) {
    console.log('❌ Error:', error.message);

    // Mark failed on-chain immediately
    try {
      console.log('📝 Marking intent as failed on-chain...');
      await agentWalletClient.writeContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'markFailed',
        args: [intentId, error.message],
        account: agentAccount,
      });
      console.log('✅ Intent marked as failed on-chain');
    } catch (onChainError: any) {
      console.log('❌ Failed to mark intent as failed on-chain:', onChainError.message);
    }

    return c.json({ success: false, error: error.message }, 500);
  }
});

// Verify intent endpoint
app.get('/verify-intent/:intentId', (c) => {
  console.log('\n=== Verify Intent Called ===');
  const intentId = c.req.param('intentId') as Hex;
  console.log(`Intent ID: ${intentId}`);

  const executionData = agentStorage.getIntentExecution(intentId);

  if (!executionData) {
    console.log('❌ Intent not found');
    return c.json({ success: false, error: 'Intent not found' }, 404);
  }

  console.log('✅ Intent found:', executionData);
  return c.json({
    success: true,
    ...executionData,
  });
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

export default app;

async function checkRegistration() {
  console.log('🔍 Checking registration status...');
  try {
    const balance = await publicClient.readContract({
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: identityRegistryAbi,
      functionName: 'balanceOf',
      args: [agentAccount.address],
    });

    if (balance > 0n) {
      const agentId = await publicClient.readContract({
        address: IDENTITY_REGISTRY_ADDRESS,
        abi: identityRegistryAbi,
        functionName: 'tokenOfOwnerByIndex',
        args: [agentAccount.address, 0n],
      });

      console.log(`✅ Agent is registered! Agent ID: ${agentId}`);
      agentStorage.setMyAgentId(agentId);
    } else {
      console.log('ℹ️ Agent is not registered yet.');
    }
  } catch (error) {
    console.error('❌ Failed to check registration:', error);
  }
}


// Run check immediately and then every 30 seconds
checkRegistration();
setInterval(checkRegistration, 30000);

// Start server
const port = Number(process.env.AGENT_PORT || 3000);
console.log(`🚀 Agent server running on http://localhost:${port}`);