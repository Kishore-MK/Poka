import { tool } from "@langchain/core/tools";
import z from "zod";
import {
  publicClient,
  agentWalletClient,
  agentAccount,
  waitForTransaction,
  IDENTITY_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ADDRESS,
  VALIDATION_REGISTRY_ADDRESS,
  INTENT_COORDINATOR_ADDRESS,
  VALIDATOR_ADDRESS,
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
import { agentRegistryService } from "../agent/agent-registry-service.js";

// ============================================
// IDENTITY REGISTRY TOOLS
// ============================================


export const setAgentMetadataTool = tool(
  async ({ agentId, key, value }: { agentId: string; key: string; value: string }) => {
    try {
      const agentIdBigInt = BigInt(agentId);

      const hash = await agentRegistryService.setMetadata(agentIdBigInt, key, value);

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

      const value = await agentRegistryService.getMetadata(agentIdBigInt, key);

      return JSON.stringify({
        success: true,
        key,
        value: value || '',
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
        agentRegistryService.agentExists(agentIdBigInt),
        agentRegistryService.getOwner(agentIdBigInt),
        agentRegistryService.getTokenURI(agentIdBigInt),
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
  async ({ agentId, score, tag1, tag2, uri }: { agentId: string; score: number; tag1?: string; tag2?: string; uri?: string; }) => {
    try {
      const agentIdBigInt = BigInt(agentId);

      // Get last feedback index
      const lastIndex: any = await publicClient.readContract({
        address: REPUTATION_REGISTRY_ADDRESS,
        abi: reputationRegistryAbi,
        functionName: 'getLastIndex',
        args: [agentIdBigInt, agentAccount.address as Hex],
      });

      // Create feedbackAuth structure
      const feedbackAuth = {
        agentId: agentIdBigInt,
        clientAddress: agentAccount.address as Hex,
        indexLimit: lastIndex + 10n,
        expiry: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours
        chainId: BigInt(customChain.id),
        identityRegistry: IDENTITY_REGISTRY_ADDRESS,
        signerAddress: agentAccount.address,
      };

      // Convert tags to bytes32
      const tag1Bytes = tag1 ? `0x${Buffer.from(tag1).toString('hex').padEnd(64, '0')}` as Hex : '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;
      const tag2Bytes = tag2 ? `0x${Buffer.from(tag2).toString('hex').padEnd(64, '0')}` as Hex : '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;

      // Call giveFeedback on the contract
      const { request } = await publicClient.simulateContract({
        address: REPUTATION_REGISTRY_ADDRESS,
        abi: reputationRegistryAbi,
        functionName: 'giveFeedback',
        args: [
          agentIdBigInt,
          feedbackAuth,
          BigInt(score),
          tag1Bytes,
          tag2Bytes,
          uri || '',
          '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex, // fileHash (empty for now)
        ],
        account: agentAccount,
      });

      const hash = await agentWalletClient.writeContract(request);
      await waitForTransaction(hash);

      return {
        success: true,
        txHash: hash,
        message: `Feedback submitted for Agent ${agentId} with score ${score}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "give_feedback",
    description: "Give feedback/rating for an agent after an interaction. Use this after successfully completing an interaction with another agent to rate their performance if the user specifically asks to give a feedback.",
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

      const summary: any = await publicClient.readContract({
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
  async ({ agentId, requestUri, tag }: { agentId: string; requestUri: string; tag?: string }) => {
    try {
      const agentIdBigInt = BigInt(agentId);
      const requestHash = keccak256(encodePacked(['string', 'uint256'], [requestUri, BigInt(Date.now())]));
      const tagBytes = (tag ? `0x${Buffer.from(tag).toString('hex').padEnd(64, '0')}` : '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex;

      // Use VALIDATOR_ADDRESS from env if not provided
      const validatorAddr = VALIDATOR_ADDRESS;

      console.log('requestValidation', agentIdBigInt, validatorAddr, requestUri, requestHash, tagBytes);
      const { request } = await publicClient.simulateContract({
        address: VALIDATION_REGISTRY_ADDRESS,
        abi: validationRegistryAbi,
        functionName: 'requestValidation',
        args: [agentIdBigInt, validatorAddr as Hex, requestUri, requestHash, tagBytes],
        account: agentAccount,
      });

      const hash = await agentWalletClient.writeContract(request);
      await waitForTransaction(hash);

      return {
        success: true,
        txHash: hash,
        requestHash,
        message: 'Validation requested',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  {
    name: "request_validation",
    description: "Request validation for agent work from a validator. Use AGENT account. Validator address is automatically set from environment.",
    schema: z.object({
      agentId: z.string().describe("Agent ID requesting validation"),
      requestUri: z.string().describe("URI containing validation request data (use dummy for now)"),
      tag: z.string().optional().describe("Optional tag for categorization"),
    }),
  }
);

// ============================================
// INTENT COORDINATOR TOOLS
// ============================================

export const createIntentTool = tool(
  async ({ creatorAgentId, targetAgentId, expiresInSeconds, userAddress }: { creatorAgentId: string; targetAgentId: string; expiresInSeconds: number; userAddress: string }) => {
    try {
      const creatorAgentIdBigInt = BigInt(creatorAgentId);
      const targetAgentIdBigInt = BigInt(targetAgentId);

      // Get user nonce
      const nonce: any = await publicClient.readContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'getUserNonce',
        args: [userAddress as Hex],
      });

      const newNonce = nonce + 1n;
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + expiresInSeconds);

      // Create message hash for signing
      const messageHash = keccak256(
        encodePacked(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
          [userAddress as Hex, creatorAgentIdBigInt, targetAgentIdBigInt, newNonce, expiresAt, BigInt(customChain.id), INTENT_COORDINATOR_ADDRESS]
        )
      );

      // Return structured signature request for frontend
      return JSON.stringify({
        success: true,
        requiresSignature: true,
        signatureRequest: {
          type: 'intent_creation',
          messageHash,
          userAddress,
          creatorAgentId,
          targetAgentId,
          nonce: newNonce.toString(),
          expiresAt: expiresAt.toString(),
          chainId: customChain.id,
          contractAddress: INTENT_COORDINATOR_ADDRESS,
        },
        message: 'Please sign the intent creation in your wallet',
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  },
  {
    name: "create_intent",
    description: "Create an intent for agent-to-agent interaction. Returns a signature request for the user to sign in their wallet.",
    schema: z.object({
      creatorAgentId: z.string().describe("Creator agent ID (usually your own agent)"),
      targetAgentId: z.string().describe("Target agent ID to interact with"),
      expiresInSeconds: z.number().default(300).describe("Intent expiration time in seconds (default 300 = 5 minutes)"),
      userAddress: z.string().describe("The user's wallet address"),
    }),
  }
);

export const submitSignedIntentTool = tool(
  async ({ creatorAgentId, targetAgentId, expiresAt, userAddress, nonce, signature }: {
    creatorAgentId: string;
    targetAgentId: string;
    expiresAt: string;
    userAddress: string;
    nonce: string;
    signature: string
  }) => {
    try {
      const creatorAgentIdBigInt = BigInt(creatorAgentId);
      const targetAgentIdBigInt = BigInt(targetAgentId);
      const expiresAtBigInt = BigInt(expiresAt);
      const nonceBigInt = BigInt(nonce);

      // Submit the intent to the blockchain with the user's signature
      const { request, result: intentId } = await publicClient.simulateContract({
        address: INTENT_COORDINATOR_ADDRESS,
        abi: intentCoordinatorAbi,
        functionName: 'createIntent',
        args: [
          creatorAgentIdBigInt,
          targetAgentIdBigInt,
          expiresAtBigInt,
          userAddress as Hex,
          nonceBigInt,
          signature as Hex
        ],
        account: agentAccount,
      });

      const hash = await agentWalletClient.writeContract(request);
      await waitForTransaction(hash);
      console.log("INTENT ID:", intentId)
      // Store the intent execution for display in UI
      agentStorage.storeIntentExecution({
        intentId,
        result: {
          creatorAgentId,
          targetAgentId,
          userAddress,
          expiresAt,
          nonce,
        },
        timestamp: Date.now(),
        success: true,
        targetAgentId: targetAgentIdBigInt,
        creatorAgentId: creatorAgentIdBigInt,
        transactionHash: hash,
      });

      return JSON.stringify({
        success: true,
        txHash: hash,
        intentId,
        message: 'Intent created successfully',
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  },
  {
    name: "submit_signed_intent",
    description: "Submit a user-signed intent to the blockchain. This is called after the user has signed the intent creation message.",
    schema: z.object({
      creatorAgentId: z.string().describe("Creator agent ID"),
      targetAgentId: z.string().describe("Target agent ID"),
      expiresAt: z.string().describe("Expiration timestamp"),
      userAddress: z.string().describe("User's wallet address"),
      nonce: z.string().describe("User's nonce"),
      signature: z.string().describe("User's signature (hex string)"),
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
    description: "Mark intent as executed after successful action and responding to the request from another agent.",
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
    description: "Mark intent as failed if action couldn't be completed and responding to the request from another agent..",
    schema: z.object({
      intentId: z.string().describe("Intent ID to mark as failed"),
      reason: z.string().describe("Failure reason"),
    }),
  }
);

export const revokeIntentTool = tool(
  async ({ intentId, userAddress }: { intentId: string; userAddress: string }) => {
    try {
      // We cannot sign for the user. Return request for signature.
      return {
        success: true,
        action: "request_user_signature",
        contractAddress: INTENT_COORDINATOR_ADDRESS,
        functionName: "revokeIntent",
        args: {
          intentId,
          userAddress,
        },
        message: 'Please sign the intent revocation transaction in your wallet',
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
      userAddress: z.string().describe("The user's wallet address"),
    }),
  }
);

export const getIntentInfoTool = tool(
  async ({ intentId }: { intentId: string }) => {
    try {
      const intentInfo: any = await publicClient.readContract({
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