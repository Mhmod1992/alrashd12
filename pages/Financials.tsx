
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { FinancialStats, PaymentType } from '../types';
import FinancialsTable from '../components/FinancialsTable';
import DollarSignIcon from '../components/icons/DollarSignIcon';
import FilterIcon from '../components/icons/FilterIcon';
import PrinterIcon from '../components/icons/PrinterIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import Icon from '../components/Icon';
import { Skeleton } from '../components/Skeleton';
import BanknotesIcon from '../components/icons/BanknotesIcon';
import Button from '../components/Button';
import LineChart from '../components/LineChart';
import CreditCardIcon from '../components/icons/CreditCardIcon';
import Modal from '../components/Modal';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';

// --- Helper Components ---

const KpiCard: React.FC<{
    title: string;
    value: string;
    icon: React.ReactNode;
    color: 'emerald' | 'blue' | 'amber' | 'rose' | 'indigo' | 'slate' | 'purple' | 'green';
    subValue?: string;
    onClick?: () => void;
    isHero?: boolean;
}> = ({ title, value, icon, color, subValue, onClick, isHero = false }) => {

    const iconStyles = {
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
        green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        slate: 'bg-slate-50 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    };

    return (
        <div
            onClick={onClick}
            className={`
                bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 
                rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group h-full relative overflow-hidden
                ${isHero ? 'p-6 flex flex-col items-center text-center justify-center border-b-4 border-b-emerald-500' : 'p-4 flex items-center gap-4'}
            `}
        >
            <div className={`
                ${isHero ? 'p-4 rounded-2xl mb-3' : 'p-3 rounded-xl flex-shrink-0'} 
                transition-transform duration-300 group-hover:scale-110 
                ${iconStyles[color]}
            `}>
                {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: isHero ? 'w-10 h-10' : 'w-6 h-6' })}
            </div>

            <div className={`flex-1 min-w-0 z-10 ${isHero ? 'w-full' : ''}`}>
                <p className={`
                    font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate
                    ${isHero ? 'text-sm mb-2' : 'text-[10px] mb-0.5'}
                `}>
                    {title}
                </p>
                <p className={`
                    font-black text-slate-800 dark:text-white leading-none tracking-tight font-numeric
                    ${isHero ? 'text-4xl' : 'text-xl sm:text-2xl'}
                `}>
                    {value}
                </p>
                {subValue && (
                    <p className={`
                        text-slate-400 mt-1 truncate font-medium
                        ${isHero ? 'text-sm mt-2' : 'text-[9px]'}
                    `}>
                        {subValue}
                    </p>
                )}
            </div>
        </div>
    );
};

const ModalHeaderSummary: React.FC<{ title: string; amount: string; colorClass: string }> = ({ title, amount, colorClass }) => (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-4 flex justify-between items-center">
        <span className="text-slate-500 dark:text-slate-400 font-bold text-sm">{title}</span>
        <span className={`text-2xl font-black font-numeric ${colorClass}`}>{amount} <span className="text-sm font-normal text-slate-400 font-sans">ريال</span></span>
    </div>
);

