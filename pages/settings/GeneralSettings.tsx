import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import ImageIcon from '../../components/icons/ImageIcon';
import DownloadIcon from '../../components/icons/DownloadIcon';
import { supabase } from '../../lib/supabaseClient';
import { urlToBase64Safe, uploadImageWithAutoBucket, ensureBucketExists } from '../../lib/storageUtils';
import OperationProgressModal from '../../components/OperationProgressModal';

const GeneralSettings: React.FC = () => {
  const { settings, updateSettings, addNotification, uploadImage } = useAppContext();
  const [currentSettings, setCurrentSettings] = useState(settings);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [progressModal, setProgressModal] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    currentStep: string;
    progress: number;
    totalItems?: number;
    currentItemIndex?: number;
    itemTypeLabel?: string;
    status?: 'in_progress' | 'success' | 'error';
    errorMessage?: string;
  }>({
    isOpen: false,
    title: '',
    currentStep: '',
    progress: 0,
    status: 'in_progress',
  });

  const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings]);

  const handleExportWorkshopSettings = async () => {
    setIsExporting(true);
    setProgressModal({
      isOpen: true,
      title: 'تصدير بيانات وهوية الورشة',
      description: 'يتم الآن تجميع بيانات الورشة والروابط وتضمين الشعار...',
      currentStep: 'جاري جلب بيانات الورشة...',
      progress: 20,
      status: 'in_progress',
    });

    try {
      let logoBase64: string | null = null;
      if (currentSettings.logoUrl) {
        setProgressModal(prev => ({
          ...prev,
          progress: 50,
          currentStep: 'جاري تحويل شعار الورشة إلى صيغة Base64...',
        }));
        logoBase64 = await urlToBase64Safe(currentSettings.logoUrl);
      }

      setProgressModal(prev => ({
        ...prev,
        progress: 85,
        currentStep: 'جاري تجهيز وتنزيل ملف النسخة الاحتياطية...',
      }));

      const exportData = {
        version: '1.0',
        type: 'workshop_settings',
        timestamp: new Date().toISOString(),
        data: {
          appName: currentSettings.appName,
          locationUrl: currentSettings.locationUrl,
          googleMapsLink: currentSettings.googleMapsLink,
          allowSignup: currentSettings.allowSignup,
          enableReviewPrompt: currentSettings.enableReviewPrompt,
          reviewLink: currentSettings.reviewLink,
          reviewMessage: currentSettings.reviewMessage,
          whatsappReviewMode: currentSettings.whatsappReviewMode,
          logoUrl: currentSettings.logoUrl,
          logoBase64: logoBase64
        }
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workshop_settings_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgressModal(prev => ({
        ...prev,
        progress: 100,
        status: 'success',
        currentStep: 'تم تصدير بيانات وهوية الورشة بنجاح!',
      }));

      addNotification({ title: 'تم التصدير', message: 'تم تصدير بيانات الورشة بنجاح.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to export workshop settings:', error);
      setProgressModal(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error?.message || 'حدث خطأ أثناء تصدير بيانات الورشة.',
      }));
      addNotification({ title: 'خطأ', message: 'حدث خطأ أثناء تصدير بيانات الورشة.', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportWorkshopSettings = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setProgressModal({
      isOpen: true,
      title: 'استيراد بيانات وهوية الورشة',
      description: 'يتم الآن استيراد البيانات وتخزين الشعار كصورة حقيقية في السيرفر الجديد...',
      currentStep: 'جاري فحص وتدقيق ملف البيانات...',
      progress: 10,
      status: 'in_progress',
    });

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed.type !== 'workshop_settings' && !parsed.data?.appName) {
        throw new Error('الملف غير صالح أو لا يحتوي على بيانات ورشة متوافقة.');
      }

      const data = parsed.data || parsed;
      let finalLogoUrl = currentSettings.logoUrl;

      // Ensure bucket exists
      setProgressModal(prev => ({
        ...prev,
        progress: 30,
        currentStep: 'جاري تهيئة حاوية تخزين الشعارات (logos)...',
      }));
      await ensureBucketExists('logos');

      // Process Logo: Upload as real image to bucket 'logos'
      const logoSource = data.logoBase64 || data.logoUrl;
      if (logoSource) {
        setProgressModal(prev => ({
          ...prev,
          progress: 55,
          currentStep: 'جاري رفع شعار الورشة كصورة حقيقية إلى حاوية التخزين...',
        }));

        const uploadedLogo = await uploadImageWithAutoBucket(logoSource, 'logos', undefined, `workshop_logo_${Date.now()}`);
        if (uploadedLogo) {
          finalLogoUrl = uploadedLogo;
        } else if (data.logoUrl) {
          finalLogoUrl = data.logoUrl;
        }
      }

      setProgressModal(prev => ({
        ...prev,
        progress: 85,
        currentStep: 'جاري حفظ وتطبيق إعدادات الورشة والروابط...',
      }));

      const updatedData = {
        appName: data.appName || currentSettings.appName,
        logoUrl: finalLogoUrl,
        locationUrl: data.locationUrl ?? currentSettings.locationUrl,
        googleMapsLink: data.googleMapsLink ?? currentSettings.googleMapsLink,
        allowSignup: data.allowSignup ?? currentSettings.allowSignup,
        enableReviewPrompt: data.enableReviewPrompt ?? currentSettings.enableReviewPrompt,
        reviewLink: data.reviewLink ?? currentSettings.reviewLink,
        reviewMessage: data.reviewMessage ?? currentSettings.reviewMessage,
        whatsappReviewMode: data.whatsappReviewMode ?? currentSettings.whatsappReviewMode,
      };

      setCurrentSettings(prev => ({ ...prev, ...updatedData }));
      await updateSettings(updatedData);

      setProgressModal(prev => ({
        ...prev,
        progress: 100,
        status: 'success',
        currentStep: 'تم استيراد بيانات وهوية الورشة والشعار بنجاح!',
      }));

      addNotification({ title: 'تم الاستيراد', message: 'تم استيراد بيانات الورشة والشعار وحفظها بنجاح.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to import workshop settings:', error);
      setProgressModal(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message || 'فشل استيراد بيانات الورشة.',
      }));
      addNotification({ title: 'خطأ', message: error.message || 'فشل استيراد بيانات الورشة.', type: 'error' });
    } finally {
      setIsImporting(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = '';
      }
    }
  };

  
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
            reviewMessage: currentSettings.reviewMessage,
            whatsappReviewMode: currentSettings.whatsappReviewMode
        });
        addNotification({ title: 'نجاح', message: 'تم حفظ الإعدادات بنجاح.', type: 'success' });
    } catch (error) {}
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                    <Icon name="workshop" className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">هوية الورشة وبياناتها</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">الاسم، الشعار، وروابط الخرائط والتقييمات</p>
                </div>
            </div>

            {/* Export and Import Actions */}
            <div className="flex items-center gap-2 flex-wrap">
                <input 
                    type="file" 
                    ref={importFileInputRef} 
                    onChange={handleImportWorkshopSettings} 
                    accept=".json" 
                    className="hidden" 
                />
                <Button 
                    onClick={() => importFileInputRef.current?.click()} 
                    variant="secondary" 
                    size="sm" 
                    disabled={isImporting || isExporting}
                    leftIcon={<Icon name="upload" className="w-4 h-4 text-emerald-600"/>}
                    className="hover:border-emerald-500 hover:text-emerald-600"
                >
                    {isImporting ? 'جاري الاستيراد...' : 'استيراد بيانات الورشة'}
                </Button>
                <Button 
                    onClick={handleExportWorkshopSettings} 
                    variant="secondary" 
                    size="sm" 
                    disabled={isImporting || isExporting}
                    leftIcon={<DownloadIcon className="w-4 h-4 text-blue-600"/>}
                    className="hover:border-blue-500 hover:text-blue-600"
                >
                    {isExporting ? 'جاري التصدير...' : 'تصدير بيانات الورشة'}
                </Button>
            </div>
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
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Icon name="settings" className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">إعدادات النظام والوصول</h3>
        </div>

        <div className="space-y-5">
           {/* Allow Signup Toggle */}
           <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center hover:border-blue-200 dark:hover:border-blue-900/40 transition-colors">
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
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
           </div>

           {/* Review Prompt Settings */}
           <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4 hover:border-blue-200 dark:hover:border-blue-900/40 transition-colors">
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
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
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

                      <div className="pt-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">آلية إرسال طلب التقييم</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setCurrentSettings(prev => ({ ...prev, whatsappReviewMode: 'silent' }))}
                            className={`flex flex-col p-3 rounded-xl border-2 transition-all text-right ${currentSettings.whatsappReviewMode === 'silent' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentSettings.whatsappReviewMode === 'silent' ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                {currentSettings.whatsappReviewMode === 'silent' && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                              </div>
                              <span className={`text-sm font-bold ${currentSettings.whatsappReviewMode === 'silent' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>الإرسال الصامت (Silent)</span>
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">إرسال تلقائي عبر API بدون تدخل.</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCurrentSettings(prev => ({ ...prev, whatsappReviewMode: 'interactive' }))}
                            className={`flex flex-col p-3 rounded-xl border-2 transition-all text-right ${currentSettings.whatsappReviewMode === 'interactive' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentSettings.whatsappReviewMode === 'interactive' ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                {currentSettings.whatsappReviewMode === 'interactive' && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                              </div>
                              <span className={`text-sm font-bold ${currentSettings.whatsappReviewMode === 'interactive' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>وضع التأكيد (Interactive)</span>
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">تظهر نافذة تسأل المستخدم قبل الإرسال.</span>
                          </button>
                        </div>
                      </div>
                  </div>
              )}
           </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Icon name="gallery" className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">الوسائط والشعارات</h3>
        </div>
        <div className="space-y-5">
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

      <OperationProgressModal
          isOpen={progressModal.isOpen}
          title={progressModal.title}
          description={progressModal.description}
          currentStep={progressModal.currentStep}
          progress={progressModal.progress}
          totalItems={progressModal.totalItems}
          currentItemIndex={progressModal.currentItemIndex}
          itemTypeLabel={progressModal.itemTypeLabel}
          status={progressModal.status}
          errorMessage={progressModal.errorMessage}
          onClose={() => setProgressModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default GeneralSettings;
