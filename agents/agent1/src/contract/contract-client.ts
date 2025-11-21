import { createPublicClient, createWalletClient, http, defineChain, Address, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

export const customChain = defineChain({
    id: 296,
    name: 'Hedera Testnet',
    network: 'Hedera Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Hbar',
        symbol: 'HBAR',
    },
    rpcUrls: {
        default: { http: ['https://testnet.hashio.io/api'] },
        public: { http: ['https://testnet.hashio.io/api'] },
    },
});

// Contract addresses
export const IDENTITY_REGISTRY_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS as Address;
export const REPUTATION_REGISTRY_ADDRESS = process.env.REPUTATION_REGISTRY_ADDRESS as Address;
export const VALIDATION_REGISTRY_ADDRESS = process.env.VALIDATION_REGISTRY_ADDRESS as Address;
export const INTENT_COORDINATOR_ADDRESS = process.env.INTENT_COORDINATOR_ADDRESS as Address;

console.log(IDENTITY_REGISTRY_ADDRESS)
// Accounts
export const agentAccount = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
 
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

 

// Helper function
export async function waitForTransaction(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt;
}