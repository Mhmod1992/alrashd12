
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
import ApiSettings from './settings/ApiSettings';

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
                { id: 'employees', label: 'الموظفين (مستخدمين)', icon: 'user-circle', permission: 'manage_employees', component: EmployeesManagement },
                { id: 'technicians', label: 'الفنيين (عمالة)', icon: 'briefcase', permission: 'manage_technicians', component: TechniciansManagement },
            ]
        },
        {
            title: 'الفحص والعمليات',
            items: [
                { id: 'request', label: 'باقات وبنود الفحص', icon: 'clipboard-list', permission: 'manage_settings_technical', component: InspectionSettings },
                { id: 'cars', label: 'قاعدة بيانات السيارات', icon: 'cars', permission: 'manage_settings_technical', component: CarsManagement },
                { id: 'draft', label: 'إعدادات المسودة', icon: 'edit', permission: 'manage_settings_technical', component: DraftSettings },
                { id: 'plate', label: 'تصميم اللوحة', icon: 'scan-plate', permission: 'manage_settings_technical', component: PlateSettings },
            ]
        },
        {
            title: 'التقارير',
            items: [
                { id: 'report', label: 'إعدادات التقرير النهائي', icon: 'report', permission: 'manage_settings_general', component: ReportSettingsPage },
            ]
        },
        {
            title: 'الصيانة والنظام',
            items: [
                { id: 'database', label: 'حالة النظام والصيانة', icon: 'refresh-cw', permission: 'manage_settings_general', component: DatabaseManagement } as any, 
            ]
        },
        {
            title: 'إعدادات متقدمة',
            items: [
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
        <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
            {/* Custom Settings Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setPage('requests')} 
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-all"
                    >
                         <Icon name="back" className="w-5 h-5 transform scale-x-[-1] transition-transform group-hover:-translate-x-1" />
                         <span className="font-bold text-sm">العودة للطلبات</span>
                    </button>
                    <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-2"></div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Icon name="settings" className="w-6 h-6 text-slate-400" />
                        الإعدادات
                    </h1>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden p-4 sm:p-6">
                <div className="container mx-auto h-full flex flex-col md:flex-row gap-6 animate-fade-in">
                    
                    {/* --- SIDEBAR (Desktop) --- */}
                    <aside className="hidden md:flex flex-col w-64 flex-shrink-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden h-full">
                        <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">القائمة</span>
                        </div>
                        
                        <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                            {visibleGroups.map((group, groupIdx) => (
                                <div key={groupIdx} className="mb-2">
                                    <h3 className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {group.title}
                                    </h3>
                                    <div className="space-y-0.5">
                                        {group.items.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => setSettingsPage(item.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-all duration-200 ${getSidebarItemClass(settingsPage === item.id)}`}
                                            >
                                                <Icon name={item.icon} className={`w-5 h-5 ${settingsPage === item.id ? 'opacity-100' : 'opacity-70'}`} />
                                                <span>{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </nav>
                    </aside>

                    {/* --- MOBILE NAV (Horizontal Scroll) --- */}
                    <div className="md:hidden flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar p-1">
                        <div className="flex gap-2">
                            {allVisibleItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setSettingsPage(item.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                                        settingsPage === item.id 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    <Icon name={item.icon} className="w-4 h-4" />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* --- CONTENT AREA --- */}
                    <main className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden h-full">
                        {/* Content Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/50 flex-shrink-0">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 animate-fade-in">
                                {activeTitle}
                            </h2>
                        </div>

                        {/* Content Body */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <ActiveComponent />
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Settings;
