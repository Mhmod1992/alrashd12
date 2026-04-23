
import React, { useState, useMemo, useEffect } from 'react';
import { 
    DollarSign, 
    TrendingUp, 
    ArrowUpRight, 
    ArrowDownRight, 
    Target, 
    PieChart as PieChartIcon, 
    Calendar,
    Filter,
    ChevronRight,
    ArrowLeft,
    Wallet,
    Receipt,
    ArrowRightLeft,
    Inbox,
    Download,
    BarChart3,
    Activity,
    Clock,
    User,
    CheckCircle2,
    X,
    Printer,
    RefreshCw,
    Banknote,
    CreditCard
} from 'lucide-react';
import { 
    AreaChart as ReChartArea, 
    Area as ReChartAreaLine, 
    XAxis as ReChartXAxis, 
    YAxis as ReChartYAxis, 
    CartesianGrid as ReChartGrid, 
    Tooltip as ReChartTooltip, 
    ResponsiveContainer, 
    PieChart as ReChartPie, 
    Pie as ReChartSlice, 
    Cell,
    LineChart as ReChartLine,
    Line as ReChartLineLine,
    Legend as ReChartLegend,
    BarChart,
    Bar
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, subDays, startOfDay, endOfDay, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAppContext } from '../context/AppContext';
import { FinancialStats, PaymentType } from '../types';
import FinancialsTable from '../components/FinancialsTable';
import ExcelPrintTable from '../components/ExcelPrintTable';
import ExpensesPrintTable from '../components/ExpensesPrintTable';
import AdvancesPrintTable from '../components/AdvancesPrintTable';
import CommissionsPrintTable from '../components/CommissionsPrintTable';
import { Skeleton } from '../components/Skeleton';
import Button from '../components/Button';
import Modal from '../components/Modal';
import CustomDatePicker from '../components/CustomDatePicker';
import { cn } from '../lib/utils';
import Icon from '../components/Icon';

// --- Helper Components ---

const KpiCard: React.FC<{
    title: string;
    value: string;
    icon: React.ReactNode;
    color: 'emerald' | 'blue' | 'amber' | 'rose' | 'indigo' | 'slate' | 'purple' | 'green';
    subValue?: string;
    onClick?: () => void;
    isHero?: boolean;
    trend?: { value: number; isUp: boolean };
}> = ({ title, value, icon, color, subValue, onClick, isHero = false, trend }) => {

    const colorClasses = {
        emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        green: 'from-green-500/10 to-green-500/5 text-green-600 dark:text-green-400 border-green-500/20',
        blue: 'from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20',
        amber: 'from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20',
        rose: 'from-rose-500/10 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20',
        indigo: 'from-indigo-500/10 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        slate: 'from-slate-500/10 to-slate-500/5 text-slate-600 dark:text-slate-400 border-slate-500/20',
        purple: 'from-purple-500/10 to-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20',
    };

    const iconBg = {
        emerald: 'bg-emerald-500/10 text-emerald-600',
        green: 'bg-green-500/10 text-green-600',
        blue: 'bg-blue-500/10 text-blue-600',
        amber: 'bg-amber-500/10 text-amber-600',
        rose: 'bg-rose-500/10 text-rose-600',
        indigo: 'bg-indigo-500/10 text-indigo-600',
        slate: 'bg-slate-500/10 text-slate-600',
        purple: 'bg-purple-500/10 text-purple-600',
    };

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.02 }}
            onClick={onClick}
            className={`
                relative overflow-hidden p-5 rounded-3xl border backdrop-blur-xl transition-all cursor-pointer
                ${isHero 
                    ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white min-h-[160px] flex flex-col justify-center' 
                    : `bg-white/70 dark:bg-slate-800/70 ${colorClasses[color]}`
                }
            `}
        >
            {/* Background Glow */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 blur-3xl opacity-20 bg-current rounded-full -z-10`} />

            <div className="flex justify-between items-start mb-3">
                <div className={`p-2.5 rounded-2xl ${isHero ? 'bg-white/10 text-white' : iconBg[color]}`}>
                    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' }) : icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${trend.isUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {trend.isUp ? '↑' : '↓'} {trend.value}%
                    </div>
                )}
            </div>

            <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isHero ? 'text-slate-400' : 'opacity-70'}`}>
                    {title}
                </p>
                <div className="flex items-baseline gap-1">
                    <h3 className={`font-black tracking-tight font-numeric ${isHero ? 'text-3xl' : 'text-2xl'}`}>
                        {value}
                    </h3>
                    <span className={`text-[10px] font-bold ${isHero ? 'text-slate-500' : 'opacity-50'}`}>ريال</span>
                </div>
                {subValue && (
                    <p className={`text-[10px] mt-2 font-medium ${isHero ? 'text-slate-400' : 'opacity-60'}`}>
                        {subValue}
                    </p>
                )}
            </div>
        </motion.div>
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
    let icon = <RefreshCw className="w-4 h-4 animate-spin" />;

    if (progress >= 100) {
        statusColor = 'from-emerald-500 to-green-400';
        textColor = 'text-emerald-600';
        message = 'تم تحقيق الهدف!';
        icon = <CheckCircle2 className="w-4 h-4" />;
    } else if (progress > 75) {
        statusColor = 'from-emerald-400 to-teal-400';
        textColor = 'text-teal-600';
        message = 'قريب جداً من الهدف';
        icon = <Icon name="sparkles" className="w-4 h-4" />;
    } else if (progress < 25 && progress > 0) {
        statusColor = 'from-orange-400 to-amber-400';
        textColor = 'text-orange-600';
        message = 'بداية المشوار';
        icon = <RefreshCw className="w-4 h-4" />;
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
        <div className="flex flex-col sm:flex-row items-center gap-8 w-full">
            <div className="relative w-40 h-40 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ReChartPie>
                        <ReChartSlice
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="label"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} className="outline-none" />
                            ))}
                        </ReChartSlice>
                    </ReChartPie>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">الإجمالي</span>
                    <span className="text-lg font-black text-slate-800 dark:text-white font-numeric">{total.toLocaleString()}</span>
                </div>
            </div>

            <div className="flex-1 w-full space-y-3">
                {data.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{item.label}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-slate-800 dark:text-white font-numeric">{item.value.toLocaleString()}</span>
                            <span className="text-[9px] text-slate-400 font-bold">ريال</span>
                        </div>
                    </div>
                ))}
                {total === 0 && <div className="text-center py-4 text-slate-400 text-xs italic">لا توجد بيانات لهذه الفترة</div>}
            </div>
        </div>
    );
};

