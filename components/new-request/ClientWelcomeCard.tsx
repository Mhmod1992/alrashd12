
import React, { useEffect, useState } from 'react';
import UserCircleIcon from '../icons/UserCircleIcon';
import HistoryIcon from '../icons/HistoryIcon';
import XIcon from '../icons/XIcon';
import StarIcon from '../icons/StarIcon';

interface ClientWelcomeCardProps {
    isVisible: boolean;
    clientName: string;
    visitCount: number;
    lastVisit: string;
    isVip?: boolean;
    unpaidRequestsCount?: number;
    totalDebt?: number;
    onClose: () => void;
    onViewHistory?: () => void;
}

const ClientWelcomeCard: React.FC<ClientWelcomeCardProps> = ({
    isVisible,
    clientName,
    visitCount,
    lastVisit,
    isVip,
    unpaidRequestsCount = 0,
    totalDebt = 0,
    onClose,
    onViewHistory
}) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isVisible) {
            setShow(true);
            // If there's debt, keep the card visible longer or indefinitely until closed
            const displayTime = (unpaidRequestsCount > 0) ? 10000 : 5000;
            timer = setTimeout(() => {
                onClose();
            }, displayTime);
        } else {
            setShow(false);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [isVisible, onClose, unpaidRequestsCount]);

    if (!show) return null;

    const hasDebt = unpaidRequestsCount > 0;

    return (
        <div 
            className={`fixed z-50 animate-slide-in-down md:animate-slide-in-up
                       top-4 left-4 right-4 
                       md:top-auto md:bottom-6 md:right-6 md:left-auto md:w-80`}
        >
            <div className={`bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-l-4 ${hasDebt ? 'border-l-red-500' : 'border-l-blue-500'} rounded-lg shadow-2xl dark:shadow-black/50 p-4 flex items-start gap-4 border border-slate-200 dark:border-slate-700 relative overflow-hidden transition-colors duration-300`}>
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-2 left-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <XIcon className="w-4 h-4" />
                </button>

                {/* Decoration */}
                <div className={`absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 ${hasDebt ? 'bg-red-500/10' : 'bg-blue-500/10'} rounded-full blur-xl`}></div>

                {/* Icon */}
                <div className="flex-shrink-0 relative">
                    <div className={`w-12 h-12 ${hasDebt ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'} rounded-full flex items-center justify-center shadow-sm`}>
                        <UserCircleIcon className="w-7 h-7" />
                    </div>
                    {isVip && (
                        <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-white p-0.5 rounded-full shadow-sm border border-white dark:border-slate-800">
                            <StarIcon className="w-3 h-3 fill-current" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {hasDebt ? 'تنبيه هـام' : 'أهلاً بعودتك!'}
                    </h4>
                    <p className={`text-sm font-semibold ${hasDebt ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'} truncate mb-1`}>
                        {clientName}
                    </p>
                    
                    {hasDebt ? (
                        <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-md">
                            <div className="flex items-center justify-between text-xs font-black text-red-700 dark:text-red-300">
                                <span>مديونية معلقة:</span>
                                <span className="bg-red-600 text-white px-1.5 py-0.5 rounded">{totalDebt.toLocaleString()} ريال</span>
                            </div>
                            <p className="text-[10px] text-red-600 dark:text-red-400 mt-1 leading-tight">يرجى مطالبة العميل بالمبلغ قبل البدء.</p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-2">
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                                <span className="font-bold text-slate-700 dark:text-slate-300">{visitCount}</span>
                                <span>زيارات</span>
                            </div>
                            {lastVisit && (
                                <div className="flex items-center gap-1">
                                    <HistoryIcon className="w-3 h-3 opacity-70" />
                                    <span>{new Date(lastVisit).toLocaleDateString('en-GB')}</span>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {onViewHistory && (
                        <button 
                            onClick={onViewHistory}
                            className={`mt-1 text-[11px] ${hasDebt ? 'text-red-700 dark:text-red-400 font-bold' : 'text-blue-600 dark:text-blue-400'} hover:underline flex items-center gap-1`}
                        >
                            <HistoryIcon className="w-3 h-3" />
                            {hasDebt ? 'عرض تفاصيل الديون' : 'عرض سجل الطلبات'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClientWelcomeCard;
