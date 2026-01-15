import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { Role } from '../../types';

const Profile: React.FC = () => {
    const { authUser, updateOwnPassword, addNotification } = useAppContext();
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    if (!authUser) {
        return (
            <div className="text-center p-8">
                <p>لا يمكن تحميل بيانات المستخدم. الرجاء تسجيل الدخول مرة أخرى.</p>
            </div>
        );
    }
    
    const getRoleName = (role: Role) => {
        const names: Record<Role, string> = {
            general_manager: 'مدير عام',
            manager: 'مدير',
            employee: 'موظف',
            receptionist: 'موظف استقبال',
        };
        return names[role] || role;
    }

    const handleChangePassword = async () => {
        if (!newPassword || !confirmPassword) {
            addNotification({ title: 'خطأ', message: 'الرجاء إدخال كلمة المرور وتأكيدها.', type: 'error' });
            return;
        }
        if (newPassword.length < 6) {
            addNotification({ title: 'خطأ', message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.', type: 'error' });
            return;
        }
        if (newPassword !== confirmPassword) {
            addNotification({ title: 'خطأ', message: 'كلمتا المرور غير متطابقتين.', type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            await updateOwnPassword(newPassword);
            addNotification({ title: 'نجاح', message: 'تم تغيير كلمة المرور بنجاح.', type: 'success' });
            setIsPasswordModalOpen(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error("Change password error:", error);
            addNotification({ title: 'خطأ', message: error.message || 'فشل تغيير كلمة المرور.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="container mx-auto max-w-2xl animate-fade-in">
            <h2 className="text-3xl font-bold mb-6 text-slate-800 dark:text-slate-200">الملف الشخصي</h2>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg mb-6">
                <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">معلومات الموظف</h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">الاسم:</span>
                        <span className="text-slate-800 dark:text-slate-200">{authUser.name}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">البريد الإلكتروني:</span>
                        <span className="text-slate-800 dark:text-slate-200" style={{direction: 'ltr'}}>{authUser.email}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">الدور الوظيفي:</span>
                        <span className="text-slate-800 dark:text-slate-200">{getRoleName(authUser.role)}</span>
                    </div>
                </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                 <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">إدارة الحساب</h3>
                 <div className="flex items-center justify-between">
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                        يمكنك تغيير كلمة المرور الخاصة بك من هنا.
                    </p>
                    <Button onClick={() => setIsPasswordModalOpen(true)} variant="secondary">
                        تغيير كلمة المرور
                    </Button>
                 </div>
            </div>

            <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="تغيير كلمة المرور" size="md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">كلمة المرور الجديدة</label>
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                            className={formInputClasses}
                            placeholder="••••••"
                            style={{ direction: 'ltr', textAlign: 'right' }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">تأكيد كلمة المرور</label>
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            className={formInputClasses}
                            placeholder="••••••"
                            style={{ direction: 'ltr', textAlign: 'right' }}
                        />
                    </div>
                </div>
                <div className="flex justify-end pt-4 mt-4 border-t dark:border-slate-700 gap-2">
                    <Button variant="secondary" onClick={() => setIsPasswordModalOpen(false)} disabled={isSaving}>إلغاء</Button>
                    <Button onClick={handleChangePassword} disabled={isSaving}>
                        {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default Profile;