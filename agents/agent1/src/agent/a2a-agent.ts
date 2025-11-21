import { AgentExecutor, RequestContext, ExecutionEventBus, AgentExecutionEvent } from '@a2a-js/sdk/server';
import { agent } from '../agent-logic.js';
import { HumanMessage } from '@langchain/core/messages';
import { agentStorage } from './agent-storage.js';
import { publicClient, agentWalletClient, agentAccount, INTENT_COORDINATOR_ADDRESS } from '../contract/contract-client.js';
import { intentCoordinatorAbi } from '../contract/contract-abis.js';
import { Hex } from 'viem';

export class A2AAgentExecutor implements AgentExecutor {
    private activeTasks: Map<string, AbortController> = new Map();

    async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
        const userMessage = requestContext.userMessage;
        const content = (userMessage as any).content || (userMessage as any).text || JSON.stringify(userMessage);
        const taskId = requestContext.taskId;

        console.log(`A2A Agent received message for task ${taskId}:`, content);

        // Extract intentId from message extensions if present
        const extensions = (userMessage as any).extensions || [];
        const intentExtension = extensions.find((ext: string) => ext.startsWith('intent:'));
        const intentId = intentExtension ? intentExtension.replace('intent:', '') as Hex : null;

        const abortController = new AbortController();
        this.activeTasks.set(taskId, abortController);

        const config = {
            configurable: { thread_id: requestContext.contextId || taskId },
            signal: abortController.signal
        };

        try {
            const agentResponse = await agent.invoke(
                { messages: [new HumanMessage(content)] },
                config
            );

            if (abortController.signal.aborted) {
                console.log(`Task ${taskId} was aborted during execution`);
                return;
            }

            const lastMessage = agentResponse.messages[agentResponse.messages.length - 1];
            const responseContent = lastMessage.content;
            const myAgentId = agentStorage.getMyAgentId()?.toString() || 'unknown-agent-id';

            // Construct response message
            const responseMessage: any = {
                kind: 'message',
                id: crypto.randomUUID(),
                contextId: requestContext.contextId,
                content: responseContent,
                sender: {
                    kind: 'agent',
                    id: myAgentId
                },
                created: new Date().toISOString()
            };

            eventBus.publish(responseMessage);
            eventBus.finished();

            // Mark intent as executed if intentId was provided
            if (intentId) {
                try {
                    console.log(`Marking intent ${intentId} as executed`);
                    const { request } = await publicClient.simulateContract({
                        address: INTENT_COORDINATOR_ADDRESS,
                        abi: intentCoordinatorAbi,
                        functionName: 'markExecuted',
                        args: [intentId],
                        account: agentAccount,
                    });

                    const hash = await agentWalletClient.writeContract(request);
                    console.log(`Intent ${intentId} marked as executed. Tx: ${hash}`);
                } catch (error: any) {
                    console.error(`Failed to mark intent ${intentId} as executed:`, error.message);
                }
            }

        } catch (error: any) {
            if (abortController.signal.aborted || error.name === 'AbortError') {
                console.log(`Task ${taskId} execution aborted`);
            } else {
                console.error('Error in A2A Agent execution:', error);

                // Mark intent as failed if intentId was provided
                if (intentId) {
                    try {
                        console.log(`Marking intent ${intentId} as failed`);
                        const { request } = await publicClient.simulateContract({
                            address: INTENT_COORDINATOR_ADDRESS,
                            abi: intentCoordinatorAbi,
                            functionName: 'markFailed',
                            args: [intentId, error.message || 'Agent execution error'],
                            account: agentAccount,
                        });

                        const hash = await agentWalletClient.writeContract(request);
                        console.log(`Intent ${intentId} marked as failed. Tx: ${hash}`);
                    } catch (markError: any) {
                        console.error(`Failed to mark intent ${intentId} as failed:`, markError.message);
                    }
                }
            }
            eventBus.finished();
        } finally {
            this.activeTasks.delete(taskId);
        }
    }

    async cancelTask(taskId: string, eventBus: ExecutionEventBus): Promise<void> {
        console.log(`Cancel task requested for ${taskId}`);
        const controller = this.activeTasks.get(taskId);
        if (controller) {
            controller.abort();
            this.activeTasks.delete(taskId);
            console.log(`Task ${taskId} aborted`);
        } else {
            console.log(`Task ${taskId} not found or already finished`);
        }
        eventBus.finished();
    }
}
