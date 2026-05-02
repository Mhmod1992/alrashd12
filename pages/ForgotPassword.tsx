
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from '../components/Button';
import { useAppContext } from '../context/AppContext';
import Icon from '../components/Icon';

type Step = 'request' | 'verify' | 'reset';

const ForgotPassword: React.FC = () => {
    const { settings, addNotification } = useAppContext();
    const [step, setStep] = useState<Step>('request');
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [userData, setUserData] = useState<{ name: string; email: string } | null>(null);

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

        setIsLoading(false);
        if (resetError) {
            setError(resetError.message);
        } else {
            addNotification({ title: 'نجاح', message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني', type: 'success' });
            setStep('verify');
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'recovery'
        });

        setIsLoading(false);
        if (verifyError) {
            setError('الرمز غير صحيح أو انتهت صلاحيته.');
        } else if (data.user) {
            setUserData({
                name: data.user.user_metadata?.name || 'مستخدم',
                email: data.user.email || email
            });
            setStep('reset');
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('كلمتا المرور غير متطابقتين.');
            return;
        }

        if (password.length < 6) {
            setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
            return;
        }

        setIsLoading(true);
        const { error: updateError } = await supabase.auth.updateUser({
            password
        });

        setIsLoading(false);
        if (updateError) {
            setError(updateError.message);
        } else {
            addNotification({ title: 'نجاح', message: 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.', type: 'success' });
            
            // Sign out to clear the temporary recovery session
            await supabase.auth.signOut();
            
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
    };

    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-slate-50 dark:bg-slate-900 animate-fade-in relative">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 sm:p-12 border border-slate-100 dark:border-slate-700">
                
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="w-24 h-24 object-contain" />
                        ) : (
                            <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-4xl border-4 border-white shadow-lg">
                                A
                            </div>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        استعادة كلمة المرور
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        نظام مركز الراشد المتكامل
                    </p>
                </div>

                {step === 'request' && (
                    <form onSubmit={handleRequestReset} className="space-y-6">
                        <p className="text-center text-slate-600 dark:text-slate-400 text-sm">
                            أدخل بريدك الإلكتروني المسجل لإرسال رمز التحقق.
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                البريد الإلكتروني
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className={formInputClasses}
                                placeholder="email@example.com"
                                style={{ direction: 'ltr', textAlign: 'right' }}
                            />
                        </div>
                        {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded text-center">{error}</p>}
                        <Button type="submit" className="w-full py-3" disabled={isLoading}>
                            {isLoading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
                        </Button>
                        <div className="text-center mt-6">
                            <button type="button" onClick={() => window.location.href = '/'} className="text-sm font-bold text-slate-500 hover:text-blue-600">
                                العودة لتسجيل الدخول
                            </button>
                        </div>
                    </form>
                )}

                {step === 'verify' && (
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <div className="text-center">
                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">
                                تم إرسال الرمز إلى:
                            </p>
                            <p className="font-bold text-slate-800 dark:text-slate-200" style={{ direction: 'ltr' }}>{email}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                رمز التحقق (OTP)
                            </label>
                            <input
                                type="text"
                                maxLength={8}
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                required
                                className={`${formInputClasses} text-center text-2xl tracking-[0.5em] font-mono`}
                                placeholder="00000000"
                                style={{ direction: 'ltr' }}
                            />
                            <p className="mt-2 text-[10px] text-center text-slate-400">
                                أدخل الرمز المكون من 8 أرقام المستلم في بريدك الإلكتروني.
                            </p>
                        </div>
                        {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded text-center">{error}</p>}
                        <Button type="submit" className="w-full py-3" disabled={isLoading}>
                            {isLoading ? 'جاري التحقق...' : 'التحقق والمتابعة'}
                        </Button>
                        <div className="text-center mt-4">
                            <button type="button" onClick={() => setStep('request')} className="text-sm font-bold text-slate-500 hover:text-blue-600">
                                تغيير البريد الإلكتروني
                            </button>
                        </div>
                    </form>
                )}

                {step === 'reset' && (
                    <div className="animate-fade-in">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-6 border border-blue-100 dark:border-blue-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                                    {userData?.name ? userData.name[0] : 'U'}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                        أهلاً بك، {userData?.name}
                                    </h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        {userData?.email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                                قم بتعيين كلمة مرور جديدة قوية لحسابك.
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">كلمة المرور الجديدة</label>
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    required 
                                    className={formInputClasses} 
                                    placeholder="••••••••" 
                                    style={{ direction: 'ltr', textAlign: 'right' }} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">تأكيد كلمة المرور</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={(e) => setConfirmPassword(e.target.value)} 
                                    required 
                                    className={formInputClasses} 
                                    placeholder="••••••••" 
                                    style={{ direction: 'ltr', textAlign: 'right' }} 
                                />
                            </div>
                            {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded text-center">{error}</p>}
                            <Button type="submit" className="w-full py-3" disabled={isLoading}>
                                {isLoading ? 'جاري الحفظ...' : 'حفظ كلمة المرور الجديدة'}
                            </Button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
