
import React, { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';
import { useAppContext } from '../context/AppContext';
import Icon from '../components/Icon';
import UserCircleIcon from '../components/icons/UserCircleIcon';
import CustomDatePicker from '../components/CustomDatePicker';
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
                // If filtering by 'technician' (which encompasses all manual laborers stored in 'technicians' table OR employees marked as technicians)
                else if (roleFilter === 'technician') {
                    matchesRole = person.role === 'technician' || (person.type === 'employee' && person.preferences?.isTechnician); // Include tech-enabled employees
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
                                        {person.type === 'employee' ? 
                                            (person.preferences?.isTechnician && person.title ? person.title : 
                                                (person.role === 'general_manager' ? 'مدير عام' : person.role === 'manager' ? 'مدير' : person.role === 'receptionist' ? 'استقبال' : 'موظف نظام')
                                            ) : (person.title || 'فني / عامل')}
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

const getColorHex = (tailwindClass: string) => {
    switch (tailwindClass) {
        case 'bg-blue-500': return '#3b82f6';
        case 'bg-purple-500': return '#a855f7';
        case 'bg-orange-500': return '#f97316';
        default: return '#64748b';
    }
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-xs">
                <p className="font-bold text-slate-700 dark:text-slate-200">{label}</p>
                <p className="text-slate-600 dark:text-slate-400 font-numeric">{`${payload[0].value} مشاركة`}</p>
            </div>
        );
    }
    return null;
};

// Recharts Bar Chart
const PerformanceBarChart: React.FC<{ data: { name: string; count: number; color: string }[] }> = ({ data }) => {
    return (
        <div className="w-full h-48" style={{ direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }} barSize={32}>
                    <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }} 
                        dy={8}
                    />
                    <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getColorHex(entry.color)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// Component for displaying top performers in a category
