
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Icon from '../components/Icon';
import UserCircleIcon from '../components/icons/UserCircleIcon';
import BriefcaseIcon from '../components/icons/BriefcaseIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import { Employee, Technician, InspectionRequest, PayrollItem, PayrollDraft, Expense } from '../types';
import DollarSignIcon from '../components/icons/DollarSignIcon';
import EmployeeFinancialsModal from '../components/EmployeeFinancialsModal';
import Button from '../components/Button';
import Modal from '../components/Modal'; 
import ChevronDownIcon from '../components/icons/ChevronDownIcon';
import FilterIcon from '../components/icons/FilterIcon';
import SaveIcon from '../components/icons/SaveIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import BanknotesIcon from '../components/icons/BanknotesIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';

// --- Helper Components for Stats ---
const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string; subValue?: string; trend?: number }> = ({ title, value, icon, color, subValue, trend }) => (
    <div className={`p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800 flex items-center gap-4`}>
        <div className={`p-3 rounded-xl ${color}`}>
            {icon}
        </div>
        <div className="flex-1">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</p>
            <div className="flex justify-between items-end">
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 font-numeric">{value}</p>
                {trend !== undefined && (
                    <div className={`text-xs font-bold flex items-center dir-ltr ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {trend > 0 ? '+' : ''}{trend}%
                        <TrendingUpIcon className={`w-3 h-3 ms-1 ${trend < 0 ? 'transform rotate-180' : ''}`} />
                    </div>
                )}
            </div>
            {subValue && <p className="text-xs text-slate-400 mt-1 font-numeric">{subValue}</p>}
        </div>
    </div>
);

// --- Payroll Manager Component ---
const PayrollManager: React.FC = () => {
    const { 
        employees, technicians, authUser, expenses,
        addNotification, showConfirmModal, checkIfEmployeePaidThisMonth,
        addExpense
    } = useAppContext();
    
    // State
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [isLoading, setIsLoading] = useState(false);
    const [financialModalTarget, setFinancialModalTarget] = useState<{ person: Employee | Technician, type: 'employee' | 'technician' } | null>(null);

    // Aggregate Data for the Table
    const aggregatedPayroll = useMemo(() => {
        const staff = [
            ...employees.filter(e => e.is_active).map(e => ({ ...e, type: 'employee' as const })),
            ...technicians.filter(t => t.is_active).map(t => ({ ...t, type: 'technician' as const }))
        ];

        // Filter relevant expenses for current month
        const start = new Date(year, month - 1, 1).getTime();
        const end = new Date(year, month, 0, 23, 59, 59, 999).getTime();

        const monthExpenses = expenses.filter(e => {
            const d = new Date(e.date).getTime();
            return d >= start && d <= end;
        });

        return staff.map(person => {
            const personExpenses = monthExpenses.filter(e => e.description.includes(`[ID:${person.id}]`));
            
            let bonuses = 0;
            let deductions = 0;
            let isPaid = false;

            personExpenses.forEach(e => {
                if (e.category === 'مكافآت') bonuses += e.amount;
                else if (e.category === 'خصومات' || e.category === 'سلف') deductions += e.amount;
                else if (e.category === 'رواتب') isPaid = true;
            });

            const basic = person.salary || 0;
            const net = basic + bonuses - deductions;

            return {
                id: person.id,
                name: person.name,
                role: (person as any).role === 'employee' ? 'موظف' : (person as any).title || 'فني',
                basic,
                bonuses,
                deductions,
                net,
                isPaid,
                originalPerson: person
            };
        });
    }, [employees, technicians, expenses, month, year]);

    const totals = useMemo(() => {
        return aggregatedPayroll.reduce((acc, item) => ({
            basic: acc.basic + item.basic,
            bonuses: acc.bonuses + item.bonuses,
            deductions: acc.deductions + item.deductions,
            net: acc.net + item.net
        }), { basic: 0, bonuses: 0, deductions: 0, net: 0 });
    }, [aggregatedPayroll]);

    const handleApproveBatch = () => {
        const unpaid = aggregatedPayroll.filter(p => !p.isPaid && p.net > 0);
        if (unpaid.length === 0) {
            addNotification({ title: 'تنبيه', message: 'لا توجد رواتب مستحقة للصرف حالياً.', type: 'warning' });
            return;
        }

        showConfirmModal({
            title: `صرف رواتب شهر ${month} / ${year}`,
            message: `سيتم صرف رواتب لـ ${unpaid.length} موظف. الإجمالي: ${totals.net.toLocaleString('en-US')} ريال. هل تود المتابعة؟`,
            icon: 'warning',
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const promises = unpaid.map(p => {
                        const description = `صرف راتب شهر ${month}/${year} - الموظف: ${p.name} [ID:${p.id}]`;
                        return addExpense({
                            date: new Date().toISOString(),
                            category: 'رواتب',
                            description,
                            amount: p.net,
                            employeeId: authUser?.id || 'system',
                            employeeName: authUser?.name || 'النظام'
                        });
                    });
                    await Promise.all(promises);
                    addNotification({ title: 'تم الصرف', message: 'تم تسجيل كافة الرواتب كمصروفات بنجاح.', type: 'success' });
                } catch (error) {
                    addNotification({ title: 'خطأ', message: 'فشل صرف بعض الرواتب.', type: 'error' });
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Period Select */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/30">
                        <BanknotesIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">مسيرات الرواتب</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">تجميع آلي للإضافي والخصومات</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-900/50 p-2 rounded-xl border dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">الشهر:</span>
                        <select 
                            value={month} 
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="bg-white dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-numeric"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">السنة:</span>
                        <select 
                            value={year} 
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="bg-white dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-numeric"
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Payroll Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 dark:bg-slate-900/80 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase border-b dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4">الموظف</th>
                                <th className="px-4 py-4 text-center">الأساسي</th>
                                <th className="px-4 py-4 text-center">إجمالي الإضافي</th>
                                <th className="px-4 py-4 text-center">إجمالي الخصم</th>
                                <th className="px-6 py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-center">الصافي المستحق</th>
                                <th className="px-4 py-4">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {aggregatedPayroll.map(item => (
                                <tr 
                                    key={item.id} 
                                    onClick={() => setFinancialModalTarget({ person: item.originalPerson, type: (item.originalPerson as any).type })}
                                    className={`group hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-all ${item.isPaid ? 'bg-slate-50/50 opacity-80' : ''}`}
                                >
                                    <td className="px-6 py-4">
                                        <div>
                                            <div className="font-black text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 transition-colors">{item.name}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.role}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center font-bold text-slate-600 dark:text-slate-400 font-numeric">{item.basic.toLocaleString('en-US')}</td>
                                    <td className="px-4 py-4 text-center font-bold text-emerald-600 font-numeric">+{item.bonuses.toLocaleString('en-US')}</td>
                                    <td className="px-4 py-4 text-center font-bold text-red-600 font-numeric">-{item.deductions.toLocaleString('en-US')}</td>
                                    <td className="px-6 py-4 bg-emerald-50/30 dark:bg-emerald-900/5 text-center">
                                        <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-numeric">{item.net.toLocaleString('en-US')}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        {item.isPaid ? (
                                            <span className="flex items-center gap-1 text-green-600 font-bold text-xs"><CheckCircleIcon className="w-4 h-4"/> تم الصرف</span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">قيد الانتظار</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-slate-900 font-black text-slate-700 dark:text-slate-200 border-t-2 border-slate-200 dark:border-slate-700">
                             <tr>
                                <td className="px-6 py-5">إجمالي المسير</td>
                                <td className="px-4 py-5 text-center font-numeric">{totals.basic.toLocaleString('en-US')}</td>
                                <td className="px-4 py-5 text-center text-emerald-600 font-numeric">{totals.bonuses.toLocaleString('en-US')}</td>
                                <td className="px-4 py-5 text-center text-red-600 font-numeric">{totals.deductions.toLocaleString('en-US')}</td>
                                <td className="px-6 py-5 bg-blue-600 text-white text-lg text-center font-numeric" colSpan={2}>{totals.net.toLocaleString('en-US')} ريال</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
                <Button 
                    onClick={handleApproveBatch} 
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8"
                >
                    {isLoading ? <RefreshCwIcon className="animate-spin w-5 h-5"/> : 'اعتماد وصرف جميع الرواتب'}
                </Button>
            </div>

            {/* Financial Management Modal */}
            {financialModalTarget && (
                <EmployeeFinancialsModal 
                    isOpen={!!financialModalTarget}
                    onClose={() => setFinancialModalTarget(null)}
                    target={financialModalTarget.person}
                    type={financialModalTarget.type}
                    selectedMonth={month}
                    selectedYear={year}
                />
            )}
        </div>
    );
}

const UnifiedDirectory: React.FC = () => {
    const { employees, technicians } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [financialModalTarget, setFinancialModalTarget] = useState<Employee | Technician | null>(null);
    const [financialModalType, setFinancialModalType] = useState<'employee' | 'technician'>('employee');
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    const allStaff = useMemo(() => {
        const mappedEmployees = employees.map(e => ({ ...e, type: 'employee' as const }));
        const mappedTechnicians = technicians.map(t => ({ ...t, type: 'technician' as const, role: 'technician' })); // Normalize role for technicians
        return [...mappedEmployees, ...mappedTechnicians];
    }, [employees, technicians]);

    const filteredStaff = useMemo(() => {
        return allStaff.filter(person => {
            // 1. Search Filter
            const matchesSearch = person.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            // 2. Status Filter
            let matchesStatus = true;
            if (statusFilter === 'active') matchesStatus = person.is_active;
            else if (statusFilter === 'inactive') matchesStatus = !person.is_active;

            // 3. Role Filter
            let matchesRole = true;
            if (roleFilter !== 'all') {
                // If filtering by specific employee roles
                if (['general_manager', 'manager', 'receptionist', 'employee'].includes(roleFilter)) {
                    matchesRole = person.role === roleFilter;
                } 
                // If filtering by 'technician' (which encompasses all manual laborers stored in 'technicians' table)
                else if (roleFilter === 'technician') {
                    matchesRole = person.role === 'technician'; // This comes from our normalization above
                }
            }

            return matchesSearch && matchesStatus && matchesRole;
        });
    }, [allStaff, searchTerm, statusFilter, roleFilter]);

    const openFinancials = (person: any) => {
        setFinancialModalTarget(person);
        setFinancialModalType(person.type);
    };

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-grow">
                    <Icon name="search" className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="بحث بالاسم..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                
                {/* Filters Row */}
                <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto pb-1 md:pb-0">
                    <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1">
                        <button onClick={() => setStatusFilter('active')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === 'active' ? 'bg-white dark:bg-slate-600 shadow-sm text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>نشط</button>
                        <button onClick={() => setStatusFilter('inactive')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === 'inactive' ? 'bg-white dark:bg-slate-600 shadow-sm text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>غير نشط</button>
                        <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === 'all' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>الكل</button>
                    </div>

                    <div className="relative min-w-[140px]">
                        <select 
                            value={roleFilter} 
                            onChange={(e) => setRoleFilter(e.target.value)} 
                            className="w-full appearance-none bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-2 pl-8 pr-3 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="all">جميع الأدوار</option>
                            <option value="general_manager">مدير عام</option>
                            <option value="manager">مدير</option>
                            <option value="receptionist">استقبال</option>
                            <option value="employee">موظف نظام</option>
                            <option value="technician">فني / عامل</option>
                        </select>
                        <FilterIcon className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-700 text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="px-6 py-4">الاسم</th>
                            <th className="px-6 py-4">النوع / الدور</th>
                            <th className="px-6 py-4">الراتب الأساسي</th>
                            <th className="px-6 py-4">الحالة</th>
                            <th className="px-6 py-4">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredStaff.map((person: any) => (
                            <tr key={`${person.type}-${person.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${person.type === 'employee' ? 'bg-blue-500' : 'bg-orange-500'}`}>
                                            {person.name.charAt(0)}
                                        </div>
                                        {person.name}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${person.type === 'employee' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {person.type === 'employee' ? (person.role === 'general_manager' ? 'مدير عام' : person.role === 'manager' ? 'مدير' : person.role === 'receptionist' ? 'استقبال' : 'موظف نظام') : (person.title || 'فني / عامل')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 font-numeric">
                                    {person.salary?.toLocaleString('en-US') || 0} ريال
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`w-2 h-2 rounded-full inline-block mr-2 ${person.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    <span className="text-xs text-slate-500">{person.is_active ? 'نشط' : 'غير نشط'}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <Button size="sm" variant="secondary" onClick={() => openFinancials(person)}>
                                        <DollarSignIcon className="w-4 h-4 text-green-600" />
                                        <span className="ms-1">الملف المالي</span>
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {filteredStaff.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-slate-500">
                                    لا توجد نتائج تطابق الفلاتر الحالية.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {financialModalTarget && (
                <EmployeeFinancialsModal 
                    isOpen={!!financialModalTarget}
                    onClose={() => setFinancialModalTarget(null)}
                    target={financialModalTarget}
                    type={financialModalType}
                    selectedMonth={new Date().getMonth() + 1}
                    selectedYear={new Date().getFullYear()}
                />
            )}
        </div>
    );
}

// Simple Bar Chart using HTML/Tailwind for visual representation
const PerformanceBarChart: React.FC<{ data: { name: string; count: number; color: string }[] }> = ({ data }) => {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    
    return (
        <div className="flex flex-col gap-3 w-full h-48 justify-end items-center">
            <div className="flex justify-around items-end w-full h-full gap-4">
                {data.map((item, i) => {
                    const height = (item.count / maxCount) * 100;
                    return (
                        <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
                            <div className="text-[10px] font-bold text-slate-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity font-numeric">{item.count}</div>
                            <div 
                                className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ease-out hover:opacity-80 ${item.color}`}
                                style={{ height: `${height}%` }}
                            ></div>
                            <div className="mt-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 text-center truncate w-full">{item.name}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const PerformanceView: React.FC = () => {
    const { employees, technicians, requests, setSelectedRequestId, setPage } = useAppContext();
    
    // Filters State
    const [viewFilter, setViewFilter] = useState<'all' | 'employee' | 'technician'>('all');
    const [sortOrder, setSortOrder] = useState<'most_active' | 'least_active' | 'name'>('most_active'); // Removed revenue sort
    const [dateFilterType, setDateFilterType] = useState<'today' | 'yesterday' | 'month' | 'year' | 'custom'>('month');
    
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(1); // Default to start of current month
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });

    // Handle Quick Date Filters
    const applyDateFilter = (type: 'today' | 'yesterday' | 'month' | 'year' | 'custom') => {
        setDateFilterType(type);
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (type) {
            case 'today':
                // Already set to now
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month
                break;
            case 'year':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                break;
            case 'custom':
                // Do not change dates, user will select
                return;
        }

        // if (type !== 'custom') { // Removed redundant check
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(end.toISOString().split('T')[0]);
        // }
    };

    // Details Modal State
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedPersonDetails, setSelectedPersonDetails] = useState<{ name: string; requests: InspectionRequest[] } | null>(null);

    const stats = useMemo(() => {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Previous Period Logic (Automatic)
        const duration = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - duration);

        const currentRequests = requests.filter(r => {
            const d = new Date(r.created_at);
            return d >= start && d <= end;
        });

        const prevRequests = requests.filter(r => {
            const d = new Date(r.created_at);
            return d >= prevStart && d <= prevEnd;
        });

        const allStaff = [
            ...employees.map(e => ({ ...e, type: 'employee' as const })),
            ...technicians.map(t => ({ ...t, type: 'technician' as const }))
        ];

        let processedStats = allStaff.map((person: any) => {
            // Function to filter requests for a person
            const filterPersonRequests = (reqs: InspectionRequest[]) => {
                if (person.type === 'employee') {
                     return reqs.filter(r => 
                        r.employee_id === person.id || 
                        Object.values(r.technician_assignments || {}).some(ids => ids.includes(person.id))
                     );
                } else {
                     return reqs.filter(r => 
                        Object.values(r.technician_assignments || {}).some(ids => ids.includes(person.id))
                     );
                }
            };

            const personCurrentReqs = filterPersonRequests(currentRequests);
            const personPrevReqs = filterPersonRequests(prevRequests);

            // Growth Calculation
            const growthPercent = personPrevReqs.length > 0 
                ? Math.round(((personCurrentReqs.length - personPrevReqs.length) / personPrevReqs.length) * 100)
                : (personCurrentReqs.length > 0 ? 100 : 0);

            return {
                id: person.id,
                name: person.name,
                type: person.type,
                role: person.role || person.title || 'فني',
                requestCount: personCurrentReqs.length,
                prevRequestCount: personPrevReqs.length,
                growth: growthPercent,
                associatedRequests: personCurrentReqs
            };
        });

        // 1. Filter by Type
        if (viewFilter !== 'all') {
            processedStats = processedStats.filter(p => p.type === viewFilter);
        }

        // 2. Sort
        processedStats.sort((a, b) => {
            if (sortOrder === 'most_active') return b.requestCount - a.requestCount;
            if (sortOrder === 'least_active') return a.requestCount - b.requestCount;
            if (sortOrder === 'name') return a.name.localeCompare(b.name);
            return 0;
        });

        return processedStats;

    }, [employees, technicians, requests, viewFilter, sortOrder, startDate, endDate]);

    const topPerformersData = useMemo(() => {
        return stats.slice(0, 5).map((s, i) => ({
            name: s.name,
            count: s.requestCount,
            color: ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500'][i % 5]
        }));
    }, [stats]);

    const topPerformer = stats.length > 0 && (sortOrder === 'most_active') ? stats[0] : null; 
    const totalRequestsInPeriod = stats.reduce((sum, s) => sum + s.requestCount, 0);

    const handleOpenDetails = (personStat: typeof stats[0]) => {
        setSelectedPersonDetails({
            name: personStat.name,
            requests: personStat.associatedRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        });
        setIsDetailsModalOpen(true);
    };

    const handleViewRequest = (requestId: string) => {
        setSelectedRequestId(requestId);
        setPage('print-report'); 
        setIsDetailsModalOpen(false);
    };
    
    // Helper style for active filter button
    const activeFilterClass = "bg-blue-600 text-white shadow-md border-blue-600";
    const inactiveFilterClass = "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50";

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => applyDateFilter('today')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${dateFilterType === 'today' ? activeFilterClass : inactiveFilterClass}`}>اليوم</button>
                    <button onClick={() => applyDateFilter('yesterday')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${dateFilterType === 'yesterday' ? activeFilterClass : inactiveFilterClass}`}>أمس</button>
                    <button onClick={() => applyDateFilter('month')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${dateFilterType === 'month' ? activeFilterClass : inactiveFilterClass}`}>هذا الشهر</button>
                    <button onClick={() => applyDateFilter('year')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${dateFilterType === 'year' ? activeFilterClass : inactiveFilterClass}`}>هذه السنة</button>
                    <button onClick={() => setDateFilterType('custom')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${dateFilterType === 'custom' ? activeFilterClass : inactiveFilterClass}`}>نطاق مخصص</button>
                </div>

                {dateFilterType === 'custom' && (
                    <div className="flex flex-col md:flex-row gap-4 items-end animate-fade-in">
                        <div className="w-full md:w-auto">
                            <label className="block text-xs font-bold text-slate-500 mb-1">من تاريخ</label>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="block text-xs font-bold text-slate-500 mb-1">إلى تاريخ</label>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Top Stats & Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stats Cards Column */}
                <div className="space-y-4">
                     <StatCard 
                        title="الأكثر نشاطاً"
                        value={topPerformer ? topPerformer.name : '-'}
                        subValue={topPerformer ? `${topPerformer.requestCount} مشاركة` : ''}
                        icon={<Icon name="sparkles" className="w-6 h-6"/>}
                        color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                        trend={topPerformer?.growth}
                    />
                     <StatCard 
                        title="إجمالي التفاعلات (مشاركات)"
                        value={totalRequestsInPeriod.toString()}
                        icon={<BriefcaseIcon className="w-6 h-6"/>}
                        color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    />
                </div>

                {/* Chart Column */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 flex flex-col justify-between">
                     <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <TrendingUpIcon className="w-5 h-5 text-blue-500" />
                        أفضل 5 مساهمين (حسب عدد الطلبات)
                     </h3>
                     {topPerformersData.length > 0 ? (
                         <PerformanceBarChart data={topPerformersData} />
                     ) : (
                         <div className="flex-1 flex items-center justify-center text-slate-400">لا توجد بيانات للفترة المحددة.</div>
                     )}
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">تفاصيل الأداء</h3>
                    
                    <div className="flex gap-3 items-center w-full sm:w-auto">
                        {/* Tabs Filter */}
                        <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1">
                            <button onClick={() => setViewFilter('all')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewFilter === 'all' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>الكل</button>
                            <button onClick={() => setViewFilter('employee')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewFilter === 'employee' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>المستخدمين</button>
                            <button onClick={() => setViewFilter('technician')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewFilter === 'technician' ? 'bg-white dark:bg-slate-600 shadow-sm text-orange-600 dark:text-orange-300' : 'text-slate-500 dark:text-slate-400'}`}>الفنيين</button>
                        </div>

                        {/* Sort Dropdown */}
                        <div className="relative group">
                            <select 
                                value={sortOrder} 
                                onChange={(e) => setSortOrder(e.target.value as any)} 
                                className="appearance-none bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-1.5 pl-8 pr-3 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="most_active">الأكثر نشاطاً</option>
                                <option value="least_active">الأقل نشاطاً</option>
                                <option value="name">أبجدياً</option>
                            </select>
                            <FilterIcon className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 dark:bg-slate-700 text-xs font-bold text-slate-500 uppercase">
                            <tr>
                                <th className="px-6 py-3">الموظف / الفني</th>
                                <th className="px-6 py-3">الدور</th>
                                <th className="px-6 py-3 text-center">الطلبات (الحالية)</th>
                                <th className="px-6 py-3 text-center">الطلبات (السابقة)</th>
                                <th className="px-6 py-3 text-center">النمو</th>
                                <th className="px-6 py-3 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {stats.map(person => {
                                return (
                                    <tr key={person.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{person.name}</td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            <span className={`px-2 py-1 rounded text-xs ${person.type === 'employee' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                                {person.role === 'general_manager' ? 'مدير عام' : person.role === 'manager' ? 'مدير' : person.role === 'receptionist' ? 'استقبال' : person.role === 'technician' ? 'فني' : person.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-slate-700 dark:text-slate-200 font-numeric">{person.requestCount}</td>
                                        <td className="px-6 py-4 text-center text-slate-400 font-numeric">{person.prevRequestCount}</td>
                                        <td className="px-6 py-4 text-center">
                                             <div className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold ${person.growth > 0 ? 'bg-green-100 text-green-700' : person.growth < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                                <span className="dir-ltr font-numeric">{person.growth > 0 ? '+' : ''}{person.growth}%</span>
                                             </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => handleOpenDetails(person)}
                                                className="inline-flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-600 transition-colors"
                                                title="عرض التفاصيل"
                                            >
                                                <Icon name="eye" className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {stats.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-500">لا توجد بيانات للعرض حسب الفلاتر الحالية.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Details Modal */}
            <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title={`مشاركات: ${selectedPersonDetails?.name}`} size="lg">
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {selectedPersonDetails && selectedPersonDetails.requests.length > 0 ? (
                        <div className="space-y-2">
                            {selectedPersonDetails.requests.map(req => (
                                <div key={req.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold px-2 py-1 rounded text-xs">
                                            #{req.request_number}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                {req.car_snapshot ? `${req.car_snapshot.make_ar} ${req.car_snapshot.model_ar}` : 'سيارة غير معروفة'}
                                            </p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-numeric">
                                                {new Date(req.created_at).toLocaleDateString('en-GB')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            req.status === 'مكتمل' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {req.status}
                                        </span>
                                        <Button size="sm" variant="secondary" onClick={() => handleViewRequest(req.id)} className="h-8 px-3 text-xs">
                                            عرض
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500">لا توجد مشاركات مسجلة.</div>
                    )}
                </div>
                <div className="mt-4 pt-4 border-t dark:border-slate-700 flex justify-end">
                    <Button variant="secondary" onClick={() => setIsDetailsModalOpen(false)}>إغلاق</Button>
                </div>
            </Modal>
        </div>
    );
};

const Employees: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'directory' | 'payroll' | 'performance'>('directory');

    return (
        <div className="container mx-auto pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">شؤون الموظفين</h2>
                
                <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('directory')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'directory' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                    >
                        الدليل الشامل
                    </button>
                    <button 
                        onClick={() => setActiveTab('payroll')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'payroll' ? 'bg-white dark:bg-slate-600 shadow text-green-600 dark:text-green-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                    >
                        الرواتب والمسيرات
                    </button>
                    <button 
                        onClick={() => setActiveTab('performance')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'performance' ? 'bg-white dark:bg-slate-600 shadow text-purple-600 dark:text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                    >
                        سجل الأداء
                    </button>
                </div>
            </div>

            <div className="mt-6">
                {activeTab === 'directory' && <UnifiedDirectory />}
                {activeTab === 'payroll' && <PayrollManager />}
                {activeTab === 'performance' && <PerformanceView />}
            </div>
        </div>
    );
};

export default Employees;
