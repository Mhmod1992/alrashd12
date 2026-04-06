
import React from 'react';
import Icon from '../Icon';
import SparklesIcon from '../icons/SparklesIcon';

interface ReservationReviewCardProps {
    data: any;
    onManualFill: (field: 'name' | 'phone' | 'make' | 'model' | 'year' | 'plate' | 'service' | 'price') => void;
}

const ReservationReviewCard: React.FC<ReservationReviewCardProps> = ({ data, onManualFill }) => {
    if (!data) return null;

    return (
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-amber-200 dark:border-amber-800 p-4 mb-6 shadow-md animate-fade-in transition-all duration-300 rounded-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <div className="bg-amber-100 dark:bg-amber-800 p-1.5 rounded-full text-amber-600 dark:text-amber-400">
                        <SparklesIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="font-bold text-amber-800 dark:text-amber-200 text-sm">بيانات الحجز المرجعية</h3>
                        <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 italic truncate max-w-[300px] md:max-w-md">
                            النص الأصلي: {data.originalText}
                        </p>
                    </div>
                </div>
                <div className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full font-medium self-start md:self-center">
                    انقر على أي معلومة لتعبئتها في النموذج
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                <button type="button" onClick={() => onManualFill('name')}
                    className="bg-amber-50/50 dark:bg-slate-900/50 p-2 rounded-lg border border-amber-100/50 dark:border-amber-900/30 flex flex-col items-start hover:border-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-all text-right active:scale-[0.98]">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">العميل</div>
                    <div className="text-xs font-bold truncate text-slate-700 dark:text-slate-300 w-full">{data.name || '-'}</div>
                </button>

                <button type="button" onClick={() => onManualFill('phone')}
                    className="bg-amber-50/50 dark:bg-slate-900/50 p-2 rounded-lg border border-amber-100/50 dark:border-amber-900/30 flex flex-col items-start hover:border-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-all text-right active:scale-[0.98]">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">الجوال</div>
                    <div className="text-xs font-bold truncate text-slate-700 dark:text-slate-300 dir-ltr text-right w-full">{data.phone || '-'}</div>
                </button>

                <button type="button" onClick={() => onManualFill('make')}
                    className="bg-amber-50/50 dark:bg-slate-900/50 p-2 rounded-lg border border-amber-100/50 dark:border-amber-900/30 flex flex-col items-start hover:border-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-all text-right active:scale-[0.98]">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">الشركة</div>
                    <div className="text-xs font-bold truncate text-slate-700 dark:text-slate-300 w-full">{data.make || '-'}</div>
                </button>

                <button type="button" onClick={() => onManualFill('model')}
                    className="bg-amber-50/50 dark:bg-slate-900/50 p-2 rounded-lg border border-amber-100/50 dark:border-amber-900/30 flex flex-col items-start hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all text-right active:scale-[0.98]">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold flex justify-between w-full">
                        <span>الموديل</span>
                    </div>
                    <div className="text-xs font-bold truncate text-slate-700 dark:text-slate-300 w-full">{data.model || '-'}</div>
                </button>

                <button type="button" onClick={() => onManualFill('year')}
                    className="bg-amber-50/50 dark:bg-slate-900/50 p-2 rounded-lg border border-amber-100/50 dark:border-amber-900/30 flex flex-col items-start hover:border-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-all text-right active:scale-[0.98]">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">السنة</div>
                    <div className="text-xs font-bold truncate text-slate-700 dark:text-slate-300 w-full">{data.year || '-'}</div>
                </button>

                <button type="button" onClick={() => onManualFill('service')}
                    className="bg-amber-50/50 dark:bg-slate-900/50 p-2 rounded-lg border border-amber-100/50 dark:border-amber-900/30 flex flex-col items-start hover:border-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-all text-right active:scale-[0.98]">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">الخدمة</div>
                    <div className="text-xs font-bold truncate text-slate-700 dark:text-slate-300 w-full">{data.service || '-'}</div>
                </button>

                <button type="button" onClick={() => onManualFill('price')}
                    className="bg-green-50/50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100/50 dark:border-green-900/30 flex flex-col items-start hover:border-green-400 hover:bg-green-100/50 dark:hover:bg-green-900/20 transition-all text-right active:scale-[0.98]">
                    <div className="text-[9px] text-green-600 uppercase tracking-wider font-bold">السعر</div>
                    <div className="text-xs font-bold truncate text-green-700 dark:text-green-300 w-full">{data.price ? `${data.price} ريال` : '-'}</div>
                </button>

                <button type="button" onClick={() => onManualFill('plate')}
                    className="bg-amber-50/50 dark:bg-slate-900/50 p-2 rounded-lg border border-amber-100/50 dark:border-amber-900/30 flex flex-col items-start hover:border-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-all text-right active:scale-[0.98]">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">اللوحة</div>
                    <div className="text-xs font-bold truncate text-slate-700 dark:text-slate-300 w-full">{data.plateChars} {data.plateNums || '-'}</div>
                </button>
            </div>
        </div>
    );
};

export default ReservationReviewCard;
