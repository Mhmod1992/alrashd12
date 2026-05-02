
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Permission, SettingsPage } from '../types';
import Icon from '../components/Icon';

// Sub-page Imports
import GeneralSettings from './settings/GeneralSettings';
import AppearanceSettings from './settings/AppearanceSettings';
import EmployeesManagement from './settings/EmployeesManagement';
import TechniciansManagement from './settings/TechniciansManagement';
import BrokersManagement from './settings/BrokersManagement';
import InspectionSettings from './settings/InspectionSettings';
import CarsManagement from './settings/CarsManagement';
import DraftSettings from './settings/DraftSettings';
import PlateSettings from './settings/PlateSettings';
import ReportSettingsPage from './settings/ReportSettings'; // Renamed to avoid clash
import DatabaseManagement from './settings/DatabaseManagement'; // Now acts as Maintenance
import StorageManagement from './settings/StorageManagement';
import ApiSettings from './settings/ApiSettings';
import WhatsAppSettings from './settings/WhatsAppSettings';
import ReportsArchive from './settings/ReportsArchive';

// Define the Sidebar Item Interface
interface SidebarItem {
    id: SettingsPage;
    label: string;
    icon: any;
    permission: Permission | null;
    component: React.ComponentType;
}

// Define the Group Interface
interface SidebarGroup {
    title: string;
    items: SidebarItem[];
}

