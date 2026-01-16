
import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { FinancialStats } from '../types';
import LineChart from '../components/LineChart';
import Icon from '../components/Icon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import DollarSignIcon from '../components/icons/DollarSignIcon';
import UsersIcon from '../components/icons/UsersIcon';
import BriefcaseIcon from '../components/icons/BriefcaseIcon';
import PlusIcon from '../components/icons/PlusIcon';
import CreditCardIcon from '../components/icons/CreditCardIcon';
import FileTextIcon from '../components/icons/FileTextIcon';
import { Skeleton } from '../components/Skeleton';

// --- Quick Actions Component ---
const QuickActions: React.FC = () => {
    const { setPage, setInitialRequestModalState } = useAppContext();

    const actions = [
        { 
            label: 'طلب جديد', 
            icon: <PlusIcon className="w-5 h-5" />, 
            color: 'bg-blue-600 text-white', 
            action: () => { setInitialRequestModalState('new'); setPage('requests'); } 
        },
        { 
            label: 'العملاء', 
            icon: <UsersIcon className="w-5 h-5" />, 
            color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300', 
            action: () => setPage('clients') 
        },
        { 
            label: 'المصروفات', 
            icon: <CreditCardIcon className="w-5 h-5" />, 
            color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300', 
            action: () => setPage('expenses') 
        },
        { 
            label: 'الطلبات', 
            icon: <FileTextIcon className="w-5 h-5" />, 
            color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300', 
            action: () => setPage('requests') 
        },
    ];

    return (
        <div className="grid grid-cols-4 gap-3 mb-6">
            {actions.map((btn, idx) => (
                <button
                    key={idx}
                    onClick={btn.action}
                    className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all active:scale-95"
                >
                    <div className={`p-2.5 rounded-full mb-2 ${btn.color} shadow-sm`}>
                        {btn.icon}
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{btn.label}</span>
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
                    {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-0.5 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-500'} bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded`}>
                        <span>{Math.abs(trend)}%</span>
                        <TrendingUpIcon className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
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
                    <UsersIcon className="w-4 h-4 text-blue-500" />
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
                    <DollarSignIcon className="w-4 h-4 text-emerald-500" />
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
                                        {tx.type === 'income' ? <Icon name="dollar-sign" className="w-4 h-4" /> : <Icon name="credit-card" className="w-4 h-4" />}
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

const Dashboard: React.FC = () => {
  const { authUser, fetchServerFinancials, employees } = useAppContext();
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [stats, setStats] = useState<FinancialStats | null>(null);
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
          }

          const currentStats = await fetchServerFinancials(start.toISOString(), end.toISOString(), false);
          setStats(currentStats);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 p-4 animate-fade-in">
        
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">نظرة عامة</h1>
                <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>
                <p className="text-xs text-slate-500 dark:text-slate-400">مرحباً {authUser?.name.split(' ')[0]}</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                 <PeriodToggle activePeriod={activePeriod} onChange={setActivePeriod} isLoading={isLoading} />
                 <button onClick={loadData} disabled={isLoading} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                     <RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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
                icon={<DollarSignIcon />} 
                bgClass="bg-emerald-100 dark:bg-emerald-900/30"
                colorClass="text-emerald-600 dark:text-emerald-400"
                isLoading={isLoading} 
            />
            <ExecutiveKpiCard 
                title="الدخل الكلي" 
                value={`${totalRevenue.toLocaleString()}`} 
                trend={5} 
                icon={<Icon name="sparkles" />} 
                bgClass="bg-blue-100 dark:bg-blue-900/30"
                colorClass="text-blue-600 dark:text-blue-400"
                isLoading={isLoading} 
            />
            <ExecutiveKpiCard 
                title="متوسط الفاتورة" 
                value={`${avgTicket}`} 
                trend={-2} 
                icon={<BriefcaseIcon />} 
                bgClass="bg-amber-100 dark:bg-amber-900/30"
                colorClass="text-amber-600 dark:text-amber-400"
                isLoading={isLoading} 
            />
             <ExecutiveKpiCard 
                title="سيارات بالورشة" 
                value={activeCars.toString()} 
                icon={<Icon name="car" />} 
                bgClass="bg-rose-100 dark:bg-rose-900/30"
                colorClass="text-rose-600 dark:text-rose-400"
                isLoading={isLoading} 
            />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
             {/* Main Chart */}
             <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-700 dark:text-white text-sm flex items-center gap-2">
                         <TrendingUpIcon className="w-4 h-4 text-blue-500" />
                         تحليل الإيرادات
                     </h3>
                     <span className="text-[10px] text-slate-400">{lastRefreshed.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                 </div>
                 <div className="w-full h-48">
                     {isLoading ? <Skeleton className="w-full h-full rounded-lg" /> : (
                         <LineChart data={chartData} forecastData={[]} height={180} color="#3b82f6" />
                     )}
                 </div>
             </div>

             {/* Donut Chart */}
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex flex-col justify-center">
                 <h3 className="font-bold text-slate-700 dark:text-white text-sm mb-4 text-center">مصادر الدخل</h3>
                 <div className="relative w-32 h-32 mx-auto">
                     {isLoading ? <Skeleton className="w-full h-full rounded-full" /> : (
                         <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            {pieData.length > 0 ? (() => {
                                let accumulated = 0;
                                const total = pieData.reduce((acc, curr) => acc + curr.value, 0);
                                return pieData.map((slice, i) => {
                                    const percentage = slice.value / total;
                                    const dashArray = percentage * 314; 
                                    const dashOffset = -accumulated * 314;
                                    accumulated += percentage;
                                    return (
                                        <circle 
                                            key={i} r="40" cx="50" cy="50" 
                                            fill="transparent" 
                                            stroke={slice.color} 
                                            strokeWidth="15"
                                            strokeDasharray={`${dashArray} 314`}
                                            strokeDashoffset={dashOffset}
                                        />
                                    );
                                })
                            })() : <circle r="40" cx="50" cy="50" fill="transparent" stroke="#e2e8f0" strokeWidth="15" />}
                         </svg>
                     )}
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                         <span className="text-xl font-black text-slate-800 dark:text-white font-numeric">{pieData.length}</span>
                     </div>
                 </div>
                 <div className="mt-4 grid grid-cols-2 gap-2">
                     {pieData.slice(0, 4).map((p, i) => (
                         <div key={i} className="flex items-center gap-1.5 text-[10px]">
                             <span className="w-2 h-2 rounded-full" style={{backgroundColor: p.color}}></span>
                             <span className="text-slate-600 dark:text-slate-300 truncate">{p.label}</span>
                         </div>
                     ))}
                 </div>
             </div>
        </div>

        {/* Bottom Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">
            <EmployeeLeaderboard data={leaderboardData} isLoading={isLoading} />
            <RecentTransactions transactions={transactionFeed} isLoading={isLoading} />
        </div>
    </div>
  );
};

export default Dashboard;
