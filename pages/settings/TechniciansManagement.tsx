
import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Technician } from '../../types';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import DollarSignIcon from '../../components/icons/DollarSignIcon';
import EmployeeFinancialsModal from '../../components/EmployeeFinancialsModal';

const TechniciansManagement: React.FC = () => {
    const { technicians, addTechnician, updateTechnician, deleteTechnician, showConfirmModal, addNotification } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTechnician, setCurrentTechnician] = useState<Partial<Technician>>({});
    const [isEditing, setIsEditing] = useState(false);
    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    // Financial Modal State
    const [financialModalTarget, setFinancialModalTarget] = useState<Technician | null>(null);
    const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);

    const handleAdd = () => {
        setCurrentTechnician({ name: '', title: '', is_active: true, salary: 0 });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleEdit = (tech: Technician) => {
        setCurrentTechnician(tech);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = (tech: Technician) => {
        showConfirmModal({
            title: `حذف الفني ${tech.name}`,
            message: 'هل أنت متأكد من حذف هذا الفني؟',
            onConfirm: async () => {
                await deleteTechnician(tech.id);
                addNotification({ title: 'نجاح', message: 'تم حذف الفني.', type: 'success' });
            }
        });
    };

    const handleOpenFinancials = (tech: Technician) => {
        setFinancialModalTarget(tech);
        setIsFinancialModalOpen(true);
    };

    const handleSave = async () => {
        if (!currentTechnician.name?.trim()) {
            addNotification({ title: 'خطأ', message: 'الرجاء إدخال اسم الفني.', type: 'error' });
            return;
        }
        if (isEditing) {
            await updateTechnician(currentTechnician as Technician);
            addNotification({ title: 'نجاح', message: 'تم تعديل بيانات الفني.', type: 'success' });
        } else {
            await addTechnician(currentTechnician as Omit<Technician, 'id'>);
            addNotification({ title: 'نجاح', message: 'تمت إضافة الفني.', type: 'success' });
        }
        setIsModalOpen(false);
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">إدارة الفنيين</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        هؤلاء الفنيون يظهرون في التقارير ولكن لا يملكون حسابات دخول للنظام.
                    </p>
                </div>
                <Button onClick={handleAdd} leftIcon={<Icon name="add" />}>إضافة فني</Button>
            </div>
            
            <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm text-right">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th className="px-6 py-3">الاسم</th>
                            <th className="px-6 py-3">المسمى الوظيفي</th>
                            <th className="px-6 py-3">الراتب الأساسي</th>
                            <th className="px-6 py-3">الحالة</th>
                            <th className="px-6 py-3">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {technicians.map(tech => (
                            <tr key={tech.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{tech.name}</td>
                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{tech.title || '-'}</td>
                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 font-numeric">{tech.salary?.toLocaleString('en-US') || 0} ريال</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs ${tech.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {tech.is_active ? 'نشط' : 'غير نشط'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 flex gap-2">
                                    <Button size="sm" onClick={() => handleOpenFinancials(tech)} className="bg-green-600 hover:bg-green-700 text-white"><DollarSignIcon className="w-4 h-4"/></Button>
                                    <Button size="sm" variant="secondary" onClick={() => handleEdit(tech)}><Icon name="edit" className="w-4 h-4"/></Button>
                                    <Button size="sm" variant="danger" onClick={() => handleDelete(tech)}><Icon name="delete" className="w-4 h-4"/></Button>
                                </td>
                            </tr>
                        ))}
                        {technicians.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                    لا يوجد فنيين مضافين.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'تعديل فني' : 'إضافة فني'}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">الاسم</label>
                        <input type="text" value={currentTechnician.name || ''} onChange={e => setCurrentTechnician(p => ({...p, name: e.target.value}))} className={formInputClasses} placeholder="اسم الفني" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">المسمى الوظيفي</label>
                        <input type="text" value={currentTechnician.title || ''} onChange={e => setCurrentTechnician(p => ({...p, title: e.target.value}))} className={formInputClasses} placeholder="مثال: فني ميكانيك، فاحص بودي" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">الراتب الأساسي</label>
                        <input type="number" value={currentTechnician.salary || 0} onChange={e => setCurrentTechnician(p => ({...p, salary: Number(e.target.value)}))} className={formInputClasses} />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={currentTechnician.is_active} onChange={e => setCurrentTechnician(p => ({...p, is_active: e.target.checked}))} className="rounded text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">نشط (يظهر في القوائم)</span>
                        </label>
                    </div>
                </div>
                <div className="flex justify-end pt-6 border-t mt-6 dark:border-gray-700 gap-2">
                    <Button variant="secondary" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
                    <Button onClick={handleSave}>حفظ</Button>
                </div>
            </Modal>

             {financialModalTarget && (
                <EmployeeFinancialsModal 
                    isOpen={isFinancialModalOpen}
                    onClose={() => setIsFinancialModalOpen(false)}
                    target={financialModalTarget}
                    type="technician"
                />
            )}
        </div>
    );
};

export default TechniciansManagement;
