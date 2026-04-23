
import React, { useRef, useEffect, useState } from 'react';
import { InspectionType, PaymentType, TaxMode } from '../../types';

const ScrollableItem: React.FC<{ name: string; isActive: boolean }> = ({ name, isActive }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLSpanElement>(null);
    const [shouldScroll, setShouldScroll] = useState(false);
    const [scrollDist, setScrollDist] = useState('0px');

    useEffect(() => {
        if (containerRef.current && contentRef.current) {
            const containerWidth = containerRef.current.offsetWidth;
            const contentWidth = contentRef.current.scrollWidth;
            if (contentWidth > containerWidth) {
                setShouldScroll(true);
                setScrollDist(`${contentWidth - containerWidth + 20}px`);
            } else {
                setShouldScroll(false);
            }
        }
    }, [name]);

    return (
        <div 
            ref={containerRef} 
            className={`scroll-container ${isActive ? 'scroll-active' : ''} ${shouldScroll ? 'should-scroll' : ''}`}
            style={{ '--scroll-dist': scrollDist } as any}
        >
            <span ref={contentRef} className="scroll-content font-bold text-slate-900 dark:text-slate-100">
                {name}
            </span>
        </div>
    );
};

interface StepDetailsProps {
    inspectionTypeId: string;
    setInspectionTypeId: (val: string) => void;
    inspectionTypes: InspectionType[];
    inspectionPrice: number | '';
    setInspectionPrice: (val: number | '') => void;
    taxMode: TaxMode;
    setTaxMode: (val: TaxMode) => void;
    calculatedPrice: number;
    paymentType: PaymentType | '';
    setPaymentType: (val: PaymentType) => void;
    isReceptionist: boolean;
    paymentNote: string;
    setPaymentNote: (val: string) => void;
    reservationNotes?: string;
    setReservationNotes?: (val: string) => void;
    splitCashAmount: number;
    onSplitCashChange: (val: number) => void;
    splitCardAmount: number;
    typeInputRef: React.RefObject<HTMLInputElement>;
    priceInputRef: React.RefObject<HTMLInputElement>;
    getInputClass: (name: string) => string;
    onInspectionTypeFocus?: () => void;
    isReservationMode?: boolean;
    isEditMode?: boolean;
    inspectionTypeSearchTerm?: string;
    handleTypeChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isTypeDropdownOpen?: boolean;
    setIsTypeDropdownOpen?: (val: boolean) => void;
    displayInspectionTypes?: InspectionType[];
    handleTypeSelection?: (type: InspectionType) => void;
    typeSuggestionIndex?: number;
    setTypeSuggestionIndex?: (idx: number) => void;
    typeDropdownRef?: React.RefObject<HTMLDivElement>;
    typeListRef?: React.RefObject<HTMLUListElement>;
    handleKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>, type: 'name' | 'phone' | 'make' | 'model' | 'inspectionType') => void;
}

