import React, { useEffect, useState, useMemo } from 'react';
import Modal from './Modal';
import { Client, InspectionRequest, PaymentType, RequestStatus } from '../types';
import { useAppContext } from '../context/AppContext';
import HistoryIcon from './icons/HistoryIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import WhatsappIcon from './icons/WhatsappIcon';
import { format } from 'date-fns';

interface ClientHistoryModalProps {
    isOpen: boolean;
    client: Client | null;
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
    if (days < 30) return `منذ ${days} يوم`;
    if (months === 1) return `منذ شهر`;
    if (months === 2) return `منذ شهرين`;
    if (months <= 10) return `منذ ${months} أشهر`;
    if (months < 12) return `منذ ${months} شهر`;
    if (years === 1) return `منذ سنة`;
    if (years === 2) return `منذ سنتين`;
    if (years <= 10) return `منذ ${years} سنوات`;
    return `منذ ${years} سنة`;
};

const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({ isOpen, client, onClose }) => {
    const { fetchClientRequests, cars } = useAppContext();
    const [requests, setRequests] = useState<InspectionRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'latest' | 'all'>('latest');

    useEffect(() => {
        if (isOpen && client && client.id) {
            setIsLoading(true);
            fetchClientRequests(client.id).then((reqs) => {
                setRequests(reqs);
                setIsLoading(false);
            }).catch(() => {
                setIsLoading(false);
            });
        }
    }, [isOpen, client, fetchClientRequests]);

    // Derived Statistics
    const stats = useMemo(() => {
        let totalPaid = 0;
        let totalDebt = 0;
        let debtCount = 0;

        requests.forEach(req => {
            const price = Number(req.price) || 0;
            // Debt logic matching the rest of the app
            if (
                req.status !== RequestStatus.CANCELLED &&
                (req.payment_type === PaymentType.Unpaid || req.status === RequestStatus.WAITING_PAYMENT)
            ) {
                totalDebt += price;
                debtCount++;
            } else if (req.status !== RequestStatus.CANCELLED) {
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
        <Modal isOpen={isOpen} onClose={onClose} title="ملف وتاريخ العميل" size="lg">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl mb-6 shadow-inner border border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <UserCircleIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{client.name}</h3>
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
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700 mb-4 flex gap-4">
                <button 
                    onClick={() => setActiveTab('latest')}
                    className={`pb-2 text-sm font-bold transition-colors relative ${activeTab === 'latest' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    أحدث الطلبات (3)
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
                <div className="relative border-r-2 border-slate-100 dark:border-slate-700/50 mr-4 pr-6 space-y-6">
                    {displayedRequests.map((req, index) => {
                        const car = cars.find(c => c.id === req.car_id);
                        const carDisplayName = req.car_snapshot ? `${req.car_snapshot.make_ar} ${req.car_snapshot.model_ar} ${req.car_snapshot.year}` : (car ? 'سيارة مسجلة' : 'غير محدد');
                        const isUnpaid = req.status !== RequestStatus.CANCELLED && (req.payment_type === PaymentType.Unpaid || req.status === RequestStatus.WAITING_PAYMENT);

                        return (
                            <div key={req.id} className="relative">
                                {/* Timeline Dot */}
                                <div className={`absolute -right-[33px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${isUnpaid ? 'bg-red-500 dark:bg-red-400' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                
                                <div className={`p-4 rounded-lg border ${isUnpaid ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700'} shadow-sm hover:shadow-md transition-shadow group`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">#{req.request_number}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isUnpaid ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                                {req.payment_type}
                                            </span>
                                        </div>
                                        <div className="text-left text-xs">
                                            <p className="font-bold text-slate-600 dark:text-slate-300 text-sm dir-ltr">{timeAgo(req.created_at)}</p>
                                            <p className="text-slate-400 dark:text-slate-500 mt-0.5">{format(new Date(req.created_at), 'yyyy/MM/dd')}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">السيارة:</p>
                                            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{carDisplayName}</p>
                                        </div>
                                        <div className="text-left">
                                            <p className={`font-black text-lg ${isUnpaid ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                {req.price} <span className="text-xs text-slate-500 font-normal">ريال</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
};

export default ClientHistoryModal;
