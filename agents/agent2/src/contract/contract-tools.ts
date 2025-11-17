import { tool } from "@langchain/core/tools";
import z from "zod";
import {
  publicClient,
  agentWalletClient,
  userWalletClient,
  agentAccount,
  userAccount,
  waitForTransaction,
  IDENTITY_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ADDRESS,
  VALIDATION_REGISTRY_ADDRESS,
  INTENT_COORDINATOR_ADDRESS,
  customChain,
} from "./contract-client.js";
import {
  identityRegistryAbi,
  reputationRegistryAbi,
  validationRegistryAbi,
  intentCoordinatorAbi,
} from "./contract-abis.js";
import { Hex, keccak256, encodePacked, hexToBytes } from "viem";
import { agentStorage } from "../agent/agent-storage.js";

// ============================================
// IDENTITY REGISTRY TOOLS
// ============================================

export const registerAgentTool = tool(
  async ({ tokenUri }: { tokenUri: string }) => {
    try {
      const { request, result: agentId } = await publicClient.simulateContract({
        address: IDENTITY_REGISTRY_ADDRESS,
        abi: identityRegistryAbi,
        functionName: 'register',
        args: [tokenUri],
        account: agentAccount,
      });

      const hash = await agentWalletClient.writeContract(request);
      const receipt = await waitForTransaction(hash);

      console.log("agentId:", agentId);

      agentStorage.setMyAgentId(agentId);

      return {
        success: true,
        agentId: agentId.toString(),
        txHash: hash,
        message: `Agent registered with ID: ${agentId}`,
      };
    } catch (error: any) {
      return{
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "register_agent",
    description: "Register this agent in the Identity Registry. Creates an on-chain agent identity with metadata URI. Use AGENT account.",
    schema: z.object({
      tokenUri: z.string().describe("URI pointing to agent metadata JSON (e.g., https://example.com/agent.json or ipfs://...)"),
    }),
  }
);

export const setAgentMetadataTool = tool(
  async ({ agentId, key, value }: { agentId: string; key: string; value: string }) => {
    try {
      const agentIdBigInt = BigInt(agentId);
      const valueBytes = `0x${Buffer.from(value).toString('hex')}` as Hex;

      const { request } = await publicClient.simulateContract({
        address: IDENTITY_REGISTRY_ADDRESS,
        abi: identityRegistryAbi,
        functionName: 'setMetadata',
        args: [agentIdBigInt, key, valueBytes],
        account: agentAccount,
      });

      const hash = await agentWalletClient.writeContract(request);
      await waitForTransaction(hash);

      return {
        success: true,
        txHash: hash,
        message: `Metadata set: ${key} = ${value}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "set_agent_metadata",
    description: "Set metadata for an agent (e.g., URL, wallet address). Use AGENT account.",
    schema: z.object({
      agentId: z.string().describe("Agent ID"),
      key: z.string().describe("Metadata key (e.g., 'URL', 'agentWallet')"),
      value: z.string().describe("Metadata value"),
    }),
  }
);

export const getAgentMetadataTool = tool(
  async ({ agentId, key }: { agentId: string; key: string }) => {
    try {
      const agentIdBigInt = BigInt(agentId);

      const metadata:any = await publicClient.readContract({
        address: IDENTITY_REGISTRY_ADDRESS,
        abi: identityRegistryAbi,
        functionName: 'getMetadata',
        args: [agentIdBigInt, key],
      });

      const value = Buffer.from(metadata.slice(2), 'hex').toString('utf8');

      return JSON.stringify({
        success: true,
        key,
        value,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  },
  {
    name: "get_agent_metadata",
    description: "Get metadata for an agent by key (e.g., fetch agent's URL).",
    schema: z.object({
      agentId: z.string().describe("Agent ID to query"),
      key: z.string().describe("Metadata key to retrieve (e.g., 'URL')"),
    }),
  }
);

export const getAgentInfoTool = tool(
  async ({ agentId }: { agentId: string }) => {
    try {
      const agentIdBigInt = BigInt(agentId);

      const [exists, owner, tokenUri] = await Promise.all([
        publicClient.readContract({
          address: IDENTITY_REGISTRY_ADDRESS,
          abi: identityRegistryAbi,
          functionName: 'agentExists',
          args: [agentIdBigInt],
        }),
        publicClient.readContract({
          address: IDENTITY_REGISTRY_ADDRESS,
          abi: identityRegistryAbi,
          functionName: 'ownerOf',
          args: [agentIdBigInt],
        }),
        publicClient.readContract({
          address: IDENTITY_REGISTRY_ADDRESS,
          abi: identityRegistryAbi,
          functionName: 'tokenURI',
          args: [agentIdBigInt],
        }),
      ]);

      return JSON.stringify({
        success: true,
        agentId,
        exists,
        owner,
        tokenUri,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  },
  {
    name: "get_agent_info",
    description: "Get basic information about an agent (exists, owner, tokenURI).",
    schema: z.object({
      agentId: z.string().describe("Agent ID to query"),
    }),
  }
);

// ============================================
// REPUTATION REGISTRY TOOLS
// ============================================

export const giveFeedbackTool = tool(
  async ({ agentId, score, tag1, tag2, uri }: { agentId: string; score: number; tag1?: string; tag2?: string; uri?: string }) => {
    try {
      const agentIdBigInt = BigInt(agentId);

      // Get last feedback index
      const lastIndex:any = await publicClient.readContract({
        address: REPUTATION_REGISTRY_ADDRESS,
        abi: reputationRegistryAbi,
        functionName: 'getLastIndex',
        args: [agentIdBigInt, userAccount.address],
      });

      // Create feedbackAuth (simplified - in production, agent owner should sign)
      const feedbackAuth = {
        agentId: agentIdBigInt,
        clientAddress: userAccount.address,
        indexLimit: lastIndex + 10n, // Allow multiple feedback
        expiry: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours
        chainId: BigInt(customChain.id),
        identityRegistry: IDENTITY_REGISTRY_ADDRESS,
        signerAddress: agentAccount.address,
      };

      const tag1Bytes = (tag1 ? `0x${Buffer.from(tag1).toString('hex').padEnd(64, '0')}` : '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex;
      const tag2Bytes = (tag2 ? `0x${Buffer.from(tag2).toString('hex').padEnd(64, '0')}` : '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex;

      const { request } = await publicClient.simulateContract({
        address: REPUTATION_REGISTRY_ADDRESS,
        abi: reputationRegistryAbi,
        functionName: 'giveFeedback',
        args: [
          agentIdBigInt,
          feedbackAuth,
          score,
          tag1Bytes,
          tag2Bytes,
          uri || '',
          '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
        ],
        account: userAccount,
      });

      const hash = await userWalletClient.writeContract(request);
      await waitForTransaction(hash);

      return JSON.stringify({
        success: true,
        txHash: hash,
        message: `Feedback given: Score ${score}/100`,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  },
  {
    name: "give_feedback",
    description: "Give feedback/rating to an agent after interaction. Use USER account. Score is 0-100.",
    schema: z.object({
      agentId: z.string().describe("Agent ID to rate"),
      score: z.number().min(0).max(100).describe("Feedback score (0-100)"),
      tag1: z.string().optional().describe("Optional tag 1"),
      tag2: z.string().optional().describe("Optional tag 2"),
      uri: z.string().optional().describe("Optional URI for detailed feedback"),
    }),
  }
);

export const getAgentReputationTool = tool(
  async ({ agentId }: { agentId: string }) => {
    try {
      const agentIdBigInt = BigInt(agentId);

      const summary:any = await publicClient.readContract({
        address: REPUTATION_REGISTRY_ADDRESS,
        abi: reputationRegistryAbi,
        functionName: 'getSummary',
        args: [
          agentIdBigInt,
          [],
          '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
        ],
      });

      return JSON.stringify({
        success: true,
        agentId,
        feedbackCount: summary[0].toString(),
        averageScore: summary[1],
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  },
  {
    name: "get_agent_reputation",
    description: "Get reputation summary for an agent (feedback count and average score).",
    schema: z.object({
      agentId: z.string().describe("Agent ID to query"),
    }),
  }
);

// ============================================
// VALIDATION REGISTRY TOOLS
// ============================================

export const requestValidationTool = tool(
  async ({ agentId, validatorAddress, requestUri, tag }: { agentId: string; validatorAddress: string; requestUri: string; tag?: string }) => {
    try {
      const agentIdBigInt = BigInt(agentId);
      const requestHash = keccak256(encodePacked(['string', 'uint256'], [requestUri, BigInt(Date.now())]));
      const tagBytes = (tag ? `0x${Buffer.from(tag).toString('hex').padEnd(64, '0')}` : '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex;

      const { request } = await publicClient.simulateContract({
        address: VALIDATION_REGISTRY_ADDRESS,
        abi: validationRegistryAbi,
        functionName: 'requestValidation',
        args: [agentIdBigInt, validatorAddress as Hex, requestUri, requestHash, tagBytes],
        account: agentAccount,
      });

      const hash = await agentWalletClient.writeContract(request);
      await waitForTransaction(hash);

      return JSON.stringify({
        success: true,
        txHash: hash,
        requestHash,
        message: 'Validation requested',
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  },
  {
    name: "request_validation",
    description: "Request validation for agent work from a validator. Use AGENT account.",
    schema: z.object({
      agentId: z.string().describe("Agent ID requesting validation"),
      validatorAddress: z.string().describe("Validator's Ethereum address"),
      requestUri: z.string().describe("URI containing validation request data (use dummy for now)"),
      tag: z.string().optional().describe("Optional tag for categorization"),
    }),
  }
);

// ============================================
// INTENT COORDINATOR TOOLS
// ============================================

export const createIntentTool = tool(
  async ({ creatorAgentId, targetAgentId, expiresInSeconds }: { creatorAgentId: string; targetAgentId: string; expiresInSeconds: number }) => {
    try {
      const creatorAgentIdBigInt = BigInt(creatorAgentId);
      const targetAgentIdBigInt = BigInt(targetAgentId);

      // Get user nonce
      const nonce : any = await publicClient.readContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'getUserNonce',
        args: [userAccount.address],
      });

      const newNonce = nonce + 1n;
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + expiresInSeconds);

      // Create message hash for signing
      const messageHash = keccak256(
        encodePacked(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
          [userAccount.address, creatorAgentIdBigInt, targetAgentIdBigInt, newNonce, expiresAt, BigInt(customChain.id), INTENT_COORDINATOR_ADDRESS]
        )
      );

      // Sign with user account
      const signature = await userAccount.signMessage({
        message: { raw: messageHash },
      });

      // Create intent on-chain
      const { request } = await publicClient.simulateContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'createIntent',
        args: [creatorAgentIdBigInt, targetAgentIdBigInt, expiresAt, userAccount.address, newNonce, signature],
        account: agentAccount,
      });

      const hash = await agentWalletClient.writeContract(request);
      const receipt = await waitForTransaction(hash);

      // Parse intentId from event logs
      const log = receipt.logs.find(
        (log) => log.address.toLowerCase() === INTENT_COORDINATOR_ADDRESS.toLowerCase()
      );

      const intentId = log?.topics[1] || '0x0' as Hex;

      return {
        success: true,
        intentId: intentId,
        txHash: hash,
        expiresAt: expiresAt.toString(),
        message: 'Intent created successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "create_intent",
    description: "Create an intent for agent-to-agent interaction. User signs the intent, agent submits it. Use AGENT account to submit.",
    schema: z.object({
      creatorAgentId: z.string().describe("Creator agent ID (usually your own agent)"),
      targetAgentId: z.string().describe("Target agent ID to interact with"),
      expiresInSeconds: z.number().default(300).describe("Intent expiration time in seconds (default 300 = 5 minutes)"),
    }),
  }
);

export const lockRevocationTool = tool(
  async ({ intentId }: { intentId: string }) => {
    try {
      const hash = await agentWalletClient.writeContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'lockRevocation',
        args: [intentId as Hex],
        account: agentAccount,
      });
 
      await waitForTransaction(hash);

      return {
        success: true,
        txHash: hash,
        message: 'Revocation locked - ready to send HTTP request',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "lock_revocation",
    description: "Lock revocation before sending HTTP request to target agent. Use AGENT account (creator agent only).",
    schema: z.object({
      intentId: z.string().describe("Intent ID to lock"),
    }),
  }
);

export const markIntentExecutedTool = tool(
  async ({ intentId }: { intentId: string }) => {
    try {
      const { request } = await publicClient.simulateContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'markExecuted',
        args: [intentId as Hex],
        account: agentAccount,
      });

      const hash = await agentWalletClient.writeContract(request);
      await waitForTransaction(hash);

      return {
        success: true,
        txHash: hash,
        message: 'Intent marked as executed',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "mark_intent_executed",
    description: "Mark intent as executed after successful action. Use AGENT account (target agent only).",
    schema: z.object({
      intentId: z.string().describe("Intent ID to mark as executed"),
    }),
  }
);

export const markIntentFailedTool = tool(
  async ({ intentId, reason }: { intentId: string; reason: string }) => {
    try {
      const { request } = await publicClient.simulateContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'markFailed',
        args: [intentId as Hex, reason],
        account: agentAccount,
      });

      const hash = await agentWalletClient.writeContract(request);
      await waitForTransaction(hash);

      return {
        success: true,
        txHash: hash,
        message: `Intent marked as failed: ${reason}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "mark_intent_failed",
    description: "Mark intent as failed if action couldn't be completed. Use AGENT account (target agent only).",
    schema: z.object({
      intentId: z.string().describe("Intent ID to mark as failed"),
      reason: z.string().describe("Failure reason"),
    }),
  }
);

export const revokeIntentTool = tool(
  async ({ intentId }: { intentId: string }) => {
    try {
      const { request } = await publicClient.simulateContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'revokeIntent',
        args: [intentId as Hex],
        account: userAccount,
      });

      const hash = await userWalletClient.writeContract(request);
      await waitForTransaction(hash);

      return {
        success: true,
        txHash: hash,
        message: 'Intent revoked',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "revoke_intent",
    description: "Revoke an active intent before execution. Use USER account.",
    schema: z.object({
      intentId: z.string().describe("Intent ID to revoke"),
    }),
  }
);

export const getIntentInfoTool = tool(
  async ({ intentId }: { intentId: string }) => {
    try {
      const intentInfo:any = await publicClient.readContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'getIntent',
        args: [intentId as Hex],
      });

      const isValid = await publicClient.readContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'isIntentValid',
        args: [intentId as Hex],
      });

      const statusNames = ['Pending', 'Executed', 'Failed', 'Revoked'];

      return {
        success: true,
        intentId,
        userAddress: intentInfo[0],
        creatorAgentId: intentInfo[1].toString(),
        targetAgentId: intentInfo[2].toString(),
        createdAt: intentInfo[3].toString(),
        expiresAt: intentInfo[4].toString(),
        canRevoke: intentInfo[5],
        status: statusNames[intentInfo[6]] || 'Unknown',
        isValid,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "get_intent_info",
    description: "Get detailed information about an intent (status, expiry, etc.).",
    schema: z.object({
      intentId: z.string().describe("Intent ID to query"),
    }),
  }
);