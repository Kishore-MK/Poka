import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  setAgentMetadataTool,
  getAgentMetadataTool,
  getAgentInfoTool,
  giveFeedbackTool,
  getAgentReputationTool,
  requestValidationTool,
  createIntentTool,
  submitSignedIntentTool,
  lockRevocationTool,
  markIntentExecutedTool,
  markIntentFailedTool,
  getIntentInfoTool,
} from "./contract/contract-tools";
import {
  discoverAgentTool,
  callAgentActionTool,
  getMyAgentIdTool,
} from "./agent/agent-interaction-tools.js";

export const tools: DynamicStructuredTool[] = [
  // Identity Registry 
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
  submitSignedIntentTool,
  lockRevocationTool,
  markIntentExecutedTool,
  markIntentFailedTool,
  getIntentInfoTool,

  // Agent-to-Agent Interaction
  discoverAgentTool,
  callAgentActionTool,
];