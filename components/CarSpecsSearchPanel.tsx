import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CarMake, CarModel } from '../types';
import YearPicker from './YearPicker';
import CustomDatePicker from './CustomDatePicker';
import Button from './Button';
import ChevronDownIcon from './icons/ChevronDownIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import SearchIcon from './icons/SearchIcon';
import XIcon from './icons/XIcon';
import CarIcon from './icons/CarIcon';

interface CarSpecsSearchPanelProps {
    carMakes: CarMake[];
    carModels: CarModel[];
    selectedMake: CarMake | null;
    selectedModel: CarModel | null;
    selectedYear: number | null;
    startDate: string;
    endDate: string;
    onSelectMake: (make: CarMake | null) => void;
    onSelectModel: (model: CarModel | null) => void;
    onSelectYear: (year: number | null) => void;
    onChangeStartDate: (date: string) => void;
    onChangeEndDate: (date: string) => void;
    onSubmitSearch: () => void;
    onClearAll: () => void;
    fetchCarModelsByMake: (makeId: string) => Promise<void>;
    searchCarMakes: (query: string) => Promise<CarMake[]>;
    searchCarModels: (makeId: string, query: string) => Promise<CarModel[]>;
    isSearching?: boolean;
    hasPendingChanges?: boolean;
    isSearchApplied?: boolean;
}

