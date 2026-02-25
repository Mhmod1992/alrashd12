import React from 'react';
import { InspectionRequest, RequestStatus, ReportStamp } from '../../../types';
import Icon from '../../../components/Icon';
import UsersIcon from '../../../components/icons/UsersIcon';
import RefreshCwIcon from '../../../components/icons/RefreshCwIcon';
import CalendarIcon from '../../../components/icons/HistoryIcon';
import InfoCircleIcon from './InfoCircleIcon';

interface FillRequestHeaderProps {
    request: InspectionRequest;
    carDetails: {
        makeNameEn: string;
        modelNameEn: string;
        year: string | number | undefined;
    };
    isLocked: boolean;
    isSubmitting: boolean;
    themeColor: string;
    onGoBack: () => void;
    onOpenTechnicianModal: () => void;
    onToggleStamp: (stamp: ReportStamp) => void;
    onSave: () => void;
    onOpenActivityLog: () => void;
    onOpenInfoModal: () => void;
}

const FillRequestHeader = ({
    request,
    carDetails,
    isLocked,
    isSubmitting,
    themeColor,
    onGoBack,
    onOpenTechnicianModal,
    onToggleStamp,
    onSave,
    onOpenActivityLog,
    onOpenInfoModal,
}: FillRequestHeaderProps) => {
    return (
        <div className="sticky top-0 z-40 bg-[#f8fafc]/95 dark:bg-slate-900/95 backdrop-blur shadow-md border-b dark:border-slate-700 no-print flex-shrink-0">
            <div className="max-w-6xl mx-auto w-full h-16 px-2 sm:px-4 flex items-center justify-between gap-2">

                {/* Right: Back Button */}
                <div className="flex-shrink-0">
                    <button type="button" onClick={onGoBack} className="group flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center shadow-sm group-hover:border-${themeColor}-400 group-hover:text-${themeColor}-500 transition-all`}>
                            <Icon name="back" className="w-4 h-4 transform scale-x-[-1]" />
                        </div>
                        <span className="font-bold text-sm hidden md:inline">الرجوع</span>
                    </button>
                </div>

                {/* Center: Title Info */}
                <div className="flex flex-col items-center justify-center flex-1 min-w-0 px-2">
                    <span className="text-xl sm:text-3xl font-black text-slate-800 dark:text-white font-numeric tracking-widest leading-none truncate">#{request.request_number}</span>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[120px] sm:max-w-[200px]" dir="ltr">{carDetails.makeNameEn} {carDetails.modelNameEn} {carDetails.year}</span>
                </div>

                {/* Left: Action Buttons */}
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    {!isLocked && (
                        <button
                            onClick={onOpenTechnicianModal}
                            className="w-8 h-8 sm:w-auto sm:px-3 sm:py-2 rounded-full sm:rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-orange-500 hover:border-orange-400 flex items-center justify-center gap-2 transition-all shadow-sm"
                            title="تحديد الفنيين لكامل الطلب"
                        >
                            <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline text-xs font-bold">فنيو الطلب</span>
                        </button>
                    )}
                    {!isLocked && (
                        <button
                            onClick={() => onToggleStamp('CUSTOMER_REQUEST_INCOMPLETE')}
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all shadow-sm ${request.report_stamps?.includes('CUSTOMER_REQUEST_INCOMPLETE') ? 'bg-red-500 text-white ring-2 ring-red-400 shadow-lg scale-110' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:border-red-400'}`}
                            title="ختم: لم يكتمل بطلب العميل"
                        >
                            <Icon name="check-circle" className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    )}
                    {!isLocked && (
                        <button
                            onClick={onSave}
                            disabled={isSubmitting}
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-${themeColor}-600 text-white flex items-center justify-center shadow-lg hover:bg-${themeColor}-700 transition-all disabled:opacity-50`}
                            title="حفظ يدوي"
                        >
                            {isSubmitting ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <Icon name="save" className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </button>
                    )}
                    <button
                        onClick={onOpenActivityLog}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-purple-600 hover:border-purple-400 flex items-center justify-center transition-all shadow-sm"
                        title="سجل النشاط"
                    >
                        <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button onClick={onOpenInfoModal} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:border-blue-400 flex items-center justify-center transition-all shadow-sm">
                        <InfoCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FillRequestHeader;
