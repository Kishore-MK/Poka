import { Hex } from 'viem';

export interface IntentExecutionData {
  intentId: Hex;
  result: any;
  timestamp: number;
  success: boolean;
  targetAgentId?: bigint;
  creatorAgentId?: bigint;
}

export interface AgentMetadata {
  agentId: bigint;
  url: string;
  name: string;
  description: string;
}

// In-memory storage
export class AgentStorage {
  private executedIntents: Map<string, IntentExecutionData> = new Map();
  private agentMetadataCache: Map<string, AgentMetadata> = new Map();
  private myAgentId: bigint | null = null;

  // Store executed intent result
  storeIntentExecution(data: IntentExecutionData): void {
    this.executedIntents.set(data.intentId, data);
  }

  // Get stored intent execution
  getIntentExecution(intentId: Hex): IntentExecutionData | undefined {
    return this.executedIntents.get(intentId);
  }

  // Cache agent metadata
  cacheAgentMetadata(metadata: AgentMetadata): void {
    this.agentMetadataCache.set(metadata.agentId.toString(), metadata);
  }

  // Get cached agent metadata
  getCachedAgentMetadata(agentId: bigint): AgentMetadata | undefined {
    return this.agentMetadataCache.get(agentId.toString());
  }

  // Set my agent ID
  setMyAgentId(agentId: bigint): void {
    this.myAgentId = agentId;
  }

  // Get my agent ID
  getMyAgentId(): bigint | null {
    return this.myAgentId;
  }

  // Clear all data
  clear(): void {
    this.executedIntents.clear();
    this.agentMetadataCache.clear();
    this.myAgentId = null;
  }
}

export const agentStorage = new AgentStorage();