const TargetProgressStrip: React.FC<{ current: number; target: number; previous: number; periodLabel: string }> = ({ current, target, previous, periodLabel }) => {
    const progress = Math.min((current / target) * 100, 100);
    const previousProgress = Math.min((previous / target) * 100, 100);

    let statusColor = 'from-blue-500 to-indigo-500';
    let textColor = 'text-blue-600';
    let message = 'جاري العمل...';
    let icon = <RefreshCwIcon className="w-4 h-4 animate-spin" />;

    if (progress >= 100) {
        statusColor = 'from-emerald-500 to-green-400';
        textColor = 'text-emerald-600';
        message = 'تم تحقيق الهدف!';
        icon = <CheckCircleIcon className="w-4 h-4" />;
    } else if (progress > 75) {
        statusColor = 'from-emerald-400 to-teal-400';
        textColor = 'text-teal-600';
        message = 'قريب جداً من الهدف';
        icon = <Icon name="sparkles" className="w-4 h-4" />;
    } else if (progress < 25 && progress > 0) {
        statusColor = 'from-orange-400 to-amber-400';
        textColor = 'text-orange-600';
        message = 'بداية المشوار';
        icon = <RefreshCwIcon className="w-4 h-4" />;
    }

    return (
        <div className="w-full p-4 flex flex-col h-full justify-center">
            <div className="flex justify-between items-end mb-3">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-700 ${textColor}`}>
                        {icon}
                    </div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 block uppercase">الدخل الحالي ({periodLabel})</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-slate-800 dark:text-white leading-none font-numeric">{current.toLocaleString('en-US')}</span>
                            <span className="text-xs text-slate-500 font-bold">ريال</span>
                        </div>
                    </div>
                </div>
                <div className="text-left">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">الهدف</span>
                    <span className="text-lg font-bold text-slate-600 dark:text-slate-300 font-numeric">{target.toLocaleString('en-US')}</span>
                </div>
            </div>

            <div className="relative h-12 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-700">
                {previous > 0 && (
                    <div
                        className="absolute top-0 bottom-0 border-r-2 border-slate-400/30 dark:border-slate-500/50 border-dashed z-10 transition-all duration-1000"
                        style={{ width: `${previousProgress}%` }}
                    >
                        <div className="absolute right-0 top-1 -mr-px h-full">
                            <span className="text-[9px] text-slate-400 -mr-2 bg-white dark:bg-slate-800 px-1 rounded shadow-sm border dark:border-slate-600 transform -rotate-90 origin-bottom-right inline-block translate-y-3 opacity-70 font-numeric">
                                السابق ({previous.toLocaleString('en-US')})
                            </span>
                        </div>
                    </div>
                )}
                <div
                    className={`h-full bg-gradient-to-r ${statusColor} transition-all duration-1000 ease-out flex items-center justify-end px-3 relative z-20 ${progress < 8 ? 'text-transparent' : 'text-white'}`}
                    style={{ width: `${progress}%` }}
                >
                    <span className="font-bold text-sm drop-shadow-md tracking-wider font-numeric">{Math.round(progress)}%</span>
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent"></div>
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[length:10px_10px] bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] animate-[moveStripe_1s_linear_infinite]"></div>
                </div>
            </div>

            <div className="mt-3 flex justify-between items-center text-xs">
                <span className={`font-bold ${textColor} flex items-center gap-1`}>
                    {message}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                    متبقي للهدف: <span className="font-bold text-slate-700 dark:text-slate-200 font-numeric">{Math.max(0, target - current).toLocaleString('en-US')}</span>
                </span>
            </div>
            <style>{`
                @keyframes moveStripe {
                    0% { background-position: 0 0; }
                    100% { background-position: 10px 0; }
                }
            `}</style>
        </div>
    );
};

const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-32 h-32 flex-shrink-0">
                {total > 0 ? (
                    <>
                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            <circle r="40" cx="50" cy="50" fill="transparent" stroke="#e2e8f0" strokeWidth="15" />
                            {(() => {
                                let cumulativePercent = 0;
                                return data.map((d, i) => {
                                    const percent = d.value / total;
                                    const dashArray = percent * (2 * Math.PI * 40);
                                    const dashOffset = -cumulativePercent * (2 * Math.PI * 40);
                                    cumulativePercent += percent;
                                    return <circle key={i} r="40" cx="50" cy="50" fill="transparent" stroke={d.color} strokeWidth="15" strokeDasharray={`${dashArray} ${2 * Math.PI * 40}`} strokeDashoffset={dashOffset} className="transition-all duration-500" />
                                })
                            })()}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="block text-[10px] text-slate-400 font-bold uppercase">المدفوع</span>
                            <span className="block text-sm font-black text-slate-800 dark:text-slate-200 font-numeric">{total.toLocaleString('en-US')}</span>
                        </div>
                    </>
                ) : (
                    <div className="w-full h-full rounded-full bg-slate-50 dark:bg-slate-700/30 border-2 border-dashed border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs text-slate-400">
                        بلا بيانات
                    </div>
                )}
            </div>

            <div className="flex-1 space-y-3 w-full min-w-0">
                {data.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-700/50 pb-2 last:border-0 gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                            <span className="text-slate-600 dark:text-slate-300 font-bold truncate">{item.label}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <span className="block font-black text-slate-800 dark:text-slate-100 font-numeric">{item.value.toLocaleString('en-US')}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Main Page Component ---
const Financials: React.FC = () => {
    const { fetchServerFinancials, can, clients, cars, carMakes, carModels, inspectionTypes, addNotification, settings, employees } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);

    const [filterType, setFilterType] = useState<'today' | 'yesterday' | 'month' | 'last_month' | 'range'>('today');
    const [calculationMode, setCalculationMode] = useState<'all' | 'completed'>('all');

    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [activeTab, setActiveTab] = useState<'requests' | 'expenses' | 'revenues' | 'brokers'>('requests');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentType | 'all' | 'unpaid'>('all');

    const [stats, setStats] = useState<FinancialStats | null>(null);
    const [activeModal, setActiveModal] = useState<string | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const now = new Date();
            let start = new Date();
            let end = new Date();

            switch (filterType) {
                case 'today': start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999); break;
                case 'yesterday': start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0); end.setDate(now.getDate() - 1); end.setHours(23, 59, 59, 999); break;
                case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); break;
                case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); break;
                case 'range':
                    if (!customStartDate || !customEndDate) { setIsLoading(false); return; }
                    start = new Date(customStartDate); start.setHours(0, 0, 0, 0);
                    end = new Date(customEndDate); end.setHours(23, 59, 59, 999);
                    break;
            }

            const includeCompletedOnly = calculationMode === 'completed';
            const data = await fetchServerFinancials(start.toISOString(), end.toISOString(), includeCompletedOnly);
            setStats(data);

        } catch (e: any) {
            console.error("Failed to load financials:", e);
            addNotification({ title: 'خطأ', message: 'فشل تحميل البيانات المالية.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filterType, customStartDate, customEndDate, calculationMode]);

    const cashInDrawer = useMemo(() => {
        if (!stats) return 0;
        const income = stats.cashTotal;
        const deductions = stats.totalCommissions + stats.totalExpenses + stats.totalAdvances;
        return income - deductions;
    }, [stats]);

    const targetData = useMemo(() => {
        const DAILY_TARGET = 5000;
        let daysInFilter = 1;
        let periodLabel = 'اليوم';

        if (filterType === 'month' || filterType === 'last_month') {
            daysInFilter = 30; periodLabel = 'هذا الشهر';
        } else if (filterType === 'range' && customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            const end = new Date(customEndDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            daysInFilter = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            periodLabel = 'الفترة المحددة';
        } else if (filterType === 'yesterday') {
            periodLabel = 'أمس';
        }

        const target = DAILY_TARGET * daysInFilter;
        const previous = target * 0.65;

        return { target, previous, periodLabel };
    }, [filterType, customStartDate, customEndDate]);

    const displayedRequests = useMemo(() => {
        if (!stats) return [];
        if (paymentStatusFilter === 'all') return stats.filteredRequests;
        if (paymentStatusFilter === 'unpaid') return stats.filteredRequests.filter(r => r.payment_type === PaymentType.Unpaid);
        return stats.filteredRequests.filter(r => r.payment_type === paymentStatusFilter);
    }, [stats, paymentStatusFilter]);

    const activeFilterClass = "bg-blue-600 text-white shadow-md";
    const inactiveFilterClass = "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600";

    const handlePrint = () => window.print();

    const getModalTitle = () => {
        switch (activeModal) {
            case 'expenses': return 'تفاصيل المصروفات';
            case 'revenues': return 'تفاصيل الإيرادات الأخرى';
            case 'transfers': return 'تفاصيل التحويلات البنكية';
            case 'card': return 'تفاصيل عمليات الشبكة';
            case 'cash': return 'تفاصيل النقد المقبوض';
            case 'commissions': return 'تفاصيل العمولات المستحقة';
            case 'drawer': return 'حسبة النقد في الدرج';
            default: return 'التفاصيل';
        }
    };

    const getFilterLabel = () => {
        switch (filterType) {
            case 'today': return 'اليوم';
            case 'yesterday': return 'أمس';
            case 'month': return 'هذا الشهر';
            case 'last_month': return 'الشهر الماضي';
            case 'range': return 'الفترة المحددة';
            default: return '';
        }
    }

    const getModalContent = () => {
        if (!stats || !activeModal) return null;
        const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'عميل غير معروف';

        switch (activeModal) {
            case 'expenses':
                const visibleExpenses = stats.filteredExpenses.filter(e => e.category !== 'سلف' && e.category !== 'خصومات');
                const totalVisible = visibleExpenses.reduce((sum, e) => sum + e.amount, 0);
                return (
                    <div>
                        <ModalHeaderSummary title="إجمالي المصروفات التشغيلية" amount={totalVisible.toLocaleString('en-US')} colorClass="text-red-600" />
                        <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-bold text-gray-500 uppercase">
                                    <tr><th className="px-4 py-3 border-b dark:border-slate-600">التاريخ</th><th className="px-4 py-3 border-b dark:border-slate-600">الفئة</th><th className="px-4 py-3 border-b dark:border-slate-600">الوصف</th><th className="px-4 py-3 border-b dark:border-slate-600">المبلغ</th></tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-600 bg-white dark:bg-slate-800">
                                    {visibleExpenses.map(exp => (
                                        <tr key={exp.id}>
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-numeric">{new Date(exp.date).toLocaleDateString('en-GB')}</td>
                                            <td className="px-4 py-3"><span className="bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded text-xs font-bold text-slate-700 dark:text-slate-200">{exp.category}</span></td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{exp.description}</td>
                                            <td className="px-4 py-3 font-bold text-red-600 font-numeric">{exp.amount.toLocaleString('en-US')}</td>
                                        </tr>
                                    ))}
                                    {visibleExpenses.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">لا توجد مصروفات</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'revenues':
                return (
                    <div>
                        <ModalHeaderSummary title="إجمالي الإيرادات الأخرى" amount={stats.totalOtherRevenue.toLocaleString('en-US')} colorClass="text-green-600" />
                        <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-bold text-gray-500 uppercase"><tr><th className="px-4 py-3 border-b dark:border-slate-600">التاريخ</th><th className="px-4 py-3 border-b dark:border-slate-600">الفئة</th><th className="px-4 py-3 border-b dark:border-slate-600">الوصف</th><th className="px-4 py-3 border-b dark:border-slate-600">المبلغ</th></tr></thead>
                                <tbody className="divide-y dark:divide-slate-600 bg-white dark:bg-slate-800">
                                    {stats.filteredRevenues.map(rev => (
                                        <tr key={rev.id}>
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-numeric">{new Date(rev.date).toLocaleDateString('en-GB')}</td>
                                            <td className="px-4 py-3"><span className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-xs font-bold text-green-700 dark:text-green-200">{rev.category}</span></td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{rev.description}</td>
                                            <td className="px-4 py-3 font-bold text-green-600 font-numeric">{rev.amount.toLocaleString('en-US')}</td>
                                        </tr>
                                    ))}
                                    {stats.filteredRevenues.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">لا توجد إيرادات أخرى</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'transfers':
                const transfers = stats.filteredRequests.filter(r => r.payment_type === PaymentType.Transfer);
                return (
                    <div>
                        <ModalHeaderSummary title="إجمالي التحويلات" amount={stats.transferTotal.toLocaleString('en-US')} colorClass="text-amber-600" />
                        <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-bold text-gray-500 uppercase"><tr><th className="px-4 py-3 border-b dark:border-slate-600">رقم الطلب</th><th className="px-4 py-3 border-b dark:border-slate-600">العميل</th><th className="px-4 py-3 border-b dark:border-slate-600">ملاحظة التحويل</th><th className="px-4 py-3 border-b dark:border-slate-600">المبلغ</th></tr></thead>
                                <tbody className="divide-y dark:divide-slate-600 bg-white dark:bg-slate-800">
                                    {transfers.map(req => (
                                        <tr key={req.id}>
                                            <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 font-numeric">#{req.request_number}</td>
                                            <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{getClientName(req.client_id)}</td>
                                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{req.payment_note || '-'}</td>
                                            <td className="px-4 py-3 font-bold text-amber-600 font-numeric">{req.price.toLocaleString('en-US')}</td>
                                        </tr>
                                    ))}
                                    {transfers.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">لا توجد تحويلات</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'card':
                const cards = stats.filteredRequests.filter(r => r.payment_type === PaymentType.Card || (r.payment_type === PaymentType.Split && r.split_payment_details?.card));
                return (
                    <div>
                        <ModalHeaderSummary title="إجمالي الشبكة" amount={stats.cardTotal.toLocaleString('en-US')} colorClass="text-blue-600" />
                        <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-bold text-gray-500 uppercase"><tr><th className="px-4 py-3 border-b dark:border-slate-600">رقم الطلب</th><th className="px-4 py-3 border-b dark:border-slate-600">العميل</th><th className="px-4 py-3 border-b dark:border-slate-600">التاريخ</th><th className="px-4 py-3 border-b dark:border-slate-600">المبلغ</th></tr></thead>
                                <tbody className="divide-y dark:divide-slate-600 bg-white dark:bg-slate-800">
                                    {cards.map(req => (
                                        <tr key={req.id}>
                                            <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 font-numeric">#{req.request_number}</td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{getClientName(req.client_id)}</td>
                                            <td className="px-4 py-3 text-slate-500 font-numeric">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                                            <td className="px-4 py-3 font-bold text-blue-600 font-numeric">{(req.payment_type === PaymentType.Split ? req.split_payment_details?.card : req.price)?.toLocaleString('en-US')}</td>
                                        </tr>
                                    ))}
                                    {cards.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">لا توجد عمليات شبكة</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'cash':
                const cashReqs = stats.filteredRequests.filter(r => r.payment_type === PaymentType.Cash || (r.payment_type === PaymentType.Split && r.split_payment_details?.cash));
                return (
                    <div>
                        <ModalHeaderSummary title="إجمالي النقد (المقبوض)" amount={stats.cashTotal.toLocaleString('en-US')} colorClass="text-emerald-600" />
                        <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-bold text-gray-500 uppercase"><tr><th className="px-4 py-3 border-b dark:border-slate-600">رقم الطلب</th><th className="px-4 py-3 border-b dark:border-slate-600">العميل</th><th className="px-4 py-3 border-b dark:border-slate-600">التاريخ</th><th className="px-4 py-3 border-b dark:border-slate-600">المبلغ</th></tr></thead>
                                <tbody className="divide-y dark:divide-slate-600 bg-white dark:bg-slate-800">
                                    {cashReqs.map(req => (
                                        <tr key={req.id}>
                                            <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300 font-numeric">#{req.request_number}</td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{getClientName(req.client_id)}</td>
                                            <td className="px-4 py-3 text-slate-500 font-numeric">{new Date(req.created_at).toLocaleDateString('en-GB')}</td>
                                            <td className="px-4 py-3 font-bold text-emerald-600 font-numeric">{(req.payment_type === PaymentType.Split ? req.split_payment_details?.cash : req.price)?.toLocaleString('en-US')}</td>
                                        </tr>
                                    ))}
                                    {cashReqs.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">لا توجد عمليات نقدية</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'commissions':
                return (
                    <div>
                        <ModalHeaderSummary title="إجمالي العمولات" amount={stats.totalCommissions.toLocaleString('en-US')} colorClass="text-rose-600" />
                        <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-bold text-gray-500 uppercase"><tr><th className="px-4 py-3 border-b dark:border-slate-600">السمسار</th><th className="px-4 py-3 border-b dark:border-slate-600">عدد الطلبات</th><th className="px-4 py-3 border-b dark:border-slate-600">المستحق</th></tr></thead>
                                <tbody className="divide-y dark:divide-slate-600 bg-white dark:bg-slate-800">
                                    {stats.brokerSummary.map((b, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{b.name}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-numeric">{b.count}</td>
                                            <td className="px-4 py-3 font-bold text-rose-600 font-numeric">{b.amount.toLocaleString('en-US')}</td>
                                        </tr>
                                    ))}
                                    {stats.brokerSummary.length === 0 && <tr><td colSpan={3} className="text-center py-6 text-slate-400">لا توجد عمولات</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'drawer':
                return (
                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                            <span className="text-slate-600 dark:text-slate-300">إجمالي النقد المستلم (طلبات + إيرادات)</span>
                            <span className="font-bold text-lg text-emerald-600 font-numeric">{stats.cashTotal.toLocaleString('en-US')} ريال</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 border border-red-100 dark:border-red-900">
                            <span>- المصروفات التشغيلية</span>
                            <span className="font-bold text-lg font-numeric">{stats.totalExpenses.toLocaleString('en-US')} ريال</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600 border border-rose-100 dark:border-rose-900">
                            <span>- سلف الموظفين (نقدية خارجة)</span>
                            <span className="font-bold text-lg font-numeric">{stats.totalAdvances.toLocaleString('en-US')} ريال</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600 border border-orange-100 dark:border-orange-900">
                            <span>- العمولات</span>
                            <span className="font-bold text-lg font-numeric">{stats.totalCommissions.toLocaleString('en-US')} ريال</span>
                        </div>
                        <hr className="border-slate-200 dark:border-slate-600" />
                        <div className="flex justify-between items-center p-6 bg-slate-900 text-white rounded-xl shadow-lg">
                            <span className="font-black text-xl">صافي ما في الدرج</span>
                            <span className="font-black text-3xl text-emerald-400 font-numeric">{cashInDrawer.toLocaleString('en-US')} ريال</span>
                        </div>
                    </div>
                );
            default: return null;
        }
    }

    if (!can('view_financials')) return <div className="p-8 text-center text-red-500">ليس لديك صلاحية.</div>;

    return (
        <>
            <div className="container mx-auto space-y-6 pb-20 animate-fade-in print:hidden">

                {/* Header & Controls */}
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">التحليل المالي للورشة</h2>
                        <div className="flex gap-2">
                            <Button onClick={loadData} variant="secondary" leftIcon={<RefreshCwIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />} disabled={isLoading}>تحديث</Button>
                            <Button onClick={handlePrint} variant="secondary" leftIcon={<PrinterIcon className="w-5 h-5" />}>طباعة</Button>
                        </div>
                    </div>

                    {/* Filters Section */}
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        {/* Date Filters */}
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 items-center flex-1">
                            <FilterIcon className="w-5 h-5 text-slate-400 ml-2" />
                            <button onClick={() => setFilterType('today')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === 'today' ? activeFilterClass : inactiveFilterClass}`}>اليوم</button>
                            <button onClick={() => setFilterType('yesterday')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === 'yesterday' ? activeFilterClass : inactiveFilterClass}`}>أمس</button>
                            <button onClick={() => setFilterType('month')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === 'month' ? activeFilterClass : inactiveFilterClass}`}>هذا الشهر</button>
                            <button onClick={() => setFilterType('last_month')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === 'last_month' ? activeFilterClass : inactiveFilterClass}`}>الشهر الماضي</button>
                            <button onClick={() => setFilterType('range')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === 'range' ? activeFilterClass : inactiveFilterClass}`}>نطاق مخصص</button>
                            {filterType === 'range' && (
                                <div className="flex items-center gap-2 mr-auto animate-fade-in bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border dark:border-slate-700">
                                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 text-xs font-bold" />
                                    <span className="text-slate-400 font-bold">-</span>
                                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 text-xs font-bold" />
                                </div>
                            )}
                        </div>

                        {/* Calculation Mode Toggle */}
                        <div className="bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                            <button
                                onClick={() => setCalculationMode('all')}
                                className={`flex-1 px-4 py-2 rounded-xl text-sm font-bold transition-all ${calculationMode === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                الكل
                            </button>
                            <button
                                onClick={() => setCalculationMode('completed')}
                                className={`flex-1 px-4 py-2 rounded-xl text-sm font-bold transition-all ${calculationMode === 'completed' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                المكتملة فقط
                            </button>
                        </div>
                    </div>
                </div>

                {isLoading ? <div className="space-y-6"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div> : !stats ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold"><p>اختر فترة لعرض البيانات.</p></div>
                ) : (
                    <>
                        {/* --- ROW 1: HERO CARD (NET CASH) --- */}
                        <div className="grid grid-cols-1">
                            <KpiCard
                                title="صافي النقد في الدرج"
                                value={`${cashInDrawer.toLocaleString('en-US')}`}
                                icon={<BanknotesIcon />}
                                color={cashInDrawer >= 0 ? 'emerald' : 'rose'}
                                subValue="اضغط هنا لتفاصيل الحسبة"
                                onClick={() => setActiveModal('drawer')}
                                isHero={true}
                            />
                        </div>

                        {/* --- ROW 2: INCOMING PAYMENTS --- */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                            <KpiCard
                                title="مقبوضات نقدية (Cash)"
                                value={`${stats.cashTotal.toLocaleString('en-US')}`}
                                icon={<DollarSignIcon />}
                                color="slate"
                                subValue="اضغط للتفاصيل"
                                onClick={() => setActiveModal('cash')}
                            />
                            <KpiCard
                                title="مقبوضات تحويل"
                                value={`${stats.transferTotal.toLocaleString('en-US')}`}
                                icon={<RefreshCwIcon />}
                                color="amber"
                                subValue="اضغط للتفاصيل"
                                onClick={() => setActiveModal('transfers')}
                            />
                            <KpiCard
                                title="مقبوضات شبكة (Card)"
                                value={`${stats.cardTotal.toLocaleString('en-US')}`}
                                icon={<CreditCardIcon />}
                                color="blue"
                                subValue="اضغط للتفاصيل"
                                onClick={() => setActiveModal('card')}
                            />
                        </div>

                        {/* --- ROW 3: OUTGOING / DEDUCTIONS / OTHER REVENUE --- */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                            <KpiCard
                                title="إيرادات أخرى (إضافة)"
                                value={`${stats.totalOtherRevenue.toLocaleString('en-US')}`}
                                icon={<TrendingUpIcon />}
                                color="green"
                                subValue="اضغط للتفاصيل"
                                onClick={() => setActiveModal('revenues')}
                            />
                            <KpiCard
                                title="العمولات (خصم)"
                                value={`${stats.totalCommissions.toLocaleString('en-US')}`}
                                icon={<Icon name="broker" />}
                                color="rose"
                                subValue="اضغط للتفاصيل"
                                onClick={() => setActiveModal('commissions')}
                            />
                            <KpiCard
                                title="المصروفات (خصم)"
                                value={`${stats.totalExpenses.toLocaleString('en-US')}`}
                                icon={<CreditCardIcon />}
                                color="rose"
                                subValue="اضغط للتفاصيل"
                                onClick={() => setActiveModal('expenses')}
                            />
                        </div>

                        {/* --- ROW 4: TOTALS --- */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            <KpiCard
                                title="إجمالي الدخل (طلبات + إيرادات)"
                                value={`${stats.totalRevenue.toLocaleString('en-US')}`}
                                icon={<Icon name="dollar-sign" />}
                                color="indigo"
                                subValue="نقد + تحويل + شبكة + آجل"
                            />
                            <KpiCard
                                title="صافي الربح الفعلي"
                                value={`${stats.netProfit.toLocaleString('en-US')}`}
                                icon={<Icon name="sparkles" />}
                                color={stats.netProfit >= 0 ? 'purple' : 'rose'}
                                subValue="النقد الفعلي - المصروفات والعمولات"
                            />
                        </div>

                        {/* CHARTS SECTION */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full print:hidden">
                            {/* Daily Income Indicator - Replaced Chart */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                <h3 className="font-black text-slate-700 dark:text-slate-200 mb-6 text-sm flex items-center gap-2 uppercase tracking-wider">
                                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                    مؤشر الدخل اليومي
                                </h3>
                                <TargetProgressStrip
                                    current={stats.totalRevenue}
                                    target={targetData.target}
                                    previous={targetData.previous}
                                    periodLabel={targetData.periodLabel}
                                />
                            </div>

                            {/* Forecast Chart */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                <h3 className="font-black text-slate-700 dark:text-slate-200 mb-6 text-sm flex items-center gap-2 uppercase tracking-wider">
                                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                    تحليل الاتجاه والتوقعات المالية
                                </h3>
                                <LineChart data={stats.forecast.history} forecastData={stats.forecast.data} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                <h3 className="font-black text-slate-700 dark:text-slate-200 mb-6 text-sm uppercase tracking-wider">توزيع طرق الدفع</h3>
                                <DonutChart data={stats.paymentDistribution} />
                            </div>
                            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                <h3 className="font-black text-slate-700 dark:text-slate-200 mb-2 text-sm uppercase tracking-wider">ملخص العمليات بالأرقام</h3>
                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">إجمالي طلبات الفحص</p>
                                        <p className="text-xl font-black text-slate-800 dark:text-slate-100 font-numeric">{stats.filteredRequests.length}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">إجمالي العمليات التشغيلية</p>
                                        <p className="text-xl font-black text-slate-800 dark:text-slate-100 font-numeric">{stats.filteredExpenses.filter(e => e.category !== 'سلف' && e.category !== 'خصومات').length}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">إجمالي الإيرادات الأخرى</p>
                                        <p className="text-xl font-black text-slate-800 dark:text-slate-100 font-numeric">{stats.filteredRevenues.length}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">إجمالي الذمم المدينة (آجل)</p>
                                        <p className="text-xl font-black text-rose-600 dark:text-rose-400 font-numeric">{stats.unpaidTotal.toLocaleString('en-US')} ريال</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                            <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto print:hidden">
                                {['requests', 'expenses', 'revenues', 'brokers'].map(tab => (
                                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                                        {tab === 'requests' ? `تفاصيل الطلبات (${stats.filteredRequests.length})` : tab === 'expenses' ? `المصروفات التشغيلية (${stats.filteredExpenses.length})` : tab === 'revenues' ? `الإيرادات الأخرى (${stats.filteredRevenues.length})` : `عمولات السماسرة (${stats.brokerSummary.length})`}
                                    </button>
                                ))}
                            </div>

                            <div>
                                {activeTab === 'requests' && (
                                    <div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex flex-wrap gap-2 items-center print:hidden">
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest ms-2">تصفية حسب الدفع:</span>
                                            <button onClick={() => setPaymentStatusFilter('all')} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${paymentStatusFilter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600'}`}>الكل</button>
                                            <button onClick={() => setPaymentStatusFilter(PaymentType.Cash)} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${paymentStatusFilter === PaymentType.Cash ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600'}`}>نقدي</button>
                                            <button onClick={() => setPaymentStatusFilter(PaymentType.Card)} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${paymentStatusFilter === PaymentType.Card ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600'}`}>بطاقة</button>
                                            <button onClick={() => setPaymentStatusFilter(PaymentType.Transfer)} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${paymentStatusFilter === PaymentType.Transfer ? 'bg-amber-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600'}`}>تحويل</button>
                                            <button onClick={() => setPaymentStatusFilter('unpaid')} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${paymentStatusFilter === 'unpaid' ? 'bg-rose-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600'}`}>آجل</button>
                                        </div>
                                        <FinancialsTable requests={displayedRequests} clients={clients} cars={cars} carMakes={carMakes} carModels={carModels} />
                                    </div>
                                )}
                                {activeTab === 'expenses' && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-right"><thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 dark:text-slate-400"><tr><th className="px-6 py-4">التاريخ</th><th className="px-6 py-4">الفئة</th><th className="px-6 py-4">الوصف</th><th className="px-6 py-4">الموظف</th><th className="px-6 py-4">المبلغ</th></tr></thead><tbody className="divide-y dark:divide-slate-700">{stats.filteredExpenses.map(exp => <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30"><td className="px-6 py-4 font-mono text-xs font-numeric">{new Date(exp.date).toLocaleDateString('en-GB')}</td><td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md font-bold text-[10px]">{exp.category}</span></td><td className="px-6 py-4">{exp.description}</td><td className="px-6 py-4 text-xs font-bold">{exp.employeeName}</td><td className="px-6 py-4 font-black text-rose-600 dark:text-rose-400 font-numeric">{exp.amount.toLocaleString('en-US')} ريال</td></tr>)}</tbody></table>
                                    </div>
                                )}
                                {activeTab === 'revenues' && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-right"><thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 dark:text-slate-400"><tr><th className="px-6 py-4">التاريخ</th><th className="px-6 py-4">الفئة</th><th className="px-6 py-4">الوصف</th><th className="px-6 py-4">الموظف</th><th className="px-6 py-4">المبلغ</th></tr></thead><tbody className="divide-y dark:divide-slate-700">{stats.filteredRevenues.map(rev => <tr key={rev.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30"><td className="px-6 py-4 font-mono text-xs font-numeric">{new Date(rev.date).toLocaleDateString('en-GB')}</td><td className="px-6 py-4"><span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md font-bold text-[10px]">{rev.category}</span></td><td className="px-6 py-4">{rev.description}</td><td className="px-6 py-4 text-xs font-bold">{rev.employeeName}</td><td className="px-6 py-4 font-black text-green-600 dark:text-green-400 font-numeric">{rev.amount.toLocaleString('en-US')} ريال</td></tr>)}</tbody></table>
                                    </div>
                                )}
                                {activeTab === 'brokers' && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-right"><thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 dark:text-slate-400"><tr><th className="px-6 py-4">السمسار</th><th className="px-6 py-4 text-center">عدد الطلبات</th><th className="px-6 py-4">إجمالي العمولات المستحقة</th></tr></thead><tbody className="divide-y dark:divide-slate-700">{stats.brokerSummary.map((b, i) => <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30"><td className="px-6 py-4 font-black text-slate-800 dark:text-slate-100">{b.name}</td><td className="px-6 py-4 text-center font-bold text-blue-600 dark:text-blue-400 font-numeric">{b.count}</td><td className="px-6 py-4 font-black text-rose-600 dark:text-rose-400 font-numeric">{b.amount.toLocaleString('en-US')} ريال</td></tr>)}</tbody></table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* DETAILS MODAL */}
                {activeModal && (
                    <Modal isOpen={!!activeModal} onClose={() => setActiveModal(null)} title={getModalTitle()} size="2xl">
                        {getModalContent()}
                        <div className="flex justify-end pt-4 border-t dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setActiveModal(null)}>إغلاق</Button>
                        </div>
                    </Modal>
                )}
            </div>

            {/* --- NEW PRINT LAYOUT (Visible only on print) --- */}
            {stats && (
                <div className="print-container hidden print:block print:w-full bg-white text-slate-900 p-8 font-sans" dir="rtl">

                    {/* Print Header - Redesigned */}
                    <div className="flex justify-between items-end mb-10 border-b border-slate-300 pb-6">
                        <div className="flex items-center gap-5">
                            {settings.logoUrl ? (
                                <img src={settings.logoUrl} alt="Logo" className="w-24 h-24 object-contain" />
                            ) : (
                                <div className="w-20 h-20 bg-slate-900 text-white flex items-center justify-center rounded-lg font-black text-2xl">
                                    {settings.appName.substring(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-1">{settings.appName}</h1>
                                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">التقرير المالي الدوري</p>
                            </div>
                        </div>

                        <div className="text-left space-y-2">
                            <div className="border border-slate-300 rounded-lg px-4 py-2 bg-slate-50 inline-block min-w-[220px]">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">تاريخ الإصدار</p>
                                <div className="flex items-baseline gap-2 justify-end">
                                    <span className="text-xl font-bold font-numeric text-slate-800">{new Date().toLocaleDateString('en-GB')}</span>
                                    <span className="text-xs text-slate-400 font-numeric">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block">
                                    الفترة: {getFilterLabel()} {filterType === 'range' && `(${customStartDate} - ${customEndDate})`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* HERO Summary Section (4 Key Metrics) */}
                    <div className="mb-10 grid grid-cols-4 gap-4">
                        {/* Total Revenue */}
                        <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                            <div className="absolute top-0 w-full h-1 bg-emerald-500"></div>
                            <span className="text-emerald-700 font-bold text-xs uppercase tracking-widest mb-2">إجمالي الدخل</span>
                            <span className="text-3xl font-black font-numeric text-emerald-900 leading-none mb-1">{stats.totalRevenue.toLocaleString('en-US')}</span>
                            <span className="text-[10px] font-bold text-emerald-600 opacity-70">ريال سعودي</span>
                        </div>

                        {/* Total Salaries (NEW) */}
                        <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                            <div className="absolute top-0 w-full h-1 bg-blue-500"></div>
                            <span className="text-blue-700 font-bold text-xs uppercase tracking-widest mb-2">إجمالي الرواتب</span>
                            <span className="text-3xl font-black font-numeric text-blue-900 leading-none mb-1">{stats.filteredExpenses.filter(e => e.category === 'رواتب' || e.category === 'مكافآت').reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-US')}</span>
                            <span className="text-[10px] font-bold text-blue-600 opacity-70">ريال سعودي</span>
                        </div>

                        {/* Total Expenses (Others) */}
                        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                            <div className="absolute top-0 w-full h-1 bg-rose-500"></div>
                            <span className="text-rose-700 font-bold text-xs uppercase tracking-widest mb-2">المصروفات التشغيلية</span>
                            <span className="text-3xl font-black font-numeric text-rose-900 leading-none mb-1">{(stats.totalExpenses - stats.filteredExpenses.filter(e => e.category === 'رواتب' || e.category === 'مكافآت').reduce((sum, e) => sum + e.amount, 0) + stats.totalCommissions).toLocaleString('en-US')}</span>
                            <span className="text-[10px] font-bold text-rose-600 opacity-70">ريال سعودي</span>
                        </div>

                        {/* Net Profit */}
                        <div className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                            <div className="absolute top-0 w-full h-1 bg-indigo-500"></div>
                            <span className="text-indigo-700 font-bold text-xs uppercase tracking-widest mb-2">صافي الربح الفعلي</span>
                            <span className="text-4xl font-black font-numeric text-indigo-900 leading-none mb-1">{stats.netProfit.toLocaleString('en-US')}</span>
                            <span className="text-[10px] font-bold text-indigo-600 opacity-70">ريال سعودي</span>
                        </div>
                    </div>

                    {/* Visual Analytics */}
                    <div className="grid grid-cols-2 gap-8 mb-10 break-inside-avoid">
                        <div className="rounded-xl p-5 border border-slate-200 bg-white">
                            <h3 className="font-bold text-slate-700 mb-6 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                                <span className="w-1.5 h-3 bg-indigo-500 rounded-full"></span>
                                تحليل الدخل (الفعلي vs المتوقع)
                            </h3>
                            <div className="h-[200px]">
                                <LineChart data={stats.forecast.history} forecastData={stats.forecast.data} height={180} />
                            </div>
                        </div>
                        <div className="rounded-xl p-5 border border-slate-200 bg-white">
                            <h3 className="font-bold text-slate-700 mb-6 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                                <span className="w-1.5 h-3 bg-emerald-500 rounded-full"></span>
                                توزيع التدفقات المالية
                            </h3>
                            <div className="h-[200px] flex items-center justify-center">
                                <DonutChart data={stats.paymentDistribution} />
                            </div>
                        </div>
                    </div>

                    {/* Breakdown Summary Grid */}
                    <div className="mb-10 border border-slate-300 rounded-xl overflow-hidden shadow-sm">
                        <div className="grid grid-cols-2 text-center divide-x divide-x-reverse divide-slate-300 bg-slate-50 border-b border-slate-300">
                            <div className="p-3 font-bold text-slate-700 text-sm">تفصيل الدخل</div>
                            <div className="p-3 font-bold text-slate-700 text-sm">تفصيل المصروفات</div>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-300">
                            {/* Income */}
                            <div className="p-4 space-y-3 bg-white">
                                <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-2">
                                    <span className="text-slate-500">نقد (يدوي):</span>
                                    <span className="font-mono font-bold text-slate-700">{stats.cashTotal.toLocaleString('en-US')}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-2">
                                    <span className="text-slate-500">شبكة (POS):</span>
                                    <span className="font-mono font-bold text-slate-700">{stats.cardTotal.toLocaleString('en-US')}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-2">
                                    <span className="text-slate-500">تحويل بنكي:</span>
                                    <span className="font-mono font-bold text-slate-700">{stats.transferTotal.toLocaleString('en-US')}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm bg-emerald-50/50 p-2 rounded text-emerald-700">
                                    <span className="font-bold">إيرادات أخرى متنوعة:</span>
                                    <span className="font-mono font-bold">{stats.totalOtherRevenue.toLocaleString('en-US')}</span>
                                </div>
                            </div>

                            {/* Deductions */}
                            <div className="p-4 space-y-3 bg-white">
                                <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-2">
                                    <span className="text-slate-500">مصروفات تشغيلية:</span>
                                    <span className="font-mono font-bold text-rose-600">{(stats.totalExpenses - stats.filteredExpenses.filter(e => e.category === 'رواتب' || e.category === 'مكافآت').reduce((sum, e) => sum + e.amount, 0)).toLocaleString('en-US')}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-2">
                                    <span className="text-slate-500">رواتب ومكافآت:</span>
                                    <span className="font-mono font-bold text-blue-600">{stats.filteredExpenses.filter(e => e.category === 'رواتب' || e.category === 'مكافآت').reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-US')}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-2">
                                    <span className="text-slate-500">عمولات سماسرة:</span>
                                    <span className="font-mono font-bold text-orange-600">{stats.totalCommissions.toLocaleString('en-US')}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm bg-amber-50/50 p-2 rounded text-amber-700">
                                    <span className="font-bold">سلف موظفين:</span>
                                    <span className="font-mono font-bold">{stats.totalAdvances.toLocaleString('en-US')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Lists */}
                    <div className="space-y-8">
                        {/* 1. Receivables */}
                        {stats.filteredRequests.filter(r => r.payment_type === PaymentType.Unpaid).length > 0 && (
                            <div className="break-inside-avoid">
                                <h3 className="font-bold text-sm text-slate-800 border-r-4 border-slate-800 pr-3 mb-3 uppercase tracking-wider">الذمم المدينة (غير المحصل)</h3>
                                <table className="w-full text-xs text-center border-collapse border border-slate-300">
                                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-300">
                                        <tr>
                                            <th className="p-2 font-bold border-l border-slate-200">رقم الطلب</th>
                                            <th className="p-2 font-bold border-l border-slate-200">العميل</th>
                                            <th className="p-2 font-bold border-l border-slate-200">الجوال</th>
                                            <th className="p-2 font-bold">المبلغ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {stats.filteredRequests.filter(r => r.payment_type === PaymentType.Unpaid).map((req, idx) => {
                                            const client = clients.find(c => c.id === req.client_id);
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-2 font-mono text-slate-600 border-l border-slate-100">#{req.request_number}</td>
                                                    <td className="p-2 font-bold text-slate-900 border-l border-slate-100">{client?.name || '-'}</td>
                                                    <td className="p-2 font-mono text-slate-500 border-l border-slate-100">{client?.phone || '-'}</td>
                                                    <td className="p-2 font-mono font-bold text-slate-800">{req.price.toLocaleString('en-US')}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* 2. Salary Summary (ALL active Employees) */}
                        <div className="break-inside-avoid">
                            <h3 className="font-bold text-sm text-slate-800 border-r-4 border-slate-800 pr-3 mb-3 uppercase tracking-wider">ملخص الرواتب والمكافآت (حسب الموظف)</h3>
                            <table className="w-full text-xs text-center border-collapse border border-slate-300">
                                <thead className="bg-slate-50 text-slate-700 border-b border-slate-300">
                                    <tr>
                                        <th className="p-2 font-bold border-l border-slate-200 w-1/3">الموظف</th>
                                        <th className="p-2 font-bold border-l border-slate-200 w-1/3">الدور الوظيفي</th>
                                        <th className="p-2 font-bold">المبلغ المصروف</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {employees.filter(e => e.is_active).map((emp, idx) => {
                                        // Calculate total salary/bonuses for this employee in the filtered period
                                        const empTotal = stats.filteredExpenses
                                            .filter(e => (e.category === 'رواتب' || e.category === 'مكافآت') && (e.employeeId === emp.id || e.employeeName === emp.name))
                                            .reduce((sum, e) => sum + e.amount, 0);

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-2 font-bold text-slate-900 border-l border-slate-100">{emp.name}</td>
                                                <td className="p-2 text-slate-500 border-l border-slate-100">{emp.role === 'general_manager' ? 'مدير عام' : emp.role === 'manager' ? 'مدير' : emp.role === 'receptionist' ? 'استقبال' : 'موظف'}</td>
                                                <td className={`p-2 font-mono font-bold ${empTotal > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                                                    {empTotal.toLocaleString('en-US')}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100 font-bold border-t border-slate-300">
                                        <td className="p-2 text-center" colSpan={2}>الإجمالي</td>
                                        <td className="p-2 text-center font-mono text-slate-900">
                                            {stats.filteredExpenses.filter(e => e.category === 'رواتب' || e.category === 'مكافآت').reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-US')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* 3. Operational Expenses */}
                        {stats.filteredExpenses.filter(e => e.category !== 'رواتب' && e.category !== 'مكافآت' && e.category !== 'سلف' && e.category !== 'خصومات').length > 0 && (
                            <div className="break-inside-avoid">
                                <h3 className="font-bold text-sm text-slate-800 border-r-4 border-slate-800 pr-3 mb-3 uppercase tracking-wider">المصروفات التشغيلية</h3>
                                <table className="w-full text-xs text-center border-collapse border border-slate-300">
                                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-300">
                                        <tr>
                                            <th className="p-2 font-bold border-l border-slate-200">التاريخ</th>
                                            <th className="p-2 font-bold border-l border-slate-200">الفئة</th>
                                            <th className="p-2 font-bold border-l border-slate-200 w-1/2">البيان</th>
                                            <th className="p-2 font-bold">المبلغ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {stats.filteredExpenses.filter(e => e.category !== 'رواتب' && e.category !== 'مكافآت' && e.category !== 'سلف' && e.category !== 'خصومات').map((exp, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-2 font-mono text-slate-600 border-l border-slate-100">{new Date(exp.date).toLocaleDateString('en-GB')}</td>
                                                <td className="p-2 font-bold text-slate-800 border-l border-slate-100">{exp.category}</td>
                                                <td className="p-2 text-slate-600 border-l border-slate-100">{exp.description}</td>
                                                <td className="p-2 font-mono font-bold text-slate-800">{exp.amount.toLocaleString('en-US')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                    </div>


                    {/* Footer Signature */}
                    <div className="mt-20 flex justify-between items-end px-10 page-break-avoid">
                        <div className="text-center">
                            <p className="mb-6 font-bold text-sm text-slate-500 uppercase tracking-widest">المحاسب المسؤول</p>
                            <div className="w-48 border-b border-slate-300"></div>
                        </div>
                        <div className="text-center">
                            <p className="mb-6 font-bold text-sm text-slate-500 uppercase tracking-widest">اعتماد الإدارة</p>
                            <div className="w-48 border-b border-slate-300"></div>
                        </div>
                    </div>

                </div>
            )}
        </>
    );
};

export default Financials;