const CarSpecsSearchPanel: React.FC<CarSpecsSearchPanelProps> = ({
    carMakes,
    carModels,
    selectedMake,
    selectedModel,
    selectedYear,
    startDate,
    endDate,
    onSelectMake,
    onSelectModel,
    onSelectYear,
    onChangeStartDate,
    onChangeEndDate,
    onSubmitSearch,
    onClearAll,
    fetchCarModelsByMake,
    searchCarMakes,
    searchCarModels,
    isSearching = false,
    hasPendingChanges = false,
    isSearchApplied = false,
}) => {
    const [makeTerm, setMakeTerm] = useState(
        selectedMake ? `${selectedMake.name_en}${selectedMake.name_ar ? ` (${selectedMake.name_ar})` : ''}` : ''
    );
    const [modelTerm, setModelTerm] = useState(
        selectedModel ? `${selectedModel.name_en}${selectedModel.name_ar ? ` (${selectedModel.name_ar})` : ''}` : ''
    );

    const [isMakeDropdownOpen, setIsMakeDropdownOpen] = useState(false);
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

    const [makeSuggestions, setMakeSuggestions] = useState<CarMake[]>([]);
    const [modelSuggestions, setModelSuggestions] = useState<CarModel[]>([]);

    const [isSearchingMake, setIsSearchingMake] = useState(false);
    const [isSearchingModel, setIsSearchingModel] = useState(false);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    const [makeSuggestionIndex, setMakeSuggestionIndex] = useState(-1);
    const [modelSuggestionIndex, setModelSuggestionIndex] = useState(-1);

    const makeDropdownRef = useRef<HTMLDivElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const makeDebounceRef = useRef<number | null>(null);
    const modelDebounceRef = useRef<number | null>(null);

    useEffect(() => {
        if (selectedMake) {
            setMakeTerm(`${selectedMake.name_en}${selectedMake.name_ar ? ` (${selectedMake.name_ar})` : ''}`);
        } else {
            setMakeTerm('');
        }
    }, [selectedMake]);

    useEffect(() => {
        if (selectedModel) {
            setModelTerm(`${selectedModel.name_en}${selectedModel.name_ar ? ` (${selectedModel.name_ar})` : ''}`);
        } else {
            setModelTerm('');
        }
    }, [selectedModel]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (makeDropdownRef.current && !makeDropdownRef.current.contains(e.target as Node)) {
                setIsMakeDropdownOpen(false);
            }
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        return () => {
            if (makeDebounceRef.current) window.clearTimeout(makeDebounceRef.current);
            if (modelDebounceRef.current) window.clearTimeout(modelDebounceRef.current);
        };
    }, []);

    const displayMakes = useMemo(() => {
        const term = makeTerm.trim().toLowerCase();
        const selectedLabel = selectedMake
            ? `${selectedMake.name_en}${selectedMake.name_ar ? ` (${selectedMake.name_ar})` : ''}`.toLowerCase()
            : '';

        if (!term || term === selectedLabel) {
            return carMakes;
        }

        const localFiltered = carMakes.filter(
            m =>
                m.name_en.toLowerCase().includes(term) ||
                (m.name_ar && m.name_ar.toLowerCase().includes(term))
        );

        if (makeSuggestions.length > 0) {
            const seen = new Set(localFiltered.map(m => m.id));
            return [...localFiltered, ...makeSuggestions.filter(m => !seen.has(m.id))];
        }
        return localFiltered;
    }, [makeTerm, carMakes, makeSuggestions, selectedMake]);

    const displayModels = useMemo(() => {
        if (!selectedMake) return [];
        const makeModels = carModels.filter(m => m.make_id === selectedMake.id);
        const term = modelTerm.trim().toLowerCase();
        const selectedLabel = selectedModel
            ? `${selectedModel.name_en}${selectedModel.name_ar ? ` (${selectedModel.name_ar})` : ''}`.toLowerCase()
            : '';

        if (!term || term === selectedLabel) {
            return makeModels;
        }

        const localFiltered = makeModels.filter(
            m =>
                m.name_en.toLowerCase().includes(term) ||
                (m.name_ar && m.name_ar.toLowerCase().includes(term))
        );

        if (modelSuggestions.length > 0) {
            const seen = new Set(localFiltered.map(m => m.id));
            return [...localFiltered, ...modelSuggestions.filter(m => !seen.has(m.id))];
        }
        return localFiltered;
    }, [selectedMake, carModels, modelTerm, modelSuggestions, selectedModel]);

    const handleMakeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setMakeTerm(val);
        setMakeSuggestionIndex(-1);
        setIsMakeDropdownOpen(true);

        if (selectedMake) {
            onSelectMake(null);
            onSelectModel(null);
            setModelTerm('');
            setModelSuggestions([]);
        }

        if (!val.trim()) {
            setMakeSuggestions([]);
            setIsSearchingMake(false);
            return;
        }

        if (makeDebounceRef.current) window.clearTimeout(makeDebounceRef.current);
        setIsSearchingMake(true);
        makeDebounceRef.current = window.setTimeout(async () => {
            try {
                const results = await searchCarMakes(val.trim());
                setMakeSuggestions(results);
            } finally {
                setIsSearchingMake(false);
            }
        }, 250);
    };

    const handleChooseMake = async (make: CarMake) => {
        setIsMakeDropdownOpen(false);
        setMakeSuggestionIndex(-1);
        setMakeSuggestions([]);
        onSelectMake(make);
        onSelectModel(null);
        setModelTerm('');
        setModelSuggestions([]);

        const hasModels = carModels.some(m => m.make_id === make.id);
        if (!hasModels) {
            setIsLoadingModels(true);
            try {
                await fetchCarModelsByMake(make.id);
            } finally {
                setIsLoadingModels(false);
            }
        }
    };

    const handleClearMake = () => {
        setMakeTerm('');
        setModelTerm('');
        setMakeSuggestions([]);
        setModelSuggestions([]);
        setIsMakeDropdownOpen(false);
        setIsModelDropdownOpen(false);
        onSelectMake(null);
        onSelectModel(null);
    };

    const handleModelInputFocus = async () => {
        if (!selectedMake) return;
        setIsModelDropdownOpen(true);
        const hasModels = carModels.some(m => m.make_id === selectedMake.id);
        if (!hasModels && !isLoadingModels) {
            setIsLoadingModels(true);
            try {
                await fetchCarModelsByMake(selectedMake.id);
            } finally {
                setIsLoadingModels(false);
            }
        }
    };

    const handleModelInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedMake) return;
        const val = e.target.value;
        setModelTerm(val);
        setModelSuggestionIndex(-1);
        setIsModelDropdownOpen(true);

        if (selectedModel) {
            onSelectModel(null);
        }

        if (!val.trim()) {
            setModelSuggestions([]);
            setIsSearchingModel(false);
            return;
        }

        if (modelDebounceRef.current) window.clearTimeout(modelDebounceRef.current);
        setIsSearchingModel(true);
        modelDebounceRef.current = window.setTimeout(async () => {
            try {
                const results = await searchCarModels(selectedMake.id, val.trim());
                setModelSuggestions(results);
            } finally {
                setIsSearchingModel(false);
            }
        }, 250);
    };

    const handleChooseModel = (model: CarModel) => {
        setIsModelDropdownOpen(false);
        setModelSuggestionIndex(-1);
        setModelSuggestions([]);
        onSelectModel(model);
    };

    const handleClearModel = () => {
        setModelTerm('');
        setModelSuggestions([]);
        setIsModelDropdownOpen(false);
        onSelectModel(null);
    };

    const handleMakeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isMakeDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setIsMakeDropdownOpen(true);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMakeSuggestionIndex(prev => (prev < displayMakes.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMakeSuggestionIndex(prev => (prev > 0 ? prev - 1 : displayMakes.length - 1));
        } else if (e.key === 'Enter' && isMakeDropdownOpen && makeSuggestionIndex >= 0 && displayMakes[makeSuggestionIndex]) {
            e.preventDefault();
            handleChooseMake(displayMakes[makeSuggestionIndex]);
        } else if (e.key === 'Escape') {
            setIsMakeDropdownOpen(false);
        }
    };

    const handleModelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!selectedMake) return;
        if (!isModelDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setIsModelDropdownOpen(true);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setModelSuggestionIndex(prev => (prev < displayModels.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setModelSuggestionIndex(prev => (prev > 0 ? prev - 1 : displayModels.length - 1));
        } else if (e.key === 'Enter' && isModelDropdownOpen && modelSuggestionIndex >= 0 && displayModels[modelSuggestionIndex]) {
            e.preventDefault();
            handleChooseModel(displayModels[modelSuggestionIndex]);
        } else if (e.key === 'Escape') {
            setIsModelDropdownOpen(false);
        }
    };

    const hasAnyInput = Boolean(selectedMake || selectedModel || selectedYear || startDate || endDate);

    const parseDateValue = (dateStr: string): Date | undefined => {
        if (!dateStr) return undefined;
        const parts = dateStr.split('-').map(Number);
        if (parts.length === 3 && parts.every(n => !isNaN(n))) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return new Date(dateStr);
    };

    const inputBaseClass =
        'block w-full p-2.5 pl-14 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm transition-colors';

    const dateInputClass =
        'block w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm transition-colors';

    return (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 animate-fade-in space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        <CarIcon className="w-4 h-4" />
                    </span>
                    <span>بحث مخصص بمواصفات السيارة</span>
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 hidden sm:inline">
                        (حدد المواصفات والفترة الزمنية الاختيارية ثم اضغط &quot;بدء البحث&quot;)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {isSearchApplied && hasPendingChanges && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                            تعديلات غير مطبقة — اضغط بدء البحث
                        </span>
                    )}
                    {(hasAnyInput || isSearchApplied) && (
                        <button
                            type="button"
                            onClick={onClearAll}
                            disabled={isSearching}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                            <span>مسح الكل</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Row 1: Make, Model, Year */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Make */}
                <div className="relative" ref={makeDropdownRef}>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        الشركة المصنعة
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={makeTerm}
                            onChange={handleMakeInputChange}
                            onFocus={() => setIsMakeDropdownOpen(true)}
                            onKeyDown={handleMakeKeyDown}
                            placeholder="ابحث أو اختر الشركة (تويوتا، Toyota...)"
                            className={inputBaseClass}
                            autoComplete="off"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 gap-1">
                            {(selectedMake || makeTerm) && (
                                <button
                                    type="button"
                                    onClick={handleClearMake}
                                    className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                    title="مسح الشركة"
                                >
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsMakeDropdownOpen(prev => !prev)}
                                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                title="عرض القائمة"
                            >
                                {isSearchingMake ? (
                                    <RefreshCwIcon className="w-4 h-4 animate-spin text-blue-500" />
                                ) : (
                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${isMakeDropdownOpen ? 'rotate-180' : ''}`} />
                                )}
                            </button>
                        </div>
                    </div>

                    {isMakeDropdownOpen && (
                        <ul className="absolute z-30 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                            {displayMakes.length > 0 ? (
                                displayMakes.map((make, idx) => (
                                    <li
                                        key={make.id}
                                        onMouseDown={() => handleChooseMake(make)}
                                        onMouseOver={() => setMakeSuggestionIndex(idx)}
                                        className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 text-sm transition-colors ${
                                            idx === makeSuggestionIndex || selectedMake?.id === make.id
                                                ? 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-100'
                                        }`}
                                    >
                                        <span className="font-bold truncate">{make.name_en}</span>
                                        {make.name_ar && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{make.name_ar}</span>
                                        )}
                                    </li>
                                ))
                            ) : (
                                <li className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 text-center">
                                    لا توجد شركات مطابقة
                                </li>
                            )}
                        </ul>
                    )}
                </div>

                {/* 2. Model (Locked until Make is selected) */}
                <div className="relative" ref={modelDropdownRef}>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        الموديل
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={modelTerm}
                            onChange={handleModelInputChange}
                            onFocus={handleModelInputFocus}
                            onKeyDown={handleModelKeyDown}
                            disabled={!selectedMake}
                            placeholder={selectedMake ? 'ابحث أو اختر الموديل (كامري، Camry...)' : 'اختر الشركة أولاً...'}
                            className={`${inputBaseClass} disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed`}
                            autoComplete="off"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 gap-1">
                            {selectedMake && (selectedModel || modelTerm) && (
                                <button
                                    type="button"
                                    onClick={handleClearModel}
                                    className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                    title="مسح الموديل"
                                >
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {selectedMake && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isModelDropdownOpen) {
                                            handleModelInputFocus();
                                        } else {
                                            setIsModelDropdownOpen(false);
                                        }
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    title="عرض الموديلات"
                                >
                                    {isSearchingModel || isLoadingModels ? (
                                        <RefreshCwIcon className="w-4 h-4 animate-spin text-blue-500" />
                                    ) : (
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {isModelDropdownOpen && selectedMake && (
                        <ul className="absolute z-30 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                            {isLoadingModels ? (
                                <li className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                                    <RefreshCwIcon className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                    <span>جاري تحميل الموديلات...</span>
                                </li>
                            ) : displayModels.length > 0 ? (
                                displayModels.map((model, idx) => (
                                    <li
                                        key={model.id}
                                        onMouseDown={() => handleChooseModel(model)}
                                        onMouseOver={() => setModelSuggestionIndex(idx)}
                                        className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 text-sm transition-colors ${
                                            idx === modelSuggestionIndex || selectedModel?.id === model.id
                                                ? 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-100'
                                        }`}
                                    >
                                        <span className="font-bold truncate">{model.name_en}</span>
                                        {model.name_ar && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{model.name_ar}</span>
                                        )}
                                    </li>
                                ))
                            ) : (
                                <li className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 text-center">
                                    لا توجد موديلات مطابقة
                                </li>
                            )}
                        </ul>
                    )}
                </div>

                {/* 3. Year */}
                <div className="relative">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        سنة الصنع
                    </label>
                    <div className="relative">
                        <YearPicker
                            value={selectedYear || 0}
                            onChange={(year) => onSelectYear(year || null)}
                            placeholder="جميع السنوات (اختياري)"
                            className="block w-full p-2.5 pl-9 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm transition-colors"
                        />
                        {selectedYear && (
                            <button
                                type="button"
                                onClick={() => onSelectYear(null)}
                                className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 hover:text-red-500 transition-colors z-10"
                                title="مسح السنة"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 2: Optional Date Range + Submit Search Button */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        من تاريخ <span className="text-[11px] font-normal text-slate-400">(اختياري)</span>
                    </label>
                    <CustomDatePicker
                        value={startDate}
                        onChange={onChangeStartDate}
                        placeholder="من تاريخ (اختياري)"
                        className={dateInputClass}
                        maxDate={parseDateValue(endDate) || new Date()}
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        إلى تاريخ <span className="text-[11px] font-normal text-slate-400">(اختياري)</span>
                    </label>
                    <CustomDatePicker
                        value={endDate}
                        onChange={onChangeEndDate}
                        placeholder="إلى تاريخ (اختياري)"
                        className={dateInputClass}
                        minDate={parseDateValue(startDate)}
                        maxDate={new Date()}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        onClick={onSubmitSearch}
                        disabled={!hasAnyInput || isSearching}
                        leftIcon={
                            isSearching ? (
                                <RefreshCwIcon className="w-4 h-4 animate-spin" />
                            ) : (
                                <SearchIcon className="w-4 h-4" />
                            )
                        }
                        className="w-full py-2.5 font-bold text-sm shadow-sm"
                    >
                        {isSearching ? 'جاري البحث...' : 'بدء البحث'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CarSpecsSearchPanel;
