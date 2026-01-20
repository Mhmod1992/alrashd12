
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Button from './Button';
import Icon from './Icon';
import XIcon from './icons/XIcon';
import DownloadIcon from './icons/DownloadIcon';

const InstallPwaBanner: React.FC = () => {
    const { deferredPrompt, installPwa } = useAppContext();
    const [isBannerVisible, setIsBannerVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // 1. Check if already installed
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        setIsStandalone(isInStandaloneMode);

        if (isInStandaloneMode) {
            setIsBannerVisible(false);
            return;
        }

        // 2. Check for iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        // 3. Logic to show banner
        const lastDismissed = localStorage.getItem('pwaInstallDismissed');
        const isRecentlyDismissed = lastDismissed && (Date.now() - parseInt(lastDismissed, 10) < 24 * 60 * 60 * 1000);

        if (!isRecentlyDismissed) {
            // Show if we have the prompt (Android/Desktop) OR if it's iOS (since iOS doesn't fire the event)
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
            className="fixed bottom-4 left-4 right-4 z-[101] animate-slide-in-up md:left-auto md:right-4 md:w-96"
            role="dialog"
            aria-labelledby="pwa-install-title"
        >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-blue-100 dark:border-slate-600 p-4 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute -top-10 -left-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
                
                <button 
                    onClick={handleDismiss} 
                    className="absolute top-2 left-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-white/50 dark:bg-slate-700/50 rounded-full"
                >
                    <XIcon className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-4">
                    {/* App Icon */}
                    <div className="flex-shrink-0">
                        <img 
                            src="icon.svg" 
                            alt="App Icon" 
                            className="w-14 h-14 rounded-xl shadow-md object-contain bg-slate-900" 
                        />
                    </div>

                    <div className="flex-1">
                        <h3 id="pwa-install-title" className="font-bold text-slate-900 dark:text-white text-base">
                            تثبيت التطبيق
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {isIOS 
                                ? 'للوصول السريع: اضغط على زر "مشاركة" في المتصفح ثم اختر "إضافة إلى الصفحة الرئيسية".' 
                                : 'قم بتثبيت التطبيق للوصول السريع والعمل دون إنترنت.'}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-4">
                    {isIOS ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg justify-center">
                            <span>اضغط</span>
                            <span className="inline-block px-1"><Icon name="upload" className="w-4 h-4" /></span>
                            <span>ثم "إضافة للشاشة الرئيسية"</span>
                            <span className="inline-block px-1 border border-slate-300 rounded text-[10px]">+</span>
                        </div>
                    ) : (
                        <Button 
                            onClick={installPwa} 
                            className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 py-2.5 font-bold"
                            leftIcon={<DownloadIcon className="w-5 h-5" />}
                        >
                            تثبيت الآن
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InstallPwaBanner;
