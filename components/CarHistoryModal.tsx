import React, { useMemo } from 'react';
import Modal from './Modal';
import { InspectionRequest, PaymentType, RequestStatus, Car } from '../types';
import { useAppContext } from '../context/AppContext';
import HistoryIcon from './icons/HistoryIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import CarIcon from './icons/CarIcon';
import { format } from 'date-fns';

interface CarHistoryModalProps {
    isOpen: boolean;
    car: Car | null;
    requests: InspectionRequest[];
    onClose: () => void;
}

const timeAgo = (dateParam: string | Date | undefined) => {
    if (!dateParam) return '';
    const date = typeof dateParam === 'object' ? dateParam : new Date(dateParam);
    const today = new Date();
    const seconds = Math.round((today.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30);
    const years = Math.round(months / 12);

    if (seconds < 60) return `الآن`;
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days === 1) return `أمس`;
    if (days === 2) return `منذ يومين`;
    if (days <= 10) return `منذ ${days} أيام`;
    if (days < 30) return `منذ ${days} يوماً`;
    if (months === 1) return `منذ شهر`;
    if (months === 2) return `منذ شهرين`;
    if (months <= 10) return `منذ ${months} أشهر`;
    if (months < 12) return `منذ ${months} شهور`;
    if (years === 1) return `منذ سنة`;
    if (years === 2) return `منذ سنتين`;
    if (years <= 10) return `منذ ${years} سنوات`;
    return `منذ ${years} سنة`;
};

const CarHistoryModal: React.FC<CarHistoryModalProps> = ({ isOpen, car, requests, onClose }) => {
    const { clients } = useAppContext();

    const stats = useMemo(() => {
        let totalRevenue = 0;
        requests.forEach(req => {
            if (req.status !== RequestStatus.CANCELLED) {
                totalRevenue += (Number(req.price) || 0);
            }
        });
        return { totalRevenue, totalVisits: requests.length };
    }, [requests]);

    if (!car) return null;

    const carName = car.plate_number || car.vin || 'سيارة غير محددة';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="سجل فحص المركبة" size="lg">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl mb-6 shadow-inner border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <CarIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{carName}</h3>
                        {car.vin && <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">VIN: {car.vin}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-5">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-semibold">إجمالي الزيارات</p>
                        <p className="text-lg font-black text-slate-800 dark:text-slate-200">{stats.totalVisits}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-semibold">إجمالي الإيرادات</p>
                        <p className="text-lg font-black text-green-600 dark:text-green-400">{stats.totalRevenue.toLocaleString()} ريال</p>
                    </div>
                </div>
            </div>

            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <HistoryIcon className="w-4 h-4" />
                آخر الزيارات المسجلة
            </h4>

            {requests.length === 0 ? (
                <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                    لا توجد زيارات سابقة مسجلة لهذه السيارة.
                </div>
            ) : (
                <div className="relative border-r-2 border-slate-100 dark:border-slate-700/50 mr-4 pr-6 space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {requests.map((req) => {
                        const client = clients.find(c => c.id === req.client_id);
                        const isUnpaid = req.status !== RequestStatus.CANCELLED && (req.payment_type === PaymentType.Unpaid || req.status === RequestStatus.WAITING_PAYMENT);

                        return (
                            <div key={req.id} className="relative">
                                {/* Timeline Dot */}
                                <div className={`absolute -right-[33px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${isUnpaid ? 'bg-red-500 dark:bg-red-400' : 'bg-blue-500 dark:bg-blue-400'}`}></div>
                                
                                <div className={`p-4 rounded-lg border ${isUnpaid ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700'} shadow-sm hover:shadow-md transition-shadow group`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">#{req.request_number}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400`}>
                                                {req.status}
                                            </span>
                                        </div>
                                        <div className="text-left text-xs">
                                            <p className="font-bold text-blue-600 dark:text-blue-400 text-sm dir-ltr">{timeAgo(req.created_at)}</p>
                                            <p className="text-slate-400 dark:text-slate-500 mt-0.5">{format(new Date(req.created_at), 'yyyy/MM/dd')}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">العميل:</p>
                                            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{client?.name || 'غير معروف'}</p>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-black text-lg text-slate-800 dark:text-slate-200">
                                                {req.price} <span className="text-xs text-slate-500 font-normal">ريال</span>
                                            </p>
                                        </div>
                                    </div>

                                    {isUnpaid && (
                                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400 font-bold">
                                            <AlertTriangleIcon className="w-3 h-3" />
                                            طلب غير مدفوع
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
};

export default CarHistoryModal;