const TrendAnalysisChart: React.FC<{ data: any[], isLoading?: boolean }> = ({ data, isLoading }) => {
    if (isLoading) return (
        <div className="h-60 flex items-center justify-center bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 animate-pulse">
            <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-xs font-bold text-slate-400">جاري تحميل البيانات...</span>
            </div>
        </div>
    );

    if (data.length === 0) return (
        <div className="h-60 flex items-center justify-center text-slate-400 font-bold text-sm bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            لا تتوفر بيانات كافية للمقارنة
        </div>
    );

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 min-w-[180px] backdrop-blur-sm bg-white/90 dark:bg-slate-800/90" dir="rtl">
                    <p className="text-xs font-black text-slate-400 mb-3 border-b border-slate-50 dark:border-slate-700 pb-2">{label}</p>
                    
                    {/* Current Period */}
                    <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-[10px] font-bold text-slate-500">الفترة الحالية</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-900 dark:text-white">{payload.find((p: any) => p.dataKey === 'currentRevenue')?.value.toLocaleString()} ريال</span>
                                <span className="text-[9px] font-bold text-slate-400">{payload.find((p: any) => p.dataKey === 'currentCount')?.value} طلبات</span>
                            </div>
                        </div>
                    </div>

                    {/* Previous Period */}
                    <div className="space-y-2 pt-2 border-t border-slate-50 dark:border-slate-700">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-slate-400 opacity-50" />
                                <span className="text-[10px] font-bold text-slate-400">الفترة السابقة</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400">{payload.find((p: any) => p.dataKey === 'previousRevenue')?.value.toLocaleString()} ريال</span>
                                <span className="text-[9px] font-bold text-slate-400">{payload.find((p: any) => p.dataKey === 'previousCount')?.value} طلبات</span>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <ReChartArea data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <ReChartGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <ReChartXAxis 
                        dataKey="label" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}}
                    />
                    <ReChartYAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}}
                    />
                    <ReChartTooltip content={<CustomTooltip />} />
                    <ReChartLegend 
                        verticalAlign="top" 
                        align="right" 
                        height={36}
                        iconType="circle"
                        formatter={(value) => <span className="text-[10px] font-bold text-slate-500 mx-2">{value === 'currentRevenue' ? 'الدخل الحالي' : 'الدخل السابق'}</span>}
                    />
                    
                    {/* Previous Period Revenue */}
                    <ReChartAreaLine
                        type="monotone"
                        dataKey="previousRevenue"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fillOpacity={1}
                        fill="url(#colorPrev)"
                        animationDuration={1500}
                    />
                    
                    {/* Current Period Revenue */}
                    <ReChartAreaLine
                        type="monotone"
                        dataKey="currentRevenue"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorCurrent)"
                        animationDuration={1500}
                    />

                    {/* Hidden lines for counts just to have them in tooltip */}
                    <ReChartAreaLine type="monotone" dataKey="currentCount" stroke="transparent" fill="transparent" />
                    <ReChartAreaLine type="monotone" dataKey="previousCount" stroke="transparent" fill="transparent" />
                </ReChartArea>
            </ResponsiveContainer>
        </div>
    );
};

