import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

const WhatsAppSettings: React.FC = () => {
    const { settings, updateSettings, addNotification, setWhatsappApiStatus, checkWhatsAppStatus } = useAppContext();
    const [isTesting, setIsTesting] = useState(false);
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [showTestMessage, setShowTestMessage] = useState(false);

    const handleModeChange = async (mode: 'manual' | 'api') => {
        await updateSettings({ whatsappMode: mode });
        if (mode === 'api') {
            checkWhatsAppStatus();
        }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        updateSettings({ whatsappApiUrl: url });
    };

    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const key = e.target.value;
        updateSettings({ whatsappApiKey: key });
    };

    const testConnection = async () => {
        if (!settings.whatsappApiUrl) {
            addNotification({ title: 'خطأ', message: 'يرجى إدخال رابط الخادم أولاً', type: 'error' });
            return;
        }

        setIsTesting(true);
        setWhatsappApiStatus('checking');
        try {
            const response = await fetch(`${settings.whatsappApiUrl.replace(/\/$/, '')}/api/status`, {
                headers: {
                    'ngrok-skip-browser-warning': 'true',
                    'Authorization': `Bearer ${settings.whatsappApiKey || ''}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                addNotification({ 
                    title: 'نجاح الاتصال', 
                    message: `الخادم يعمل بشكل صحيح وتم قبول مفتاح المصادقة. الحالة: ${data.status || 'متصل'}`, 
                    type: 'success' 
                });
                setWhatsappApiStatus('connected');
            } else {
                const errorData = await response.json().catch(() => ({}));
                setWhatsappApiStatus('disconnected');
                if (response.status === 401 || response.status === 403) {
                    addNotification({ 
                        title: 'فشل المصادقة', 
                        message: errorData.error || 'مفتاح المصادقة (API Key) غير صحيح. يرجى التأكد من المفتاح في إعدادات السيرفر.', 
                        type: 'error' 
                    });
                } else {
                    addNotification({ title: 'فشل الاتصال', message: errorData.error || `الخادم استجاب برمز خطأ: ${response.status}`, type: 'error' });
                }
            }
        } catch (error) {
            setWhatsappApiStatus('disconnected');
            addNotification({ title: 'فشل الاتصال', message: 'تعذر الوصول إلى الخادم. تأكد من تشغيله ومن صحة الرابط', type: 'error' });
        } finally {
            setIsTesting(false);
        }
    };

    const sendTestMessage = async () => {
        if (!settings.whatsappApiUrl || !testPhone) {
            addNotification({ title: 'خطأ', message: 'يرجى إدخال الرابط ورقم الهاتف للتجربة', type: 'error' });
            return;
        }

        setIsSendingTest(true);
        try {
            let phone = testPhone.replace(/\D/g, '');
            if (phone.startsWith('05')) phone = '966' + phone.substring(1);
            else if (phone.length === 9 && phone.startsWith('5')) phone = '966' + phone;

            const response = await fetch(`${settings.whatsappApiUrl.replace(/\/$/, '')}/api/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                    'Authorization': `Bearer ${settings.whatsappApiKey || ''}`
                },
                body: JSON.stringify({ 
                    phone, 
                    message: `رسالة تجريبية من نظام ${settings.appName}\nتم التحقق من الربط بنجاح! ✅` 
                }),
            });

            if (response.ok) {
                addNotification({ title: 'تم الإرسال', message: 'تم إرسال الرسالة التجريبية بنجاح!', type: 'success' });
                setShowTestMessage(false);
            } else {
                const errorData = await response.json().catch(() => ({}));
                addNotification({ 
                    title: 'فشل الإرسال', 
                    message: errorData.error || 'حدث خطأ أثناء محاولة إرسال الرسالة التجريبية', 
                    type: 'error' 
                });
            }
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'تعذر الاتصال بالسيرفر لإرسال الرسالة', type: 'error' });
        } finally {
            setIsSendingTest(false);
        }
    };

    return (
        <div className="space-y-4 max-w-4xl animate-fade-in">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">إعدادات المراسلة (WhatsApp)</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    قم بضبط طريقة إرسال رسائل الواتساب للعملاء (التقارير، الفواتير، الإشعارات).
                </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">طريقة الإرسال</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div 
                        onClick={() => handleModeChange('manual')}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            settings.whatsappMode === 'manual' || !settings.whatsappMode
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                : 'border-slate-100 dark:border-slate-800 hover:border-blue-300'
                        }`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1.5 rounded-lg ${settings.whatsappMode === 'manual' || !settings.whatsappMode ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Icon name="employee" className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white">الوضع اليدوي</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            يفتح نافذة جديدة في المتصفح لتأكيد الإرسال يدوياً. (آمن وموثوق دائماً)
                        </p>
                    </div>

                    <div 
                        onClick={() => handleModeChange('api')}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            settings.whatsappMode === 'api' 
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                                : 'border-slate-100 dark:border-slate-800 hover:border-green-300'
                        }`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1.5 rounded-lg ${settings.whatsappMode === 'api' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Icon name="sparkles" className="w-4 h-4" />
                            </div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white">الوضع التلقائي</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            يرسل الرسائل بصمت في الخلفية عبر سيرفرك المحلي دون مغادرة البرنامج.
                        </p>
                    </div>
                </div>

                {settings.whatsappMode === 'api' && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                                    رابط الخادم المحلي (Ngrok URL)
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                            <Icon name="whatsapp" className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="url"
                                            value={settings.whatsappApiUrl || ''}
                                            onChange={handleUrlChange}
                                            placeholder="https://xyz.ngrok-free.app"
                                            className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs text-slate-800 dark:text-white dir-ltr text-left"
                                        />
                                    </div>
                                    <Button 
                                        onClick={testConnection} 
                                        disabled={isTesting || !settings.whatsappApiUrl}
                                        variant="secondary"
                                        size="sm"
                                        className="whitespace-nowrap rounded-xl text-[10px]"
                                    >
                                        {isTesting ? 'جاري...' : 'فحص'}
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                                    مفتاح المصادقة (API Key)
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                        <Icon name="lock" className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="password"
                                        value={settings.whatsappApiKey || ''}
                                        onChange={handleApiKeyChange}
                                        placeholder="ws_..."
                                        className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs text-slate-800 dark:text-white dir-ltr text-left"
                                    />
                                </div>
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-400 mt-3 italic">
                            ملاحظة: إذا تعذر الاتصال بهذا الرابط، سيقوم النظام تلقائياً بالتحول للوضع اليدوي كخطة بديلة.
                        </p>

                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button 
                                onClick={() => setShowTestMessage(!showTestMessage)} 
                                className="text-[11px] font-bold text-blue-600 hover:underline"
                            >
                                {showTestMessage ? 'إخفاء تجربة الإرسال' : 'تجربة إرسال رسالة حقيقية'}
                            </button>

                            {showTestMessage && (
                                <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-slide-up">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5">
                                        رقم الهاتف للتجربة (مثال: 05xxxxxxx)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="tel"
                                            value={testPhone}
                                            onChange={(e) => setTestPhone(e.target.value)}
                                            placeholder="05xxxxxxxx"
                                            className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-green-500"
                                        />
                                        <Button 
                                            onClick={sendTestMessage} 
                                            disabled={isSendingTest || !testPhone}
                                            variant="whatsapp"
                                            size="sm"
                                            className="rounded-lg text-[10px]"
                                        >
                                            {isSendingTest ? 'جاري...' : 'إرسال تجربة'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppSettings;
