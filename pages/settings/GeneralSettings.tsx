
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/Button';
import Icon from '../../components/Icon';

const GeneralSettings: React.FC = () => {
  const { settings, updateSettings, addNotification, uploadImage } = useAppContext();
  const [currentSettings, setCurrentSettings] = useState(settings);
  const [isUploading, setIsUploading] = useState(false);
  const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings]);
  
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setIsUploading(true);
        try {
            const publicUrl = await uploadImage(file, 'logos'); 
            setCurrentSettings(prev => ({...prev, logoUrl: publicUrl}));
            addNotification({ title: 'تم الرفع', message: 'تم رفع الشعار بنجاح.', type: 'success' });
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل رفع الصورة.', type: 'error' });
        } finally {
            setIsUploading(false);
        }
    }
  };

  const handleSaveChanges = async () => {
    try {
        await updateSettings({
            appName: currentSettings.appName,
            logoUrl: currentSettings.logoUrl,
            googleMapsLink: currentSettings.googleMapsLink,
            locationUrl: currentSettings.locationUrl,
            allowSignup: currentSettings.allowSignup
        });
        addNotification({ title: 'نجاح', message: 'تم حفظ الإعدادات بنجاح.', type: 'success' });
    } catch (error) {}
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">هوية الورشة</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
            قم بتحديث المعلومات الأساسية التي تظهر في واجهة التطبيق والتقارير المطبوعة.
        </p>

        <div className="space-y-6 max-w-4xl">
          <div>
            <label htmlFor="appName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الورشة</label>
            <input type="text" id="appName" value={currentSettings.appName} onChange={(e) => setCurrentSettings(prev => ({...prev, appName: e.target.value}))} className={formInputClasses} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="locationUrl" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">📍 رابط موقع الورشة</label>
                <input type="text" id="locationUrl" value={currentSettings.locationUrl || ''} onChange={(e) => setCurrentSettings(prev => ({...prev, locationUrl: e.target.value}))} className={formInputClasses} placeholder="https://maps.app.goo.gl/..." dir="ltr" />
              </div>
              <div>
                <label htmlFor="googleMapsLink" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">⭐ رابط تقييم جوجل ماب</label>
                <input type="text" id="googleMapsLink" value={currentSettings.googleMapsLink || ''} onChange={(e) => setCurrentSettings(prev => ({...prev, googleMapsLink: e.target.value}))} className={formInputClasses} placeholder="https://g.page/r/..." dir="ltr" />
              </div>
          </div>
          
           {/* Allow Signup Toggle */}
           <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">إنشاء حسابات جديدة</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">السماح للمستخدمين الجدد بإنشاء حسابات من شاشة تسجيل الدخول.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                      type="checkbox" 
                      checked={currentSettings.allowSignup ?? true} 
                      onChange={(e) => setCurrentSettings(prev => ({...prev, allowSignup: e.target.checked}))} 
                      className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
           </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">شعار الورشة (Logo)</label>
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 overflow-hidden relative shadow-sm">
                {currentSettings.logoUrl ? <img src={currentSettings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">لا يوجد شعار</span>}
                {isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full"></div></div>}
              </div>
              <div className="flex flex-col gap-3">
                  <label htmlFor="logo-upload" className={`cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-colors font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Icon name="upload" className="w-5 h-5"/>
                    <span>{isUploading ? 'جاري الرفع...' : 'رفع شعار جديد'}</span>
                    <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={handleLogoChange} disabled={isUploading} />
                  </label>
                  {currentSettings.logoUrl && (
                      <Button variant="danger" size="sm" onClick={() => setCurrentSettings(prev => ({...prev, logoUrl: null}))}>
                          إزالة الشعار الحالي
                      </Button>
                  )}
                  <p className="text-xs text-gray-500 mt-1">يفضل استخدام صورة بخلفية شفافة (PNG).</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-6 border-t dark:border-gray-700"><Button onClick={handleSaveChanges} leftIcon={<Icon name="save" className="w-5 h-5"/>} disabled={isUploading}>حفظ التغييرات</Button></div>
    </div>
  );
};

export default GeneralSettings;
