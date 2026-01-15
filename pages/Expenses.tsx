
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Expense } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';
import CreditCardIcon from '../components/icons/CreditCardIcon';
import FilterIcon from '../components/icons/FilterIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import UserCircleIcon from '../components/icons/UserCircleIcon';
import { SkeletonTable } from '../components/Skeleton';

// --- Constants ---
const COMMON_CATEGORIES = ['قطع غيار', 'رواتب', 'فواتير كهرباء', 'إيجار', 'ضيافة', 'صيانة معدات', 'أدوات مكتبية', 'تسويق', 'نثريات'];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

// --- Helper Components ---

const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
    const colorIndex = category.length % COLORS.length;
    const color = COLORS[colorIndex];
    
    return (
        <span 
            className="px-2.5 py-1 rounded-full text-xs font-bold border"
            style={{ 
                backgroundColor: `${color}15`, 
                color: color,
                borderColor: `${color}30`
            }}
        >
            {category}
        </span>
    );
};

const ExpensesDonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    
    if (total === 0) return (
        <div className="h-32 flex flex-col items-center justify-center text-slate-400">
            <Icon name="document-report" className="w-8 h-8 mb-2 opacity-50"/>
            <span className="text-xs">لا توجد بيانات</span>
        </div>
    );

    let cumulativePercent = 0;

    return (
        <div className="flex items-center justify-center gap-6 py-2">
            <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {data.map((slice, i) => {
                        const percent = slice.value / total;
                        const dashArray = percent * 314;
                        const dashOffset = -cumulativePercent * 314;
                        cumulativePercent += percent;
                        
                        return (
                            <circle
                                key={i}
                                r="40"
                                cx="50"
                                cy="50"
                                fill="transparent"
                                stroke={slice.color}
                                strokeWidth="15"
                                strokeDasharray={`${dashArray} 314`}
                                strokeDashoffset={dashOffset}
                                className="transition-all duration-500 hover:stroke-[18]"
                            />
                        );
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-slate-500">الإجمالي</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{total.toLocaleString()}</span>
                </div>
            </div>
            
            <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-2 w-40">
                {data.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                            <span className="truncate text-slate-600 dark:text-slate-300" title={item.label}>{item.label}</span>
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round((item.value / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const KpiCard: React.FC<{ title: string; value: string; icon: React.ReactNode; colorClass: string }> = ({ title, value, icon, colorClass }) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
                <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1 uppercase tracking-wider">{title}</h3>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
            </div>
            <div className={`p-3 rounded-xl ${colorClass}`}>
                {icon}
            </div>
        </div>
    );
};

// --- Main Page Component ---

const Expenses: React.FC = () => {
    const { addExpense, updateExpense, deleteExpense, showConfirmModal, addNotification, authUser, can, employees, fetchServerExpenses, settings } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentExpense, setCurrentExpense] = useState<Partial<Expense>>({});
    const [activeTab, setActiveTab] = useState<'all' | 'payroll'>('all');
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [employeeFilter, setEmployeeFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'this_month' | 'last_month' | 'custom'>('this_month');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    
    // Server Data
    const [serverExpenses, setServerExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";
    const searchInputClasses = "block w-full p-2.5 pl-10 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200 text-sm";

    const loadData = async () => {
        setIsLoading(true);
        try {
            const now = new Date();
            let start = new Date();
            let end = new Date();

            switch (dateFilter) {
                case 'today':
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'yesterday':
                    start.setDate(now.getDate() - 1);
                    start.setHours(0, 0, 0, 0);
                    end.setDate(now.getDate() - 1);
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'this_month':
                    start = new Date(now.getFullYear(), now.getMonth(), 1);
                    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'last_month':
                    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                    break;
                case 'custom':
                    if (customStartDate && customEndDate) {
                        start = new Date(customStartDate);
                        start.setHours(0, 0, 0, 0);
                        end = new Date(customEndDate);
                        end.setHours(23, 59, 59, 999);
                    } else {
                        setIsLoading(false);
                        return;
                    }
                    break;
            }

            const data = await fetchServerExpenses(start.toISOString(), end.toISOString());
            setServerExpenses(data);
        } catch (e) {
            console.error(e);
            addNotification({ title: 'خطأ', message: 'فشل تحميل المصروفات من السيرفر.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [dateFilter, customStartDate, customEndDate]);

    // --- Data Processing (Client-side filtering for search/employee) ---
    const filteredExpenses = useMemo(() => {
        let data = serverExpenses;

        // Category Tab Filter
        if (activeTab === 'payroll') {
            data = data.filter(e => e.category === 'رواتب');
        }

        // Employee Filter
        if (employeeFilter !== 'all') {
            data = data.filter(e => e.employeeId === employeeFilter);
        }

        // Search Filter
        const lowercasedTerm = searchTerm.toLowerCase();
        if (lowercasedTerm) {
            data = data.filter(expense =>
                expense.description.toLowerCase().includes(lowercasedTerm) ||
                expense.category.toLowerCase().includes(lowercasedTerm) ||
                expense.employeeName.toLowerCase().includes(lowercasedTerm)
            );
        }
        
        return data;
    }, [serverExpenses, searchTerm, employeeFilter, activeTab]);
    
    const stats = useMemo(() => {
        const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const count = filteredExpenses.length;
        
        const categoryMap: Record<string, number> = {};
        filteredExpenses.forEach(exp => {
            categoryMap[exp.category] = (categoryMap[exp.category] || 0) + exp.amount;
        });
        
        const chartData = Object.entries(categoryMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([label, value], index) => ({
                label,
                value,
                color: COLORS[index % COLORS.length]
            }));

        const top5Total = chartData.reduce((acc, item) => acc + item.value, 0);
        if (total > top5Total) {
            chartData.push({ label: 'أخرى', value: total - top5Total, color: '#94a3b8' });
        }

        return { total, count, chartData };
    }, [filteredExpenses]);


    // --- Handlers ---
    const handleAdd = () => {
        setCurrentExpense({ date: new Date().toISOString(), category: '', description: '', amount: 0 });
        setCustomCategory('');
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleEdit = (expense: Expense) => {
        setCurrentExpense(expense);
        setCustomCategory(expense.category); 
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = (expense: Expense) => {
        showConfirmModal({
            title: `حذف مصروف`,
            message: `هل أنت متأكد من حذف هذا المصروف؟ (${expense.description})`,
            onConfirm: async () => {
                await deleteExpense(expense.id);
                addNotification({ title: 'نجاح', message: 'تم حذف المصروف.', type: 'success' });
                loadData();
            }
        });
    };

    const handleSave = async () => {
        const finalCategory = currentExpense.category || customCategory;
        
        if (!finalCategory?.trim() || !currentExpense.description?.trim() || !currentExpense.amount) {
            addNotification({ title: 'بيانات ناقصة', message: 'الرجاء تعبئة الفئة، الوصف، والمبلغ.', type: 'error' });
            return;
        }
        if (!authUser) {
             addNotification({ title: 'خطأ', message: 'لم يتم العثور على المستخدم الحالي.', type: 'error' });
            return;
        }

        const expenseData = { ...currentExpense, category: finalCategory };

        try {
            if (isEditing) {
                await updateExpense(expenseData as Expense);
                addNotification({ title: 'نجاح', message: 'تم تعديل المصروف.', type: 'success' });
            } else {
                const newExpense: Omit<Expense, 'id'> = {
                    date: expenseData.date!,
                    category: expenseData.category!,
                    description: expenseData.description!,
                    amount: expenseData.amount!,
                    employeeId: authUser.id,
                    employeeName: authUser.name,
                };
                await addExpense(newExpense);
                addNotification({ title: 'نجاح', message: 'تمت إضافة المصروف.', type: 'success' });
            }
            setIsModalOpen(false);
            loadData();
        } catch (e) {
            addNotification({ title: 'خطأ', message: 'فشل الحفظ.', type: 'error' });
        }
    };

    if (!can('manage_expenses')) {
        return (
            <div className="container mx-auto text-center py-10">
                <h2 className="text-2xl font-bold text-red-600">وصول مرفوض</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-2">ليس لديك الصلاحية لعرض هذه الصفحة.</p>
            </div>
        );
    }

    const getFilterLabel = () => {
        switch(dateFilter) {
            case 'today': return 'اليوم';
            case 'yesterday': return 'أمس';
            case 'this_month': return 'هذا الشهر';
            case 'last_month': return 'الشهر الماضي';
            case 'custom': return 'نطاق مخصص';
            default: return 'الكل';
        }
    };

    const activeTabClass = "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400";
    const inactiveTabClass = "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300";

    return (
        <div className="container mx-auto animate-fade-in pb-20">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">إدارة المصروفات</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">تتبع وتحليل النفقات التشغيلية للورشة</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button onClick={loadData} variant="secondary" leftIcon={<RefreshCwIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />} disabled={isLoading}>
                        تحديث
                    </Button>
                    <Button onClick={handleAdd} leftIcon={<Icon name="add" />} className="flex-1 md:flex-none shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all">
                        إضافة مصروف جديد
                    </Button>
                </div>
            </div>

            {/* Dashboard / Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                    <KpiCard 
                        title={`إجمالي ${activeTab === 'payroll' ? 'الرواتب' : 'المصروفات'} (${getFilterLabel()})`}
                        value={`${stats.total.toLocaleString('en-US')} ريال`}
                        icon={<CreditCardIcon className="w-6 h-6"/>}
                        colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    />
                    <KpiCard 
                        title="عدد العمليات"
                        value={stats.count.toString()}
                        icon={<Icon name="document-report" className="w-6 h-6"/>}
                        colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    />
                    
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 col-span-1 sm:col-span-2">
                        <div className="flex items-center gap-2 mb-2">
                            <FilterIcon className="w-5 h-5 text-slate-400 ms-2" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">عرض البيانات لـ:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'today', label: 'اليوم' },
                                { id: 'yesterday', label: 'أمس' },
                                { id: 'this_month', label: 'هذا الشهر' },
                                { id: 'last_month', label: 'الشهر الماضي' },
                                { id: 'custom', label: 'تحديد...' },
                            ].map((filter) => (
                                <button 
                                    key={filter.id}
                                    onClick={() => setDateFilter(filter.id as any)} 
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${dateFilter === filter.id 
                                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' 
                                        : 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                        
                        {dateFilter === 'custom' && (
                            <div className="flex items-center gap-2 mt-3 animate-fade-in p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-600">
                                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs w-full" />
                                <span className="text-slate-400">-</span>
                                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="p-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs w-full" />
                                <Button size="sm" onClick={loadData}>تطبيق</Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">توزيع المصروفات</h3>
                    <ExpensesDonutChart data={stats.chartData} />
                </div>
            </div>
            
            {/* Tabs & Search & List */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="border-b dark:border-slate-700 px-4 pt-1 flex justify-between items-end flex-wrap gap-4">
                    <nav className="flex space-x-6 rtl:space-x-reverse">
                        <button 
                            onClick={() => setActiveTab('all')} 
                            className={`py-4 px-1 text-sm font-bold transition-all ${activeTab === 'all' ? activeTabClass : inactiveTabClass}`}
                        >
                            كافة المصروفات
                        </button>
                        <button 
                            onClick={() => setActiveTab('payroll')} 
                            className={`py-4 px-1 text-sm font-bold transition-all ${activeTab === 'payroll' ? activeTabClass : inactiveTabClass}`}
                        >
                            رواتب الموظفين
                        </button>
                    </nav>
                </div>

                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-slate-400" />
                        </span>
                        <input 
                            type="text"
                            placeholder="بحث في الوصف، الفئة..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={searchInputClasses}
                        />
                    </div>

                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <UserCircleIcon className="h-4 w-4 text-slate-400" />
                        </span>
                        <select
                            value={employeeFilter}
                            onChange={(e) => setEmployeeFilter(e.target.value)}
                            className={searchInputClasses}
                        >
                            <option value="all">كل الموظفين</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                         <div className="p-6">
                            <SkeletonTable rows={5} />
                        </div>
                    ) : (
                        <table className="w-full text-sm text-right">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 dark:text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">التاريخ</th>
                                    <th className="px-6 py-4 font-semibold">الفئة</th>
                                    <th className="px-6 py-4 font-semibold w-1/3">الوصف</th>
                                    <th className="px-6 py-4 font-semibold">المبلغ</th>
                                    <th className="px-6 py-4 font-semibold text-left">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredExpenses.map(expense => (
                                    <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono text-xs">
                                            {new Date(expense.date).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <CategoryBadge category={expense.category} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-slate-700 dark:text-slate-200 font-medium">{expense.description.split('[ID:')[0]}</span>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                                                    <UserCircleIcon className="w-3 h-3" />
                                                    المسجل: {expense.employeeName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">
                                            {expense.amount.toLocaleString('en-US')} <span className="text-xs font-normal text-slate-500">ريال</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(expense)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="تعديل">
                                                    <Icon name="edit" className="w-4 h-4"/>
                                                </button>
                                                <button onClick={() => handleDelete(expense)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="حذف">
                                                    <Icon name="delete" className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredExpenses.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <CreditCardIcon className="w-12 h-12 mb-3 opacity-20"/>
                                                <p>لا توجد مصروفات مسجلة تطابق بحثك.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'تعديل بيانات المصروف' : 'تسجيل مصروف جديد'} size="lg">
                <div className="space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 text-center">
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">مبلغ المصروف</label>
                        <div className="relative inline-block w-full max-w-xs">
                            <input 
                                type="number" 
                                value={currentExpense.amount || ''} 
                                onChange={e => setCurrentExpense(p => ({...p, amount: Number(e.target.value)}))} 
                                className="block w-full p-2 text-center text-3xl font-bold bg-transparent border-b-2 border-blue-500 focus:outline-none focus:border-blue-600 text-slate-800 dark:text-slate-100 placeholder-slate-300"
                                placeholder="0"
                                autoFocus={!isEditing}
                            />
                            <span className="absolute right-0 top-1/2 transform -translate-y-1/2 text-sm text-slate-400 font-normal">ريال</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">فئة المصروف</label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {COMMON_CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => { setCurrentExpense(p => ({...p, category: cat})); setCustomCategory(cat); }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${currentExpense.category === cat ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={customCategory} 
                                    onChange={e => { setCustomCategory(e.target.value); setCurrentExpense(p => ({...p, category: e.target.value})); }}
                                    className={formInputClasses} 
                                    placeholder="أو اكتب فئة أخرى..." 
                                    list="categories-list"
                                />
                                <datalist id="categories-list">
                                    {COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                        </div>

                        {isEditing && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">التاريخ</label>
                                <input type="date" value={currentExpense.date ? currentExpense.date.split('T')[0] : ''} onChange={e => setCurrentExpense(p => ({...p, date: e.target.value}))} className={formInputClasses} />
                            </div>
                        )}

                        <div className={isEditing ? "" : "md:col-span-2"}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">الوصف / التفاصيل</label>
                            <textarea 
                                value={currentExpense.description || ''} 
                                onChange={e => setCurrentExpense(p => ({...p, description: e.target.value}))} 
                                className={formInputClasses} 
                                rows={2}
                                placeholder="مثال: شراء زيت محرك 5 علب..."
                            ></textarea>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-6 mt-6 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
                    <Button onClick={handleSave} className="px-8 shadow-lg shadow-blue-500/30">حفظ المصروف</Button>
                </div>
            </Modal>
        </div>
    );
};

export default Expenses;
