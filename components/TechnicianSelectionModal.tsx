import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useAppContext } from '../context/AppContext';
import { InspectionRequest, CustomFindingCategory } from '../types';
import UserCircleIcon from './icons/UserCircleIcon';
import BriefcaseIcon from './icons/BriefcaseIcon';
import SparklesIcon from './icons/SparklesIcon';
import Icon from './Icon';

interface TechnicianSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: InspectionRequest;
    categoryId: string;
    categoryName: string;
}

const parseTitles = (title?: string): string[] => {
    if (!title) return ['أخرى'];
    // Split by / - , ، and whitespace variants
    const parts = title.split(/[\/\-،,]+/).map(t => t.trim()).filter(t => t.length > 0);
    return parts.length > 0 ? parts : ['أخرى'];
};

const TechnicianSelectionModal: React.FC<TechnicianSelectionModalProps> = ({ isOpen, onClose, request, categoryId, categoryName }) => {
    const { technicians, employees, updateRequest, addNotification, inspectionTypes, customFindingCategories } = useAppContext();
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    // --- NEW STATE FOR TABBED INTERFACE ---
    const [activeTabId, setActiveTabId] = useState<string>('');
    const [draftAssignments, setDraftAssignments] = useState<Record<string, string[]>>({});

    // Merge technicians and employees who are marked as technicians in their preferences
    const allStaff = useMemo(() => {
        const techList = technicians.filter(t => t.is_active).map(t => ({ 
            id: t.id, 
            name: t.name, 
            type: 'tech',
            title: t.title || 'فني',
            parsedTitles: parseTitles(t.title || 'فني')
        }));
        
        const empList = employees
            .filter(e => e.is_active && e.preferences?.isTechnician)
            .map(e => ({ 
                id: e.id, 
                name: e.name, 
                type: 'emp',
                title: e.title || 'موظف نظام',
                parsedTitles: parseTitles(e.title || 'موظف نظام')
            }));
        
        // Sort alphabetically
        return [...techList, ...empList].sort((a, b) => a.name.localeCompare(b.name));
    }, [technicians, employees]);

    const filteredStaff = useMemo(() => {
        let result = allStaff;
        if (searchTerm) {
            result = result.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return result;
    }, [allStaff, searchTerm]);

    const uniqueTitles = useMemo(() => {
        const titles = new Set<string>();
        allStaff.forEach(s => s.parsedTitles.forEach(t => titles.add(t)));
        return Array.from(titles).sort();
    }, [allStaff]);
    
    // Get all categories for the current request to build tabs
    const requestCategories = useMemo(() => {
        if (categoryId !== 'ALL' || !request) return [];
        const inspectionType = inspectionTypes.find(i => i.id === request.inspection_type_id);
        const visibleIds = inspectionType?.fill_tab_order_ids || inspectionType?.finding_category_ids || [];
        return visibleIds
            .map(id => customFindingCategories.find(c => c.id === id))
            .filter((c): c is CustomFindingCategory => !!c);
    }, [request, inspectionTypes, customFindingCategories, categoryId]);


    useEffect(() => {
        setSearchTerm('');
        // Focus search input when tab changes or modal opens
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 50);
    }, [activeTabId, isOpen]);

    // Initialize selection from request data when modal opens
    useEffect(() => {
        if (isOpen && request) {
            setDraftAssignments(request.technician_assignments || {});
            if (categoryId === 'ALL' && requestCategories.length > 0) {
                setActiveTabId(requestCategories[0].id);
            } else {
                setActiveTabId(categoryId);
            }
        }
    }, [isOpen, request, categoryId, requestCategories]);


    const selectedIdsForCurrentTab = useMemo(() => {
        return new Set(draftAssignments[activeTabId] || []);
    }, [draftAssignments, activeTabId]);

    // --- NEW: Suggested Staff (assigned to other tabs in this request) ---
    const suggestedStaff = useMemo(() => {
        const otherTabsIds = new Set<string>();
        Object.entries(draftAssignments).forEach(([tabId, staffIds]) => {
            if (tabId !== activeTabId) {
                staffIds.forEach(id => otherTabsIds.add(id));
            }
        });
        
        return allStaff.filter(s => otherTabsIds.has(s.id) && !selectedIdsForCurrentTab.has(s.id));
    }, [allStaff, draftAssignments, activeTabId, selectedIdsForCurrentTab]);

    const handleToggle = (personId: string) => {
        setDraftAssignments(prev => {
            const currentForTab = prev[activeTabId] || [];
            const newForTab = currentForTab.includes(personId)
                ? currentForTab.filter(id => id !== personId)
                : [...currentForTab, personId];
            return {
                ...prev,
                [activeTabId]: newForTab
            };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateRequest({
                id: request.id,
                technician_assignments: draftAssignments
            });
            addNotification({ title: 'نجاح', message: `تم تحديث تعيينات الفنيين بنجاح.`, type: 'success' });
            onClose();
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل حفظ البيانات.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!categoryId) return null;
    const isMultiTabMode = categoryId === 'ALL';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`الفنيين المشاركين - ${categoryName}`} size={isMultiTabMode ? '3xl' : 'md'}>
            <div className="flex flex-col h-[60vh]">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex-shrink-0">
                    {isMultiTabMode
                        ? 'حدد الفنيين لكل قسم من أقسام الفحص.'
                        : `حدد الفنيين أو الموظفين الذين قاموا بالفحص في قسم ${categoryName}.`
                    }
                </p>

                {isMultiTabMode && (
                    <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 mb-4 overflow-x-auto no-scrollbar">
                        <nav className="flex gap-2 -mb-px">
                            {requestCategories.map(cat => {
                                const assignedCount = draftAssignments[cat.id]?.length || 0;
                                return (
                                    <button 
                                        key={cat.id}
                                        onClick={() => setActiveTabId(cat.id)}
                                        className={`whitespace-nowrap py-3 px-4 border-b-2 text-sm font-bold transition-colors ${
                                            activeTabId === cat.id 
                                                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        {cat.name}
                                        {assignedCount > 0 && <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full ${activeTabId === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>{assignedCount}</span>}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                )}

                <div className="relative mb-4 flex-shrink-0">
                    <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="ابحث عن اسم..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2.5 pl-10 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div className="flex-1 overflow-y-auto border rounded-xl dark:border-gray-700 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50 p-2 sm:p-4">
                    {/* --- Suggested Section --- */}
                    {suggestedStaff.length > 0 && !searchTerm && (
                        <div className="mb-8 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                            <h3 className="px-3 py-1 text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <SparklesIcon className="w-3 h-3" />
                                مقترح (مشاركون في أقسام أخرى)
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                {suggestedStaff.map(person => (
                                    <button 
                                        key={person.id + '-suggested'} 
                                        onClick={() => handleToggle(person.id)}
                                        className="flex flex-col items-center gap-1 p-2 rounded-xl border border-white dark:border-slate-800 bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:bg-white text-center transition-all transform active:scale-[0.98] shadow-sm"
                                    >
                                        <div className="flex-shrink-0 p-1.5 rounded-lg bg-blue-100 text-blue-600">
                                            {person.type === 'emp' ? <UserCircleIcon className="w-5 h-5"/> : <BriefcaseIcon className="w-5 h-5"/>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-[11px] leading-tight truncate w-full">{person.name}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {filteredStaff.length > 0 ? (
                        Object.entries(
                            filteredStaff.reduce((acc, person) => {
                                // Group by all parsed titles
                                person.parsedTitles.forEach(t => {
                                    if (!acc[t]) acc[t] = [];
                                    if (!acc[t].find(p => p.id === person.id)) {
                                        acc[t].push(person);
                                    }
                                });
                                return acc;
                            }, {} as Record<string, typeof filteredStaff>)
                        ).map(([title, staff]) => (
                            <div key={title} className="mb-6 last:mb-0">
                                <h3 className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-r-2 border-slate-300 dark:border-slate-600 pr-2">{title}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {staff.map(person => {
                                        const isSelected = selectedIdsForCurrentTab.has(person.id);
                                        return (
                                            <button 
                                                key={person.id + '-' + title} 
                                                onClick={() => handleToggle(person.id)}
                                                className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all transform active:scale-[0.98] ${
                                                    isSelected 
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20 translate-y-[-2px]' 
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50/30'
                                                }`}
                                            >
                                                <div className={`flex-shrink-0 p-1.5 rounded-lg transition-colors relative ${
                                                    isSelected 
                                                        ? 'bg-white/20 text-white' 
                                                        : (person.type === 'emp' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600')
                                                }`}>
                                                    {person.type === 'emp' ? <UserCircleIcon className="w-5 h-5"/> : <BriefcaseIcon className="w-5 h-5"/>}
                                                    {isSelected && (
                                                        <div className="bg-white text-blue-600 rounded-full p-0.5 shadow-sm absolute -top-1 -right-1">
                                                            <Icon name="check-circle" className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 w-full">
                                                    <p className={`font-black text-[11px] leading-tight truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                                        {person.name}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <Icon name="search" className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-sm font-bold">لا توجد نتائج مطابقة</p>
                            <p className="text-xs opacity-60">تأكد من إضافة فنيين أو تفعيل خيار "فني" للموظفين</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-end pt-6 border-t mt-6 dark:border-gray-700 gap-2">
                <Button variant="secondary" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </Button>
            </div>
        </Modal>
    );
};

export default TechnicianSelectionModal;