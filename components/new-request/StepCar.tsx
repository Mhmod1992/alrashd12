
import React from 'react';
import Button from '../Button';
import Icon from '../Icon';
import RefreshCwIcon from '../icons/RefreshCwIcon';
import HistoryIcon from '../icons/HistoryIcon';
import LicensePlatePreview from '../LicensePlatePreview';
import SparklesIcon from '../icons/SparklesIcon';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import PlusIcon from '../icons/PlusIcon';
import { CarMake, CarModel, Car, InspectionRequest, Client, Settings } from '../../types';

interface StepCarProps {
    useChassisNumber: boolean;
    setUseChassisNumber: (val: boolean) => void;
    plateChars: string;
    setPlateChars: (val: string) => void;
    plateNums: string;
    setPlateNums: (val: string) => void;
    chassisNumber: string;
    setChassisNumber: (val: string) => void;
    isCheckingHistory: boolean;
    settings: Settings;
    plateCharInputRef: React.RefObject<HTMLInputElement>;
    plateNumInputRef: React.RefObject<HTMLInputElement>;
    chassisInputRef: React.RefObject<HTMLInputElement>;
    makeInputRef: React.RefObject<HTMLInputElement>;
    modelInputRef: React.RefObject<HTMLInputElement>;
    yearInputRef: React.RefObject<HTMLInputElement>;
    makeDropdownRef: React.RefObject<HTMLDivElement>;
    modelDropdownRef: React.RefObject<HTMLDivElement>;
    makeListRef: React.RefObject<HTMLUListElement>;
    modelListRef: React.RefObject<HTMLUListElement>;
    setIsScannerOpen: (val: boolean) => void;
    setIsCarScannerOpen: (val: boolean) => void;
    foundHistory: { car: Car; previousRequests: InspectionRequest[]; lastClient?: Client } | null;
    handleViewPreviousReport: (id: string) => void;
    handleViewCarHistory: () => void;
    handleFillCarData: () => void;
    canViewHistory: boolean;
    carMakeSearchTerm: string;
    handleMakeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setIsMakeDropdownOpen: (val: boolean) => void;
    handleKeyDown: (e: React.KeyboardEvent, type: 'make' | 'model') => void;
    isMakeDropdownOpen: boolean;
    isSearchingMake: boolean;
    displayMakes: CarMake[];
    handleMakeSelection: (make: CarMake) => void;
    handleCreateNewMake: (name: string) => void;
    makeSuggestionIndex: number;
    setMakeSuggestionIndex: (idx: number) => void;
    carModelSearchTerm: string;
    handleModelChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleModelFocus: () => void;
    isModelDropdownOpen: boolean;
    setIsModelDropdownOpen: (val: boolean) => void;
    isSearchingModel: boolean;
    isLoadingModels: boolean;
    displayModels: CarModel[];
    handleModelSelection: (model: CarModel) => void;
    handleCreateNewModel: (name: string) => void;
    modelSuggestionIndex: number;
    setModelSuggestionIndex: (idx: number) => void;
    carMakeId: string;
    carYear: number;
    setCarYear: (year: number) => void;
    getInputClass: (name: string) => string;
    previewArabicChars: string;
    previewEnglishChars: string;
    arabicTop: string;
    arabicBottom: string;
    englishTop: string;
    englishBottom: string;
}

