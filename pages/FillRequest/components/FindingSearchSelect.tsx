import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PredefinedFinding } from '../../../types';
import Icon from '../../../components/Icon';

interface FindingSearchSelectProps {
    selectedId: string;
    onSelect: (id: string) => void;
    availableFindings: PredefinedFinding[];
    disabled?: boolean;
}

const FindingSearchSelect: React.FC<FindingSearchSelectProps> = ({ selectedId, onSelect, availableFindings, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const selectedFinding = useMemo(() => availableFindings.find(f => f.id === selectedId), [selectedId, availableFindings]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = useMemo(() => {
        if (!searchTerm) return availableFindings;
        return availableFindings.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [availableFindings, searchTerm]);

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div onClick={() => !disabled && setIsOpen(!isOpen)} className={`flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-900 border rounded-lg cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'} ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300 dark:border-slate-600'}`}>
                {selectedFinding ? (
                    <>
                        {selectedFinding.reference_image ? (<img src={selectedFinding.reference_image} className="w-8 h-8 rounded object-cover border dark:border-slate-700" alt="" />) : (<div className={`w-8 h-8 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 ${selectedFinding.is_bundle ? 'text-purple-500' : ''}`}><Icon name={selectedFinding.is_bundle ? "sparkles" : "findings"} className="w-4 h-4" /></div>)}
                        <span className={`font-medium truncate ${selectedFinding.is_bundle ? 'text-purple-600 dark:text-purple-400' : 'text-slate-900 dark:text-white'}`}>{selectedFinding.is_bundle && '⚡ '}{selectedFinding.name}</span>
                    </>
                ) : (<span className="text-slate-400 truncate">ابحث عن بند...</span>)}
                <Icon name="chevron-down" className={`w-4 h-4 text-slate-400 mr-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-2xl rounded-xl z-[60] overflow-hidden animate-fade-in max-h-60 flex flex-col">
                    <div className="p-2 border-b dark:border-slate-700 flex-shrink-0">
                        <div className="relative"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input autoFocus type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="ابحث باسم البند..." className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border-0 focus:ring-0 text-slate-700 dark:text-slate-200 text-sm" /></div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filtered.length > 0 ? (
                            filtered.map(f => (
                                <div key={f.id} onClick={() => { onSelect(f.id); setIsOpen(false); setSearchTerm(''); }} className={`flex items-center gap-3 p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors border-b last:border-0 dark:border-slate-700/50 ${f.is_bundle ? 'bg-purple-50/30 dark:bg-purple-900/10' : ''}`}>
                                    {f.reference_image ? (<img src={f.reference_image} className="w-8 h-8 rounded object-cover" alt="" />) : (<div className={`w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 ${f.is_bundle ? 'text-purple-500' : ''}`}><Icon name={f.is_bundle ? "sparkles" : "findings"} className="w-4 h-4" /></div>)}
                                    <div className="flex flex-col min-w-0"><span className={`text-sm font-medium truncate ${f.is_bundle ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>{f.is_bundle && '⚡ '}{f.name}</span>{f.is_bundle && <span className="text-[10px] text-purple-400">حزمة ذكية</span>}</div>
                                </div>
                            ))
                        ) : (<div className="p-4 text-center text-slate-500 text-sm">لا توجد نتائج</div>)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FindingSearchSelect;
