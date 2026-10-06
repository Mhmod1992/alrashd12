
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import SunIcon from './icons/SunIcon';
import MoonIcon from './icons/MoonIcon';
import SearchIcon from './icons/SearchIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import LogOutIcon from './icons/LogOutIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import SettingsIcon from './icons/SettingsIcon';
import BellIcon from './icons/BellIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import WifiOffIcon from './icons/WifiOffIcon';
import MailIcon from './icons/MailIcon';
import WhatsappIcon from './icons/WhatsappIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import CheckCheckIcon from './icons/CheckCheckIcon';
import FileTextIcon from './icons/FileTextIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import TrashIcon from './icons/TrashIcon';
import XIcon from './icons/XIcon';
import { AppNotification } from '../types';
import { timeAgo, formatOnlineDuration, formatOfflineDuration } from '../lib/utils';

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const { 
    theme, toggleTheme, authUser, logout, settings,
    appNotifications, markNotificationAsRead, deleteNotification, markAllNotificationsAsRead, 
    setPage, setSelectedRequestId, fetchAndUpdateSingleRequest, isOnline, realtimeStatus, retryConnection, refreshSessionAndReload,
    unreadMessagesCount, setIsMailboxOpen, searchRequestByNumber, clearSearchedRequests, searchedRequests,
    searchQuery, setSearchQuery, can,
    unreadWhatsAppCount, latestWhatsAppMessage, setLatestWhatsAppMessage,
    whatsappApiStatus, onlineEmployeeIds, onlineStaffMap, lastSeenStaffMap, activeStaffAlert, dismissActiveStaffAlert, employees, technicians
  } = useAppContext();

  const design = settings.design || 'aero';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'all' | 'unread' | 'logins' | 'online'>('all');
  const [isHardRefreshing, setIsHardRefreshing] = useState(false);

  const handleHardRefresh = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsHardRefreshing(true);
    try {
      // 1. Clear all CacheStorage (PWA & static assets)
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((name) => caches.delete(name)));
      }

      // 2. Unregister all service workers to force fresh installation
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      // 3. Clear transient storage
      try {
        sessionStorage.clear();
      } catch (err) {
        console.warn('Could not clear sessionStorage:', err);
      }

      // 4. Force hard reload with timestamp query param to bypass all proxy/browser caches
      const url = new URL(window.location.href);
      url.searchParams.set('_nocache', Date.now().toString());
      window.location.href = url.toString();
    } catch (err) {
      console.error('Hard refresh failed:', err);
      window.location.reload();
    }
  };
  
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  
  // Calculate unread count strictly
  const unreadCount = useMemo(() => appNotifications.filter(n => !n.is_read).length, [appNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleToggleNotifications = () => {
    setIsNotificationsOpen(!isNotificationsOpen);
    // If opening, and we have unread messages, default to unread tab for better UX
    if (!isNotificationsOpen) {
        if (unreadCount > 0) {
            setNotificationTab('unread');
        } else {
            setNotificationTab('all');
        }
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    // 1. Mark as read immediately
    markNotificationAsRead(notification.id);
    
    // 2. Navigation logic
    if (notification.link) {
        if (notification.link_id) {
            await fetchAndUpdateSingleRequest(notification.link_id);
            setSelectedRequestId(notification.link_id);
        }
        setPage(notification.link);
        setIsNotificationsOpen(false);
    }
  };

  const handleQuickSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && searchQuery.trim()) {
          await searchRequestByNumber(searchQuery);
          setPage('requests');
      }
  };

  const handleClearSearch = () => {
      setSearchQuery('');
      clearSearchedRequests();
  };

  const getGlassClasses = () => {
      const intensity = settings.glassmorphismIntensity || 5;
      const blurLevels: { [key: number]: string } = {1: 'sm', 2: 'sm', 3: '', 4: '', 5: 'md', 6: 'md', 7: 'lg', 8: 'lg', 9: 'xl', 10: 'xl' };
      const blur = blurLevels[intensity] || 'md';
      const blurClass = `backdrop-blur${blur ? `-${blur}` : ''}`;

      return {
          header: `${blurClass} border-b border-white/20 dark:border-slate-700/50`,
          dropdown: `backdrop-blur-lg border dark:border-slate-700`,
      };
  };

  const { headerClasses, menuDropdownClasses, headerStyleValue, dropdownStyleValue } = useMemo(() => {
      const headerStylePref = settings.headerStyle || 'default';
      const intensity = settings.glassmorphismIntensity || 5;
      const opacity = Math.max(0, 1.0 - (intensity * 0.065));
      const darkOpacity = Math.max(0, 1.0 - (intensity * 0.05));

      if (design === 'glass') {
          const classes = getGlassClasses();
          const elevatedShadow = headerStylePref === 'elevated' ? 'shadow-xl' : 'shadow-lg';
          return { 
              headerClasses: `${classes.header} ${elevatedShadow}`, 
              menuDropdownClasses: classes.dropdown,
              headerStyleValue: {
                  backgroundColor: theme === 'light' 
                      ? `rgba(255, 255, 255, ${opacity.toFixed(2)})` 
                      : `rgba(15, 23, 42, ${darkOpacity.toFixed(2)})`
              },
              dropdownStyleValue: {
                  backgroundColor: theme === 'light'
                      ? `rgba(255, 255, 255, ${Math.min(1.0, opacity + 0.3).toFixed(2)})`
                      : `rgba(15, 23, 42, ${Math.min(1.0, darkOpacity + 0.2).toFixed(2)})`
              }
          };
      }
      
      const elevatedShadow = headerStylePref === 'elevated' ? 'shadow-lg' : 'shadow-sm';

      return {
          headerClasses: `bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 ${elevatedShadow}`,
          menuDropdownClasses: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
          headerStyleValue: {},
          dropdownStyleValue: {}
      };
  }, [design, settings.glassmorphismIntensity, settings.headerStyle, theme]);

  // Filtering Logic: 
  // If tab is 'unread', strictly filter out read items.
  // Dependencies ensure this re-runs immediately when appNotifications changes.
  const filteredNotifications = useMemo(() => {
      if (notificationTab === 'unread') {
          return appNotifications.filter(n => !n.is_read);
      }
      if (notificationTab === 'logins') {
          return appNotifications.filter(n => n.type === 'login');
      }
      return appNotifications;
  }, [appNotifications, notificationTab]);

  const getNotificationIcon = (type: string) => {
      switch(type) {
          case 'new_request': return <FileTextIcon className="w-5 h-5 text-blue-600 dark:text-blue-300" />;
          case 'status_change': return <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />;
          case 'login': return <UserCircleIcon className="w-5 h-5 text-purple-600 dark:text-purple-300" />;
          case 'warning': return <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-300" />;
          case 'delete_request': return <TrashIcon className="w-5 h-5 text-red-600 dark:text-red-300" />;
          default: return <BellIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />;
      }
  };

  const getNotificationBg = (type: string) => {
      switch(type) {
          case 'new_request': return 'bg-blue-100 dark:bg-blue-900/40';
          case 'status_change': return 'bg-emerald-100 dark:bg-emerald-900/40';
          case 'login': return 'bg-purple-100 dark:bg-purple-900/40';
          case 'warning': return 'bg-amber-100 dark:bg-amber-900/40';
          case 'delete_request': return 'bg-red-100 dark:bg-red-900/40';
          default: return 'bg-slate-100 dark:bg-slate-700';
      }
  };

  const isSearchActive = searchQuery.length > 0 || searchedRequests !== null;

  useEffect(() => {
    if (latestWhatsAppMessage) {
      const timer = setTimeout(() => {
        setLatestWhatsAppMessage(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [latestWhatsAppMessage, setLatestWhatsAppMessage]);

  return (
    <header className={`relative flex items-center justify-between h-20 px-6 gap-6 z-40 no-print ${headerClasses}`} style={headerStyleValue}>
      
      {/* Left Side: Mobile/Tablet Toggle & Search */}
      <div className="flex items-center flex-1 max-w-2xl">
        {/* Toggle Button visible up to LG breakpoint (1024px) */}
        <button onClick={toggleSidebar} className="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-lg focus:outline-none lg:hidden me-2 transition-colors">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </button>
        
        {/* Modern Search Bar - Removed as per user request */}
{/*         <div className="relative w-full max-w-md hidden md:block group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none transition-colors group-focus-within:text-blue-500">
               <SearchIcon className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </span>
            <input 
                className={`w-full py-2.5 pl-10 pr-4 text-sm text-slate-700 bg-slate-100/50 dark:bg-slate-700/50 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-full focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-400 transition-all shadow-sm placeholder-slate-400 ${isSearchActive ? 'pr-10' : ''}`} 
                type="text" 
                placeholder="بحث سريع عن الطلبات، العملاء..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleQuickSearch}
            />
            {isSearchActive && (
                <button 
                    onClick={handleClearSearch}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-blue-500 transition-colors animate-fade-in"
                    title="مسح البحث"
                >
                    <XIcon className="h-5 w-5" />
                </button>
            )}
        </div> */}
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2">
         
         {(import.meta as any).env?.DEV && (
            <div 
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300 rounded-full text-xs font-bold border border-amber-500/25 shadow-sm"
                title="أنت الآن في بيئة التطوير (DEV) - كاش حماية باقة سوبابيس مفعل"
            >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="hidden sm:inline">🛠️ وضع التطوير</span>
                <span className="sm:hidden">🛠️ DEV</span>
            </div>
         )}
         
         <div className="hidden sm:flex items-center me-2">
            {!isOnline ? (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-bold animate-pulse shadow-sm border border-red-100 dark:border-red-900/50" title="لا يوجد اتصال بالإنترنت">
                    <WifiOffIcon className="w-3.5 h-3.5" />
                    <span>بلا اتصال</span>
                </div>
            ) : realtimeStatus === 'connecting' ? (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs font-bold border border-yellow-100 dark:border-yellow-900/50" title="جاري الاتصال بالخادم...">
                    <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />
                    <span>اتصال...</span>
                </div>
            ) : realtimeStatus === 'disconnected' ? (
                <button onClick={() => refreshSessionAndReload()} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 rounded-full text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" title="فشل الاتصال بالخادم. اضغط لإعادة المحاولة.">
                    <WifiOffIcon className="w-3.5 h-3.5" />
                    <span>تحديث الاتصال</span>
                </button>
            ) : null}
         </div>

        <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all focus:outline-none">
          {theme === 'light' ? <MoonIcon className="h-6 w-6" /> : <SunIcon className="h-6 w-6" />}
        </button>
        
        <div className="relative">
            <button 
                onClick={() => setIsMailboxOpen(true)} 
                className={`p-2 rounded-full transition-all focus:outline-none ${unreadMessagesCount > 0 ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-700'}`}
                title="صندوق البريد"
            >
                <MailIcon className="h-6 w-6" />
                {unreadMessagesCount > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800 animate-ping"></span>
                )}
                {unreadMessagesCount > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800"></span>
                )}
            </button>
        </div>

        <div className="relative flex items-center gap-1.5">
            {settings.whatsappMode === 'api' && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-all duration-300 ${
                    whatsappApiStatus === 'connected'
                        ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40 border border-emerald-200/40 dark:border-emerald-800/20'
                        : whatsappApiStatus === 'checking'
                        ? 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/40 border border-yellow-200/40 dark:border-yellow-800/20 animate-pulse'
                        : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/40 border border-red-200/40 dark:border-red-800/20'
                }`}>
                    {whatsappApiStatus === 'connected' ? 'متصل' : whatsappApiStatus === 'checking' ? 'جاري التحقق...' : 'غير متصل'}
                </span>
            )}
            <button 
                onClick={() => setPage('whatsapp-inbox')} 
                className={`p-2 rounded-full transition-all duration-300 focus:outline-none relative flex items-center justify-center ${
                    settings.whatsappMode === 'api'
                        ? whatsappApiStatus === 'connected'
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400'
                            : whatsappApiStatus === 'checking'
                            ? 'bg-yellow-500/10 text-yellow-500 dark:text-yellow-400'
                            : 'bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 font-bold'
                        : unreadWhatsAppCount > 0
                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
                        : 'text-slate-500 hover:text-emerald-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-slate-700'
                }`}
                title={
                    settings.whatsappMode === 'api'
                        ? whatsappApiStatus === 'connected'
                            ? 'خدمة الواتساب متصلة (تلقائي)'
                            : whatsappApiStatus === 'checking'
                            ? 'جاري التحقق من اتصال الواتساب...'
                            : 'خدمة الواتساب غير متصلة! (انقر لفتح الوارد)'
                        : 'رسائل الواتساب'
                }
            >
                <WhatsappIcon 
                    className={`h-6 w-6 transition-all duration-300 ${
                        settings.whatsappMode === 'api'
                            ? whatsappApiStatus === 'connected'
                                ? '[filter:drop-shadow(0_0_6px_rgba(16,185,129,0.8))] text-emerald-500 dark:text-emerald-400'
                                : whatsappApiStatus === 'checking'
                                ? '[filter:drop-shadow(0_0_4px_rgba(234,179,8,0.6))] text-yellow-500 dark:text-yellow-400 animate-pulse'
                                : '[filter:drop-shadow(0_0_8px_rgba(239,68,68,0.8))] text-red-500 dark:text-red-400 animate-pulse'
                            : ''
                    }`} 
                />
                {unreadWhatsAppCount > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800 animate-ping"></span>
                )}
                {unreadWhatsAppCount > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800"></span>
                )}
            </button>

            <AnimatePresence>
                {latestWhatsAppMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute top-full left-0 mt-3 w-72 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-emerald-100 dark:border-emerald-900/50 shadow-2xl rounded-2xl p-4 z-50 cursor-pointer group pointer-events-auto origin-top-left"
                        onClick={() => {
                            setPage('whatsapp-inbox');
                            setLatestWhatsAppMessage(null);
                        }}
                    >
                        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white/95 dark:bg-slate-800/95 border-t border-l border-emerald-100 dark:border-emerald-900/50 rotate-45"></div>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setLatestWhatsAppMessage(null);
                            }}
                            className="absolute top-2 left-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            <XIcon className="w-3 h-3" />
                        </button>
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200/50 dark:border-emerald-800/50 shadow-sm">
                                {(latestWhatsAppMessage.name || 'ع').charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate mb-1">
                                    {latestWhatsAppMessage.name || latestWhatsAppMessage.phone}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                    {latestWhatsAppMessage.message}
                                </p>
                            </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-end gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                            <span>الآن على واتساب</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        <div className="relative" ref={notificationsRef}>
            <button 
                onClick={handleToggleNotifications} 
                className={`p-2 rounded-full transition-all focus:outline-none relative ${isNotificationsOpen ? 'bg-blue-50 text-blue-600 dark:bg-slate-700 dark:text-blue-400' : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-700'}`}
            >
                <BellIcon className={`h-6 w-6 ${unreadCount > 0 ? 'animate-wiggle' : ''}`} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-slate-800"></span>
                    </span>
                )}
            </button>

            {isNotificationsOpen && (
                <div 
                    className={`
                        fixed left-4 right-4 top-20 w-auto md:absolute md:inset-auto md:left-0 md:top-full md:mt-3 md:w-96
                        rounded-2xl shadow-2xl z-50 overflow-hidden transform origin-top transition-all duration-200 animate-slide-in-down 
                        ${menuDropdownClasses}
                    `}
                    style={dropdownStyleValue}
                >
                    <div className="px-4 py-3 border-b dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">الإشعارات</h3>
                        {unreadCount > 0 && (
                            <button 
                                onClick={markAllNotificationsAsRead}
                                className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full transition-colors"
                            >
                                <CheckCheckIcon className="w-3.5 h-3.5" />
                                قراءة الكل
                            </button>
                        )}
                    </div>

                    <div className="flex bg-slate-50 dark:bg-slate-800/80 p-1 border-b dark:border-slate-700">
                        <button 
                            onClick={() => setNotificationTab('all')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${notificationTab === 'all' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            الكل ({appNotifications.length})
                        </button>
                        <button 
                            onClick={() => setNotificationTab('unread')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${notificationTab === 'unread' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            غير مقروء ({unreadCount})
                        </button>
                        <button 
                            onClick={() => setNotificationTab('logins')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${notificationTab === 'logins' ? 'bg-white dark:bg-slate-600 shadow-sm text-purple-600 dark:text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            الدخول ({appNotifications.filter(n => n.type === 'login').length})
                        </button>
                        <button 
                            onClick={() => setNotificationTab('online')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${notificationTab === 'online' ? 'bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>النشطون ({onlineEmployeeIds?.size || 0})</span>
                        </button>
                    </div>
                    
                    <div className="max-h-[60vh] md:max-h-[350px] overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30">
                        {notificationTab === 'online' ? (
                            <div className="p-2 space-y-1">
                                {[...employees.filter(e => e.is_active)].sort((a, b) => {
                                    const aOnline = onlineEmployeeIds?.has(a.id) ? 1 : 0;
                                    const bOnline = onlineEmployeeIds?.has(b.id) ? 1 : 0;
                                    if (aOnline !== bOnline) return bOnline - aOnline; // Online first
                                    return a.name.localeCompare(b.name, 'ar');
                                }).map(emp => {
                                    const isEmpOnline = !!onlineEmployeeIds?.has(emp.id);
                                    const staffInfo = onlineStaffMap?.[emp.id];
                                    const durationText = isEmpOnline 
                                        ? formatOnlineDuration(staffInfo?.online_at)
                                        : formatOfflineDuration(lastSeenStaffMap?.[emp.id]);

                                    return (
                                        <div 
                                            key={emp.id} 
                                            className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${isEmpOnline ? 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isEmpOnline ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
                                                        {emp.name.charAt(0)}
                                                    </div>
                                                    {isEmpOnline ? (
                                                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-slate-800"></span>
                                                        </span>
                                                    ) : (
                                                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-800"></span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-xs font-bold ${isEmpOnline ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{emp.name}</p>
                                                        {emp.id === authUser?.id && (
                                                            <span className="text-[9px] bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">أنت</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400">
                                                        {(emp.role as string) === 'general_manager' ? 'مدير عام' : (emp.role as string) === 'manager' ? 'مدير' : (emp.role as string) === 'receptionist' ? 'استقبال' : (emp.role as string) === 'technician' ? 'فني' : 'موظف'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {isEmpOnline ? (
                                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300/60 dark:border-emerald-700/50 shadow-sm">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        <span>{durationText}</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-slate-700/50">
                                                        {durationText}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : filteredNotifications.length > 0 ? (
                            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {filteredNotifications.slice(0, 20).map(notification => (
                                    <div 
                                        key={notification.id} 
                                        onClick={() => handleNotificationClick(notification)} 
                                        className={`flex items-start gap-3 p-4 transition-all cursor-pointer relative group ${!notification.is_read ? 'bg-blue-50/60 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                    >
                                        {!notification.is_read && (
                                            <span className="absolute top-4 left-4 h-2 w-2 rounded-full bg-blue-500 shadow-sm ring-2 ring-blue-200 dark:ring-blue-900"></span>
                                        )}
                                        
                                        <div className={`p-2.5 rounded-xl flex-shrink-0 ${getNotificationBg(notification.type)} shadow-sm`}>
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1 gap-2">
                                                <p className={`text-sm leading-tight ${!notification.is_read ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                                    {notification.title}
                                                </p>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                                                    {timeAgo(notification.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                                {(() => {
                                                    const message = notification.message;
                                                    // 1. Handle explicit bolding with stars
                                                    const parts = message.split(/(\*\*.*?\*\*)/);
                                                    if (parts.length > 1) {
                                                        return parts.map((part, i) => {
                                                            if (part.startsWith('**') && part.endsWith('**')) {
                                                                const content = part.slice(2, -2);
                                                                return <strong key={i} className="text-slate-700 dark:text-slate-200 font-bold">{content}</strong>;
                                                            }
                                                            return part;
                                                        });
                                                    }

                                                    // 2. Fallback for login notifications without stars
                                                    if (notification.type === 'login') {
                                                        const loginRegex = /(قام\s+)(.*?)(\s+بتسجيل)/;
                                                        const match = message.match(loginRegex);
                                                        if (match) {
                                                            const name = match[2];
                                                            const before = message.substring(0, match.index! + match[1].length);
                                                            const after = message.substring(match.index! + match[1].length + name.length);
                                                            return (
                                                                <>
                                                                    {before}
                                                                    <strong className="text-slate-700 dark:text-slate-200 font-bold">{name}</strong>
                                                                    {after}
                                                                </>
                                                            );
                                                        }
                                                    }
                                                    
                                                    return message;
                                                })()}
                                            </p>
                                            {notification.created_by_name && (
                                                <p className="text-[10px] text-slate-400 mt-1">بواسطة: {notification.created_by_name}</p>
                                            )}
                                            
                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!notification.is_read && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); markNotificationAsRead(notification.id); }}
                                                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                                    >
                                                        تمت القراءة
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                                                    className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline"
                                                >
                                                    حذف
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-16 px-6 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-3">
                                    <BellIcon className="w-10 h-10 opacity-30" />
                                </div>
                                <p className="font-medium text-sm">لا توجد إشعارات {notificationTab === 'unread' ? 'غير مقروءة' : notificationTab === 'logins' ? 'تسجيل دخول' : 'حالياً'}.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {authUser && (
          <div className="relative ps-2 border-s border-slate-200 dark:border-slate-700" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all focus:outline-none"
            >
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold text-sm">
                    {authUser.name.charAt(0).toUpperCase()}
                </div>
              <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isMenuOpen && (
              <div 
                className={`absolute left-0 mt-3 w-56 rounded-xl shadow-xl z-50 animate-slide-in-down overflow-hidden ${menuDropdownClasses}`}
                style={dropdownStyleValue}
              >
                <div className="p-4 border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{authUser.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{authUser.email}</p>
                </div>
                <div className="p-1">
                    <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage('profile'); setIsMenuOpen(false); }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <UserCircleIcon className="w-5 h-5 text-slate-400" />
                        <span>الملف الشخصي</span>
                    </a>

                    {can('view_settings') && (
                        <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); setPage('settings'); setIsMenuOpen(false); }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <SettingsIcon className="w-5 h-5 text-slate-400" />
                            <span>الإعدادات</span>
                        </a>
                    )}
                    
                    <button
                        type="button"
                        onClick={handleHardRefresh}
                        disabled={isHardRefreshing}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors text-right group disabled:opacity-60"
                        title="جلب أحدث نسخة وتفريغ ذاكرة الكاش (Ctrl + F5)"
                    >
                        <div className="flex items-center gap-3">
                            <RefreshCwIcon className={`w-5 h-5 text-blue-600 dark:text-blue-400 transition-transform ${isHardRefreshing ? 'animate-spin' : 'group-hover:rotate-180 duration-500'}`} />
                            <div className="flex flex-col text-right">
                                <span className="font-semibold">{isHardRefreshing ? 'جاري جلب أحدث نسخة...' : 'جلب أحدث نسخة'}</span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">بديل Ctrl + F5 ومسح الكاش</span>
                            </div>
                        </div>
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 flex-shrink-0">
                            F5 ⚡
                        </span>
                    </button>

                    <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); logout(); setIsMenuOpen(false); }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                    <LogOutIcon className="w-5 h-5" />
                    <span>تسجيل الخروج</span>
                    </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real-time Alert Toast for General Manager when staff joins (Desktop/Laptops only - hidden on mobile) */}
      <AnimatePresence>
        {authUser?.role === 'general_manager' && activeStaffAlert && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="hidden lg:block fixed top-20 left-8 z-50 w-80 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-emerald-500/40 p-4 overflow-hidden"
          >
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-green-500 animate-pulse"></div>
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0 mt-0.5">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-500/30">
                  {activeStaffAlert.name.charAt(0)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-slate-800"></span>
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    تنبيه المدير العام
                  </span>
                  <button
                    onClick={dismissActiveStaffAlert}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1 leading-snug">
                  الموظف <span className="text-emerald-600 dark:text-emerald-400 font-black">{activeStaffAlert.name}</span> متواجد الآن داخل النظام
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 text-[10px] text-slate-400">
                  <span>الدور: {activeStaffAlert.role === 'general_manager' ? 'مدير عام' : activeStaffAlert.role === 'manager' ? 'مدير' : activeStaffAlert.role === 'receptionist' ? 'استقبال' : activeStaffAlert.role === 'technician' ? 'فني' : 'موظف'}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">الآن 🟢</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
