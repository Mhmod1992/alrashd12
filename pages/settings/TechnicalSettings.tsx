
import React, { useState } from 'react';
import InspectionSettings from './InspectionSettings';
import CarsManagement from './CarsManagement';
import DraftSettings from './DraftSettings';
import Icon from '../../components/Icon';
import { useAppContext } from '../../context/AppContext';

const TechnicalSettings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'inspection' | 'cars' | 'draft'>('inspection');
    const { settings } = useAppContext();
    const design = settings.design || 'aero';

    const tabs = [
        { id: 'inspection', label: 'باقات وبنود الفحص', icon: 'clipboard-list' },
        { id: 'cars', label: 'قاعدة بيانات السيارات', icon: 'cars' },
        { id: 'draft', label: 'إعدادات المسودة اليدوية', icon: 'edit' },
    ] as const;

    const getTabClass = (isActive: boolean) => {
        if (isActive) {
            return design === 'classic'
                ? 'bg-teal-600 text-white shadow-md'
                : design === 'glass'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-blue-600 text-white shadow-md';
        }
        return 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700';
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-3 p-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${getTabClass(activeTab === tab.id)}`}
                    >
                        <Icon name={tab.icon} className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'inspection' && <InspectionSettings />}
                {activeTab === 'cars' && <CarsManagement />}
                {activeTab === 'draft' && <DraftSettings />}
            </div>
        </div>
    );
};

export default TechnicalSettings;
