






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
        <div className="animate-fade-in space-y-8">
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg flex items-start gap-3">
                <Icon name="sparkles" className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm">تفضيلات شخصية</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                        الإعدادات في هذه الصفحة خاصة بحسابك فقط. تغيير التصميم أو الخلفية هنا لن يؤثر على باقي الموظفين أو على شكل التقرير المطبوع.
                    </p>
                </div>
            </div>

            <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">اختيار تصميم البرنامج</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">اختر المظهر الذي تفضله للتطبيق.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(Object.keys(designs) as Array<'aero' | 'classic' | 'glass'>).map(designKey => {
                        const designInfo = designs[designKey];
                        const isActive = currentDesign === designKey;
                        const activeClasses = isActive ? (designKey === 'classic' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30' : designKey === 'glass' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30') : 'border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-500';
                        const activeIconColor = isActive ? (designKey === 'classic' ? 'text-teal-500' : designKey === 'glass' ? 'text-indigo-500' : 'text-blue-500') : '';

                        return (
                            <div key={designKey} onClick={() => handleThemeChange(designKey)} className={`p-6 border-2 rounded-lg cursor-pointer transition-all duration-200 ${activeClasses}`}>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">{designInfo.name}</h4>
                                    {isActive && <Icon name="check-circle" className={`w-6 h-6 ${activeIconColor}`} />}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 h-10">{designInfo.description}</p>
                                <div className="flex gap-2">
                                    {designInfo.colors.map(color => <div key={color} className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600" style={{ backgroundColor: color }} />)}
                                </div>
                                {designKey === 'glass' && isActive && (
                                    <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-800/50 animate-fade-in">
                                        <label htmlFor="intensity-slider" className="font-semibold text-gray-700 dark:text-gray-300 mb-2 block">مستوى الشفافية</label>
                                        <input id="intensity-slider" type="range" min="1" max="10" value={localSettings.glassmorphismIntensity} onChange={e => setLocalSettings(p => ({...p, glassmorphismIntensity: Number(e.target.value)}))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1"><span>أقل</span><span>أكثر</span></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-6 border-2 border-dashed rounded-lg dark:border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">تخصيص الواجهة</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Component Styles */}
                    <div className="space-y-6">
                        <div>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">نمط الشريط الجانبي</h4>
                            <div className="flex gap-2">
                                <label className={`relative flex-1 p-3 border rounded-lg cursor-pointer text-center ${currentSidebarStyle === 'default' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'dark:border-slate-600'}`}>
                                    <input type="radio" name="sidebarStyle" value="default" checked={currentSidebarStyle === 'default'} onChange={() => setLocalSettings(p => ({...p, sidebarStyle: 'default'}))} className="sr-only" />
                                    افتراضي
                                </label>
                                <label className={`relative flex-1 p-3 border rounded-lg cursor-pointer text-center ${currentSidebarStyle === 'minimal' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'dark:border-slate-600'}`}>
                                    <input type="radio" name="sidebarStyle" value="minimal" checked={currentSidebarStyle === 'minimal'} onChange={() => setLocalSettings(p => ({...p, sidebarStyle: 'minimal'}))} className="sr-only" />
                                    بسيط (بدون فاصل)
                                </label>
                            </div>
                        </div>
                         <div>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">نمط الشريط العلوي</h4>
                            <div className="flex gap-2">
                                <label className={`relative flex-1 p-3 border rounded-lg cursor-pointer text-center ${currentHeaderStyle === 'default' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'dark:border-slate-600'}`}>
                                    <input type="radio" name="headerStyle" value="default" checked={currentHeaderStyle === 'default'} onChange={() => setLocalSettings(p => ({...p, headerStyle: 'default'}))} className="sr-only" />
                                    افتراضي
                                </label>
                                <label className={`relative flex-1 p-3 border rounded-lg cursor-pointer text-center ${currentHeaderStyle === 'elevated' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'dark:border-slate-600'}`}>
                                    <input type="radio" name="headerStyle" value="elevated" checked={currentHeaderStyle === 'elevated'} onChange={() => setLocalSettings(p => ({...p, headerStyle: 'elevated'}))} className="sr-only" />
                                    مرتفع (ظل أكبر)
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Background Settings */}
                    <div className="space-y-6">
                        <div>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">صورة الخلفية</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">سيتم إخفاء الخلفية المتحركة عند اختيار صورة أو لون.</p>
                            <div className="flex items-center gap-4">
                                <label className={`cursor-pointer bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors font-semibold ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundChange} disabled={isUploading} />
                                    {isUploading ? 'جاري الرفع...' : 'رفع صورة'}
                                </label>
                                {localSettings.backgroundImageUrl && <Button variant="danger" size="sm" onClick={() => setLocalSettings(p => ({...p, backgroundImageUrl: null}))} disabled={isUploading}>إزالة الصورة</Button>}
                            </div>
                            {localSettings.backgroundImageUrl && <img src={localSettings.backgroundImageUrl} alt="معاينة الخلفية" className="w-48 h-28 object-cover rounded-md border-2 border-white dark:border-slate-500 shadow-md mt-4" />}
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">لون الخلفية</h4>
                            <div className="flex items-center gap-4">
                                <input type="color" value={localSettings.backgroundColor || '#ffffff'} onChange={e => handleBackgroundColorChange(e.target.value)} className="w-12 h-12 p-1 border-2 border-gray-300 dark:border-slate-600 rounded-md cursor-pointer"/>
                                {localSettings.backgroundColor && <Button variant="danger" size="sm" onClick={() => setLocalSettings(p => ({...p, backgroundColor: null}))}>إزالة اللون</Button>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end pt-4 mt-6 border-t dark:border-slate-700">
                <Button onClick={handleSave} leftIcon={<Icon name="save" className="w-5 h-5"/>} disabled={isUploading}>حفظ التغييرات</Button>
            </div>
        </div>
    );
};

export default AppearanceSettings;