const StepCar: React.FC<StepCarProps> = (props) => {
    return (
        <fieldset className="bg-white dark:bg-slate-800/50 p-4 sm:p-6 rounded-lg shadow-sm">
            <legend className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                بيانات السيارة
            </legend>
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {props.useChassisNumber ? 'رقم الشاصي (VIN)' : 'رقم اللوحة'}
                    </label>
                    <div className="flex items-center">
                        <input type="checkbox" id="use-chassis" checked={props.useChassisNumber} onChange={() => props.setUseChassisNumber(!props.useChassisNumber)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor="use-chassis" className="ms-2 text-xs text-slate-500 dark:text-slate-400">استخدام رقم الشاصي</label>
                    </div>
                </div>

                {!props.useChassisNumber ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 relative">
                            <input
                                ref={props.plateCharInputRef}
                                type="text"
                                placeholder="الأحرف"
                                value={props.plateChars}
                                onChange={(e) => {
                                    const rawVal = e.target.value.replace(/\s/g, '');
                                    
                                    // Filter characters based on settings (allow only those in plateCharacters array)
                                    // Checks against both Arabic and English chars defined in settings
                                    const validChars = rawVal.split('').filter(char => {
                                        return props.settings.plateCharacters.some(pc => 
                                            pc.ar === char || pc.en.toLowerCase() === char.toLowerCase()
                                        );
                                    }).join('');
                                    
                                    props.setPlateChars(validChars.slice(0, 4).split('').join(' '));
                                }}
                                className={`${props.getInputClass('plateChars')} text-center font-bold text-lg`}
                                style={{ direction: /[\u0600-\u06FF]/.test(props.plateChars) ? 'rtl' : 'ltr' }}
                                autoComplete="off"
                            />
                            <input
                                ref={props.plateNumInputRef}
                                type="text"
                                placeholder="أرقام"
                                value={props.plateNums}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                    props.setPlateNums(val.split('').join(' '));
                                }}
                                className={`${props.getInputClass('plateNums')} text-center font-bold text-lg`}
                                style={{ direction: 'ltr' }}
                                autoComplete="off"
                            />
                            <Button type="button" variant="secondary" onClick={() => props.setIsScannerOpen(true)} className="p-3" title="مسح اللوحة بالكاميرا">
                                <Icon name="scan-plate" className="w-5 h-5" />
                            </Button>

                            {props.isCheckingHistory && (
                                <div className="absolute left-[-30px] top-1/2 transform -translate-y-1/2">
                                    <RefreshCwIcon className="w-5 h-5 animate-spin text-blue-500" />
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg shadow-inner flex justify-center">
                            <LicensePlatePreview
                                arabicTop={props.arabicTop}
                                arabicBottom={props.arabicBottom}
                                englishTop={props.englishTop}
                                englishBottom={props.englishBottom}
                                settings={props.settings.platePreviewSettings}
                                plateCharacters={props.settings.plateCharacters}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <input
                            ref={props.chassisInputRef}
                            type="text"
                            value={props.chassisNumber}
                            onChange={e => props.setChassisNumber(e.target.value.toUpperCase())}
                            style={{ direction: 'ltr' }}
                            className={props.getInputClass('chassisNumber')}
                            placeholder="WBA..."
                            autoComplete="off"
                        />
                        {props.isCheckingHistory && (
                            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                                <RefreshCwIcon className="w-5 h-5 animate-spin text-blue-500" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* History Alert */}
            {props.foundHistory && props.canViewHistory && (
                <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 animate-slide-in-down">
                    <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                            <div className="bg-amber-100 dark:bg-amber-800 p-2 rounded-full text-amber-600 dark:text-amber-400 mt-1">
                                <HistoryIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-amber-800 dark:text-amber-200">
                                    {props.foundHistory.previousRequests.length > 0 ? 'للسيارة سجل زيارات سابق' : 'السيارة مسجلة في النظام'}
                                </h4>
                                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                    {props.foundHistory.previousRequests.length > 0
                                        ? `تم العثور على ${props.foundHistory.previousRequests.length} زيارات سابقة.`
                                        : 'بيانات السيارة محفوظة، لكن لا توجد طلبات فحص سابقة.'
                                    }
                                </p>
                                {props.foundHistory.lastClient && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                        آخر عميل: <span className="font-semibold">{props.foundHistory.lastClient.name}</span> ({props.foundHistory.lastClient.phone})
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            {props.foundHistory.previousRequests.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => props.handleViewPreviousReport(props.foundHistory!.previousRequests[0].id)}
                                    className="text-xs bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 px-3 py-1.5 rounded-md hover:bg-amber-50 transition-colors"
                                >
                                    عرض آخر تقرير
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={props.handleViewCarHistory}
                                className="text-xs bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 px-3 py-1.5 rounded-md hover:bg-amber-50 transition-colors"
                            >
                                عرض سجلات الزيارة
                            </button>
                            <button
                                type="button"
                                onClick={props.handleFillCarData}
                                className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-md hover:bg-amber-700 transition-colors"
                            >
                                استخدام البيانات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Car Details Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="relative" ref={props.makeDropdownRef}>
                    <label className="flex justify-between items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        <span>الشركة</span>
                        <button
                            type="button"
                            onClick={() => props.setIsCarScannerOpen(true)}
                            className="text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline"
                            title="تعرف على السيارة من صورة"
                        >
                            <SparklesIcon className="w-3 h-3" />
                            تعرف بالكاميرا
                        </button>
                    </label>
                    <div className="relative">
                        <input
                            ref={props.makeInputRef}
                            type="text"
                            value={props.carMakeSearchTerm}
                            onChange={props.handleMakeChange}
                            onFocus={() => props.setIsMakeDropdownOpen(true)}
                            onKeyDown={(e) => props.handleKeyDown(e, 'make')}
                            placeholder="ابحث أو اختر"
                            required={!props.foundHistory}
                            className={props.getInputClass('carMake')}
                            autoComplete="off"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 cursor-pointer" onClick={() => props.setIsMakeDropdownOpen(!props.isMakeDropdownOpen)}>
                            {props.isSearchingMake ? (
                                <RefreshCwIcon className="h-5 w-5 animate-spin text-blue-500" />
                            ) : (
                                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                            )}
                        </div>
                    </div>
                    {props.isMakeDropdownOpen && (
                        <ul ref={props.makeListRef} className="absolute z-20 w-full bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                            {(props.displayMakes).map((make, index) => (
                                <li
                                    key={make.id}
                                    onMouseDown={() => props.handleMakeSelection(make)}
                                    onMouseOver={() => props.setMakeSuggestionIndex(index)}
                                    className={`px-4 py-2 cursor-pointer dark:text-slate-200 ${index === props.makeSuggestionIndex ? 'bg-blue-100 dark:bg-slate-600' : 'hover:bg-blue-50 dark:hover:bg-slate-600/50'}`}
                                >
                                    {make.name_en} {make.name_ar ? `(${make.name_ar})` : ''}
                                </li>
                            ))}
                            {props.carMakeSearchTerm.trim() && !props.displayMakes.some(m => m.name_en.toLowerCase() === props.carMakeSearchTerm.trim().toLowerCase() || (m.name_ar && m.name_ar.toLowerCase() === props.carMakeSearchTerm.trim().toLowerCase())) && (
                                <li
                                    onMouseDown={() => props.handleCreateNewMake(props.carMakeSearchTerm)}
                                    className="px-4 py-2 cursor-pointer text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600/50 flex items-center gap-2 border-t dark:border-slate-600"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    <span>إضافة "{props.carMakeSearchTerm}" كشركة جديدة</span>
                                </li>
                            )}
                        </ul>
                    )}
                </div>
                <div className="relative" ref={props.modelDropdownRef}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">الموديل</label>
                    <div className="relative">
                        <input
                            ref={props.modelInputRef}
                            type="text"
                            value={props.carModelSearchTerm}
                            onChange={props.handleModelChange}
                            onFocus={props.handleModelFocus}
                            onKeyDown={(e) => props.handleKeyDown(e, 'model')}
                            placeholder="ابحث أو اختر"
                            disabled={!props.carMakeSearchTerm.trim()}
                            required={!props.foundHistory}
                            className={`${props.getInputClass('carModel')} disabled:bg-slate-100 dark:disabled:bg-slate-800`}
                            autoComplete="off"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            {props.isSearchingModel || props.isLoadingModels ? <RefreshCwIcon className="h-5 w-5 animate-spin text-blue-500" /> : null}
                        </div>
                    </div>
                    {props.isModelDropdownOpen && props.carMakeId && (
                        <ul ref={props.modelListRef} className="absolute z-10 w-full bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                            {props.displayModels.map((model, index) => (
                                <li
                                    key={model.id}
                                    onMouseDown={() => props.handleModelSelection(model)}
                                    onMouseOver={() => props.setModelSuggestionIndex(index)}
                                    className={`px-4 py-2 cursor-pointer dark:text-slate-200 ${index === props.modelSuggestionIndex ? 'bg-blue-100 dark:bg-slate-600' : 'hover:bg-blue-50 dark:hover:bg-slate-600/50'}`}
                                >
                                    {model.name_en} {model.name_ar ? `(${model.name_ar})` : ''}
                                </li>
                            ))}
                            {props.displayModels.length === 0 && !props.isLoadingModels && (
                                <li className="px-4 py-2 text-slate-500 dark:text-slate-400 text-sm">لا توجد نتائج</li>
                            )}
                            {props.carModelSearchTerm.trim() && !props.displayModels.some(m => m.name_en.toLowerCase() === props.carModelSearchTerm.trim().toLowerCase() || (m.name_ar && m.name_ar.toLowerCase() === props.carModelSearchTerm.trim().toLowerCase())) && (
                                <li
                                    onMouseDown={() => props.handleCreateNewModel(props.carModelSearchTerm)}
                                    className="px-4 py-2 cursor-pointer text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600/50 flex items-center gap-2 border-t dark:border-slate-600"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    <span>إضافة "{props.carModelSearchTerm}" كموديل جديد</span>
                                </li>
                            )}
                        </ul>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">سنة الصنع</label>
                    <input
                        ref={props.yearInputRef}
                        type="number"
                        value={props.carYear}
                        onChange={e => props.setCarYear(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        required
                        className="mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200"
                        autoComplete="off"
                    />
                </div>
            </div>
        </fieldset>
    );
};

export default StepCar;
