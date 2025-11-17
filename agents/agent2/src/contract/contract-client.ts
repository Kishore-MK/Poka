import { createPublicClient, createWalletClient, http, defineChain, Address, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

export const customChain = defineChain({
  id: 420420422,  
  name: 'Polkadot Hub TestNet',
  nativeCurrency: {
    decimals: 18,
    name: 'Paseo',
    symbol: 'PAS',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],  
    },
    public: {
      http: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],
    },
  },
});

// Contract addresses
export const IDENTITY_REGISTRY_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS as Address;
export const REPUTATION_REGISTRY_ADDRESS = process.env.REPUTATION_REGISTRY_ADDRESS as Address;
export const VALIDATION_REGISTRY_ADDRESS = process.env.VALIDATION_REGISTRY_ADDRESS as Address;
export const INTENT_COORDINATOR_ADDRESS = process.env.INTENT_COORDINATOR_ADDRESS as Address;

// Accounts
export const agentAccount = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
export const userAccount = privateKeyToAccount(process.env.USER_PRIVATE_KEY as Hex);

// Create clients
export const publicClient = createPublicClient({
  chain: customChain,
  transport: http(),
});

export const agentWalletClient = createWalletClient({
  account: agentAccount,
  chain: customChain,
  transport: http(),
});

export const userWalletClient = createWalletClient({
  account: userAccount,
  chain: customChain,
  transport: http(),
});

// Helper function
export async function waitForTransaction(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt;
}