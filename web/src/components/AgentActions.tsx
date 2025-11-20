'use client';

import { useState, useEffect } from 'react';
import { createWalletClient, custom } from 'viem';
import { customChain } from '@/lib/chain';
import { EditAgentForm } from './EditAgentForm';
import { Pencil } from 'lucide-react';

interface AgentActionsProps {
    agentId: string;
    ownerAddress: string;
    currentName: string;
    currentDescription: string;
    currentDomain: string;
}

export function AgentActions({ agentId, ownerAddress, currentName, currentDescription, currentDomain }: AgentActionsProps) {
    const [isOwner, setIsOwner] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

    useEffect(() => {
        checkOwner();

        // Listen for account changes
        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on('accountsChanged', checkOwner);
        }

        return () => {
            if (typeof window !== 'undefined' && window.ethereum) {
                window.ethereum.removeListener('accountsChanged', checkOwner);
            }
        };
    }, [ownerAddress]);

    const checkOwner = async () => {
        if (typeof window === 'undefined' || !window.ethereum) return;

        try {
            const walletClient = createWalletClient({
                chain: customChain,
                transport: custom(window.ethereum)
            });

            const [address] = await walletClient.getAddresses();
            setConnectedAddress(address || null);

            if (address && address.toLowerCase() === ownerAddress.toLowerCase()) {
                setIsOwner(true);
            } else {
                setIsOwner(false);
            }
        } catch (error) {
            console.error('Failed to check owner:', error);
            setIsOwner(false);
        }
    };

    if (!isOwner) return null;

    return (
        <>
            <button
                onClick={() => setShowEditForm(true)}
                className="w-full py-3 btn-3d text-white font-medium rounded-xl flex items-center justify-center gap-2 mb-4"
            >
                <Pencil className="w-4 h-4" />
                Edit Profile
            </button>

            {showEditForm && (
                <EditAgentForm
                    agentId={agentId}
                    initialName={currentName}
                    initialDescription={currentDescription}
                    initialDomain={currentDomain}
                    onClose={() => {
                        setShowEditForm(false);
                        // Optional: Trigger a refresh or update local state if needed
                        // For now, we rely on page refresh or indexer update
                        window.location.reload();
                    }}
                />
            )}
        </>
    );
}
