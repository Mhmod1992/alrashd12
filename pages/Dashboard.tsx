import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { FinancialStats, InspectionRequest, Expense, Revenue, PaymentType, RequestStatus } from '../types';
import { supabase } from '../lib/supabaseClient';
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LineChart as RechartsLineChart, Line } from 'recharts';

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
  const { authUser, fetchServerFinancials, employees, cars, carMakes, carModels } = useAppContext();
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month' | 'year'>('today');
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [prevStats, setPrevStats] = useState<FinancialStats | null>(null);
  const [pulseStats, setPulseStats] = useState<FinancialStats | null>(null);
  const [prevPulseStats, setPrevPulseStats] = useState<FinancialStats | null>(null);
  const [monthStats, setMonthStats] = useState<FinancialStats | null>(null);
  const [prevMonthStats, setPrevMonthStats] = useState<FinancialStats | null>(null);
  const [carFilter, setCarFilter] = useState<'yesterday' | 'week' | 'month' | 'all'>('month');
  const [carStats, setCarStats] = useState<FinancialStats | null>(null);
  const [allCarModels, setAllCarModels] = useState<any[]>([]);
  const [isCarLoading, setIsCarLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadData = async () => {
      setIsLoading(true);
      try {
          const now = new Date();
          let start = new Date();
          let end = new Date();
          let prevStart = new Date();
          let prevEnd = new Date();

          if (activePeriod === 'today') {
              start.setHours(0, 0, 0, 0);
              end.setHours(23, 59, 59, 999);
              prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 1);
              prevEnd = new Date(end); prevEnd.setDate(prevEnd.getDate() - 1);
          } else if (activePeriod === 'week') {
              const day = now.getDay();
              const diff = now.getDate() - day; // Start on Sunday
              start = new Date(now.setDate(diff));
              start.setHours(0,0,0,0);
              end = new Date();
              end.setHours(23,59,59,999);
              prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
              prevEnd = new Date(end); prevEnd.setDate(prevEnd.getDate() - 7);
          } else if (activePeriod === 'month') {
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              end.setHours(23, 59, 59, 999);
              prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          }

          const currentStats = await fetchServerFinancials(start.toISOString(), end.toISOString(), false);
          const previousStats = await fetchServerFinancials(prevStart.toISOString(), prevEnd.toISOString(), false);
          
          // Always fetch 30-day pulse data
          const pulseEnd = new Date();
          pulseEnd.setHours(23, 59, 59, 999);
          const pulseStart = new Date();
          pulseStart.setDate(pulseEnd.getDate() - 29);
          pulseStart.setHours(0, 0, 0, 0);
          
          const prevPulseEnd = new Date(pulseStart);
          prevPulseEnd.setDate(prevPulseEnd.getDate() - 1);
          prevPulseEnd.setHours(23, 59, 59, 999);
          const prevPulseStart = new Date(prevPulseEnd);
          prevPulseStart.setDate(prevPulseEnd.getDate() - 29);
          prevPulseStart.setHours(0, 0, 0, 0);

          const currentPulseStats = await fetchServerFinancials(pulseStart.toISOString(), pulseEnd.toISOString(), false);
          const previousPulseStats = await fetchServerFinancials(prevPulseStart.toISOString(), prevPulseEnd.toISOString(), false);

          // Always fetch current calendar month and previous calendar month
          const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          
          const currentMonthStatsData = await fetchServerFinancials(currentMonthStart.toISOString(), currentMonthEnd.toISOString(), false);
          const prevMonthStatsData = await fetchServerFinancials(prevMonthStart.toISOString(), prevMonthEnd.toISOString(), false);

          setStats(currentStats);
          setPrevStats(previousStats);
          setPulseStats(currentPulseStats);
          setPrevPulseStats(previousPulseStats);
          setMonthStats(currentMonthStatsData);
          setPrevMonthStats(prevMonthStatsData);
          setLastRefreshed(new Date());

      } catch (error) {
          console.error("Dashboard Load Error", error);
      } finally {
          setIsLoading(false);
      }
  };

  const loadCarData = async () => {
      setIsCarLoading(true);
      try {
          const now = new Date();
          let start = new Date();
          let end = new Date();

          if (carFilter === 'yesterday') {
              start.setDate(now.getDate() - 1);
              start.setHours(0, 0, 0, 0);
              end = new Date(start);
              end.setHours(23, 59, 59, 999);
          } else if (carFilter === 'week') {
              const day = now.getDay();
              const diff = now.getDate() - day; // Start on Sunday
              start = new Date(now.setDate(diff));
              start.setHours(0,0,0,0);
              end = new Date();
              end.setHours(23,59,59,999);
          } else if (carFilter === 'month') {
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              start.setHours(0,0,0,0);
              end = new Date();
              end.setHours(23, 59, 59, 999);
          } else if (carFilter === 'all') {
              start = new Date(2000, 0, 1);
              end = new Date();
              end.setHours(23, 59, 59, 999);
          }

          const stats = await fetchServerFinancials(start.toISOString(), end.toISOString(), false);
          
          // Fetch all car models to ensure fallback grouping works correctly
          const { data: modelsData } = await supabase.from('car_models').select('*');
          if (modelsData) setAllCarModels(modelsData);
          
          setCarStats(stats);
      } catch (error) {
          console.error("Car Data Load Error", error);
      } finally {
          setIsCarLoading(false);
      }
  };

  useEffect(() => {
      loadData();
  }, [activePeriod]);

  useEffect(() => {
      loadCarData();
  }, [carFilter]);

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

  // Data for advanced charts
  const carInspectionFrequencyData = useMemo(() => {
      if (!carStats) return [];
      const frequencyMap = new Map<string, number>();
      
      // Use allCarModels if available, fallback to context carModels
      const modelsToUse = allCarModels.length > 0 ? allCarModels : carModels;

      carStats.filteredRequests.forEach(req => {
          let make = (req.car_snapshot?.make_ar || req.car_snapshot?.make_en || '').trim();
          let model = (req.car_snapshot?.model_ar || req.car_snapshot?.model_en || '').trim();
          
          if (!make || !model) {
              const car = cars.find(c => c.id === req.car_id);
              if (car) {
                  const makeObj = carMakes.find(m => m.id === car.make_id);
                  const modelObj = modelsToUse.find(m => m.id === car.model_id);
                  
                  make = make || makeObj?.name_ar || makeObj?.name_en || '';
                  model = model || modelObj?.name_ar || modelObj?.name_en || '';
              }
          }
          
          if (make && model) {
              // Group by Make and Model ONLY to aggregate same models from different years
              // This addresses the user's concern about "Toyota Camry" showing low numbers
              const fullName = `${make} ${model}`;
              frequencyMap.set(fullName, (frequencyMap.get(fullName) || 0) + 1);
          } else if (make || model) {
              const name = (make || model).trim();
              if (name) {
                  frequencyMap.set(name, (frequencyMap.get(name) || 0) + 1);
              }
          }
      });
      
      return Array.from(frequencyMap.entries())
          .map(([name, count]) => ({ make: name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15); // Show top 15 for better overview
  }, [carStats, cars, carMakes, carModels, allCarModels]);

  const dailyRevenueChartData = useMemo(() => {
      if (!pulseStats || !prevPulseStats) return [];
      
      const data: any[] = [];
      const now = new Date();
      
      // Always show a 30-day pulse
      for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          data.push({ 
              label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' }), 
              dateStr: d.toLocaleDateString('en-CA'),
              current: 0, 
              previous: 0 
          });
      }
      
      const prevDataMap = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - 30 - i);
          prevDataMap.set(d.toLocaleDateString('en-CA'), 0);
      }

      pulseStats.filteredRequests.forEach(req => {
          const dateStr = new Date(req.created_at).toLocaleDateString('en-CA');
          const dayData = data.find(d => d.dateStr === dateStr);
          if (dayData) dayData.current += req.price;
      });
      pulseStats.filteredRevenues?.forEach(rev => {
          const dateStr = new Date(rev.date).toLocaleDateString('en-CA');
          const dayData = data.find(d => d.dateStr === dateStr);
          if (dayData) dayData.current += rev.amount;
      });

      prevPulseStats.filteredRequests.forEach(req => {
          const dateStr = new Date(req.created_at).toLocaleDateString('en-CA');
          if (prevDataMap.has(dateStr)) {
              prevDataMap.set(dateStr, prevDataMap.get(dateStr)! + req.price);
          }
      });
      prevPulseStats.filteredRevenues?.forEach(rev => {
          const dateStr = new Date(rev.date).toLocaleDateString('en-CA');
          if (prevDataMap.has(dateStr)) {
              prevDataMap.set(dateStr, prevDataMap.get(dateStr)! + rev.amount);
          }
      });

      // Map previous 30 days to the current 30 days for comparison
      const prevValues = Array.from(prevDataMap.values());
      data.forEach((d, index) => {
          d.previous = prevValues[index] || 0;
      });
      
      return data;
  }, [pulseStats, prevPulseStats]);

  const monthlyRequestsComparisonData = useMemo(() => {
      if (!monthStats || !prevMonthStats) return [];
      
      const data: any[] = [];
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      
      for (let i = 1; i <= daysInCurrentMonth; i++) {
          data.push({
              day: i,
              current: 0,
              previous: 0
          });
      }

      monthStats.filteredRequests.forEach(req => {
          const day = new Date(req.created_at).getDate();
          const dayData = data.find(d => d.day === day);
          if (dayData) dayData.current += 1;
      });

      prevMonthStats.filteredRequests.forEach(req => {
          const day = new Date(req.created_at).getDate();
          const dayData = data.find(d => d.day === day);
          if (dayData) dayData.previous += 1;
      });

      return data;
  }, [monthStats, prevMonthStats]);

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
                    <Icon name="calendar-clock" className="w-4 h-4 text-blue-500" />
                    <span>{formattedDate}</span>
                </p>
            </div>
            
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 self-end md:self-auto">
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
             <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 relative overflow-hidden">
                 {/* ECG Grid Background */}
                 <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#ef4444 1px, transparent 1px), linear-gradient(90deg, #ef4444 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                 
                 <div className="flex justify-between items-center mb-4 relative z-10">
                     <h3 className="font-bold text-slate-700 dark:text-white text-sm flex items-center gap-2">
                         <Icon name="activity" className="w-4 h-4 text-rose-500" />
                         نبض الإيرادات (يومي)
                     </h3>
                     <span className="text-[10px] text-slate-400">{lastRefreshed.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                 </div>
                 <div className="w-full h-64 relative z-10">
                     {isLoading ? <Skeleton className="w-full h-full rounded-lg" /> : (
                         <ResponsiveContainer width="100%" height="100%">
                             <RechartsLineChart data={dailyRevenueChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                                 <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                 <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                 <RechartsTooltip 
                                     contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                                     formatter={(value: number, name: string) => [`${value.toLocaleString()} ريال`, name]}
                                 />
                                 <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                                 <Line 
                                    type="monotone" 
                                    dataKey="current" 
                                    name="الحالي"
                                    stroke="#ef4444" 
                                    strokeWidth={3} 
                                    dot={false} 
                                    activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} 
                                    animationDuration={1500}
                                    animationEasing="ease-in-out"
                                 />
                                 <Line 
                                    type="monotone" 
                                    dataKey="previous" 
                                    name="السابق"
                                    stroke="#94a3b8" 
                                    strokeWidth={2} 
                                    strokeDasharray="5 5"
                                    dot={false} 
                                    activeDot={{ r: 4, fill: '#94a3b8', stroke: '#fff', strokeWidth: 2 }} 
                                    animationDuration={1500}
                                    animationEasing="ease-in-out"
                                 />
                             </RechartsLineChart>
                         </ResponsiveContainer>
                     )}
                 </div>
             </div>

             {/* Car Inspection Frequency Chart */}
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex flex-col">
                 <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-slate-700 dark:text-white text-sm flex items-center gap-2">
                         <Icon name="car" className="w-4 h-4 text-blue-500" />
                         أكثر السيارات فحصاً
                     </h3>
                     <select 
                         value={carFilter} 
                         onChange={(e) => setCarFilter(e.target.value as any)}
                         className="text-xs border-slate-200 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                     >
                         <option value="yesterday">أمس</option>
                         <option value="week">هذا الأسبوع</option>
                         <option value="month">هذا الشهر</option>
                         <option value="all">الكل</option>
                     </select>
                 </div>
                 <div className="w-full h-72 relative z-10">
                     {isCarLoading ? <Skeleton className="w-full h-full rounded-lg" /> : (
                         <ResponsiveContainer width="100%" height="100%">
                             <BarChart 
                               data={carInspectionFrequencyData} 
                               layout="vertical" 
                               margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
                             >
                                 <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                 <XAxis type="number" hide />
                                 <YAxis 
                                   dataKey="make" 
                                   type="category" 
                                   axisLine={false} 
                                   tickLine={false} 
                                   fontSize={10} 
                                   stroke="#64748b" 
                                   width={120}
                                   tick={{ fill: '#64748b', fontWeight: 500 }}
                                 />
                                 <RechartsTooltip 
                                     cursor={{fill: 'rgba(59, 130, 246, 0.1)'}}
                                     contentStyle={{ 
                                       borderRadius: '12px', 
                                       border: 'none', 
                                       boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                       backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                       padding: '8px 12px'
                                     }}
                                     formatter={(value: number) => [`${value} سيارة`, 'إجمالي الفحوصات']}
                                 />
                                 <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={20} />
                             </BarChart>
                         </ResponsiveContainer>
                     )}
                 </div>
             </div>
        </div>

        {/* Monthly Requests Comparison Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-700 dark:text-white text-sm flex items-center gap-2">
                    <Icon name="bar-chart-2" className="w-4 h-4 text-emerald-500" />
                    مقارنة عدد الطلبات (الشهر الحالي مقابل السابق)
                </h3>
            </div>
            <div className="w-full h-72">
                {isLoading ? <Skeleton className="w-full h-full rounded-lg" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyRequestsComparisonData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                            <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                            <RechartsTooltip 
                                cursor={{fill: 'rgba(148, 163, 184, 0.1)'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number, name: string) => [`${value} طلب`, name]}
                                labelFormatter={(label) => `يوم ${label}`}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                            <Bar dataKey="current" name="الشهر الحالي" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="previous" name="الشهر الماضي" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
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