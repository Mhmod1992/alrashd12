
import React from 'react';
import { useAppContext } from '../context/AppContext';
import Button from '../components/Button';
import LogOutIcon from '../components/icons/LogOutIcon';
import UserXIcon from '../components/icons/UserXIcon';

const InactiveAccount: React.FC = () => {
    const { logout } = useAppContext();

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4">
            <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center animate-fade-in">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <UserXIcon className="h-10 w-10 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    حسابك غير مفعل
                </h1>
                <p className="mt-4 text-slate-600 dark:text-slate-400">
                    لقد تم إنشاء حسابك بنجاح، ولكنه بانتظار التفعيل من قبل المسؤول. يرجى التواصل مع مدير النظام لمنحك الصلاحيات اللازمة للوصول.
                </p>
                <Button onClick={logout} className="mt-8 w-full" leftIcon={<LogOutIcon className="w-5 h-5" />}>
                    تسجيل الخروج
                </Button>
            </div>
        </div>
    );
};

export default InactiveAccount;
