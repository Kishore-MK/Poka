import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
}

export function StatsCard({ title, value, icon, description }: StatsCardProps) {
  return (
    <div className="card-3d p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        {icon && <div className="text-indigo-500">{icon}</div>}
      </div>
      <div className="text-3xl font-bold text-white mb-1 text-3d">{value}</div>
      {description && (
        <p className="text-xs text-slate-500">{description}</p>
      )}
    </div>
  );
}
