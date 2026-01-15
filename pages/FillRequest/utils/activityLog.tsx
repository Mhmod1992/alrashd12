import React from 'react';
import { ActivityLog } from '../../../types';
import Icon from '../../../components/Icon';

/**
 * تنسيق تفاصيل سجل النشاط - يبرز النصوص بين علامات التنصيص
 */
export const formatLogDetails = (details: string) => {
    const regex = /"([^"]*)"/g;
    const parts = details.split(regex);
    return (
        <>
            {parts.map((part, index) => {
                if (index % 2 === 1) return <strong key={index} className="font-bold text-gray-800 dark:text-gray-200 mx-1">"{part}"</strong>;
                return part;
            })}
        </>
    );
};

/**
 * الحصول على أيقونة ولون حسب نوع الإجراء في سجل النشاط
 */
export const getActionIcon = (action: string): { icon: React.ReactNode, color: string, bg: string } => {
    // Green: For Adding (إضافة)
    if (action.includes('إضافة')) return { icon: <Icon name="add" />, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/40' };

    // Red: For Deletion (حذف)
    if (action.includes('حذف')) return { icon: <Icon name="delete" />, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40' };

    // Blue: For Editing/Changing (تعديل، تغيير، تلوين، ختم)
    if (action.includes('تعديل') || action.includes('تغيير') || action.includes('تلوين') || action.includes('ختم') || action.includes('حفظ'))
        return { icon: <Icon name="edit" />, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/40' };

    return { icon: <Icon name="history" />, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-900/40' };
};

/**
 * تجميع سجلات النشاط حسب التاريخ (اليوم، أمس، تواريخ أخرى)
 */
export const groupLogsByDate = (logs: ActivityLog[]) => {
    const groups: Record<string, ActivityLog[]> = {};
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    logs.forEach(log => {
        const logDate = new Date(log.timestamp);
        const dateStr = logDate.toLocaleDateString('en-CA');

        let groupTitle = '';
        if (dateStr === todayStr) groupTitle = 'اليوم';
        else if (dateStr === yesterdayStr) groupTitle = 'أمس';
        else groupTitle = logDate.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });

        if (!groups[groupTitle]) groups[groupTitle] = [];
        groups[groupTitle].push(log);
    });

    return Object.entries(groups);
};

/**
 * تنسيق الطابع الزمني لسجل النشاط
 */
export const formatLogTimestamp = (timestamp: string) => {
    const logDate = new Date(timestamp);
    const now = new Date();
    const diffSeconds = (now.getTime() - logDate.getTime()) / 1000;

    if (diffSeconds < 60 && diffSeconds >= 0) {
        return { datePart: 'الآن', timePart: '' };
    }

    const datePart = logDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/-/g, ' / ');
    const timePart = logDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    return { datePart, timePart };
};
