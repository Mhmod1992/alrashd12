import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { FinancialStats, RequestStatus, InspectionRequest } from '../types';
import { 
    PieChart, Pie, Cell, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart as ReLineChart, Line, AreaChart, Area
} from 'recharts';
import { 
    Star, Car, TrendingUp, Users, 
    Briefcase, Plus, CreditCard, FileText, 
    RefreshCw, DollarSign, MessageSquare,
    Award, CheckCircle2, Clock
} from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { cn } from '../lib/utils';

// --- Quick Actions Component ---
const QuickActions: React.FC = () => {
    const { setPage, setInitialRequestModalState } = useAppContext();

    const actions = [
        { 
            label: 'طلب جديد', 
            icon: <Plus className="w-5 h-5" />, 
            color: 'bg-blue-600 text-white', 
            action: () => { setInitialRequestModalState('new'); setPage('requests'); } 
        },
        { 
            label: 'العملاء', 
            icon: <Users className="w-5 h-5" />, 
            color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300', 
            action: () => setPage('clients') 
        },
        { 
            label: 'المصروفات', 
            icon: <CreditCard className="w-5 h-5" />, 
            color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300', 
            action: () => setPage('expenses') 
        },
        { 
            label: 'الطلبات', 
            icon: <FileText className="w-5 h-5" />, 
            color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300', 
            action: () => setPage('requests') 
        },
    ];

    return (
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
            {actions.map((btn, idx) => (
                <button
                    key={idx}
                    onClick={btn.action}
                    className="flex flex-col items-center justify-center p-2 sm:p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all active:scale-95"
                >
                    <div className={`p-1.5 sm:p-2.5 rounded-full mb-1 sm:mb-2 ${btn.color} shadow-sm`}>
                        {React.cloneElement(btn.icon as React.ReactElement<{ className?: string }>, { className: 'w-4 h-4 sm:w-5 sm:h-5' })}
                    </div>
                    <span className="text-[9px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{btn.label}</span>
                </button>
            ))}
        </div>
    );
};

// --- Period Toggle ---
const PeriodToggle: React.FC<{ 
    activePeriod: 'today' | 'week' | 'month' | 'year'; 
    onChange: (p: 'today' | 'week' | 'month' | 'year') => void;
    isLoading: boolean;
}> = ({ activePeriod, onChange, isLoading }) => {
    const periods = [
        { id: 'today', label: 'يومي' },
        { id: 'week', label: 'أسبوعي' },
        { id: 'month', label: 'شهري' },
    ];

    return (
        <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
            {periods.map((p) => (
                <button
                    key={p.id}
                    onClick={() => !isLoading && onChange(p.id as any)}
                    className={`
                        px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all
                        ${activePeriod === p.id 
                            ? 'bg-white dark:bg-slate-500 text-slate-800 dark:text-white shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}
                    `}
                >
                    {p.label}
                </button>
            ))}
        </div>
    );
};

// --- Compact KPI Card ---
const ExecutiveKpiCard: React.FC<{
    title: string;
    value: string;
    trend?: number;
    icon: React.ReactNode;
    colorClass: string; // Tailwind text color class
    bgClass: string; // Tailwind bg color class
    isLoading?: boolean;
}> = ({ title, value, trend, icon, colorClass, bgClass, isLoading }) => {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between h-full relative overflow-hidden group hover:border-blue-200 transition-colors">
            
            {/* Decor Circle */}
            <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-10 ${bgClass} group-hover:scale-150 transition-transform duration-500`}></div>

            <div className="flex justify-between items-start mb-2 relative z-10">
                <div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}>
                    {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' })}
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-0.5 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-500'} bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded`}>
                        <span>{Math.abs(trend)}%</span>
                        <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
                    </div>
                )}
            </div>
            
            <div className="relative z-10">
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{title}</p>
                {isLoading ? (
                    <div className="h-6 w-20 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                    <h3 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white font-numeric tracking-tight">{value}</h3>
                )}
            </div>
        </div>
    );
};

