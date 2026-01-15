
import React from 'react';
import { InspectionType, PaymentType } from '../../types';

interface StepDetailsProps {
    inspectionTypeId: string;
    setInspectionTypeId: (val: string) => void;
    inspectionTypes: InspectionType[];
    inspectionPrice: number | '';
    setInspectionPrice: (val: number | '') => void;
    paymentType: PaymentType | '';
    setPaymentType: (val: PaymentType) => void;
    isReceptionist: boolean;
    paymentNote: string;
    setPaymentNote: (val: string) => void;
    splitCashAmount: number;
    setSplitCashAmount: (val: number) => void;
    splitCardAmount: number;
    typeInputRef: React.RefObject<HTMLSelectElement>;
    priceInputRef: React.RefObject<HTMLInputElement>;
    getInputClass: (name: string) => string;
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
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">نوع الفحص</label>
                    <select
                        ref={props.typeInputRef}
                        value={props.inspectionTypeId}
                        onChange={(e) => props.setInspectionTypeId(e.target.value)}
                        required
                        className={props.getInputClass('inspectionType')}
                    >
                        <option value="" disabled>اختر نوع الفحص</option>
                        {props.inspectionTypes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">قيمة الفحص (ريال)</label>
                    <input
                        ref={props.priceInputRef}
                        type="number"
                        value={props.inspectionPrice}
                        onChange={(e) => props.setInspectionPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        required
                        className={props.getInputClass('inspectionPrice')}
                    />
                </div>
                {!props.isReceptionist && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">طريقة الدفع</label>
                        <select
                            value={props.paymentType}
                            onChange={(e) => props.setPaymentType(e.target.value as PaymentType)}
                            required
                            className={props.getInputClass('paymentType')}
                        >
                            <option value="" disabled>اختر طريقة الدفع</option>
                            {Object.values(PaymentType).map(pt => (
                                <option key={pt} value={pt}>{pt}</option>
                            ))}
                        </select>
                        {(props.paymentType === PaymentType.Transfer || props.paymentType === PaymentType.Unpaid) && (
                            <div className="mt-2 animate-fade-in">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    ملاحظة للطلب
                                </label>
                                <input
                                    type="text"
                                    value={props.paymentNote}
                                    onChange={(e) => props.setPaymentNote(e.target.value)}
                                    className={formInputClasses}
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
                                                const v = Number(e.target.value);
                                                props.setSplitCashAmount(v);
                                                if (props.inspectionPrice !== '') {
                                                    // This should be handled in parent usually, but simple calculation is fine here
                                                    // Ideally pass a handler: onSplitCashChange
                                                }
                                            }}
                                            className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600"
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
        </fieldset>
    );
};

export default StepDetails;
