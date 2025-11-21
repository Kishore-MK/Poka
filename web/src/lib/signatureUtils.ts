import { keccak256, encodePacked, Hex } from 'viem';

/**
 * Create the message hash for intent creation that matches the contract's logic
 */
export function createIntentMessageHash(
    userAddress: string,
    creatorAgentId: bigint,
    targetAgentId: bigint,
    nonce: bigint,
    expiresAt: bigint,
    chainId: number,
    contractAddress: string
): Hex {
    return keccak256(
        encodePacked(
            ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
            [
                userAddress as Hex,
                creatorAgentId,
                targetAgentId,
                nonce,
                expiresAt,
                BigInt(chainId),
                contractAddress as Hex
            ]
        )
    );
}

/**
 * Format a signature request for the frontend
 */
export interface SignatureRequest {
    type: 'intent_creation';
    messageHash: Hex;
    userAddress: string;
    creatorAgentId: string;
    targetAgentId: string;
    nonce: string;
    expiresAt: string;
    chainId: number;
    contractAddress: string;
}

/**
 * Format a signature response from the frontend
 */
export interface SignatureResponse {
    signature: Hex;
    messageHash: Hex;
}
