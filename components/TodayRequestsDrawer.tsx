import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { RequestStatus } from '../types';
import XIcon from './icons/XIcon';
import ClipboardListIcon from './icons/ClipboardListIcon';
import CarIcon from './icons/CarIcon';
import UserCircleIcon from './icons/UserCircleIcon';

interface TodayRequestsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    currentRequestId?: string | null;
}

// Preset eye-catching badge styles for inspection types
const INSPECTION_TYPE_COLORS = [
    'bg-purple-600 text-white border-purple-700 dark:bg-purple-500',
    'bg-indigo-600 text-white border-indigo-700 dark:bg-indigo-500',
    'bg-teal-600 text-white border-teal-700 dark:bg-teal-500',
    'bg-blue-600 text-white border-blue-700 dark:bg-blue-500',
    'bg-amber-600 text-white border-amber-700 dark:bg-amber-500',
    'bg-rose-600 text-white border-rose-700 dark:bg-rose-500',
];

export const TodayRequestsDrawer: React.FC<TodayRequestsDrawerProps> = ({
    isOpen,
    onClose,
    currentRequestId,
}) => {
    const { requests, clients, cars, carMakes, carModels, inspectionTypes } = useAppContext();

    // Helper to check if a date string is today
    const isToday = (dateStr?: string) => {
        if (!dateStr) return false;
        try {
            const d = new Date(dateStr);
            const today = new Date();
            return (
                d.getFullYear() === today.getFullYear() &&
                d.getMonth() === today.getMonth() &&
                d.getDate() === today.getDate()
            );
        } catch {
            return false;
        }
    };

    // Filter today's active requests (NEW or IN_PROGRESS)
    const todayActiveRequests = useMemo(() => {
        return requests
            .filter(r => {
                const isActiveStatus =
                    r.status === RequestStatus.NEW || r.status === RequestStatus.IN_PROGRESS;
                return isActiveStatus && isToday(r.created_at);
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [requests]);

    const newCount = useMemo(
        () => todayActiveRequests.filter(r => r.status === RequestStatus.NEW).length,
        [todayActiveRequests]
    );

    const inProgressCount = useMemo(
        () => todayActiveRequests.filter(r => r.status === RequestStatus.IN_PROGRESS).length,
        [todayActiveRequests]
    );

    // Format time in 12-hour Arabic format
    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    // Helper to resolve car description & plate
    const getCarInfo = (req: typeof requests[0]) => {
        let desc = '';
        let plate = '';

        if (req.car_snapshot) {
            const { make_ar, model_ar, year } = req.car_snapshot;
            desc = `${make_ar || ''} ${model_ar || ''} ${year || ''}`.trim();
        }

        const car = cars.find(c => c.id === req.car_id);
        if (car) {
            if (!desc) {
                const make = carMakes.find(m => m.id === car.make_id)?.name_ar || '';
                const model = carModels.find(m => m.id === car.model_id)?.name_ar || '';
                desc = `${make} ${model} ${car.year || ''}`.trim();
            }
            if (car.plate_number) {
                plate = car.plate_number;
            }
        }

        return {
            description: desc || 'غير محدد',
            plate: plate,
        };
    };

    // Helper to resolve client details (Name & Phone)
    const getClientInfo = (req: typeof requests[0]) => {
        const client = clients.find(c => c.id === req.client_id);
        if (client) {
            return {
                name: client.name || 'عميل نقدي',
                phone: client.phone || '',
            };
        }
        return {
            name: 'عميل نقدي',
            phone: '',
        };
    };

    // Helper to resolve inspection type details & color
    const getInspectionTypeDetails = (req: typeof requests[0]) => {
        const index = inspectionTypes.findIndex(i => i.id === req.inspection_type_id);
        const inspType = inspectionTypes[index];
        const colorClass = index >= 0
            ? INSPECTION_TYPE_COLORS[index % INSPECTION_TYPE_COLORS.length]
            : INSPECTION_TYPE_COLORS[0];

        return {
            name: inspType?.name || 'فحص عام',
            colorClass,
        };
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] overflow-hidden">
            {/* Backdrop Overlay */}
            <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
                onClick={onClose}
            />

            {/* Slide-in Slim Drawer from Left Side */}
            <aside
                className="fixed top-0 left-0 bottom-0 w-72 sm:w-80 bg-white dark:bg-slate-900 shadow-2xl z-[210] flex flex-col transform transition-transform duration-300 ease-out animate-slide-in-left border-r dark:border-slate-800"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                            <ClipboardListIcon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                <span>طلبات اليوم</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black border border-blue-200 dark:border-blue-800">
                                    {todayActiveRequests.length}
                                </span>
                            </h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                قائمة للاستعلام والعرض فقط
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="إغلاق الدرج"
                    >
                        <XIcon className="w-4.5 h-4.5" />
                    </button>
                </div>

                {/* Sub-Header Status Summary */}
                <div className="px-3 py-1.5 bg-slate-100/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-700/60 flex items-center justify-around text-[11px] font-bold">
                    <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>جديد ({newCount})</span>
                    </div>
                    <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-700"></div>
                    <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>قيد التنفيذ ({inProgressCount})</span>
                    </div>
                </div>

                {/* Drawer Body - Pure Read-Only Cards */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar">
                    {todayActiveRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-52 text-center p-4 text-slate-400">
                            <ClipboardListIcon className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                            <p className="font-bold text-xs text-slate-600 dark:text-slate-300 mb-0.5">
                                لا توجد طلبات جارية اليوم
                            </p>
                            <p className="text-[10px] text-slate-400">
                                لم يتم تسجيل طلبات جديدة أو قيد التنفيذ بتاريخ اليوم.
                            </p>
                        </div>
                    ) : (
                        todayActiveRequests.map(req => {
                            const isCurrent = currentRequestId === req.id;
                            const isNew = req.status === RequestStatus.NEW;
                            const inspType = getInspectionTypeDetails(req);
                            const carInfo = getCarInfo(req);
                            const clientInfo = getClientInfo(req);
                            const priceAmount = req.price ?? 0;

                            return (
                                <div
                                    key={req.id}
                                    className={`p-2.5 rounded-xl border transition-all select-none ${
                                        isCurrent
                                            ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs ring-1 ring-blue-400/80'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80'
                                    }`}
                                >
                                    {/* 1. Request Number & Status Badge */}
                                    <div className="flex items-center justify-between gap-1 mb-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-black text-xs text-slate-900 dark:text-slate-100">
                                                طلب #{req.request_number}
                                            </span>
                                            {isCurrent && (
                                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-blue-600 text-white shadow-2xs shrink-0">
                                                    الطلب الحالي
                                                </span>
                                            )}
                                        </div>

                                        <span
                                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 ${
                                                isNew
                                                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                            }`}
                                        >
                                            {req.status}
                                        </span>
                                    </div>

                                    {/* 2. HIGHLIGHTED INSPECTION TYPE & PRICE (أهم عنصر الملون) */}
                                    <div className="mb-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1 min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 shrink-0">نوع الفحص:</span>
                                            <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md truncate shadow-2xs border ${inspType.colorClass}`}>
                                                {inspType.name}
                                            </span>
                                        </div>
                                        <div className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800 shrink-0">
                                            {priceAmount > 0 ? `${priceAmount} ر.س` : 'مجاني'}
                                        </div>
                                    </div>

                                    {/* 3. Client & Car Details */}
                                    <div className="space-y-1 text-[11px] text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-900/30 p-1.5 rounded-md border border-slate-100 dark:border-slate-800">
                                        {/* Client Info */}
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <UserCircleIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                                {clientInfo.name}
                                            </span>
                                            {clientInfo.phone && (
                                                <span className="text-[10px] text-slate-400 dir-ltr shrink-0">
                                                    ({clientInfo.phone})
                                                </span>
                                            )}
                                        </div>

                                        {/* Car Info */}
                                        <div className="flex items-center justify-between gap-1 min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <CarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                                                    {carInfo.description}
                                                </span>
                                            </div>
                                            {carInfo.plate && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0">
                                                    {carInfo.plate}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. Time Created */}
                                    <div className="mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
                                        <span>تاريخ ووقت اليوم:</span>
                                        <span className="font-bold text-slate-600 dark:text-slate-300">
                                            {formatTime(req.created_at)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Note */}
                <div className="p-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 text-center text-[10px] text-slate-400 font-medium">
                    عرض فقط للطلب • لا يوجد خيارات تنقل أو تعديل
                </div>
            </aside>
        </div>
    );
};

export default TodayRequestsDrawer;
