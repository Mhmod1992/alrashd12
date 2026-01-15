
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Button from '../components/Button';
import { supabase } from '../lib/supabaseClient';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';

const Login: React.FC = () => {
    const { login, logout, settings, startSetupProcess, addNotification } = useAppContext();
    const design = settings.design || 'aero';

    // Check if signup is allowed (default true if undefined for backward compatibility)
    const allowSignup = settings.allowSignup !== false;

    const [isSignUp, setIsSignUp] = useState(false);

    // Shared state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Sign up specific state
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showActivationMessage, setShowActivationMessage] = useState(false);

    // Animation States
    const [showSplash, setShowSplash] = useState(true);
    const [splashFading, setSplashFading] = useState(false);

    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    // Handle Animation Sequence
    useEffect(() => {
        // Animation Timeline:
        // 0s - 1.5s: Enter from bottom + Spin
        // 1.5s - 3.5s: Heartbeat Pulse (2 seconds)
        // 3.5s: Start Fade Out
        // 4.5s: Remove from DOM

        // 1. Start fading out the white background
        setTimeout(() => {
            setSplashFading(true);
        }, 3500);

        // 2. Remove splash screen from DOM
        setTimeout(() => {
            setShowSplash(false);
        }, 4500);

        if (sessionStorage.getItem('registration_success') === 'true') {
            setShowActivationMessage(true);
            sessionStorage.removeItem('registration_success');
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (email.trim().toLowerCase() === 'setup@system') {
            startSetupProcess();
            return;
        }

        if (!email || !password) {
            setError('الرجاء إدخال البريد الإلكتروني وكلمة المرور.');
            return;
        }
        setIsLoading(true);
        const result = await login(email, password);
        if (!result.success) {
            setError(result.error || 'فشل تسجيل الدخول.');
            setPassword('');
            setIsLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!allowSignup) {
            setError('إنشاء الحسابات الجديدة غير متاح حالياً.');
            return;
        }

        if (!name || !email || !password || !confirmPassword) {
            setError('الرجاء تعبئة جميع الحقول.');
            return;
        }
        if (password.length < 6) {
            setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
            return;
        }
        if (password !== confirmPassword) {
            setError('كلمتا المرور غير متطابقتين.');
            return;
        }
        setIsLoading(true);

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name: name } }
        });

        if (signUpError) {
            setIsLoading(false);
            if (signUpError.message.includes('already registered')) {
                setError('هذا البريد الإلكتروني مسجل مسبقاً.');
            } else {
                setError(signUpError.message);
            }
        } else if (data.user) {
            await supabase.from('employees').update({
                is_active: false, role: 'employee', permissions: []
            }).eq('id', data.user.id);

            sessionStorage.setItem('registration_success', 'true');
            await logout();
            window.location.reload();
        } else {
            setIsLoading(false);
            setError('فشل إنشاء الحساب. حاول مرة أخرى.');
        }
    };

    const getDecorativePanelClasses = () => {
        switch (design) {
            case 'classic': return 'from-teal-500 to-cyan-600';
            case 'glass': return 'from-indigo-500 to-purple-600';
            default: return 'from-blue-500 to-indigo-600';
        }
    }

    const resetForm = (targetView: 'login' | 'signup') => {
        if (targetView === 'signup' && !allowSignup) return;

        setError(''); setEmail(''); setPassword(''); setName(''); setConfirmPassword('');
        setIsSignUp(targetView === 'signup');
    }

    return (
        <div className="flex items-center justify-center min-h-screen p-4 animate-fade-in overflow-hidden relative">

            {/* --- CINEMATIC WHITE SPLASH SCREEN --- */}
            {showSplash && (
                <div
                    className={`fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center transition-opacity duration-1000 ease-out ${splashFading ? 'opacity-0' : 'opacity-100'}`}
                >
                    <style>{`
                        /* 1. Move from Bottom & Spin */
                        @keyframes enterFromBottomSpin {
                            0% { 
                                transform: translateY(400px) rotateY(0deg) scale(0.3); 
                                opacity: 0; 
                            }
                            40% {
                                opacity: 1;
                            }
                            100% { 
                                transform: translateY(0) rotateY(1440deg) scale(1); 
                                opacity: 1; 
                            }
                        }

                        /* 2. Heartbeat Pulse (No Shadow) */
                        @keyframes heartbeat {
                            0% { transform: scale(1) rotateY(1440deg); }
                            25% { transform: scale(1.15) rotateY(1440deg); }
                            40% { transform: scale(1) rotateY(1440deg); }
                            60% { transform: scale(1.15) rotateY(1440deg); }
                            100% { transform: scale(1) rotateY(1440deg); }
                        }

                        /* 3. Text Reveal */
                        @keyframes textReveal {
                            from { opacity: 0; transform: translateY(20px); }
                            to { opacity: 1; transform: translateY(0); }
                        }

                        .logo-container {
                            /* Combine animations: Enter first (1.5s), then Heartbeat (2s) */
                            animation: 
                                enterFromBottomSpin 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards,
                                heartbeat 2s ease-in-out 1.5s forwards;
                        }

                        .app-name-reveal {
                            animation: textReveal 0.8s ease-out forwards;
                            animation-delay: 1.6s; /* Show text after spin finishes */
                            opacity: 0;
                        }
                    `}</style>

                    <div className="logo-container mb-8">
                        {settings.logoUrl ? (
                            <img
                                src={settings.logoUrl}
                                alt="Logo"
                                className="w-48 h-48 sm:w-64 sm:h-64 object-contain drop-shadow-2xl"
                            />
                        ) : (
                            <div className="w-48 h-48 sm:w-64 sm:h-64 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-6xl sm:text-8xl shadow-2xl border-8 border-white">
                                A
                            </div>
                        )}
                    </div>

                    <h1 className="app-name-reveal text-3xl sm:text-5xl font-black text-slate-800 tracking-tight text-center px-4">
                        {settings.appName}
                    </h1>
                </div>
            )}

            {/* --- MAIN LOGIN CARD --- */}
            <div className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex overflow-hidden">

                {/* Colored Side Panel (Desktop) */}
                <div className={`w-1/2 hidden md:block relative bg-gradient-to-br ${getDecorativePanelClasses()}`}>
                    <div className="absolute inset-0 bg-black/20"></div>
                    <div className="relative z-10 flex flex-col items-center justify-center h-full text-white p-12">

                        {/* Static Logo */}
                        <div className="mb-8 transform hover:scale-105 transition-transform duration-500">
                            {settings.logoUrl ? (
                                <img
                                    src={settings.logoUrl}
                                    alt="Logo"
                                    className="w-64 h-64 object-contain drop-shadow-2xl"
                                />
                            ) : (
                                <div className="w-64 h-64 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white font-bold text-8xl shadow-lg border-4 border-white/50">
                                    A
                                </div>
                            )}
                        </div>

                        <div className="text-center">
                            <h2 className="text-3xl font-bold mt-4 tracking-wide">{settings.appName}</h2>
                            <p className="mt-4 text-blue-100 text-lg font-light leading-relaxed">
                                نظامك المتكامل لإدارة ورشة فحص السيارات باحترافية.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Form Section */}
                <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center bg-white dark:bg-slate-800">
                    {showActivationMessage ? (
                        <div className="text-center animate-fade-in">
                            <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-6" />
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">تم استلام طلبك بنجاح</h2>
                            <p className="mt-4 text-slate-600 dark:text-slate-400">
                                تم إنشاء حسابك وهو الآن قيد المراجعة. سيقوم المدير بتفعيل حسابك قريباً.
                            </p>
                            <Button onClick={() => {
                                setShowActivationMessage(false);
                                resetForm('login');
                            }} className="mt-8 w-full">
                                العودة إلى صفحة تسجيل الدخول
                            </Button>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <div className="text-center md:hidden mb-8">
                                {settings.logoUrl && (
                                    <img
                                        src={settings.logoUrl}
                                        alt="Logo"
                                        className="w-32 h-32 mx-auto mb-6 object-contain"
                                    />
                                )}
                                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                                    {isSignUp ? 'إنشاء حساب' : 'تسجيل الدخول'}
                                </h1>
                            </div>

                            {isSignUp && allowSignup ? (
                                <div className="animate-fade-in">
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 hidden md:block mb-6">إنشاء حساب جديد</h2>
                                    <form onSubmit={handleSignUp} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">الاسم الكامل</label>
                                            <input type="text" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required className={formInputClasses} placeholder="الاسم الكامل" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">البريد الإلكتروني</label>
                                            <input type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={formInputClasses} placeholder="email@example.com" style={{ direction: 'ltr', textAlign: 'right' }} />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">كلمة المرور</label>
                                                <input type="password" name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className={formInputClasses} placeholder="••••••••" style={{ direction: 'ltr', textAlign: 'right' }} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">تأكيد كلمة المرور</label>
                                                <input type="password" name="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={formInputClasses} placeholder="••••••••" style={{ direction: 'ltr', textAlign: 'right' }} />
                                            </div>
                                        </div>

                                        {error && <p className="text-sm text-red-600 dark:text-red-400 text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}

                                        <div>
                                            <Button type="submit" className="w-full text-lg py-3 shadow-lg shadow-blue-500/30" disabled={isLoading}>{isLoading ? 'جاري الإنشاء...' : 'إنشاء حساب'}</Button>
                                        </div>
                                    </form>
                                    <div className="text-center mt-6">
                                        <button onClick={() => resetForm('login')} className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
                                            لديك حساب بالفعل؟ تسجيل الدخول
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-fade-in">
                                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 hidden md:block mb-2">مرحباً بك</h2>
                                    <p className="text-slate-500 dark:text-slate-400 hidden md:block mb-8">سجل الدخول للمتابعة إلى لوحة التحكم.</p>

                                    <form onSubmit={handleLogin} className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                البريد الإلكتروني
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                autoComplete="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                className={formInputClasses}
                                                placeholder="email@example.com"
                                                style={{ direction: 'ltr', textAlign: 'right' }}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                كلمة المرور
                                            </label>
                                            <input
                                                type="password"
                                                name="password"
                                                autoComplete="current-password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                className={formInputClasses}
                                                placeholder="••••••••"
                                                style={{ direction: 'ltr', textAlign: 'right' }}
                                            />
                                        </div>

                                        {error && <p className="text-sm text-red-600 dark:text-red-400 text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}

                                        <div>
                                            <Button type="submit" className="w-full text-lg py-3 shadow-lg shadow-blue-500/30" disabled={isLoading}>
                                                {isLoading ? 'جاري التحقق...' : 'دخول'}
                                            </Button>
                                        </div>
                                    </form>
                                    {allowSignup && (
                                        <div className="text-center mt-8 pt-6 border-t dark:border-slate-700">
                                            <button onClick={() => resetForm('signup')} className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
                                                ليس لديك حساب؟ إنشاء حساب جديد
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