// --- Main Page Component ---
const Financials: React.FC = () => {
    const { 
        fetchServerFinancials, 
        clients, 
        cars,
        carMakes,
        carModels,
        addNotification,
        financialReport: stats,
        setFinancialReport: setStats,
        can,
        settings,
        brokers
    } = useAppContext();

    const [filterType, setFilterType] = useState<'today' | 'yesterday' | 'month' | 'last_month' | 'range'>('today');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [calculationMode, setCalculationMode] = useState<'all' | 'completed'>('all');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentType | 'all' | 'unpaid'>('all');
    
    // Trend stats
    const [prevStats, setPrevStats] = useState<FinancialStats | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const now = new Date();
            let currentStart = startOfMonth(now);
            let currentEnd = endOfMonth(now);
            let prevStart = startOfMonth(subDays(currentStart, 1));
            let prevEnd = endOfMonth(subDays(currentStart, 1));

            switch (filterType) {
                case 'today': 
                    currentStart = startOfDay(now); currentEnd = endOfDay(now);
                    prevStart = startOfDay(subDays(currentStart, 1)); prevEnd = endOfDay(subDays(currentStart, 1));
                    break;
                case 'yesterday': 
                    currentStart = startOfDay(subDays(now, 1)); currentEnd = endOfDay(subDays(now, 1));
                    prevStart = startOfDay(subDays(currentStart, 1)); prevEnd = endOfDay(subDays(currentStart, 1));
                    break;
                case 'month': 
                    currentStart = startOfMonth(now); currentEnd = endOfMonth(now);
                    prevStart = startOfMonth(subDays(currentStart, 1)); prevEnd = endOfMonth(subDays(currentStart, 1));
                    break;
                case 'last_month': 
                    currentStart = startOfMonth(subDays(startOfMonth(now), 1)); currentEnd = endOfMonth(currentStart);
                    prevStart = startOfMonth(subDays(currentStart, 1)); prevEnd = endOfMonth(subDays(currentStart, 1));
                    break;
                case 'range':
                    if (customStartDate && customEndDate) {
                        currentStart = startOfDay(new Date(customStartDate));
                        currentEnd = endOfDay(new Date(customEndDate));
                        const diff = currentEnd.getTime() - currentStart.getTime();
                        prevEnd = new Date(currentStart.getTime() - 1);
                        prevStart = new Date(prevEnd.getTime() - diff);
                    }
                    break;
            }

            const includeCompletedOnly = calculationMode === 'completed';
            
            const [currentData, previousData] = await Promise.all([
                fetchServerFinancials(currentStart.toISOString(), currentEnd.toISOString(), includeCompletedOnly),
                fetchServerFinancials(prevStart.toISOString(), prevEnd.toISOString(), includeCompletedOnly)
            ]);
            
            setStats(currentData);
            setPrevStats(previousData);

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

    const trends = useMemo(() => {
        if (!stats || !prevStats) return { total: { value: 0, isUp: true }, expenses: { value: 0, isUp: false }, net: { value: 0, isUp: true } };
        
        const calcTrend = (curr: number, prev: number) => {
            if (prev === 0) return { value: curr > 0 ? 100 : 0, isUp: true };
            const val = ((curr - prev) / prev) * 100;
            return { value: Math.abs(Math.round(val)), isUp: val >= 0 };
        };

        return {
            total: calcTrend(stats.grandTotal, prevStats.grandTotal),
            expenses: calcTrend(stats.totalExpenses, prevStats.totalExpenses),
            net: calcTrend(
                stats.grandTotal - stats.totalExpenses - stats.totalCommissions, 
                prevStats.grandTotal - prevStats.totalExpenses - prevStats.totalCommissions
            )
        };
    }, [stats, prevStats]);

    const targetData = useMemo(() => {
        const DAILY_TARGET = 5000;
        let daysInFilter = 1;
        let periodLabel = 'اليوم';

        if (filterType === 'month' || filterType === 'last_month') {
            daysInFilter = 30; periodLabel = 'الشهر';
        } else if (filterType === 'range' && customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            const end = new Date(customEndDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            daysInFilter = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            periodLabel = 'الفترة';
        } else if (filterType === 'yesterday') {
            periodLabel = 'أمس';
        }

        const target = DAILY_TARGET * daysInFilter;
        const previous = prevStats?.grandTotal || (target * 0.65);

        return { target, previous, periodLabel };
    }, [filterType, customStartDate, customEndDate, prevStats]);

    const chartData = useMemo(() => {
        if (!stats || !prevStats) return { comparisonSeries: [] };
        
        let series: { label: string, currentRevenue: number, currentCount: number, previousRevenue: number, previousCount: number }[] = [];

        if (filterType === 'today' || filterType === 'yesterday') {
            // Group by hour - Start from 7 AM as per working hours
            for (let i = 7; i <= 23; i++) {
                const hour = i % 12 || 12;
                const ampm = i < 12 ? 'AM' : 'PM';
                const hourLabel = `${hour}${ampm}`;
                
                const currentHourReqs = stats.filteredRequests.filter(r => {
                    const date = new Date(r.created_at);
                    if (i === 7) return date.getHours() === 7 && date.getMinutes() >= 30;
                    return date.getHours() === i;
                });
                
                const prevHourReqs = prevStats.filteredRequests.filter(r => {
                    const date = new Date(r.created_at);
                    if (i === 7) return date.getHours() === 7 && date.getMinutes() >= 30;
                    return date.getHours() === i;
                });
                
                series.push({ 
                    label: hourLabel, 
                    currentRevenue: currentHourReqs.reduce((sum, r) => sum + r.price, 0),
                    currentCount: currentHourReqs.length,
                    previousRevenue: prevHourReqs.reduce((sum, r) => sum + r.price, 0),
                    previousCount: prevHourReqs.length
                });
            }
        } else if (filterType === 'month' || filterType === 'last_month') {
            // Group by day of month
            for (let i = 1; i <= 31; i++) {
                const dayLabel = `${i}`;
                const currentDayReqs = stats.filteredRequests.filter(r => new Date(r.created_at).getDate() === i);
                const prevDayReqs = prevStats.filteredRequests.filter(r => new Date(r.created_at).getDate() === i);
                
                series.push({ 
                    label: dayLabel, 
                    currentRevenue: currentDayReqs.reduce((sum, r) => sum + r.price, 0),
                    currentCount: currentDayReqs.length,
                    previousRevenue: prevDayReqs.reduce((sum, r) => sum + r.price, 0),
                    previousCount: prevDayReqs.length
                });
            }
        } else if (filterType === 'range' && customStartDate && customEndDate) {
            const currentInterval = eachDayOfInterval({ 
                start: startOfDay(new Date(customStartDate)), 
                end: endOfDay(new Date(customEndDate)) 
            });
            
            // Build map of dates for current
            const currentMap = stats.filteredRequests.reduce((acc, req) => {
                const d = format(new Date(req.created_at), 'yyyy-MM-dd');
                if (!acc[d]) acc[d] = { revenue: 0, count: 0 };
                acc[d].revenue += req.price;
                acc[d].count += 1;
                return acc;
            }, {} as Record<string, { revenue: number, count: number }>);

            // Grouping prev stats is harder to align perfectly by date, so we'll index align
            const prevGrouped: { revenue: number, count: number }[] = [];
            const prevDates = Array.from(new Set(prevStats.filteredRequests.map(r => format(new Date(r.created_at), 'yyyy-MM-dd')))).sort();
            prevDates.forEach(d => {
                const dayReqs = prevStats.filteredRequests.filter(r => format(new Date(r.created_at), 'yyyy-MM-dd') === d);
                prevGrouped.push({
                    revenue: dayReqs.reduce((sum, r) => sum + r.price, 0),
                    count: dayReqs.length
                });
            });

            currentInterval.forEach((date, index) => {
                const label = format(date, 'd MMM', { locale: ar });
                const dateStr = format(date, 'yyyy-MM-dd');
                const curr = currentMap[dateStr] || { revenue: 0, count: 0 };
                const prev = prevGrouped[index] || { revenue: 0, count: 0 };
                
                series.push({ 
                    label, 
                    currentRevenue: curr.revenue,
                    currentCount: curr.count,
                    previousRevenue: prev.revenue,
                    previousCount: prev.count
                });
            });
        } else {
            series = [
                { label: 'البداية', currentRevenue: 0, currentCount: 0, previousRevenue: 0, previousCount: 0 },
                { label: 'النهاية', currentRevenue: stats.grandTotal, currentCount: stats.filteredRequests.length, previousRevenue: prevStats.grandTotal, previousCount: prevStats.filteredRequests.length }
            ];
        }

        return { comparisonSeries: series };
    }, [stats, prevStats, filterType, customStartDate, customEndDate]);

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

    // Helper to format extraction date as "2026 / 4 / 22 الأربعاء"
    const getFormattedExtractionDate = () => {
        const d = new Date();
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayName = days[d.getDay()];
        return `${d.getFullYear()} / ${d.getMonth() + 1} / ${d.getDate()} ${dayName}`;
    };

    const getPrintPeriodLabel = () => {
        if (filterType === 'today') {
            const d = new Date();
            const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const dayName = days[d.getDay()];
            return `${d.getFullYear()} / ${d.getMonth() + 1} / ${d.getDate()} ${dayName}`;
        }
        if (filterType === 'yesterday') {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const dayName = days[d.getDay()];
            return `${d.getFullYear()} / ${d.getMonth() + 1} / ${d.getDate()} ${dayName}`;
        }
        return getFilterLabel();
    };

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
                const transferRevenues = stats.filteredRevenues.filter(r => r.payment_method === PaymentType.Transfer);
                return (
                    <div className="space-y-6">
                        <div>
                            <ModalHeaderSummary title="إجمالي التحويلات" amount={stats.transferTotal.toLocaleString('en-US')} colorClass="text-amber-600" />
                            <h4 className="text-sm font-bold text-slate-500 mb-3 px-1 uppercase tracking-wider">طلبات الفحص (تحويل)</h4>
                            <div className="overflow-x-auto border rounded-lg dark:border-slate-700 mb-6">
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
                                        {transfers.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">لا توجد تحويلات في الطلبات</td></tr>}
                                    </tbody>
                                </table>
                            </div>

                            {transferRevenues.length > 0 && (
                                <>
                                    <h4 className="text-sm font-bold text-slate-500 mb-3 px-1 uppercase tracking-wider">إيرادات أخرى (تحويل)</h4>
                                    <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                                        <table className="w-full text-sm text-right">
                                            <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-bold text-gray-500 uppercase"><tr><th className="px-4 py-3 border-b dark:border-slate-600">التاريخ</th><th className="px-4 py-3 border-b dark:border-slate-600">الفئة</th><th className="px-4 py-3 border-b dark:border-slate-600">الوصف</th><th className="px-4 py-3 border-b dark:border-slate-600">المبلغ</th></tr></thead>
                                            <tbody className="divide-y dark:divide-slate-600 bg-white dark:bg-slate-800">
                                                {transferRevenues.map(rev => (
                                                    <tr key={rev.id}>
                                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-numeric">{new Date(rev.date).toLocaleDateString('en-GB')}</td>
                                                        <td className="px-4 py-3"><span className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-xs font-bold text-green-700 dark:text-green-200">{rev.category}</span></td>
                                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{rev.description}</td>
                                                        <td className="px-4 py-3 font-bold text-green-600 font-numeric">{rev.amount.toLocaleString('en-US')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            case 'card':
                const cards = stats.filteredRequests.filter(r => r.payment_type === PaymentType.Card || (r.payment_type === PaymentType.Split && r.split_payment_details?.card));
                const cardRevenues = stats.filteredRevenues.filter(r => r.payment_method === PaymentType.Card);
                return (
                    <div className="space-y-6">
                        <div>
                            <ModalHeaderSummary title="إجمالي الشبكة" amount={stats.cardTotal.toLocaleString('en-US')} colorClass="text-blue-600" />
                            <h4 className="text-sm font-bold text-slate-500 mb-3 px-1 uppercase tracking-wider">طلبات الفحص (شبكة)</h4>
                            <div className="overflow-x-auto border rounded-lg dark:border-slate-700 mb-6">
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
                                        {cards.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">لا توجد عمليات شبكة في الطلبات</td></tr>}
                                    </tbody>
                                </table>
                            </div>

                            {cardRevenues.length > 0 && (
                                <>
                                    <h4 className="text-sm font-bold text-slate-500 mb-3 px-1 uppercase tracking-wider">إيرادات أخرى (شبكة)</h4>
                                    <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                                        <table className="w-full text-sm text-right">
                                            <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-bold text-gray-500 uppercase"><tr><th className="px-4 py-3 border-b dark:border-slate-600">التاريخ</th><th className="px-4 py-3 border-b dark:border-slate-600">الفئة</th><th className="px-4 py-3 border-b dark:border-slate-600">الوصف</th><th className="px-4 py-3 border-b dark:border-slate-600">المبلغ</th></tr></thead>
                                            <tbody className="divide-y dark:divide-slate-600 bg-white dark:bg-slate-800">
                                                {cardRevenues.map(rev => (
                                                    <tr key={rev.id}>
                                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-numeric">{new Date(rev.date).toLocaleDateString('en-GB')}</td>
                                                        <td className="px-4 py-3"><span className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-xs font-bold text-green-700 dark:text-green-200">{rev.category}</span></td>
                                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{rev.description}</td>
                                                        <td className="px-4 py-3 font-bold text-green-600 font-numeric">{rev.amount.toLocaleString('en-US')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            case 'cash':
                const cashReqs = stats.filteredRequests.filter(r => r.payment_type === PaymentType.Cash || (r.payment_type === PaymentType.Split && r.split_payment_details?.cash));
                const cashRevenues = stats.filteredRevenues.filter(r => r.payment_method === PaymentType.Cash);
                return (
                    <div className="space-y-6">
                        <div>
                            <ModalHeaderSummary title="إجمالي النقد (المقبوض)" amount={stats.cashTotal.toLocaleString('en-US')} colorClass="text-emerald-600" />
                            <h4 className="text-sm font-bold text-slate-500 mb-3 px-1 uppercase tracking-wider">طلبات الفحص (نقدي)</h4>
                            <div className="overflow-x-auto border rounded-lg dark:border-slate-700 mb-6">
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
                                        {cashReqs.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-400">لا توجد عمليات نقدية في الطلبات</td></tr>}
                                    </tbody>
                                </table>
                            </div>

                            {cashRevenues.length > 0 && (
                                <>
                                    <h4 className="text-sm font-bold text-slate-500 mb-3 px-1 uppercase tracking-wider">إيرادات أخرى (نقدي)</h4>
                                    <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                                        <table className="w-full text-sm text-right">
                                            <thead className="bg-gray-50 dark:bg-slate-700 text-xs font-bold text-gray-500 uppercase"><tr><th className="px-4 py-3 border-b dark:border-slate-600">التاريخ</th><th className="px-4 py-3 border-b dark:border-slate-600">الفئة</th><th className="px-4 py-3 border-b dark:border-slate-600">الوصف</th><th className="px-4 py-3 border-b dark:border-slate-600">المبلغ</th></tr></thead>
                                            <tbody className="divide-y dark:divide-slate-600 bg-white dark:bg-slate-800">
                                                {cashRevenues.map(rev => (
                                                    <tr key={rev.id}>
                                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-numeric">{new Date(rev.date).toLocaleDateString('en-GB')}</td>
                                                        <td className="px-4 py-3"><span className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-xs font-bold text-green-700 dark:text-green-200">{rev.category}</span></td>
                                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{rev.description}</td>
                                                        <td className="px-4 py-3 font-bold text-green-600 font-numeric">{rev.amount.toLocaleString('en-US')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
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

                        <div className="mt-8 space-y-4">
                            <h4 className="text-sm font-bold text-slate-500 border-b pb-2">تفصيل العمليات النقدية الواردة</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {[
                                    ...stats.filteredRequests
                                        .filter(r => r.payment_type === PaymentType.Cash || (r.payment_type === PaymentType.Split && (r.split_payment_details?.cash || 0) > 0))
                                        .map(r => ({
                                            id: r.id,
                                            label: `طلب رقم #${r.request_number}`,
                                            amount: r.payment_type === PaymentType.Split ? (r.split_payment_details?.cash || 0) : r.price,
                                            date: r.created_at
                                        })),
                                    ...stats.filteredRevenues
                                        .filter(rev => rev.payment_method === PaymentType.Cash)
                                        .map(rev => ({
                                            id: rev.id,
                                            label: `إيراد: ${rev.category}`,
                                            amount: rev.amount,
                                            date: rev.date
                                        }))
                                ]
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-xs py-2 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-600 dark:text-slate-400 font-medium">{item.label}</span>
                                        <span className="font-bold text-slate-900 dark:text-white font-numeric">{item.amount.toLocaleString()} ريال</span>
                                    </div>
                                ))}
                                {stats.cashTotal === 0 && <div className="text-center py-4 text-slate-400 text-xs">لا توجد عمليات نقدية واردة</div>}
                            </div>
                        </div>
                    </div>
                );
            default: return null;
        }
    }

    if (!can('view_financials')) return <div className="p-8 text-center text-red-500">ليس لديك صلاحية.</div>;

    if (!stats && isLoading) return (
        <div className="container mx-auto p-8 space-y-8 animate-pulse">
            <div className="h-10 bg-slate-200 dark:bg-slate-700 w-1/4 rounded-lg mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-3xl" />)}
            </div>
            <div className="h-80 bg-slate-200 dark:bg-slate-700 rounded-3xl" />
        </div>
    );

    return (
        <div className="container mx-auto space-y-8 pb-24 print-container print:p-0 print:pb-0 print:m-0 print:w-full print:max-w-none print:space-y-6">
            
            {/* --- OFFICIAL PRINT HEADER (VISIBLE ONLY ON PRINT) --- */}
            <div className="hidden print:block border-b-2 border-slate-900 pb-6 mb-8 mt-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-black text-slate-900">{settings.appName || 'مركز فحص السيارات'}</h1>
                        <p className="text-sm font-bold text-slate-600">تقرير الأداء المالي والعمليات النقدي</p>
                        <div className="flex flex-col gap-1 mt-4 text-xs font-bold text-slate-500">
                            <span className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded shadow-sm inline-block print:border print:border-yellow-200">تاريخ الاستخراج: {getFormattedExtractionDate()}</span>
                            <span>الفترة: {getPrintPeriodLabel()}</span>
                        </div>
                    </div>
                    {settings.logoUrl && (
                        <div className="w-24 h-24">
                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                    )}
                </div>
            </div>

            {/* --- PRINT SUMMARY TABLE (VISIBLE ONLY ON PRINT) --- */}
            <div className="hidden print:block mb-10">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="grid grid-cols-6 divide-x divide-x-reverse divide-slate-200 text-center">
                        <div className="p-3 space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase">إجمالي الإيرادات</span>
                            <p className="text-lg font-black text-slate-900 font-numeric">{stats?.grandTotal.toLocaleString()} ريال</p>
                        </div>
                        <div className="p-3 space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase">إيرادات أخرى</span>
                            <p className="text-lg font-bold text-green-600 font-numeric">{stats?.totalOtherRevenue.toLocaleString()} ريال</p>
                        </div>
                        <div className="p-3 space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase">غير مدفوع</span>
                            <p className="text-lg font-bold text-rose-500 font-numeric">{stats?.unpaidTotal.toLocaleString()} ريال</p>
                        </div>
                        <div className="p-3 space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase">المصروفات</span>
                            <p className="text-lg font-bold text-rose-600 font-numeric">{stats?.totalExpenses.toLocaleString()} ريال</p>
                        </div>
                        <div className="p-3 space-y-1 border-r-0">
                            <span className="text-[9px] font-black text-slate-400 uppercase">العمولات</span>
                            <p className="text-lg font-bold text-purple-600 font-numeric">{stats?.totalCommissions.toLocaleString()} ريال</p>
                        </div>
                        <div className="p-3 space-y-1 bg-white border-r-2 border-slate-900">
                            <span className="text-[9px] font-black text-slate-900 uppercase">صافي الربح</span>
                            <p className="text-xl font-black text-emerald-600 font-numeric">{(stats ? stats.grandTotal - stats.totalExpenses - stats.totalCommissions : 0).toLocaleString()} ريال</p>
                        </div>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="border border-dashed border-slate-300 p-3 rounded-xl flex justify-between items-center">
                        <span className="text-xs font-black text-slate-500">إجمالي النقد</span>
                        <span className="text-sm font-black font-numeric text-slate-900">{stats?.cashTotal.toLocaleString()} ر.س</span>
                    </div>
                    <div className="border border-dashed border-slate-300 p-3 rounded-xl flex justify-between items-center">
                        <span className="text-xs font-black text-slate-500">إجمالي الشبكة</span>
                        <span className="text-sm font-black font-numeric text-slate-900">{stats?.cardTotal.toLocaleString()} ر.س</span>
                    </div>
                    <div className="border border-dashed border-slate-300 p-3 rounded-xl flex justify-between items-center">
                        <span className="text-xs font-black text-slate-500">إجمالي التحويل</span>
                        <span className="text-sm font-black font-numeric text-slate-900">{stats?.transferTotal.toLocaleString()} ر.س</span>
                    </div>
                </div>
            </div>

            {/* --- TOP HEADER & FILTERS --- */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:hidden">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-900 dark:bg-white rounded-2xl text-white dark:text-slate-900 shadow-xl">
                            <Activity className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">التقارير المالية</h1>
                    </div>
                    <p className="text-slate-500 font-medium mr-12">تحليل شامل للأداء المالي والتدفقات النقدية</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
                        <button onClick={() => setCalculationMode('all')} className={cn("px-4 py-2 rounded-xl text-xs font-black transition-all", calculationMode === 'all' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}>الكل</button>
                        <button onClick={() => setCalculationMode('completed')} className={cn("px-4 py-2 rounded-xl text-xs font-black transition-all", calculationMode === 'completed' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}>المكتملة</button>
                    </div>
                    
                    <div className="h-10 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden lg:block" />

                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handlePrint} className="rounded-2xl h-11 px-5 border-slate-200" leftIcon={<Printer className="w-4 h-4" />}>طباعة</Button>
                        <Button variant="secondary" onClick={loadData} className="rounded-2xl h-11 px-5 border-slate-200" leftIcon={<RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />}>تحديث</Button>
                    </div>
                </div>
            </div>

            {/* --- FILTERS RAILS --- */}
            <div className="flex flex-col lg:flex-row gap-4 print:hidden">
                <div className="flex-1 overflow-x-auto pb-2 scrollbar-hide">
                    <div className="flex items-center gap-2 min-w-max p-1 bg-slate-100/30 dark:bg-slate-800/20 rounded-[22px]">
                        {(['today', 'yesterday', 'month', 'last_month', 'range'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={cn(
                                    "px-6 py-2.5 rounded-2xl text-xs font-black transition-all duration-300",
                                    filterType === type ? activeFilterClass : inactiveFilterClass
                                )}
                            >
                                {type === 'today' && 'اليوم'}
                                {type === 'yesterday' && 'أمس'}
                                {type === 'month' && 'هذا الشهر'}
                                {type === 'last_month' && 'الشهر الماضي'}
                                {type === 'range' && 'نطاق مخصص'}
                            </button>
                        ))}
                    </div>
                </div>

                <AnimatePresence>
                    {filterType === 'range' && (
                        <motion.div 
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-3xl border dark:border-slate-700 shadow-sm"
                        >
                            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                            <CustomDatePicker 
                                value={customStartDate} 
                                onChange={setCustomStartDate} 
                                placeholder="من"
                                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-none text-xs font-bold w-32" 
                            />
                            <div className="w-2 h-px bg-slate-300" />
                            <CustomDatePicker 
                                value={customEndDate} 
                                onChange={setCustomEndDate} 
                                placeholder="إلى"
                                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-none text-xs font-bold w-32" 
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* --- BENTO GRID STATS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6 items-stretch print:hidden">
                {/* Hero Stats */}
                <div className="xl:col-span-3 space-y-6">
                    <KpiCard 
                        title="إجمالي الدخل" 
                        value={stats?.grandTotal.toLocaleString() || '0'} 
                        icon={<TrendingUp />} 
                        color="indigo" 
                        isHero
                        trend={trends.total}
                    />
                    <KpiCard 
                        title="صافي الربح" 
                        value={(stats ? stats.grandTotal - stats.totalExpenses - stats.totalCommissions : 0).toLocaleString()} 
                        icon={<DollarSign />} 
                        color="emerald" 
                        trend={trends.net}
                        subValue="بعد خصم المصروفات والعمولات"
                    />
                </div>

                {/* Main Visualization Center */}
                <div className="xl:col-span-6 bg-white/50 dark:bg-slate-800/30 rounded-[40px] border border-slate-200 dark:border-slate-700 p-8 flex flex-col relative overflow-hidden backdrop-blur-md print:hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">تحليل الإيرادات وحجم العمل</h3>
                            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">مقارنة الدخل وعدد الطلبات الحالية بما قبلها</p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-xl">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-500">{getFilterLabel()}</span>
                        </div>
                    </div>
                    
                    <TrendAnalysisChart data={chartData.comparisonSeries} isLoading={isLoading} />
                </div>

                {/* Secondary Stats Column */}
                <div className="xl:col-span-3 grid grid-cols-1 gap-6">
                    <KpiCard 
                        title="المصروفات التشغيلية" 
                        value={stats?.totalExpenses.toLocaleString() || '0'} 
                        icon={<Receipt />} 
                        color="rose" 
                        trend={trends.expenses}
                        onClick={() => setActiveModal('expenses')}
                    />
                    <div className="bg-white/50 dark:bg-slate-800/30 rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-between group cursor-pointer hover:shadow-xl transition-all" onClick={() => setActiveModal('drawer')}>
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-amber-500/10 rounded-2xl">
                                <Wallet className="w-6 h-6 text-amber-600" />
                            </div>
                            <ArrowRightLeft className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </div>
                        <div className="mt-4">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">صافي النقد (في الدرج)</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-slate-900 dark:text-white font-numeric tracking-tighter">
                                    {cashInDrawer.toLocaleString()}
                                </span>
                                <span className="text-xs font-bold text-slate-400">ريال</span>
                            </div>
                            <div className="mt-3 flex items-center gap-1">
                                <div className="h-1 flex-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 w-[70%]" />
                                </div>
                                <span className="text-[10px] font-black text-amber-600">آمن</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- SECONDARY BENTO ROW --- */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 print:hidden">
                {/* Target Progress Card */}
                <div className="xl:col-span-4 bg-white/50 dark:bg-slate-800/30 rounded-[40px] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <TargetProgressStrip 
                        current={stats?.grandTotal || 0} 
                        target={targetData.target} 
                        previous={targetData.previous} 
                        periodLabel={targetData.periodLabel}
                    />
                </div>

                {/* Growth Analysis Card */}
                <div className="xl:col-span-5 bg-white/50 dark:bg-slate-800/30 rounded-[40px] border border-slate-200 dark:border-slate-700 p-8 flex flex-col print:hidden">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black text-slate-800 dark:text-white">طرق الدفع</h3>
                        <PieChartIcon className="w-5 h-5 text-slate-400" />
                    </div>
                    
                    <DonutChart 
                        data={[
                            { label: 'نقدي', value: stats?.cashTotal || 0, color: '#10b981' },
                            { label: 'شبكة', value: stats?.cardTotal || 0, color: '#3b82f6' },
                            { label: 'تحويل', value: stats?.transferTotal || 0, color: '#f59e0b' },
                        ]} 
                    />
                </div>

                {/* Quick Shortcuts / Extras */}
                <div className="xl:col-span-3 grid grid-cols-2 gap-4">
                    <div onClick={() => setActiveModal('commissions')} className="bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/10 rounded-[30px] p-6 flex flex-col items-center justify-center text-center group cursor-pointer transition-all">
                        <div className="p-3 bg-purple-500/10 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                            <User className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-purple-800/60 dark:text-purple-400 mb-1">العمولات</span>
                        <span className="text-xl font-black text-purple-700 dark:text-purple-300 font-numeric leading-none">{stats?.totalCommissions.toLocaleString() || '0'}</span>
                    </div>
                    <div onClick={() => setActiveModal('revenues')} className="bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 rounded-[30px] p-6 flex flex-col items-center justify-center text-center group cursor-pointer transition-all">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                            <Inbox className="w-6 h-6 text-emerald-600" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-emerald-800/60 dark:text-emerald-400 mb-1">إيرادات أخرى</span>
                        <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-numeric leading-none">{stats?.totalOtherRevenue.toLocaleString() || '0'}</span>
                    </div>
                    <div onClick={() => setActiveModal('transfers')} className="bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 rounded-[30px] p-6 flex flex-col items-center justify-center text-center group cursor-pointer transition-all">
                        <div className="p-3 bg-amber-500/10 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                            <ArrowRightLeft className="w-6 h-6 text-amber-600" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-amber-800/60 dark:text-amber-400 mb-1">التحويلات</span>
                        <span className="text-xl font-black text-amber-700 dark:text-amber-300 font-numeric leading-none">{stats?.transferTotal.toLocaleString() || '0'}</span>
                    </div>
                    <div className="bg-slate-500/5 hover:bg-slate-500/10 border border-slate-500/10 rounded-[30px] p-6 flex flex-col items-center justify-center text-center group cursor-pointer transition-all" onClick={handlePrint}>
                        <div className="p-3 bg-slate-500/10 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                            <Download className="w-6 h-6 text-slate-600" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-slate-800/60 dark:text-slate-400 mb-1">تصدير</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">PDF / Print</span>
                    </div>
                </div>
            </div>

            {/* --- TRANSACTIONS SECTION --- */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-[40px] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm print:bg-white print:border-[0.5px] print:border-slate-900 print:rounded-3xl print:shadow-none print:overflow-visible">
                <div className="p-8 border-b dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-6 print:py-4 print:px-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white print:text-lg">جدول العمليات التفصيلي</h3>
                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest print:hidden">عرض وتصفية جميع طلبات الفحص للفترة المختارة</p>
                    </div>

                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl print:hidden">
                        {(['all', PaymentType.Cash, PaymentType.Card, PaymentType.Transfer, 'unpaid'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setPaymentStatusFilter(p)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase",
                                    paymentStatusFilter === p ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {p === 'all' && 'الكل'}
                                {p === PaymentType.Cash && 'نقدي'}
                                {p === PaymentType.Card && 'شبكة'}
                                {p === PaymentType.Transfer && 'تحويل'}
                                {p === 'unpaid' && 'غير مدفوع'}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="p-2">
                    {stats ? (
                        <>
                            <div className="print:hidden">
                                <FinancialsTable 
                                    requests={displayedRequests} 
                                    clients={clients}
                                    cars={cars}
                                    carMakes={carMakes}
                                    carModels={carModels}
                                />
                            </div>
                            {(filterType === 'today' || filterType === 'yesterday') && (
                                <ExcelPrintTable 
                                    requests={displayedRequests} 
                                    clients={clients}
                                    cars={cars}
                                    carMakes={carMakes}
                                    carModels={carModels}
                                />
                            )}
                            {stats?.filteredExpenses && stats.filteredExpenses.length > 0 && (
                                <ExpensesPrintTable expenses={stats.filteredExpenses} />
                            )}
                            {stats?.filteredAdvances && stats.filteredAdvances.length > 0 && (
                                <AdvancesPrintTable advances={stats.filteredAdvances} />
                            )}
                            {stats?.filteredRequests && stats.filteredRequests.some(r => r.broker && (r.broker.commission || 0) > 0) && (
                                <CommissionsPrintTable requests={stats.filteredRequests} brokers={brokers} />
                            )}
                        </>
                    ) : (
                        <div className="h-60 flex items-center justify-center">
                            <Skeleton className="w-full h-full rounded-2xl" />
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={!!activeModal} onClose={() => setActiveModal(null)} title={getModalTitle()} size="xl">
                {getModalContent()}
            </Modal>
        </div>
    );
};

export default Financials;