const Settings: React.FC = () => {
    const { settingsPage, setSettingsPage, can, settings, authUser, setIsFocusMode, setPage } = useAppContext();
    const design = settings.design || 'aero';

    // --- Enable Focus Mode on Mount ---
    useEffect(() => {
        setIsFocusMode(true);
        return () => {
            setIsFocusMode(false);
        };
    }, [setIsFocusMode]);

    // --- Configuration: The New Structure ---
    const sidebarGroups: SidebarGroup[] = [
        {
            title: 'عام',
            items: [
                { id: 'general', label: 'بيانات الورشة', icon: 'workshop', permission: 'manage_settings_general', component: GeneralSettings },
                { id: 'appearance', label: 'المظهر والتخصيص', icon: 'appearance', permission: 'manage_appearance', component: AppearanceSettings },
            ]
        },
        {
            title: 'الموارد البشرية',
            items: [
                { id: 'employees', label: 'الموظفين (مستخدمين)', icon: 'users', permission: 'manage_employees', component: EmployeesManagement },
                { id: 'technicians', label: 'الفنيين (عمالة)', icon: 'employee', permission: 'manage_technicians', component: TechniciansManagement },
            ]
        },
        {
            title: 'الفحص والعمليات',
            items: [
                { id: 'request', label: 'باقات وبنود الفحص', icon: 'clipboard-check', permission: 'manage_settings_technical', component: InspectionSettings },
                { id: 'cars', label: 'قاعدة بيانات السيارات', icon: 'cars', permission: 'manage_settings_technical', component: CarsManagement },
                { id: 'draft', label: 'إعدادات المسودة اليدوية', icon: 'edit', permission: 'manage_settings_technical', component: DraftSettings },
                { id: 'plate', label: 'تصميم اللوحة', icon: 'scan-plate', permission: 'manage_settings_technical', component: PlateSettings },
            ]
        },
        {
            title: 'التقارير',
            items: [
                { id: 'report', label: 'إعدادات التقرير النهائي', icon: 'bar-chart', permission: 'manage_settings_general', component: ReportSettingsPage },
                { id: 'reports_archive', label: 'أرشيف ملفات التقرير (Storage)', icon: 'archive', permission: 'manage_settings_general', component: ReportsArchive },
            ]
        },
        {
            title: 'الصيانة والنظام',
            items: [
                { id: 'database', label: 'حالة النظام والصيانة', icon: 'database', permission: 'manage_settings_general', component: DatabaseManagement } as any, 
                { id: 'storage', label: 'إدارة مساحة التخزين', icon: 'archive', permission: 'manage_settings_general', component: StorageManagement },
            ]
        },
        {
            title: 'إعدادات متقدمة',
            items: [
                { id: 'whatsapp', label: 'إعدادات المراسلة (WhatsApp)', icon: 'whatsapp', permission: 'manage_settings_general', component: WhatsAppSettings },
                { id: 'api', label: 'ربط الخدمات (API)', icon: 'sparkles', permission: 'manage_api_keys', component: ApiSettings },
            ]
        }
    ];

    // Filter groups and items based on permissions
    const visibleGroups = useMemo(() => {
        return sidebarGroups.map(group => ({
            ...group,
            items: group.items.filter(item => item.permission === null || can(item.permission))
        })).filter(group => group.items.length > 0);
    }, [authUser, can]);

    // Flatten items for easier lookup
    const allVisibleItems = useMemo(() => visibleGroups.flatMap(g => g.items), [visibleGroups]);

    // Determine Active Component
    const ActiveComponent = useMemo(() => {
        const item = allVisibleItems.find(i => i.id === settingsPage);
        return item?.component || GeneralSettings;
    }, [settingsPage, allVisibleItems]);
    
    // Determine Page Title
    const activeTitle = useMemo(() => {
        return allVisibleItems.find(i => i.id === settingsPage)?.label || 'الإعدادات';
    }, [settingsPage, allVisibleItems]);

    // --- Styling Helpers ---
    const getSidebarItemClass = (isActive: boolean) => {
        if (isActive) {
            return design === 'classic' 
                ? 'bg-teal-50 text-teal-700 border-r-4 border-teal-600 dark:bg-teal-900/30 dark:text-teal-400' 
                : design === 'glass' 
                    ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' 
                    : 'bg-blue-50 text-blue-700 border-r-4 border-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
        }
        return 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-r-4 border-transparent';
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
            {/* Custom Settings Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button 
                        onClick={() => {
                            if (settingsPage) {
                                setSettingsPage(null as any);
                            } else {
                                setPage('requests');
                            }
                        }} 
                        className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-all"
                    >
                         <Icon name="back" className="w-5 h-5 transform scale-x-[-1] transition-transform group-hover:-translate-x-1" />
                         <span className="font-bold text-xs sm:text-sm hidden xs:inline">
                             {settingsPage ? 'العودة للقائمة' : 'العودة للطلبات'}
                         </span>
                    </button>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 sm:mx-2"></div>
                    <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Icon name="settings" className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                        {settingsPage ? activeTitle : 'الإعدادات'}
                    </h1>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                <div className="container mx-auto h-full flex flex-col animate-fade-in">
                    
                    {/* --- SETTINGS GRID MENU (Shown when no page is selected) --- */}
                    {!settingsPage ? (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 custom-scrollbar">
                            <div className="max-w-6xl mx-auto">
                                {visibleGroups.map((group, groupIdx) => (
                                    <div key={groupIdx} className="mb-10">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">
                                            {group.title}
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                            {group.items.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setSettingsPage(item.id)}
                                                    className="group flex flex-col items-center justify-center gap-4 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-blue-500/50 dark:hover:border-blue-400/50 hover:-translate-y-1 active:scale-95 transition-all duration-300"
                                                >
                                                    <div className={`w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center transition-colors ${
                                                        item.id === 'whatsapp' 
                                                        ? 'text-slate-400 group-hover:text-emerald-500 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20' 
                                                        : 'text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20'
                                                    }`}>
                                                        <Icon name={item.icon} className="w-8 h-8" />
                                                    </div>
                                                    <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white text-center leading-tight transition-colors">
                                                        {item.label}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* --- CONTENT AREA (Shown when a page is selected) --- */
                        <main className="flex-1 bg-white dark:bg-slate-900 flex flex-col overflow-hidden h-full">
                            {/* Content Header */}
                            <div className="flex p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                        settingsPage === 'whatsapp'
                                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    }`}>
                                        <Icon name={allVisibleItems.find(i => i.id === settingsPage)?.icon || 'settings'} className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                        {activeTitle}
                                    </h2>
                                </div>
                                <button 
                                    onClick={() => setSettingsPage(null as any)}
                                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                                    title="العودة للقائمة"
                                >
                                    <Icon name="close" className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Content Body */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
                                <div className="max-w-5xl mx-auto">
                                    <ActiveComponent />
                                </div>
                            </div>
                        </main>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
