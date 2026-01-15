import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Broker } from '../../types';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

const BrokersManagement: React.FC = () => {
    const { brokers, addBroker, updateBroker, deleteBroker, showConfirmModal, addNotification } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentBroker, setCurrentBroker] = useState<Partial<Broker>>({});
    const [isEditing, setIsEditing] = useState(false);
    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    const handleAdd = () => {
        setCurrentBroker({ name: '', default_commission: 0, is_active: true });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleEdit = (broker: Broker) => {
        setCurrentBroker(broker);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = (broker: Broker) => {
        showConfirmModal({
            title: `حذف ${broker.name}`,
            message: 'هل أنت متأكد من حذف هذا السمسار؟',
            onConfirm: async () => {
                await deleteBroker(broker.id);
                addNotification({ title: 'نجاح', message: 'تم حذف السمسار.', type: 'success' });
            }
        });
    };

    const handleSave = async () => {
        if (!currentBroker.name?.trim()) {
            addNotification({ title: 'خطأ', message: 'الرجاء إدخال اسم السمسار.', type: 'error' });
            return;
        }
        if (isEditing) {
            await updateBroker(currentBroker as Broker);
            addNotification({ title: 'نجاح', message: 'تم تعديل السمسار.', type: 'success' });
        } else {
            await addBroker(currentBroker as Omit<Broker, 'id'>);
            addNotification({ title: 'نجاح', message: 'تمت إضافة السمسار.', type: 'success' });
        }
        setIsModalOpen(false);
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">إدارة السماسرة</h3>
                <Button onClick={handleAdd} leftIcon={<Icon name="add" />}>إضافة سمسار</Button>
            </div>
            <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow">
                <table className="w-full text-sm text-right">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th className="px-6 py-3">الاسم</th>
                            <th className="px-6 py-3">العمولة الافتراضية</th>
                            <th className="px-6 py-3">الحالة</th>
                            <th className="px-6 py-3">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {brokers.map(broker => (
                            <tr key={broker.id} className="border-b dark:border-gray-700">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{broker.name}</td>
                                <td className="px-6 py-4">{broker.default_commission} ريال</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs ${broker.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {broker.is_active ? 'نشط' : 'غير نشط'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 flex gap-2">
                                    <Button variant="secondary" onClick={() => handleEdit(broker)}><Icon name="edit" className="w-4 h-4"/></Button>
                                    <Button variant="danger" onClick={() => handleDelete(broker)}><Icon name="delete" className="w-4 h-4"/></Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'تعديل سمسار' : 'إضافة سمسار'}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">الاسم</label>
                        <input type="text" value={currentBroker.name || ''} onChange={e => setCurrentBroker(p => ({...p, name: e.target.value}))} className={formInputClasses} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">العمولة الافتراضية (ريال)</label>
                        <input type="number" value={currentBroker.default_commission || 0} onChange={e => setCurrentBroker(p => ({...p, default_commission: Number(e.target.value)}))} className={formInputClasses} />
                    </div>
                    <div>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={currentBroker.is_active} onChange={e => setCurrentBroker(p => ({...p, is_active: e.target.checked}))} className="rounded" />
                            <span>نشط</span>
                        </label>
                    </div>
                </div>
                <div className="flex justify-end pt-4"><Button onClick={handleSave}>حفظ</Button></div>
            </Modal>
        </div>
    );
};

export default BrokersManagement;