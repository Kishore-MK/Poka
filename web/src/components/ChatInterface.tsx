'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Wrench, Activity, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, ExternalLink, Trash2 } from 'lucide-react';
import { createWalletClient, custom } from 'viem';
import { customChain, CONTRACT_ADDRESSES, INTENT_COORDINATOR_ABI } from '@/lib/chain';

interface Message {
    role: 'user' | 'agent';
    content: string;
    toolCalls?: string[];
}

interface Intent {
    intentId: string;
    timestamp: number;
    success: boolean;
    result: any;
    transactionHash?: string;
}

interface ChatInterfaceProps {
    agentUrl: string;
    agentName: string;
}

export function ChatInterface({ agentUrl, agentName }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [intents, setIntents] = useState<Intent[]>([]);
    const [showIntents, setShowIntents] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
    const [revokingIntent, setRevokingIntent] = useState<string | null>(null);
    const [revokeError, setRevokeError] = useState<string | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);


    useEffect(() => {
        async function connectWallet() {
            const walletClient = createWalletClient({
                chain: customChain,
                transport: custom(window.ethereum)
            });

            const [address] = await walletClient.getAddresses();
            setConnectedAddress(address || null);
        }
        connectWallet();
    }, []);

    const handleRevokeIntent = async (intentId: string) => {
        if (!connectedAddress) {
            setRevokeError('Please connect your wallet first');
            setTimeout(() => setRevokeError(null), 3000);
            return;
        }

        setRevokingIntent(intentId);
        setRevokeError(null);

        try {
            const walletClient = createWalletClient({
                chain: customChain,
                transport: custom(window.ethereum)
            });

            // Call revokeIntent on the contract
            const hash = await walletClient.writeContract({
                address: CONTRACT_ADDRESSES.IntentRegistry,
                abi: INTENT_COORDINATOR_ABI,
                functionName: 'revokeIntent',
                args: [intentId as `0x${string}`],
                account: connectedAddress as `0x${string}`,
            });

            console.log('Revoke transaction submitted:', hash);

            // Refresh intents after a short delay
            setTimeout(() => {
                fetchIntents();
            }, 2000);

        } catch (error: any) {
            console.error('Failed to revoke intent:', error);
            let errorMessage = 'Failed to revoke intent';

            if (error.message?.includes('User rejected')) {
                errorMessage = 'Transaction rejected';
            } else if (error.message?.includes('Cannot revoke - locked')) {
                errorMessage = 'Intent is locked by agent';
            } else if (error.message?.includes('Intent not pending')) {
                errorMessage = 'Intent is not pending';
            } else if (error.message?.includes('Not intent creator')) {
                errorMessage = 'You are not the creator';
            }

            setRevokeError(errorMessage);
            setTimeout(() => setRevokeError(null), 5000);
        } finally {
            setRevokingIntent(null);
        }
    };

    const fetchIntents = async () => {
        try {
            // Ensure URL doesn't have trailing slash
            const baseUrl = agentUrl.replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/intents`);
            if (response.ok) {
                const data = await response.json();
                setIntents(data.intents);
            }
        } catch (error) {
            console.error('Failed to fetch intents:', error);
        }
    };

    useEffect(() => {
        fetchIntents();
        const interval = setInterval(fetchIntents, 5000);
        return () => clearInterval(interval);
    }, [agentUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            // Ensure URL doesn't have trailing slash
            const baseUrl = agentUrl.replace(/\/$/, '');
            console.log("User Address: ", connectedAddress);

            const response = await fetch(`${baseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userMessage, userAddress: connectedAddress }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send message');
            }

            const data = await response.json();

            // Check if there's a signature request
            if (data.signatureRequest) {
                const sigReq = data.signatureRequest;

                // Add agent message about signature request
                setMessages(prev => [...prev, {
                    role: 'agent',
                    content: `I need your signature to create an intent. Please sign the message in your wallet.`,
                    toolCalls: data.toolCalls?.map((tc: any) => tc.name)
                }]);

                try {
                    // Create wallet client for signing
                    const walletClient = createWalletClient({
                        chain: customChain,
                        transport: custom(window.ethereum)
                    });

                    // Sign the message hash using personal sign
                    const signature = await walletClient.signMessage({
                        account: connectedAddress as `0x${string}`,
                        message: { raw: sigReq.messageHash as `0x${string}` }
                    });

                    console.log("Signature obtained:", signature);

                    // Send the signature back to the agent
                    const submitMessage = `Submit the signed intent with signature: ${signature}, creatorAgentId: ${sigReq.creatorAgentId}, targetAgentId: ${sigReq.targetAgentId}, expiresAt: ${sigReq.expiresAt}, userAddress: ${sigReq.userAddress}, nonce: ${sigReq.nonce}`;

                    const submitResponse = await fetch(`${baseUrl}/chat`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: submitMessage,
                            userAddress: connectedAddress
                        }),
                    });

                    if (!submitResponse.ok) {
                        throw new Error('Failed to submit signed intent');
                    }

                    const submitData = await submitResponse.json();

                    setMessages(prev => [...prev, {
                        role: 'agent',
                        content: submitData.response,
                        toolCalls: submitData.toolCalls?.map((tc: any) => tc.name)
                    }]);

                } catch (signError: any) {
                    console.error('Signature error:', signError);
                    setMessages(prev => [...prev, {
                        role: 'agent',
                        content: `Failed to get signature: ${signError.message || 'User rejected signature request'}`
                    }]);
                }
            } else {
                // Normal response without signature request
                setMessages(prev => [...prev, {
                    role: 'agent',
                    content: data.response,
                    toolCalls: data.toolCalls?.map((tc: any) => tc.name)
                }]);
            }

            // Refresh intents after a message
            fetchIntents();
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, { role: 'agent', content: 'Sorry, I encountered an error processing your request.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-slate-900/50 rounded-3xl overflow-hidden border border-white/10 shadow-xl backdrop-blur-sm">
            {/* Header */}
            <div className="p-4 bg-slate-950/50 border-b border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <Bot className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h2 className="font-bold text-white">{agentName}</h2>
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Online
                    </p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
                {messages.length === 0 && (
                    <div className="text-center text-slate-500 mt-10">
                        <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Start a conversation with {agentName}</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-indigo-600'
                            }`}>
                            {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                        </div>

                        <div className={`max-w-[80%] space-y-2`}>
                            <div className={`p-4 rounded-2xl ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-none'
                                : 'bg-slate-800/80 text-slate-200 rounded-tl-none border border-white/10'
                                }`}>
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            </div>

                            {msg.toolCalls && msg.toolCalls.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {msg.toolCalls.map((tool, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-xs bg-slate-800/50 text-slate-400 px-2 py-1 rounded border border-white/10">
                                            <Wrench className="w-3 h-3" />
                                            {tool}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="bg-slate-800/80 p-4 rounded-2xl rounded-tl-none border border-white/10 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                            <span className="text-slate-400 text-sm">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Intents Section */}
            <div className={`border-t border-white/10 bg-slate-950/30 transition-all duration-300 ease-in-out flex flex-col ${showIntents ? 'h-64' : 'h-12'}`}>
                <button
                    onClick={() => setShowIntents(!showIntents)}
                    className="w-full h-12 flex items-center justify-between px-4 hover:bg-white/5 transition-colors flex-shrink-0"
                >
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                        <Activity className="w-4 h-4 text-indigo-400" />
                        <span>Recent Activity</span>
                        {intents.length > 0 && (
                            <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full">
                                {intents.length}
                            </span>
                        )}
                    </div>
                    {showIntents ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                </button>

                {showIntents && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-slate-900/50">
                        {intents.length === 0 && (
                            <div className="text-center text-slate-500 py-8">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No activity yet</p>
                            </div>
                        )}

                        {intents.map((intent) => (
                            <div key={intent.intentId} className="bg-slate-950/50 rounded-xl p-3 border border-white/10 hover:border-indigo-500/30 transition-colors">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {intent.success ? (
                                            <CheckCircle className="w-4 h-4 text-green-400" />
                                        ) : (
                                            <XCircle className="w-4 h-4 text-red-400" />
                                        )}
                                        <span className="text-xs font-mono text-slate-400">
                                            {intent.intentId.slice(0, 8)}...
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-500">
                                        {new Date(intent.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>

                                <div className="text-sm text-slate-300 bg-slate-900/80 rounded p-2 font-mono text-xs overflow-hidden mb-2">
                                    {JSON.stringify(intent.result, null, 2)}
                                </div>

                                <div className="flex items-center justify-between">
                                    {intent.transactionHash && (
                                        <a
                                            href={`https://hashscan.io/testnet/transaction/${intent.transactionHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            View Transaction
                                        </a>
                                    )}

                                    <button
                                        onClick={() => handleRevokeIntent(intent.intentId)}
                                        disabled={revokingIntent === intent.intentId}
                                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                                    >
                                        {revokingIntent === intent.intentId ? (
                                            <>
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Revoking...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 className="w-3 h-3" />
                                                Revoke
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}

                        {revokeError && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                                {revokeError}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 bg-slate-950/50 border-t border-white/10">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-4 pr-12 py-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    );
}
