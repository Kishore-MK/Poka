import { tool } from "@langchain/core/tools";
import z from "zod";
import { agentStorage } from "./agent-storage.js";
import { publicClient, IDENTITY_REGISTRY_ADDRESS } from "../contract/contract-client.js";
import { identityRegistryAbi } from "../contract/contract-abis.js";

// ============================================
// AGENT DISCOVERY & INTERACTION TOOLS
// ============================================

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
      const [tokenUri, urlMetadata] = await Promise.all([
        publicClient.readContract({
          address: IDENTITY_REGISTRY_ADDRESS,
          abi: identityRegistryAbi,
          functionName: 'tokenURI',
          args: [agentIdBigInt],
        }),
        publicClient.readContract({
          address: IDENTITY_REGISTRY_ADDRESS,
          abi: identityRegistryAbi,
          functionName: 'getMetadata',
          args: [agentIdBigInt, 'domain'],
        }).catch(() => null),
      ]);

      let url = '';
      if (urlMetadata) {
        url = Buffer.from(urlMetadata.slice(2), 'hex').toString('utf8');
      }

      // Fetch capabilities from agent's server
      let capabilities = null;
      if (url) {
        try {
          const response = await fetch(`${url}/`);
          if (response.ok) {
            capabilities = await response.json();
          }
        } catch (error) {
          console.error('Failed to fetch capabilities:', error);
        }
      }

      // Cache metadata
      agentStorage.cacheAgentMetadata({
        agentId: agentIdBigInt,
        url,
        name: capabilities?.name || `Agent ${agentId}`,
        description: capabilities?.description || 'No description',
      });

      return {
        success: true,
        cached: false,
        agentId,
        tokenUri,
        url,
        capabilities: capabilities || { error: 'Could not fetch capabilities' },
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
    description: "Discover another agent by fetching its metadata and capabilities from the registry and its HTTP server.",
    schema: z.object({
      agentId: z.string().describe("Target agent ID to discover"),
    }),
  }
);

export const callAgentActionTool = tool(
  async ({ targetAgentId, actionName, params, intentId }: { targetAgentId: string; actionName: string; params: Record<string, any>; intentId: string }) => {
    try {
      const agentIdBigInt = BigInt(targetAgentId);

      // Get agent URL from cache or blockchain
      let metadata = agentStorage.getCachedAgentMetadata(agentIdBigInt);
      if (!metadata) {
        const urlMetadata = await publicClient.readContract({
          address: IDENTITY_REGISTRY_ADDRESS,
          abi: identityRegistryAbi,
          functionName: 'getMetadata',
          args: [agentIdBigInt, 'domain'],
        });
        const url = Buffer.from(urlMetadata.slice(2), 'hex').toString('utf8');

        if (!url) {
          return {
            success: false,
            error: 'Agent URL not found',
          };
        }

        metadata = { agentId: agentIdBigInt, url, name: '', description: '' };
      }

      // Call the agent's action endpoint
      const endpoint = `${metadata.url}/actions/${actionName}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-intent-id': intentId,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
          intentId,
        };
      }

      const result = await response.json();

      return {
        success: true,
        intentId,
        targetAgentId,
        actionName,
        result,
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
    description: "Call a specific action on another agent via HTTP. Must provide intentId in the request.",
    schema: z.object({
      targetAgentId: z.string().describe("Automatically pass the Target agent ID from previous discover_agent call"),
      actionName: z.string().describe("Action name to call (e.g., 'calculate', 'echo')"),
      params: z.record(z.any()).describe("Parameters to pass to the action"),
      intentId: z.string().describe("Automatically pass the Intent ID for this interaction from previous create_intent call"),
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