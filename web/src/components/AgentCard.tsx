"use client";
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star, ShieldCheck } from 'lucide-react';

interface AgentCardProps {
  id: string;
  owner: string;
  name?: string;
  description?: string;
  reputationScore?: number;
  validationCount?: number;
}

export function AgentCard({ id, owner, name, description, reputationScore = 0, validationCount = 0 }: AgentCardProps) {
  return (
    <Link href={`/agent/${id}`}>
      <motion.div 
        whileHover={{ y: -5 }}
        className="card-3d p-6 rounded-2xl group cursor-pointer h-full flex flex-col hover:shadow-2xl transition-all duration-300"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-lg font-bold text-white shadow-inner group-hover:border-indigo-500/50 transition-colors">
            {name ? name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full border border-white/5 shadow-inner">
            <Star className="w-3 h-3 text-indigo-400 fill-indigo-400" />
            <span className="text-xs font-medium text-slate-300">{reputationScore}</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
          {name || `Agent #${id}`}
        </h3>
        
        <p className="text-sm text-gray-400 mb-6 line-clamp-2 flex-grow">
          {description || 'No description available.'}
        </p>

        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-3 h-3" />
            <span>{validationCount} Validations</span>
          </div>
          <span className="text-xs text-gray-600 font-mono">
            {owner.slice(0, 6)}...{owner.slice(-4)}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
