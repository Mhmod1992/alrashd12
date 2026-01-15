
import React from 'react';
import RefreshCwIcon from '../icons/RefreshCwIcon';
import AlertTriangleIcon from '../icons/AlertTriangleIcon';
import { Client } from '../../types';

interface StepClientProps {
    clientName: string;
    clientPhone: string;
    onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onPhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onNameFocus: () => void;
    onPhoneFocus: () => void;
    onKeyDown: (e: React.KeyboardEvent, type: 'name' | 'phone') => void;
    nameInputRef: React.RefObject<HTMLInputElement>;
    phoneInputRef: React.RefObject<HTMLInputElement>;
    isSearchingClientName: boolean;
    isSearchingClientPhone: boolean;
    isNameSuggestionsOpen: boolean;
    isPhoneSuggestionsOpen: boolean;
    nameSuggestions: Client[];
    phoneSuggestions: Client[];
    nameSuggestionIndex: number;
    phoneSuggestionIndex: number;
    setNameSuggestionIndex: (idx: number) => void;
    setPhoneSuggestionIndex: (idx: number) => void;
    onClientSelection: (client: Client, nextInput?: HTMLElement) => void;
    unpaidDebtAlert: any[] | null;
    getInputClass: (name: string) => string;
}

const StepClient: React.FC<StepClientProps> = (props) => {
    return (
        <fieldset className="bg-white dark:bg-slate-800/50 p-4 sm:p-6 rounded-lg shadow-sm">
            <legend className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                بيانات العميل
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">اسم العميل</label>
                    <div className="relative">
                        <input
                            ref={props.nameInputRef}
                            type="text"
                            value={props.clientName}
                            onChange={props.onNameChange}
                            onFocus={props.onNameFocus}
                            onKeyDown={(e) => props.onKeyDown(e, 'name')}
                            required
                            className={props.getInputClass('clientName')}
                            autoFocus
                            autoComplete="off"
                        />
                        {props.isSearchingClientName && (
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <RefreshCwIcon className="h-5 w-5 animate-spin text-blue-500" />
                            </div>
                        )}
                    </div>
                    {props.isNameSuggestionsOpen && props.nameSuggestions.length > 0 && (
                        <ul className="absolute z-20 w-full bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                            {props.nameSuggestions.map((client, index) => (
                                <li
                                    key={client.id}
                                    onMouseDown={() => props.onClientSelection(client, props.phoneInputRef.current!)}
                                    onMouseOver={() => props.setNameSuggestionIndex(index)}
                                    className={`px-4 py-2 cursor-pointer dark:text-slate-200 ${index === props.nameSuggestionIndex ? 'bg-blue-100 dark:bg-slate-600' : 'hover:bg-blue-50 dark:hover:bg-slate-600/50'}`}
                                >
                                    {client.name} - <span className="text-slate-500 dark:text-slate-400">{client.phone}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="relative">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف</label>
                    <div className="relative">
                        <input
                            ref={props.phoneInputRef}
                            type="tel"
                            value={props.clientPhone}
                            onChange={props.onPhoneChange}
                            onFocus={props.onPhoneFocus}
                            onKeyDown={(e) => props.onKeyDown(e, 'phone')}
                            required
                            placeholder="05xxxxxxxx"
                            maxLength={10}
                            style={{ direction: 'ltr', textAlign: 'right' }}
                            className={props.getInputClass('clientPhone')}
                            autoComplete="off"
                        />
                        {props.isSearchingClientPhone && (
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <RefreshCwIcon className="h-5 w-5 animate-spin text-blue-500" />
                            </div>
                        )}
                    </div>
                    {props.isPhoneSuggestionsOpen && props.phoneSuggestions.length > 0 && (
                        <ul className="absolute z-20 w-full bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                            {props.phoneSuggestions.map((client, index) => (
                                <li
                                    key={client.id}
                                    onMouseDown={() => props.onClientSelection(client)}
                                    onMouseOver={() => props.setPhoneSuggestionIndex(index)}
                                    className={`px-4 py-2 cursor-pointer dark:text-slate-200 ${index === props.phoneSuggestionIndex ? 'bg-blue-100 dark:bg-slate-600' : 'hover:bg-blue-50 dark:hover:bg-slate-600/50'}`}
                                >
                                    <span style={{ direction: 'ltr', display: 'inline-block' }}>{client.phone}</span> ({client.name})
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {props.unpaidDebtAlert && props.unpaidDebtAlert.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fade-in shadow-sm">
                    <div className="flex items-start gap-2">
                        <AlertTriangleIcon className="w-6 h-6 text-red-600 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="font-bold text-red-700 dark:text-red-400 text-sm">تنبيه: مديونية سابقة ({props.unpaidDebtAlert.length})</h4>
                            <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                                هذا العميل لديه طلبات سابقة معلقة أو غير مدفوعة.
                            </p>

                            <div className="mt-2 max-h-40 overflow-y-auto custom-scrollbar border-t border-red-200 dark:border-red-800 pt-2">
                                <table className="w-full text-xs text-right">
                                    <thead>
                                        <tr className="text-red-700 dark:text-red-400 border-b border-red-200 dark:border-red-800">
                                            <th className="pb-1">رقم الطلب</th>
                                            <th className="pb-1">التاريخ</th>
                                            <th className="pb-1">المبلغ</th>
                                            <th className="pb-1">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {props.unpaidDebtAlert.map((r: any) => (
                                            <tr key={r.id} className="text-red-600 dark:text-red-300 border-b border-red-100 dark:border-red-900/30 last:border-0">
                                                <td className="py-1 font-mono">#{r.request_number}</td>
                                                <td className="py-1">{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                                                <td className="py-1 font-bold">{r.price}</td>
                                                <td className="py-1">{r.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </fieldset>
    );
};

export default StepClient;
