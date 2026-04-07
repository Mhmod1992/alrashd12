import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

const WhatsAppSettings: React.FC = () => {
    const { settings, updateSettings, addNotification } = useAppContext();
    const [isTesting, setIsTesting] = useState(false);

    const handleModeChange = (mode: 'manual' | 'api') => {
        updateSettings({ whatsappMode: mode });
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateSettings({ whatsappApiUrl: e.target.value });
    };

    const testConnection = async () => {
        if (!settings.whatsappApiUrl) {
            addNotification({ title: 'خطأ', message: 'يرجى إدخال رابط الخادم أولاً', type: 'error' });
            return;
        }

        setIsTesting(true);
        try {
            const response = await fetch(`${settings.whatsappApiUrl.replace(/\/$/, '')}/api/status`, {
                headers: {
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            if (response.ok) {
                const data = await response.json();
                addNotification({ 
                    title: 'نجاح الاتصال', 
                    message: `الخادم يعمل بشكل صحيح. الحالة: ${data.status || 'متصل'}`, 
                    type: 'success' 
                });
            } else {
                addNotification({ title: 'فشل الاتصال', message: 'الخادم لا يستجيب بشكل صحيح', type: 'error' });
            }
        } catch (error) {
            addNotification({ title: 'فشل الاتصال', message: 'تعذر الوصول إلى الخادم. تأكد من تشغيله ومن صحة الرابط', type: 'error' });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">إعدادات المراسلة (WhatsApp)</h2>
                <p className="text-slate-600 dark:text-slate-400">
                    قم بضبط طريقة إرسال رسائل الواتساب للعملاء (التقارير، الفواتير، الإشعارات).
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">طريقة الإرسال</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div 
                        onClick={() => handleModeChange('manual')}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            settings.whatsappMode === 'manual' || !settings.whatsappMode
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                        }`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${settings.whatsappMode === 'manual' || !settings.whatsappMode ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Icon name="employee" className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-white">الوضع اليدوي (WhatsApp Web)</h4>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            يفتح نافذة جديدة في المتصفح لتأكيد الإرسال يدوياً. (آمن وموثوق دائماً)
                        </p>
                    </div>

                    <div 
                        onClick={() => handleModeChange('api')}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            settings.whatsappMode === 'api' 
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                                : 'border-slate-200 dark:border-slate-700 hover:border-green-300'
                        }`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${settings.whatsappMode === 'api' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Icon name="sparkles" className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-white">الوضع التلقائي (Local API)</h4>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            يرسل الرسائل بصمت في الخلفية عبر سيرفرك المحلي دون مغادرة البرنامج.
                        </p>
                    </div>
                </div>

                {settings.whatsappMode === 'api' && (
                    <div className="mt-6 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            رابط الخادم المحلي (Ngrok URL)
                        </label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                    <Icon name="whatsapp" className="w-5 h-5" />
                                </div>
                                <input
                                    type="url"
                                    value={settings.whatsappApiUrl || ''}
                                    onChange={handleUrlChange}
                                    placeholder="https://xyz.ngrok-free.app"
                                    className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 dark:text-white dir-ltr text-left"
                                />
                            </div>
                            <Button 
                                onClick={testConnection} 
                                disabled={isTesting || !settings.whatsappApiUrl}
                                variant="secondary"
                                className="whitespace-nowrap"
                            >
                                {isTesting ? 'جاري الفحص...' : 'فحص الاتصال'}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            ملاحظة: إذا تعذر الاتصال بهذا الرابط، سيقوم النظام تلقائياً بالتحول للوضع اليدوي كخطة بديلة.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppSettings;
