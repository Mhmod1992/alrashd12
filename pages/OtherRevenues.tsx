
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Revenue, PaymentType } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';
import FilterIcon from '../components/icons/FilterIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import UserCircleIcon from '../components/icons/UserCircleIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import { SkeletonTable } from '../components/Skeleton';

// --- Constants ---
const COMMON_CATEGORIES = ['بيع سكراب', 'خدمة سريعة', 'استشارة فنية', 'تأجير', 'استرداد', 'أخرى'];

const KpiCard: React.FC<{ title: string; value: string; icon: React.ReactNode; colorClass: string }> = ({ title, value, icon, colorClass }) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
                <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1 uppercase tracking-wider">{title}</h3>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-numeric">{value}</p>
            </div>
            <div className={`p-3 rounded-xl ${colorClass}`}>
                {icon}
            </div>
        </div>
    );
};

const OtherRevenues: React.FC = () => {
    const { addRevenue, deleteRevenue, showConfirmModal, addNotification, authUser, can, employees, fetchServerRevenues } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentRevenue, setCurrentRevenue] = useState<Partial<Revenue>>({});
    const [customCategory, setCustomCategory] = useState('');

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [employeeFilter, setEmployeeFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'this_month' | 'last_month' | 'custom'>('this_month');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Server Data
    const [serverRevenues, setServerRevenues] = useState<Revenue[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";
    const searchInputClasses = "block w-full p-2.5 pl-10 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200 text-sm";

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

            const data = await fetchServerRevenues(start.toISOString(), end.toISOString());
            setServerRevenues(data);
        } catch (e) {
            console.error(e);
            addNotification({ title: 'خطأ', message: 'فشل تحميل الإيرادات من السيرفر.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [dateFilter, customStartDate, customEndDate]);

    const filteredRevenues = useMemo(() => {
        let data = serverRevenues;
        if (employeeFilter !== 'all') {
            data = data.filter(e => e.employeeId === employeeFilter);
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        if (lowercasedTerm) {
            data = data.filter(rev =>
                rev.description.toLowerCase().includes(lowercasedTerm) ||
                rev.category.toLowerCase().includes(lowercasedTerm) ||
                rev.employeeName.toLowerCase().includes(lowercasedTerm)
            );
        }
        return data;
    }, [serverRevenues, searchTerm, employeeFilter]);

    const stats = useMemo(() => {
        const total = filteredRevenues.reduce((sum, rev) => sum + rev.amount, 0);
        const count = filteredRevenues.length;
        return { total, count };
    }, [filteredRevenues]);

    const handleAdd = () => {
        // Use local date string YYYY-MM-DD for the date input default (or full ISO for addRevenue)
        setCurrentRevenue({
            date: new Date().toISOString(),
            category: '',
            description: '',
            amount: 0,
            payment_method: PaymentType.Cash
        });
        setCustomCategory('');
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleDelete = (revenue: Revenue) => {
        showConfirmModal({
            title: `حذف إيراد`,
            message: `هل أنت متأكد من حذف هذا الإيراد؟ (${revenue.description})`,
            onConfirm: async () => {
                await deleteRevenue(revenue.id);
                addNotification({ title: 'نجاح', message: 'تم حذف الإيراد.', type: 'success' });
                loadData();
            }
        });
    };

    const handleSave = async () => {
        const finalCategory = currentRevenue.category || customCategory;

        if (!finalCategory?.trim() || !currentRevenue.description?.trim() || !currentRevenue.amount) {
            addNotification({ title: 'بيانات ناقصة', message: 'الرجاء تعبئة الفئة، الوصف، والمبلغ.', type: 'error' });
            return;
        }
        if (!authUser) {
            addNotification({ title: 'خطأ', message: 'لم يتم العثور على المستخدم الحالي.', type: 'error' });
            return;
        }

        const revenueData: Omit<Revenue, 'id'> = {
            date: currentRevenue.date!,
            category: finalCategory,
            description: currentRevenue.description!,
            amount: currentRevenue.amount!,
            payment_method: currentRevenue.payment_method || PaymentType.Cash,
            employeeId: authUser.id,
            employeeName: authUser.name,
        };

        try {
            await addRevenue(revenueData);
            addNotification({ title: 'نجاح', message: 'تمت إضافة الإيراد.', type: 'success' });
            setIsModalOpen(false);
            loadData();
        } catch (e) {
            addNotification({ title: 'خطأ', message: 'فشل الحفظ.', type: 'error' });
        }
    };

    if (!can('manage_revenues')) {
        return (
            <div className="container mx-auto text-center py-10">
                <h2 className="text-2xl font-bold text-red-600">وصول مرفوض</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-2">ليس لديك الصلاحية لعرض هذه الصفحة.</p>
            </div>
        );
    }

    const getFilterLabel = () => {
        switch (dateFilter) {
            case 'today': return 'اليوم';
            case 'yesterday': return 'أمس';
            case 'this_month': return 'هذا الشهر';
            case 'last_month': return 'الشهر الماضي';
            case 'custom': return 'نطاق مخصص';
            default: return 'الكل';
        }
    };

    return (
        <div className="container mx-auto animate-fade-in pb-20">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">سجل الإيرادات الأخرى</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">تسجيل المداخيل الإضافية (خارج نطاق طلبات الفحص)</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button onClick={loadData} variant="secondary" leftIcon={<RefreshCwIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />} disabled={isLoading}>
                        تحديث
                    </Button>
                    <Button onClick={handleAdd} leftIcon={<Icon name="add" />} className="flex-1 md:flex-none shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all bg-green-600 hover:bg-green-700 text-white">
                        إضافة إيراد جديد
                    </Button>
                </div>
            </div>

            {/* Dashboard / Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard
                    title={`إجمالي الإيرادات (${getFilterLabel()})`}
                    value={`${stats.total.toLocaleString('en-US')} ريال`}
                    icon={<TrendingUpIcon className="w-6 h-6" />}
                    colorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                />
                <KpiCard
                    title="عدد العمليات"
                    value={stats.count.toString()}
                    icon={<Icon name="document-report" className="w-6 h-6" />}
                    colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                />

                {/* Filter Controls */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 col-span-1 md:col-span-2">
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
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
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

            {/* Search & List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center md:col-span-2">سجل العمليات</h3>

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
                                    <th className="px-6 py-4 font-semibold">طريقة الدفع</th>
                                    <th className="px-6 py-4 font-semibold text-left">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredRevenues.map(rev => (
                                    <tr key={rev.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono text-xs font-numeric">
                                            {new Date(rev.date).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-100 dark:border-green-800">
                                                {rev.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-slate-700 dark:text-slate-200 font-medium">{rev.description}</span>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                                                    <UserCircleIcon className="w-3 h-3" />
                                                    بواسطة: {rev.employeeName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 font-numeric">
                                            {rev.amount.toLocaleString('en-US')} <span className="text-xs font-normal text-slate-500 font-sans">ريال</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            {rev.payment_method === PaymentType.Cash && <span className="text-emerald-600">نقدي</span>}
                                            {rev.payment_method === PaymentType.Card && <span className="text-blue-600">شبكة</span>}
                                            {rev.payment_method === PaymentType.Transfer && <span className="text-amber-600">تحويل</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleDelete(rev)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="حذف">
                                                    <Icon name="delete" className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredRevenues.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <TrendingUpIcon className="w-12 h-12 mb-3 opacity-20" />
                                                <p>لا توجد إيرادات مسجلة تطابق بحثك.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إضافة إيراد جديد" size="lg">
                <div className="space-y-6">
                    {/* Amount Input */}
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800 text-center">
                        <label className="block text-sm font-medium text-green-800 dark:text-green-300 mb-2">مبلغ الإيراد</label>
                        <div className="relative inline-block w-full max-w-xs">
                            <input
                                type="number"
                                value={currentRevenue.amount || ''}
                                onChange={e => setCurrentRevenue(p => ({ ...p, amount: Number(e.target.value) }))}
                                className="block w-full p-2 text-center text-3xl font-bold bg-transparent border-b-2 border-green-500 focus:outline-none focus:border-green-600 text-slate-800 dark:text-slate-100 placeholder-green-300 font-numeric"
                                placeholder="0"
                                autoFocus
                            />
                            <span className="absolute right-0 top-1/2 transform -translate-y-1/2 text-sm text-green-600 font-normal font-sans">ريال</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Quick Categories */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">فئة الإيراد</label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {COMMON_CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => { setCurrentRevenue(p => ({ ...p, category: cat })); setCustomCategory(cat); }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${currentRevenue.category === cat ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-105' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={customCategory}
                                    onChange={e => { setCustomCategory(e.target.value); setCurrentRevenue(p => ({ ...p, category: e.target.value })); }}
                                    className={formInputClasses}
                                    placeholder="أو اكتب فئة أخرى..."
                                    list="rev-categories-list"
                                />
                                <datalist id="rev-categories-list">
                                    {COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">طريقة الدفع</label>
                            <select
                                value={currentRevenue.payment_method}
                                onChange={e => setCurrentRevenue(p => ({ ...p, payment_method: e.target.value as PaymentType }))}
                                className={formInputClasses}
                            >
                                <option value={PaymentType.Cash}>نقدي</option>
                                <option value={PaymentType.Card}>شبكة / بطاقة</option>
                                <option value={PaymentType.Transfer}>تحويل بنكي</option>
                            </select>
                        </div>

                        {isEditing && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">التاريخ</label>
                                <input type="date" value={currentRevenue.date ? currentRevenue.date.split('T')[0] : ''} onChange={e => setCurrentRevenue(p => ({ ...p, date: e.target.value }))} className={formInputClasses} />
                            </div>
                        )}

                        <div className="isEditing ? '' : 'md:col-span-2'">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">الوصف / التفاصيل</label>
                            <textarea
                                value={currentRevenue.description || ''}
                                onChange={e => setCurrentRevenue(p => ({ ...p, description: e.target.value }))}
                                className={formInputClasses}
                                rows={2}
                                placeholder="تفاصيل العملية..."
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 mt-6 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
                    <Button onClick={handleSave} className="px-8 shadow-lg bg-green-600 hover:bg-green-700 text-white">حفظ الإيراد</Button>
                </div>
            </Modal>
        </div>
    );
};

export default OtherRevenues;
