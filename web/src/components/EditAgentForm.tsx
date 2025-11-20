import { useState } from 'react';
import { createWalletClient, custom, stringToHex } from 'viem';
import { customChain, CONTRACT_ADDRESSES, IDENTITY_REGISTRY_ABI } from '@/lib/chain';
import { Loader2, X } from 'lucide-react';

interface EditAgentFormProps {
    agentId: string;
    initialName: string;
    initialDescription: string;
    initialDomain: string;
    onClose: () => void;
}

export function EditAgentForm({ agentId, initialName, initialDescription, initialDomain, onClose }: EditAgentFormProps) {
    const [name, setName] = useState(initialName);
    const [description, setDescription] = useState(initialDescription);
    const [domain, setDomain] = useState(initialDomain);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (typeof window === 'undefined' || !window.ethereum) {
            setError('Please install a wallet to continue.');
            return;
        }

        setIsSubmitting(true);

        try {
            const walletClient = createWalletClient({
                chain: customChain,
                transport: custom(window.ethereum)
            });

            const [address] = await walletClient.requestAddresses();

            // Check Chain ID
            const chainId = await walletClient.getChainId();
            if (chainId !== customChain.id) {
                try {
                    await walletClient.switchChain({ id: customChain.id });
                } catch (error: any) {
                    if (error.code === 4902) {
                        await walletClient.addChain({ chain: customChain });
                    } else {
                        throw error;
                    }
                }
            }

            // Update Name if changed
            if (name !== initialName) {
                await walletClient.writeContract({
                    address: CONTRACT_ADDRESSES.IdentityRegistry,
                    abi: IDENTITY_REGISTRY_ABI,
                    functionName: 'setMetadata',
                    args: [BigInt(agentId), 'name', stringToHex(name)],
                    account: address
                });
            }

            // Update Description if changed
            if (description !== initialDescription) {
                await walletClient.writeContract({
                    address: CONTRACT_ADDRESSES.IdentityRegistry,
                    abi: IDENTITY_REGISTRY_ABI,
                    functionName: 'setMetadata',
                    args: [BigInt(agentId), 'description', stringToHex(description)],
                    account: address
                });
            }

            // Update Domain if changed
            if (domain !== initialDomain) {
                await walletClient.writeContract({
                    address: CONTRACT_ADDRESSES.IdentityRegistry,
                    abi: IDENTITY_REGISTRY_ABI,
                    functionName: 'setMetadata',
                    args: [BigInt(agentId), 'domain', stringToHex(domain)],
                    account: address
                });
            }

            onClose();
            // Ideally trigger a refresh or show a success message
            // The indexer will pick up changes eventually
        } catch (err: any) {
            console.error('Failed to update metadata:', err);
            setError(err.message || 'Failed to update metadata');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card-3d p-8 rounded-2xl w-full max-w-md relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-2xl font-bold text-white mb-6">Edit Agent Profile</h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            placeholder="Agent Name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors h-32 resize-none"
                            placeholder="Describe your agent..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Domain URL</label>
                        <input
                            type="url"
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            placeholder="https://example.com"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 btn-3d text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
