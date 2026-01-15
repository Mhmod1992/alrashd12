
import React, { useState, useMemo, useEffect } from 'react';
import Modal from './Modal';
import { Employee, Technician, Expense } from '../types';
import { useAppContext } from '../context/AppContext';
import Button from './Button';
import Icon from './Icon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import TrashIcon from './icons/TrashIcon';

interface EmployeeFinancialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    target: Employee | Technician;
    type: 'employee' | 'technician';
    selectedMonth?: number;
    selectedYear?: number;
}

const EmployeeFinancialsModal: React.FC<EmployeeFinancialsModalProps> = ({
    isOpen, onClose, target, type, selectedMonth, selectedYear
}) => {
    const { expenses, addExpense, deleteExpense, authUser, addNotification, fetchEmployeeTransactionsForMonth } = useAppContext();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [monthTransactions, setMonthTransactions] = useState<Expense[]>([]);

    // Entry Form State
    const [entryType, setEntryType] = useState<'bonus' | 'deduction' | 'advance'>('bonus');
    const [entryAmount, setEntryAmount] = useState<number | ''>('');
    const [entryNote, setEntryNote] = useState('');
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);

    // Fetch data for the specific month
    const loadMonthData = async () => {
        setIsLoading(true);
        try {
            const m = selectedMonth || (new Date().getMonth() + 1);
            const y = selectedYear || new Date().getFullYear();
            const data = await fetchEmployeeTransactionsForMonth(target.id, m, y);
            setMonthTransactions(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadMonthData();
            // Reset form
            setEntryAmount('');
            setEntryNote('');
        }
    }, [isOpen, target.id, selectedMonth, selectedYear]);

    const stats = useMemo(() => {
        let bonuses = 0;
        let deductions = 0;
        monthTransactions.forEach(t => {
            if (t.category === 'مكافآت') bonuses += t.amount;
            else if (t.category === 'خصومات' || t.category === 'سلف') deductions += t.amount;
        });
        const net = (target.salary || 0) + bonuses - deductions;
        return { bonuses, deductions, net };
    }, [monthTransactions, target.salary]);

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!entryAmount || entryAmount <= 0) return;
        if (!authUser) return;

        setIsSubmitting(true);
        try {
            const category = entryType === 'bonus' ? 'مكافآت' : (entryType === 'advance' ? 'سلف' : 'خصومات');
            const description = `${entryNote || 'بدون ملاحظة'} - لصالح: ${target.name} [ID:${target.id}]`;

            // Combine selected date with current time for precise logging
            const now = new Date();
            const selectedDate = new Date(entryDate);

            // Validate the date before calling toISOString
            if (isNaN(selectedDate.getTime())) {
                addNotification({ title: 'خطأ', message: 'التاريخ المختار غير صالح.', type: 'error' });
                setIsSubmitting(false);
                return;
            }

            selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

            await addExpense({
                date: selectedDate.toISOString(),
                category,
                description,
                amount: Number(entryAmount),
                employeeId: authUser.id,
                employeeName: authUser.name
            });

            addNotification({ title: 'تم الحفظ', message: 'تم تسجيل العملية بنجاح.', type: 'success' });
            setEntryAmount('');
            setEntryNote('');
            loadMonthData(); // Refresh list
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل حفظ العملية.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteEntry = async (id: string) => {
        try {
            await deleteExpense(id);
            addNotification({ title: 'تم الحذف', message: 'تم حذف العملية من السجل المالي.', type: 'success' });
            loadMonthData();
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل الحذف.', type: 'error' });
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`إدارة مستحقات: ${target.name}`} size="4xl">
            <div className="space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar p-1">

                {/* Summary Header */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 p-4 rounded-xl text-center shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">الراتب الأساسي</p>
                        <p className="text-xl font-black text-slate-800 dark:text-slate-200 font-numeric">{(target.salary || 0).toLocaleString('en-US')} <span className="text-xs font-normal font-sans">ريال</span></p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4 rounded-xl text-center shadow-sm">
                        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1">إجمالي الإضافي</p>
                        <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-numeric">+{stats.bonuses.toLocaleString('en-US')} <span className="text-xs font-normal font-sans">ريال</span></p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-xl text-center shadow-sm">
                        <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase mb-1">إجمالي الخصم/السلف</p>
                        <p className="text-xl font-black text-red-700 dark:text-red-400 font-numeric">-{stats.deductions.toLocaleString('en-US')} <span className="text-xs font-normal font-sans">ريال</span></p>
                    </div>
                </div>

                {/* Net Result Banner */}
                <div className="bg-blue-600 text-white p-4 rounded-xl flex justify-between items-center shadow-lg shadow-blue-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg"><Icon name="dollar-sign" className="w-6 h-6" /></div>
                        <span className="font-bold">صافي المستحق لشهر {selectedMonth} / {selectedYear}</span>
                    </div>
                    <span className="text-3xl font-black font-numeric">{stats.net.toLocaleString('en-US')} ريال</span>
                </div>

                {/* Entry Form */}
                <div className="bg-white dark:bg-slate-800 border-2 border-dashed dark:border-slate-700 p-5 rounded-2xl">
                    <h4 className="font-black text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <Icon name="add" className="w-5 h-5 text-blue-500" />
                        إضافة إدخال مالي جديد
                    </h4>
                    <form onSubmit={handleAddEntry} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">التاريخ</label>
                            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">النوع</label>
                            <select value={entryType} onChange={e => setEntryType(e.target.value as any)} className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="bonus">إضافي / مكافأة</option>
                                <option value="deduction">خصم</option>
                                <option value="advance">سلفة</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">المبلغ</label>
                            <input type="number" value={entryAmount} onChange={e => setEntryAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0.00" className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold font-numeric" />
                        </div>
                        <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">الملاحظات (السبب)</label>
                            <input type="text" value={entryNote} onChange={e => setEntryNote(e.target.value)} placeholder="مثال: مكافأة تميز، تأخير، سلفة وقود..." className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="sm:col-span-1">
                            <Button type="submit" disabled={isSubmitting || !entryAmount} className="w-full py-2.5 font-black h-full shadow-md">
                                {isSubmitting ? <RefreshCwIcon className="animate-spin w-5 h-5" /> : 'حفظ'}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* History List */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex justify-between items-center">
                        <h4 className="font-black text-slate-700 dark:text-slate-200">سجل عمليات الشهر المختار</h4>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">تحديث تلقائي</span>
                    </div>

                    {isLoading ? (
                        <div className="p-10 flex justify-center"><RefreshCwIcon className="w-8 h-8 animate-spin text-blue-500 opacity-50" /></div>
                    ) : monthTransactions.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 italic text-sm">لا توجد سجلات مالية مضافة لهذا الشهر.</div>
                    ) : (
                        <table className="w-full text-sm text-right">
                            <thead className="text-[10px] font-black text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-900/30">
                                <tr>
                                    <th className="px-4 py-2">التاريخ</th>
                                    <th className="px-4 py-2">النوع</th>
                                    <th className="px-4 py-2">الملاحظة</th>
                                    <th className="px-4 py-2">المبلغ</th>
                                    <th className="px-4 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {monthTransactions.map(trans => (
                                    <tr key={trans.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-3 text-xs text-slate-500 font-mono font-numeric">{new Date(trans.date).toLocaleDateString('en-GB')}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trans.category === 'مكافآت' ? 'bg-emerald-100 text-emerald-700' :
                                                trans.category === 'سلف' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {trans.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{trans.description.split(' - لصالح:')[0]}</td>
                                        <td className={`px-4 py-3 font-black font-numeric ${trans.category === 'مكافآت' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {trans.category === 'مكافآت' ? '+' : '-'}{trans.amount.toLocaleString('en-US')}
                                        </td>
                                        <td className="px-4 py-3 text-left">
                                            <button onClick={() => handleDeleteEntry(trans.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div className="mt-6 pt-4 border-t dark:border-slate-700 flex justify-end">
                <Button variant="secondary" onClick={onClose}>إغلاق النافذة</Button>
            </div>
        </Modal>
    );
};

export default EmployeeFinancialsModal;
