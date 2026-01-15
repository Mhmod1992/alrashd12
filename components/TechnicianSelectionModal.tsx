import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useAppContext } from '../context/AppContext';
import { InspectionRequest, CustomFindingCategory } from '../types';
import UserCircleIcon from './icons/UserCircleIcon';
import BriefcaseIcon from './icons/BriefcaseIcon';
import Icon from './Icon';

interface TechnicianSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: InspectionRequest;
    categoryId: string;
    categoryName: string;
}

const TechnicianSelectionModal: React.FC<TechnicianSelectionModalProps> = ({ isOpen, onClose, request, categoryId, categoryName }) => {
    const { technicians, employees, updateRequest, addNotification, inspectionTypes, customFindingCategories } = useAppContext();
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // --- NEW STATE FOR TABBED INTERFACE ---
    const [activeTabId, setActiveTabId] = useState<string>('');
    const [draftAssignments, setDraftAssignments] = useState<Record<string, string[]>>({});

    // Merge technicians and employees who are marked as technicians in their preferences
    const allStaff = useMemo(() => {
        const techList = technicians.filter(t => t.is_active).map(t => ({ 
            id: t.id, 
            name: t.name, 
            type: 'tech',
            title: t.title || 'فني'
        }));
        
        const empList = employees
            .filter(e => e.is_active && e.preferences?.isTechnician)
            .map(e => ({ 
                id: e.id, 
                name: e.name, 
                type: 'emp',
                title: 'موظف نظام'
            }));
        
        // Sort alphabetically
        return [...techList, ...empList].sort((a, b) => a.name.localeCompare(b.name));
    }, [technicians, employees]);

    const filteredStaff = useMemo(() => {
        if (!searchTerm) return allStaff;
        return allStaff.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [allStaff, searchTerm]);
    
    // Get all categories for the current request to build tabs
    const requestCategories = useMemo(() => {
        if (categoryId !== 'ALL' || !request) return [];
        const inspectionType = inspectionTypes.find(i => i.id === request.inspection_type_id);
        const visibleIds = inspectionType?.fill_tab_order_ids || inspectionType?.finding_category_ids || [];
        return visibleIds
            .map(id => customFindingCategories.find(c => c.id === id))
            .filter((c): c is CustomFindingCategory => !!c);
    }, [request, inspectionTypes, customFindingCategories, categoryId]);


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
                        type="text" 
                        placeholder="ابحث عن اسم..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2.5 pl-10 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto border rounded-lg dark:border-gray-700 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                    {filteredStaff.length > 0 ? (
                        filteredStaff.map(person => (
                            <label key={person.id} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 border-b dark:border-slate-800 last:border-0 ${selectedIdsForCurrentTab.has(person.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-full ${person.type === 'emp' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                        {person.type === 'emp' ? <UserCircleIcon className="w-4 h-4"/> : <BriefcaseIcon className="w-4 h-4"/>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white">{person.name}</p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{person.title}</p>
                                    </div>
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={selectedIdsForCurrentTab.has(person.id)} 
                                    onChange={() => handleToggle(person.id)}
                                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                            </label>
                        ))
                    ) : (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            لا توجد نتائج مطابقة. تأكد من إضافة فنيين أو تفعيل خيار "فني" للموظفين من الإعدادات.
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