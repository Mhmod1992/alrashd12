
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
            allowSignup: currentSettings.allowSignup,
            enableReviewPrompt: currentSettings.enableReviewPrompt,
            reviewLink: currentSettings.reviewLink,
            reviewMessage: currentSettings.reviewMessage
        });
        addNotification({ title: 'نجاح', message: 'تم حفظ الإعدادات بنجاح.', type: 'success' });
    } catch (error) {}
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Icon name="workshop" className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">هوية الورشة</h3>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="appName" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">اسم الورشة</label>
            <input type="text" id="appName" value={currentSettings.appName} onChange={(e) => setCurrentSettings(prev => ({...prev, appName: e.target.value}))} className={formInputClasses} />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="locationUrl" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">📍 رابط موقع الورشة</label>
                <input type="text" id="locationUrl" value={currentSettings.locationUrl || ''} onChange={(e) => setCurrentSettings(prev => ({...prev, locationUrl: e.target.value}))} className={formInputClasses} placeholder="https://maps.app.goo.gl/..." dir="ltr" />
              </div>
              <div>
                <label htmlFor="googleMapsLink" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">⭐ رابط تقييم جوجل ماب</label>
                <input type="text" id="googleMapsLink" value={currentSettings.googleMapsLink || ''} onChange={(e) => setCurrentSettings(prev => ({...prev, googleMapsLink: e.target.value}))} className={formInputClasses} placeholder="https://g.page/r/..." dir="ltr" />
              </div>
          </div>
          
           {/* Allow Signup Toggle */}
           <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="max-w-[80%]">
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">إنشاء حسابات جديدة</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">السماح للمستخدمين الجدد بإنشاء حسابات من شاشة تسجيل الدخول.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                      type="checkbox" 
                      checked={currentSettings.allowSignup ?? true} 
                      onChange={(e) => setCurrentSettings(prev => ({...prev, allowSignup: e.target.checked}))} 
                      className="sr-only peer" 
                  />
                  <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
           </div>

           {/* Review Prompt Settings */}
           <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                  <div className="max-w-[80%]">
                      <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">تفعيل نافذة طلب التقييم</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">إرسال رسالة تذكير للتقييم عبر الواتساب عند إكمال الطلب.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                          type="checkbox" 
                          checked={currentSettings.enableReviewPrompt ?? false} 
                          onChange={(e) => setCurrentSettings(prev => ({...prev, enableReviewPrompt: e.target.checked}))} 
                          className="sr-only peer" 
                      />
                      <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                  </label>
              </div>

              {currentSettings.enableReviewPrompt && (
                  <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-fade-in">
                      <div>
                          <label htmlFor="reviewLink" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">🔗 رابط التقييم</label>
                          <input 
                              type="text" 
                              id="reviewLink" 
                              value={currentSettings.reviewLink || ''} 
                              onChange={(e) => setCurrentSettings(prev => ({...prev, reviewLink: e.target.value}))} 
                              className={formInputClasses} 
                              placeholder="https://g.page/r/..." 
                              dir="ltr" 
                          />
                      </div>
                      <div>
                          <label htmlFor="reviewMessage" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">💬 نص رسالة الواتساب</label>
                          <textarea 
                              id="reviewMessage" 
                              value={currentSettings.reviewMessage || "عزيزي العميل، سعدنا بخدمتك في مركزنا. رأيك يهمنا ويساعدنا على التطور، نرجو التكرم بتقييم تجربتك عبر الرابط التالي:\n{review_link}"} 
                              onChange={(e) => setCurrentSettings(prev => ({...prev, reviewMessage: e.target.value}))} 
                              className={`${formInputClasses} min-h-[80px] text-sm resize-y`} 
                              placeholder="اكتب نص الرسالة هنا..."
                          />
                          <p className="text-[10px] text-slate-400 mt-1.5">استخدم <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{`{review_link}`}</code> لإدراج الرابط تلقائياً.</p>
                      </div>
                  </div>
              )}
           </div>

          <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">شعار الورشة (Logo)</label>
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-sm">
                {currentSettings.logoUrl ? <img src={currentSettings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" /> : <span className="text-[10px] text-slate-400">لا يوجد شعار</span>}
                {isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full"></div></div>}
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <label htmlFor="logo-upload" className={`cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-bold text-sm shadow-md flex items-center justify-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Icon name="upload" className="w-4 h-4"/>
                    <span>{isUploading ? 'جاري الرفع...' : 'رفع شعار'}</span>
                    <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={handleLogoChange} disabled={isUploading} />
                  </label>
                  {currentSettings.logoUrl && (
                      <button onClick={() => setCurrentSettings(prev => ({...prev, logoUrl: null}))} className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors py-1">
                          إزالة الشعار الحالي
                      </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end sticky bottom-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm py-4 border-t border-slate-200 dark:border-slate-800">
          <Button onClick={handleSaveChanges} leftIcon={<Icon name="save" className="w-5 h-5"/>} disabled={isUploading} className="shadow-lg shadow-blue-500/20">حفظ الإعدادات</Button>
      </div>
    </div>
  );
};

export default GeneralSettings;
