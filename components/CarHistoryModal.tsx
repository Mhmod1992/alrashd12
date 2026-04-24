import React, { useMemo } from 'react';
import Modal from './Modal';
import { InspectionRequest, PaymentType, RequestStatus, Car } from '../types';
import { useAppContext } from '../context/AppContext';
import HistoryIcon from './icons/HistoryIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import CarIcon from './icons/CarIcon';
import LicensePlatePreview from './LicensePlatePreview';
import { format } from 'date-fns';
import { timeAgo } from '../lib/utils';

interface CarHistoryModalProps {
    isOpen: boolean;
    car: Car | null;
    requests: InspectionRequest[];
    onClose: () => void;
}

const CarHistoryModal: React.FC<CarHistoryModalProps> = ({ isOpen, car, requests, onClose }) => {
    const { clients, settings } = useAppContext();

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

    const parsePlate = (plate: string | null | undefined) => {
        if (!plate) return { letters: '', numbers: '' };
        const clean = plate.replace(/\s+/g, ' ').trim();
        const parts = clean.split(' ');
        const numbers = parts.filter(p => /^\d+$/.test(p)).join('');
        const letters = parts.filter(p => !/^\d+$/.test(p)).join('');
        return { letters, numbers };
    };

    const plateAr = parsePlate(car.plate_number);
    const plateEn = parsePlate(car.plate_number_en);

    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const convertToArabicNumerals = (numStr: string): string => 
        numStr.replace(/\s/g, '').split('').map(digit => arabicNumerals[parseInt(digit, 10)] || digit).join('');

    const hasPlate = !!(car.plate_number || car.plate_number_en);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="سجل فحص المركبة" size="xl">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl mb-6 shadow-inner border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-6">
                    <div className="flex-1 flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <CarIcon className="w-8 h-8" />
                        </div>
                        <div>
                            {hasPlate ? (
                                <div className="scale-90 origin-right">
                                    <LicensePlatePreview 
                                        arabicTop={convertToArabicNumerals(plateAr.numbers)}
                                        arabicBottom={plateAr.letters}
                                        englishTop={plateEn.letters}
                                        englishBottom={plateEn.numbers}
                                        settings={settings.platePreviewSettings}
                                        plateCharacters={settings.plateCharacters}
                                    />
                                </div>
                            ) : (
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{car.vin || 'سيارة بدون لوحة'}</h3>
                            )}
                            {car.vin && hasPlate && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 opacity-70">VIN: {car.vin}</p>}
                        </div>
                    </div>

                    <div className="flex gap-3 shrink-0">
                        <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 font-bold uppercase">الزيارات</p>
                            <p className="text-lg font-black text-slate-800 dark:text-slate-200">{stats.totalVisits}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 font-bold uppercase">الإيرادات</p>
                            <p className="text-lg font-black text-green-600 dark:text-green-400">{stats.totalRevenue.toLocaleString()} <span className="text-[10px] font-normal">ريال</span></p>
                        </div>
                    </div>
                </div>
            </div>

            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 px-1">
                <HistoryIcon className="w-4 h-4" />
                سجل الزيارات المسجلة
            </h4>

            {requests.length === 0 ? (
                <div className="text-center p-12 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                    لا توجد زيارات سابقة مسجلة لهذه السيارة.
                </div>
            ) : (
                <div className="relative border-r-2 border-slate-100 dark:border-slate-800/50 mr-4 pr-6 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {requests.map((req) => {
                        const client = clients.find(c => c.id === req.client_id);
                        const isUnpaid = req.status !== RequestStatus.CANCELLED && (req.payment_type === PaymentType.Unpaid || req.status === RequestStatus.WAITING_PAYMENT);

                        const handleViewReport = () => {
                            const url = `${window.location.origin}${window.location.pathname}?page=print-report&requestId=${req.id}&from=print`;
                            window.open(url, '_blank');
                        };

                        return (
                            <div key={req.id} className="relative">
                                {/* Timeline Dot */}
                                <div className={`absolute -right-[33px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 z-10 ${isUnpaid ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`}></div>
                                
                                <div className={`flex items-center justify-between gap-2 p-3 rounded-xl border ${isUnpaid ? 'bg-red-50/10 border-red-100 dark:bg-red-900/5 dark:border-red-900/30' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700'} shadow-sm hover:shadow-md transition-all group overflow-hidden`}>
                                    
                                    {/* Column 1: Request # */}
                                    <div className="flex flex-col min-w-[90px] shrink-0 border-l border-slate-100 dark:border-slate-700 ml-2">
                                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-base tracking-tight">#{req.request_number}</span>
                                        <span className={`text-[7px] self-start px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter mt-1 ${
                                            isUnpaid ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-700/50 dark:text-slate-500'
                                        }`}>
                                            {req.status}
                                        </span>
                                    </div>

                                    {/* Column 2: Client Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col truncate">
                                            <span className="font-black text-slate-800 dark:text-slate-100 text-sm truncate">{client?.name || 'عميل غير معروف'}</span>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                                                {client?.phone || 'بدون هاتف'}
                                                {isUnpaid && <span className="text-red-600 dark:text-red-400 ml-1 flex items-center gap-0.5"><AlertTriangleIcon className="w-2.5 h-2.5" /></span>}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Column 3: Price */}
                                    <div className="min-w-[70px] text-center border-r border-slate-100 dark:border-slate-700 px-2">
                                        <p className="font-black text-base text-slate-800 dark:text-slate-100">
                                            {req.price} <span className="text-[9px] font-normal opacity-50">ريال</span>
                                        </p>
                                    </div>

                                    {/* Column 4: Date & Time Ago */}
                                    <div className="min-w-[120px] shrink-0 flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-700 px-3">
                                        <span className="font-black text-blue-600 dark:text-blue-400 text-[11px] leading-tight">{timeAgo(req.created_at)}</span>
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{format(new Date(req.created_at), 'yyyy/MM/dd')}</span>
                                    </div>

                                    {/* Column 5: Action */}
                                    <div className="min-w-[90px] text-left shrink-0">
                                        <button 
                                            onClick={handleViewReport}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs font-black transition-all shadow-sm"
                                        >
                                            تقرير
                                        </button>
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

export default CarHistoryModal;
