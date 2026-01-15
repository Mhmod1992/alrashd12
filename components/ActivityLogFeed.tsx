
import React from 'react';
import { ActivityLog, Page } from '../types';
import Icon from './Icon';
import { useAppContext } from '../context/AppContext';
import { timeAgo } from '../lib/utils';

const getLogStyle = (action: string): { icon: React.ReactNode, color: string, bgColor: string } => {
    const actionLower = action.toLowerCase();
    
    if (action.includes('أنشأ طلبًا') || action.includes('إضافة مصروف')) {
        return { icon: <Icon name="add" />, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' };
    }
    if (action.includes('حذف')) {
        return { icon: <Icon name="delete" />, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' };
    }
    if (action.includes('تغيير حالة') || action.includes('غيّر حالة')) {
        return { icon: <Icon name="refresh-cw" />, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
    }
    if (action.includes('تعديل بيانات')) {
        return { icon: <Icon name="edit" />, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' };
    }
    if (action.includes('تسجيل دخول')) {
        return { icon: <Icon name="employee" />, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' };
    }
    
    return { icon: <Icon name="history" />, color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-700' };
};

const formatDetails = (
    details: string, 
    link_id?: string, 
    link_page?: Page,
    onLinkClick?: (page: Page, id: string) => void
): React.ReactNode => {
    const regex = /#(\d+)/g;
    const parts = details.split(regex);

    return (
        <>
            {parts.map((part, index) => {
                // If it's a number part from the regex match
                if (index % 2 === 1) {
                    if (link_id && link_page && onLinkClick) {
                        return (
                            <button 
                                key={index}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onLinkClick(link_page, link_id);
                                }}
                                className="font-bold text-blue-600 dark:text-blue-400 hover:underline mx-1"
                            >
                                #{part}
                            </button>
                        );
                    }
                    return <strong key={index} className="font-semibold text-slate-900 dark:text-slate-100 mx-1">#{part}</strong>;
                }
                
                // For non-number parts, check for quotes
                const quoteRegex = /"([^"]*)"/g;
                const quoteParts = part.split(quoteRegex);
                
                return quoteParts.map((qPart, qIndex) => {
                    if (qIndex % 2 === 1) {
                        return <strong key={`${index}-${qIndex}`} className="font-semibold text-slate-900 dark:text-slate-100 mx-1">"{qPart}"</strong>;
                    }
                    return qPart;
                });
            })}
        </>
    );
};


interface ActivityLogFeedProps {
    logs: ActivityLog[];
}

const ActivityLogFeed: React.FC<ActivityLogFeedProps> = ({ logs }) => {
    const { setPage, setSelectedRequestId } = useAppContext();

    const handleLinkClick = (page: Page, id: string) => {
        if (page === 'fill-request') {
            setSelectedRequestId(id);
        }
        setPage(page);
    };

    if (logs.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400">
                <Icon name="history" className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold">لا توجد أنشطة مسجلة لعرضها.</p>
                <p className="text-xs mt-1">سيظهر هنا سجل بالتغييرات الهامة في النظام.</p>
            </div>
        );
    }

    return (
        <div className="relative">
            {logs.map((log, index) => {
                const { icon, color, bgColor } = getLogStyle(log.action);
                return (
                    <div key={log.id} className="relative flex items-start pb-8 animate-fade-in">
                        {/* Timeline connector line */}
                        {index < logs.length - 1 && (
                            <div className="absolute top-5 right-5 -bottom-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                        )}

                        {/* Icon */}
                        <div className={`relative z-10 flex-shrink-0 w-10 h-10 ${bgColor} rounded-xl flex items-center justify-center shadow-sm`}>
                            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `w-5 h-5 ${color}` })}
                        </div>

                        {/* Text content */}
                        <div className="flex-1 mr-4">
                            <p className="text-sm text-slate-800 dark:text-slate-300">
                                <span className="font-bold">{log.employeeName}</span> {log.action.toLowerCase()}{' '}
                                {formatDetails(log.details, log.link_id, log.link_page, handleLinkClick)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {timeAgo(log.timestamp)}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ActivityLogFeed;
