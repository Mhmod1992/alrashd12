
import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import HomeIcon from './icons/HomeIcon';
import FileTextIcon from './icons/FileTextIcon';
import UsersIcon from './icons/UsersIcon';
import SettingsIcon from './icons/SettingsIcon';
import { Page } from '../types';
import DollarSignIcon from './icons/DollarSignIcon';
import BriefcaseIcon from './icons/BriefcaseIcon';
import CreditCardIcon from './icons/CreditCardIcon';
import LogOutIcon from './icons/LogOutIcon'; 
import ArchiveIcon from './icons/ArchiveIcon'; 
import DownloadIcon from './icons/DownloadIcon';
import TrendingUpIcon from './icons/TrendingUpIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import CalendarClockIcon from './icons/CalendarClockIcon';
import FolderOpenIcon from './icons/FolderOpenIcon';

interface SidebarProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setSidebarOpen }) => {
  const { page, setPage, can, settings, setSettingsPage, authUser, logout, deferredPrompt, installPwa, clearSearchedRequests } = useAppContext();
  const design = settings.design || 'aero';

  const handleNavigation = (view: Page) => {
    if (view === 'requests') {
        clearSearchedRequests();
    }
    setPage(view);
    if (window.innerWidth < 1024) { 
        setSidebarOpen(false);
    }
  };

  // Grouped Navigation Items
  const navGroups = useMemo(() => {
    // Group 1: Operations (العمليات اليومية)
    const operationsItems = [];
    
    if (can('view_dashboard')) {
        operationsItems.push({ id: 'dashboard', label: 'لوحة التحكم', icon: HomeIcon });
    }

    if (authUser?.role === 'receptionist' || can('view_waiting_requests')) {
        operationsItems.push({ id: 'waiting-requests', label: 'طلبات بانتظار الدفع', icon: DollarSignIcon });
    }

    const canAccessRequests = can('create_requests') || can('fill_requests') || can('update_requests_data') || can('delete_requests');
    if (canAccessRequests) {
        if (authUser?.role !== 'receptionist') {
            operationsItems.push({ id: 'requests', label: 'إدارة الطلبات', icon: FileTextIcon });
        }
    }
    
    if (can('manage_reservations')) {
        operationsItems.push({ id: 'reservations', label: 'الحجوزات الواردة', icon: CalendarClockIcon });
    }
    
    if (can('view_archive')) {
        operationsItems.push({ id: 'archive', label: 'أرشيف الفحص', icon: ArchiveIcon });
    }
    
    if (can('manage_paper_archive')) {
        operationsItems.push({ id: 'paper-archive', label: 'أرشيف الورقيات', icon: FolderOpenIcon });
    }

    if (can('manage_clients') && authUser?.role !== 'receptionist') {
      operationsItems.push({ id: 'clients', label: 'إدارة العملاء', icon: UsersIcon });
    }

    // Group 2: Financials (المالية)
    const financialItems = [];
    if (can('view_financials')) {
      financialItems.push({ id: 'financials', label: 'المالية والتقارير', icon: DollarSignIcon });
    }
    
    if (can('manage_revenues')) {
        financialItems.push({ id: 'revenues', label: 'الإيرادات الأخرى', icon: TrendingUpIcon });
    }
    
    if (can('manage_expenses')) {
        financialItems.push({ id: 'expenses', label: 'إدارة المصروفات', icon: CreditCardIcon });
    }

    // Group 3: Admin & Settings (الإدارة)
    const adminItems = [];
    if (can('manage_employees') || can('manage_technicians')) {
        adminItems.push({ id: 'employees', label: 'شئون الموظفين', icon: UserCircleIcon });
    }

    if (can('manage_brokers')) {
      adminItems.push({ id: 'brokers', label: 'إدارة السماسرة', icon: BriefcaseIcon });
    }

    const canManageOtherSettings = can('manage_settings_general') || can('manage_settings_technical') || can('manage_appearance');
    if (canManageOtherSettings) {
      adminItems.push({ id: 'settings', label: 'الإعدادات', icon: SettingsIcon });
    }

    return [
        { title: 'العمليات', items: operationsItems },
        { title: 'المالية', items: financialItems },
        { title: 'الإدارة', items: adminItems }
    ].filter(group => group.items.length > 0);

  }, [can, authUser]);
  
  const baseClasses = "fixed lg:relative inset-y-0 right-0 z-50 w-64 transform transition-transform duration-300 ease-in-out flex flex-col";
  const openClasses = "translate-x-0 shadow-2xl lg:shadow-none";
  const closedClasses = "translate-x-full lg:translate-x-0";

