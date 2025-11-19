import { Star } from 'lucide-react';

interface Feedback {
  id: number;
  client: string;
  score: number;
  tags: string[];
  created_at: string;
}

interface FeedbackListProps {
  feedbacks: Feedback[];
}

export function FeedbackList({ feedbacks }: FeedbackListProps) {
  if (feedbacks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 glass rounded-2xl">
        No feedback yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedbacks.map((feedback) => (
        <div key={feedback.id} className="glass p-6 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold text-white">
                {feedback.client.slice(2, 4)}
              </div>
              <span className="text-sm font-medium text-gray-300">
                {feedback.client.slice(0, 6)}...{feedback.client.slice(-4)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-yellow-400">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-bold">{feedback.score}</span>
            </div>
          </div>
          
          {feedback.tags && feedback.tags.length > 0 && (
            <div className="flex gap-2 mt-3">
              {feedback.tags.map((tag, i) => (
                <span key={i} className="px-2 py-1 text-xs rounded-md bg-white/5 text-gray-400 border border-white/5">
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="mt-4 text-xs text-gray-600">
            {new Date(feedback.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}
