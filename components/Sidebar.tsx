
import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import HomeIcon from './icons/HomeIcon';
import FileTextIcon from './icons/FileTextIcon';
import UsersIcon from './icons/UsersIcon';
import WhatsappIcon from './icons/WhatsappIcon';
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
  const { 
    page, setPage, can, settings, setSettingsPage, authUser, logout, 
    deferredPrompt, installPwa, clearSearchedRequests, 
    isSettingsLoaded, isInitializedFromCache 
  } = useAppContext();
  const design = settings.design || 'aero';

  const handleNavigation = (view: Page) => {
    if (view === 'requests') {
        clearSearchedRequests();
        window.sessionStorage.setItem('resetRequestsFilters', 'true');
    }
    setPage(view);
    if (window.innerWidth < 1024) { 
        setSidebarOpen(false);
    }
  };

  // Grouped Navigation Items
  const navGroups = useMemo(() => {
    // Group 1: Core Operations (العمليات الأساسية)
    const coreOperations = [];
    if (can('view_dashboard')) {
        coreOperations.push({ id: 'dashboard', label: 'لوحة التحكم', icon: HomeIcon });
    }
    if (can('view_requests_list') && authUser?.role !== 'receptionist') {
        coreOperations.push({ id: 'requests', label: 'الطلبات النشطة', icon: FileTextIcon });
    }
    if (authUser?.role === 'receptionist' || can('view_waiting_requests')) {
        coreOperations.push({ id: 'waiting-requests', label: 'بانتظار الدفع', icon: DollarSignIcon });
    }
    coreOperations.push({ id: 'whatsapp-inbox', label: 'صندوق الواتساب', icon: WhatsappIcon });

    // Group 2: Records & Technical (السجلات والفحص)
    const technicalItems = [];
    if (can('manage_reservations')) {
        technicalItems.push({ id: 'reservations', label: 'الحجوزات الواردة', icon: CalendarClockIcon });
    }
    if (can('view_archive')) {
        technicalItems.push({ id: 'archive', label: 'أرشيف الفحص', icon: ArchiveIcon });
    }
    if (can('manage_paper_archive')) {
        technicalItems.push({ id: 'paper-archive', label: 'أرشيف الورقيات', icon: FolderOpenIcon });
    }

    // Group 3: Financials (الإدارة المالية)
    const financialItems = [];
    if (can('view_financials')) {
      financialItems.push({ id: 'financials', label: 'التقارير المالية', icon: TrendingUpIcon });
    }
    if (can('manage_revenues')) {
        financialItems.push({ id: 'revenues', label: 'الإيرادات الأخرى', icon: DollarSignIcon });
    }
    if (can('manage_expenses')) {
        financialItems.push({ id: 'expenses', label: 'إدارة المصروفات', icon: CreditCardIcon });
    }

    // Group 4: Administration (النظام والإدارة)
    const adminItems = [];
    if (can('manage_clients') && authUser?.role !== 'receptionist') {
        adminItems.push({ id: 'clients', label: 'إدارة العملاء', icon: UsersIcon });
    }
    if (can('manage_brokers')) {
        adminItems.push({ id: 'brokers', label: 'إدارة السماسرة', icon: BriefcaseIcon });
    }
    if (can('manage_employees') || can('manage_technicians')) {
        adminItems.push({ id: 'employees', label: 'شؤون الموظفين', icon: UserCircleIcon });
    }
    if (can('view_settings')) {
      adminItems.push({ id: 'settings', label: 'الإعدادات العامة', icon: SettingsIcon });
    }

    return [
        { title: 'العمليات الدورية', items: coreOperations },
        { title: 'الفحص والأرشيف', items: technicalItems },
        { title: 'المالية والمحاسبة', items: financialItems },
        { title: 'النظام والإدارة', items: adminItems }
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
                <div className={`flex items-center transition-opacity duration-500 ease-out ${isSettingsLoaded || isInitializedFromCache ? 'opacity-100' : 'opacity-0'}`}>
                    {/* Logo - Always Visible */}
                    <div className="flex-shrink-0 z-10 bg-white dark:bg-slate-900 rounded-full">
                        {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
                        ) : (
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-slate-400 font-bold text-xl shadow-inner`}>
                                {/* Show A only if loaded and confirmed no logo, otherwise it's just a placeholder block */}
                                {(isSettingsLoaded || isInitializedFromCache) ? 'A' : ''}
                            </div>
                        )}
                    </div>
                    
                    {/* Animated Text Container - Expands and Retracts */}
                    <div className="animate-reveal-loop">
                        <div>
                            <h1 className={`text-xl font-bold ${designClasses.logo} tracking-tight leading-none whitespace-nowrap`}>
                                {(isSettingsLoaded || isInitializedFromCache) ? (settings.appName || 'Aero') : ''}
                            </h1>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block transition-opacity duration-500">
                                {(isSettingsLoaded || isInitializedFromCache) ? 'Edition' : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-6 custom-scrollbar flex flex-col">
                {navGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className={groupIndex > 0 ? "pt-2" : ""}>
                        {/* Section Header */}
                        {navGroups.length > 1 && group.items.length > 0 && (
                            <div className="flex items-center gap-2 mb-3 px-4">
                                <div className={`text-[10px] font-bold uppercase tracking-[0.15em] whitespace-nowrap ${designClasses.sectionTitle}`}>
                                    {group.title}
                                </div>
                                <div className="h-px w-full bg-slate-200 dark:bg-slate-700/50 opacity-50"></div>
                            </div>
                        )}
                        
                        <div className="space-y-1">
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
                                        className={`relative flex items-center gap-x-3 px-4 py-2.5 transition-all duration-300 group overflow-hidden ${
                                        isActive
                                        ? designClasses.active
                                        : designClasses.inactive
                                        }`}
                                    >
                                        {/* Active Indicator Line */}
                                        {isActive && (
                                            <div className="absolute right-0 top-1/4 bottom-1/4 w-1 bg-white dark:bg-white rounded-l-full"></div>
                                        )}
                                        
                                        <item.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white dark:text-white' : 'opacity-70 group-hover:opacity-100'}`} />
                                        <span className={`font-medium text-sm transition-colors duration-300 ${isActive ? 'translate-x-[-2px]' : ''}`}>{item.label}</span>
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
                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-3 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold border-2 border-white dark:border-slate-700 shadow-md">
                                {authUser.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                    {authUser.name}
                                </p>
                                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                                    {authUser.role === 'general_manager' ? 'مدير عام' : authUser.role === 'manager' ? 'مدير' : authUser.role === 'receptionist' ? 'استقبال' : 'موظف'}
                                </p>
                            </div>
                            <button 
                                onClick={logout} 
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all duration-300"
                                title="تسجيل الخروج"
                            >
                                <LogOutIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    </>
  );
};

export default Sidebar;