  const getDesignClasses = () => {
    const sidebarStyle = settings.sidebarStyle || 'default';
    const minimalBorder = sidebarStyle === 'minimal' ? '' : 'border-l border-slate-200 dark:border-slate-700';
    const minimalGlassBorder = sidebarStyle === 'minimal' ? '' : 'border-l border-white/20 dark:border-slate-700/50';

    switch (design) {
        case 'glass':
            const intensity = settings.glassmorphismIntensity || 5;
            const opacity = 1.0 - (intensity * 0.065);
            const darkOpacity = 1.0 - (intensity * 0.05);
            const blurLevels: { [key: number]: string } = {1: 'sm', 2: 'sm', 3: '', 4: '', 5: 'md', 6: 'md', 7: 'lg', 8: 'lg', 9: 'xl', 10: 'xl' };
            const blur = blurLevels[intensity] || 'md';
            const blurClass = `backdrop-blur${blur ? `-${blur}` : ''}`;
            const glassBg = `bg-white/[${opacity.toFixed(2)}] dark:bg-slate-800/[${darkOpacity.toFixed(2)}] ${blurClass}`;
            
            return {
                sidebar: `${glassBg} ${minimalGlassBorder}`,
                header: 'border-b border-white/20 dark:border-slate-700/50',
                logo: 'text-indigo-600 dark:text-indigo-400',
                active: 'bg-white/60 dark:bg-white/10 text-indigo-700 dark:text-indigo-300 shadow-sm backdrop-blur-md rounded-xl',
                inactive: 'text-slate-600 dark:text-slate-300 hover:bg-white/30 dark:hover:bg-white/5 rounded-xl',
                footer: 'border-t border-white/20 dark:border-slate-700/50 bg-white/10 dark:bg-black/10',
                sectionTitle: 'text-indigo-400 dark:text-indigo-300/70'
            };
        case 'classic':
            return {
                sidebar: `bg-slate-50 dark:bg-slate-900 ${minimalBorder}`,
                header: 'border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800',
                logo: 'text-teal-700 dark:text-teal-500',
                active: 'bg-teal-600 text-white shadow-md rounded-xl',
                inactive: 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl',
                footer: 'border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800',
                sectionTitle: 'text-teal-600/70 dark:text-teal-500/70'
            };
        default: // aero
            return {
                sidebar: `bg-white dark:bg-slate-900 ${minimalBorder}`,
                header: 'border-b border-slate-100 dark:border-slate-800',
                logo: 'text-blue-600 dark:text-blue-500',
                active: 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 rounded-xl',
                inactive: 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl',
                footer: 'border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30',
                sectionTitle: 'text-slate-400 dark:text-slate-500'
            };
    }
  };

  const designClasses = getDesignClasses();

  return (
    <>
        {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}
        
        <aside className={`${baseClasses} ${isSidebarOpen ? openClasses : closedClasses} ${designClasses.sidebar}`}>
            {/* Header with Continuous Animation Loop */}
            <div className={`flex items-center justify-center h-20 flex-shrink-0 ${designClasses.header}`}>
                <div className="flex items-center">
                    {/* Logo - Always Visible */}
                    <div className="flex-shrink-0 z-10 bg-white dark:bg-slate-900 rounded-full">
                        {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
                        ) : (
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                                A
                            </div>
                        )}
                    </div>
                    
                    {/* Animated Text Container - Expands and Retracts */}
                    <div className="animate-reveal-loop">
                        <div>
                            <h1 className={`text-xl font-bold ${designClasses.logo} tracking-tight leading-none whitespace-nowrap`}>
                                {settings.appName || 'Aero'}
                            </h1>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">Edition</span>
                        </div>
                    </div>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-6 custom-scrollbar flex flex-col">
                {navGroups.map((group, groupIndex) => (
                    <div key={groupIndex}>
                        {/* Section Header (Only show if there are items and it's not the only group) */}
                        {navGroups.length > 1 && group.items.length > 0 && (
                            <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 px-4 ${designClasses.sectionTitle}`}>
                                {group.title}
                            </div>
                        )}
                        
                        <div className="space-y-1.5">
                            {group.items.map(item => {
                                const isActive = page === item.id;
                                return (
                                    <a
                                        key={item.id}
                                        href="#"
                                        onClick={(e) => { 
                                            e.preventDefault(); 
                                            if (item.id === 'settings') {
                                                if (can('manage_appearance')) {
                                                    setSettingsPage('appearance');
                                                } else {
                                                    setSettingsPage('general');
                                                }
                                                handleNavigation('settings');
                                            } else {
                                                handleNavigation(item.id as Page);
                                            }
                                        }}
                                        className={`flex items-center gap-x-3 px-4 py-2.5 transition-all duration-200 group ${
                                        isActive
                                        ? designClasses.active
                                        : designClasses.inactive
                                        }`}
                                    >
                                        <item.icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${isActive ? 'text-white dark:text-white' : 'opacity-70 group-hover:opacity-100'}`} />
                                        <span className="font-medium text-sm">{item.label}</span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {deferredPrompt && (
                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                            onClick={installPwa}
                            className={`w-full flex items-center gap-x-3 px-4 py-3 transition-all duration-200 group ${designClasses.inactive} bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400`}
                        >
                            <DownloadIcon className="h-5 w-5 transition-transform group-hover:scale-110" />
                            <div className="text-right">
                                <span className="font-bold text-sm block">تثبيت التطبيق</span>
                                <span className="text-[10px] opacity-70">تجربة أسرع وأفضل</span>
                            </div>
                        </button>
                    </div>
                )}
            </nav>

            {authUser && (
                <div className={`p-4 flex-shrink-0 ${designClasses.footer}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border-2 border-white dark:border-slate-600 shadow-sm">
                            {authUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {authUser.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {authUser.role === 'general_manager' ? 'مدير عام' : authUser.role === 'manager' ? 'مدير' : authUser.role === 'receptionist' ? 'استقبال' : 'موظف'}
                            </p>
                        </div>
                        <button 
                            onClick={logout} 
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="تسجيل الخروج"
                        >
                            <LogOutIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </aside>
    </>
  );
};

export default Sidebar;
