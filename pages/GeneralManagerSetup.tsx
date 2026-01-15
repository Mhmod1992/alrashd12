
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Permission, PERMISSIONS, Role } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabaseClient';

const steps = [
    { name: 'ترحيب', icon: 'sparkles' },
    { name: 'بيانات الورشة', icon: 'workshop' },
    { name: 'حساب المدير', icon: 'employee' },
    { name: 'تأكيد', icon: 'check-circle' },
];

const GeneralManagerSetup: React.FC = () => {
    const { addNotification, settings, updateSettings, authUser, fetchAndUpdateSingleRequest } = useAppContext();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        workshopName: settings.appName || '',
        gmName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loginMode, setLoginMode] = useState(false); // Toggle between Sign Up and Login
    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";
    
    // If user is already logged in, pre-fill and allow quick finish
    useEffect(() => {
        if (authUser) {
            setFormData(prev => ({
                ...prev,
                gmName: authUser.name,
                email: authUser.email,
                password: '', 
                confirmPassword: ''
            }));
        }
    }, [authUser]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    // Handle Step 3 Authentication Logic
    const handleAuthAction = async () => {
        setIsSubmitting(true);
        try {
            if (loginMode) {
                // Login
                if (!formData.email.trim() || !formData.password.trim()) {
                    throw new Error('الرجاء إدخال البريد الإلكتروني وكلمة المرور.');
                }
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password
                });
                
                if (error) {
                    if (error.message.includes('Email not confirmed')) {
                        throw new Error('البريد الإلكتروني غير مؤكد. الرجاء الذهاب لـ Supabase -> Authentication وتأكيد المستخدم يدوياً.');
                    }
                    throw error;
                }

                addNotification({ title: 'تم تسجيل الدخول', message: 'تم التحقق من الحساب بنجاح.', type: 'success' });
                setStep(4); // Move to next step on success
            } else {
                // Sign Up
                if (!formData.gmName.trim() || !formData.email.trim() || !formData.password.trim()) {
                    throw new Error('الرجاء تعبئة جميع الحقول.');
                }
                if (formData.password.length < 6) {
                    throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
                }
                if (formData.password !== formData.confirmPassword) {
                    throw new Error('كلمتا المرور غير متطابقتين.');
                }

                const allPermissions: Permission[] = Object.keys(PERMISSIONS) as Permission[];
                const { data, error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            name: formData.gmName,
                            role: 'general_manager',
                            permissions: allPermissions
                        }
                    }
                });

                if (error) {
                    if (error.message.includes('already registered')) {
                        addNotification({ title: 'حساب موجود', message: 'هذا البريد مسجل مسبقاً. يرجى تسجيل الدخول.', type: 'info' });
                        setLoginMode(true); // Switch to login mode
                        return;
                    }
                    throw error;
                }
                
                // Check if session is missing (Email Confirmation Enabled on Supabase)
                if (data.user && !data.session) {
                    addNotification({ 
                        title: 'مطلوب تأكيد البريد', 
                        message: 'تم إنشاء الحساب، ولكن Supabase يطلب تأكيد البريد. يرجى تأكيد المستخدم يدوياً من لوحة التحكم أو تعطيل خيار Confirm Email.', 
                        type: 'warning' 
                    });
                    setLoginMode(true); // Switch to login so they can try after manual confirmation
                    return;
                }
                
                if (data.session) {
                    addNotification({ title: 'تم إنشاء الحساب', message: 'تم إنشاء حساب المدير بنجاح.', type: 'success' });
                    setStep(4);
                }
            }
        } catch (error: any) {
            console.error("Auth error:", error);
            addNotification({ title: 'خطأ', message: error.message || 'فشل المصادقة.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNext = () => {
        if (step === 2 && !formData.workshopName.trim()) {
            addNotification({ title: 'خطأ', message: 'الرجاء إدخال اسم الورشة.', type: 'error'});
            return;
        }
        
        if (step === 3) {
            // If already authenticated, just move on
            if (authUser) {
                setStep(4);
                return;
            }
            // Otherwise, perform auth
            handleAuthAction();
            return;
        }

        setStep(prev => prev + 1);
    };
    
    const handleBack = () => setStep(prev => prev - 1);

    const performFinalSetup = async () => {
        setIsSubmitting(true);
        try {
            // Double check authentication before saving
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('لقد تم تسجيل الخروج. يرجى تسجيل الدخول مرة أخرى في الخطوة السابقة.');
            }

            const newSettings = {
                appName: formData.workshopName,
                setupCompleted: true
            };
            
            await updateSettings(newSettings);
            addNotification({ title: 'أهلاً بك!', message: 'تم إعداد النظام بنجاح.', type: 'success' });
            
            // Force a reload to ensure all contexts update cleanly
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error: any) {
            console.error("Setup settings update error:", error);
            addNotification({ title: 'خطأ', message: error.message || 'فشل حفظ الإعدادات النهائية.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 animate-fade-in p-4" dir="rtl">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-8">
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <ol className="flex items-center w-full">
                            {steps.map((s, index) => {
                                const stepIndex = index + 1;
                                const isCompleted = step > stepIndex;
                                const isCurrent = step === stepIndex;
                                return (
                                    <li key={s.name} className={`flex w-full items-center ${stepIndex < steps.length ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block" : ""} ${isCompleted ? 'after:border-blue-600 dark:after:border-blue-500' : 'after:border-slate-200 dark:after:border-slate-700'}`}>
                                        <div className="flex flex-col items-center justify-center">
                                            <span className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-300 ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-200 dark:ring-blue-900/50' : isCompleted ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                                <Icon name={s.icon as any} className="w-6 h-6" />
                                            </span>
                                            <span className={`mt-2 text-xs font-semibold ${isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>{s.name}</span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>

                    <div className="min-h-[350px]">
                        {step === 1 && (
                            <div className="text-center animate-fade-in">
                                {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" className="w-24 h-24 mx-auto mb-4 object-contain" />}
                                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">أهلاً بك في معالج الإعداد</h1>
                                <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">سنقوم معاً بإعداد التفاصيل الأساسية للورشة {authUser ? 'واستكمال التسجيل' : 'وإنشاء حساب المدير العام'} للبدء.</p>
                                <Button onClick={handleNext} className="mt-8 text-lg px-8 py-3">ابدأ الإعداد</Button>
                            </div>
                        )}
                        
                        {step === 2 && (
                            <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">تفاصيل الورشة</h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-6">هذا هو الاسم الذي سيظهر في رأس التطبيق والتقارير.</p>
                                <div>
                                    <label htmlFor="workshopName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">اسم الورشة</label>
                                    <input id="workshopName" name="workshopName" type="text" value={formData.workshopName} onChange={handleInputChange} required className={formInputClasses} placeholder="مثال: ورشة المستقبل للفحص الفني" />
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                             <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                                    {authUser ? 'حساب المدير (مسجل)' : (loginMode ? 'تسجيل دخول المدير' : 'إنشاء حساب المدير العام')}
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-6">هذا الحساب سيملك جميع الصلاحيات لإدارة النظام.</p>
                                
                                {authUser ? (
                                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg text-center">
                                        <p className="text-green-800 dark:text-green-300 font-semibold">أنت مسجل الدخول بالفعل كـ: {authUser.name}</p>
                                        <p className="text-sm text-green-700 dark:text-green-400 mt-1">يمكنك المتابعة للخطوة التالية لإتمام إعداد النظام.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Toggle Tabs */}
                                        <div className="flex border-b dark:border-slate-700 mb-4">
                                            <button 
                                                className={`flex-1 pb-2 font-semibold ${!loginMode ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                                onClick={() => setLoginMode(false)}
                                            >
                                                إنشاء حساب جديد
                                            </button>
                                            <button 
                                                className={`flex-1 pb-2 font-semibold ${loginMode ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                                onClick={() => setLoginMode(true)}
                                            >
                                                تسجيل الدخول
                                            </button>
                                        </div>

                                        {!loginMode && (
                                            <input name="gmName" type="text" value={formData.gmName} onChange={handleInputChange} required className={formInputClasses} placeholder="الاسم الكامل" />
                                        )}
                                        <input name="email" type="email" value={formData.email} onChange={handleInputChange} required className={formInputClasses} placeholder="البريد الإلكتروني" style={{ direction: 'ltr', textAlign: 'right' }} />
                                        <div className={loginMode ? '' : 'grid grid-cols-2 gap-4'}>
                                            <input name="password" type="password" value={formData.password} onChange={handleInputChange} required className={formInputClasses} placeholder="كلمة المرور" style={{ direction: 'ltr', textAlign: 'right' }}/>
                                            {!loginMode && (
                                                <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleInputChange} required className={formInputClasses} placeholder="تأكيد كلمة المرور" style={{ direction: 'ltr', textAlign: 'right' }}/>
                                            )}
                                        </div>
                                        
                                        {/* Hint about Email Confirmation */}
                                        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                                            <p className="font-bold">تنويه هام:</p>
                                            <p>إذا واجهت خطأ "Email not confirmed"، يرجى الذهاب إلى Supabase Dashboard وتعطيل خيار <strong>Confirm Email</strong> في إعدادات المصادقة (Authentication Providers)، أو تأكيد المستخدم يدوياً من جدول المستخدمين.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {step === 4 && (
                            <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">مراجعة وتأكيد</h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-6">الرجاء مراجعة البيانات قبل الحفظ والبدء.</p>
                                <div className="space-y-4 p-4 border rounded-lg dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
                                    <div className="flex justify-between items-center"><span className="font-semibold text-slate-500">اسم الورشة:</span><span className="font-bold text-slate-800 dark:text-slate-200">{formData.workshopName}</span></div>
                                    <div className="flex justify-between items-center"><span className="font-semibold text-slate-500">حالة الحساب:</span><span className="font-bold text-slate-800 dark:text-slate-200">{authUser ? `مسجل (${authUser.name})` : (loginMode ? 'تسجيل دخول' : 'إنشاء جديد')}</span></div>
                                    <div className="flex justify-between items-center"><span className="font-semibold text-slate-500">البريد الإلكتروني:</span><span className="font-bold text-slate-800 dark:text-slate-200">{formData.email}</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {step > 1 && (
                    <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-700 flex justify-between items-center">
                        <Button variant="secondary" onClick={handleBack} disabled={isSubmitting}>السابق</Button>
                        {step < 4 && (
                            <Button onClick={handleNext} disabled={isSubmitting}>
                                {step === 3 && !authUser ? (loginMode ? 'دخول ومتابعة' : 'إنشاء ومتابعة') : 'التالي'}
                            </Button>
                        )}
                        {step === 4 && <Button onClick={performFinalSetup} disabled={isSubmitting}>{isSubmitting ? 'جاري الحفظ...' : 'تأكيد وإنهاء'}</Button>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeneralManagerSetup;
