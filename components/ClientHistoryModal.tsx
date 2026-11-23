import React, { useEffect, useState, useMemo } from 'react';
import Modal from './Modal';
import { Client, InspectionRequest, PaymentType, RequestStatus, Car } from '../types';
import { useAppContext } from '../context/AppContext';
import HistoryIcon from './icons/HistoryIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import WhatsappIcon from './icons/WhatsappIcon';
import { format } from 'date-fns';
import { timeAgo } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';

interface ClientHistoryModalProps {
    isOpen: boolean;
    client: Client | null;
    onClose: () => void;
}

const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({ isOpen, client, onClose }) => {
    const { fetchClientRequests, cars, carMakes, carModels, inspectionTypes } = useAppContext();
    const [requests, setRequests] = useState<InspectionRequest[]>([]);
    const [extraCarsMap, setExtraCarsMap] = useState<Record<string, Car>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'latest' | 'all'>('latest');
    const [showNameHistory, setShowNameHistory] = useState(false);

    useEffect(() => {
        if (isOpen && client && client.id) {
            setIsLoading(true);
            fetchClientRequests(client.id).then(async (reqs) => {
                setRequests(reqs);
                const missingCarIds = Array.from(new Set(
                    reqs
                        .filter(r => !r.car_snapshot && r.car_id && !cars.some(c => c.id === r.car_id))
                        .map(r => r.car_id)
                ));
                if (missingCarIds.length > 0) {
                    try {
                        const { data: dbCars } = await supabase
                            .from('cars')
                            .select('*')
                            .in('id', missingCarIds);
                        if (dbCars && dbCars.length > 0) {
                            const map: Record<string, Car> = {};
                            dbCars.forEach((c: Car) => { map[c.id] = c; });
                            setExtraCarsMap(map);
                        }
                    } catch (e) {
                        console.warn('Failed to fetch missing cars for client history:', e);
                    }
                }
                setIsLoading(false);
            }).catch(() => {
                setIsLoading(false);
            });
        }
    }, [isOpen, client, fetchClientRequests, cars]);

    // Derived Statistics
    const stats = useMemo(() => {
        let totalPaid = 0;
        let totalDebt = 0;
        let debtCount = 0;

        requests.forEach(req => {
            const price = Number(req.price) || 0;
            // Debt logic: Only genuine unpaid/credit (not waiting payment or cancelled)
            if (
                req.status !== RequestStatus.CANCELLED &&
                req.status !== RequestStatus.WAITING_PAYMENT &&
                req.payment_type === PaymentType.Unpaid
            ) {
                totalDebt += price;
                debtCount++;
            } else if (req.status !== RequestStatus.CANCELLED && req.status !== RequestStatus.WAITING_PAYMENT) {
                totalPaid += price;
            }
        });

        return { totalPaid, totalDebt, debtCount, totalVisits: requests.length };
    }, [requests]);

    const displayedRequests = useMemo(() => {
        return activeTab === 'latest' ? requests.slice(0, 3) : requests;
    }, [requests, activeTab]);

    if (!client) return null;

    const handleWhatsAppClick = () => {
        // Strip non-digits and use international format (assuming Saudi Arabia if starts with 05)
        let phoneStr = client.phone.replace(/\D/g, '');
        if (phoneStr.startsWith('05')) {
            phoneStr = '966' + phoneStr.substring(1);
        }
        window.open(`https://wa.me/${phoneStr}`, '_blank');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="ملف وتاريخ العميل" size="2xl">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl mb-6 shadow-inner border border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <UserCircleIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{client.name}</h3>
                                {client.name_history && client.name_history.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowNameHistory(prev => !prev)}
                                        className="text-[10px] bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold transition-colors flex items-center gap-1"
                                        title="عرض تاريخ تغييرات الاسم"
                                    >
                                        <HistoryIcon className="w-3 h-3" />
                                        <span>تغيّر اسمه ({client.name_history.length})</span>
                                    </button>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono">{client.phone}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleWhatsAppClick}
                        className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400 px-3 py-2 rounded-lg transition-colors border border-green-200 dark:border-green-800"
                    >
                        <WhatsappIcon className="w-5 h-5" />
                        <span className="text-sm font-semibold hidden sm:inline">تواصل</span>
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-5">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-semibold">إجمالي الزيارات</p>
                        <p className="text-lg font-black text-slate-800 dark:text-slate-200">{stats.totalVisits}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-semibold">مدفوعات سابقة</p>
                        <p className="text-lg font-black text-green-600 dark:text-green-400">{stats.totalPaid.toLocaleString()}</p>
                    </div>
                    <div className={`p-3 rounded-lg border text-center shadow-sm ${stats.totalDebt > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                        <p className={`text-xs mb-1 font-semibold ${stats.totalDebt > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>مديونية معلقة</p>
                        <p className={`text-lg font-black ${stats.totalDebt > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {stats.totalDebt.toLocaleString()}
                        </p>
                    </div>
                </div>
                
                {stats.totalDebt > 0 && (
                    <div className="mt-3 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-2 text-xs rounded-lg flex items-center justify-center gap-2 font-semibold animate-pulse">
                        <AlertTriangleIcon className="w-4 h-4" />
                        هذا العميل يمتلك ديوناً غير مدفوعة من {stats.debtCount} طلب!
                    </div>
                )}

                {showNameHistory && client.name_history && client.name_history.length > 0 && (
                    <div className="mt-3 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                            <HistoryIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            سجل تغييرات الاسم:
                        </p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {client.name_history.map((item, idx) => (
                                <div key={idx} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white/80 dark:bg-slate-800/70 px-2.5 py-1.5 rounded border border-amber-100 dark:border-amber-800/40">
                                    <div className="flex items-center gap-1.5 font-semibold">
                                        <span className="line-through text-slate-400">{item.old_name}</span>
                                        <span className="text-slate-400">←</span>
                                        <span className="text-slate-800 dark:text-slate-100 font-bold">{item.new_name}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {new Date(item.changed_at).toLocaleDateString('en-GB')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700 mb-4 flex gap-4">
                <button 
                    onClick={() => setActiveTab('latest')}
                    className={`pb-2 text-sm font-bold transition-colors relative ${activeTab === 'latest' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    اخر ثلاث زيارات
                    {activeTab === 'latest' && <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></span>}
                </button>
                <button 
                    onClick={() => setActiveTab('all')}
                    className={`pb-2 text-sm font-bold transition-colors relative ${activeTab === 'all' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    كل الطلبات ({requests.length})
                    {activeTab === 'all' && <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></span>}
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-8">
                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin"></div>
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                    لا توجد طلبات سابقة لهذا العميل.
                </div>
            ) : (
                <div className="overflow-x-auto custom-scrollbar pb-1">
                    <div className="min-w-[460px] pr-1">
                        <div className="mr-4 pr-6 mb-2 px-3.5 grid grid-cols-[minmax(160px,1.4fr)_minmax(135px,1.1fr)_105px] gap-x-4 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                            <div>الطلب والسيارة</div>
                            <div>نوع الفحص والسعر</div>
                            <div className="text-left">التاريخ والمدة</div>
                        </div>
                        <div className="relative border-r-2 border-slate-100 dark:border-slate-700/50 mr-4 pr-6 space-y-2.5">
                            {displayedRequests.map((req) => {
                                const car = cars.find(c => c.id === req.car_id) || extraCarsMap[req.car_id];
                                let carDisplayName = 'غير محدد';
                                if (req.car_snapshot && (req.car_snapshot.make_ar || req.car_snapshot.make_en || req.car_snapshot.model_ar || req.car_snapshot.model_en)) {
                                    const makeName = req.car_snapshot.make_ar || req.car_snapshot.make_en || '';
                                    const modelName = req.car_snapshot.model_ar || req.car_snapshot.model_en || '';
                                    const yearStr = req.car_snapshot.year ? String(req.car_snapshot.year) : '';
                                    carDisplayName = [makeName, modelName, yearStr].filter(Boolean).join(' ') || 'غير محدد';
                                } else if (car) {
                                    const makeObj = carMakes.find(m => m.id === car.make_id);
                                    const modelObj = carModels.find(m => m.id === car.model_id);
                                    const makeName = makeObj?.name_ar || makeObj?.name_en || '';
                                    const modelName = modelObj?.name_ar || modelObj?.name_en || '';
                                    const yearStr = car.year ? String(car.year) : '';
                                    carDisplayName = [makeName, modelName, yearStr].filter(Boolean).join(' ') || 'سيارة مسجلة';
                                }
                                const inspectionType = inspectionTypes.find(t => t.id === req.inspection_type_id);
                                const inspectionTypeName = inspectionType?.name || 'غير محدد';
                                const isUnpaid = req.status !== RequestStatus.CANCELLED && req.status !== RequestStatus.WAITING_PAYMENT && req.payment_type === PaymentType.Unpaid;
                                const isWaiting = req.status === RequestStatus.WAITING_PAYMENT;

                                return (
                                    <div key={req.id} className="relative">
                                        {/* Timeline Dot */}
                                        <div className={`absolute -right-[33px] top-4 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${isUnpaid ? 'bg-red-500 dark:bg-red-400' : (isWaiting ? 'bg-purple-500 dark:bg-purple-400' : 'bg-slate-300 dark:bg-slate-600')}`}></div>
                                        
                                        <div className={`px-3.5 py-2.5 rounded-lg border ${isUnpaid ? 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30' : (isWaiting ? 'bg-purple-50/40 border-purple-100 dark:bg-purple-900/10 dark:border-purple-900/30' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700')} shadow-sm hover:shadow-md transition-shadow`}>
                                            <div className="grid grid-cols-[minmax(160px,1.4fr)_minmax(135px,1.1fr)_105px] items-center gap-x-4 text-xs sm:text-sm">
                                                {/* 1. رقم الطلب وأسفله اسم السيارة */}
                                                <div className="min-w-0 flex flex-col gap-1">
                                                    <div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const url = `${window.location.origin}${window.location.pathname}?page=print-report&requestId=${req.id}&from=print`;
                                                                window.open(url, '_blank');
                                                            }}
                                                            className="font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-mono hover:underline cursor-pointer whitespace-nowrap"
                                                            title="معاينة الطلب في صفحة جديدة"
                                                        >
                                                            #{req.request_number}
                                                        </button>
                                                    </div>
                                                    <span className="block font-bold text-slate-800 dark:text-slate-100 truncate text-xs sm:text-sm" title={carDisplayName}>
                                                        {carDisplayName}
                                                    </span>
                                                </div>

                                                {/* 2. نوع الفحص وأسفله السعر */}
                                                <div className="min-w-0 flex flex-col gap-1 items-start">
                                                    <span className="inline-block max-w-full truncate text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60" title={inspectionTypeName}>
                                                        {inspectionTypeName}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                        <span className={`font-black text-xs sm:text-sm ${isUnpaid ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                            {req.price} <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">ريال</span>
                                                        </span>
                                                        {isUnpaid && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                                                                غير مدفوع
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 3. التاريخ وأسفله المدة */}
                                                <div className="flex flex-col items-end gap-1 whitespace-nowrap text-xs">
                                                    <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
                                                        {format(new Date(req.created_at), 'yyyy/MM/dd')}
                                                    </span>
                                                    <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px]">
                                                        {timeAgo(req.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ClientHistoryModal;
