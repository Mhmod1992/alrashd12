import React, { useState } from 'react';
import Button from '../../components/Button';
import { useAppContext } from '../../context/AppContext';

const ApiSettings: React.FC = () => {
    const { settings, updateSettings, addNotification } = useAppContext();
    const [apiKey, setApiKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!apiKey.trim()) {
            addNotification({
                title: 'خطأ',
                message: 'حقل المفتاح لا يمكن أن يكون فارغاً.',
                type: 'error'
            });
            return;
        }
        setIsSaving(true);
        try {
            await updateSettings({ geminiApiKey: apiKey });
            addNotification({
                title: 'نجاح',
                message: 'تم حفظ مفتاح Gemini API بنجاح.',
                type: 'success'
            });
            setApiKey(''); // Clear input after saving
        } catch (e) {
            console.error("Failed to save API key:", e);
            // Error notification is handled by updateSettings in the context
        } finally {
            setIsSaving(false);
        }
    };

    const maskApiKey = (key: string | null | undefined): string => {
        if (!key || key.length < 8) {
            return 'غير متوفر';
        }
        return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    return (
        <div className="animate-fade-in space-y-4 max-w-2xl">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">إعدادات Gemini API</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    يتطلب استخدام الميزات الذكية في التطبيق، مثل التعرف على لوحات السيارات بالكاميرا، وجود مفتاح Gemini API.
                </p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">المفتاح الحالي</h4>
                    <span className="font-mono text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                        {maskApiKey(settings.geminiApiKey)}
                    </span>
                </div>

                <div className="space-y-2">
                    <label htmlFor="apiKey" className="block text-[11px] font-bold text-slate-500">
                        إدخال مفتاح جديد
                    </label>
                    <div className="flex items-center gap-2">
                         <input
                            id="apiKey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="AIza..."
                        />
                        <Button onClick={handleSave} size="sm" disabled={isSaving || !apiKey.trim()} className="rounded-xl px-6">
                            {isSaving ? 'جاري...' : 'حفظ'}
                        </Button>
                    </div>
                </div>

                <p className="mt-4 text-[10px] text-slate-400 italic">
                    سيتم حفظ المفتاح في قاعدة البيانات وسيتم استخدامه من قبل جميع الموظفين.
                </p>
            </div>
        </div>
    );
};

export default ApiSettings;
