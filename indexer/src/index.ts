import { createPublicClient, http, parseAbiItem, Log, hexToString } from 'viem';
import { defineChain } from 'viem/utils';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// --- Configuration ---
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '296');
const RPC_URL = process.env.RPC_URL || 'https://testnet.hashio.io/api';

const IDENTITY_REGISTRY_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS as `0x${string}`;
const REPUTATION_REGISTRY_ADDRESS = process.env.REPUTATION_REGISTRY_ADDRESS as `0x${string}`;
const VALIDATION_REGISTRY_ADDRESS = process.env.VALIDATION_REGISTRY_ADDRESS as `0x${string}`;
const INTENT_REGISTRY_ADDRESS = process.env.INTENT_REGISTRY_ADDRESS as `0x${string}`;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ABIs ---
const loadAbi = (filename: string) => {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'));
};

const identityAbi = loadAbi('IdentityRegistryABI.json');
const reputationAbi = loadAbi('ReputationRegistryABI.json');
const validationAbi = loadAbi('ValidationRegistryABI.json');
const intentAbi = loadAbi('IntentRegistryABI.json');

// --- Chain Definition ---
const customChain = defineChain({
    id: CHAIN_ID,
    name: 'Hedera Testnet',
    network: 'Hedera Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Hbar',
        symbol: 'HBAR',
    },
    rpcUrls: {
        default: { http: [RPC_URL] },
        public: { http: [RPC_URL] },
    },
});

const client = createPublicClient({
    chain: customChain,
    transport: http(),
});

// --- Event Handlers ---

async function handleAgentRegistered(logs: Log[]) {
    for (const log of logs) {
        const { args } = log as any;
        const agentId = args.agentId.toString();
        const owner = args.owner;

        console.log(`Processing AgentRegistered: ID ${agentId}, Owner ${owner}`);

        // Fetch Token URI
        let tokenUri = '';
        try {
            tokenUri = await client.readContract({
                address: IDENTITY_REGISTRY_ADDRESS,
                abi: identityAbi,
                functionName: 'tokenURI',
                args: [args.agentId],
            }) as string;
        } catch (e) {
            console.error(`Failed to fetch tokenURI for agent ${agentId}`, e);
        }

        const { error } = await supabase
            .from('agents')
            .upsert({ id: agentId, owner, token_uri: tokenUri }, { onConflict: 'id' });

        if (error) console.error('Supabase error (agents):', error);
    }
}

async function handleMetadataSet(logs: Log[]) {
    for (const log of logs) {
        const { args } = log as any;
        const agentId = args.agentId.toString();
        const key = args.key;
        const value = args.value;

        console.log(`Processing MetadataSet: ID ${agentId}, Key ${key}`);

        try {
            const strValue = hexToString(value);

            if (key === 'name' || key === 'description' || key === 'domain') {
                const { error } = await supabase
                    .from('agents')
                    .update({ [key]: strValue })
                    .eq('id', agentId);

                if (error) console.error(`Supabase error (agents update ${key}):`, error);
            }
        } catch (e) {
            console.error(`Failed to process metadata for agent ${agentId}`, e);
        }
    }
}

async function handleFeedbackGiven(logs: Log[]) {
    for (const log of logs) {
        const { args } = log as any;
        console.log(`Processing FeedbackGiven for Agent ${args.agentId}`);

        const { error } = await supabase
            .from('feedback')
            .insert({
                agent_id: args.agentId.toString(),
                client: args.clientAddress,
                score: Number(args.score),
                uri: '', // URI is in the event but not always needed immediately, can fetch if needed
                tags: [args.tag1, args.tag2].filter(t => t && t !== '0x0000000000000000000000000000000000000000000000000000000000000000'),
            });

        if (error) console.error('Supabase error (feedback):', error);
    }
}

async function handleValidationRequested(logs: Log[]) {
    for (const log of logs) {
        const { args } = log as any;
        console.log(`Processing ValidationRequested: ${args.requestHash}`);

        const { error } = await supabase
            .from('validations')
            .upsert({
                request_hash: args.requestHash,
                agent_id: args.agentId.toString(),
                validator: args.validatorAddress,
                status: 'Requested',
                tags: args.tag,
            }, { onConflict: 'request_hash' });

        if (error) console.error('Supabase error (validations):', error);
    }
}

async function handleValidationResponse(logs: Log[]) {
    for (const log of logs) {
        const { args } = log as any;
        console.log(`Processing ValidationResponse: ${args.requestHash}`);

        const { error } = await supabase
            .from('validations')
            .update({
                status: 'Responded',
                response_score: Number(args.response),
                response_uri: args.responseUri,
                updated_at: new Date().toISOString(),
            })
            .eq('request_hash', args.requestHash);

        if (error) console.error('Supabase error (validations update):', error);
    }
}

async function handleIntentCreated(logs: Log[]) {
    for (const log of logs) {
        const { args } = log as any;
        console.log(`Processing IntentCreated: ${args.intentId}`);

        const { error } = await supabase
            .from('intents')
            .upsert({
                intent_id: args.intentId,
                creator_agent_id: args.creatorAgentId.toString(),
                target_agent_id: args.targetAgentId.toString(),
                status: 'Pending',
            }, { onConflict: 'intent_id' });

        if (error) console.error('Supabase error (intents):', error);
    }
}

