import { Hex } from 'viem';
import * as fs from 'fs';
import * as path from 'path';

export interface IntentExecutionData {
  intentId: Hex;
  result: any;
  timestamp: number;
  success: boolean;
  targetAgentId?: bigint;
  creatorAgentId?: bigint;
  transactionHash?: string;
}

export interface AgentMetadata {
  agentId: bigint;
  url: string;
  name: string;
  description: string;
}

// Storage with file persistence for Agent ID
export class AgentStorage {
  private executedIntents: Map<string, IntentExecutionData> = new Map();
  private agentMetadataCache: Map<string, AgentMetadata> = new Map();
  private myAgentId: bigint | null = null;
  private readonly storagePath: string;

  constructor() {
    this.storagePath = path.resolve(process.cwd(), 'agent-data.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
        if (data.myAgentId) {
          this.myAgentId = BigInt(data.myAgentId);
        }
      }
    } catch (error) {
      console.warn('Failed to load agent data:', error);
    }
  }

  private save() {
    try {
      const data = {
        myAgentId: this.myAgentId?.toString()
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save agent data:', error);
    }
  }

  // Store executed intent result
  storeIntentExecution(data: IntentExecutionData): void {
    this.executedIntents.set(data.intentId, data);
  }

  // Get stored intent execution
  getIntentExecution(intentId: Hex): IntentExecutionData | undefined {
    return this.executedIntents.get(intentId);
  }

  getAllExecutions(): IntentExecutionData[] {
    return Array.from(this.executedIntents.values()).sort((a, b) => b.timestamp - a.timestamp);
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
    this.save();
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
    this.save();
  }
}

export const agentStorage = new AgentStorage();