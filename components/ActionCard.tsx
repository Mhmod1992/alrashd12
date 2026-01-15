
import React from 'react';
import ArrowRightIcon from './icons/ArrowRightIcon';
import { useAppContext } from '../context/AppContext';

interface ActionCardProps {
  title: string;
  icon: React.ReactElement<{ className?: string }>;
  onClick: () => void;
  color?: 'blue' | 'green' | 'purple' | 'orange'; // Added color prop
}

const ActionCard: React.FC<ActionCardProps> = ({ title, icon, onClick, color = 'blue' }) => {
  const { settings } = useAppContext();
  
  const colorMap = {
      blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white',
      green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white',
      purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white',
      orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white',
  };

  const currentColorClass = colorMap[color] || colorMap.blue;

  return (
    <button 
        onClick={onClick}
        className="group relative flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 w-full aspect-square md:aspect-auto md:h-40"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-300 ${currentColorClass} shadow-sm`}>
        {React.cloneElement(icon, { className: `w-7 h-7 transition-transform duration-300 group-hover:scale-110` })}
      </div>
      
      <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base text-center">
          {title}
      </h3>
      
      <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-2 group-hover:translate-x-0">
          <ArrowRightIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
      </div>
    </button>
  );
}

export default ActionCard;
