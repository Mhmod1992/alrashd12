import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { CardPositionsSettings as CardPositionsSettingsType, PredefinedFinding } from '../../types';
import Icon from '../../components/Icon';
import Button from '../../components/Button';

const GROUP_NAME_MAPPING: Record<string, string> = {
    'الجهة الأمامية': 'الأمام',
    'الجهة الخلفية': 'الخلف',
    'الجهة اليمنى': 'اليمين',
    'الجهة اليسرى': 'اليسار',
};

const getShortGroupName = (groupName: string) => GROUP_NAME_MAPPING[groupName] || groupName;

const CardPositionsSettings: React.FC = () => {
    const {
        customFindingCategories,
        predefinedFindings,
        settings,
        updateSettings,
        addNotification,
        showConfirmModal,
    } = useAppContext();

    const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => customFindingCategories[0]?.id || '');
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'gallery' | 'bundles'>('gallery');
    const [searchTerm, setSearchTerm] = useState('');

    const [draftConfig, setDraftConfig] = useState<CardPositionsSettingsType>(() => ({
        groupOrderByCategory: { ...(settings.cardPositionsSettings?.groupOrderByCategory || {}) },
        findingOrderByGroup: { ...(settings.cardPositionsSettings?.findingOrderByGroup || {}) },
    }));
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Drag states
    const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
    const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
    const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
    const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedCategoryId && customFindingCategories.length > 0) {
            setSelectedCategoryId(customFindingCategories[0].id);
        }
    }, [customFindingCategories, selectedCategoryId]);

    useEffect(() => {
        if (!isDirty) {
            setDraftConfig({
                groupOrderByCategory: { ...(settings.cardPositionsSettings?.groupOrderByCategory || {}) },
                findingOrderByGroup: { ...(settings.cardPositionsSettings?.findingOrderByGroup || {}) },
            });
        }
    }, [settings.cardPositionsSettings, isDirty]);

    const categoryFindings = useMemo(() => {
        return predefinedFindings.filter(f => f.category_id === selectedCategoryId);
    }, [predefinedFindings, selectedCategoryId]);

    // Ordered group buttons for selected category
    const orderedGroups = useMemo(() => {
        const groups = new Set<string>();
        categoryFindings.forEach(f => {
            if (f.group) groups.add(f.group);
            if (f.groups) f.groups.forEach(g => groups.add(g));
        });
        const rawGroups = Array.from(groups).sort();
        const savedOrder = draftConfig.groupOrderByCategory?.[selectedCategoryId];
        if (!savedOrder || savedOrder.length === 0) return rawGroups;

        const orderMap = new Map<string, number>();
        savedOrder.forEach((g, idx) => orderMap.set(g, idx));

        return [...rawGroups].sort((a, b) => {
            const idxA = orderMap.has(a) ? orderMap.get(a)! : Number.MAX_SAFE_INTEGER;
            const idxB = orderMap.has(b) ? orderMap.get(b)! : Number.MAX_SAFE_INTEGER;
            if (idxA !== idxB) return idxA - idxB;
            return a.localeCompare(b);
        });
    }, [categoryFindings, draftConfig.groupOrderByCategory, selectedCategoryId]);

    const currentGroupKey = `${selectedCategoryId}::${selectedGroup ?? '__ALL__'}`;
    const fallbackAllKey = `${selectedCategoryId}::__ALL__`;

    // Ordered findings for current category + selected group (before search filter)
    const orderedGroupFindings = useMemo(() => {
        let list: PredefinedFinding[] = categoryFindings;
        if (viewMode === 'bundles') {
            list = list.filter(f => f.is_bundle);
        }
        if (selectedGroup) {
            list = list.filter(f => f.group === selectedGroup || f.groups?.includes(selectedGroup));
        }

        const customOrder =
            draftConfig.findingOrderByGroup?.[currentGroupKey] ||
            (selectedGroup ? draftConfig.findingOrderByGroup?.[fallbackAllKey] : undefined);

        if (!customOrder || customOrder.length === 0) return list;

        const orderMap = new Map<string, number>();
        customOrder.forEach((id, idx) => orderMap.set(id, idx));

        return [...list].sort((a, b) => {
            const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
            const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
            if (idxA !== idxB) return idxA - idxB;
            return 0;
        });
    }, [categoryFindings, viewMode, selectedGroup, draftConfig.findingOrderByGroup, currentGroupKey, fallbackAllKey]);

    const displayedFindings = useMemo(() => {
        if (!searchTerm.trim()) return orderedGroupFindings;
        const term = searchTerm.toLowerCase();
        return orderedGroupFindings.filter(f => f.name.toLowerCase().includes(term));
    }, [orderedGroupFindings, searchTerm]);

    // --- Group Reordering Helpers ---
    const commitGroupOrder = (newOrder: string[]) => {
        setDraftConfig(prev => ({
            ...prev,
            groupOrderByCategory: {
                ...(prev.groupOrderByCategory || {}),
                [selectedCategoryId]: newOrder,
            },
        }));
        setIsDirty(true);
    };

    const moveGroup = (groupName: string, delta: -1 | 1) => {
        const idx = orderedGroups.indexOf(groupName);
        if (idx === -1) return;
        const targetIdx = idx + delta;
        if (targetIdx < 0 || targetIdx >= orderedGroups.length) return;
        const updated = [...orderedGroups];
        const [moved] = updated.splice(idx, 1);
        updated.splice(targetIdx, 0, moved);
        commitGroupOrder(updated);
    };

    const handleGroupDrop = (targetGroup: string) => {
        if (!draggedGroup || draggedGroup === targetGroup) {
            setDraggedGroup(null);
            setDragOverGroup(null);
            return;
        }
        const fromIdx = orderedGroups.indexOf(draggedGroup);
        const toIdx = orderedGroups.indexOf(targetGroup);
        if (fromIdx === -1 || toIdx === -1) return;
        const updated = [...orderedGroups];
        const [moved] = updated.splice(fromIdx, 1);
        updated.splice(toIdx, 0, moved);
        commitGroupOrder(updated);
        setDraggedGroup(null);
        setDragOverGroup(null);
    };

    // --- Card Reordering Helpers ---
    // Preserves non-visible findings (e.g. bundles vs gallery) by building the full order for currentGroupKey
    const buildFullGroupFindingIds = () => {
        const baseList = selectedGroup
            ? categoryFindings.filter(f => f.group === selectedGroup || f.groups?.includes(selectedGroup))
            : categoryFindings;
        const customOrder =
            draftConfig.findingOrderByGroup?.[currentGroupKey] ||
            (selectedGroup ? draftConfig.findingOrderByGroup?.[fallbackAllKey] : undefined);
        if (!customOrder || customOrder.length === 0) return baseList.map(f => f.id);
        const orderMap = new Map<string, number>();
        customOrder.forEach((id, idx) => orderMap.set(id, idx));
        return [...baseList]
            .sort((a, b) => {
                const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
                const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
                if (idxA !== idxB) return idxA - idxB;
                return 0;
            })
            .map(f => f.id);
    };

    const commitCardOrder = (newFullIds: string[]) => {
        setDraftConfig(prev => ({
            ...prev,
            findingOrderByGroup: {
                ...(prev.findingOrderByGroup || {}),
                [currentGroupKey]: newFullIds,
            },
        }));
        setIsDirty(true);
    };

    const moveCard = (findingId: string, delta: -1 | 1) => {
        const visibleIds = orderedGroupFindings.map(f => f.id);
        const visIdx = visibleIds.indexOf(findingId);
        if (visIdx === -1) return;
        const targetVisIdx = visIdx + delta;
        if (targetVisIdx < 0 || targetVisIdx >= visibleIds.length) return;
        const targetFindingId = visibleIds[targetVisIdx];

        const fullIds = buildFullGroupFindingIds();
        const fromIdx = fullIds.indexOf(findingId);
        const toIdx = fullIds.indexOf(targetFindingId);
        if (fromIdx === -1 || toIdx === -1) return;

        const updated = [...fullIds];
        const [moved] = updated.splice(fromIdx, 1);
        updated.splice(toIdx, 0, moved);
        commitCardOrder(updated);
    };

    const handleCardDrop = (targetCardId: string) => {
        if (!draggedCardId || draggedCardId === targetCardId) {
            setDraggedCardId(null);
            setDragOverCardId(null);
            return;
        }
        const fullIds = buildFullGroupFindingIds();
        const fromIdx = fullIds.indexOf(draggedCardId);
        const toIdx = fullIds.indexOf(targetCardId);
        if (fromIdx === -1 || toIdx === -1) {
            setDraggedCardId(null);
            setDragOverCardId(null);
            return;
        }
        const updated = [...fullIds];
        const [moved] = updated.splice(fromIdx, 1);
        updated.splice(toIdx, 0, moved);
        commitCardOrder(updated);
        setDraggedCardId(null);
        setDragOverCardId(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings({
                cardPositionsSettings: draftConfig,
            });
            setIsDirty(false);
            addNotification({
                title: 'تم الحفظ',
                message: 'تم حفظ مواقع البطاقات وأزرار الفلاتر وتعميمها على جميع المستخدمين.',
                type: 'success',
            });
        } catch (error) {
            console.error('Failed to save card positions:', error);
            addNotification({
                title: 'خطأ في الحفظ',
                message: 'تعذر حفظ الترتيب، يرجى المحاولة مرة أخرى.',
                type: 'error',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetCategory = () => {
        const categoryName = customFindingCategories.find(c => c.id === selectedCategoryId)?.name || 'القسم الحالي';
        showConfirmModal({
            title: `إعادة ضبط ترتيب "${categoryName}"`,
            message: 'هل تريد إعادة ضبط ترتيب أزرار الفلاتر والبطاقات لهذا القسم إلى الترتيب الافتراضي؟ (تحتاج للضغط على حفظ لتثبيت التغيير)',
            onConfirm: () => {
                setDraftConfig(prev => {
                    const nextGroupOrder = { ...(prev.groupOrderByCategory || {}) };
                    delete nextGroupOrder[selectedCategoryId];

                    const nextFindingOrder = { ...(prev.findingOrderByGroup || {}) };
                    Object.keys(nextFindingOrder).forEach(k => {
                        if (k.startsWith(`${selectedCategoryId}::`)) {
                            delete nextFindingOrder[k];
                        }
                    });
                    return {
                        groupOrderByCategory: nextGroupOrder,
                        findingOrderByGroup: nextFindingOrder,
                    };
                });
                setIsDirty(true);
            },
        });
    };

    const activeCategory = customFindingCategories.find(c => c.id === selectedCategoryId);

    if (customFindingCategories.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">
                لا توجد أقسام فحص معرفة حالياً.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Top Controls: Category Selector + Save/Reset */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                            ضبط مواقع البطاقات وأزرار الفلاتر
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            رتّب أزرار الفلاتر والبطاقات بالسحب والإفلات أو بالأسهم كما تحب أن تظهر للموظفين، ثم اضغط حفظ.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleResetCategory}
                            className="text-xs"
                        >
                            إعادة ضبط القسم
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || !isDirty}
                            size="sm"
                            leftIcon={<Icon name="save" className="w-4 h-4" />}
                            className="text-xs sm:text-sm whitespace-nowrap"
                        >
                            {isSaving ? 'جاري الحفظ...' : 'حفظ الترتيب لجميع المستخدمين'}
                        </Button>
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex overflow-x-auto hide-scrollbar gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {customFindingCategories.map(cat => {
                        const isActive = cat.id === selectedCategoryId;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                    setSelectedCategoryId(cat.id);
                                    setSelectedGroup(null);
                                    setSearchTerm('');
                                }}
                                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border ${
                                    isActive
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Mirror of BatchFindingEntry Modal */}
            <div className="flex flex-col bg-gray-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                {/* Modal-like Title Strip */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        معاينة وضبط: {activeCategory?.name || ''} {selectedGroup ? `← ${getShortGroupName(selectedGroup)}` : '← الكل'}
                    </span>
                    {isDirty && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            تغييرات غير محفوظة
                        </span>
                    )}
                </div>

                {/* Header / Tabs & Group Filters */}
                <div className="flex flex-col p-4 bg-white dark:bg-slate-800 border-b dark:border-slate-700 gap-3 shrink-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg gap-1 shrink-0 self-start">
                            <button
                                type="button"
                                onClick={() => setViewMode('gallery')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'gallery' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                <Icon name="findings" className="w-4 h-4" />
                                المعرض
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('bundles')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'bundles' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                <Icon name="sparkles" className="w-4 h-4" />
                                الحزم الذكية
                            </button>
                        </div>

                        <div className="relative w-full md:w-64 shrink-0">
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

                    {/* Group Filter Buttons (Draggable + Quick Arrows) */}
                    {orderedGroups.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                                ترتيب أزرار الفلاتر (اسحب الزر لتغيير مكانه، أو استخدم الأسهم، واضغط على أي فلتر لترتيب بطاقاته):
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pb-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedGroup(null)}
                                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                        selectedGroup === null
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    الكل
                                </button>

                                {orderedGroups.map((g, idx) => {
                                    const isActive = selectedGroup === g;
                                    const isDragOver = dragOverGroup === g && draggedGroup !== g;
                                    return (
                                        <div
                                            key={g}
                                            draggable
                                            onDragStart={(e) => {
                                                e.stopPropagation();
                                                setDraggedGroup(g);
                                            }}
                                            onDragOver={(e) => {
                                                if (!draggedGroup) return;
                                                e.preventDefault();
                                                if (dragOverGroup !== g) setDragOverGroup(g);
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                handleGroupDrop(g);
                                            }}
                                            onDragEnd={() => {
                                                setDraggedGroup(null);
                                                setDragOverGroup(null);
                                            }}
                                            onClick={() => setSelectedGroup(g)}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold cursor-grab active:cursor-grabbing select-none transition-all border ${
                                                isDragOver
                                                    ? 'ring-2 ring-blue-500 scale-105 bg-blue-50 dark:bg-blue-900/40 border-blue-400'
                                                    : isActive
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-300 dark:border-blue-700 shadow-xs'
                                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                disabled={idx === 0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    moveGroup(g, -1);
                                                }}
                                                className="p-0.5 rounded-full hover:bg-white/80 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed"
                                                title="تحريك لليمين"
                                            >
                                                <Icon name="chevron-right" className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="px-1 whitespace-nowrap">{getShortGroupName(g)}</span>
                                            <button
                                                type="button"
                                                disabled={idx === orderedGroups.length - 1}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    moveGroup(g, 1);
                                                }}
                                                className="p-0.5 rounded-full hover:bg-white/80 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed"
                                                title="تحريك لليسار"
                                            >
                                                <Icon name="chevron-left" className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Gallery Grid (Draggable + Move Arrows) */}
                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {displayedFindings.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {displayedFindings.map((finding, index) => {
                                const fullVisIdx = orderedGroupFindings.findIndex(f => f.id === finding.id);
                                const isDragging = draggedCardId === finding.id;
                                const isDragOver = dragOverCardId === finding.id && draggedCardId !== finding.id;
                                return (
                                    <div
                                        key={finding.id}
                                        draggable
                                        onDragStart={() => setDraggedCardId(finding.id)}
                                        onDragOver={(e) => {
                                            if (!draggedCardId) return;
                                            e.preventDefault();
                                            if (dragOverCardId !== finding.id) setDragOverCardId(finding.id);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            handleCardDrop(finding.id);
                                        }}
                                        onDragEnd={() => {
                                            setDraggedCardId(null);
                                            setDragOverCardId(null);
                                        }}
                                        className={`relative group cursor-grab active:cursor-grabbing rounded-xl overflow-hidden border-2 transition-all duration-200 select-none ${
                                            isDragging
                                                ? 'opacity-40 scale-95 border-blue-400'
                                                : isDragOver
                                                    ? 'border-blue-500 ring-4 ring-blue-500/20 scale-[1.03]'
                                                    : 'border-white dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600'
                                        } ${finding.is_bundle ? 'shadow-md shadow-purple-100 dark:shadow-none' : 'shadow-sm'}`}
                                    >
                                        {/* Position Badge */}
                                        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-slate-900/75 text-white text-[10px] font-bold font-mono shadow">
                                            #{index + 1}
                                        </div>

                                        {/* Quick Move Controls */}
                                        <div
                                            className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 rounded-full px-1 py-0.5 shadow border border-slate-200 dark:border-slate-700"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                type="button"
                                                disabled={fullVisIdx <= 0}
                                                onClick={() => moveCard(finding.id, -1)}
                                                className="p-0.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 disabled:opacity-25 disabled:cursor-not-allowed"
                                                title="تقديم لليمين"
                                            >
                                                <Icon name="chevron-right" className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={fullVisIdx === -1 || fullVisIdx >= orderedGroupFindings.length - 1}
                                                onClick={() => moveCard(finding.id, 1)}
                                                className="p-0.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 disabled:opacity-25 disabled:cursor-not-allowed"
                                                title="تأخير لليسار"
                                            >
                                                <Icon name="chevron-left" className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="aspect-square bg-slate-200 dark:bg-slate-700 relative">
                                            {finding.reference_image ? (
                                                <img
                                                    src={finding.reference_image}
                                                    className="w-full h-full object-cover pointer-events-none"
                                                    style={{ objectPosition: finding.reference_image_position || 'center' }}
                                                    alt=""
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                    <Icon name={finding.is_bundle ? 'sparkles' : 'findings'} className={`w-8 h-8 opacity-20 ${finding.is_bundle ? 'text-purple-500' : ''}`} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                            <div className="text-xs font-bold truncate" title={finding.name}>
                                                {finding.is_bundle && '⚡ '}{finding.name}
                                            </div>
                                            {finding.is_bundle && <div className="text-[10px] text-purple-500">حزمة ذكية</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                            <Icon name="findings" className="w-10 h-10 mb-2 opacity-25" />
                            <p className="text-sm">لا توجد بنود في هذا التبويب.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CardPositionsSettings;
