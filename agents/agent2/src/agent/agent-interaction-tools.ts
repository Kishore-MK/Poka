import { tool } from "@langchain/core/tools";
import z from "zod";
import { agentStorage } from "./agent-storage.js";
import { publicClient, IDENTITY_REGISTRY_ADDRESS } from "../contract/contract-client.js";
import { identityRegistryAbi } from "../contract/contract-abis.js";
import { agentRegistryService } from "./agent-registry-service.js";
import { A2AClient } from '@a2a-js/sdk/client';

export const discoverAgentTool = tool(
  async ({ agentId }: { agentId: string }) => {
    try {
      const agentIdBigInt = BigInt(agentId);

      // Check cache first
      const cached = agentStorage.getCachedAgentMetadata(agentIdBigInt);
      if (cached) {
        return {
          success: true,
          cached: true,
          ...cached,
          agentId: cached.agentId.toString(),
        };
      }

      // Fetch from blockchain
      const [tokenUri, url] = await Promise.all([
        agentRegistryService.getTokenURI(agentIdBigInt),
        agentRegistryService.getMetadata(agentIdBigInt, 'domain'),
      ]);

      // Fetch capabilities from agent's server (Agent Card)
      let skills = null;
      let agentCardUrl = '';
      if (url) {
        try {
          // Try standard location
          agentCardUrl = `${url}/.well-known/agent-card.json`;
          const response = await fetch(agentCardUrl);
          if (response.ok) {
            skills = await response.json();
          } else {
            // Fallback to root if legacy or different structure (though we expect standard now)
            const rootResponse = await fetch(`${url}/`);
            if (rootResponse.ok) {
              skills = await rootResponse.json();
            }
          }
        } catch (error) {
          console.error('Failed to fetch skills:', error);
        }
      }

      // Cache metadata
      agentStorage.cacheAgentMetadata({
        agentId: agentIdBigInt,
        url: url || '',
        name: skills?.name || `Agent ${agentId}`,
        description: skills?.description || 'No description',
      });

      return {
        success: true,
        cached: false,
        agentId,
        tokenUri,
        url,
        agentCardUrl,
        skills: skills || { error: 'Could not fetch skills' },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "discover_agent",
    description: "Discover another agent by fetching its metadata and skills (Agent Card) from the registry and its HTTP server.",
    schema: z.object({
      agentId: z.string().describe("Target agent ID to discover"),
    }),
  }
);

export const callAgentActionTool = tool(
  async ({ targetAgentId, message, intentId }: { targetAgentId: string; message: string; intentId: string }) => {
    try {
      const agentIdBigInt = BigInt(targetAgentId);

      // Get agent URL from cache or blockchain
      let metadata = agentStorage.getCachedAgentMetadata(agentIdBigInt);
      if (!metadata) {
        const url = await agentRegistryService.getMetadata(agentIdBigInt, 'domain');

        if (!url) {
          return {
            success: false,
            error: 'Agent URL not found',
          };
        }

        metadata = { agentId: agentIdBigInt, url, name: '', description: '' };
      }

      const agentCardUrl = `${metadata.url}/.well-known/agent-card.json`;

      // Instantiate A2A Client
      const client = await A2AClient.fromCardUrl(agentCardUrl);

      // Send Message
      const messageId = crypto.randomUUID();
      const response = await client.sendMessage({
        message: {
          id: messageId,
          messageId: messageId, // A2A protocol requires messageId field
          role: 'user',
          content: message,
          kind: 'message',
          created: new Date().toISOString(),
          sender: {
            kind: 'agent',
            id: agentStorage.getMyAgentId()?.toString() || 'unknown'
          },
          extensions: intentId ? [`intent:${intentId}`] : [] // Pass intent ID as extension if needed
        },
      });

      return {
        success: true,
        intentId,
        targetAgentId,
        response,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "call_agent_action",
    description: "Send a message to another agent using the A2A Protocol.",
    schema: z.object({
      targetAgentId: z.string().describe("Target agent ID"),
      message: z.string().describe("The message content to send to the agent"),
      intentId: z.string().describe("The Intent ID for this interaction"),
    }),
  }
);

export const getMyAgentIdTool = tool(
  async () => {
    try {
      const myAgentId = agentStorage.getMyAgentId();

      if (!myAgentId) {
        return {
          success: false,
          error: 'Agent not registered yet. Use register_agent first.',
        };
      }

      return {
        success: true,
        myAgentId: myAgentId.toString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "get_my_agent_id",
    description: "Get this agent's registered ID from local storage.",
    schema: z.object({}),
  }
);