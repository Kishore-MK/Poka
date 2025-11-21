import { Hex } from "viem";
import { publicClient, agentWalletClient, agentAccount, waitForTransaction, IDENTITY_REGISTRY_ADDRESS } from "../contract/contract-client.js";
import { identityRegistryAbi } from "../contract/contract-abis.js";

export class AgentRegistryService {
    private static instance: AgentRegistryService;

    private constructor() { }

    public static getInstance(): AgentRegistryService {
        if (!AgentRegistryService.instance) {
            AgentRegistryService.instance = new AgentRegistryService();
        }
        return AgentRegistryService.instance;
    }

    /**
     * Check if an agent exists
     */
    async agentExists(agentId: bigint): Promise<boolean> {
        return await publicClient.readContract({
            address: IDENTITY_REGISTRY_ADDRESS,
            abi: identityRegistryAbi,
            functionName: 'agentExists',
            args: [agentId],
        }) as boolean;
    }

    /**
     * Get the owner of an agent
     */
    async getOwner(agentId: bigint): Promise<Hex> {
        return await publicClient.readContract({
            address: IDENTITY_REGISTRY_ADDRESS,
            abi: identityRegistryAbi,
            functionName: 'ownerOf',
            args: [agentId],
        }) as Hex;
    }

    /**
     * Get the token URI of an agent
     */
    async getTokenURI(agentId: bigint): Promise<string> {
        return await publicClient.readContract({
            address: IDENTITY_REGISTRY_ADDRESS,
            abi: identityRegistryAbi,
            functionName: 'tokenURI',
            args: [agentId],
        }) as string;
    }

    /**
     * Get a specific metadata value for an agent
     */
    async getMetadata(agentId: bigint, key: string): Promise<string | null> {
        try {
            const metadata = await publicClient.readContract({
                address: IDENTITY_REGISTRY_ADDRESS,
                abi: identityRegistryAbi,
                functionName: 'getMetadata',
                args: [agentId, key],
            }) as Hex;

            if (!metadata || metadata === '0x') return null;
            return Buffer.from(metadata.slice(2), 'hex').toString('utf8');
        } catch (error) {
            return null;
        }
    }

    /**
     * Get multiple metadata values for an agent
     */
    async getMetadataBatch(agentId: bigint, keys: string[]): Promise<(string | null)[]> {
        const promises = keys.map(key => this.getMetadata(agentId, key));
        return Promise.all(promises);
    }

    /**
     * Set metadata for an agent
     */
    async setMetadata(agentId: bigint, key: string, value: string): Promise<Hex> {
        const valueBytes = `0x${Buffer.from(value).toString('hex')}` as Hex;

        const { request } = await publicClient.simulateContract({
            address: IDENTITY_REGISTRY_ADDRESS,
            abi: identityRegistryAbi,
            functionName: 'setMetadata',
            args: [agentId, key, valueBytes],
            account: agentAccount,
        });

        const hash = await agentWalletClient.writeContract(request);
        await waitForTransaction(hash);
        return hash;
    }

    /**
     * Get agent ID by owner using getAgentsByOwner
     */
    async getAgentIdByOwner(ownerAddress: Hex): Promise<bigint> {
        const agentIds = await publicClient.readContract({
            address: IDENTITY_REGISTRY_ADDRESS,
            abi: identityRegistryAbi,
            functionName: 'getAgentsByOwner',
            args: [ownerAddress],
        }) as bigint[];

        if (!agentIds || agentIds.length === 0) {
            throw new Error("Owner has no agents");
        }

        // Return the most recent agent ID (assuming the last one is the most recent)
        return agentIds[agentIds.length - 1];
    }

    /**
     * Get balance of agent tokens for an owner
     */
    async getBalanceOf(ownerAddress: Hex): Promise<bigint> {
        return await publicClient.readContract({
            address: IDENTITY_REGISTRY_ADDRESS,
            abi: identityRegistryAbi,
            functionName: 'balanceOf',
            args: [ownerAddress],
        }) as bigint;
    }
}

export const agentRegistryService = AgentRegistryService.getInstance();
