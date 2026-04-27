
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Employee, Role, Permission, PERMISSIONS } from '../../types';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import UserCircleIcon from '../../components/icons/UserCircleIcon';
import SearchIcon from '../../components/icons/SearchIcon';
import UserXIcon from '../../components/icons/UserXIcon';
import RefreshCwIcon from '../../components/icons/RefreshCwIcon';
import EditIcon from '../../components/icons/EditIcon';
import TrashIcon from '../../components/icons/TrashIcon';
import CheckCircleIcon from '../../components/icons/CheckCircleIcon';
import DollarSignIcon from '../../components/icons/DollarSignIcon'; // Import Dollar Icon
import EmployeeFinancialsModal from '../../components/EmployeeFinancialsModal'; // Import the new modal

const roleNames: Record<Role, string> = {
    general_manager: 'مدير عام',
    manager: 'مدير',
    employee: 'فني / موظف',
    receptionist: 'موظف استقبال',
};

const defaultPermissionsByRole: Record<Role, Permission[]> = {
    general_manager: Object.keys(PERMISSIONS) as Permission[],
    manager: [
        'view_dashboard', 'view_financials', 'manage_clients', 'create_requests', 'view_completed_requests',
        'fill_requests', 'update_requests_data', 'delete_requests', 'view_request_info', 'print_request',
        'view_activity_log', 'view_archive', 'manage_notes', 'manage_findings', 'change_request_status', 'mark_request_complete', 'manage_brokers',
        'add_broker_commission', 'pay_broker_commission',
        'view_login_notifications', 'manage_appearance', 'edit_request_price', 'export_data', 'send_internal_messages', 'process_payment',
        'view_waiting_requests', 'view_car_history_on_create', 'view_requests_list', 
        'view_requests_payment_filters', 'view_requests_date_filters', 'view_requests_price_column', 'view_requests_stats_cards',
        'view_settings',
        'manage_paper_archive', 'manage_revenues', 'manage_expenses', 'delete_whatsapp_messages'
    ],
    // Employee/Technician: No Dashboard, No Financials, No Archive by default.
    employee: ['create_requests', 'fill_requests', 'view_request_info', 'manage_notes', 'manage_findings', 'send_internal_messages', 'mark_request_complete', 'view_requests_list', 'view_requests_stats_cards', 'view_requests_date_filters'],
    // Receptionist: No Dashboard, No Financials.
    receptionist: ['create_requests', 'manage_clients', 'send_internal_messages', 'process_payment', 'view_waiting_requests', 'manage_reservations', 'view_requests_list', 'add_broker_commission', 'view_requests_payment_filters', 'view_requests_date_filters', 'view_requests_price_column', 'view_requests_stats_cards', 'resend_whatsapp_report']
};

const categorizedPermissions: Record<string, Permission[]> = {
    'صلاحيات العرض والقوائم': ['view_dashboard', 'view_requests_list', 'view_requests_payment_filters', 'view_requests_date_filters', 'view_requests_price_column', 'view_requests_stats_cards', 'view_waiting_requests', 'view_completed_requests', 'manage_reservations', 'view_archive', 'manage_paper_archive', 'manage_clients'],
    'المالية والتقارير': ['view_financials', 'manage_revenues', 'manage_expenses'],
    'الإدارة والإعدادات': ['manage_employees', 'manage_brokers', 'add_broker_commission', 'pay_broker_commission', 'view_settings'],
    'إجراءات الطلبات والعمليات': ['create_requests', 'fill_requests', 'update_requests_data', 'change_request_status', 'mark_request_complete', 'delete_requests', 'print_request', 'view_request_info', 'view_car_history_on_create', 'manage_notes', 'manage_findings', 'view_activity_log', 'resend_whatsapp_report'],
    'إجراءات أخرى وإعدادات تفصيلية': ['send_internal_messages', 'view_login_notifications', 'export_data', 'edit_request_price', 'process_payment', 'delete_expenses', 'delete_whatsapp_messages', 'manage_settings_general', 'manage_settings_technical', 'manage_appearance', 'manage_api_keys']
};