const EmployeeLeaderboard: React.FC<{ data: { name: string; revenue: number; role: string; count: number }[], isLoading: boolean }> = ({ data, isLoading }) => {
    if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    الأفضل أداءً
                </h4>
            </div>
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                {data.length > 0 ? (
                    <div className="space-y-4">
                        {data.map((emp, idx) => (
                            <div key={idx} className="group">
                                <div className="flex justify-between text-xs mb-1.5 font-bold">
                                    <span className="text-slate-700 dark:text-slate-200">{idx + 1}. {emp.name}</span>
                                    <span className="text-slate-600 dark:text-slate-400 font-numeric">{emp.revenue.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-blue-500 h-full rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${(emp.revenue / maxRevenue) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">لا توجد بيانات.</div>
                )}
            </div>
        </div>
    );
};

const RecentTransactions: React.FC<{ transactions: any[], isLoading: boolean }> = ({ transactions, isLoading }) => {
    if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden h-full flex flex-col">
             <div className="p-4 border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    أحدث العمليات
                </h4>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {transactions.length > 0 ? (
                    <div className="divide-y dark:divide-slate-700/50">
                        {transactions.map((tx, idx) => (
                            <div key={idx} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg transition-colors flex justify-between items-center">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                        {tx.type === 'income' ? <DollarSign className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{tx.description}</p>
                                        <p className="text-[10px] text-slate-400">{new Date(tx.date).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</p>
                                    </div>
                                </div>
                                <span className={`text-xs font-black font-numeric whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">لا توجد عمليات.</div>
                )}
            </div>
        </div>
    );
};

// --- Car Make Analysis ---
const CarMakeAnalysis: React.FC<{ requests: InspectionRequest[], carMakes: any[], isLoading: boolean }> = ({ requests, carMakes, isLoading }) => {
    const data = useMemo(() => {
        const counts: Record<string, number> = {};
        requests.forEach(req => {
            const make = carMakes.find(m => m.id === req.car_make_id);
            const name = make ? make.name_ar : 'أخرى';
            counts[name] = (counts[name] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [requests, carMakes]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 h-full flex flex-col">
            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-500" />
                تحليل أنواع السيارات (الأكثر فحصاً)
            </h4>
            <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// --- Technician Performance ---
const TechnicianPerformance: React.FC<{ requests: InspectionRequest[], employees: any[], isLoading: boolean }> = ({ requests, employees, isLoading }) => {
    const data = useMemo(() => {
        const stats: Record<string, { name: string, completed: number, avgTime: number, totalTime: number }> = {};
        
        requests.forEach(req => {
            if (req.employee_id && req.status === RequestStatus.COMPLETE) {
                const emp = employees.find(e => e.id === req.employee_id);
                if (!emp) return;
                
                if (!stats[req.employee_id]) {
                    stats[req.employee_id] = { name: emp.name, completed: 0, avgTime: 0, totalTime: 0 };
                }
                
                stats[req.employee_id].completed += 1;
                
                // Calculate time if possible
                if (req.created_at && req.completed_at) {
                    const start = new Date(req.created_at).getTime();
                    const end = new Date(req.completed_at).getTime();
                    const diffMinutes = Math.round((end - start) / (1000 * 60));
                    if (diffMinutes > 0 && diffMinutes < 1440) { // Limit to 24h to avoid outliers
                        stats[req.employee_id].totalTime += diffMinutes;
                    }
                }
            }
        });

        return Object.values(stats).map(s => ({
            name: s.name.split(' ')[0],
            completed: s.completed,
            avgTime: s.completed > 0 ? Math.round(s.totalTime / s.completed) : 0
        })).sort((a, b) => b.completed - a.completed);
    }, [requests, employees]);

    if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 h-full flex flex-col">
            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                أداء الفنيين (الفحوصات المنجزة)
            </h4>
            <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <Tooltip cursor={{fill: 'transparent'}} />
                        <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} name="المنجزة" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// --- Customer Feedback Summary ---
const CustomerFeedbackSummary: React.FC<{ requests: InspectionRequest[], isLoading: boolean }> = ({ requests, isLoading }) => {
    const feedbackList = useMemo(() => {
        return requests
            .filter(r => r.rating !== undefined)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5);
    }, [requests]);

    const avgRating = useMemo(() => {
        const rated = requests.filter(r => r.rating !== undefined);
        if (rated.length === 0) return 0;
        return (rated.reduce((sum, r) => sum + (r.rating || 0), 0) / rated.length).toFixed(1);
    }, [requests]);

    const lowRatings = useMemo(() => {
        return requests
            .filter(r => r.rating !== undefined && r.rating <= 2)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 3);
    }, [requests]);

    if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-500" />
                    تقييمات العملاء
                </h4>
                <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-lg">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-black text-purple-700 dark:text-purple-300">{avgRating}</span>
                </div>
            </div>

            {lowRatings.length > 0 && (
                <div className="mb-4 p-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-lg animate-pulse">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-[10px] font-bold mb-1">
                        <CheckCircle2 className="w-3 h-3 rotate-180" />
                        تنبيه: يوجد تقييمات منخفضة تحتاج مراجعة
                    </div>
                </div>
            )}
            
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                {feedbackList.length > 0 ? (
                    feedbackList.map((fb, idx) => (
                        <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold text-slate-500">طلب #{fb.request_number}</span>
                                <div className="flex gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                        <Star 
                                            key={i} 
                                            className={cn(
                                                "w-2.5 h-2.5",
                                                i < (fb.rating || 0) ? "text-amber-500 fill-amber-500" : "text-slate-300 dark:text-slate-600"
                                            )} 
                                        />
                                    ))}
                                </div>
                            </div>
                            {fb.feedback_comment && (
                                <p className="text-[11px] text-slate-700 dark:text-slate-300 italic leading-tight">
                                    "{fb.feedback_comment}"
                                </p>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">لا توجد تقييمات بعد.</div>
                )}
            </div>
        </div>
    );
};

const Dashboard: React.FC = () => {
  const { authUser, fetchServerFinancials, employees, carMakes, setPage, setInitialRequestModalState } = useAppContext();
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [comparisonStats, setComparisonStats] = useState<{ label: string, revenue: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadData = async () => {
      setIsLoading(true);
      try {
          const now = new Date();
          let start = new Date();
          let end = new Date();

          if (activePeriod === 'today') {
              start.setHours(0, 0, 0, 0);
              end.setHours(23, 59, 59, 999);
          } else if (activePeriod === 'week') {
              const day = now.getDay();
              const diff = now.getDate() - day + (day === 0 ? -6 : 1);
              start = new Date(now.setDate(diff));
              start.setHours(0,0,0,0);
              end = new Date();
              end.setHours(23,59,59,999);
          } else if (activePeriod === 'month') {
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              end.setHours(23, 59, 59, 999);
          } else if (activePeriod === 'year') {
              start = new Date(now.getFullYear(), 0, 1);
              end.setHours(23, 59, 59, 999);
          }

          const currentStats = await fetchServerFinancials(start.toISOString(), end.toISOString(), false);
          setStats(currentStats);

          // Fetch comparison data for the last 6 months
          const comparisonData = [];
          for (let i = 5; i >= 0; i--) {
              const d = new Date();
              d.setMonth(now.getMonth() - i);
              const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
              const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
              
              const monthStats = await fetchServerFinancials(monthStart.toISOString(), monthEnd.toISOString(), true);
              comparisonData.push({
                  label: d.toLocaleDateString('ar-SA', { month: 'short' }),
                  revenue: monthStats.totalRevenue
              });
          }
          setComparisonStats(comparisonData);

          setLastRefreshed(new Date());

      } catch (error) {
          console.error("Dashboard Load Error", error);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      loadData();
  }, [activePeriod]);

  // Derived Data
  const totalRevenue = stats?.totalRevenue || 0;
  const netProfit = stats?.netProfit || 0;
  const avgTicket = stats?.filteredRequests.length ? Math.round(totalRevenue / stats.filteredRequests.length) : 0;
  const activeCars = stats?.filteredRequests.filter(r => r.status === 'قيد التنفيذ' || r.status === 'جديد').length || 0;
  const chartData = stats?.forecast?.history || [];
  
  const leaderboardData = useMemo(() => {
      if (!stats) return [];
      const map = new Map<string, {name: string, revenue: number, count: number, role: string}>();
      stats.filteredRequests.forEach(req => {
          if (req.employee_id) {
              const emp = employees.find(e => e.id === req.employee_id);
              const name = emp?.name || 'غير معروف';
              const role = emp?.role === 'manager' ? 'مدير' : 'موظف';
              const current = map.get(req.employee_id) || { name, revenue: 0, count: 0, role };
              current.revenue += req.price;
              current.count += 1;
              map.set(req.employee_id, current);
          }
      });
      return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [stats, employees]);

  const transactionFeed = useMemo(() => {
      if (!stats) return [];
      const incomes = stats.filteredRequests.map(r => ({
          type: 'income', amount: r.price, date: r.created_at, description: `فحص #${r.request_number}`, user: employees.find(e => e.id === r.employee_id)?.name.split(' ')[0] || '-'
      }));
      const expenses = stats.filteredExpenses.map(e => ({
          type: 'expense', amount: e.amount, date: e.date, description: e.category, user: e.employeeName?.split(' ')[0] || '-'
      }));
      return [...incomes, ...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15);
  }, [stats, employees]);

  const pieData = stats?.paymentDistribution || [];

  // Date Formatting for Welcome
  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = today.toLocaleDateString('ar-SA', dateOptions);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 p-4 animate-fade-in">
        
        {/* Header Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    مرحباً، {authUser?.name.split(' ')[0]} <span className="text-2xl">👋</span>
                </h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full w-fit border border-slate-200 dark:border-slate-700 shadow-sm">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{formattedDate}</span>
                </p>
            </div>
            
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 self-end md:self-auto">
                 <PeriodToggle activePeriod={activePeriod} onChange={setActivePeriod} isLoading={isLoading} />
                 <button onClick={loadData} disabled={isLoading} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                     <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                 </button>
            </div>
        </div>
        
        {/* Quick Actions (New Section) */}
        <QuickActions />

        {/* KPI Grid (2 cols on mobile, 4 on desktop) */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <ExecutiveKpiCard 
                title="صافي الربح" 
                value={`${netProfit.toLocaleString()}`} 
                trend={12} 
                icon={<DollarSign />} 
                bgClass="bg-emerald-100 dark:bg-emerald-900/30"
                colorClass="text-emerald-600 dark:text-emerald-400"
                isLoading={isLoading} 
            />
            <ExecutiveKpiCard 
                title="الدخل الكلي" 
                value={`${totalRevenue.toLocaleString()}`} 
                trend={5} 
                icon={<TrendingUp />} 
                bgClass="bg-blue-100 dark:bg-blue-900/30"
                colorClass="text-blue-600 dark:text-blue-400"
                isLoading={isLoading} 
            />
            <ExecutiveKpiCard 
                title="متوسط الفاتورة" 
                value={`${avgTicket}`} 
                trend={-2} 
                icon={<Briefcase />} 
                bgClass="bg-amber-100 dark:bg-amber-900/30"
                colorClass="text-amber-600 dark:text-amber-400"
                isLoading={isLoading} 
            />
             <ExecutiveKpiCard 
                title="سيارات بالورشة" 
                value={activeCars.toString()} 
                icon={<Car />} 
                bgClass="bg-rose-100 dark:bg-rose-900/30"
                colorClass="text-rose-600 dark:text-rose-400"
                isLoading={isLoading} 
            />
        </div>

        {/* Advanced Analytics Section */}
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-black text-slate-800 dark:text-white">إحصائيات متقدمة</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Comparison */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                    <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        مقارنة الإيرادات الشهرية
                    </h4>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparisonStats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                <Tooltip cursor={{fill: 'slate-50'}} />
                                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="الإيرادات" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Car Make Analysis */}
                <CarMakeAnalysis requests={stats?.filteredRequests || []} carMakes={carMakes} isLoading={isLoading} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Technician Performance */}
                <TechnicianPerformance requests={stats?.filteredRequests || []} employees={employees} isLoading={isLoading} />
                
                {/* Customer Feedback */}
                <CustomerFeedbackSummary requests={stats?.filteredRequests || []} isLoading={isLoading} />

                {/* Top Performers */}
                <EmployeeLeaderboard data={leaderboardData} isLoading={isLoading} />
            </div>
        </div>

        {/* Bottom Section: Trends & Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
             {/* Main Chart */}
             <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-700 dark:text-white text-sm flex items-center gap-2">
                         <TrendingUp className="w-4 h-4 text-blue-500" />
                         تحليل الإيرادات (30 يوم)
                     </h3>
                     <span className="text-[10px] text-slate-400">{lastRefreshed.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                 </div>
                 <div className="w-full h-48">
                     {isLoading ? <Skeleton className="w-full h-full rounded-lg" /> : (
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                <Tooltip />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" />
                            </AreaChart>
                         </ResponsiveContainer>
                     )}
                 </div>
             </div>

             {/* Recent Transactions */}
             <RecentTransactions transactions={transactionFeed} isLoading={isLoading} />
        </div>
    </div>
  );
};

export default Dashboard;