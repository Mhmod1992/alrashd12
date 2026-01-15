
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Button from './Button';
import Icon from './Icon';

const InstallPwaBanner: React.FC = () => {
    const { deferredPrompt, installPwa } = useAppContext();
    const [isBannerVisible, setIsBannerVisible] = useState(false);

    useEffect(() => {
        // Show banner if deferredPrompt is available AND not dismissed recently
        if (deferredPrompt) {
            const lastDismissed = localStorage.getItem('pwaInstallDismissed');
            if (lastDismissed) {
                const oneDay = 24 * 60 * 60 * 1000;
                if (Date.now() - parseInt(lastDismissed, 10) < oneDay) {
                    return;
                }
            }
            setIsBannerVisible(true);
        } else {
            setIsBannerVisible(false);
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
            <div className="max-w-3xl mx-auto bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
                        <Icon name="download" className="w-6 h-6" />
                    </div>
                    <div className="flex-grow">
                        <h3 id="pwa-install-title" className="font-bold text-slate-800 dark:text-slate-200">
                            ثبّت التطبيق على جهازك
                        </h3>
                        <p id="pwa-install-description" className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            للوصول السريع، والأداء الأفضل، والحفاظ على تسجيل الدخول.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
                    <Button onClick={installPwa} size="sm" className="w-full sm:w-auto">
                        تثبيت الآن
                    </Button>
                    <Button onClick={handleDismiss} variant="secondary" size="sm" className="w-auto p-2" aria-label="إغلاق">
                        <Icon name="close" className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default InstallPwaBanner;
