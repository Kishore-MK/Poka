import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  registerAgentTool,
  setAgentMetadataTool,
  getAgentMetadataTool,
  getAgentInfoTool,
  giveFeedbackTool,
  getAgentReputationTool,
  requestValidationTool,
  createIntentTool,
  lockRevocationTool,
  markIntentExecutedTool,
  markIntentFailedTool,
  revokeIntentTool,
  getIntentInfoTool,
} from "./contract/contract-tools";
import {
  discoverAgentTool,
  callAgentActionTool,
  getMyAgentIdTool,
} from "./agent/agent-interaction-tools.js";

export const tools: DynamicStructuredTool[] = [
  // Identity Registry
  registerAgentTool,
  setAgentMetadataTool,
  getAgentMetadataTool,
  getAgentInfoTool,
  getMyAgentIdTool,
  
  // Reputation Registry
  giveFeedbackTool,
  getAgentReputationTool,
  
  // Validation Registry
  requestValidationTool,
  
  // Intent Coordinator
  createIntentTool,
  lockRevocationTool,
  markIntentExecutedTool,
  markIntentFailedTool,
  revokeIntentTool,
  getIntentInfoTool,
  
  // Agent-to-Agent Interaction
  discoverAgentTool,
  callAgentActionTool,
];