async function handleIntentStatusChange(logs: Log[], status: string) {
    for (const log of logs) {
        const { args } = log as any;
        console.log(`Processing Intent Status Change (${status}): ${args.intentId}`);

        const { error } = await supabase
            .from('intents')
            .update({ status })
            .eq('intent_id', args.intentId);

        if (error) console.error('Supabase error (intents update):', error);
    }
}


// --- Main Loop ---

async function main() {
    console.log('Starting Indexer...');

    // 1. Fetch existing agents (Simplified: just checking ID 1 to 100 for demo, or rely on events)
    // Better approach: Get current block and scan back, or just listen for now.
    // For "1 to N", we can try to read `_nextAgentId` if exposed, or just loop until error.

    console.log('Fetching existing agents...');
    let agentId = 1;
    while (true) {
        try {
            const exists = await client.readContract({
                address: IDENTITY_REGISTRY_ADDRESS,
                abi: identityAbi,
                functionName: 'agentExists',
                args: [BigInt(agentId)],
            });

            if (!exists) break;

            const owner = await client.readContract({
                address: IDENTITY_REGISTRY_ADDRESS,
                abi: identityAbi,
                functionName: 'ownerOf',
                args: [BigInt(agentId)],
            }) as string;

            const tokenUri = await client.readContract({
                address: IDENTITY_REGISTRY_ADDRESS,
                abi: identityAbi,
                functionName: 'tokenURI',
                args: [BigInt(agentId)],
            }) as string;

            // Fetch Metadata (Name & Description)
            let name = '';
            let description = '';
            let domain = '';

            try {
                const nameBytes = await client.readContract({
                    address: IDENTITY_REGISTRY_ADDRESS,
                    abi: identityAbi,
                    functionName: 'getMetadata',
                    args: [BigInt(agentId), 'name'],
                }) as `0x${string}`;
                name = hexToString(nameBytes);
            } catch (e) { }

            try {
                const descBytes = await client.readContract({
                    address: IDENTITY_REGISTRY_ADDRESS,
                    abi: identityAbi,
                    functionName: 'getMetadata',
                    args: [BigInt(agentId), 'description'],
                }) as `0x${string}`;
                description = hexToString(descBytes);
            } catch (e) { }

            try {
                const domainBytes = await client.readContract({
                    address: IDENTITY_REGISTRY_ADDRESS,
                    abi: identityAbi,
                    functionName: 'getMetadata',
                    args: [BigInt(agentId), 'domain'],
                }) as `0x${string}`;
                domain = hexToString(domainBytes);
            } catch (e) { }

            console.log(`Found Agent ${agentId}: ${name}`);
            await supabase.from('agents').upsert({
                id: agentId,
                owner,
                token_uri: tokenUri,
                name,
                description,
                domain
            }, { onConflict: 'id' });

            agentId++;
        } catch (e) {
            console.log('Stopped fetching agents (error or end of list).');
            break;
        }
    }

    // 2. Watch Events
    console.log('Watching for events...');

    client.watchContractEvent({
        address: IDENTITY_REGISTRY_ADDRESS,
        abi: identityAbi,
        eventName: 'AgentRegistered',
        onLogs: handleAgentRegistered,
    });

    client.watchContractEvent({
        address: IDENTITY_REGISTRY_ADDRESS,
        abi: identityAbi,
        eventName: 'MetadataSet',
        onLogs: handleMetadataSet,
    });

    client.watchContractEvent({
        address: REPUTATION_REGISTRY_ADDRESS,
        abi: reputationAbi,
        eventName: 'FeedbackGiven',
        onLogs: handleFeedbackGiven,
    });

    client.watchContractEvent({
        address: VALIDATION_REGISTRY_ADDRESS,
        abi: validationAbi,
        eventName: 'ValidationRequested',
        onLogs: handleValidationRequested,
    });

    client.watchContractEvent({
        address: VALIDATION_REGISTRY_ADDRESS,
        abi: validationAbi,
        eventName: 'ValidationResponse',
        onLogs: handleValidationResponse,
    });

    client.watchContractEvent({
        address: INTENT_REGISTRY_ADDRESS,
        abi: intentAbi,
        eventName: 'IntentCreated',
        onLogs: handleIntentCreated,
    });

    client.watchContractEvent({
        address: INTENT_REGISTRY_ADDRESS,
        abi: intentAbi,
        eventName: 'IntentExecuted',
        onLogs: (logs) => handleIntentStatusChange(logs, 'Executed'),
    });

    client.watchContractEvent({
        address: INTENT_REGISTRY_ADDRESS,
        abi: intentAbi,
        eventName: 'IntentFailed',
        onLogs: (logs) => handleIntentStatusChange(logs, 'Failed'),
    });

    client.watchContractEvent({
        address: INTENT_REGISTRY_ADDRESS,
        abi: intentAbi,
        eventName: 'IntentRevoked',
        onLogs: (logs) => handleIntentStatusChange(logs, 'Revoked'),
    });
}

main().catch(console.error);
