import React, { useState } from 'react';
import { InspectionRequest, Client, InspectionType } from '../types';
import XIcon from './icons/XIcon';
import CarIcon from './icons/CarIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import CalendarClockIcon from './icons/CalendarClockIcon';

interface CurrentRequestDrawerProps {
    request: InspectionRequest;
    carDetails: {
        makeNameAr?: string;
        modelNameAr?: string;
        makeNameEn?: string;
        modelNameEn?: string;
        year?: number | string;
        plateNumber?: string;
    };
    client?: Client;
    inspectionType?: InspectionType;
    canViewPrice?: boolean;
}

export const CurrentRequestDrawer: React.FC<CurrentRequestDrawerProps> = ({
    request,
    carDetails,
    client,
    inspectionType,
    canViewPrice = true,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Resolve car string
    const carNameAr = `${carDetails.makeNameAr || ''} ${carDetails.modelNameAr || ''} ${carDetails.year || ''}`.trim();
    const carNameEn = `${carDetails.makeNameEn || ''} ${carDetails.modelNameEn || ''} ${carDetails.year || ''}`.trim();
    const displayCarName = carNameAr || carNameEn || 'غير معروف';

    // Format Client Phone
    const formattedPhone = client?.phone
        ? (client.phone.replace(/\D/g, '').length === 10
            ? `${client.phone.replace(/\D/g, '').slice(0, 3)}-${client.phone.replace(/\D/g, '').slice(3, 6)}-${client.phone.replace(/\D/g, '').slice(6)}`
            : client.phone)
        : '';

    // Price display
    const rawPrice = request.price ?? 0;
    const priceDisplay = request.price !== undefined && request.price !== null
        ? (request.price > 0 ? `${request.price}` : '0')
        : '0';

    // Soft Pastel Payment Theme matching user provided reference image
    const getSoftPaymentTheme = (paymentType?: string) => {
        const type = paymentType || 'غير محدد';
        if (type.includes('نقدي') || type.includes('كاش')) {
            return {
                label: type,
                cardBg: 'bg-[#f0fdf4] dark:bg-slate-900',
                cardBorder: 'border-emerald-200 dark:border-slate-700',
                headerText: 'text-emerald-500 dark:text-emerald-400',
                priceText: 'text-emerald-600 dark:text-emerald-400',
                paymentPill: 'bg-emerald-600 text-white',
                inspPill: 'bg-emerald-100/90 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200',
                metaText: 'text-emerald-600/80 dark:text-emerald-400/80',
                innerCardBg: 'bg-white/80 dark:bg-slate-800/80 border-emerald-100 dark:border-slate-700',
                divider: 'bg-emerald-100 dark:bg-slate-700/60',
            };
        }
        if (type.includes('بطاقة') || type.includes('مدى') || type.includes('شبكة')) {
            return {
                label: type,
                cardBg: 'bg-[#f0f6ff] dark:bg-slate-900',
                cardBorder: 'border-blue-200 dark:border-slate-700',
                headerText: 'text-blue-500 dark:text-blue-400',
                priceText: 'text-blue-600 dark:text-blue-400',
                paymentPill: 'bg-blue-600 text-white',
                inspPill: 'bg-blue-100/90 dark:bg-blue-950 text-blue-800 dark:text-blue-200',
                metaText: 'text-blue-600/80 dark:text-blue-400/80',
                innerCardBg: 'bg-white/80 dark:bg-slate-800/80 border-blue-100 dark:border-slate-700',
                divider: 'bg-blue-100 dark:bg-slate-700/60',
            };
        }
        if (type.includes('تحويل')) {
            return {
                label: type,
                cardBg: 'bg-[#fffbe2] dark:bg-slate-900',
                cardBorder: 'border-amber-200 dark:border-slate-700',
                headerText: 'text-amber-500 dark:text-amber-400',
                priceText: 'text-amber-600 dark:text-amber-400',
                paymentPill: 'bg-amber-600 text-white',
                inspPill: 'bg-amber-100/90 dark:bg-amber-950 text-amber-800 dark:text-amber-200',
                metaText: 'text-amber-600/80 dark:text-amber-400/80',
                innerCardBg: 'bg-white/80 dark:bg-slate-800/80 border-amber-100 dark:border-slate-700',
                divider: 'bg-amber-100 dark:bg-slate-700/60',
            };
        }
        if (type.includes('غير مدفوع') || type.includes('آجل')) {
            return {
                label: type,
                cardBg: 'bg-[#fff1f2] dark:bg-slate-900',
                cardBorder: 'border-rose-200 dark:border-slate-700',
                headerText: 'text-rose-500 dark:text-rose-400',
                priceText: 'text-rose-600 dark:text-rose-400',
                paymentPill: 'bg-rose-600 text-white',
                inspPill: 'bg-rose-100/90 dark:bg-rose-950 text-rose-800 dark:text-rose-200',
                metaText: 'text-rose-600/80 dark:text-rose-400/80',
                innerCardBg: 'bg-white/80 dark:bg-slate-800/80 border-rose-100 dark:border-slate-700',
                divider: 'bg-rose-100 dark:bg-slate-700/60',
            };
        }
        return {
            label: type,
            cardBg: 'bg-slate-50 dark:bg-slate-900',
            cardBorder: 'border-slate-200 dark:border-slate-700',
            headerText: 'text-slate-500 dark:text-slate-400',
            priceText: 'text-slate-700 dark:text-slate-200',
            paymentPill: 'bg-slate-600 text-white',
            inspPill: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
            metaText: 'text-slate-500 dark:text-slate-400',
            innerCardBg: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
            divider: 'bg-slate-200 dark:bg-slate-700',
        };
    };

    const theme = getSoftPaymentTheme(request.payment_type);
    const inspectionTypeName = inspectionType?.name || 'فحص عام';

    return (
        <div className="hidden md:flex fixed left-0 top-[calc(50%-46px)] -translate-y-1/2 z-[160] items-start select-none">
            {/* 1. Closed State: Soft Pastel Side Tab (مستوحى من تصميم الصورة الناعم) */}
            {!isExpanded && (
                <div
                    onClick={() => setIsExpanded(true)}
                    className={`backdrop-blur-md border-y-2 border-r-2 rounded-r-3xl shadow-xl p-3 sm:p-3.5 flex items-center gap-3 cursor-pointer transition-all duration-300 group hover:pl-4 border-l-0 min-w-[155px] max-w-[210px] ${theme.cardBg} ${theme.cardBorder}`}
                    title={`انقر لفتح تفاصيل الطلب الحالي - ${theme.label}`}
                >
                    <div className="flex flex-col items-center text-center w-full gap-1">
                        {/* Header: سعر الطلب + Icon */}
                        <div className={`flex items-center justify-center gap-1.5 text-xs font-black ${theme.headerText}`}>
                            <span>سعر الطلب</span>
                            <CarIcon className="w-3.5 h-3.5" />
                        </div>

                        {/* Price */}
                        {canViewPrice && (
                            <div className={`text-2xl font-black tracking-tight leading-none my-0.5 ${theme.priceText}`}>
                                {priceDisplay} <span className="text-xs font-extrabold opacity-80">ر.س</span>
                            </div>
                        )}

                        {/* Oval Payment Pill */}
                        <span className={`text-[11px] font-black px-4 py-0.5 rounded-full shadow-2xs mt-0.5 ${theme.paymentPill}`}>
                            {theme.label}
                        </span>
                    </div>

                    {/* Arrow Icon */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 group-hover:translate-x-0.5 transition-transform ${theme.inspPill}`}>
                        <ChevronRightIcon className="w-3.5 h-3.5 rotate-180" />
                    </div>
                </div>
            )}

            {/* 2. Expanded State: Soft Pastel Card (طابق الأصل للبطاقة المرفقة بالصورة) */}
            {isExpanded && (
                <div className={`backdrop-blur-xl border-2 rounded-3xl shadow-2xl w-72 sm:w-80 p-4 transition-all duration-300 animate-slide-in-left relative overflow-hidden ${theme.cardBg} ${theme.cardBorder}`}>
                    {/* Top Close Button */}
                    <button
                        onClick={() => setIsExpanded(false)}
                        className={`absolute top-3 left-3 p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer ${theme.headerText}`}
                        title="طي البطاقة"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>

                    {/* Main Card Content (Soft Pastel Layout like User Image) */}
                    <div className="flex flex-col items-center text-center pt-1 pb-2">
                        {/* 1. Label + Car Icon */}
                        <div className={`flex items-center justify-center gap-1.5 text-xs font-black mb-1 ${theme.headerText}`}>
                            <span>سعر الطلب</span>
                            <CarIcon className="w-4 h-4" />
                        </div>

                        {/* 2. Large Bold Price */}
                        {canViewPrice ? (
                            <div className={`text-3xl font-black tracking-tight leading-none mb-3 ${theme.priceText}`}>
                                {priceDisplay} <span className="text-sm font-extrabold opacity-80">ر.س</span>
                            </div>
                        ) : (
                            <div className={`text-lg font-black mb-2 ${theme.headerText}`}>محمي</div>
                        )}

                        {/* 3. Primary Payment Pill (مثل كبسولة "شبكة" بالصورة) */}
                        <span className={`text-xs font-black px-5 py-1 rounded-full shadow-xs mb-3 ${theme.paymentPill}`}>
                            {theme.label}
                        </span>

                        {/* 4. Light Horizontal Divider */}
                        <div className={`w-3/4 h-px my-1 ${theme.divider}`}></div>

                        {/* 5. Soft Inspection Type Pill (مثل كبسولة "شامل" بالصورة) */}
                        <div className="mt-2 mb-1">
                            <span className={`text-xs font-black px-4 py-1 rounded-full ${theme.inspPill}`}>
                                {inspectionTypeName}
                            </span>
                        </div>

                        {/* 6. Request Number & Clock Icon */}
                        <div className={`flex items-center justify-center gap-1 text-xs font-bold mt-1.5 ${theme.metaText}`}>
                            <CalendarClockIcon className="w-3.5 h-3.5" />
                            <span>رقم الطلب: {request.request_number || request.id.slice(0, 8)}</span>
                        </div>
                    </div>

                    {/* Additional Details (Car & Client) in Soft Inner Card */}
                    <div className="mt-2 space-y-2 text-xs">
                        {/* Car Info */}
                        <div className={`p-2.5 rounded-2xl border ${theme.innerCardBg}`}>
                            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold mb-1">
                                <CarIcon className="w-3.5 h-3.5 text-slate-500" />
                                <span>بيانات السيارة</span>
                            </div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-snug">
                                {displayCarName}
                            </p>
                            {carDetails.plateNumber && (
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-1 inline-block bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-600">
                                    اللوحة: {carDetails.plateNumber}
                                </p>
                            )}
                        </div>

                        {/* Client Info */}
                        <div className={`p-2.5 rounded-2xl border ${theme.innerCardBg}`}>
                            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold mb-1">
                                <UserCircleIcon className="w-3.5 h-3.5 text-blue-500" />
                                <span>بيانات العميل</span>
                            </div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                                {client?.name || 'عميل نقدي'}
                            </p>
                            {formattedPhone && (
                                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 dir-ltr text-right mt-0.5 font-mono">
                                    {formattedPhone}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Action button to collapse */}
                    <button
                        onClick={() => setIsExpanded(false)}
                        className={`mt-3 w-full py-1.5 text-xs font-bold rounded-2xl transition-colors cursor-pointer text-center ${theme.innerCardBg} ${theme.headerText} hover:opacity-80`}
                    >
                        طي البطاقة
                    </button>
                </div>
            )}
        </div>
    );
};

export default CurrentRequestDrawer;
