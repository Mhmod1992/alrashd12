import React from 'react';
import Icon from './Icon';

interface DateNavigatorProps {
    date: Date;
    onDateChange: (date: Date) => void;
    className?: string;
}

const DateNavigator: React.FC<DateNavigatorProps> = ({ date, onDateChange, className = '' }) => {
    const handlePrevDay = () => {
        const prevDay = new Date(date);
        prevDay.setDate(date.getDate() - 1);
        onDateChange(prevDay);
    };

    const handleNextDay = () => {
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        onDateChange(nextDay);
    };

    const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year} / ${month} / ${day}`;
    };

    return (
        <div className={`flex items-center justify-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
            <button 
                onClick={handlePrevDay}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors"
                title="اليوم السابق"
            >
                <Icon name="chevron-left" className="w-5 h-5" />
            </button>
            
            <div className="px-4 py-1 text-lg font-bold font-mono text-slate-800 dark:text-slate-200 tracking-wider min-w-[140px] text-center">
                {formatDate(date)}
            </div>

            <button 
                onClick={handleNextDay}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors"
                title="اليوم التالي"
            >
                <Icon name="chevron-right" className="w-5 h-5" />
            </button>
        </div>
    );
};

export default DateNavigator;
