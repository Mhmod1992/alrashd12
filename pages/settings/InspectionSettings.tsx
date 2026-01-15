
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { InspectionType, CustomFindingCategory, PredefinedFinding } from '../../types';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { compressImageToBase64, uuidv4 } from '../../lib/utils';
import RefreshCwIcon from '../../components/icons/RefreshCwIcon';


const InspectionSettingsTab: React.FC = () => {
    const {
        inspectionTypes, addInspectionType, updateInspectionType, deleteInspectionType,
        customFindingCategories, addFindingCategory, updateFindingCategory, deleteFindingCategory,
        predefinedFindings, addPredefinedFinding, updatePredefinedFinding, deletePredefinedFinding,
    } = useAppContext();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState<React.ReactNode>(null);
    const [modalTitle, setModalTitle] = useState('');
    const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);
    
    // State for selecting a category to manage its findings
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
        customFindingCategories.length > 0 ? customFindingCategories[0].id : null
    );

    // Toggle for View Mode: 'groups' or 'flat'
    const [viewMode, setViewMode] = useState<'groups' | 'flat'>('groups');

    // --- Inspection Type Management ---
    const handleAddType = () => {
        setModalTitle('إضافة نوع فحص جديد');
        setModalContent(<TypeForm key={uuidv4()} onClose={() => setIsModalOpen(false)} onSave={addInspectionType} />);
        setIsModalOpen(true);
    };

    const handleEditType = (type: InspectionType) => {
        setModalTitle('تعديل نوع الفحص');
        setModalContent(<TypeForm key={type.id} type={type} onClose={() => setIsModalOpen(false)} onSave={(data) => updateInspectionType({ ...data, id: type.id })} />);
        setIsModalOpen(true);
    };

    // --- Finding Category Management ---
    const handleAddCategory = () => {
        setModalTitle('إضافة تبويب فحص جديد');
        setModalContent(<CategoryForm key={uuidv4()} onClose={() => setIsModalOpen(false)} onSave={addFindingCategory} />);
        setIsModalOpen(true);
    };
    
    const handleEditCategory = (category: CustomFindingCategory) => {
        setModalTitle('تعديل تبويب الفحص');
        setModalContent(<CategoryForm key={category.id} category={category} onClose={() => setIsModalOpen(false)} onSave={(data) => updateFindingCategory({ ...data, id: category.id })} />);
        setIsModalOpen(true);
    };

    const handleDeleteCategory = (id: string) => {
        deleteFindingCategory(id);
        if (selectedCategoryId === id) {
            setSelectedCategoryId(null);
        }
    }

    // --- Predefined Finding Management ---
    const handleAddFinding = () => {
        if (!selectedCategoryId) return;
        setModalTitle('إضافة بند فحص جديد');
        // Pass the currently selected category ID as default AND use a key to force remount
        setModalContent(<FindingForm key={uuidv4()} defaultCategoryId={selectedCategoryId} onClose={() => setIsModalOpen(false)} onSave={addPredefinedFinding} />);
        setIsModalOpen(true);
    };

    const handleEditFinding = (finding: PredefinedFinding) => {
        setModalTitle('تعديل بند الفحص');
        setModalContent(<FindingForm key={finding.id} finding={finding} onClose={() => setIsModalOpen(false)} onSave={(data) => updatePredefinedFinding({ ...data, id: finding.id })} />);
        setIsModalOpen(true);
    };

    // Filter findings based on selected category AND sort by orderIndex
    const filteredFindings = useMemo(() => {
        if (!selectedCategoryId) return [];
        return predefinedFindings
            .filter(f => f.category_id === selectedCategoryId)
            .sort((a, b) => {
                // Robust sort handling missing indices
                const idxA = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
                const idxB = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
                if (idxA === idxB) return a.name.localeCompare(b.name);
                return idxA - idxB;
            });
    }, [selectedCategoryId, predefinedFindings]);

    // Handle reordering of findings (Arrows)
    const handleMoveFinding = async (findingId: string, direction: 'left' | 'right') => {
        const currentIndex = filteredFindings.findIndex(f => f.id === findingId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'right' ? currentIndex - 1 : currentIndex + 1; // RTL: Right means previous in array
        
        if (newIndex < 0 || newIndex >= filteredFindings.length) return;

        const itemA = filteredFindings[currentIndex];
        const itemB = filteredFindings[newIndex];

        let indexA = itemA.orderIndex ?? currentIndex;
        let indexB = itemB.orderIndex ?? newIndex;

        if (indexA === indexB) {
            indexA = currentIndex;
            indexB = newIndex;
        }

        await Promise.all([
            updatePredefinedFinding({ ...itemA, orderIndex: indexB }),
            updatePredefinedFinding({ ...itemB, orderIndex: indexA })
        ]);
    };

    // Handle Manual Order Change (Input)
    const handleManualOrderChange = async (findingId: string, newIndex: number) => {
        const finding = predefinedFindings.find(f => f.id === findingId);
        if (finding && finding.orderIndex !== newIndex) {
            await updatePredefinedFinding({ ...finding, orderIndex: newIndex });
        }
    };

    // Group findings by 'group' property
    const groupedFindings = useMemo(() => {
        const groups: Record<string, PredefinedFinding[]> = {};
        
        // Use the ALREADY SORTED `filteredFindings`
        filteredFindings.forEach(finding => {
            const findingGroups = finding.groups || (finding.group ? [finding.group] : []);

            if (findingGroups.length > 0) {
                findingGroups.forEach(groupName => {
                    if (!groups[groupName]) {
                        groups[groupName] = [];
                    }
                    if (!groups[groupName].find(f => f.id === finding.id)) {
                        groups[groupName].push(finding);
                    }
                });
            } else {
                const groupName = 'عام';
                if (!groups[groupName]) {
                    groups[groupName] = [];
                }
                groups[groupName].push(finding);
            }
        });

        // Sort groups (General first, then alphabetical)
        return Object.entries(groups).sort(([a], [b]) => {
            if (a === 'عام') return -1;
            if (b === 'عام') return 1;
            return a.localeCompare(b);
        });
    }, [filteredFindings]);

    const selectedCategoryName = useMemo(() => {
        return customFindingCategories.find(c => c.id === selectedCategoryId)?.name || '';
    }, [selectedCategoryId, customFindingCategories]);


    return (
        <div className="space-y-12 animate-fade-in">
            {/* SECTION 1: Inspection Types (Packages) */}
            <section className="border-b-2 border-dashed dark:border-slate-700 pb-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">أنواع الفحص (الباقات)</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إدارة باقات الفحص وأسعارها والتبويبات المشمولة فيها.</p>
                    </div>
                    <Button onClick={handleAddType} leftIcon={<Icon name="add" className="w-5 h-5"/>}>
                        إضافة نوع
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {inspectionTypes.map(type => (
                       <div key={type.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 ${expandedTypeId === type.id ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-md'}`}>
                          <div 
                            className="p-4 cursor-pointer"
                            onClick={() => setExpandedTypeId(prevId => prevId === type.id ? null : type.id)}
                          >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                   <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                        <Icon name="document-report" className="w-6 h-6" />
                                   </div>
                                   <div>
                                      <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{type.name}</p>
                                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">{type.price} ريال</p>
                                   </div>
                                </div>
                                <Icon name="chevron-down" className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expandedTypeId === type.id ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          
                          {expandedTypeId === type.id && (
                            <div className="px-4 pb-4 pt-0 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 animate-fade-in">
                                <div className="my-3">
                                    <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-2">التبويبات المشمولة (بالترتيب)</h4>
                                    <div className="flex flex-col gap-1">
                                        {type.finding_category_ids.length > 0 ? (
                                            type.finding_category_ids.map((catId, index) => {
                                                const category = customFindingCategories.find(c => c.id === catId);
                                                return category ? (
                                                    <div key={`${catId}-${index}`} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                        <span className="text-gray-400 text-xs font-mono w-4">{index + 1}.</span>
                                                        <span>{category.name}</span>
                                                    </div>
                                                ) : null;
                                            })
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">لا توجد تبويبات</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-4 pt-3 border-t dark:border-gray-600">
                                    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleEditType(type); }} leftIcon={<Icon name="edit" className="w-4 h-4"/>}>تعديل</Button>
                                    <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); deleteInspectionType(type.id); }} leftIcon={<Icon name="delete" className="w-4 h-4"/>}>حذف</Button>
                                </div>
                            </div>
                          )}
                        </div>
                    ))}
                </div>
            </section>

            {/* SECTION 2: Findings Management */}
            <section>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">إدارة بنود الفحص</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">اختر التبويب لإدارة البنود والمجموعات والصور وترتيبها.</p>
                    </div>
                    <Button onClick={handleAddCategory} variant="secondary" leftIcon={<Icon name="add" className="w-5 h-5"/>}>
                        إضافة تبويب جديد
                    </Button>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Categories Sidebar / List */}
                    <div className="lg:w-1/4 flex-shrink-0">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-4">
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200">
                                التبويبات ({customFindingCategories.length})
                            </div>
                            <div className="max-h-[500px] overflow-y-auto p-2 space-y-1">
                                {customFindingCategories.map(cat => (
                                    <div 
                                        key={cat.id} 
                                        className={`group flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all ${
                                            selectedCategoryId === cat.id 
                                            ? 'bg-blue-600 text-white shadow-md' 
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                                        }`}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                    >
                                        <span className="font-medium truncate">{cat.name}</span>
                                        <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${selectedCategoryId === cat.id ? 'opacity-100' : ''}`}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                                                className={`p-1.5 rounded hover:bg-white/20 ${selectedCategoryId === cat.id ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                                title="تعديل التبويب"
                                            >
                                                <Icon name="edit" className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                                                className={`p-1.5 rounded hover:bg-white/20 ${selectedCategoryId === cat.id ? 'text-red-200 hover:text-white' : 'text-red-500'}`}
                                                title="حذف التبويب"
                                            >
                                                <Icon name="delete" className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {customFindingCategories.length === 0 && (
                                    <div className="text-center py-8 text-gray-400 text-sm">
                                        لا توجد تبويبات.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Findings Grid Area */}
                    <div className="lg:w-3/4 flex-grow">
                        {selectedCategoryId ? (
                            <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 min-h-[400px]">
                                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                            <Icon name="findings" className="w-5 h-5 text-blue-500" />
                                            بنود: {selectedCategoryName}
                                            <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs py-0.5 px-2 rounded-full">{filteredFindings.length}</span>
                                        </h4>
                                    </div>
                                    <div className="flex gap-2">
                                        {/* View Mode Toggle */}
                                        <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg border dark:border-slate-600 p-1">
                                            <button
                                                onClick={() => setViewMode('groups')}
                                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'groups' ? 'bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                                            >
                                                المجموعات
                                            </button>
                                            <button
                                                onClick={() => setViewMode('flat')}
                                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'flat' ? 'bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                                                title="عرض الترتيب كما يظهر في التقرير"
                                            >
                                                ترتيب التقرير
                                            </button>
                                        </div>
                                        <Button onClick={handleAddFinding} leftIcon={<Icon name="add" className="w-5 h-5"/>}>
                                            إضافة بند
                                        </Button>
                                    </div>
                                </div>

                                {filteredFindings.length > 0 ? (
                                    <div className="space-y-8">
                                        {/* VIEW MODE: GROUPS */}
                                        {viewMode === 'groups' && groupedFindings.map(([groupName, findings]) => (
                                            <div key={groupName} className="relative">
                                                <h5 className="sticky top-0 z-10 bg-gray-50/95 dark:bg-slate-900/80 backdrop-blur-sm py-2 mb-3 font-bold text-slate-600 dark:text-slate-300 border-b dark:border-slate-600 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    {groupName}
                                                    <span className="text-xs font-normal text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border dark:border-slate-700">{findings.length}</span>
                                                </h5>
                                                
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {findings.map(finding => (
                                                        <FindingCardItem 
                                                            key={finding.id} 
                                                            finding={finding} 
                                                            onEdit={handleEditFinding} 
                                                            onDelete={deletePredefinedFinding}
                                                            onMove={handleMoveFinding}
                                                            onOrderChange={handleManualOrderChange}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        {/* VIEW MODE: FLAT (REPORT ORDER) */}
                                        {viewMode === 'flat' && (
                                            <div>
                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 mb-4 flex gap-2 items-start">
                                                    <Icon name="document-report" className="w-5 h-5 text-blue-600 mt-0.5" />
                                                    <p className="text-xs text-blue-800 dark:text-blue-200">
                                                        هذا العرض يوضح الترتيب الفعلي للبطاقات في التقرير النهائي. استخدم الأسهم أو اكتب الرقم للترتيب.
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {filteredFindings.map((finding, index) => (
                                                        <div key={finding.id} className="relative">
                                                            <div className="absolute top-2 right-2 z-10 bg-slate-800 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full opacity-70">
                                                                {index + 1}
                                                            </div>
                                                            <div className={`absolute top-2 left-2 z-10 text-[9px] px-1.5 py-0.5 rounded ${
                                                                finding.report_position === 'right' ? 'bg-green-100 text-green-700' :
                                                                finding.report_position === 'left' ? 'bg-red-100 text-red-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            }`}>
                                                                {finding.report_position === 'right' ? 'يمين' :
                                                                 finding.report_position === 'left' ? 'يسار' : 'وسط'}
                                                            </div>
                                                            <FindingCardItem 
                                                                finding={finding} 
                                                                onEdit={handleEditFinding} 
                                                                onDelete={deletePredefinedFinding}
                                                                onMove={handleMoveFinding}
                                                                onOrderChange={handleManualOrderChange}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                                        <Icon name="findings" className="w-12 h-12 mb-2 opacity-50" />
                                        <p>لا توجد بنود فحص في هذا التبويب.</p>
                                        <button onClick={handleAddFinding} className="mt-2 text-blue-600 hover:underline text-sm font-semibold">إضافة أول بند</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-gray-50 dark:bg-gray-800/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400">
                                <Icon name="chevron-right" className="w-12 h-12 mb-4 opacity-30" />
                                <p className="text-lg">اختر تبويبًا من القائمة الجانبية</p>
                                <p className="text-sm">لإدارة البنود والصور الخاصة به</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle} size={modalTitle.includes('بند') ? '2xl' : 'lg'}>
                {modalContent}
            </Modal>
        </div>
    );
};

// Extracted Component for cleaner code
const FindingCardItem: React.FC<{ 
    finding: PredefinedFinding; 
    onEdit: (f: PredefinedFinding) => void; 
    onDelete: (id: string) => void;
    onMove: (id: string, dir: 'left' | 'right') => void;
    onOrderChange: (id: string, newIndex: number) => void;
}> = ({ finding, onEdit, onDelete, onMove, onOrderChange }) => {
    
    // Local state for the input field to prevent jumping while typing
    const [localOrder, setLocalOrder] = useState<string>(String(finding.orderIndex || 0));

    // Sync local state when the prop changes (e.g. after a re-sort)
    useEffect(() => {
        setLocalOrder(String(finding.orderIndex || 0));
    }, [finding.orderIndex]);

    const handleOrderBlur = () => {
        const val = parseInt(localOrder, 10);
        if (!isNaN(val) && val !== finding.orderIndex) {
            onOrderChange(finding.id, val);
        } else {
            // Revert if invalid or unchanged
            setLocalOrder(String(finding.orderIndex || 0));
        }
    };

    const handleOrderKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleOrderBlur();
            (e.target as HTMLElement).blur();
        }
    };

    return (
        <div className={`group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col transition-all duration-200 h-full ${finding.is_bundle ? 'border-r-4 border-r-purple-500' : ''}`}>
            {/* Image Area */}
            <div className="aspect-[4/3] w-full bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                {finding.reference_image ? (
                    <img 
                        src={finding.reference_image} 
                        alt={finding.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        style={{ objectPosition: finding.reference_image_position || 'center' }}
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
                        {finding.is_bundle ? (
                            <Icon name="sparkles" className="w-10 h-10 mb-2 opacity-50 text-purple-400" />
                        ) : (
                            <Icon name="camera" className="w-10 h-10 mb-2 opacity-50" />
                        )}
                        <span className="text-xs">{finding.is_bundle ? 'حزمة بنود' : 'لا توجد صورة'}</span>
                    </div>
                )}
                
                {/* Hover Overlay Actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[1px]">
                    <button 
                        onClick={() => onEdit(finding)} 
                        className="p-2 bg-white text-gray-900 rounded-full hover:bg-gray-100 shadow-lg transform hover:scale-110 transition-all"
                        title="تعديل البند"
                    >
                        <Icon name="edit" className="w-5 h-5"/>
                    </button>
                    <button 
                        onClick={() => onDelete(finding.id)} 
                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg transform hover:scale-110 transition-all"
                        title="حذف البند"
                    >
                        <Icon name="delete" className="w-5 h-5"/>
                    </button>
                </div>
            </div>
            
            {/* Content Area */}
            <div className="p-3 flex-grow flex flex-col relative">
                <h5 className="font-bold text-sm text-gray-900 dark:text-gray-100 mb-1 line-clamp-1 flex items-center gap-1" title={finding.name}>
                    {finding.is_bundle && <Icon name="sparkles" className="w-3 h-3 text-purple-500" />}
                    {finding.name}
                </h5>
                <div className="mt-auto pt-2 border-t dark:border-gray-700 flex justify-between items-center">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 max-w-[50%]">
                        {finding.is_bundle ? `تشمل ${finding.linked_finding_ids?.length || 0} بنود` : finding.options.join('، ')}
                    </p>
                    {/* Ordering Controls */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 items-center">
                        <button 
                            onClick={() => onMove(finding.id, 'right')}
                            className="p-1 rounded hover:bg-white dark:hover:bg-gray-600 text-gray-500 hover:text-blue-500 transition-colors"
                            title="نقل لليمين (سابق)"
                        >
                            <Icon name="chevron-right" className="w-3 h-3" />
                        </button>
                        
                        <input 
                            type="number"
                            value={localOrder}
                            onChange={(e) => setLocalOrder(e.target.value)}
                            onBlur={handleOrderBlur}
                            onKeyDown={handleOrderKeyDown}
                            className="w-10 text-center text-xs font-semibold bg-white dark:bg-slate-600 border border-transparent focus:border-blue-500 dark:text-white rounded py-0.5 px-0 no-spinner outline-none"
                            title="رقم الترتيب"
                        />

                        <button 
                            onClick={() => onMove(finding.id, 'left')}
                            className="p-1 rounded hover:bg-white dark:hover:bg-gray-600 text-gray-500 hover:text-blue-500 transition-colors"
                            title="نقل لليسار (تالي)"
                        >
                            <Icon name="chevron-right" className="w-3 h-3 transform rotate-180" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- FORMS ---

const TypeForm: React.FC<{ type?: InspectionType, onClose: () => void, onSave: (data: any) => void }> = ({ type, onClose, onSave }) => {
    const { customFindingCategories } = useAppContext();
    const [name, setName] = useState(type?.name || '');
    const [price, setPrice] = useState<number | ''>(type?.price !== undefined ? type.price : '');
    const [selectedCategories, setSelectedCategories] = useState<string[]>(type?.finding_category_ids || []);
    const [fillTabOrder, setFillTabOrder] = useState<string[]>(type?.fill_tab_order_ids || type?.finding_category_ids || []);
    const [activeOrderTab, setActiveOrderTab] = useState<'report' | 'fill'>('report');

    const availableCategories = useMemo(() => {
        const selectedSet = new Set(selectedCategories);
        return customFindingCategories.filter(c => !selectedSet.has(c.id));
    }, [customFindingCategories, selectedCategories]);

    const handleAddCategory = (catId: string) => {
        setSelectedCategories(prev => {
            const newList = [...prev, catId];
            // Also add to fill order if not already there
            if (!fillTabOrder.includes(catId)) {
                setFillTabOrder(prevFill => [...prevFill, catId]);
            }
            return newList;
        });
    };

    const handleRemoveCategory = (catId: string) => {
        setSelectedCategories(prev => prev.filter(id => id !== catId));
        setFillTabOrder(prev => prev.filter(id => id !== catId));
    };

    const handleMoveUp = (index: number, listType: 'report' | 'fill') => {
        if (index === 0) return;
        if (listType === 'report') {
            setSelectedCategories(prev => {
                const newArr = [...prev];
                [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
                return newArr;
            });
        } else {
            setFillTabOrder(prev => {
                const newArr = [...prev];
                [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
                return newArr;
            });
        }
    };

    const handleMoveDown = (index: number, listType: 'report' | 'fill') => {
        const list = listType === 'report' ? selectedCategories : fillTabOrder;
        if (index === list.length - 1) return;
        
        if (listType === 'report') {
            setSelectedCategories(prev => {
                const newArr = [...prev];
                [newArr[index + 1], newArr[index]] = [newArr[index], newArr[index + 1]];
                return newArr;
            });
        } else {
            setFillTabOrder(prev => {
                const newArr = [...prev];
                [newArr[index + 1], newArr[index]] = [newArr[index], newArr[index + 1]];
                return newArr;
            });
        }
    };

    const syncOrders = () => {
        setFillTabOrder([...selectedCategories]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ 
            name, 
            price: Number(price), 
            finding_category_ids: selectedCategories,
            fill_tab_order_ids: fillTabOrder 
        });
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">اسم نوع الفحص</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"/>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">السعر (ريال)</label>
                    <input 
                        type="number" 
                        value={price} 
                        onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))} 
                        required 
                        placeholder="0"
                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4 dark:border-gray-700">
                {/* Left: Selected Items (Orderable) */}
                <div>
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-4">
                        <button 
                            type="button"
                            onClick={() => setActiveOrderTab('report')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeOrderTab === 'report' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            ترتيب التقرير
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveOrderTab('fill')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeOrderTab === 'fill' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            ترتيب التعبئة (الفني)
                        </button>
                    </div>

                    <div className="flex justify-between items-center mb-2 px-1">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                            {activeOrderTab === 'report' ? 'تحكم في تسلسل الأقسام في الملف المطبوع' : 'تحكم في تسلسل التبويبات في واجهة التعبئة'}
                        </label>
                        {activeOrderTab === 'fill' && (
                            <button 
                                type="button" 
                                onClick={syncOrders}
                                className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                            >
                                <RefreshCwIcon className="w-3 h-3" /> مطابق للتقرير
                            </button>
                        )}
                    </div>

                    <div className="border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 h-64 overflow-y-auto p-2 space-y-2">
                        { (activeOrderTab === 'report' ? selectedCategories : fillTabOrder).length > 0 ? (
                            (activeOrderTab === 'report' ? selectedCategories : fillTabOrder).map((catId, index) => {
                                const category = customFindingCategories.find(c => c.id === catId);
                                return category ? (
                                    <div key={`${catId}-${activeOrderTab}`} className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded shadow-sm border border-gray-200 dark:border-gray-600 animate-fade-in">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-gray-200 dark:bg-gray-600 text-xs w-5 h-5 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 font-mono">
                                                {index + 1}
                                            </span>
                                            <span className="text-sm font-medium dark:text-gray-200">{category.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                type="button" 
                                                onClick={() => handleMoveUp(index, activeOrderTab)} 
                                                disabled={index === 0}
                                                className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-30"
                                            >
                                                <Icon name="chevron-down" className="w-4 h-4 transform rotate-180" />
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => handleMoveDown(index, activeOrderTab)} 
                                                disabled={index === (activeOrderTab === 'report' ? selectedCategories : fillTabOrder).length - 1}
                                                className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-30"
                                            >
                                                <Icon name="chevron-down" className="w-4 h-4" />
                                            </button>
                                            {activeOrderTab === 'report' && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveCategory(catId)} 
                                                    className="p-1 text-red-400 hover:text-red-600 ms-1 hover:bg-red-50 rounded"
                                                >
                                                    <Icon name="close" className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : null;
                            })
                        ) : (
                            <p className="text-center text-sm text-gray-400 mt-10">لم يتم اختيار أي أقسام.</p>
                        )}
                    </div>
                </div>

                {/* Right: Available Items */}
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">أقسام متاحة للإضافة</label>
                    <div className="border rounded-md dark:border-gray-600 h-64 overflow-y-auto p-2 bg-white dark:bg-gray-800">
                        {availableCategories.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {availableCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => handleAddCategory(cat.id)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-green-50 border border-gray-200 hover:border-green-200 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 rounded-full text-sm transition-colors group"
                                    >
                                        <Icon name="add" className="w-3 h-3 text-gray-400 group-hover:text-green-500" />
                                        <span className="text-gray-700 dark:text-gray-300 group-hover:text-green-700 dark:group-hover:text-green-300">{cat.name}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-sm text-gray-400 mt-10">تمت إضافة جميع الأقسام المتاحة.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
                <Button type="submit">حفظ التغييرات</Button>
            </div>
        </form>
    );
};

const CategoryForm: React.FC<{ category?: CustomFindingCategory, onClose: () => void, onSave: (data: any) => void }> = ({ category, onClose, onSave }) => {
    const [name, setName] = useState(category?.name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name });
        onClose();
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">اسم التبويب</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700"><Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit">حفظ</Button></div>
        </form>
    );
};

const PositionPicker: React.FC<{ imageUrl: string, value: string, onChange: (val: string) => void }> = ({ imageUrl, value, onChange }) => {
    const getCoords = (val: string) => {
        const map: any = {
            'center': {x: 50, y: 50},
            'top': {x: 50, y: 0},
            'bottom': {x: 50, y: 100},
            'left': {x: 0, y: 50},
            'right': {x: 100, y: 50},
            'top left': {x: 0, y: 0},
            'top right': {x: 100, y: 0},
            'bottom left': {x: 0, y: 100},
            'bottom right': {x: 100, y: 100},
        };
        if (map[val]) return map[val];
        const parts = val.split(' ');
        if (parts.length === 2 && parts[0].includes('%') && parts[1].includes('%')) {
            return {
                x: parseFloat(parts[0]),
                y: parseFloat(parts[1])
            };
        }
        return {x: 50, y: 50};
    };

    const {x, y} = getCoords(value);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        
        let newX = (clientX / rect.width) * 100;
        let newY = (clientY / rect.height) * 100;
        
        // Clamp
        newX = Math.max(0, Math.min(100, newX));
        newY = Math.max(0, Math.min(100, newY));

        onChange(`${Math.round(newX)}% ${Math.round(newY)}%`);
    };

    return (
        <div className="w-full space-y-2 mt-4">
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                تحديد نقطة التركيز
                <span className="text-xs font-normal text-gray-500 mx-1">(انقر على الصورة لتحديد الجزء الذي تريد إظهاره في البطاقة)</span>
            </label>
            <div 
                className="relative w-full h-64 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden cursor-crosshair border-2 border-slate-300 dark:border-slate-600"
                onClick={handleClick}
            >
                {/* Use width and height 100% to fill the container for accurate clicking percentages */}
                <img src={imageUrl} alt="selector" className="w-full h-full object-fill pointer-events-none" />
                
                {/* Marker */}
                 <div 
                    className="absolute w-6 h-6 bg-red-500/80 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100 flex items-center justify-center"
                    style={{ left: `${x}%`, top: `${y}%` }}
                >
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
            </div>
             <div className="flex justify-between text-xs text-gray-400 px-1">
                 <span>يسار: 0%</span>
                 <span>وسط: 50%</span>
                 <span>يمين: 100%</span>
             </div>
        </div>
    );
};

const FindingForm: React.FC<{ finding?: PredefinedFinding, defaultCategoryId?: string, onClose: () => void, onSave: (data: any) => void }> = ({ finding, defaultCategoryId, onClose, onSave }) => {
    const { predefinedFindings, addNotification, uploadImage } = useAppContext();
    const [name, setName] = useState(finding?.name || '');
    const [categoryId, setCategoryId] = useState(finding?.category_id || defaultCategoryId || '');
    const [orderIndex, setOrderIndex] = useState(finding?.orderIndex || 0);
    const [reportPosition, setReportPosition] = useState<'right' | 'center' | 'left'>(finding?.report_position || 'center');
    const [isBundle, setIsBundle] = useState(!!finding?.is_bundle);
    const [linkedIds, setLinkedIds] = useState<string[]>(finding?.linked_finding_ids || []);
    const [bundleDefaultValue, setBundleDefaultValue] = useState(finding?.bundle_default_value || '');
    
    const getInitialGroups = (f?: PredefinedFinding) => {
        if (f?.groups) return f.groups;
        if (f?.group) return [f.group];
        return [];
    };
    const initialGroups = getInitialGroups(finding);
    const [group1, setGroup1] = useState(initialGroups[0] || '');
    const [group2, setGroup2] = useState(initialGroups[1] || '');

    const [options, setOptions] = useState(finding?.options?.join(', ') || '');
    const [referenceImage, setReferenceImage] = useState<string | null>(finding?.reference_image || null);
    const [imagePosition, setImagePosition] = useState(finding?.reference_image_position || 'center');
    const [isUploading, setIsUploading] = useState(false);

    const existingGroups = useMemo(() => {
        const groups = new Set<string>();
        predefinedFindings.forEach(f => {
            if (f.category_id === categoryId) {
                const findingGroups = f.groups || (f.group ? [f.group] : []);
                findingGroups.forEach(g => groups.add(g));
            }
        });
        return Array.from(groups);
    }, [predefinedFindings, categoryId]);

    const otherFindingsInCategory = useMemo(() => {
        return predefinedFindings.filter(f => f.category_id === categoryId && f.id !== finding?.id && !f.is_bundle);
    }, [predefinedFindings, categoryId, finding?.id]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isUploading) return;
        onSave({ 
            name, 
            category_id: categoryId, 
            options: isBundle ? ['حزمة بنود'] : options.split(',').map(o => o.trim()).filter(Boolean),
            reference_image: referenceImage,
            groups: [group1.trim(), group2.trim()].filter(Boolean),
            group: undefined, 
            reference_image_position: imagePosition,
            orderIndex,
            report_position: reportPosition,
            is_bundle: isBundle,
            linked_finding_ids: isBundle ? linkedIds : [],
            bundle_default_value: isBundle ? bundleDefaultValue.trim() : undefined
        });
        onClose();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
             try {
                const dataUrl = await uploadImage(file, 'finding_images');
                setReferenceImage(dataUrl);
            } catch (error) {
                console.error("Image upload failed", error);
                addNotification({ title: 'خطأ', message: 'فشل رفع الصورة.', type: 'error' });
            } finally {
                setIsUploading(false);
            }
        }
    };
    
    const removeImage = () => {
        setReferenceImage(null);
        setImagePosition('center');
    }

    const toggleLinkedId = (id: string) => {
        setLinkedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[85vh] overflow-y-auto p-1 custom-scrollbar">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">اسم البند</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium">ترتيب البند (اختياري)</label>
                    <input type="number" value={orderIndex} onChange={e => setOrderIndex(Number(e.target.value))} className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                        type="checkbox" 
                        checked={isBundle} 
                        onChange={e => setIsBundle(e.target.checked)} 
                        className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500" 
                    />
                    <div>
                        <span className="font-bold text-purple-800 dark:text-purple-200">هذا البند عبارة عن "حزمة بنود" (Smart Bundle)</span>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">عند اختيار هذا البند، سيتم إضافة كافة البنود المرتبطة به تلقائياً للتقرير.</p>
                    </div>
                </label>

                {isBundle && (
                    <div className="mt-4 animate-fade-in border-t border-purple-100 dark:border-purple-800 pt-4 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-purple-800 dark:text-purple-200 mb-2">الحالة الافتراضية لعناصر الحزمة:</label>
                            <input 
                                type="text" 
                                value={bundleDefaultValue} 
                                onChange={e => setBundleDefaultValue(e.target.value)} 
                                className="w-full p-2 border rounded-md dark:bg-slate-900 dark:border-slate-700" 
                                placeholder="مثال: مرشوش (اتركه فارغاً للتعبئة اليدوية)" 
                            />
                            <p className="text-[10px] text-purple-400 mt-1">هذا النص سيظهر تلقائياً لجميع العناصر المضافة عبر هذه الحزمة.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-purple-800 dark:text-purple-200 mb-2">اختر البنود التي تشملها هذه الحزمة:</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 custom-scrollbar">
                                {otherFindingsInCategory.map(f => (
                                    <label key={f.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={linkedIds.includes(f.id)} 
                                            onChange={() => toggleLinkedId(f.id)}
                                            className="rounded text-purple-500"
                                        />
                                        <span className="text-sm dark:text-slate-200">{f.name}</span>
                                    </label>
                                ))}
                                {otherFindingsInCategory.length === 0 && (
                                    <p className="col-span-full text-center text-xs text-slate-400 py-4 italic">لا توجد بنود أخرى في هذا التبويب للربط.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <div>
                <label className="block text-sm font-medium mb-1">موقع العرض في التقرير</label>
                <div className="flex gap-2">
                    <label className={`flex-1 p-2 border rounded-md text-center cursor-pointer transition-colors ${reportPosition === 'right' ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white dark:bg-slate-700 dark:border-slate-600 hover:bg-slate-50'}`}>
                        <input type="radio" name="reportPosition" value="right" checked={reportPosition === 'right'} onChange={() => setReportPosition('right')} className="sr-only"/>
                        الجهة اليمنى
                    </label>
                    <label className={`flex-1 p-2 border rounded-md text-center cursor-pointer transition-colors ${reportPosition === 'center' ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white dark:bg-slate-700 dark:border-slate-600 hover:bg-slate-50'}`}>
                        <input type="radio" name="reportPosition" value="center" checked={reportPosition === 'center'} onChange={() => setReportPosition('center')} className="sr-only"/>
                        الوسط
                    </label>
                    <label className={`flex-1 p-2 border rounded-md text-center cursor-pointer transition-colors ${reportPosition === 'left' ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white dark:bg-slate-700 dark:border-slate-600 hover:bg-slate-50'}`}>
                        <input type="radio" name="reportPosition" value="left" checked={reportPosition === 'left'} onChange={() => setReportPosition('left')} className="sr-only"/>
                        الجهة اليسرى
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">المجموعة (اختياري)</label>
                    <input type="text" list="groups-list" value={group1} onChange={e => setGroup1(e.target.value)} className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="مثال: الجهة الأمامية"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium">المجموعة الثانية (اختياري)</label>
                    <input type="text" list="groups-list" value={group2} onChange={e => setGroup2(e.target.value)} className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="مثال: رش كامل"/>
                </div>
                <datalist id="groups-list">
                    {existingGroups.map(g => <option key={g} value={g} />)}
                </datalist>
            </div>

            {!isBundle && (
                <div>
                    <label className="block text-sm font-medium">الحالات المحتملة (افصل بينها بفاصلة ,)</label>
                    <input type="text" value={options} onChange={e => setOptions(e.target.value)} placeholder="مثال: سليم, مرشوش, تالف" className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"/>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium mb-2">الصورة المرجعية (تظهر في التقرير)</label>
                {!referenceImage ? (
                    <div className="flex items-center justify-center w-full">
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-50 dark:hover:bg-gray-600 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {isUploading ? <RefreshCwIcon className="w-8 h-8 mb-3 text-gray-400 animate-spin" /> : <Icon name="camera" className="w-8 h-8 mb-3 text-gray-400" />}
                                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">{isUploading ? 'جاري الرفع...' : <><span className="font-semibold">اضغط للرفع</span> أو اسحب الصورة هنا</>}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG</p>
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                        </label>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        <PositionPicker imageUrl={referenceImage} value={imagePosition} onChange={setImagePosition} />
                        <div className="flex justify-end">
                             <Button type="button" variant="danger" size="sm" onClick={removeImage} leftIcon={<Icon name="delete" className="w-4 h-4"/>}>إزالة الصورة</Button>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700 sticky bottom-0 bg-white dark:bg-slate-800 z-10">
                <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
                <Button type="submit" disabled={isUploading}>{isUploading ? 'جاري الرفع...' : 'حفظ'}</Button>
            </div>
        </form>
    );
};


export default InspectionSettingsTab;