const StepDetails: React.FC<StepDetailsProps> = (props) => {
    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    return (
        <fieldset className="bg-white dark:bg-slate-800/50 p-4 sm:p-6 rounded-lg shadow-sm">
            <legend className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                تفاصيل الطلب
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative" ref={props.typeDropdownRef}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">نوع الفحص</label>
                    <div className="relative">
                        <input
                            ref={props.typeInputRef}
                            type="text"
                            value={props.inspectionTypeSearchTerm || ''}
                            onChange={props.handleTypeChange}
                            onFocus={props.onInspectionTypeFocus}
                            onKeyDown={(e) => props.handleKeyDown && props.handleKeyDown(e, 'inspectionType')}
                            placeholder="ابحث أو اختر نوع الفحص"
                            required={!props.isReservationMode && !props.inspectionTypeId}
                            className={props.getInputClass('inspectionType')}
                            autoComplete="off"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 cursor-pointer" onClick={() => props.setIsTypeDropdownOpen && props.setIsTypeDropdownOpen(!props.isTypeDropdownOpen)}>
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    {props.isTypeDropdownOpen && props.displayInspectionTypes && (
                        <ul ref={props.typeListRef} className="absolute z-20 w-full bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                            {props.displayInspectionTypes.map((type, index) => (
                                <li
                                    key={type.id}
                                    onMouseDown={() => props.handleTypeSelection && props.handleTypeSelection(type)}
                                    onMouseOver={() => props.setTypeSuggestionIndex && props.setTypeSuggestionIndex(index)}
                                    className={`px-4 py-2 cursor-pointer ${index === props.typeSuggestionIndex ? 'bg-blue-100 dark:bg-slate-600' : 'hover:bg-blue-50 dark:hover:bg-slate-600/50'}`}
                                >
                                    <ScrollableItem 
                                        name={type.name} 
                                        isActive={index === props.typeSuggestionIndex} 
                                    />
                                </li>
                            ))}
                            {props.displayInspectionTypes.length === 0 && (
                                <li className="px-4 py-2 text-slate-500 dark:text-slate-400 text-sm">لا توجد نتائج</li>
                            )}
                        </ul>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">قيمة الفحص (ريال)</label>
                    <input
                        ref={props.priceInputRef}
                        type="number"
                        value={props.inspectionPrice}
                        onChange={(e) => props.setInspectionPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        required={!props.isReservationMode}
                        className={props.getInputClass('inspectionPrice')}
                    />
                    
                    {props.inspectionTypeId && props.inspectionPrice !== '' && (
                        (() => {
                            const selectedType = props.inspectionTypes.find(t => t.id === props.inspectionTypeId);
                            if (selectedType && selectedType.price !== props.inspectionPrice) {
                                return (
                                    <div className="mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-pulse">
                                        <span>⚠️ السعر يختلف عن السعر الافتراضي ({selectedType.price} ريال)</span>
                                    </div>
                                );
                            }
                            return null;
                        })()
                    )}
                    
                    <div className="mt-3 flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                                type="checkbox" 
                                checked={props.taxMode === TaxMode.Add}
                                onChange={() => props.setTaxMode(props.taxMode === TaxMode.Add ? TaxMode.None : TaxMode.Add)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-blue-600 transition-colors">إضافة ضريبة 15%</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                                type="checkbox" 
                                checked={props.taxMode === TaxMode.Deduct}
                                onChange={() => props.setTaxMode(props.taxMode === TaxMode.Deduct ? TaxMode.None : TaxMode.Deduct)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-blue-600 transition-colors">استقطاع ضريبة 15%</span>
                        </label>
                    </div>

                    {props.taxMode !== TaxMode.None && props.inspectionPrice !== '' && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded text-xs animate-fade-in">
                            <span className="text-blue-700 dark:text-blue-300 font-bold">معاينة السعر مع الضريبة (للعرض فقط): </span>
                            <span className="text-blue-800 dark:text-blue-200 font-black text-sm">{props.calculatedPrice} ريال</span>
                        </div>
                    )}
                </div>
                {!props.isReceptionist && !props.isReservationMode && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">طريقة الدفع</label>
                        <select
                            value={props.paymentType}
                            onChange={(e) => props.setPaymentType(e.target.value as PaymentType)}
                            required={!props.isReservationMode}
                            className={props.getInputClass('paymentType')}
                        >
                            <option value="" disabled>اختر طريقة الدفع</option>
                            {Object.values(PaymentType).map(pt => (
                                <option key={pt} value={pt}>{pt}</option>
                            ))}
                        </select>
                        {(props.isEditMode || props.paymentType === PaymentType.Transfer || props.paymentType === PaymentType.Unpaid) && (
                            <div className="mt-2 animate-fade-in">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    ملاحظة الدفع / الطلب
                                </label>
                                <input
                                    type="text"
                                    value={props.paymentNote}
                                    onChange={(e) => props.setPaymentNote(e.target.value)}
                                    className={formInputClasses}
                                    placeholder="اختياري: مثال رقم الحوالة أو أي ملاحظة"
                                />
                            </div>
                        )}
                        {props.paymentType === PaymentType.Split && (
                            <div className="mt-2 animate-fade-in p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                                <div className="text-xs text-slate-500 mb-2">إجمالي المطلوب: <span className="font-bold text-slate-800 dark:text-slate-200">{props.inspectionPrice} ريال</span></div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">نقدي</label>
                                        <input
                                            type="number"
                                            value={props.splitCashAmount}
                                            onChange={(e) => {
                                                const v = e.target.value === '' ? 0 : Number(e.target.value);
                                                props.onSplitCashChange(v);
                                            }}
                                            className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600"
                                            min="0"
                                            max={Number(props.inspectionPrice) || 0}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">بطاقة</label>
                                        <input
                                            type="number"
                                            value={props.splitCardAmount}
                                            readOnly
                                            className="w-full p-2 text-sm border rounded bg-slate-100 dark:bg-slate-600 dark:border-slate-500 text-slate-500 cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {props.isReservationMode && props.setReservationNotes && (
                <div className="mt-6 animate-fade-in">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        ملاحظات الحجز (مثال: اليوم الساعة 4)
                    </label>
                    <textarea
                        value={props.reservationNotes}
                        onChange={(e) => props.setReservationNotes!(e.target.value)}
                        className={formInputClasses}
                        rows={2}
                        placeholder="أضف أي ملاحظات إضافية هنا..."
                    />
                </div>
            )}
        </fieldset>
    );
};

export default StepDetails;
