'use client';

import { useState } from 'react';
import { createWalletClient, custom, stringToHex, encodeAbiParameters, parseAbiParameters } from 'viem';
import { customChain, CONTRACT_ADDRESSES } from '@/lib/chain';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export function RegistrationForm() {
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [validationMessage, setValidationMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    domain: '',
    tokenUri: '',
  });

  const validateDomain = async () => {
    if (!formData.domain) return;

    setValidating(true);
    setValidationStatus('idle');
    setValidationMessage('Pinging agent domain...');

    try {
      const response = await fetch(formData.domain+'/.well-known/agent-card.json');
      if (!response.ok) throw new Error('Failed to reach domain');

      const data = await response.json();
      console.log(data);
      if (!data.skills || !Array.isArray(data.skills)) {
        throw new Error('Response missing "actions" array');
      }

      const isValid = data.skills.some((action: any) =>
        action.id && action.name && action.tags && action.description
      );

      if (!isValid) {
        throw new Error('Invalid actions structure. Must contain id, name, tags, description.');
      }

      setValidationStatus('success');
      setValidationMessage('Agent validated successfully!');
    } catch (error: any) {
      setValidationStatus('error');
      setValidationMessage(error.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationStatus !== 'success') {
      alert('Please validate the agent domain first.');
      return;
    }

    setLoading(true);
    try {
      const walletClient = createWalletClient({
        chain: customChain,
        transport: custom(window.ethereum!)
      });

      const [address] = await walletClient.requestAddresses();

      // Check Chain ID
      const chainId = await walletClient.getChainId();
      if (chainId !== customChain.id) {
        try {
          await walletClient.switchChain({ id: customChain.id });
        } catch (error: any) {
          // Chain not found, try to add it
          if (error.code === 4902) {
            await walletClient.addChain({ chain: customChain });
          } else {
            throw error;
          }
        }
      }

      // Prepare Metadata
      const metadata = [
        { key: 'name', value: stringToHex(formData.name) },
        { key: 'description', value: stringToHex(formData.description) },
        { key: 'domain', value: stringToHex(formData.domain) },
      ];

      // Register
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.IdentityRegistry,
        abi: [
          {
            inputs: [
              { name: 'tokenURI_', type: 'string' },
              {
                components: [
                  { name: 'key', type: 'string' },
                  { name: 'value', type: 'bytes' }
                ],
                name: 'metadata',
                type: 'tuple[]'
              }
            ],
            name: 'register',
            outputs: [{ name: 'agentId', type: 'uint256' }],
            stateMutability: 'nonpayable',
            type: 'function'
          }
        ],
        functionName: 'register',
        args: [formData.tokenUri, metadata],
        account: address,
      });

      alert(`Transaction sent! Hash: ${hash}`);
    } catch (error: any) {
      console.error(error);
      alert('Registration failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto card-3d p-8 rounded-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Register New Agent</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-400">Agent Name</label>
        <input
          type="text"
          required
          className="w-full  border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none 
          
          bg-slate-900 border border-slate-800    

          focus:border-white focus:ring-1 focus:ring-white transition-all shadow-inner backdrop-blur-sm"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Description</label>
        <textarea
          required
          rows={3}
          className="w-full  border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none 
          
          bg-slate-900 border border-slate-800    focus:border-white focus:ring-1 focus:ring-white transition-all shadow-inner backdrop-blur-sm"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Token URI (Metadata)</label>
        <input
          type="text"
          required
          placeholder="ipfs://..."
          className="w-full  border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none 
          
          bg-slate-900 border border-slate-800    focus:border-white focus:ring-1 focus:ring-white transition-all shadow-inner backdrop-blur-sm"
          value={formData.tokenUri}
          onChange={(e) => setFormData({ ...formData, tokenUri: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Agent Domain URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            required
            placeholder="https://my-agent.com"
            className="flex-1  border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none 
            
            bg-slate-900 border border-slate-800    focus:border-white focus:ring-1 focus:ring-white transition-all shadow-inner backdrop-blur-sm"
            value={formData.domain}
            onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
          />
          <button
            type="button"
            onClick={validateDomain}
            disabled={validating || !formData.domain}
            className="px-6 py-2 btn-3d text-white rounded-lg font-medium disabled:opacity-50 transition-all hover:text-white hover:border-white"
          >
            {validating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Validate'}
          </button>
        </div>
        {validationMessage && (
          <div className={`flex items-center gap-2 text-sm ${validationStatus === 'success' ? 'text-green-400' : validationStatus === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
            {validationStatus === 'success' && <CheckCircle className="w-4 h-4" />}
            {validationStatus === 'error' && <XCircle className="w-4 h-4" />}
            {validationMessage}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || validationStatus !== 'success'}
        className="w-full py-4 btn-3d-primary font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed mt-8"
      >
        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Register Agent'}
      </button>
    </form>
  );
}
