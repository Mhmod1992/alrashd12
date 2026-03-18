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

    const page = history[history.length - 1] || 'dashboard';

    // Sync URL with page state
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const currentPageParam = params.get('page');
        
        if (currentPageParam !== page) {
            params.set('page', page);
            
            // Clear irrelevant parameters based on the new page
            if (page === 'dashboard') {
                params.delete('search');
                params.delete('requestId');
                params.delete('id');
            } else if (page === 'requests' || page === 'waiting-requests') {
                params.delete('requestId');
                params.delete('id');
                // Keep search if it's already there (e.g. deep link to search results)
            } else if (page === 'fill-request' || page === 'print-report') {
                // Solution 2: Clear search when viewing a specific request to avoid interference
                params.delete('search');
            } else {
                // For all other pages, clear everything
                params.delete('search');
                params.delete('requestId');
                params.delete('id');
            }

            const newUrl = `${window.location.pathname}?${params.toString()}`;
            window.history.pushState({ page }, '', newUrl);
        }
    }, [page]);

    // Handle browser back/forward buttons
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state && event.state.page) {
                const newPage = event.state.page as Page;
                setHistory(prev => {
                    if (prev[prev.length - 1] === newPage) return prev;
                    return [...prev, newPage];
                });
            } else {
                // Fallback to URL params if state is missing
                const params = new URLSearchParams(window.location.search);
                const pageParam = params.get('page') as Page | null;
                if (pageParam) {
                    setHistory(prev => {
                        if (prev[prev.length - 1] === pageParam) return prev;
                        return [...prev, pageParam];
                    });
                }
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        localStorage.removeItem('pageHistory');
    }, []);

    const [isFocusMode, setIsFocusMode] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isMailboxOpen, setIsMailboxOpen] = useState(false);

    const [confirmModalState, setConfirmModalState] = useState<ConfirmModalState>({ isOpen: false, title: '', message: '' });
    const showConfirmModal = useCallback((modalState: Omit<ConfirmModalState, 'isOpen'>) => setConfirmModalState({ ...modalState, isOpen: true }), []);
    const hideConfirmModal = useCallback(() => setConfirmModalState(prev => ({ ...prev, isOpen: false })), []);

    const [expandedArchiveCarId, setExpandedArchiveCarId] = useLocalStorage<string | null>('expandedArchiveCarId', () => {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('carId');
        } catch {
            return null;
        }
    });

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