const EmployeesManagement: React.FC = () => {
    const { employees, addEmployee, updateEmployee, deleteEmployee, showConfirmModal, addNotification, authUser, adminChangePassword } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee>>({});
    const [originalEmployee, setOriginalEmployee] = useState<Partial<Employee> | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Financial Modal State
    const [financialModalTarget, setFinancialModalTarget] = useState<Employee | null>(null);
    const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const formInputClasses = "mt-1 block w-full p-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    const isDirty = useMemo(() => {
        if (!isEditing) return true;
        if (!originalEmployee) return false;
        return JSON.stringify(currentEmployee) !== JSON.stringify(originalEmployee);
    }, [currentEmployee, originalEmployee, isEditing]);

    const filteredEmployees = useMemo(() => {
        const rolePriority: Record<string, number> = { general_manager: 1, manager: 2, receptionist: 3, employee: 4 };
        return employees
            .filter(e => {
                const matchesTab = activeTab === 'active' ? e.is_active : !e.is_active;
                const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.email.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesTab && matchesSearch;
            })
            .sort((a, b) => (rolePriority[a.role] || 5) - (rolePriority[b.role] || 5) || a.name.localeCompare(b.name));
    }, [employees, activeTab, searchTerm]);

    const handleAdd = () => {
        const defaultRole: Role = 'employee';
        setCurrentEmployee({ 
            name: '', 
            email: '', 
            role: defaultRole, 
            is_active: true, 
            permissions: defaultPermissionsByRole[defaultRole], 
            salary: 0,
            preferences: { isTechnician: false } 
        });
        setOriginalEmployee(null);
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleEdit = (employee: Employee) => {
        const employeeCopy = JSON.parse(JSON.stringify(employee));
        // Ensure preferences object exists
        if (!employeeCopy.preferences) {
            employeeCopy.preferences = {};
        }
        setCurrentEmployee(employeeCopy);
        setOriginalEmployee(employeeCopy);
        setIsEditing(true);
        setShowPasswordInput(false);
        setNewPassword('');
        setIsModalOpen(true);
    };

    const handleOpenFinancials = (employee: Employee) => {
        setFinancialModalTarget(employee);
        setIsFinancialModalOpen(true);
    };

    const handleToggleStatus = (employee: Employee, newStatus: boolean) => {
        if (employee.id === authUser?.id) {
            addNotification({ title: 'خطأ', message: 'لا يمكنك تغيير حالة حسابك الخاص.', type: 'error' });
            return;
        }

        showConfirmModal({
            title: newStatus ? `تنشيط حساب ${employee.name}` : `تعطيل حساب ${employee.name}`,
            message: newStatus
                ? 'هل أنت متأكد من إعادة تنشيط هذا الحساب؟ سيتمكن الموظف من الدخول للنظام.'
                : 'هل أنت متأكد من تعطيل هذا الحساب؟ لن يتمكن الموظف من الدخول.',
            onConfirm: async () => {
                try {
                    await updateEmployee({ id: employee.id, is_active: newStatus });
                    addNotification({ title: 'نجاح', message: newStatus ? 'تم تنشيط الحساب.' : 'تم تعطيل الحساب.', type: 'success' });
                } catch (error: any) {
                    addNotification({ title: 'خطأ', message: `فشل العملية: ${error.message}`, type: 'error' });
                }
            }
        });
    };

    const handleDelete = (employee: Employee) => {
        if (employee.id === authUser?.id) {
            addNotification({ title: 'خطأ', message: 'لا يمكنك حذف حسابك الخاص.', type: 'error' });
            return;
        }
        showConfirmModal({
            title: `حذف حساب ${employee.name} نهائياً`,
            message: 'تحذير: سيتم حذف بيانات الدخول والملف الشخصي للموظف نهائياً. يفضل استخدام "التعطيل" بدلاً من الحذف للاحتفاظ بالسجلات.',
            icon: 'warning',
            onConfirm: async () => {
                try {
                    await deleteEmployee(employee.id);
                    addNotification({ title: 'نجاح', message: 'تم حذف الحساب نهائياً.', type: 'success' });
                } catch (error: any) {
                    addNotification({ title: 'خطأ', message: `فشل العملية: ${error.message}`, type: 'error' });
                }
            }
        });
    };

    const handlePermissionChange = (permission: Permission) => {
        setCurrentEmployee(prev => {
            const currentPermissions = prev.permissions || [];
            const newPermissions = currentPermissions.includes(permission) ? currentPermissions.filter(p => p !== permission) : [...currentPermissions, permission];
            return { ...prev, permissions: newPermissions };
        });
    };
    
    // New handler for preferences changes
    const handleIsTechnicianChange = (isTech: boolean) => {
        setCurrentEmployee(prev => ({
            ...prev,
            preferences: {
                ...prev.preferences,
                isTechnician: isTech
            }
        }));
    };

    const handleGroupToggle = (permissionsInGroup: Permission[]) => {
        setCurrentEmployee(prev => {
            const currentPermissions = prev.permissions || [];
            const allSelected = permissionsInGroup.every(p => currentPermissions.includes(p));
            let newPermissions: Permission[];
            if (allSelected) newPermissions = currentPermissions.filter(p => !permissionsInGroup.includes(p));
            else newPermissions = [...currentPermissions, ...permissionsInGroup.filter(p => !currentPermissions.includes(p))];
            return { ...prev, permissions: newPermissions };
        });
    };

    const handleRoleChange = (newRole: Role) => {
        setCurrentEmployee(prev => ({ ...prev, role: newRole, permissions: defaultPermissionsByRole[newRole] || [] }));
    };

    const handleSave = async () => {
        if (!currentEmployee.name?.trim() || !currentEmployee.email?.trim()) {
            addNotification({ title: 'خطأ', message: 'الرجاء إدخال البيانات المطلوبة.', type: 'error' });
            return;
        }
        setIsSubmitting(true);
        try {
            // Prepare data with correct structure for saving
            // isTechnician is inside preferences
            const employeeData = { ...currentEmployee } as Employee;
            
            if (isEditing) {
                await updateEmployee(employeeData);
                if (newPassword.trim() && currentEmployee.id && authUser?.role === 'general_manager') {
                    await adminChangePassword(currentEmployee.id, newPassword);
                }
                addNotification({ title: 'نجاح', message: 'تم التحديث بنجاح.', type: 'success' });
            } else {
                // When creating, we need to ensure the preferences are passed in the body
                const newEmployeeData = {
                    ...currentEmployee,
                    // Ensure preferences are included
                    preferences: currentEmployee.preferences
                } as Omit<Employee, 'id'>;
                
                const newEmployee = await addEmployee(newEmployeeData);
                if (newEmployee) addNotification({ title: 'نجاح', message: `تمت الإضافة. كلمة المرور: ${newEmployee.password}`, type: 'success' });
            }
            setIsModalOpen(false);
        } catch (error: any) {
            addNotification({ title: 'خطأ', message: error.message || 'فشل الحفظ.', type: 'error' });
        } finally { setIsSubmitting(false); }
    };

    const RoleBadge = ({ role }: { role: Role }) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${role === 'general_manager' ? 'bg-purple-100 text-purple-700' :
                role === 'manager' ? 'bg-blue-100 text-blue-700' :
                    role === 'receptionist' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
            }`}>
            {roleNames[role]}
        </span>
    );

    const StatusBadge = ({ active }: { active: boolean }) => (
        <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className={`text-[10px] font-bold ${active ? 'text-green-700' : 'text-red-700'}`}>{active ? 'نشط' : 'معطل'}</span>
        </div>
    );

    return (
        <div className="animate-fade-in space-y-4">

            {/* Header / Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button onClick={() => setActiveTab('active')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}>نشط</button>
                        <button onClick={() => setActiveTab('inactive')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'inactive' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}>معطل</button>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-grow sm:w-64">
                        <SearchIcon className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="بحث عن موظف..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs focus:ring-2 focus:ring-blue-500/20 transition-all" />
                    </div>
                    <Button onClick={handleAdd} size="sm" className="rounded-xl px-4"><Icon name="add" className="w-4 h-4" /><span className="hidden sm:inline ms-1">إضافة</span></Button>
                </div>
            </div>

            {/* Content: Cards on Mobile, Table on Desktop */}
            {isMobile ? (
                <div className="grid grid-cols-1 gap-3">
                    {filteredEmployees.length > 0 ? filteredEmployees.map(emp => (
                        <div key={emp.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-inner ${emp.is_active ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-slate-400'}`}>{emp.name.charAt(0)}</div>
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{emp.name}</h4>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            <RoleBadge role={emp.role} />
                                            <StatusBadge active={emp.is_active} />
                                        </div>
                                    </div>
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">الراتب</p>
                                    <p className="text-xs font-bold text-green-600">{emp.salary?.toLocaleString() || 0} ريال</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <button onClick={() => handleOpenFinancials(emp)} className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl transition-colors hover:bg-green-100"><DollarSignIcon className="w-3.5 h-3.5" />مالية</button>
                                <button onClick={() => handleEdit(emp)} className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl transition-colors hover:bg-blue-100"><EditIcon className="w-3.5 h-3.5" />تعديل</button>
                                {emp.is_active ? (
                                    <button onClick={() => handleToggleStatus(emp, false)} className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl transition-colors hover:bg-red-100"><UserXIcon className="w-3.5 h-3.5" />تعطيل الحساب</button>
                                ) : (
                                    <>
                                        <button onClick={() => handleToggleStatus(emp, true)} className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl transition-colors hover:bg-emerald-100"><CheckCircleIcon className="w-3.5 h-3.5" />تنشيط</button>
                                        <button onClick={() => handleDelete(emp)} className="flex items-center justify-center gap-1.5 py-2 px-3 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl transition-colors hover:bg-slate-200" title="حذف نهائي"><TrashIcon className="w-3.5 h-3.5" /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    )) : <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">لا توجد بيانات موظفين.</div>}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">الموظف</th>
                                <th className="px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">الدور</th>
                                <th className="px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">الراتب</th>
                                <th className="px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">الحالة</th>
                                <th className="px-5 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-left">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-sm ${emp.is_active ? 'bg-blue-600' : 'bg-slate-400'}`}>{emp.name.charAt(0)}</div>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-slate-100">{emp.name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{emp.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4"><RoleBadge role={emp.role} /></td>
                                    <td className="px-5 py-4 font-bold text-slate-700 dark:text-slate-300">{emp.salary?.toLocaleString() || 0} ريال</td>
                                    <td className="px-5 py-4"><StatusBadge active={emp.is_active} /></td>
                                    <td className="px-5 py-4 text-left">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenFinancials(emp)} className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-xl transition-colors" title="الملف المالي"><DollarSignIcon className="w-4 h-4" /></button>
                                            <button onClick={() => handleEdit(emp)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors" title="تعديل"><EditIcon className="w-4 h-4" /></button>
                                            {emp.is_active ? (
                                                <button onClick={() => handleToggleStatus(emp, false)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors" title="تعطيل"><UserXIcon className="w-4 h-4" /></button>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleToggleStatus(emp, true)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-colors" title="تنشيط"><CheckCircleIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(emp)} className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors" title="حذف نهائي"><TrashIcon className="w-4 h-4" /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'تعديل موظف' : 'إضافة موظف'} size="2xl">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold mb-1">الاسم</label><input type="text" value={currentEmployee.name || ''} onChange={e => setCurrentEmployee(p => ({ ...p, name: e.target.value }))} className={formInputClasses} /></div>
                        <div><label className="block text-xs font-bold mb-1">البريد الإلكتروني</label><input type="email" value={currentEmployee.email || ''} onChange={e => setCurrentEmployee(p => ({ ...p, email: e.target.value }))} className={formInputClasses} disabled={isEditing} style={{ direction: 'ltr' }} /></div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold mb-1">الراتب الأساسي</label>
                        <input type="number" value={currentEmployee.salary || 0} onChange={e => setCurrentEmployee(p => ({ ...p, salary: Number(e.target.value) }))} className={formInputClasses} />
                    </div>

                    <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer mt-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={!!currentEmployee.preferences?.isTechnician} 
                                onChange={e => handleIsTechnicianChange(e.target.checked)} 
                                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" 
                            />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">إتاحة هذا الموظف في قائمة الفنيين والمشاركين في الطلب</span>
                        </label>
                         <p className="text-xs text-slate-400 mt-1 mr-8">عند التفعيل، سيظهر اسم الموظف في قائمة "الفنيين" في صفحة تعبئة الطلب، ويمكن إضافته كمنفذ للفحص.</p>
                    </div>

                    {isEditing && showPasswordInput && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/30 animate-fade-in">
                            <label className="block text-xs font-bold mb-1 text-yellow-800 dark:text-yellow-200">تعيين كلمة مرور جديدة</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className={formInputClasses}
                                placeholder="اتركه فارغاً إذا لم ترد التغيير"
                                style={{ direction: 'ltr' }}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold mb-1">الدور الوظيفي</label>
                        <select value={currentEmployee.role} onChange={e => handleRoleChange(e.target.value as Role)} className={formInputClasses}>
                            <option value="employee">فني / موظف</option>
                            <option value="receptionist">موظف استقبال</option>
                            <option value="manager">مدير</option>
                            <option value="general_manager">مدير عام</option>
                        </select>
                    </div>
                    {currentEmployee.role !== 'general_manager' && (
                        <div className="pt-2">
                            <label className="block text-sm font-bold mb-2">الصلاحيات</label>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {Object.entries(categorizedPermissions).map(([group, perms]) => (
                                    <div key={group} className="border dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50">
                                        <div className="flex justify-between items-center mb-2 border-b dark:border-slate-700 pb-1">
                                            <h5 className="font-bold text-[10px] text-slate-500">{group}</h5>
                                            <button onClick={() => handleGroupToggle(perms)} className="text-[10px] text-blue-600 hover:underline">تعديل الكل</button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                            {perms.map(p => (
                                                <label key={p} className="flex items-center gap-2 cursor-pointer py-0.5">
                                                    <input type="checkbox" checked={currentEmployee.permissions?.includes(p)} onChange={() => handlePermissionChange(p)} className="rounded text-blue-600" />
                                                    <span className="text-[11px] dark:text-slate-300">{PERMISSIONS[p]}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-center pt-6 mt-4 border-t dark:border-slate-700">
                    <div>
                        {isEditing && !showPasswordInput && (
                            <button onClick={() => setShowPasswordInput(true)} className="text-xs text-blue-600 hover:underline">تغيير كلمة المرور</button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSave} disabled={isSubmitting || (isEditing && !isDirty && !newPassword)}>{isSubmitting ? 'جاري الحفظ...' : 'حفظ'}</Button>
                    </div>
                </div>
            </Modal>

            {financialModalTarget && (
                <EmployeeFinancialsModal
                    isOpen={isFinancialModalOpen}
                    onClose={() => setIsFinancialModalOpen(false)}
                    target={financialModalTarget}
                    type="employee"
                    selectedMonth={new Date().getMonth() + 1}
                    selectedYear={new Date().getFullYear()}
                />
            )}
        </div>
    );
};

export default EmployeesManagement;
