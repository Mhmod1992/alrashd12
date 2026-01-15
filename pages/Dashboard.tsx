
import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { RequestStatus, ActivityLog, FinancialStats } from '../types';
import FileTextIcon from '../components/icons/FileTextIcon';
import UsersIcon from '../components/icons/UsersIcon';
import PlusIcon from '../components/icons/PlusIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import ActionCard from '../components/ActionCard';
import SettingsIcon from '../components/icons/SettingsIcon';
import ActivityLogFeed from '../components/ActivityLogFeed';
import Drawer from '../components/Drawer';
import HistoryIcon from '../components/icons/HistoryIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import DollarSignIcon from '../components/icons/DollarSignIcon';
import CreditCardIcon from '../components/icons/CreditCardIcon';
import { Skeleton } from '../components/Skeleton'; // Use simpler skeleton
import Icon from '../components/Icon';

interface DashboardStats {
  revenue: number;
  expenses: number;
  newRequests: number;
  completedRequests: number;
  waitingPayment: number;
  statusDistribution: { label: string; value: number; color: string }[];
}

// --- New Compact Components for Dashboard ---

const CompactStatCard: React.FC<{ 
    title: string; 
    value: string | number; 
    icon: React.ReactNode; 
    color: string;
    onClick?: () => void;
}> = ({ title, value, icon, color, onClick }) => {
    // Map colors to Tailwind classes
    const colorStyles: Record<string, string> = {
        green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        red: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    };
    
    const activeStyle = colorStyles[color] || colorStyles.blue;

    return (
        <div 
            onClick={onClick}
            className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between h-full cursor-pointer hover:shadow-md transition-shadow"
        >
            <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-lg ${activeStyle}`}>
                    {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-4 h-4 sm:w-5 sm:h-5' })}
                </div>
                {/* Optional trend arrow could go here */}
            </div>
            <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">{value}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{title}</p>
            </div>
        </div>
    );
};

const CompactRequestRow: React.FC<{ request: any, onClick: () => void }> = ({ request, onClick }) => {
    const getStatusColor = (status: string) => {
        switch(status) {
            case RequestStatus.NEW: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
            case RequestStatus.IN_PROGRESS: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
            case RequestStatus.COMPLETE: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
            case RequestStatus.WAITING_PAYMENT: return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const carName = request.car_snapshot 
        ? `${request.car_snapshot.make_ar} ${request.car_snapshot.model_ar}` 
        : 'سيارة غير معروفة';

    return (
        <div 
            onClick={onClick}
            className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300 flex-shrink-0">
                    #{request.request_number}
                </div>
                <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-1">{carName}</h4>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{new Date(request.created_at).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
            </div>
            <div className={`px-2 py-1 rounded-md text-[10px] font-bold ${getStatusColor(request.status)} whitespace-nowrap`}>
                {request.status}
            </div>
        </div>
    );
};

const Dashboard: React.FC = () => {
  const {
    requests, authUser, setPage, can, clearSearchedRequests,
    setInitialRequestModalState, expenses, employees, systemLogs, setSelectedRequestId,
    fetchServerFinancials, addNotification
  } = useAppContext();

  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // --- Dynamic Greeting & Date ---
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting('صباح الخير');
    else if (hour >= 12 && hour < 17) setGreeting('طاب يومك');
    else setGreeting('مساء الخير');

    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    setCurrentDate(new Date().toLocaleDateString('ar-SA', dateOptions));
  }, []);

  // --- Server-Side Stats Fetching ---
  useEffect(() => {
    const getDashboardStats = async () => {
      setIsLoadingStats(true);
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const financialStats: FinancialStats = await fetchServerFinancials(todayStart.toISOString(), todayEnd.toISOString(), false);

        const newRequestsToday = financialStats.filteredRequests.filter(r => r.status === RequestStatus.NEW).length;
        const inProgressToday = financialStats.filteredRequests.filter(r => r.status === RequestStatus.IN_PROGRESS).length;
        const completedToday = financialStats.filteredRequests.filter(r => r.status === RequestStatus.COMPLETE).length;
        const waitingPaymentToday = financialStats.filteredRequests.filter(r => r.status === RequestStatus.WAITING_PAYMENT).length;
        
        // Use actualCashFlow (Actual money collected) instead of totalRevenue (Invoiced amount)
        // This excludes "Waiting for Payment" and "Unpaid" requests from the KPI card.
        const revenueToday = financialStats.actualCashFlow;

        setStats({
          revenue: revenueToday,
          expenses: financialStats.totalExpenses,
          newRequests: newRequestsToday,
          completedRequests: completedToday,
          waitingPayment: waitingPaymentToday,
          statusDistribution: [
              { label: 'جديد', value: newRequestsToday, color: '#8b5cf6' },
              { label: 'قيد التنفيذ', value: inProgressToday, color: '#f59e0b' },
              { label: 'مكتمل', value: completedToday, color: '#10b981' },
              { label: 'انتظار الدفع', value: waitingPaymentToday, color: '#ec4899' },
          ].filter(d => d.value > 0)
        });

      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
        setStats(null);
      } finally {
        setIsLoadingStats(false);
      }
    };
    getDashboardStats();
  }, [fetchServerFinancials]);

  const visibleRequests = useMemo(() => {
    let filtered = requests;
    
    // Filter out completed if no permission
    if (!can('view_completed_requests')) {
      filtered = filtered.filter(r => r.status !== RequestStatus.COMPLETE);
    }

    // ISOLATE: Exclude Waiting for Payment from the main dashboard list
    // (They are accessed via the KPI card or dedicated page)
    filtered = filtered.filter(r => r.status !== RequestStatus.WAITING_PAYMENT);

    return filtered;
  }, [requests, can]);

  // Show only top 5 latest
  const latestRequests = [...visibleRequests].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  const handleRowClick = (requestId: string) => {
    setSelectedRequestId(requestId);
    setPage('fill-request');
  };

  const actionCards = useMemo(() => {
    const cards = [];

    if (can('create_requests')) {
      cards.push({
        id: 'new-request',
        title: 'فحص جديد',
        icon: <PlusIcon />,
        color: 'blue',
        onClick: () => {
          setInitialRequestModalState('new');
          clearSearchedRequests(); // Clear search if going to new
          setPage('requests');
        },
      });
    }

    const canAccessRequests = can('create_requests') || can('fill_requests') || can('update_requests_data') || can('delete_requests');
    if (canAccessRequests) {
      cards.push({
        id: 'manage-requests',
        title: 'الطلبات',
        icon: <FileTextIcon />,
        color: 'orange',
        onClick: () => {
            clearSearchedRequests(); // Clear search when viewing all
            setPage('requests');
        },
      });
    }

    if (can('manage_clients')) {
      cards.push({
        id: 'manage-clients',
        title: 'العملاء',
        icon: <UsersIcon />,
        color: 'purple',
        onClick: () => setPage('clients'),
      });
    }

    if (can('view_financials')) {
      cards.push({
        id: 'financials',
        title: 'المالية',
        icon: <DollarSignIcon />,
        color: 'green',
        onClick: () => setPage('financials'),
      });
    }

    return cards;
  }, [can, setPage, setInitialRequestModalState, clearSearchedRequests]);

  // --- Activity Stream Logic ---
  const globalActivityLog = useMemo(() => {
    const allLogs: ActivityLog[] = [];
    const highLevelActions = ['غيّر حالة الطلب', 'تغيير حالة الطلب', 'تعديل بيانات الطلب', 'إضافة مصروف'];

    requests.forEach(req => {
      const creator = employees.find(e => e.id === req.employee_id);
      allLogs.push({
        id: `req-create-${req.id}`,
        timestamp: req.created_at,
        employeeId: req.employee_id || 'system',
        employeeName: creator?.name || 'النظام',
        action: 'أنشأ طلبًا',
        details: `#${req.request_number}`,
        link_id: req.id,
        link_page: 'fill-request'
      });

      if (req.activity_log) {
        const highLevelLogs = req.activity_log.filter(log =>
          highLevelActions.some(action => log.action.includes(action))
        );
        highLevelLogs.forEach(log => {
          allLogs.push({ ...log, link_id: req.id, link_page: 'fill-request' });
        });
      }
    });

    expenses.forEach(exp => {
      if (exp.category !== 'خصومات' && exp.category !== 'سلف') {
        allLogs.push({
          id: `exp-create-${exp.id}`,
          timestamp: exp.date,
          employeeId: exp.employeeId,
          employeeName: exp.employeeName,
          action: 'أضاف مصروفًا',
          details: `${exp.amount} ريال`
        });
      }
    });

    if (systemLogs) {
      allLogs.push(...systemLogs.map(log => ({ ...log, link_page: log.link_page || undefined })));
    }

    return allLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

  }, [requests, expenses, employees, systemLogs]);

  const renderKpiCards = () => {
    if (isLoadingStats) {
      return (
        <>
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </>
      );
    }

    if (!stats) return null;

    return (
      <>
        <CompactStatCard
          title="الدخل اليومي (المقبوض)"
          value={stats.revenue.toLocaleString('en-US', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          icon={<DollarSignIcon />}
          color="green"
        />
        <CompactStatCard
          title="بانتظار الدفع"
          value={stats.waitingPayment}
          icon={<Icon name="credit-card" />}
          color="purple"
          onClick={() => setPage('waiting-requests')}
        />
        <CompactStatCard
          title="طلبات مكتملة"
          value={stats.completedRequests}
          icon={<CheckCircleIcon />}
          color="indigo"
        />
         <CompactStatCard
          title="طلبات جديدة"
          value={stats.newRequests}
          icon={<Icon name="sparkles" />}
          color="red"
        />
      </>
    );
  };


  return (
    <div className="container mx-auto animate-fade-in pb-20">
      {/* Header Section - More Compact */}
      <div className="flex flex-row justify-between items-center mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            {greeting}، {authUser?.name.split(' ')[0]}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {currentDate}
          </p>
        </div>
        {can('create_requests') && (
          <button
            onClick={() => { 
                setInitialRequestModalState('new'); 
                clearSearchedRequests(); // Clear search
                setPage('requests'); 
            }}
            className="flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto sm:gap-2 bg-blue-600 text-white rounded-full sm:rounded-xl shadow-lg hover:bg-blue-700 transition-all sm:px-4 sm:py-2"
          >
            <PlusIcon className="w-6 h-6 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline font-bold text-sm">فحص جديد</span>
          </button>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column (2/3): Stats & Tables */}
          <div className="lg:col-span-2 space-y-6">
             {/* 1. Compact KPI Grid (2x2 on Mobile, 4x1 on Desktop) */}
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {renderKpiCards()}
             </div>

             {/* 2. Quick Actions - MOVED ABOVE TABLE */}
             {actionCards.length > 0 && (
                <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 hide-scrollbar">
                    <div className="flex sm:grid sm:grid-cols-4 gap-3 min-w-max sm:min-w-0">
                        {actionCards.map(card => (
                            <div key={card.id} className="w-32 sm:w-auto">
                                <ActionCard
                                    title={card.title}
                                    icon={card.icon}
                                    onClick={card.onClick}
                                    color={card.color as any}
                                />
                            </div>
                        ))}
                    </div>
                </div>
             )}

             {/* 3. Compact Recent Requests Widget */}
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                        <FileTextIcon className="w-4 h-4 text-blue-500"/>
                        أحدث الطلبات (النشطة)
                    </h3>
                    <button onClick={() => { clearSearchedRequests(); setPage('requests'); }} className="text-xs font-bold text-blue-600 hover:underline">عرض الكل</button>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                    {latestRequests.length > 0 ? (
                        latestRequests.map(req => (
                            <CompactRequestRow key={req.id} request={req} onClick={() => handleRowClick(req.id)} />
                        ))
                    ) : (
                        <div className="p-8 text-center text-slate-400 text-sm">لا توجد طلبات نشطة حديثة.</div>
                    )}
                </div>
             </div>

          </div>

          {/* Right Column (1/3): Streamlined Activity Feed */}
          <div className="lg:col-span-1">
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col h-full max-h-[500px]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                        <HistoryIcon className="w-4 h-4 text-purple-500"/>
                        النشاط المباشر
                    </h3>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                    <ActivityLogFeed logs={globalActivityLog} />
                </div>
                
                <div className="p-3 border-t border-slate-100 dark:border-slate-700 text-center">
                    <button 
                        onClick={() => setIsActivityLogOpen(true)}
                        className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
                    >
                        عرض السجل الكامل
                    </button>
                </div>
             </div>
          </div>

      </div>

      <Drawer isOpen={isActivityLogOpen} onClose={() => setIsActivityLogOpen(false)} title="سجل النشاط العام">
        <ActivityLogFeed logs={globalActivityLog} />
      </Drawer>
    </div>
  );
};

export default Dashboard;
