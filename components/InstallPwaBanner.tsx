
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
        // Check for iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        // Check if already in standalone mode (installed)
        const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        setIsStandalone(isStandaloneMode);

        // Logic for showing banner
        if (isStandaloneMode) {
             setIsBannerVisible(false);
             return;
        }

        const lastDismissed = localStorage.getItem('pwaInstallDismissed');
        const oneDay = 24 * 60 * 60 * 1000;
        const shouldShow = !lastDismissed || (Date.now() - parseInt(lastDismissed, 10) > oneDay);

        if (shouldShow) {
            // On Android/Desktop, we wait for deferredPrompt.
            // On iOS, deferredPrompt never fires, so we show immediately if it's iOS and not standalone.
            if (deferredPrompt || isIosDevice) {
                setIsBannerVisible(true);
            }
        }
    }, [deferredPrompt]);

    const handleDismiss = () => {
        setIsBannerVisible(false);
        localStorage.setItem('pwaInstallDismissed', Date.now().toString());
    };

    if (!isBannerVisible) {
        return null;
    }

    return (
        <div 
            className="fixed bottom-0 left-0 right-0 z-[101] p-4 animate-slide-in-up"
            role="dialog"
            aria-labelledby="pwa-install-title"
            aria-describedby="pwa-install-description"
        >
            <div className="max-w-3xl mx-auto bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 relative">
                <button 
                    onClick={handleDismiss} 
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    aria-label="إغلاق"
                >
                    <Icon name="close" className="w-5 h-5" />
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-2xl text-blue-600 dark:text-blue-400 flex-shrink-0">
                        <Icon name="download" className="w-8 h-8" />
                    </div>
                    
                    <div className="flex-grow text-center sm:text-right">
                        <h3 id="pwa-install-title" className="font-bold text-slate-800 dark:text-slate-200 text-lg">
                            ثبّت التطبيق على جوالك
                        </h3>
                        <p id="pwa-install-description" className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {isIOS 
                                ? "للتثبيت على iPhone: اضغط على زر المشاركة بالأسفل، ثم اختر 'إضافة إلى الشاشة الرئيسية'." 
                                : "للوصول السريع والأداء الأفضل، قم بتثبيت التطبيق الآن."}
                        </p>
                    </div>

                    <div className="flex-shrink-0 mt-2 sm:mt-0">
                        {isIOS ? (
                            <div className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                                <span>Share</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                <span>&rarr;</span>
                                <span>Add to Home Screen</span>
                            </div>
                        ) : (
                            <Button onClick={installPwa} size="md" className="w-full sm:w-auto shadow-lg shadow-blue-500/20">
                                تثبيت التطبيق
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstallPwaBanner;
