
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Button from './Button';
import Icon from './Icon';

const InstallPwaBanner: React.FC = () => {
    const { deferredPrompt, installPwa } = useAppContext();
    const [isBannerVisible, setIsBannerVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // 1. Check if app is already installed (Standalone mode)
        const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        setIsStandalone(isStandaloneMode);

        if (isStandaloneMode) {
            setIsBannerVisible(false);
            return;
        }

        // 2. Check if device is iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        // 3. Logic to show banner
        const lastDismissed = localStorage.getItem('pwaInstallDismissed');
        const isDismissedRecently = lastDismissed && (Date.now() - parseInt(lastDismissed, 10) < 24 * 60 * 60 * 1000); // 24 hours

        if (!isDismissedRecently) {
            // Show if Android (deferredPrompt exists) OR if iOS (manual instruction needed)
            if (deferredPrompt || isIosDevice) {
                setIsBannerVisible(true);
            }
        }
    }, [deferredPrompt]);

    const handleDismiss = () => {
        setIsBannerVisible(false);
        localStorage.setItem('pwaInstallDismissed', Date.now().toString());
    };

    if (!isBannerVisible || isStandalone) {
        return null;
    }

    return (
        <div 
            className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-slide-in-up"
            role="dialog"
            aria-labelledby="pwa-install-title"
        >
            <div className="max-w-md mx-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-slate-700 p-4 relative overflow-hidden">
                {/* Decoration */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500"></div>

                <div className="flex items-start gap-4">
                    <button 
                        onClick={handleDismiss}
                        className="absolute top-2 left-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    >
                        <Icon name="close" className="w-4 h-4" />
                    </button>

                    <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-2xl text-blue-600 dark:text-blue-400 flex-shrink-0">
                        {isIOS ? <Icon name="share" className="w-6 h-6" /> : <Icon name="download" className="w-6 h-6" />}
                    </div>
                    
                    <div className="flex-grow pt-1">
                        <h3 id="pwa-install-title" className="font-bold text-slate-900 dark:text-white text-base mb-1">
                            {isIOS ? 'تثبيت على الآيفون' : 'تثبيت التطبيق'}
                        </h3>
                        
                        {isIOS ? (
                            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1 leading-relaxed">
                                <p>لتثبيت التطبيق على جهازك:</p>
                                <div className="flex items-center gap-1.5">
                                    <span>1. اضغط على زر</span>
                                    <span className="inline-flex items-center justify-center p-1 bg-slate-200 dark:bg-slate-700 rounded"><Icon name="upload" className="w-3 h-3" /></span>
                                    <span>(مشاركة) في الأسفل.</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span>2. اختر</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">"إضافة إلى الشاشة الرئيسية"</span>.
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                قم بتثبيت التطبيق للوصول السريع والعمل بدون إنترنت.
                            </p>
                        )}

                        {!isIOS && (
                            <div className="mt-3 flex gap-3">
                                <Button onClick={installPwa} size="sm" className="w-full justify-center shadow-lg shadow-blue-500/20">
                                    تثبيت الآن
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstallPwaBanner;