const CategoryRankCard: React.FC<{ 
    title: string; 
    icon: React.ReactNode; 
    items: { name: string; count: number; color: string; id: string }[];
    onItemClick: (id: string) => void;
    accentColor: string;
    unit: string;
}> = ({ title, icon, items, onItemClick, accentColor, unit }) => {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className={`p-3 border-b border-slate-50 dark:border-slate-700/50 flex items-center justify-between ${accentColor}`}>
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="font-bold text-sm">{title}</h3>
                </div>
                <span className="text-[10px] opacity-70 font-bold uppercase tracking-wider">{items.length} موظف</span>
            </div>
            <div className="p-2 space-y-1 flex-1">
                {items.length > 0 ? (
                    items.map((item, index) => (
                        <button 
                            key={item.id}
                            onClick={() => onItemClick(item.id)}
                            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700 ring-4 ring-yellow-50' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                    {index + 1}
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs font-bold font-numeric text-slate-800 dark:text-slate-100">{item.count}</span>
                                <span className="text-[10px] text-slate-400">{unit}</span>
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="py-8 text-center text-slate-400 text-xs">لا يوجد بيانات</div>
                )}
            </div>
        </div>
    );
};

const PerformanceView: React.FC = () => {
    const { employees, technicians, requests, customFindingCategories, setSelectedRequestId, setPage, fetchRequestsByDateRange } = useAppContext();
    
    // Filters State
    const [viewFilter, setViewFilter] = useState<'all' | 'employee' | 'technician' | 'creators' | 'noters' | 'inspectors'>('all');
    const [sortOrder, setSortOrder] = useState<'most_active' | 'least_active' | 'name'>('most_active');
    const [dateFilterType, setDateFilterType] = useState<'today' | 'yesterday' | 'month' | 'year' | 'custom'>('today');
    
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [endDate, setEndDate] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    const [serverRequests, setServerRequests] = useState<InspectionRequest[]>([]);
    const [isLoadingServer, setIsLoadingServer] = useState(false);

    const fetchDataForRange = async (startStr: string, endStr: string) => {
        setIsLoadingServer(true);
        try {
            const startStrDate = new Date(startStr);
            startStrDate.setHours(0, 0, 0, 0);
            
            const endStrDate = new Date(endStr);
            endStrDate.setHours(23, 59, 59, 999);

            // Fetch current AND previous period for growth stats
            const duration = endStrDate.getTime() - startStrDate.getTime();
            const prevEnd = new Date(startStrDate.getTime() - 1);
            const prevStart = new Date(prevEnd.getTime() - duration);

            const data = await fetchRequestsByDateRange(prevStart.toISOString(), endStrDate.toISOString());
            setServerRequests(data || []);
        } catch (error) {
            console.error("Failed to fetch performance data:", error);
        } finally {
            setIsLoadingServer(false);
        }
    };

    // Handle Quick Date Filters
    const applyDateFilter = (type: 'today' | 'yesterday' | 'month' | 'year' | 'custom') => {
        setDateFilterType(type);
        if (type === 'custom') return; // Do not overwrite dates, wait for user search
        
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (type) {
            case 'today':
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
        }

        const formatDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        const s = formatDateStr(start);
        const e = formatDateStr(end);
        
        setStartDate(s);
        setEndDate(e);
        
        if (type !== 'today') {
            fetchDataForRange(s, e);
        }
    };

    // Initialize initial load for 'today' if needed, though we rely on local 'requests' array.
    
    // Details Modal State
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [detailsTab, setDetailsTab] = useState<'all' | 'created' | 'noted' | 'inspected' | 'multiple_sections'>('all');
    const [selectedPersonDetails, setSelectedPersonDetails] = useState<{ 
        name: string; 
        requests: InspectionRequest[];
        created: InspectionRequest[];
        inspected: InspectionRequest[];
        noted: InspectionRequest[];
        multipleSections: InspectionRequest[];
    } | null>(null);

    const allStaff = useMemo(() => [
        ...employees.map(e => ({ ...e, type: 'employee' as const })),
        ...technicians.map(t => ({ ...t, type: 'technician' as const }))
    ], [employees, technicians]);

    const stats = useMemo(() => {
        const start = startDate ? new Date(startDate) : new Date(0);
        if (!isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
        
        const end = endDate ? new Date(endDate) : new Date();
        if (!isNaN(end.getTime())) end.setHours(23, 59, 59, 999);

        // Previous Period Logic (Automatic)
        const duration = (!isNaN(end.getTime()) && !isNaN(start.getTime())) ? end.getTime() - start.getTime() : 0;
        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - duration);

        const activeRequests = dateFilterType === 'today' ? requests : serverRequests;

        const currentRequests = activeRequests.filter(r => {
            if (!r.created_at) return false;
            const d = new Date(r.created_at);
            return !isNaN(d.getTime()) && d >= start && d <= end;
        });

        const prevRequests = activeRequests.filter(r => {
            if (!r.created_at) return false;
            const d = new Date(r.created_at);
            return !isNaN(d.getTime()) && d >= prevStart && d <= prevEnd;
        });

        let processedStats = allStaff.map((person: any) => {
            const analyzeRequests = (reqs: InspectionRequest[]) => {
                const created: InspectionRequest[] = [];
                const inspected: InspectionRequest[] = [];
                const noted: InspectionRequest[] = [];
                const multipleSectionsArr: InspectionRequest[] = [];
                const allUnique = new Map<string, InspectionRequest>();
                let totalSectionsInspected = 0;
                let multipleSectionsCount = 0;

                reqs.forEach(r => {
                    let involved = false;

                    // 1. Created (محاسب / منشئ الطلب)
                    if (person.type === 'employee' && r.employee_id === person.id) {
                        created.push(r);
                        involved = true;
                    }

                    // 2. Inspected (الفاحص / الفني)
                    let sectionsInspectedInThisReq = 0;
                    if (r.technician_assignments) {
                        Object.values(r.technician_assignments).forEach(techList => {
                            if (techList.includes(person.id)) {
                                sectionsInspectedInThisReq++;
                            }
                        });
                    }

                    if (sectionsInspectedInThisReq > 0) {
                        inspected.push(r);
                        totalSectionsInspected += sectionsInspectedInThisReq;
                        if (sectionsInspectedInThisReq > 1) {
                            multipleSectionsCount++;
                            multipleSectionsArr.push(r);
                        }
                        involved = true;
                    }

                    // 3. Noted (مدخل البيانات / كاتب الملاحظات أو من عدل بنود)
                    let wroteNote = false;
                    
                    // Check activity logs
                    if (r.activity_log?.some(log => log.employeeId === person.id && (
                        log.action.includes('ملاحظة') || 
                        log.action.includes('فحص') || 
                        log.action.includes('صوتي') || 
                        log.action.includes('حفظ مؤقت')
                    ))) {
                        wroteNote = true;
                    }

                    if (!wroteNote && r.general_notes?.some(n => n.authorId === person.id || (n.authorName === person.name && person.type === 'employee'))) {
                        wroteNote = true;
                    }
                    if (!wroteNote && r.category_notes) {
                        wroteNote = Object.values(r.category_notes).flat().some(n => n.authorId === person.id || (n.authorName === person.name && person.type === 'employee'));
                    }
                    if (wroteNote) {
                        noted.push(r);
                        involved = true;
                    }

                    if (involved) {
                        allUnique.set(r.id, r);
                    }
                });

                return {
                    created,
                    inspected,
                    noted,
                    createdCount: created.length,
                    inspectedCount: totalSectionsInspected,
                    inspectedCarsCount: inspected.length,
                    multipleSectionsCount: multipleSectionsCount,
                    multipleSections: multipleSectionsArr,
                    notedCount: noted.length,
                    allUnique: Array.from(allUnique.values())
                };
            };

            const currentAnalysis = analyzeRequests(currentRequests);
            const prevAnalysis = analyzeRequests(prevRequests);

            const personCurrentReqs = currentAnalysis.allUnique;
            const personPrevReqs = prevAnalysis.allUnique;

            // Growth Calculation based on allUnique length
            const growthPercent = personPrevReqs.length > 0 
                ? Math.round(((personCurrentReqs.length - personPrevReqs.length) / personPrevReqs.length) * 100)
                : (personCurrentReqs.length > 0 ? 100 : 0);

            return {
                id: person.id,
                name: person.name,
                type: person.type,
                role: person.title || (person.role === 'employee' ? 'موظف' : person.role) || 'فني',
                requestCount: personCurrentReqs.length,
                createdCount: currentAnalysis.createdCount,
                inspectedCount: currentAnalysis.inspectedCount,
                inspectedCarsCount: currentAnalysis.inspectedCarsCount,
                multipleSectionsCount: currentAnalysis.multipleSectionsCount,
                notedCount: currentAnalysis.notedCount,
                createdRequests: currentAnalysis.created,
                inspectedRequests: currentAnalysis.inspected,
                multipleSectionsRequests: currentAnalysis.multipleSections,
                notedRequests: currentAnalysis.noted,
                prevRequestCount: personPrevReqs.length,
                growth: growthPercent,
                associatedRequests: personCurrentReqs
            };
        });

        // 1. Filter by Type
        if (viewFilter === 'creators') {
            processedStats = processedStats.filter(p => p.createdCount > 0);
        } else if (viewFilter === 'noters') {
            processedStats = processedStats.filter(p => p.notedCount > 0);
        } else if (viewFilter === 'inspectors') {
            processedStats = processedStats.filter(p => p.inspectedCount > 0);
        }

        // 2. Sort
        processedStats.sort((a, b) => {
            const getSortValue = (stat: any) => {
                if (viewFilter === 'creators') return stat.createdCount;
                if (viewFilter === 'noters') return stat.notedCount;
                if (viewFilter === 'inspectors') return stat.inspectedCount;
                return stat.requestCount;
            };

            if (sortOrder === 'most_active') return getSortValue(b) - getSortValue(a);
            if (sortOrder === 'least_active') return getSortValue(a) - getSortValue(b);
            if (sortOrder === 'name') return a.name.localeCompare(b.name);
            return 0;
        });

        return processedStats;

    }, [employees, technicians, requests, viewFilter, sortOrder, startDate, endDate]);

    const topCreatorsData = useMemo(() => {
        return [...stats].sort((a,b) => b.createdCount - a.createdCount).slice(0, 5).filter(s => s.createdCount > 0).map((s, i) => ({
            name: s.name,
            count: s.createdCount,
            color: 'bg-blue-500'
        }));
    }, [stats]);

    const topNotersData = useMemo(() => {
        return [...stats].sort((a,b) => b.notedCount - a.notedCount).slice(0, 5).filter(s => s.notedCount > 0).map((s, i) => ({
            name: s.name,
            count: s.notedCount,
            color: 'bg-purple-500'
        }));
    }, [stats]);

    const topInspectorsData = useMemo(() => {
        return [...stats].sort((a,b) => b.inspectedCount - a.inspectedCount).slice(0, 5).filter(s => s.inspectedCount > 0).map((s, i) => ({
            name: s.name,
            count: s.inspectedCount,
            color: 'bg-orange-500'
        }));
    }, [stats]);

    const topPerformer = stats.length > 0 && (sortOrder === 'most_active') ? stats[0] : null; 
    const totalRequestsInPeriod = stats.reduce((sum, s) => sum + s.requestCount, 0);

    const topCreator = useMemo(() => [...stats].sort((a,b) => b.createdCount - a.createdCount).find(s => s.createdCount > 0) || null, [stats]);
    const topNoter = useMemo(() => [...stats].sort((a,b) => b.notedCount - a.notedCount).find(s => s.notedCount > 0) || null, [stats]);
    
    const topInspectorsPerRole = useMemo(() => {
        const start = startDate ? new Date(startDate) : new Date(0);
        if (!isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
        
        const end = endDate ? new Date(endDate) : new Date();
        if (!isNaN(end.getTime())) end.setHours(23, 59, 59, 999);

        const activeRequests = dateFilterType === 'today' ? requests : serverRequests;

        const currentRequests = activeRequests.filter(r => {
            if (!r.created_at) return false;
            const d = new Date(r.created_at);
            return !isNaN(d.getTime()) && d >= start && d <= end;
        });

        // Map technician assignments to categories
        const techCategoryCounts: Record<string, Record<string, number>> = {}; // categoryName -> { techId -> count }

        currentRequests.forEach(r => {
            if (r.technician_assignments) {
                Object.entries(r.technician_assignments).forEach(([catId, techIds]) => {
                    const cat = customFindingCategories.find(c => c.id === catId);
                    const catName = cat ? cat.name : (catId === 'general' ? 'عام' : catId);
                    
                    if (!techCategoryCounts[catName]) techCategoryCounts[catName] = {};
                    
                    techIds.forEach(id => {
                        techCategoryCounts[catName][id] = (techCategoryCounts[catName][id] || 0) + 1;
                    });
                });
            }
        });

        return Object.entries(techCategoryCounts).map(([catName, techCounts]) => {
            const items = Object.entries(techCounts)
                .map(([techId, count]) => {
                    const person = allStaff.find(p => p.id === techId);
                    return {
                        id: techId,
                        name: person ? person.name : 'فني غير معروف',
                        count: count,
                        color: 'bg-orange-500'
                    };
                })
                .sort((a, b) => b.count - a.count);

            return {
                role: catName,
                items
            };
        }).sort((a, b) => (b.items[0]?.count || 0) - (a.items[0]?.count || 0));

    }, [customFindingCategories, requests, serverRequests, startDate, endDate, dateFilterType, allStaff]);

    const groupedCreators = useMemo(() => {
        return [...stats]
            .filter(s => s.createdCount > 0)
            .sort((a, b) => b.createdCount - a.createdCount)
            .map(s => ({
                id: s.id,
                name: s.name,
                count: s.createdCount,
                color: 'bg-blue-500'
            }));
    }, [stats]);

    const groupedNoters = useMemo(() => {
        return [...stats]
            .filter(s => s.notedCount > 0)
            .sort((a, b) => b.notedCount - a.notedCount)
            .map(s => ({
                id: s.id,
                name: s.name,
                count: s.notedCount,
                color: 'bg-purple-500'
            }));
    }, [stats]);

    const groupedMultipleSections = useMemo(() => {
        return [...stats]
            .filter(s => s.multipleSectionsCount > 0)
            .sort((a, b) => b.multipleSectionsCount - a.multipleSectionsCount)
            .map(s => ({
                id: s.id,
                name: s.name,
                count: s.multipleSectionsCount,
                color: 'bg-yellow-500'
            }));
    }, [stats]);

    const handleOpenDetailsById = (id: string, defaultTab?: 'all' | 'created' | 'noted' | 'inspected' | 'multiple_sections') => {
        const personStat = stats.find(s => s.id === id);
        if (personStat) handleOpenDetails(personStat, defaultTab);
    };

    const handleOpenDetails = (personStat: typeof stats[0], defaultTab: 'all' | 'created' | 'noted' | 'inspected' | 'multiple_sections' = 'all') => {
        setSelectedPersonDetails({
            name: personStat.name,
            requests: personStat.associatedRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
            created: personStat.createdRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
            inspected: personStat.inspectedRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
            noted: personStat.notedRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
            multipleSections: personStat.multipleSectionsRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        });
        setDetailsTab(defaultTab);
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
                <div className="flex flex-wrap gap-2 items-center">
                    <button onClick={() => applyDateFilter('today')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${dateFilterType === 'today' ? activeFilterClass : inactiveFilterClass}`}>اليوم</button>
                    <button onClick={() => applyDateFilter('yesterday')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${dateFilterType === 'yesterday' ? activeFilterClass : inactiveFilterClass}`}>أمس</button>
                    <button onClick={() => applyDateFilter('month')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${dateFilterType === 'month' ? activeFilterClass : inactiveFilterClass}`}>هذا الشهر</button>
                    <button onClick={() => applyDateFilter('year')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${dateFilterType === 'year' ? activeFilterClass : inactiveFilterClass}`}>هذه السنة</button>
                    <button onClick={() => setDateFilterType('custom')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${dateFilterType === 'custom' ? activeFilterClass : inactiveFilterClass}`}>نطاق مخصص</button>
                    {isLoadingServer && (
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mr-2 text-xs font-bold animate-pulse">
                            <Icon name="loader" className="w-4 h-4 animate-spin" />
                            <span>جاري عرض البيانات...</span>
                        </div>
                    )}
                </div>

                {dateFilterType === 'custom' && (
                    <div className="flex flex-col md:flex-row gap-4 items-end animate-fade-in">
                        <div className="w-full md:w-auto">
                            <label className="block text-xs font-bold text-slate-500 mb-1">من تاريخ</label>
                            <CustomDatePicker 
                                value={startDate} 
                                onChange={setStartDate} 
                                className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="من تاريخ"
                                maxDate={endDate ? new Date(endDate) : undefined}
                            />
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="block text-xs font-bold text-slate-500 mb-1">إلى تاريخ</label>
                            <CustomDatePicker 
                                value={endDate} 
                                onChange={setEndDate} 
                                className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-600 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="إلى تاريخ"
                                minDate={startDate ? new Date(startDate) : undefined}
                            />
                        </div>
                        <div className="w-full md:w-auto">
                            <button 
                                onClick={() => fetchDataForRange(startDate, endDate)} 
                                disabled={isLoadingServer || !startDate || !endDate}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors w-full md:w-auto"
                            >
                                {isLoadingServer ? 'جاري البحث...' : 'بحث'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Top Stats & Charts */}
            <div className="flex flex-col gap-6">
                {/* Simplified Summary Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-lg text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                            <BriefcaseIcon className="w-8 h-8"/>
                        </div>
                        <div>
                            <p className="text-blue-100 text-xs font-bold mb-1">إجمالي التفاعلات في هذه الفترة</p>
                            <h2 className="text-3xl font-bold font-numeric">{totalRequestsInPeriod} <span className="text-sm font-normal opacity-80">نشاط سجل</span></h2>
                        </div>
                    </div>
                    {topPerformer && (
                        <div className="flex items-center gap-3 bg-black/10 p-3 rounded-xl border border-white/10">
                            <div className="text-right">
                                <p className="text-blue-100 text-[10px] font-bold">الموظف الأكثر نشاطاً</p>
                                <p className="font-bold text-sm">{topPerformer.name}</p>
                            </div>
                            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-yellow-900 shadow-lg animate-pulse">
                                <Icon name="award" className="w-5 h-5"/>
                            </div>
                        </div>
                    )}
                </div>

                {/* Categorized Performance Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Creators */}
                    <CategoryRankCard 
                        title="منشئو الطلبات"
                        icon={<Icon name="plus-circle" className="w-4 h-4"/>}
                        items={groupedCreators}
                        onItemClick={(id) => handleOpenDetailsById(id, 'created')}
                        accentColor="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                        unit="طلب"
                    />

                    {/* Data Entry / Noters */}
                    <CategoryRankCard 
                        title="مدخلو البيانات"
                        icon={<Icon name="edit-3" className="w-4 h-4"/>}
                        items={groupedNoters}
                        onItemClick={(id) => handleOpenDetailsById(id, 'noted')}
                        accentColor="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
                        unit="ملاحظة"
                    />

                    {/* Multiple Sections Participations */}
                    <CategoryRankCard 
                        title="المشاركات المتعددة بالطلب (قسمين فأكثر)"
                        icon={<Icon name="layers" className="w-4 h-4"/>}
                        items={groupedMultipleSections}
                        onItemClick={(id) => handleOpenDetailsById(id, 'multiple_sections')}
                        accentColor="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                        unit="طلب"
                    />

                    {/* Inspectors by Role */}
                    {topInspectorsPerRole.map((cat, idx) => (
                        <CategoryRankCard 
                            key={cat.role}
                            title={`أبرز المنفذين: ${cat.role === 'general_manager' ? 'مدير عام' : cat.role === 'manager' ? 'مدير' : cat.role === 'receptionist' ? 'استقبال' : cat.role === 'technician' ? 'فني' : cat.role}`}
                            icon={<Icon name="user-check" className="w-4 h-4"/>}
                            items={cat.items}
                            onItemClick={(id) => handleOpenDetailsById(id, 'inspected')}
                            accentColor="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                            unit="فحص"
                        />
                    ))}
                </div>

                {/* Chart Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex flex-col justify-between">
                         <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2 text-xs flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                            أفضل المنشئين للطلبات
                         </h3>
                         {topCreatorsData.length > 0 ? (
                             <PerformanceBarChart data={topCreatorsData} />
                         ) : (
                             <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات</div>
                         )}
                    </div>
                     <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex flex-col justify-between">
                         <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2 text-xs flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                            أفضل الكُتاب والمُدخلين
                         </h3>
                         {topNotersData.length > 0 ? (
                             <PerformanceBarChart data={topNotersData} />
                         ) : (
                             <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات</div>
                         )}
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex flex-col justify-between">
                         <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2 text-xs flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
                            أفضل الفنيين (فحص)
                         </h3>
                         {topInspectorsData.length > 0 ? (
                             <PerformanceBarChart data={topInspectorsData} />
                         ) : (
                             <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">لا يوجد بيانات</div>
                         )}
                    </div>
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
                            <button onClick={() => setViewFilter('creators')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewFilter === 'creators' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>منشئي الطلبات</button>
                            <button onClick={() => setViewFilter('noters')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewFilter === 'noters' ? 'bg-white dark:bg-slate-600 shadow-sm text-purple-600 dark:text-purple-300' : 'text-slate-500 dark:text-slate-400'}`}>كُتاب الملاحظات</button>
                            <button onClick={() => setViewFilter('inspectors')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewFilter === 'inspectors' ? 'bg-white dark:bg-slate-600 shadow-sm text-orange-600 dark:text-orange-300' : 'text-slate-500 dark:text-slate-400'}`}>الفنيين (فحص)</button>
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
                                <th className="px-6 py-3 text-center">إنشاء طلبات</th>
                                <th className="px-6 py-3 text-center">كتابة الملاحظات</th>
                                <th className="px-6 py-3 text-center">أقسام الفحص</th>
                                <th className="px-6 py-3 text-center">إجمالي المشاركات</th>
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
                                        <td className="px-6 py-4 text-center font-bold text-blue-600 font-numeric">{person.createdCount || 0}</td>
                                        <td className="px-6 py-4 text-center font-bold text-purple-600 font-numeric">{person.notedCount || 0}</td>
                                        <td className="px-6 py-4 text-center font-bold text-orange-600 font-numeric">{person.inspectedCount || 0}</td>
                                        <td className="px-6 py-4 text-center font-bold text-slate-700 dark:text-slate-200 font-numeric">{person.requestCount}</td>
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
                                    <td colSpan={8} className="text-center py-8 text-slate-500">لا توجد بيانات للعرض حسب الفلاتر الحالية.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Details Modal */}
            <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title={`مشاركات: ${selectedPersonDetails?.name}`} size="lg">
                <div className="flex flex-col gap-4">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button 
                            onClick={() => setDetailsTab('all')} 
                            className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${detailsTab === 'all' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            الكل ({selectedPersonDetails?.requests.length || 0})
                        </button>
                        <button 
                            onClick={() => setDetailsTab('created')} 
                            className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${detailsTab === 'created' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            تم إنشاؤها ({selectedPersonDetails?.created.length || 0})
                        </button>
                        <button 
                            onClick={() => setDetailsTab('noted')} 
                            className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${detailsTab === 'noted' ? 'bg-white dark:bg-slate-700 shadow text-purple-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            ملاحظات/تعديل ({selectedPersonDetails?.noted.length || 0})
                        </button>
                        <button 
                            onClick={() => setDetailsTab('inspected')} 
                            className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${detailsTab === 'inspected' ? 'bg-white dark:bg-slate-700 shadow text-orange-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            تم فحصها ({selectedPersonDetails?.inspected.length || 0})
                        </button>
                        <button 
                            onClick={() => setDetailsTab('multiple_sections')} 
                            className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${detailsTab === 'multiple_sections' ? 'bg-white dark:bg-slate-700 shadow text-yellow-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            أقسام متعددة ({selectedPersonDetails?.multipleSections.length || 0})
                        </button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {selectedPersonDetails && (detailsTab === 'all' ? selectedPersonDetails.requests : detailsTab === 'created' ? selectedPersonDetails.created : detailsTab === 'noted' ? selectedPersonDetails.noted : detailsTab === 'multiple_sections' ? selectedPersonDetails.multipleSections : selectedPersonDetails.inspected).length > 0 ? (
                            <div className="space-y-2">
                                {(detailsTab === 'all' ? selectedPersonDetails.requests : detailsTab === 'created' ? selectedPersonDetails.created : detailsTab === 'noted' ? selectedPersonDetails.noted : detailsTab === 'multiple_sections' ? selectedPersonDetails.multipleSections : selectedPersonDetails.inspected).map(req => (
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
                </div>
                <div className="mt-4 pt-4 border-t dark:border-slate-700 flex justify-end">
                    <Button variant="secondary" onClick={() => setIsDetailsModalOpen(false)}>إغلاق</Button>
                </div>
            </Modal>
        </div>
    );
};

const Employees: React.FC = () => {
    const { can } = useAppContext();
    
    // Fallback to manage_employees if specific permissions aren't set yet for older instances
    const canViewDirectory = can('view_hr_global_directory') || can('manage_employees');
    const canViewPayroll = can('view_hr_salaries_payrolls') || can('manage_employees');
    const canViewPerformance = can('view_hr_performance_record') || can('manage_employees');

    const defaultTab = canViewDirectory ? 'directory' : (canViewPayroll ? 'payroll' : (canViewPerformance ? 'performance' : 'directory'));
    const [activeTab, setActiveTab] = useState<'directory' | 'payroll' | 'performance'>(defaultTab as any);

    return (
        <div className="container mx-auto pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">شؤون الموظفين</h2>
                
                <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                    {canViewDirectory && (
                        <button 
                            onClick={() => setActiveTab('directory')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'directory' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            الدليل الشامل
                        </button>
                    )}
                    {canViewPayroll && (
                        <button 
                            onClick={() => setActiveTab('payroll')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'payroll' ? 'bg-white dark:bg-slate-600 shadow text-green-600 dark:text-green-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            الرواتب والمسيرات
                        </button>
                    )}
                    {canViewPerformance && (
                        <button 
                            onClick={() => setActiveTab('performance')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'performance' ? 'bg-white dark:bg-slate-600 shadow text-purple-600 dark:text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            سجل الأداء
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-6">
                {(activeTab === 'directory' && canViewDirectory) && <UnifiedDirectory />}
                {(activeTab === 'payroll' && canViewPayroll) && <PayrollManager />}
                {(activeTab === 'performance' && canViewPerformance) && <PerformanceView />}
                {(!canViewDirectory && !canViewPayroll && !canViewPerformance) && (
                    <div className="text-center py-12 text-slate-500 font-bold">
                        ليس لديك الصلاحيات الكافية لعرض محتوى هذه الصفحة.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Employees;
