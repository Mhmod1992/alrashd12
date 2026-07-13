import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../context/AppContext';
import Icon from './Icon';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const PrivacyOverlay: React.FC = () => {
    const { settings, authUser } = useAppContext();
    const [isActive, setIsActive] = useState(false);
    const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);
    const isActiveRef = useRef(isActive);

    // Keep the ref in sync with the state
    useEffect(() => {
        isActiveRef.current = isActive;
    }, [isActive]);

    // Handle screen resize
    useEffect(() => {
        const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Handle inactivity logic
    useEffect(() => {
        if (!isLargeScreen || !authUser) {
            if (isActive) setIsActive(false);
            return;
        }

        let timeout: NodeJS.Timeout;

        const resetTimer = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                setIsActive(true);
            }, TIMEOUT_MS);
        };

        const handleActivity = (e: Event) => {
            if (isActiveRef.current) {
                // Prevent the initial click/keydown that dismisses the overlay from triggering other elements
                if (e.type === 'click' || e.type === 'keydown') {
                    e.stopPropagation();
                    setIsActive(false);
                    resetTimer();
                }
            } else {
                resetTimer();
            }
        };

        resetTimer();

        // Use capture phase to intercept events before they reach other elements when active
        window.addEventListener('mousedown', handleActivity, true);
        window.addEventListener('keydown', handleActivity, true);
        window.addEventListener('touchstart', handleActivity, true);

        return () => {
            clearTimeout(timeout);
            window.removeEventListener('mousedown', handleActivity, true);
            window.removeEventListener('keydown', handleActivity, true);
            window.removeEventListener('touchstart', handleActivity, true);
        };
    }, [isLargeScreen, authUser]);

    if (!isLargeScreen || !authUser) return null;

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsActive(true);
                }}
                className="fixed bottom-6 left-6 z-[45] bg-slate-800 text-white dark:bg-slate-700 p-3 rounded-full shadow-xl border border-slate-700 dark:border-slate-600 hover:bg-slate-900 dark:hover:bg-slate-600 transition-all transform hover:scale-105"
                title="قفل الشاشة (وضع الخصوصية)"
            >
                <Icon name="lock" className="w-6 h-6" />
            </button>

            {/* Full Screen Privacy Overlay */}
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/98 dark:bg-slate-950/98 backdrop-blur-md cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsActive(false);
                        }}
                    >
                        <div className="text-center flex flex-col items-center max-w-lg px-4">
                            {settings.logoUrl ? (
                                <img 
                                    src={settings.logoUrl} 
                                    alt={settings.appName} 
                                    className="h-40 w-auto mx-auto mb-8 object-contain drop-shadow-sm"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="w-32 h-32 mx-auto mb-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner">
                                    <Icon name="lock" className="w-16 h-16 text-slate-400" />
                                </div>
                            )}
                            <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mb-8">{settings.appName}</h1>
                            
                            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-6 py-4 rounded-full animate-pulse shadow-inner">
                                <Icon name="lock" className="w-5 h-5" />
                                <span className="text-lg font-medium">تم إخفاء المحتوى - انقر أو اضغط أي مفتاح للمتابعة</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default PrivacyOverlay;
