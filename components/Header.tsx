
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import SunIcon from './icons/SunIcon';
import MoonIcon from './icons/MoonIcon';
import SearchIcon from './icons/SearchIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import LogOutIcon from './icons/LogOutIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import BellIcon from './icons/BellIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import WifiOffIcon from './icons/WifiOffIcon';
import MailIcon from './icons/MailIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import CheckCheckIcon from './icons/CheckCheckIcon';
import FileTextIcon from './icons/FileTextIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import TrashIcon from './icons/TrashIcon';
import XIcon from './icons/XIcon';
import { AppNotification } from '../types';
import { timeAgo } from '../lib/utils';

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const { 
    theme, toggleTheme, authUser, logout, settings,
    appNotifications, markNotificationAsRead, markAllNotificationsAsRead, 
    setPage, setSelectedRequestId, fetchAndUpdateSingleRequest, isOnline, realtimeStatus, retryConnection, refreshSessionAndReload,
    unreadMessagesCount, setIsMailboxOpen, searchRequestByNumber, clearSearchedRequests, searchedRequests
  } = useAppContext();

  const design = settings.design || 'aero';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
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
      const opacity = 1.0 - (intensity * 0.065);
      const darkOpacity = 1.0 - (intensity * 0.05);
      const blurLevels: { [key: number]: string } = {1: 'sm', 2: 'sm', 3: '', 4: '', 5: 'md', 6: 'md', 7: 'lg', 8: 'lg', 9: 'xl', 10: 'xl' };
      const blur = blurLevels[intensity] || 'md';
      const blurClass = `backdrop-blur${blur ? `-${blur}` : ''}`;
      const glassBg = `bg-white/[${opacity.toFixed(2)}] dark:bg-slate-800/[${darkOpacity.toFixed(2)}] ${blurClass}`;

      return {
          header: `${glassBg} border-b border-white/20 dark:border-slate-700/50`,
          dropdown: `bg-white/[${(opacity + 0.3).toFixed(2)}] dark:bg-slate-800/[${(darkOpacity + 0.2).toFixed(2)}] backdrop-blur-lg border dark:border-slate-700`,
      };
  };

  const { headerClasses, menuDropdownClasses } = useMemo(() => {
      const headerStyle = settings.headerStyle || 'default';

      if (design === 'glass') {
          const classes = getGlassClasses();
          const elevatedShadow = headerStyle === 'elevated' ? 'shadow-xl' : 'shadow-lg';
          return { headerClasses: `${classes.header} ${elevatedShadow}`, menuDropdownClasses: classes.dropdown };
      }
      
      const elevatedShadow = headerStyle === 'elevated' ? 'shadow-lg' : 'shadow-sm';

      return {
          headerClasses: `bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 ${elevatedShadow}`,
          menuDropdownClasses: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
      };
  }, [design, settings.glassmorphismIntensity, settings.headerStyle]);

  // Filtering Logic: 
  // If tab is 'unread', strictly filter out read items.
  // Dependencies ensure this re-runs immediately when appNotifications changes.
  const filteredNotifications = useMemo(() => {
      if (notificationTab === 'unread') {
          return appNotifications.filter(n => !n.is_read);
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

  return (
    <header className={`relative flex items-center justify-between h-20 px-6 gap-6 z-40 ${headerClasses}`}>
      
      {/* Left Side: Mobile/Tablet Toggle & Search */}
      <div className="flex items-center flex-1 max-w-2xl">
        {/* Toggle Button visible up to LG breakpoint (1024px) */}
        <button onClick={toggleSidebar} className="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-lg focus:outline-none lg:hidden me-2 transition-colors">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </button>
        
        {/* Modern Search Bar */}
        <div className="relative w-full max-w-md hidden md:block group">
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
        </div>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2">
         
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
                <button onClick={refreshSessionAndReload} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 rounded-full text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" title="فشل الاتصال بالخادم. اضغط لإعادة المحاولة.">
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
                <div className={`
                    fixed left-4 right-4 top-20 w-auto md:absolute md:inset-auto md:left-0 md:top-full md:mt-3 md:w-96
                    rounded-2xl shadow-2xl z-50 overflow-hidden transform origin-top transition-all duration-200 animate-slide-in-down 
                    ${menuDropdownClasses}
                `}>
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
                    </div>
                    
                    <div className="max-h-[60vh] md:max-h-[350px] overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30">
                        {filteredNotifications.length > 0 ? (
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
                                                {notification.message}
                                            </p>
                                            {notification.created_by_name && (
                                                <p className="text-[10px] text-slate-400 mt-1">بواسطة: {notification.created_by_name}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-16 px-6 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-3">
                                    <BellIcon className="w-10 h-10 opacity-30" />
                                </div>
                                <p className="font-medium text-sm">لا توجد إشعارات {notificationTab === 'unread' ? 'غير مقروءة' : 'حالياً'}.</p>
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
              <div className={`absolute left-0 mt-3 w-56 rounded-xl shadow-xl z-50 animate-slide-in-down overflow-hidden ${menuDropdownClasses}`}>
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
                    
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); refreshSessionAndReload(); setIsMenuOpen(false); }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                        <RefreshCwIcon className="w-5 h-5" />
                        <span>تحديث النظام</span>
                    </a>

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
    </header>
  );
};

export default Header;
