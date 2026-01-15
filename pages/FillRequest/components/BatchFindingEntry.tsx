import React, { useState, useMemo } from 'react';
import { PredefinedFinding } from '../../../types';
import { uuidv4 } from '../../../lib/utils';
import Icon from '../../../components/Icon';
import Button from '../../../components/Button';
import CheckCircleIcon from '../../../components/icons/CheckCircleIcon';
import FindingSearchSelect from './FindingSearchSelect';

interface BatchFindingEntryProps {
    categoryId: string;
    availableFindings: PredefinedFinding[];
    onSave: (findings: { id: string; findingId: string; value: string }[]) => void;
    onClose: () => void;
}

const BatchFindingEntry: React.FC<BatchFindingEntryProps> = ({ categoryId, availableFindings, onSave, onClose }) => {
    // Add 'bundles' to state
    const [viewMode, setViewMode] = useState<'rows' | 'gallery' | 'bundles'>('gallery');
    const [rows, setRows] = useState<{ id: string; findingId: string; value: string }[]>([{ id: uuidv4(), findingId: '', value: '' }]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [galleryValues, setGalleryValues] = useState<Record<string, string>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [defaultValue, setDefaultValue] = useState('');

    const handleAddRow = () => { setRows(prev => [...prev, { id: uuidv4(), findingId: '', value: '' }]); };
    const handleRemoveRow = (id: string) => { if (rows.length === 1) { setRows([{ id: uuidv4(), findingId: '', value: '' }]); } else { setRows(prev => prev.filter(r => r.id !== id)); } };

    const updateRow = (id: string, field: 'findingId' | 'value', val: string) => {
        setRows(prev => prev.map(r => {
            if (r.id === id) {
                const updated = { ...r, [field]: val };
                if (field === 'findingId') {
                    const finding = availableFindings.find(f => f.id === val);
                    updated.value = finding?.options?.[0] || '';
                }
                return updated;
            }
            return r;
        }));
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
                if (!galleryValues[id]) {
                    const finding = availableFindings.find(f => f.id === id);
                    setGalleryValues(prevVals => ({ ...prevVals, [id]: finding?.options?.[0] || defaultValue || '' }));
                }
            }
            return newSet;
        });
    };

    const handleGalleryValueChange = (id: string, val: string) => {
        setGalleryValues(prev => ({ ...prev, [id]: val }));
    };

    const handleSave = () => {
        if (viewMode === 'rows') {
            const validRows = rows.filter(r => r.findingId);
            if (validRows.length === 0) return;
            const finalFindings: { id: string; findingId: string; value: string }[] = [];
            validRows.forEach(row => {
                const finding = availableFindings.find(f => f.id === row.findingId);
                if (finding?.is_bundle && finding.linked_finding_ids) {
                    finding.linked_finding_ids.forEach(linkedId => {
                        const linkedFinding = availableFindings.find(af => af.id === linkedId);
                        if (linkedFinding) {
                            finalFindings.push({ id: uuidv4(), findingId: linkedFinding.id, value: finding.bundle_default_value || '' });
                        }
                    });
                } else { finalFindings.push(row); }
            });
            onSave(finalFindings);
        } else {
            if (selectedIds.size === 0) return;
            const finalFindings: { id: string; findingId: string; value: string }[] = [];
            selectedIds.forEach(fid => {
                const finding = availableFindings.find(f => f.id === fid);
                if (finding?.is_bundle && finding.linked_finding_ids) {
                    finding.linked_finding_ids.forEach(linkedId => {
                        const linkedFinding = availableFindings.find(af => af.id === linkedId);
                        if (linkedFinding) {
                            finalFindings.push({ id: uuidv4(), findingId: linkedFinding.id, value: finding.bundle_default_value || defaultValue || '' });
                        }
                    });
                } else if (finding) {
                    const val = galleryValues[fid] || defaultValue || finding.options?.[0] || '';
                    finalFindings.push({ id: uuidv4(), findingId: fid, value: val });
                }
            });
            onSave(finalFindings);
        }
    };

    const filteredFindings = useMemo(() => {
        let list = availableFindings;

        // Filter for Bundles mode
        if (viewMode === 'bundles') {
            list = list.filter(f => f.is_bundle);
        }

        if (!searchTerm) return list;
        return list.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [availableFindings, searchTerm, viewMode]);

    return (
        <div className="flex flex-col h-[75vh] bg-gray-50 dark:bg-slate-900 rounded-lg overflow-hidden">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b dark:border-slate-700">
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg gap-1">
                    <button
                        onClick={() => setViewMode('gallery')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'gallery' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <Icon name="findings" className="w-4 h-4" />
                        المعرض
                    </button>
                    {/* New Smart Bundles Button */}
                    <button
                        onClick={() => setViewMode('bundles')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'bundles' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <Icon name="sparkles" className="w-4 h-4" />
                        الحزم الذكية
                    </button>
                    <button
                        onClick={() => setViewMode('rows')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'rows' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <Icon name="add" className="w-4 h-4" />
                        يدوي
                    </button>
                </div>

                <div className="relative w-64">
                    <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="ابحث باسم البند..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-900 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {viewMode === 'gallery' || viewMode === 'bundles' ? (
                    filteredFindings.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredFindings.map(finding => {
                                const isSelected = selectedIds.has(finding.id);
                                return (
                                    <div
                                        key={finding.id}
                                        onClick={() => toggleSelection(finding.id)}
                                        className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 ${isSelected ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-white dark:border-slate-800 hover:border-blue-300'} ${finding.is_bundle ? 'shadow-md shadow-purple-100 dark:shadow-none' : ''}`}
                                    >
                                        <div className={`aspect-square bg-slate-200 dark:bg-slate-700 relative ${isSelected ? 'h-32' : ''}`}>
                                            {finding.reference_image ? (
                                                <img
                                                    src={finding.reference_image}
                                                    className="w-full h-full object-cover"
                                                    style={{ objectPosition: finding.reference_image_position || 'center' }}
                                                    alt=""
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                    <Icon name={finding.is_bundle ? "sparkles" : "findings"} className={`w-8 h-8 opacity-20 ${finding.is_bundle ? 'text-purple-500' : ''}`} />
                                                </div>
                                            )}
                                            {/* Inline Input for selected items */}
                                            {isSelected && !finding.is_bundle && (
                                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-white/95 dark:bg-slate-800/95 border-t border-blue-200 dark:border-blue-800 animate-slide-in-up" onClick={e => e.stopPropagation()}>
                                                    {finding.options && finding.options.length > 0 ? (
                                                        <select
                                                            value={galleryValues[finding.id] || ''}
                                                            onChange={(e) => handleGalleryValueChange(finding.id, e.target.value)}
                                                            className="w-full text-xs p-1.5 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                                                            dir="auto"
                                                        >
                                                            <option value="">{defaultValue || '-- اختر الحالة --'}</option>
                                                            {finding.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={galleryValues[finding.id] || ''}
                                                            onChange={(e) => handleGalleryValueChange(finding.id, e.target.value)}
                                                            placeholder={defaultValue || "الحالة..."}
                                                            className="w-full text-xs p-1.5 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className={`p-3 transition-colors ${isSelected ? 'bg-blue-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
                                            <div className="text-xs font-bold truncate">{finding.is_bundle && '⚡ '}{finding.name}</div>
                                            {finding.is_bundle && <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-purple-500'}`}>حزمة ذكية</div>}
                                        </div>

                                        {isSelected && (
                                            <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1 shadow-lg animate-scale-in z-10">
                                                <CheckCircleIcon className="w-5 h-5" />
                                            </div>
                                        )}

                                        {!isSelected && (
                                            <div className="absolute top-2 right-2 bg-black/20 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="w-5 h-5 border-2 border-white rounded-full"></div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            {viewMode === 'bundles' ? (
                                <>
                                    <Icon name="sparkles" className="w-12 h-12 mb-2 opacity-20" />
                                    <p>لا توجد حزم ذكية معرفة في هذا القسم.</p>
                                    <p className="text-xs mt-1">يمكنك إنشاء حزم جديدة من الإعدادات -{'>'} إعدادات الفحص.</p>
                                </>
                            ) : (
                                <p>لا توجد نتائج.</p>
                            )}
                        </div>
                    )
                ) : (
                    <div className="space-y-3">
                        {rows.map((row, index) => {
                            const selectedFinding = availableFindings.find(f => f.id === row.findingId);
                            const otherSelectedIds = rows.filter(r => r.id !== row.id).map(r => r.findingId);
                            const filteredOptions = availableFindings.filter(f => !otherSelectedIds.includes(f.id) || f.id === row.findingId);
                            return (
                                <div key={row.id} className={`flex flex-col md:flex-row gap-4 items-start md:items-center bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-md animate-fade-in-up border-r-4 ${selectedFinding?.is_bundle ? 'border-r-purple-500' : 'border-r-blue-500'}`}>
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${selectedFinding?.is_bundle ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'} text-sm font-bold flex-shrink-0 shadow-sm border border-current opacity-70`}>{index + 1}</div>
                                    <div className="flex-grow w-full md:w-2/5"><FindingSearchSelect selectedId={row.findingId} onSelect={(id) => updateRow(row.id, 'findingId', id)} availableFindings={filteredOptions} /></div>
                                    <div className="flex-grow w-full md:w-1/3">
                                        {selectedFinding?.is_bundle ? (<div className="w-full p-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-800 text-xs font-bold flex items-center gap-2"><Icon name="sparkles" className="w-4 h-4" />حزمة: سيتم إضافة {selectedFinding.linked_finding_ids?.length || 0} بنود</div>) : selectedFinding?.options && selectedFinding.options.length > 0 ? (<div className="relative group"><select value={row.value} onChange={(e) => updateRow(row.id, 'value', e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 transition-all disabled:opacity-50"><option value="">-- اختر الحالة --</option>{selectedFinding.options.map((opt, idx) => (<option key={idx} value={opt}>{opt}</option>))}</select></div>) : (<input type="text" value={row.value} onChange={(e) => updateRow(row.id, 'value', e.target.value.toUpperCase())} placeholder="الحالة/القيمة (اختياري)" className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 transition-all disabled:opacity-50 uppercase" disabled={!row.findingId} />)}
                                    </div>
                                    <button onClick={() => handleRemoveRow(row.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all hover:scale-110 active:scale-90" title="حذف السطر"><Icon name="delete" className="w-5 h-5" /></button>
                                </div>
                            );
                        })}
                        <button onClick={handleAddRow} className="w-full py-4 border-2 border-dashed border-blue-200 dark:border-blue-900/50 rounded-xl text-blue-500 dark:text-blue-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-3 font-bold group shadow-sm bg-white dark:bg-slate-800"><div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30 group-hover:scale-110 transition-transform"><Icon name="add" className="w-5 h-5" /></div>إضافة سطر جديد</button>
                    </div>
                )}
            </div>

            <div className="p-6 border-t dark:border-slate-700 bg-white dark:bg-slate-800 shadow-inner flex flex-col sm:flex-row justify-between items-center gap-4 z-10 relative">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-full border border-blue-100 dark:border-blue-800/50">
                        <span className="text-sm text-slate-600 dark:text-slate-300">المحددة:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">{viewMode === 'rows' ? rows.filter(r => r.findingId).length : selectedIds.size}</span>
                    </div>

                    {(viewMode === 'gallery' || viewMode === 'bundles') && selectedIds.size > 0 && (
                        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-800/50">
                            <span className="text-xs text-slate-500 dark:text-slate-400">القيمة الافتراضية:</span>
                            <select
                                value={defaultValue}
                                onChange={(e) => setDefaultValue(e.target.value)}
                                className="text-xs font-bold bg-transparent border-0 focus:ring-0 p-0 text-green-700 dark:text-green-400"
                            >
                                <option value="">تلقائي</option>
                                <option value="OK">OK</option>
                                <option value="جيد">جيد</option>
                                <option value="يحتاج تغيير">يحتاج تغيير</option>
                                <option value="تالف">تالف</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                    {(viewMode === 'gallery' || viewMode === 'bundles') && (
                        <Button variant="secondary" onClick={() => setSelectedIds(new Set(filteredFindings.map(f => f.id)))} size="sm">تحديد الكل</Button>
                    )}
                    <Button variant="secondary" onClick={onClose}>إلغاء</Button>
                    <Button
                        onClick={handleSave}
                        disabled={((viewMode === 'gallery' || viewMode === 'bundles') ? selectedIds.size === 0 : rows.filter(r => r.findingId).length === 0)}
                        className="px-8 shadow-lg shadow-blue-500/20"
                    >
                        حفظ وإضافة للتقرير
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default BatchFindingEntry;
