






import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import Icon from '../../components/Icon';
import Button from '../../components/Button';

const designs = {
    aero: {
        name: 'Aero',
        description: 'تصميم عصري وحيوي باللون الأزرق.',
        colors: ['#3b82f6', '#1e293b', '#f8fafc', '#64748b'],
    },
    classic: {
        name: 'Classic',
        description: 'التصميم الكلاسيكي باللون الأخضر المائل للزرقة.',
        colors: ['#14b8a6', '#1e293b', '#f8fafc', '#64748b'],
    },
    glass: {
        name: 'Glass',
        description: 'تصميم زجاجي شفاف مع تأثير ضبابي أنيق.',
        colors: ['#6366f1', '#1e293b', '#ffffff33', '#0000001a'],
    }
};

const AppearanceSettings: React.FC = () => {
    const { settings, updateSettings, addNotification, uploadImage } = useAppContext();
    const [localSettings, setLocalSettings] = useState(settings);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleThemeChange = (newDesign: 'aero' | 'classic' | 'glass') => {
        if (newDesign === localSettings.design) return;

        const aeroReportColors = { primaryColor: '#3b82f6', appNameColor: '#2563eb', sectionTitleBackgroundColor: '#e0f2fe', sectionTitleFontColor: '#0369a1', findingsHeaderBackgroundColor: '#2563eb', findingContainerBackgroundColor: '#f8fafc' };
        const classicReportColors = { primaryColor: '#14b8a6', appNameColor: '#0d9488', sectionTitleBackgroundColor: '#f0fdfa', sectionTitleFontColor: '#134e4a', findingsHeaderBackgroundColor: '#0d9488', findingContainerBackgroundColor: '#f0fdfa' };
        const glassReportColors = { primaryColor: '#6366f1', appNameColor: '#4f46e5', sectionTitleBackgroundColor: '#eef2ff', sectionTitleFontColor: '#3730a3', findingsHeaderBackgroundColor: '#4f46e5', findingContainerBackgroundColor: '#eef2ff' };
        
        // NOTE: We no longer update report colors automatically when changing theme here
        // because report settings are global, while design is personal.
        // Users can manually change report colors in the "Report Settings" tab.
        
        setLocalSettings(prev => ({
            ...prev,
            design: newDesign,
        }));
    };

    const handleBackgroundChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            try {
                // Upload to storage instead of converting to Base64
                const publicUrl = await uploadImage(file, 'note_images'); // Using note_images for compatibility
                setLocalSettings(prev => ({...prev, backgroundImageUrl: publicUrl, backgroundColor: null }));
                addNotification({ title: 'تم الرفع', message: 'تم رفع الخلفية بنجاح.', type: 'success' });
            } catch (error) {
                console.error("Background image upload failed:", error);
                addNotification({ title: 'خطأ', message: 'فشل رفع الصورة إلى الخادم.', type: 'error' });
            } finally {
                setIsUploading(false);
            }
        }
    };
    
    const handleBackgroundColorChange = (color: string) => {
        setLocalSettings(prev => ({...prev, backgroundColor: color, backgroundImageUrl: null }));
    };

    const handleSave = async () => {
        try {
            await updateSettings(localSettings);
            addNotification({ title: 'نجاح', message: 'تم حفظ تفضيلات المظهر الشخصية بنجاح!', type: 'success' });
        } catch(e) {
            console.error("Failed to save appearance settings", e);
        }
    };

    const currentDesign = localSettings.design || 'aero';
    const currentSidebarStyle = localSettings.sidebarStyle || 'default';
    const currentHeaderStyle = localSettings.headerStyle || 'default';
    
    return (
        <div className="animate-fade-in space-y-4 pb-20">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded-2xl flex items-start gap-3">
                <Icon name="sparkles" className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 text-xs">تفضيلات شخصية</h4>
                    <p className="text-[10px] text-blue-700 dark:text-blue-400 mt-0.5 leading-relaxed">
                        الإعدادات في هذه الصفحة خاصة بحسابك فقط. تغيير التصميم أو الخلفية هنا لن يؤثر على باقي الموظفين أو على شكل التقرير المطبوع.
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">اختيار تصميم البرنامج</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(Object.keys(designs) as Array<'aero' | 'classic' | 'glass'>).map(designKey => {
                        const designInfo = designs[designKey];
                        const isActive = currentDesign === designKey;
                        const activeClasses = isActive ? (designKey === 'classic' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30' : designKey === 'glass' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30') : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700';
                        const activeIconColor = isActive ? (designKey === 'classic' ? 'text-teal-500' : designKey === 'glass' ? 'text-indigo-500' : 'text-blue-500') : '';

                        return (
                            <div key={designKey} onClick={() => handleThemeChange(designKey)} className={`p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${activeClasses}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">{designInfo.name}</h4>
                                    {isActive && <Icon name="check-circle" className={`w-4 h-4 ${activeIconColor}`} />}
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 h-8 leading-relaxed">{designInfo.description}</p>
                                <div className="flex gap-1.5">
                                    {designInfo.colors.map(color => <div key={color} className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-700" style={{ backgroundColor: color }} />)}
                                </div>
                                {designKey === 'glass' && isActive && (
                                    <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-800/50 animate-fade-in">
                                        <label htmlFor="intensity-slider" className="font-bold text-[10px] text-slate-500 mb-1.5 block">مستوى الشفافية</label>
                                        <input id="intensity-slider" type="range" min="1" max="10" value={localSettings.glassmorphismIntensity} onChange={e => setLocalSettings(p => ({...p, glassmorphismIntensity: Number(e.target.value)}))} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">تخصيص الواجهة</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-500 mb-2">نمط الشريط الجانبي</h4>
                            <div className="flex gap-2">
                                <label className={`relative flex-1 p-2 border-2 rounded-xl cursor-pointer text-center text-xs font-bold transition-all ${currentSidebarStyle === 'default' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-100 dark:border-slate-800 text-slate-500'}`}>
                                    <input type="radio" name="sidebarStyle" value="default" checked={currentSidebarStyle === 'default'} onChange={() => setLocalSettings(p => ({...p, sidebarStyle: 'default'}))} className="sr-only" />
                                    افتراضي
                                </label>
                                <label className={`relative flex-1 p-2 border-2 rounded-xl cursor-pointer text-center text-xs font-bold transition-all ${currentSidebarStyle === 'minimal' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-100 dark:border-slate-800 text-slate-500'}`}>
                                    <input type="radio" name="sidebarStyle" value="minimal" checked={currentSidebarStyle === 'minimal'} onChange={() => setLocalSettings(p => ({...p, sidebarStyle: 'minimal'}))} className="sr-only" />
                                    بسيط
                                </label>
                            </div>
                        </div>
                         <div>
                            <h4 className="text-[11px] font-bold text-slate-500 mb-2">نمط الشريط العلوي</h4>
                            <div className="flex gap-2">
                                <label className={`relative flex-1 p-2 border-2 rounded-xl cursor-pointer text-center text-xs font-bold transition-all ${currentHeaderStyle === 'default' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-100 dark:border-slate-800 text-slate-500'}`}>
                                    <input type="radio" name="headerStyle" value="default" checked={currentHeaderStyle === 'default'} onChange={() => setLocalSettings(p => ({...p, headerStyle: 'default'}))} className="sr-only" />
                                    افتراضي
                                </label>
                                <label className={`relative flex-1 p-2 border-2 rounded-xl cursor-pointer text-center text-xs font-bold transition-all ${currentHeaderStyle === 'elevated' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-100 dark:border-slate-800 text-slate-500'}`}>
                                    <input type="radio" name="headerStyle" value="elevated" checked={currentHeaderStyle === 'elevated'} onChange={() => setLocalSettings(p => ({...p, headerStyle: 'elevated'}))} className="sr-only" />
                                    مرتفع
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-500 mb-2">صورة الخلفية</h4>
                            <div className="flex items-center gap-3">
                                <label className={`cursor-pointer bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors text-xs font-bold ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundChange} disabled={isUploading} />
                                    {isUploading ? 'جاري الرفع...' : 'رفع صورة'}
                                </label>
                                {localSettings.backgroundImageUrl && <button onClick={() => setLocalSettings(p => ({...p, backgroundImageUrl: null}))} className="text-[10px] font-bold text-red-500 hover:underline">إزالة</button>}
                            </div>
                            {localSettings.backgroundImageUrl && <img src={localSettings.backgroundImageUrl} alt="معاينة" className="w-32 h-20 object-cover rounded-xl border-2 border-white dark:border-slate-700 shadow-sm mt-3" />}
                        </div>
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-500 mb-2">لون الخلفية</h4>
                            <div className="flex items-center gap-3">
                                <input type="color" value={localSettings.backgroundColor || '#ffffff'} onChange={e => handleBackgroundColorChange(e.target.value)} className="w-8 h-8 p-0.5 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer bg-white dark:bg-slate-800"/>
                                {localSettings.backgroundColor && <button onClick={() => setLocalSettings(p => ({...p, backgroundColor: null}))} className="text-[10px] font-bold text-red-500 hover:underline">إزالة</button>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-end z-20">
                <Button onClick={handleSave} size="sm" leftIcon={<Icon name="save" className="w-4 h-4"/>} disabled={isUploading} className="rounded-xl px-8">حفظ التغييرات</Button>
            </div>
        </div>
    );
};

export default AppearanceSettings;