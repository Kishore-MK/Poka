'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Wallet, LogOut, ChevronDown } from 'lucide-react';
import { createWalletClient, custom } from 'viem';
import { customChain } from '@/lib/chain';

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const disconnectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkConnection();
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (disconnectRef.current && !disconnectRef.current.contains(event.target as Node)) {
        setShowDisconnect(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const client = createWalletClient({
          chain: customChain,
          transport: custom(window.ethereum)
        });
        const addresses = await client.getAddresses();
        if (addresses.length > 0) {
          setAddress(addresses[0]);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    setIsConnecting(true);
    try {
      const client = createWalletClient({
        chain: customChain,
        transport: custom(window.ethereum)
      });

      const [userAddress] = await client.requestAddresses();
      setAddress(userAddress);

      // Switch network if needed
      const chainId = await client.getChainId();
      if (chainId !== customChain.id) {
        try {
          await client.switchChain({ id: customChain.id });
        } catch (error: any) {
          if (error.code === 4902) {
            await client.addChain({ chain: customChain });
          }
        }
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setShowDisconnect(false);
  };

  const links = [
    { href: '/', label: 'Home' },
    { href: '/directory', label: 'Directory' },
    { href: '/register', label: 'Register Agent' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/20 backdrop-blur-md">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Poka<span className="text-indigo-500">.</span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'text-sm font-medium transition-colors hover:text-indigo-400',
                pathname === link.href ? 'text-white' : 'text-slate-400'
              )}
            >
              {link.label} 
            </Link>
          ))}
        </div>

        <div className="hidden md:block relative" ref={disconnectRef}>
          {address ? (
            <div className="relative">
              <button 
                onClick={() => setShowDisconnect(!showDisconnect)}
                className="px-4 py-2 text-sm font-medium btn-3d text-white rounded-full flex items-center gap-2 hover:border-indigo-500/50 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {`${address.slice(0, 6)}...${address.slice(-4)}`}
                <ChevronDown className={clsx("w-4 h-4 transition-transform", showDisconnect ? "rotate-180" : "")} />
              </button>

              <AnimatePresence>
                {showDisconnect && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 py-2 bg-slate-900 border border-white/10 rounded-xl shadow-xl backdrop-blur-xl z-50"
                  >
                    <button
                      onClick={disconnectWallet}
                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Disconnect
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button 
              onClick={connectWallet}
              disabled={isConnecting}
              className="px-4 py-2 text-sm font-medium btn-3d text-slate-300 hover:text-white rounded-full flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden absolute top-16 left-0 right-0 bg-black/90 border-b border-white/5 p-6 space-y-4 backdrop-blur-xl"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={clsx(
                'block text-lg font-medium transition-colors',
                pathname === link.href ? 'text-white' : 'text-gray-400'
              )}
            >
              {link.label}
            </Link>
          ))}
          {address ? (
            <div className="space-y-2">
              <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {`${address.slice(0, 6)}...${address.slice(-4)}`}
              </div>
              <button 
                onClick={disconnectWallet}
                className="w-full py-3 text-sm font-medium bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all text-red-400 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={connectWallet}
              className="w-full py-3 text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          )}
        </motion.div>
      )}
    </nav>
  );
}
