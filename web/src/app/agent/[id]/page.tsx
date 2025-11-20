import { supabase } from '@/lib/supabase';
import { FeedbackList } from '@/components/FeedbackList';
import { Star, ShieldCheck, Globe, User } from 'lucide-react';
import { notFound } from 'next/navigation';
import Image from 'next/image';

export const revalidate = 0;

async function getAgentDetails(id: string) {
  const { data: agent } = await supabase
    .from('agents')
    .select(`
      *,
      feedback (*),
      validations (*)
    `)
    .eq('id', id)
    .single();

  if (!agent) return null;

  // Calculate avg score
  const scores = agent.feedback?.map((f: any) => f.score) || [];
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
    : 0;

  return {
    ...agent,
    avgScore,
  };
}

export default async function AgentDetailsPage({ params }: { params: { id: string } }) {
  const agent = await getAgentDetails((await params).id);

  if (!agent) {
    notFound();
  }

  return (
    <div className="container mx-auto px-6 py-12">
      {/* Header */}
      <div className="card-3d p-8 rounded-3xl mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">

            <Image src={agent.token_uri} alt="Agent" width={600} height={600}  className="w-24 h-24 rounded-full" />

            <div>
              <h1 className="text-3xl font-bold text-white mb-2 text-3d">{agent.name} <a href={agent.token_uri} className='hover:underline' target="_blank" rel="noopener noreferrer">#{agent.id}</a></h1>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span className="font-mono">{agent.owner}</span>
                </div>
                {agent.domain && (
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    <a href={agent.domain} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">
                      Domain
                    </a>
                  </div>
                )}
              </div>

            </div>

          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-1 text-3xl font-bold text-white mb-1 text-3d">
                <Star className="w-6 h-6 text-indigo-400 fill-indigo-400" />
                {agent.avgScore}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Reputation</div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="text-center">
              <div className="flex items-center gap-1 text-3xl font-bold text-white mb-1 text-3d">
                <ShieldCheck className="w-6 h-6 text-indigo-400" />
                {agent.validations?.length || 0}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Validations</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-indigo-400" />
              Recent Feedback
            </h2>
            <FeedbackList feedbacks={agent.feedback || []} />
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card-3d p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Validation History</h3>
            <div className="space-y-4">
              {agent.validations?.map((val: any) => (
                <div key={val.request_hash} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 font-mono">{val.request_hash.slice(0, 8)}...</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${val.status === 'Responded' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700/50 text-slate-400'
                    }`}>
                    {val.status}
                  </span>
                </div>
              ))}
              {(!agent.validations || agent.validations.length === 0) && (
                <p className="text-gray-500 text-sm">No validations yet.</p>
              )}
            </div>
          </div>

          <button className="w-full py-3 btn-3d text-white font-medium rounded-xl">
            Request Validation
          </button>
          <button className="w-full py-3 btn-3d text-white font-medium rounded-xl">
            Give Feedback
          </button>
        </div>
      </div>
    </div>
  );
}
