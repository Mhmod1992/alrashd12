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
        <div className="animate-fade-in space-y-8">
            <div>
                <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">إعدادات Gemini API</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    يتطلب استخدام الميزات الذكية في التطبيق، مثل التعرف على لوحات السيارات بالكاميرا، وجود مفتاح Gemini API.
                    قم بلصق مفتاحك هنا ليتم حفظه بشكل مركزي لجميع الموظفين.
                </p>

                <div className="p-6 border rounded-lg dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <h4 className="font-semibold text-lg mb-2 text-slate-800 dark:text-slate-200">المفتاح الحالي</h4>
                    <p className="font-mono text-sm p-3 bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-600 dark:text-slate-300">
                        {maskApiKey(settings.geminiApiKey)}
                    </p>

                    <div className="mt-6">
                        <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            إدخال مفتاح جديد (لصق)
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                             <input
                                id="apiKey"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className={formInputClasses}
                                placeholder="AIza..."
                            />
                            <Button onClick={handleSave} disabled={isSaving || !apiKey.trim()}>
                                {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-sm text-slate-500 dark:text-slate-500">
                    <p>
                        سيتم حفظ المفتاح في قاعدة البيانات وسيتم استخدامه من قبل جميع الموظفين.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ApiSettings;
