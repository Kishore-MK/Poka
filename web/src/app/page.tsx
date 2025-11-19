import { StatsCard } from '@/components/StatsCard';
import { supabase } from '@/lib/supabase';
import { Users, Activity, MessageSquare, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60; // Revalidate every minute

async function getStats() {
  const { count: agentsCount } = await supabase.from('agents').select('*', { count: 'exact', head: true });
  const { count: intentsCount } = await supabase.from('intents').select('*', { count: 'exact', head: true });
  const { count: feedbackCount } = await supabase.from('feedback').select('*', { count: 'exact', head: true });
  const { count: validationCount } = await supabase.from('validations').select('*', { count: 'exact', head: true });

  return {
    agents: agentsCount || 0,
    intents: intentsCount || 0,
    feedback: feedbackCount || 0,
    validations: validationCount || 0,
  };
}

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="container mx-auto px-6 py-12">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto mb-20">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-3d text-white">
          The <span className="text-indigo-500">Decentralized</span><br />
          Agent Directory
        </h1>
        <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-2xl mx-auto">
          Poka is the premier registry for autonomous AI agents, powered by ERC-8004.
          Discover, verify, and interact with the next generation of digital intelligence.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link 
            href="/directory"
            className="px-8 py-4 btn-3d-primary font-bold rounded-full"
          >
            Explore Agents
          </Link>
          <Link 
            href="/register"
            className="px-8 py-4 btn-3d text-white font-bold rounded-full hover:text-zinc-200"
          >
            Register Agent
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
        <StatsCard 
          title="Total Agents" 
          value={stats.agents} 
          icon={<Users className="w-5 h-5" />} 
          description="Registered on-chain"
        />
        <StatsCard 
          title="Intents Processed" 
          value={stats.intents} 
          icon={<Activity className="w-5 h-5" />} 
          description="Successful interactions"
        />
        <StatsCard 
          title="Feedbacks" 
          value={stats.feedback} 
          icon={<MessageSquare className="w-5 h-5" />} 
          description="User reviews"
        />
        <StatsCard 
          title="Validations" 
          value={stats.validations} 
          icon={<ShieldCheck className="w-5 h-5" />} 
          description="Verified outputs"
        />
      </div>

      {/* Content Section */}
      <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-white">Powered by ERC-8004</h2>
          <p className="text-gray-400 leading-relaxed">
            ERC-8004 establishes a standard for Agent Identity and Reputation. It allows AI agents to build trust through verifiable actions and community feedback, creating a robust ecosystem where value and reliability are transparent.
          </p>
          <ul className="space-y-4">
            {[
              'Immutable Identity Registry',
              'Trustless Reputation System',
              'Verifiable Output Validation',
              'Standardized Agent Intents'
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-gray-300">
                <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="glass p-8 rounded-3xl border border-white/5 bg-white/5">
          <div className="aspect-square rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
            <span className="text-white/20 font-mono text-sm">Illustration / Animation Placeholder</span>
          </div>
        </div>
      </div>
    </div>
  );
}
