
import React from 'react';
import { useAppContext } from '../context/AppContext';
import Icon from './Icon';

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement<{ className?: string }>;
  color: 'blue' | 'yellow' | 'green' | 'indigo' | 'purple' | 'red';
  trend?: { value: number; label: string; isPositive: boolean }; // New optional prop for trend
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon, color, trend }) => {
  const { settings } = useAppContext();
  
  // Vibrant Gradient Maps
  const styles = {
    blue: {
      gradient: 'bg-gradient-to-br from-blue-500 to-blue-700',
      shadow: 'shadow-blue-500/40',
      iconColor: 'text-blue-200',
    },
    yellow: {
      gradient: 'bg-gradient-to-br from-amber-400 to-orange-500',
      shadow: 'shadow-orange-500/40',
      iconColor: 'text-orange-100',
    },
    green: {
      gradient: 'bg-gradient-to-br from-emerald-400 to-teal-600',
      shadow: 'shadow-emerald-500/40',
      iconColor: 'text-emerald-100',
    },
    indigo: {
      gradient: 'bg-gradient-to-br from-indigo-500 to-violet-700',
      shadow: 'shadow-indigo-500/40',
      iconColor: 'text-indigo-200',
    },
    purple: {
      gradient: 'bg-gradient-to-br from-purple-500 to-fuchsia-700',
      shadow: 'shadow-purple-500/40',
      iconColor: 'text-purple-200',
    },
    red: {
      gradient: 'bg-gradient-to-br from-red-500 to-rose-700',
      shadow: 'shadow-red-500/40',
      iconColor: 'text-rose-200',
    },
  };

  const currentStyle = styles[color] || styles.blue;

  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${currentStyle.gradient} ${currentStyle.shadow}`}>
      {/* Background Floating Icon (Decoration) */}
      <div className={`absolute -right-6 -bottom-6 opacity-20 transform rotate-12 scale-150 transition-transform duration-500 group-hover:scale-125 ${currentStyle.iconColor}`}>
         {React.cloneElement(icon, { className: 'w-24 h-24' })}
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start">
            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                {React.cloneElement(icon, { className: 'w-6 h-6 text-white' })}
            </div>
            {/* Trend Indicator (Mockup Logic if provided) */}
            {trend && (
                <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend.isPositive ? 'bg-green-400/20 text-green-50' : 'bg-red-400/20 text-red-50'}`}>
                    <span>{trend.value}%</span>
                    <span className="text-[10px] opacity-80">{trend.label}</span>
                    <Icon name={trend.isPositive ? "chevron-right" : "chevron-down"} className={`w-3 h-3 transform ${trend.isPositive ? '-rotate-90' : ''}`} />
                </div>
            )}
        </div>

        <div className="mt-4">
            <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
            <p className="text-sm font-medium opacity-90 mt-1">{title}</p>
        </div>
      </div>
      
      {/* Shine Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    </div>
  );
};

export default DashboardCard;
