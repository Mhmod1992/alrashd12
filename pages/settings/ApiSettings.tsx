import React, { useState } from 'react';
import Button from '../../components/Button';
import { useAppContext } from '../../context/AppContext';
import SparklesIcon from '../../components/icons/SparklesIcon';
import CarVisualizerModal from '../../components/CarVisualizerModal';

const ApiSettings: React.FC = () => {
    const { settings, updateSettings, addNotification } = useAppContext();
    const [apiKey, setApiKey] = useState('');
    const [imageApiKey, setImageApiKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingImageKey, setIsSavingImageKey] = useState(false);
    const [isVisualizerModalOpen, setIsVisualizerModalOpen] = useState(false);

    const handleSaveGeminiKey = async () => {
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
            await updateSettings({ geminiApiKey: apiKey.trim() });
            addNotification({
                title: 'نجاح',
                message: 'تم حفظ مفتاح Gemini API بنجاح.',
                type: 'success'
            });
            setApiKey(''); // Clear input after saving
        } catch (e) {
            console.error("Failed to save API key:", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveImageGeneratorKey = async () => {
        if (!imageApiKey.trim()) {
            addNotification({
                title: 'خطأ',
                message: 'حقل مفتاح مولد الصور لا يمكن أن يكون فارغاً.',
                type: 'error'
            });
            return;
        }
        setIsSavingImageKey(true);
        try {
            await updateSettings({ imageGeneratorApiKey: imageApiKey.trim() });
            addNotification({
                title: 'نجاح',
                message: 'تم حفظ مفتاح مولد الصور (Image Generator API Key) بنجاح.',
                type: 'success'
            });
            setImageApiKey(''); // Clear input after saving
        } catch (e) {
            console.error("Failed to save image generator API key:", e);
        } finally {
            setIsSavingImageKey(false);
        }
    };

    const maskApiKey = (key: string | null | undefined): string => {
        if (!key || key.length < 8) {
            return 'غير متوفر';
        }
        return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    return (
        <div className="animate-fade-in space-y-6 max-w-2xl">
            {/* Header info */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">ربط الخدمات والذكاء الاصطناعي (API)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    إدارة مفاتيح الربط الذكية لميزات التعرف على اللوحات، وتحليل التقارير، وتوليد صور ومخططات الهيكل ثلاثية الأبعاد (3D Exploded Views).
                </p>
            </div>

            {/* SECTION 1: Image Generator Key (NEW) */}
            <div className="p-5 bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                            <SparklesIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                                مفتاح مولد صور الهيكل (Image Generator API Key)
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                النموذج المعتمد: <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">gemini-3.1-flash-lite-image</span> (اقتصادي، فائق السرعة، وموفر للحصة)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-500">المفتاح المخصص الحالي</span>
                    <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300 font-medium">
                        {maskApiKey(settings.imageGeneratorApiKey)}
                    </span>
                </div>

                <div className="space-y-2">
                    <label htmlFor="imageApiKey" className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        إدخال مفتاح مخصص لمولد الصور
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            id="imageApiKey"
                            type="password"
                            value={imageApiKey}
                            onChange={(e) => setImageApiKey(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="AIza..."
                        />
                        <Button
                            onClick={handleSaveImageGeneratorKey}
                            size="sm"
                            disabled={isSavingImageKey || !imageApiKey.trim()}
                            className="rounded-xl px-5 font-bold"
                        >
                            {isSavingImageKey ? 'جاري...' : 'حفظ'}
                        </Button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                        * إذا تركت هذا المفتاح فارغاً، سيستخدم النظام مفتاح Gemini الأساسي كخيار احتياطي تلقائياً.
                    </p>
                </div>

                {/* Test & Sandbox Button */}
                <div className="pt-2 border-t border-blue-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        تريد تجربة المحرك وتوليد صورة من تقاريرك الحالية؟
                    </span>
                    <Button
                        onClick={() => setIsVisualizerModalOpen(true)}
                        variant="secondary"
                        size="sm"
                        className="rounded-xl px-4 text-xs font-bold flex items-center gap-1.5 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                    >
                        <SparklesIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>فتح مختبر صور الهيكل 3D</span>
                    </Button>
                </div>
            </div>

            {/* SECTION 2: General Gemini API Key */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                        مفتاح Gemini API الأساسي
                    </h4>
                    <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                        {maskApiKey(settings.geminiApiKey)}
                    </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    يستخدم للميزات الذكية الأخرى: قراءة اللوحات بالكاميرا (OCR)، والتحليل الفني للتقارير والترجمة.
                </p>

                <div className="space-y-2">
                    <label htmlFor="apiKey" className="block text-[11px] font-bold text-slate-500">
                        تحديث مفتاح Gemini API
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
                        <Button
                            onClick={handleSaveGeminiKey}
                            size="sm"
                            disabled={isSaving || !apiKey.trim()}
                            className="rounded-xl px-5 font-bold"
                        >
                            {isSaving ? 'جاري...' : 'حفظ'}
                        </Button>
                    </div>
                </div>

                <p className="text-[10px] text-slate-400 italic">
                    سيتم حفظ المفاتيح بأمان واستخدامها في معالجة طلبات المركز.
                </p>
            </div>

            {/* Visualizer Modal */}
            <CarVisualizerModal
                isOpen={isVisualizerModalOpen}
                onClose={() => setIsVisualizerModalOpen(false)}
            />
        </div>
    );
};

export default ApiSettings;
