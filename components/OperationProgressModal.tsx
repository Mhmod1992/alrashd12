import React from 'react';
import Modal from './Modal';
import Button from './Button';
import CheckCircleIcon from './icons/CheckCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';

export interface OperationProgressModalProps {
    isOpen: boolean;
    title: string;
    description?: string;
    currentStep: string;
    progress: number; // 0 to 100
    totalItems?: number;
    currentItemIndex?: number;
    itemTypeLabel?: string;
    status?: 'in_progress' | 'success' | 'error';
    errorMessage?: string;
    onClose?: () => void;
}

export const OperationProgressModal: React.FC<OperationProgressModalProps> = ({
    isOpen,
    title,
    description,
    currentStep,
    progress,
    totalItems,
    currentItemIndex,
    itemTypeLabel = 'عنصر',
    status = 'in_progress',
    errorMessage,
    onClose,
}) => {
    if (!isOpen) return null;

    const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                if (status !== 'in_progress' && onClose) {
                    onClose();
                }
            }}
            title={title}
            hideCloseButton={status === 'in_progress'}
        >
            <div className="p-6 text-center space-y-6" dir="rtl">
                {/* Header Icon / Animation */}
                <div className="flex justify-center">
                    {status === 'in_progress' && (
                        <div className="relative flex items-center justify-center">
                            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <RefreshCwIcon className="w-8 h-8 animate-spin" />
                            </div>
                            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                            </span>
                        </div>
                    )}
                    {status === 'success' && (
                        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
                            <CheckCircleIcon className="w-9 h-9" />
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-700/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                            <AlertTriangleIcon className="w-9 h-9" />
                        </div>
                    )}
                </div>

                {/* Status Title & Subtitle */}
                <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                        {status === 'in_progress' && title}
                        {status === 'success' && 'اكتملت العملية بنجاح!'}
                        {status === 'error' && 'تعذر إكمال العملية'}
                    </h3>
                    {description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {description}
                        </p>
                    )}
                </div>

                {/* Progress Bar Container */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-slate-600 dark:text-slate-300">
                            {status === 'in_progress' ? 'نسبة الإنجاز' : status === 'success' ? 'مكتمل بنسبة' : 'توقف عند'}
                        </span>
                        <span className={`text-sm font-bold ${
                            status === 'success' 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : status === 'error' 
                                ? 'text-rose-600 dark:text-rose-400' 
                                : 'text-blue-600 dark:text-blue-400'
                        }`}>
                            {clampedProgress}%
                        </span>
                    </div>

                    <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ease-out ${
                                status === 'success'
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                    : status === 'error'
                                    ? 'bg-rose-500'
                                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 animate-pulse'
                            }`}
                            style={{ width: `${clampedProgress}%` }}
                        />
                    </div>
                </div>

                {/* Current Step Description Card */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 text-right space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium">المرحلة الحالية:</span>
                        {totalItems !== undefined && currentItemIndex !== undefined && totalItems > 0 && (
                            <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                {currentItemIndex} من {totalItems} {itemTypeLabel}
                            </span>
                        )}
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {status === 'error' ? errorMessage || currentStep : currentStep}
                    </p>
                </div>

                {/* Footer Buttons */}
                <div className="pt-2 flex justify-center">
                    {status !== 'in_progress' && onClose && (
                        <Button
                            variant={status === 'success' ? 'primary' : 'secondary'}
                            onClick={onClose}
                            className="w-full sm:w-auto px-8"
                        >
                            {status === 'success' ? 'تم، إغلاق النافذة' : 'إغلاق'}
                        </Button>
                    )}
                    {status === 'in_progress' && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 py-1.5 px-3 rounded-lg border border-amber-200 dark:border-amber-800/40">
                            ⚠️ يرجى عدم إغلاق المتصفح أو تحديث الصفحة أثناء سير العملية
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default OperationProgressModal;
