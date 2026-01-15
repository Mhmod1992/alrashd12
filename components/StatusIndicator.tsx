
import React from 'react';
import RefreshCwIcon from './icons/RefreshCwIcon';

interface StatusIndicatorProps {
    status?: 'saving' | 'saved' | 'error';
    onRetry?: () => void;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, onRetry }) => {
    
    if (status === 'saving') {
        return (
            <div className="flex items-center gap-1 text-yellow-500">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
                <span className="text-xs animate-pulse">جاري الحفظ...</span>
            </div>
        );
    }
    if (status === 'error') {
        return (
            <button 
                onClick={(e) => { e.stopPropagation(); if(onRetry) onRetry(); }} 
                className={`flex items-center gap-1 text-red-500 font-semibold hover:underline focus:outline-none`}
                title="اضغط لإعادة المحاولة"
            >
                <RefreshCwIcon className="w-3 h-3" />
                <span className="text-xs">فشل (إعادة)</span>
            </button>
        );
    }
    if (status === 'saved') {
         return <span className="text-xs text-green-500 animate-fadeOut font-semibold">✓ تم الحفظ</span>;
    }
    return null;
};

export default StatusIndicator;
