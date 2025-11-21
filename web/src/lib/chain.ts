import { createPublicClient, http, defineChain } from 'viem';

export const customChain = defineChain({
    id: Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 296,
    name: 'Custom Chain',
    network: 'custom',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet.hashio.io/api'] },
        public: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet.hashio.io/api'] },
    },
});

export const publicClient = createPublicClient({
    chain: customChain,
    transport: http(),
});

export const CONTRACT_ADDRESSES = {
    IdentityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS as `0x${string}`,
    IntentRegistry: process.env.NEXT_PUBLIC_INTENT_REGISTRY_ADDRESS as `0x${string}`,
    ReputationRegistry: process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS as `0x${string}`,
    ValidationRegistry: process.env.NEXT_PUBLIC_VALIDATION_REGISTRY_ADDRESS as `0x${string}`,
};

export const IDENTITY_REGISTRY_ABI = [
    {
        inputs: [{ name: 'agentId', type: 'uint256' }],
        name: 'getMetadata',
        outputs: [
            {
                components: [
                    { name: 'key', type: 'string' },
                    { name: 'value', type: 'bytes' }
                ],
                name: '',
                type: 'tuple[]'
            }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "agentId",
                type: "uint256"
            },
            {
                internalType: "string",
                name: "key",
                type: "string"
            },
            {
                internalType: "bytes",
                name: "value",
                type: "bytes"
            }
        ],
        name: "setMetadata",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
] as const;

export const INTENT_COORDINATOR_ABI = [
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "intentId",
                type: "bytes32"
            }
        ],
        name: "revokeIntent",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "intentId",
                type: "bytes32"
            }
        ],
        name: "getIntent",
        outputs: [
            {
                components: [
                    { internalType: "bytes32", name: "intentId", type: "bytes32" },
                    { internalType: "address", name: "userAddress", type: "address" },
                    { internalType: "uint256", name: "creatorAgentId", type: "uint256" },
                    { internalType: "uint256", name: "targetAgentId", type: "uint256" },
                    { internalType: "uint256", name: "expiresAt", type: "uint256" },
                    { internalType: "uint8", name: "status", type: "uint8" },
                    { internalType: "bool", name: "canRevoke", type: "bool" },
                    { internalType: "uint256", name: "lockExpiry", type: "uint256" }
                ],
                internalType: "struct IntentCoordinator.Intent",
                name: "",
                type: "tuple"
            }
        ],
        stateMutability: "view",
        type: "function"
    }
] as const;
