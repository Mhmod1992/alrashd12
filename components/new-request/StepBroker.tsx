
import React from 'react';
import { Broker } from '../../types';

interface StepBrokerProps {
    useBroker: boolean;
    setUseBroker: (val: boolean) => void;
    brokerId: string;
    setBrokerId: (val: string) => void;
    brokerCommission: number;
    setBrokerCommission: (val: number) => void;
    brokers: Broker[];
}

const StepBroker: React.FC<StepBrokerProps> = ({ 
    useBroker, setUseBroker, brokerId, setBrokerId, 
    brokerCommission, setBrokerCommission, brokers 
}) => {
    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    return (
        <fieldset className="bg-white dark:bg-slate-800/50 p-4 sm:p-6 rounded-lg shadow-sm">
            <legend className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                السمسار وإنهاء
            </legend>

            <div className="mb-4">
                <div className="flex items-center">
                    <input 
                        type="checkbox" 
                        id="use-broker" 
                        checked={useBroker} 
                        onChange={() => setUseBroker(!useBroker)} 
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                    />
                    <label htmlFor="use-broker" className="ms-2 block text-sm text-slate-900 dark:text-slate-300">تضمين سمسار في الطلب</label>
                </div>
            </div>

            {useBroker && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">اختر السمسار</label>
                        <div className="flex gap-2">
                            <select 
                                value={brokerId} 
                                onChange={(e) => { 
                                    const b = brokers.find(br => br.id === e.target.value); 
                                    setBrokerId(e.target.value); 
                                    setBrokerCommission(b?.default_commission || 0); 
                                }} 
                                className={formInputClasses}
                            >
                                <option value="">اختر السمسار</option>
                                {brokers.filter(b => b.is_active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">قيمة العمولة (ريال)</label>
                        <input 
                            type="number" 
                            value={brokerCommission} 
                            onChange={(e) => setBrokerCommission(Number(e.target.value))} 
                            className={formInputClasses} 
                        />
                    </div>
                </div>
            )}
        </fieldset>
    );
};

export default StepBroker;
