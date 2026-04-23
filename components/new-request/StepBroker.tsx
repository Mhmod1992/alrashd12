
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Broker } from '../../types';
import SearchIcon from '../icons/SearchIcon';
import UserCircleIcon from '../icons/UserCircleIcon';
import ChevronDownIcon from '../icons/ChevronDownIcon';

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
    const endRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedBroker = useMemo(() => brokers.find(b => b.id === brokerId), [brokers, brokerId]);

    const filteredBrokers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return brokers.filter(b => 
            b.is_active && (
                b.name.toLowerCase().includes(term) || 
                (b.phone && b.phone.includes(term))
            )
        );
    }, [brokers, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (useBroker && endRef.current) {
            setTimeout(() => {
                endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        }
    }, [useBroker]);

    const handleSelectBroker = (broker: Broker) => {
        setBrokerId(broker.id);
        setBrokerCommission(broker.default_commission || 0);
        setSearchTerm(broker.name);
        setIsDropdownOpen(false);
    };

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
                    <div className="relative" ref={dropdownRef}>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ابحث عن السمسار</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <input 
                                type="text"
                                className={`${formInputClasses} pr-10`}
                                placeholder="اسم السمسار أو رقم الهاتف..."
                                value={searchTerm || (selectedBroker?.name || '')}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <ChevronDownIcon className="h-4 w-4 text-slate-400" />
                            </div>
                        </div>

                        {isDropdownOpen && (
                            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto custom-scrollbar p-1">
                                {filteredBrokers.map(broker => (
                                    <button
                                        key={broker.id}
                                        type="button"
                                        onClick={() => handleSelectBroker(broker)}
                                        className={`w-full text-right px-4 py-2 text-sm rounded-md transition-colors flex items-center gap-3 ${brokerId === broker.id ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    >
                                        <UserCircleIcon className="w-5 h-5 opacity-40" />
                                        <div className="flex flex-col">
                                            <span className="font-bold">{broker.name}</span>
                                            {broker.phone && <span className="text-[10px] opacity-60 font-mono">{broker.phone}</span>}
                                        </div>
                                    </button>
                                ))}
                                {filteredBrokers.length === 0 && (
                                    <div className="p-4 text-center text-sm text-slate-400">لا توجد نتائج</div>
                                )}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">قيمة العمولة (ريال)</label>
                        <input 
                            type="number" 
                            value={brokerCommission} 
                            onChange={(e) => setBrokerCommission(Number(e.target.value))} 
                            className={formInputClasses} 
                            placeholder="0"
                        />
                    </div>
                </div>
            )}
            <div ref={endRef} />
        </fieldset>
    );
};

export default StepBroker;
