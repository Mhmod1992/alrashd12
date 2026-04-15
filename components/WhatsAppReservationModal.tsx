
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import NewRequestForm from './NewRequestForm';
import { WhatsAppMessage, Client, CarMake, CarModel, InspectionType, Broker, Reservation } from '../types';
import Icon from './Icon';
import WhatsappIcon from './icons/WhatsappIcon';
import { timeAgo, parseWhatsAppMessage } from '../lib/utils';
import { useAppContext } from '../context/AppContext';

interface WhatsAppReservationModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: WhatsAppMessage;
    clients: Client[];
    carMakes: CarMake[];
    carModels: CarModel[];
    inspectionTypes: InspectionType[];
    brokers: Broker[];
    onSuccess: () => void;
}

const WhatsAppReservationModal: React.FC<WhatsAppReservationModalProps> = ({
    isOpen,
    onClose,
    message,
    clients,
    carMakes,
    carModels,
    inspectionTypes,
    brokers,
    onSuccess
}) => {
    const { parseReservationText } = useAppContext();
    const [initialData, setInitialData] = useState<Partial<Reservation> | null>(null);
    const { cleanMessage, source, replyTo } = parseWhatsAppMessage(message.message);
    const [isMessageExpanded, setIsMessageExpanded] = useState(window.innerWidth >= 1024);

    useEffect(() => {
        if (isOpen) {
            const loadData = async () => {
                const parsed = await parseReservationText(message.message);
                setInitialData({
                    ...parsed,
                    source_text: message.message
                });
            };
            loadData();
        }
    }, [isOpen, message.message, parseReservationText]);

    if (!initialData) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="تحويل رسالة واتساب إلى حجز" size="5xl" noPadding fullHeight>
            <div className="flex flex-col lg:flex-row h-full overflow-hidden">
                {/* Right Side: Message Reference (Collapsible on Mobile) */}
                <div className={`w-full lg:w-1/3 bg-slate-50 dark:bg-slate-900/50 border-b lg:border-b-0 lg:border-l dark:border-slate-700 overflow-y-auto custom-scrollbar shrink-0 transition-all duration-500 ease-in-out ${!isMessageExpanded ? 'h-14 lg:h-full' : 'h-[40vh] lg:h-full'}`}>
                    <div 
                        className="sticky top-0 bg-slate-50 dark:bg-slate-900/50 p-3 lg:p-6 border-b dark:border-slate-700 z-10 flex items-center justify-between cursor-pointer lg:cursor-default hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => window.innerWidth < 1024 && setIsMessageExpanded(!isMessageExpanded)}
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 lg:p-2 rounded-lg lg:rounded-xl">
                                <WhatsappIcon className="w-4 h-4 lg:w-6 lg:h-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-xs lg:text-base">تفاصيل الرسالة (مرجع)</h3>
                                {!isMessageExpanded && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                        {message.name || 'غير معروف'} • {source || 'محادثة'}
                                    </p>
                                )}
                                {isMessageExpanded && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{timeAgo(message.created_at)}</p>
                                )}
                            </div>
                        </div>
                        <div className="lg:hidden flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{isMessageExpanded ? 'إغلاق' : 'عرض'}</span>
                            <Icon name={isMessageExpanded ? 'chevron-up' : 'chevron-down'} className="w-4 h-4 text-slate-400" />
                        </div>
                    </div>

                    <div className={`p-4 lg:p-6 space-y-4 lg:space-y-6 ${!isMessageExpanded ? 'hidden lg:block' : 'block'}`}>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">المرسل (المنسق)</span>
                                <span className="text-[10px] font-mono text-slate-500">{message.phone}</span>
                            </div>
                            <div className="font-bold text-slate-800 dark:text-white text-base lg:text-lg">
                                {message.name || 'غير معروف'}
                            </div>
                            {source && (
                                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg w-fit">
                                    {source.includes('مجموعة') ? '👥' : '🔒'} {source}
                                </div>
                            )}
                        </div>

                        {replyTo && (
                            <div className="bg-slate-100/50 dark:bg-slate-800/50 border-r-4 border-emerald-500 p-3 rounded-l-lg text-xs text-slate-500 dark:text-slate-400 italic">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">رداً على:</span>
                                {replyTo}
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-800 p-4 lg:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-3">نص الرسالة</span>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap text-sm">
                                {cleanMessage}
                            </p>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                                <Icon name="sparkles" className="w-4 h-4" />
                                <span className="text-xs font-bold">تحليل ذكي</span>
                            </div>
                            <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-normal">
                                تم استخراج البيانات تلقائياً من النص. يرجى مراجعة الحقول على اليسار للتأكد من دقتها.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Left Side: Reservation Form */}
                <div className="flex-1 p-4 lg:p-6 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800">
                    <div className="max-w-4xl mx-auto">
                        <NewRequestForm
                            clients={clients}
                            carMakes={carMakes}
                            carModels={carModels}
                            inspectionTypes={inspectionTypes}
                            brokers={brokers}
                            isReservationMode={true}
                            initialReservationData={initialData}
                            onCancel={onClose}
                            onSuccess={() => {
                                onSuccess();
                                onClose();
                            }}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default WhatsAppReservationModal;
