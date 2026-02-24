import { useState, useCallback, useEffect } from 'react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { Page, ConfirmModalState } from '../../types';
import { ROOT_PAGES, PARENT_MAP } from '../constants';

export const useNavigationScope = () => {
    const [history, setHistory] = useState<Page[]>(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const pageParam = params.get('page') as Page | null;
            if (pageParam) {
                return [pageParam];
            }

            const item = window.sessionStorage.getItem('pageHistory');
            return item ? JSON.parse(item) : ['dashboard'];
        } catch {
            return ['dashboard'];
        }
    });

    useEffect(() => {
        localStorage.removeItem('pageHistory');
    }, []);

    useEffect(() => {
        try {
            window.sessionStorage.setItem('pageHistory', JSON.stringify(history));
        } catch (e) {
            console.error("Failed to save history to sessionStorage", e);
        }
    }, [history]);

    const page = history[history.length - 1] || 'dashboard';

    const [isFocusMode, setIsFocusMode] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isMailboxOpen, setIsMailboxOpen] = useState(false);

    const [confirmModalState, setConfirmModalState] = useState<ConfirmModalState>({ isOpen: false, title: '', message: '' });
    const showConfirmModal = useCallback((modalState: Omit<ConfirmModalState, 'isOpen'>) => setConfirmModalState({ ...modalState, isOpen: true }), []);
    const hideConfirmModal = useCallback(() => setConfirmModalState(prev => ({ ...prev, isOpen: false })), []);

    const [expandedArchiveCarId, setExpandedArchiveCarId] = useLocalStorage<string | null>('expandedArchiveCarId', null);

    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const installPwa = useCallback(async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
    }, [deferredPrompt]);

    const setPage = useCallback((newPage: Page) => {
        localStorage.setItem('lastActiveTime', Date.now().toString());

        const performPageChange = () => {
            const currentPage = history[history.length - 1];
            if (currentPage === 'archive' && newPage !== 'print-report') {
                setExpandedArchiveCarId(null);
            }

            if (ROOT_PAGES.includes(newPage)) {
                setHistory([newPage]);
            } else {
                setHistory(prev => {
                    if (prev[prev.length - 1] === newPage) return prev;
                    const newHistory = [...prev, newPage];
                    if (newHistory.length > 20) return newHistory.slice(newHistory.length - 20);
                    return newHistory;
                });
            }

            if (newPage !== 'fill-request') {
                setIsFocusMode(false);
            }
        };

        if (hasUnsavedChanges) {
            showConfirmModal({
                title: 'تغييرات غير محفوظة',
                message: 'هل أنت متأكد من مغادرة الصفحة؟ ستفقد أي تغييرات لم يتم حفظها.',
                onConfirm: () => {
                    setHasUnsavedChanges(false);
                    performPageChange();
                }
            });
            return;
        }

        performPageChange();
    }, [setHistory, hasUnsavedChanges, showConfirmModal, history, setExpandedArchiveCarId, setHasUnsavedChanges, setIsFocusMode]);

    const goBack = useCallback(() => {
        localStorage.setItem('lastActiveTime', Date.now().toString());

        const performGoBack = () => {
            if (history.length > 1) {
                setHistory(prev => prev.slice(0, -1));
                const prevPage = history[history.length - 2];
                if (prevPage !== 'fill-request') setIsFocusMode(false);
            } else {
                const currentPage = history[0];
                const parentPage = PARENT_MAP[currentPage];

                if (parentPage) {
                    setPage(parentPage);
                } else {
                    setPage('dashboard');
                }
            }
        };

        if (hasUnsavedChanges) {
            showConfirmModal({
                title: 'تغييرات غير محفوظة',
                message: 'هل أنت متأكد من مغادرة الصفحة؟ ستفقد أي تغييرات لم يتم حفظها.',
                onConfirm: () => {
                    setHasUnsavedChanges(false);
                    performGoBack();
                }
            });
            return;
        }

        performGoBack();
    }, [history, hasUnsavedChanges, showConfirmModal, setHistory, setHasUnsavedChanges, setIsFocusMode, setPage]);

    return {
        page,
        setPage,
        goBack,
        history,
        setHistory,
        isFocusMode,
        setIsFocusMode,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        isMailboxOpen,
        setIsMailboxOpen,
        confirmModalState,
        showConfirmModal,
        hideConfirmModal,
        expandedArchiveCarId,
        setExpandedArchiveCarId,
        deferredPrompt,
        installPwa
    };
};
