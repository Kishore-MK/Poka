import { AgentCard } from '@/components/AgentCard';
import { supabase } from '@/lib/supabase';

export const revalidate = 0; // Dynamic

async function getAgents() {
  const { data: agents } = await supabase
    .from('agents')
    .select(`
      *,
      feedback (score),
      validations (count)
    `)
    .order('created_at', { ascending: false });

  return agents?.map((agent: any) => {
    // Calculate avg score
    const scores = agent.feedback?.map((f: any) => f.score) || [];
    const avgScore = scores.length > 0 
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) 
      : 0;

    // Parse metadata from token_uri if possible, or use placeholder
    // For now, we'll just use the ID as name if metadata isn't fetched/stored separately
    // Ideally, the indexer would fetch IPFS metadata and store it in columns.
    // We'll assume 'token_uri' might contain a name or we just show ID.
    
    return {
      id: agent.id,
      owner: agent.owner,
      name: `Agent #${agent.id}`, // Placeholder until metadata is indexed properly
      description: 'Autonomous agent registered on Poka.',
      reputationScore: avgScore,
      validationCount: agent.validations?.[0]?.count || 0,
    };
  }) || [];
}

export default async function DirectoryPage() {
  const agents = await getAgents();

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Agent Directory</h1>
          <p className="text-gray-400">Discover and verify autonomous agents.</p>
        </div>
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Search agents..." 
            className="bg-slate-900 border border-slate-800 rounded-full px-6 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all w-64 shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <AgentCard key={agent.id} {...agent} />
        ))}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500">No agents found.</p>
        </div>
      )}
    </div>
  );
}
