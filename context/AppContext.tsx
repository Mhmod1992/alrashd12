
import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo, useRef } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { supabase, createTemporaryClient } from '../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
    InspectionRequest, Client, Car, CarMake, CarModel, InspectionType,
    Broker, CustomFindingCategory, PredefinedFinding, Settings, Employee,
    SettingsPage, Notification, ConfirmModalState, Permission, Note, Page, AppNotification,
    Expense, Revenue, RequestStatus, ActivityLog, PERMISSIONS, UserPreferences, InternalMessage, Technician,
    FinancialStats, ArchiveResult, PaymentType, PayrollDraft, PayrollItem, Reservation
} from '../types';
import { mockSettings } from '../data/mockData';
import { uuidv4, estimateObjectSize, compressImageToBase64, cleanJsonString } from '../lib/utils';
import { AppContextType, CarHistoryResult } from './types';
import { useNavigationScope } from './scopes/useNavigationScope';
import { useThemeScope } from './scopes/useThemeScope';
import { useDataScope } from './scopes/useDataScope';
import { useActionsScope } from './scopes/useActionsScope';
import { REQUESTS_PAGE_SIZE, INACTIVITY_LIMIT_MS, PERSONAL_SETTING_KEYS, ROOT_PAGES, PARENT_MAP } from './constants';





const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const authUserRef = useRef<Employee | null>(null);
    const realtimeStatusRef = useRef<'connected' | 'connecting' | 'disconnected'>('disconnected');

    const {
        page, setPage, goBack, history, setHistory, isFocusMode, setIsFocusMode,
        hasUnsavedChanges, setHasUnsavedChanges, isMailboxOpen, setIsMailboxOpen,
        confirmModalState, showConfirmModal, hideConfirmModal,
        expandedArchiveCarId, setExpandedArchiveCarId, deferredPrompt, installPwa
    } = useNavigationScope();


    const [isLoading, setIsLoading] = useState(true);
    const [isSessionError, setIsSessionError] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

    const channelRef = useRef<RealtimeChannel | null>(null);
    const notificationsChannelRef = useRef<RealtimeChannel | null>(null);
    const messagesChannelRef = useRef<RealtimeChannel | null>(null);

    const [selectedRequestId, setSelectedRequestId] = useLocalStorage<string | null>('selectedRequestId', null);
    const [selectedClientId, setSelectedClientId] = useLocalStorage<string | null>('selectedClientId', null);
    const [authUser, setAuthUser] = useState<Employee | null>(null);

    const {
        requests, setRequests,
        requestsOffset, setRequestsOffset,
        hasMoreRequests, setHasMoreRequests,
        isLoadingMore, setIsLoadingMore,
        searchedRequests, setSearchedRequests,
        highlightedRequestId, triggerHighlight,
        incomingRequest, setIncomingRequest,
        lastRemoteDeleteId, setLastRemoteDeleteId,
        clients, setClients,
        cars, setCars,
        carMakes, setCarMakes,
        carModels, setCarModels,
        loadedMakesForModels,
        brokers, setBrokers,
        employees, setEmployees,
        technicians, setTechnicians,
        expenses, setExpenses,
        inspectionTypes, setInspectionTypes,
        customFindingCategories, setCustomFindingCategories,
        predefinedFindings, setPredefinedFindings,
        notifications, setNotifications,
        appNotifications, setAppNotifications,
        reservations, setReservations,
        systemLogs, setSystemLogs,
        unreadMessagesCount, setUnreadMessagesCount,
        isRefreshing, setIsRefreshing,
        fetchAllData,
        fetchCarModelsByMake,
        fetchCarMakes,
        ensureEntitiesLoaded,
        createActivityLog,
        addNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead
    } = useDataScope(authUser);

    const {
        updateRequest, updateRequestAndAssociatedData, deleteRequest, deleteRequestsBatch, addRequest,
        ensureLocalClient, addClient, updateClient, deleteClient,
        addCar,
        addInspectionType, updateInspectionType, deleteInspectionType,
        addFindingCategory, updateFindingCategory, deleteFindingCategory,
        addPredefinedFinding, updatePredefinedFinding, deletePredefinedFinding,
        addCarMake, addCarMakesBulk, updateCarMake, deleteCarMake, deleteAllCarMakes, deleteModelsByMakeId, findOrCreateCarMake,
        addCarModel, addCarModelsBulk, updateCarModel, deleteCarModel, findOrCreateCarModel,
        addBroker, updateBroker, deleteBroker,
        addEmployee, updateEmployee, adminChangePassword, deleteEmployee,
        addExpense, updateExpense, deleteExpense,
        addRevenue, deleteRevenue,
        sendInternalMessage, markMessageAsRead,
        addTechnician, updateTechnician, deleteTechnician,
        addReservation, updateReservationStatus, updateReservation, deleteReservation, sendSystemNotification
    } = useActionsScope(
        requests, setRequests, setSearchedRequests, setClients, setCars, setCarMakes, setCarModels,
        setBrokers, employees, setEmployees, setTechnicians, setExpenses, setInspectionTypes,
        setCustomFindingCategories, setPredefinedFindings, setReservations, setUnreadMessagesCount,
        setSystemLogs, authUser, setAuthUser, addNotification, createActivityLog, fetchAllData
    );



    const can = useCallback((permission: Permission): boolean => {
        if (!authUser) return false;
        if (authUser.role === 'general_manager') return true;
        return (authUser.permissions || []).includes(permission);
    }, [authUser]);

    const {
        theme, toggleTheme, themeSetting, setThemeSetting,
        settingsPage, setSettingsPage, settings, setSettings, updateSettings,
        globalSettings, setGlobalSettings, isSetupComplete, setIsSetupComplete
    } = useThemeScope(authUser, setAuthUser, can);
    const [initialRequestModalState, setInitialRequestModalState] = useState<'new' | null>(null);
    const [newRequestSuccessState, setNewRequestSuccessState] = useState<{ isOpen: boolean; requestNumber: number | null; requestId: string | null; }>({ isOpen: false, requestNumber: null, requestId: null });
    const [shouldPrintDraft, setShouldPrintDraft] = useState(false);


    const isManualLogout = useRef(false);

    // Sync refs
    useEffect(() => { authUserRef.current = authUser; }, [authUser]);
    useEffect(() => { realtimeStatusRef.current = realtimeStatus; }, [realtimeStatus]);

    // --- DATABASE USAGE TRACKING ---
    const [currentDbUsage, setCurrentDbUsage] = useState(0);
    const [currentStorageUsage, setCurrentStorageUsage] = useState(0);

    useEffect(() => {
        const totalSize = estimateObjectSize(requests) + estimateObjectSize(clients) + estimateObjectSize(cars);
        setCurrentDbUsage(totalSize);
    }, [requests, clients, cars]);



    // Make logout available - defining it early to be used in effects
    const logout = useCallback(async () => {
        isManualLogout.current = true;

        const performLogout = async () => {
            setHasUnsavedChanges(false);
            try {
                const { error } = await supabase.auth.signOut();
                if (error) {
                    throw error;
                }
            } catch (error: any) {
                console.error("Supabase sign out error:", error);
                addNotification({ title: 'خطأ في الشبكة', message: 'فشل تسجيل الخروج من الخادم. سيتم تسجيل خروجك محلياً.', type: 'warning' });
            } finally {
                setAuthUser(null);
                setHistory(['dashboard']);
                window.sessionStorage.removeItem('pageHistory');

                setSelectedRequestId(null);
                setSelectedClientId(null);
                setSettingsPage('general');
                setIsFocusMode(false);
                setIsSessionError(false);

                localStorage.removeItem('loginDate');
                localStorage.removeItem('lastActiveTime');

                setTimeout(() => { isManualLogout.current = false; }, 1000);
            }
        };

        if (hasUnsavedChanges) {
            showConfirmModal({
                title: 'تسجيل الخروج',
                message: 'لديك تغييرات لم يتم حفظها. هل أنت متأكد من تسجيل الخروج؟ ستفقد أي تعديلات غير محفوظة.',
                onConfirm: performLogout
            });
        } else {
            performLogout();
        }
    }, [hasUnsavedChanges, showConfirmModal, addNotification, setAuthUser, setHistory, setSelectedRequestId, setSelectedClientId, setSettingsPage, setIsFocusMode, setHasUnsavedChanges]);

    const ensureEntitiesLoadedRef = useRef(ensureEntitiesLoaded);
    useEffect(() => { ensureEntitiesLoadedRef.current = ensureEntitiesLoaded; }, [ensureEntitiesLoaded]);









    const setupRealtimeSubscription = useCallback(() => {
        if (channelRef.current) return;

        setRealtimeStatus('connecting');

        const channel = supabase.channel('public:inspection_requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inspection_requests' },
                async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newReq = payload.new as InspectionRequest;
                        await ensureEntitiesLoadedRef.current([newReq]);
                        setRequests(prev => {
                            if (prev.some(r => r.id === newReq.id)) return prev;
                            return [newReq, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                        });

                        // Trigger side notifier for other users
                        if (authUserRef.current && newReq.employee_id !== authUserRef.current.id) {
                            setIncomingRequest(newReq);
                        }

                        triggerHighlight(newReq.id);

                    } else if (payload.eventType === 'UPDATE') {
                        const updatedReq = payload.new as InspectionRequest;
                        await ensureEntitiesLoadedRef.current([updatedReq]);
                        setRequests(prev => prev.map(r => r.id === updatedReq.id ? { ...r, ...updatedReq } : r));
                    } else if (payload.eventType === 'DELETE') {
                        const deletedId = payload.old.id;

                        // 1. Update main list
                        setRequests(prev => prev.filter(r => r.id !== deletedId));

                        // 2. Update search results if active
                        setSearchedRequests(prev => {
                            if (!prev) return null;
                            return prev.filter(r => r.id !== deletedId);
                        });

                        // 3. Broadcast deletion event to other components (like filtered lists in Requests page)
                        setLastRemoteDeleteId(deletedId);

                        // Reset the trigger after a short delay
                        setTimeout(() => setLastRemoteDeleteId(null), 1000);
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
                else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    setRealtimeStatus('disconnected');
                }
            });
        channelRef.current = channel;

        const notifChannel = supabase.channel('public:notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    const newNotif = payload.new as any;
                    if (!newNotif.user_id || (authUser && newNotif.user_id === authUser.id)) {
                        const appNotif: AppNotification = newNotif as AppNotification;
                        setAppNotifications(prev => [appNotif, ...prev]);
                    }
                }
            )
            .subscribe();
        notificationsChannelRef.current = notifChannel;

        const msgChannel = supabase.channel('public:internal_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages' },
                (payload) => {
                    const newMessage = payload.new as InternalMessage;
                    if (authUser && newMessage.receiver_id === authUser.id) {
                        setUnreadMessagesCount(prev => prev + 1);
                        addNotification({ title: 'رسالة جديدة', message: `لديك رسالة جديدة من ${newMessage.sender_name} `, type: 'info' });
                    }
                }
            )
            .subscribe();
        messagesChannelRef.current = msgChannel;

    }, [addNotification, authUser, triggerHighlight, setAppNotifications, setUnreadMessagesCount, setRequests, setSearchedRequests, setIncomingRequest, setLastRemoteDeleteId]);

    const retryConnection = useCallback(() => {
        const cleanup = async () => {
            if (channelRef.current) await supabase.removeChannel(channelRef.current);
            if (notificationsChannelRef.current) await supabase.removeChannel(notificationsChannelRef.current);
            if (messagesChannelRef.current) await supabase.removeChannel(messagesChannelRef.current);
            channelRef.current = null;
            notificationsChannelRef.current = null;
            messagesChannelRef.current = null;
        };

        cleanup().then(() => setupRealtimeSubscription());
    }, [setupRealtimeSubscription]);

    const refreshSessionAndReload = useCallback(async () => {
        setIsRefreshing(true);
        console.log("Attempting session recovery...");

        // 1. Try Silent Refresh first (The "Gentle" Approach)
        try {
            const { data, error } = await supabase.auth.refreshSession();
            
            if (!error && data.session) {
                console.log("Session refreshed successfully");
                
                // Re-establish realtime connections
                retryConnection();
                
                // Refresh data to ensure UI is up to date
                await fetchAllData();

                addNotification({ title: 'تم التحديث', message: 'تم تجديد الجلسة واستعادة الاتصال بنجاح.', type: 'success' });
                setIsRefreshing(false);
                setIsSessionError(false);
                return; // Stop here, no need to reload page
            }
        } catch (e) {
            console.warn("Soft refresh failed, proceeding to hard reset", e);
        }

        // 2. If soft refresh failed, execute Radical Reset (The "Hard" Approach)
        console.log("Executing Radical Reset for Mobile Stability...");

        try {
            // Attempt graceful signout (don't wait long)
            await Promise.race([
                supabase.auth.signOut(),
                new Promise(resolve => setTimeout(resolve, 500))
            ]);
        } catch (e) { 
            console.error("Graceful signout failed, proceeding to hard wipe", e);
        }

        // BRUTAL WIPE of Client Storage
        try {
            window.localStorage.clear();
            window.sessionStorage.clear();
        } catch (e) {
            console.error("Storage clear error", e);
        }

        // Cache Busting Reload
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('reset_ts', Date.now().toString());
        
        window.location.replace(currentUrl.toString());
    }, [addNotification, fetchAllData, retryConnection]);



    useEffect(() => {
        let mounted = true;

        // 1. Safety Timeout: Force error screen if initialization hangs
        const timeoutId = setTimeout(() => {
            if (mounted && isLoading) {
                console.warn("Session initialization timed out. Forcing recovery mode.");
                localStorage.removeItem('lastActiveTime');
                setIsSessionError(true);
                setIsLoading(false);
            }
        }, 7000); // 7 seconds safety valve

        const initializeApp = async () => {
            try {
                // Fetch Settings
                const { data: settingsDataRaw } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
                const fetchedSettingsData = (settingsDataRaw?.settings_data || {}) as Record<string, any>;

                const finalGlobalSettings = {
                    ...mockSettings, ...fetchedSettingsData,
                    plateCharacters: fetchedSettingsData?.plateCharacters || mockSettings.plateCharacters,
                    platePreviewSettings: { ...mockSettings.platePreviewSettings, ...(fetchedSettingsData?.platePreviewSettings || {}) },
                    reportSettings: { ...mockSettings.reportSettings, ...(fetchedSettingsData?.reportSettings || {}) },
                };

                if (mounted) {
                    setGlobalSettings(finalGlobalSettings);
                    setIsSetupComplete(!!finalGlobalSettings.setupCompleted);
                    setSettings(finalGlobalSettings);
                }

                // Explicit Session Check
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    throw sessionError; // Triggers catch -> isSessionError = true
                }

                if (session?.user) {
                    // Session exists, verify user in database
                    const { data: employeeProfile, error: profileError } = await supabase
                        .from('employees')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (profileError) {
                        // Check specific error codes
                        if (profileError.code === 'PGRST116') {
                            // Code for "Row not found" - User deleted from DB
                            console.warn("Valid token but no employee profile. Logging out.");
                            await supabase.auth.signOut();
                            if (mounted) setAuthUser(null);
                        } else {
                            // Network error or other DB error - Show Recovery
                            console.error("Profile fetch error:", profileError);
                            if (mounted) setIsSessionError(true);
                        }
                    } else {
                        // Valid user
                        if (mounted) {
                            setAuthUser(employeeProfile);
                            localStorage.setItem('lastActiveTime', Date.now().toString());
                        }
                    }
                } else {
                    // No session
                    if (mounted) setAuthUser(null);
                }

            } catch (error) {
                console.error("Initialization error:", error);
                // Critical failure -> Recovery Mode
                if (mounted) setIsSessionError(true);
            } finally {
                if (mounted) {
                    clearTimeout(timeoutId); // Clear safety timeout
                    setIsLoading(false); // Stop loading indicator
                }
            }
        };

        initializeApp();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session) {
                    // Sync state if session updates and we don't have the user yet (redundancy)
                    // USE REF HERE to prevent stale closure issues and loops
                    if (!authUserRef.current || authUserRef.current.id !== session.user.id) {
                        const { data: employeeProfile } = await supabase.from('employees').select('*').eq('id', session.user.id).single();
                        if (employeeProfile) {
                            setAuthUser(employeeProfile);
                        }
                    }
                    localStorage.setItem('lastActiveTime', Date.now().toString());
                    setIsLoading(false);
                    setIsSessionError(false);
                }
            } else if (event === 'SIGNED_OUT') {
                if (isManualLogout.current) {
                    setAuthUser(null);
                    setIsLoading(false);
                } else {
                    setAuthUser(null);
                    setIsLoading(false);
                }
            }
        });

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            subscription?.unsubscribe();
        };
    }, []); // Empty dependency array to run once on mount

    useEffect(() => {
        if (!authUser) return;
        const checkInactivity = () => {
            const lastActive = localStorage.getItem('lastActiveTime');
            if (lastActive) {
                const diff = Date.now() - parseInt(lastActive, 10);
                if (diff > INACTIVITY_LIMIT_MS) {
                    setHistory(['dashboard']);
                    window.sessionStorage.setItem('pageHistory', JSON.stringify(['dashboard']));
                    localStorage.setItem('lastActiveTime', Date.now().toString());
                }
            } else {
                localStorage.setItem('lastActiveTime', Date.now().toString());
            }
        };
        checkInactivity();
        const checkMidnight = () => {
            const storedDate = localStorage.getItem('loginDate');
            const todayStr = new Date().toLocaleDateString('en-CA');
            if (storedDate && storedDate !== todayStr) {
                // IMPORTANT: Ensure we actually have a session before logging out, to avoid double-actions or weird states
                if (authUserRef.current) {
                    logout();
                    addNotification({ title: 'يوم جديد', message: 'انتهى اليوم، يرجى تسجيل الدخول من جديد.', type: 'info' });
                }
            }
        };
        checkMidnight();
        const interval = setInterval(checkMidnight, 60000);
        return () => clearInterval(interval);
    }, [authUser, logout, setHistory, addNotification]);


    useEffect(() => {
        if (authUser) {
            if (requests.length === 0) {
                setIsLoading(true);
                fetchAllData().finally(() => setIsLoading(false));
            }
            setupRealtimeSubscription();
        } else {
            setRequests([]); setClients([]); setCars([]); setCarMakes([]); setCarModels([]); setExpenses([]); setAppNotifications([]); setTechnicians([]); setReservations([]);
            const cleanup = async () => {
                if (channelRef.current) await supabase.removeChannel(channelRef.current);
                if (notificationsChannelRef.current) await supabase.removeChannel(notificationsChannelRef.current);
                if (messagesChannelRef.current) await supabase.removeChannel(messagesChannelRef.current);
                channelRef.current = null;
                notificationsChannelRef.current = null;
                messagesChannelRef.current = null;
            };
            cleanup();
            setRealtimeStatus('disconnected');
        }
    }, [authUser, fetchAllData, setupRealtimeSubscription, setRequests, setClients, setCars, setCarMakes, setCarModels, setExpenses, setAppNotifications, setTechnicians, setReservations]);

    // --- APP REVIVAL LOGIC ---
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                // 1. Refresh Auth Token
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error || !session) {
                    // If session is truly dead, try to refresh once
                    const { error: refreshError } = await supabase.auth.refreshSession();
                    if (refreshError && authUserRef.current) {
                        console.warn("Session expired in background, refresh failed.");
                        // Optional: logout user if refresh fails
                        // logout(); 
                    }
                } else {
                    // Session is valid, ensure local auth state is correct
                    if (authUserRef.current && authUserRef.current.id !== session.user.id) {
                        console.warn("Auth state drift detected. Reloading to sync.");
                        window.location.reload();
                    }
                }

                // 2. Restart auto-refresh
                supabase.auth.startAutoRefresh();

                // 3. Reconnect Realtime if disconnected
                if (authUserRef.current && realtimeStatusRef.current === 'disconnected') {
                    console.log("App became visible, retrying realtime connection.");
                    retryConnection();
                }
            }
        };

        const handleOnline = () => {
            setIsOnline(true);
            addNotification({ title: 'تم استعادة الاتصال', message: 'لقد عدت متصلاً بالإنترنت.', type: 'info' });
            if (authUserRef.current) {
                supabase.auth.startAutoRefresh();
                retryConnection();
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            setRealtimeStatus('disconnected');
            addNotification({ title: 'فقد الاتصال', message: 'لا يوجد اتصال بالإنترنت.', type: 'warning' });
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [retryConnection, addNotification, logout]);



    const startSetupProcess = useCallback(() => setIsSetupComplete(false), []);

    const fetchAndUpdateSingleRequest = useCallback(async (requestId: string) => {
        const { data: req, error } = await supabase.from('inspection_requests').select('*').eq('id', requestId).single();

        if (error && !req) {
            // If request is not found (deleted), remove it from local state
            setRequests(prev => prev.filter(r => r.id !== requestId));
            return;
        }

        if (req) {
            setRequests(prev => {
                const exists = prev.some(r => r.id === requestId);
                return exists ? prev.map(r => r.id === requestId ? { ...r, ...req } : r) : [req, ...prev];
            });
            await ensureEntitiesLoaded([req]);
        }
    }, [ensureEntitiesLoaded, setRequests]);

    const fetchRequestTabContent = useCallback(async (requestId: string, group: 'general' | 'categories' | 'gallery') => {
        let columns = '';
        if (group === 'general') columns = 'general_notes';
        else if (group === 'categories') columns = 'category_notes,structured_findings,voice_memos';
        else if (group === 'gallery') columns = 'general_notes,category_notes,attached_files';
        if (!columns) return;
        const { data, error } = await supabase.from('inspection_requests').select(columns).eq('id', requestId).single();
        if (!error && data) {
            setRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...data } : r));
        }
    }, [setRequests]);

    const fetchFullRequestForSave = useCallback(async (requestId: string): Promise<InspectionRequest | null> => {
        const { data, error } = await supabase.from('inspection_requests').select('*').eq('id', requestId).single();
        if (error || !data) return null;
        return data;
    }, []);

    const loadMoreRequests = useCallback(async () => {
        if (isLoadingMore || !hasMoreRequests) return;
        setIsLoadingMore(true);
        const { data: nextBatch, error } = await supabase.from('inspection_requests')
            .select('id, request_number, client_id, car_id, car_snapshot, inspection_type_id, payment_type, price, status, created_at, employee_id, broker, activity_log, technician_assignments, updated_at')
            .order('created_at', { ascending: false })
            .range(requestsOffset, requestsOffset + REQUESTS_PAGE_SIZE - 1);
        if (!error && nextBatch) {
            await ensureEntitiesLoaded(nextBatch);
            setRequests(prev => [...prev, ...nextBatch]);
            setRequestsOffset(prev => prev + nextBatch.length);
            setHasMoreRequests(nextBatch.length === REQUESTS_PAGE_SIZE);
        } else {
            setHasMoreRequests(false);
        }
        setIsLoadingMore(false);
    }, [isLoadingMore, hasMoreRequests, requestsOffset, ensureEntitiesLoaded, setRequests, setRequestsOffset, setHasMoreRequests, setIsLoadingMore]);

    const clearSearchedRequests = useCallback(() => setSearchedRequests(null), [setSearchedRequests]);

    const searchRequestByNumber = useCallback(async (queryRaw: string | number) => {
        const query = String(queryRaw).trim();
        if (!query) {
            clearSearchedRequests();
            return;
        }
        setIsRefreshing(true);
        try {
            const isNumericQuery = /^\d+$/.test(query);
            if (isNumericQuery) {
                const { data, error } = await supabase
                    .from('inspection_requests')
                    .select('*')
                    .eq('request_number', Number(query))
                    .order('created_at', { ascending: false });
                if (error) throw error;
                if (data && data.length > 0) {
                    await ensureEntitiesLoaded(data);
                    setSearchedRequests(data);
                } else {
                    setSearchedRequests([]);
                }
                return;
            }

            const cleanQuery = query.replace(/\s/g, '');
            const spacedQuery = query.split('').join(' ');

            // 1. Search Cars
            const { data: carsByPlate } = await supabase
                .from('cars')
                .select('id')
                .or(`plate_number.ilike.%${cleanQuery}%,plate_number.ilike.%${spacedQuery}%,plate_number_en.ilike.%${cleanQuery}%,plate_number_en.ilike.%${spacedQuery}%,vin.ilike.%${cleanQuery}%`)
                .limit(50);

            let carIds = carsByPlate?.map(c => c.id) || [];

            // 2. Search Makes/Models
            const { data: makes } = await supabase
                .from('car_makes')
                .select('id')
                .or(`name_ar.ilike.%${query}%,name_en.ilike.%${query}%`);
            const makeIds = makes?.map(m => m.id) || [];

            const { data: models } = await supabase
                .from('car_models')
                .select('id')
                .or(`name_ar.ilike.%${query}%,name_en.ilike.%${query}%`);
            const modelIds = models?.map(m => m.id) || [];

            if (makeIds.length > 0 || modelIds.length > 0) {
                let carOrConditions: string[] = [];
                if (makeIds.length > 0) carOrConditions.push(`make_id.in.(${makeIds.join(',')})`);
                if (modelIds.length > 0) carOrConditions.push(`model_id.in.(${modelIds.join(',')})`);

                const { data: carsByMakeModel } = await supabase
                    .from('cars')
                    .select('id')
                    .or(carOrConditions.join(','))
                    .limit(100);

                const newCarIds = carsByMakeModel?.map(c => c.id) || [];
                carIds = [...new Set([...carIds, ...newCarIds])];
            }

            // 3. Search Clients
            const { data: foundClients } = await supabase
                .from('clients')
                .select('id')
                .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
                .limit(50);
            const clientIds = foundClients?.map(c => c.id) || [];

            // 4. Combine into Requests Search
            if (carIds.length === 0 && clientIds.length === 0) {
                setSearchedRequests([]);
                return;
            }

            let requestOrConditions: string[] = [];
            if (carIds.length > 0) requestOrConditions.push(`car_id.in.(${carIds.join(',')})`);
            if (clientIds.length > 0) requestOrConditions.push(`client_id.in.(${clientIds.join(',')})`);

            const { data: finalRequests, error: reqError } = await supabase
                .from('inspection_requests')
                .select('*')
                .or(requestOrConditions.join(','))
                .order('created_at', { ascending: false })
                .limit(50);

            if (reqError) throw reqError;

            if (finalRequests && finalRequests.length > 0) {
                await ensureEntitiesLoaded(finalRequests);
                setSearchedRequests(finalRequests);
            } else {
                setSearchedRequests([]);
            }
        } catch (e) {
            console.error("Search error:", e);
            setSearchedRequests([]);
        } finally {
            setIsRefreshing(false);
        }
    }, [ensureEntitiesLoaded, clearSearchedRequests, setIsRefreshing, setSearchedRequests]);

    const fetchClientRequests = useCallback(async (clientId: string): Promise<InspectionRequest[]> => {
        const { data } = await supabase.from('inspection_requests').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
        if (data) {
            await ensureEntitiesLoaded(data);
            return data;
        }
        return [];
    }, [ensureEntitiesLoaded]);

    // NEW: Filtered Client Requests Fetcher
    const fetchClientRequestsFiltered = useCallback(async (clientId: string, startDate?: string, endDate?: string, onlyUnpaid?: boolean): Promise<InspectionRequest[]> => {
        let query = supabase.from('inspection_requests').select('*').eq('client_id', clientId).order('created_at', { ascending: false });

        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        if (onlyUnpaid) {
            // Check for payment_type = Unpaid OR status = WAITING_PAYMENT
            query = query.or(`payment_type.eq.${PaymentType.Unpaid}, status.eq.${RequestStatus.WAITING_PAYMENT} `);
        }

        // Limit to prevent massive loads if no filter provided (safety)
        if (!startDate && !endDate && !onlyUnpaid) {
            query = query.limit(100);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching filtered client requests:", error);
            addNotification({ title: 'خطأ', message: 'فشل تحميل سجل الطلبات.', type: 'error' });
            return [];
        }

        if (data) {
            await ensureEntitiesLoaded(data);
            return data as InspectionRequest[];
        }
        return [];
    }, [ensureEntitiesLoaded, addNotification]);

    // NEW: Light-weight Financial Summary
    const getClientFinancialSummary = useCallback(async (clientId: string) => {
        try {
            const { data, error } = await supabase
                .from('inspection_requests')
                .select('id, request_number, price, status, payment_type, created_at, car_id')
                .eq('client_id', clientId)
                .or(`payment_type.eq.${PaymentType.Unpaid}, status.eq.${RequestStatus.WAITING_PAYMENT} `)
                .neq('status', 'cancelled') // Assuming we might have cancelled status, good practice.
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error("Failed to fetch client financial summary", e);
            return [];
        }
    }, []);

    const fetchRequestsByCarId = useCallback(async (carId: string): Promise<InspectionRequest[]> => {
        const { data, error } = await supabase.from('inspection_requests').select('*').eq('car_id', carId).order('created_at', { ascending: false });
        if (error) throw error;
        const results = (data as InspectionRequest[]) || [];
        if (results.length > 0) {
            await ensureEntitiesLoaded(results);
        }
        return results;
    }, [ensureEntitiesLoaded]);

    const fetchRequestByRequestNumber = useCallback(async (reqNum: number): Promise<InspectionRequest | null> => {
        const { data, error } = await supabase.from('inspection_requests').select('*').eq('request_number', reqNum).single();
        if (error && !data) {
            setRequests(prev => prev.filter(r => r.request_number !== reqNum));
            return null;
        }
        if (data) {
            await ensureEntitiesLoaded([data]);
            setRequests(prev => {
                const exists = prev.some(r => r.id === data.id);
                if (exists) return prev.map(r => r.id === data.id ? data : r);
                const newRequests = [data, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                return newRequests.slice(0, REQUESTS_PAGE_SIZE + 10);
            });
        }
        return data;
    }, [ensureEntitiesLoaded]);

    const fetchRequestByRequestNumberForAuth = useCallback(async (reqNum: number): Promise<InspectionRequest | null> => {
        const { data, error } = await supabase.from('inspection_requests').select('*').eq('request_number', reqNum).single();
        if (error || !data) return null;
        return data;
    }, []);


    const fetchRequestsByDateRange = useCallback(async (startDate: string, endDate: string): Promise<InspectionRequest[]> => {
        const { data, error } = await supabase.from('inspection_requests').select('id, request_number, client_id, car_id, car_snapshot, inspection_type_id, payment_type, price, status, created_at, employee_id, broker, activity_log, technician_assignments, updated_at').gte('created_at', startDate).lte('created_at', endDate).order('created_at', { ascending: false });
        if (error) {
            addNotification({ title: 'خطأ', message: 'فشل تحميل الطلبات حسب التاريخ.', type: 'error' });
            return [];
        }
        if (data) await ensureEntitiesLoaded(data);
        return data || [];
    }, [addNotification, ensureEntitiesLoaded]);

    const searchClients = useCallback(async (query: string): Promise<Client[]> => {
        if (!query || query.length < 2) return [];
        const { data } = await supabase.from('clients').select('*').or(`name.ilike.%${query}%,phone.ilike.%${query}%`).limit(20);
        return data || [];
    }, []);

    const searchClientsPage = useCallback(async (pageNumber: number, pageSize: number, query?: string) => {
        let queryBuilder = supabase.from('clients').select('*', { count: 'exact' });
        if (query) queryBuilder = queryBuilder.or(`name.ilike.%${query}%,phone.ilike.%${query}%`);
        const { data, count } = await queryBuilder.range((pageNumber - 1) * pageSize, pageNumber * pageSize - 1);
        return { data: data || [], count: count || 0 };
    }, []);

    const searchCars = useCallback(async (query: string): Promise<Car[]> => {
        if (!query) return [];
        const clean = query.replace(/\s/g, '');
        const { data } = await supabase.from('cars').select('*').or(`plate_number.ilike.%${clean}%,plate_number_en.ilike.%${clean}%,vin.ilike.%${clean}%`).limit(20);
        return data || [];
    }, []);

    const checkCarHistory = useCallback(async (plateNumber: string | null, vin: string | null): Promise<CarHistoryResult | null> => {
        if (!plateNumber && !vin) return null;
        try {
            let foundCar: Car | null = null;
            const clean = (s: string) => s.replace(/\s/g, '').toUpperCase();
            if (plateNumber) {
                const targetPlate = clean(plateNumber);
                foundCar = cars.find(c => (c.plate_number && clean(c.plate_number) === targetPlate) || (c.plate_number_en && clean(c.plate_number_en) === targetPlate)) || null;
            }
            if (!foundCar && vin) {
                const targetVin = clean(vin);
                foundCar = cars.find(c => c.vin && clean(c.vin) === targetVin) || null;
            }
            if (!foundCar) {
                let query = supabase.from('cars').select('*').limit(1);
                if (plateNumber) {
                    const cleanPlate = plateNumber.replace(/\s/g, '');
                    const spacedPlate = plateNumber.split('').join(' ');
                    query = query.or(`plate_number.ilike.%${cleanPlate}%,plate_number.ilike.%${spacedPlate}%,plate_number_en.ilike.%${cleanPlate}%,plate_number_en.ilike.%${spacedPlate}%`);
                }
                if (vin) query = query.or(`vin.eq.${vin}`);
                const { data } = await query;
                if (data && data.length > 0) {
                    foundCar = data[0];
                    setCars(prev => prev.find(c => c.id === foundCar!.id) ? prev : [...prev, foundCar!]);
                }
            }
            if (foundCar) {
                const { data: requestHistory } = await supabase.from('inspection_requests').select('*').eq('car_id', foundCar.id).order('created_at', { ascending: false }).limit(5);
                let lastClient: Client | undefined;
                if (requestHistory && requestHistory.length > 0) {
                    const { data: clientData } = await supabase.from('clients').select('*').eq('id', requestHistory[0].client_id).single();
                    if (clientData) lastClient = clientData;
                }
                return { car: foundCar, previousRequests: requestHistory || [], lastClient };
            }
        } catch (e) { }
        return null;
    }, [cars]);

    const searchCarMakes = useCallback(async (query: string): Promise<CarMake[]> => {
        if (!query) return [];
        const { data } = await supabase.from('car_makes').select('*').or(`name_ar.ilike.%${query}%,name_en.ilike.%${query}%`).limit(20);
        return data || [];
    }, []);

    const searchCarModels = useCallback(async (makeId: string, query: string): Promise<CarModel[]> => {
        if (!makeId) return [];
        let queryBuilder = supabase.from('car_models').select('*').eq('make_id', makeId);
        if (query) queryBuilder = queryBuilder.or(`name_ar.ilike.%${query}%,name_en.ilike.%${query}%`);
        const { data } = await queryBuilder.limit(20);
        return data || [];
    }, [fetchCarModelsByMake]);





    const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password });
            if (error) {
                if (error.message.includes('Email not confirmed')) return { success: false, error: 'البريد الإلكتروني غير مؤكد.' };
                throw error;
            }
            if (data.user) {
                const { data: employeeProfile } = await supabase.from('employees').select('*').eq('id', data.user.id).single();
                if (!employeeProfile) {
                    await supabase.auth.signOut();
                    return { success: false, error: 'لا يوجد ملف موظف.' };
                }
                localStorage.setItem('loginDate', new Date().toLocaleDateString('en-CA'));
                localStorage.setItem('lastActiveTime', Date.now().toString());
                await sendSystemNotification({ title: 'تسجيل دخول', message: `قام ${employeeProfile.name} بتسجيل الدخول للنظام.`, type: 'login' });
            }
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || 'حدث خطأ' };
        }
    }, [sendSystemNotification]);

    const updateOwnPassword = useCallback(async (newPassword: string) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
    }, []);

    const removeNotification = useCallback((id: string) => setNotifications(prev => prev.filter(n => n.id !== id)), []);



    const showNewRequestSuccessModal = useCallback((requestId: string | null, requestNumber: number | null) => setNewRequestSuccessState({ isOpen: true, requestId, requestNumber }), []);
    const hideNewRequestSuccessModal = useCallback(() => setNewRequestSuccessState({ isOpen: false, requestId: null, requestNumber: null }), []);

    const fetchFinancialsData = useCallback(async (filter: 'today' | 'week' | 'month' | 'year'): Promise<{ requests: InspectionRequest[], expenses: Expense[] }> => {
        const now = new Date();
        let startDate: Date;
        if (filter === 'today') startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        else if (filter === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            startDate = new Date(now.setDate(diff));
            startDate.setHours(0, 0, 0, 0);
        } else if (filter === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        else startDate = new Date(now.getFullYear(), 0, 1);
        const { data: requestsData } = await supabase.from('inspection_requests').select('*').eq('status', RequestStatus.COMPLETE).gte('created_at', startDate.toISOString());
        const { data: expensesData } = await supabase.from('expenses').select('*').gte('date', startDate.toISOString());

        const finalRequests = requestsData || [];
        if (finalRequests.length > 0) {
            await ensureEntitiesLoaded(finalRequests);
        }

        return { requests: finalRequests, expenses: expensesData || [] };
    }, [ensureEntitiesLoaded]);

    const uploadImage = useCallback(async (file: File, bucket: string): Promise<string> => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        const fileExt = file.name.split('.').pop();
        const filePath = `${uuidv4()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
        return data.publicUrl;
    }, []);

    const deleteImage = useCallback(async (imageUrl: string): Promise<void> => {
        try {
            const url = new URL(imageUrl);
            const pathParts = url.pathname.split('/');
            const bucketIndex = pathParts.indexOf('public');
            if (bucketIndex === -1 || bucketIndex + 2 >= pathParts.length) return;
            const bucket = pathParts[bucketIndex + 1];
            const path = pathParts.slice(bucketIndex + 2).join('/');
            await supabase.storage.from(bucket).remove([path]);
        } catch (e) { }
    }, []);









    const fetchInboxMessages = useCallback(async () => {
        if (!authUser) return [];
        const { data, error } = await supabase.from('internal_messages').select('*').eq('receiver_id', authUser.id).order('created_at', { ascending: false });
        if (error) throw error;
        return data as InternalMessage[];
    }, [authUser]);

    const fetchSentMessages = useCallback(async () => {
        if (!authUser) return [];
        const { data, error } = await supabase.from('internal_messages').select('*').eq('sender_id', authUser.id).order('created_at', { ascending: false });
        if (error) throw error;
        return data as InternalMessage[];
    }, [authUser]);



    const factoryResetOperations = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const tables = ['inspection_requests', 'expenses', 'other_revenues', 'notifications', 'internal_messages', 'reservations'];
            for (const table of tables) {
                const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (error) throw error;
            }
            addNotification({ title: 'تم التصفير', message: 'تم مسح جميع العمليات والطلبات والبيانات المالية بنجاح.', type: 'success' });
            fetchAllData();
        } catch (error: any) { addNotification({ title: 'فشل التصفير', message: error.message, type: 'error' }); }
        finally { setIsRefreshing(false); }
    }, [addNotification, fetchAllData]);

    const factoryResetFull = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const tables = ['inspection_requests', 'expenses', 'other_revenues', 'notifications', 'internal_messages', 'reservations'];
            for (const table of tables) {
                const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (error) throw error;
            }
            const parentTables = ['cars', 'clients'];
            for (const table of parentTables) {
                const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (error) throw error;
            }
            addNotification({ title: 'تصفير شامل', message: 'تم مسح العمليات والعملاء والسيارات بنجاح.', type: 'success' });
            fetchAllData();
        } catch (error: any) { addNotification({ title: 'فشل التصفير', message: error.message, type: 'error' }); }
        finally { setIsRefreshing(false); }
    }, [addNotification, fetchAllData]);

    const fetchServerFinancials = useCallback(async (startDate: string, endDate: string, includeCompletedOnly: boolean): Promise<FinancialStats> => {
        let query = supabase.from('inspection_requests').select('id, request_number, client_id, car_id, price, status, payment_type, split_payment_details, payment_note, broker, created_at').gte('created_at', startDate).lte('created_at', endDate);
        if (includeCompletedOnly) query = query.eq('status', RequestStatus.COMPLETE);
        else query = query.neq('status', 'cancelled');
        const { data: requests, error: reqError } = await query;
        if (reqError) throw reqError;
        const { data: expenses, error: expError } = await supabase.from('expenses').select('*').gte('date', startDate).lte('date', endDate);
        if (expError) throw expError;
        const { data: revenuesData, error: revError } = await supabase.from('other_revenues').select('*').gte('date', startDate).lte('date', endDate);
        if (revError) throw revError;
        const reqs = requests as InspectionRequest[];
        const exps = expenses as Expense[];
        const revs: Revenue[] = (revenuesData || []).map((r: any) => ({ id: r.id, date: r.date, category: r.category, description: r.description, amount: r.amount, payment_method: r.payment_method, employeeId: r.employee_id, employeeName: r.employee_name }));
        const totalRequestsRevenue = reqs.reduce((sum, r) => sum + r.price, 0);
        let cashTotal = 0, cardTotal = 0, transferTotal = 0, unpaidTotal = 0;
        const brokerSummaryMap: Record<string, { name: string, amount: number, count: number }> = {};
        reqs.forEach(req => {
            if (req.payment_type === PaymentType.Split && req.split_payment_details) { cashTotal += req.split_payment_details.cash || 0; cardTotal += req.split_payment_details.card || 0; }
            else if (req.payment_type === PaymentType.Cash) cashTotal += req.price;
            else if (req.payment_type === PaymentType.Card) cardTotal += req.price;
            else if (req.payment_type === PaymentType.Transfer) transferTotal += req.price;
            else if (req.payment_type === PaymentType.Unpaid) unpaidTotal += req.price;
            if (req.broker) {
                const brokerId = req.broker.id, brokerObj = brokers.find(b => b.id === brokerId), brokerName = brokerObj ? brokerObj.name : 'غير معروف', commission = req.broker.commission || 0;
                if (!brokerSummaryMap[brokerId]) brokerSummaryMap[brokerId] = { name: brokerName, amount: 0, count: 0 };
                brokerSummaryMap[brokerId].amount += commission; brokerSummaryMap[brokerId].count += 1;
            }
        });
        const totalOtherRevenue = revs.reduce((sum, r) => sum + r.amount, 0);
        revs.forEach(rev => {
            if (rev.payment_method === PaymentType.Cash) cashTotal += rev.amount;
            else if (rev.payment_method === PaymentType.Card) cardTotal += rev.amount;
            else if (rev.payment_method === PaymentType.Transfer) transferTotal += rev.amount;
        });

        // Filter out employee deductions ('خصومات') and advances ('سلف') from general expenses
        // deductions don't exit the drawer, advances do but are managed in payroll.
        const filteredGeneralExpenses = exps.filter(e => e.category !== 'خصومات' && e.category !== 'سلف');
        const advancesEntries = exps.filter(e => e.category === 'سلف');

        const totalRevenue = totalRequestsRevenue + totalOtherRevenue,
            actualCashFlow = cashTotal + cardTotal + transferTotal,
            // totalExpenses for KPI cards will only show operational expenses
            totalExpenses = filteredGeneralExpenses.reduce((sum, e) => sum + e.amount, 0),
            // totalAdvances for cash drawer deduction but NOT profit deduction
            totalAdvances = advancesEntries.reduce((sum, e) => sum + e.amount, 0),
            totalCommissions = reqs.reduce((sum, r) => sum + (r.broker?.commission || 0), 0),
            // Net Profit strictly subtracts operational expenses and commissions, not advances (loans)
            netProfit = actualCashFlow - totalExpenses - totalCommissions;
        const dailyMap: Record<string, any> = {};
        const addToDaily = (dateStr: string, key: string, value: number) => {
            if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, cars: 0, revenue: 0, cash: 0, card: 0, transfer: 0, unpaid: 0, expenses: 0, commission: 0 };
            dailyMap[dateStr][key] += value;
        };
        reqs.forEach(req => {
            const dateKey = new Date(req.created_at).toLocaleDateString('en-CA');
            addToDaily(dateKey, 'cars', 1); addToDaily(dateKey, 'revenue', req.price); addToDaily(dateKey, 'commission', (req.broker?.commission || 0));
            if (req.payment_type === PaymentType.Split && req.split_payment_details) { addToDaily(dateKey, 'cash', req.split_payment_details.cash); addToDaily(dateKey, 'card', req.split_payment_details.card); }
            else if (req.payment_type === PaymentType.Cash) addToDaily(dateKey, 'cash', req.price);
            else if (req.payment_type === PaymentType.Card) addToDaily(dateKey, 'card', req.price);
            else if (req.payment_type === PaymentType.Transfer) addToDaily(dateKey, 'transfer', req.price);
            else if (req.payment_type === PaymentType.Unpaid) addToDaily(dateKey, 'unpaid', req.price);
        });
        revs.forEach(rev => { const dateKey = new Date(rev.date).toLocaleDateString('en-CA'); addToDaily(dateKey, 'revenue', rev.amount); if (rev.payment_method === PaymentType.Cash) addToDaily(dateKey, 'cash', rev.amount); else if (rev.payment_method === PaymentType.Card) addToDaily(dateKey, 'card', rev.amount); else if (rev.payment_method === PaymentType.Transfer) addToDaily(dateKey, 'transfer', rev.amount); });
        exps.forEach(exp => {
            if (exp.category !== 'خصومات' && exp.category !== 'سلف') {
                const dateKey = new Date(exp.date).toLocaleDateString('en-CA');
                addToDaily(dateKey, 'expenses', exp.amount);
            }
        });
        const ledgerData = Object.values(dailyMap).sort((a: any, b: any) => b.date.localeCompare(a.date));
        const dailyRevenueChart = ledgerData.map((d: any) => ({ label: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' }), value: d.revenue })).reverse();
        const paymentDistribution = [{ label: 'نقدي', value: cashTotal, color: '#10b981' }, { label: 'بطاقة', value: cardTotal, color: '#3b82f6' }, { label: 'تحويل', value: transferTotal, color: '#f59e0b' }, { label: 'آجل', value: unpaidTotal, color: '#ef4444' }].filter(d => d.value > 0);
        const today = new Date(), thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(today.getDate() - 30);
        const { data: historicalData } = await supabase.from('inspection_requests').select('price, created_at').gte('created_at', thirtyDaysAgo.toISOString()).lte('created_at', today.toISOString()).eq('status', RequestStatus.COMPLETE);
        const historyMap: Record<string, number> = {};
        (historicalData || []).forEach((r: any) => { const d = new Date(r.created_at).toLocaleDateString('en-CA'); historyMap[d] = (historyMap[d] || 0) + r.price; });
        const trendPoints: { x: number; y: number; dateStr: string }[] = [], historyForChart: { date: string; value: number; label: string }[] = [];
        for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(today.getDate() - i); const dateStr = d.toLocaleDateString('en-CA'), val = historyMap[dateStr] || 0; trendPoints.push({ x: 29 - i, y: val, dateStr }); if (i < 14) historyForChart.push({ date: dateStr, value: val, label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' }) }); }
        const n = trendPoints.length, sumX = trendPoints.reduce((acc, p) => acc + p.x, 0), sumY = trendPoints.reduce((acc, p) => acc + p.y, 0), sumXY = trendPoints.reduce((acc, p) => acc + p.x * p.y, 0), sumXX = trendPoints.reduce((acc, p) => acc + p.x * p.x, 0), slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumY || 1), intercept = (sumY - slope * sumX) / n;
        const forecastData: { date: string; value: number; label: string }[] = [];
        for (let i = 1; i <= 7; i++) { const nextX = 29 + i, predictedY = Math.max(0, slope * nextX + intercept), nextDate = new Date(); nextDate.setDate(today.getDate() + i); forecastData.push({ date: nextDate.toLocaleDateString('en-CA'), value: Math.round(predictedY), label: nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' }) }); }
        const trendDirection = slope > 50 ? 'up' : slope < -50 ? 'down' : 'flat';
        await ensureEntitiesLoaded(reqs);
        return {
            totalRevenue,
            totalOtherRevenue,
            actualCashFlow,
            cashTotal,
            cardTotal,
            transferTotal,
            unpaidTotal,
            totalExpenses,
            totalAdvances,
            totalCommissions,
            netProfit,
            ledgerData,
            dailyRevenueChart,
            paymentDistribution,
            brokerSummary: Object.values(brokerSummaryMap),
            forecast: { history: historyForChart, data: forecastData, trend: trendDirection },
            filteredRequests: reqs,
            filteredExpenses: filteredGeneralExpenses, // Use filtered expenses here
            filteredRevenues: revs
        };
    }, [brokers, ensureEntitiesLoaded]);

    const fetchServerExpenses = useCallback(async (startDate: string, endDate: string): Promise<Expense[]> => {
        // Use multiple .neq for maximum compatibility with all Supabase environments
        const { data, error } = await supabase.from('expenses')
            .select('*')
            .neq('category', 'خصومات')
            .neq('category', 'سلف')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });
        if (error) throw error;
        return (data as Expense[]) || [];
    }, []);

    const fetchServerRevenues = useCallback(async (startDate: string, endDate: string): Promise<Revenue[]> => {
        const { data, error } = await supabase.from('other_revenues').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false });
        if (error) throw error;
        return (data || []).map((r: any) => ({ id: r.id, date: r.date, category: r.category, description: r.description, amount: r.amount, payment_method: r.payment_method, employeeId: r.employee_id, employeeName: r.employee_name }));
    }, []);

    const searchArchive = useCallback(async (params: { startDate: string; endDate: string; query?: string }): Promise<string[]> => {
        setIsRefreshing(true);
        try {
            let requestQuery = supabase.from('inspection_requests')
                .select('car_id, client_id')
                .gte('created_at', params.startDate)
                .lte('created_at', params.endDate);

            if (params.query) {
                const q = params.query.trim();
                const cleanQ = q.replace(/\s/g, '');

                // Find cars matching query
                const { data: matchedCars } = await supabase.from('cars').select('id')
                    .or(`plate_number.ilike.%${cleanQ}%,plate_number_en.ilike.%${cleanQ}%,vin.ilike.%${cleanQ}%`);
                const carIdsFromCars = matchedCars?.map(c => c.id) || [];

                // Find clients matching query
                const { data: matchedClients } = await supabase.from('clients').select('id')
                    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
                const clientIdsFromClients = matchedClients?.map(c => c.id) || [];

                if (carIdsFromCars.length > 0 || clientIdsFromClients.length > 0) {
                    let orParts = [];
                    if (carIdsFromCars.length > 0) orParts.push(`car_id.in.(${carIdsFromCars.join(',')})`);
                    if (clientIdsFromClients.length > 0) orParts.push(`client_id.in.(${clientIdsFromClients.join(',')})`);
                    requestQuery = requestQuery.or(orParts.join(','));
                } else {
                    return [];
                }
            }

            const { data, error } = await requestQuery;
            if (error) throw error;
            return Array.from(new Set((data || []).map(r => r.car_id)));
        } catch (e) {
            console.error("Archive search error:", e);
            return [];
        } finally {
            setIsRefreshing(false);
        }
    }, [setIsRefreshing]);

    const fetchPayrollDraft = useCallback(async (month: number, year: number): Promise<PayrollDraft | null> => {
        const { data, error } = await supabase.from('payroll_drafts').select('*').eq('month', month).eq('year', year).maybeSingle();
        if (error) return null;
        if (!data) return null;
        return { id: data.id, month: data.month, year: data.year, items: data.draft_data.items as PayrollItem[], last_updated: data.last_updated, status: data.status };
    }, []);

    const savePayrollDraft = useCallback(async (draft: PayrollDraft) => {
        const payload = { month: draft.month, year: draft.year, draft_data: { items: draft.items }, last_updated: new Date().toISOString(), status: draft.status || 'draft' };
        const { error } = await supabase.from('payroll_drafts').upsert(payload, { onConflict: 'month,year' });
        if (error) throw error;
    }, []);

    const checkIfEmployeePaidThisMonth = useCallback(async (employeeId: string, month: number, year: number): Promise<boolean> => {
        const { data, error } = await supabase.from('expenses').select('id').eq('category', 'رواتب').ilike('description', `% [ID: ${employeeId}] % `).ilike('description', ` % شهر ${month}/${year}%`).limit(1);
        if (error) return false;
        return data && data.length > 0;
    }, []);

    const fetchEmployeeTransactionsForMonth = useCallback(async (employeeId: string, month: number, year: number): Promise<Expense[]> => {
        // Validation: Ensure month and year are valid before creating Date objects
        if (!month || !year || isNaN(month) || isNaN(year)) {
            console.warn("Invalid month or year passed to fetchEmployeeTransactionsForMonth", { month, year });
            return [];
        }

        try {
            const start = new Date(year, month - 1, 1).toISOString();
            const end = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
            const { data, error } = await supabase.from('expenses').select('*').in('category', ['خصومات', 'سلف', 'مكافآت']).ilike('description', `%[ID:${employeeId}]%`).gte('date', start).lte('date', end).order('date', { ascending: true });
            if (error) return [];
            return data as Expense[];
        } catch (e) {
            console.error("Error in fetchEmployeeTransactionsForMonth:", e);
            return [];
        }
    }, []);

    // --- Reservations Logic ---

    const fetchReservations = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('reservations')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setReservations(data || []);
        } catch (e) {
            console.error("Failed to fetch reservations:", e);
        }
    }, []);



    const parseReservationText = useCallback(async (text: string): Promise<Partial<Reservation>> => {
        // Regex extraction based on the provided WhatsApp template
        const extract = (key: string) => {
            // Matches *Key:* Value (until end of line)
            // Escaping * is important
            const regex = new RegExp(`\\*${key}:\\*\\s*([^\\n\\r]+)`);
            const match = text.match(regex);
            return match ? match[1].trim() : '';
        };

        const client_name = extract('اسم العميل');
        const client_phone = extract('رقم الهاتف');

        // Car Details
        const make = extract('الشركة');
        const model = extract('الموديل');
        const year = extract('سنة الصنع');

        const parts = [make, model, year].filter(p => p);
        const car_details = parts.length > 0 ? parts.join(' - ') : '';

        const plate_text = extract('رقم اللوحة');
        const service_type = extract('نوع الخدمة');

        return {
            client_name,
            client_phone,
            car_details,
            plate_text,
            service_type,
            // Clean up the text for notes, removing the template keys potentially
            notes: text
        };
    }, []);

    const fetchArchiveData = useCallback(async (startDate: string, endDate: string, query?: string): Promise<ArchiveResult[]> => {
        setIsRefreshing(true);
        try {
            let requestQuery = supabase.from('inspection_requests')
                .select('car_id, client_id, created_at')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            if (query) {
                const q = query.trim();
                const cleanQ = q.replace(/\s/g, '');

                const { data: matchedCars } = await supabase.from('cars').select('id')
                    .or(`plate_number.ilike.%${cleanQ}%,plate_number_en.ilike.%${cleanQ}%,vin.ilike.%${cleanQ}%`);
                const carIdsFromCars = matchedCars?.map(c => c.id) || [];

                const { data: matchedClients } = await supabase.from('clients').select('id')
                    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
                const clientIdsFromClients = matchedClients?.map(c => c.id) || [];

                if (carIdsFromCars.length > 0 || clientIdsFromClients.length > 0) {
                    let orParts = [];
                    if (carIdsFromCars.length > 0) orParts.push(`car_id.in.(${carIdsFromCars.join(',')})`);
                    if (clientIdsFromClients.length > 0) orParts.push(`client_id.in.(${clientIdsFromClients.join(',')})`);
                    requestQuery = requestQuery.or(orParts.join(','));
                } else {
                    return [];
                }
            }

            const { data: requestData, error: reqError } = await requestQuery;
            if (reqError) throw reqError;

            const carIds = Array.from(new Set((requestData || []).map((r: any) => r.car_id))) as string[];
            if (carIds.length === 0) return [];

            const { data: carsData, error: carError } = await supabase.from('cars').select('*').in('id', carIds);
            if (carError) throw carError;

            const clientIds = Array.from(new Set((requestData || []).map((r: any) => r.client_id))) as string[];
            const { data: clientsData, error: clientError } = await supabase.from('clients').select('*').in('id', clientIds);
            if (clientError) throw clientError;

            const carMap = new Map<string, Car>((carsData as Car[] || []).map((c) => [c.id, c]));
            const clientMap = new Map<string, Client>((clientsData as Client[] || []).map((c) => [c.id, c]));

            const results: ArchiveResult[] = [];
            for (const carId of carIds) {
                const car = carMap.get(carId);
                if (!car) continue;

                const carRequestsInPeriod = (requestData || [])
                    .filter((r: any) => r.car_id === carId)
                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                if (carRequestsInPeriod.length === 0) continue;
                const lastRequest = carRequestsInPeriod[0];
                const client = clientMap.get(lastRequest.client_id);

                const make = carMakes.find(m => m.id === car.make_id);
                const model = carModels.find(m => m.id === car.model_id);

                results.push({
                    id: car.id,
                    car: { ...car, make, model },
                    client,
                    lastVisit: lastRequest.created_at,
                    visitCount: carRequestsInPeriod.length
                });
            }
            return results;
        } catch (e) {
            console.error("Fetch archive data error:", e);
            return [];
        } finally {
            setIsRefreshing(false);
        }
    }, [carMakes, carModels, setIsRefreshing]);

    const value: AppContextType = {
        theme, toggleTheme, themeSetting, setThemeSetting, page, setPage, goBack, settingsPage, setSettingsPage,
        requests, clients, cars, carMakes, carModels, fetchCarModelsByMake, inspectionTypes, brokers, employees, expenses, technicians,
        loadMoreRequests, hasMoreRequests, isLoadingMore, searchRequestByNumber, clearSearchedRequests, searchedRequests,
        customFindingCategories, predefinedFindings, selectedRequestId, setSelectedRequestId, selectedClientId, setSelectedClientId,
        authUser, setAuthUser, login, logout, updateOwnPassword, settings, updateSettings, addRequest, updateRequest, deleteRequest, deleteRequestsBatch,
        fetchAndUpdateSingleRequest, updateRequestAndAssociatedData, addClient, updateClient, deleteClient, ensureLocalClient, addCar,
        uploadImage, deleteImage, addInspectionType, updateInspectionType, deleteInspectionType, addFindingCategory,
        updateFindingCategory, deleteFindingCategory, addPredefinedFinding, updatePredefinedFinding, deletePredefinedFinding,
        addCarMake, addCarMakesBulk, updateCarMake, deleteCarMake, deleteAllCarMakes, addCarModel, addCarModelsBulk,
        updateCarModel, deleteCarModel, deleteModelsByMakeId, addBroker, updateBroker, deleteBroker, addEmployee,
        updateEmployee, adminChangePassword, deleteEmployee, addExpense, updateExpense, deleteExpense, notifications, addNotification,
        removeNotification, appNotifications, markNotificationAsRead, markAllNotificationsAsRead, confirmModalState,
        showConfirmModal, hideConfirmModal, isLoading, isRefreshing, isSetupComplete, startSetupProcess, can,
        findOrCreateCarMake, findOrCreateCarModel, initialRequestModalState, setInitialRequestModalState,
        currentDbUsage, currentStorageUsage, newRequestSuccessState, showNewRequestSuccessModal, hideNewRequestSuccessModal,
        shouldPrintDraft, setShouldPrintDraft, fetchFinancialsData, createActivityLog, systemLogs, searchClients,
        searchCars, searchClientsPage, fetchClientRequests, fetchClientRequestsFiltered, getClientFinancialSummary, fetchRequestsByCarId, fetchRequestByRequestNumber, fetchRequestByRequestNumberForAuth, fetchRequestsByDateRange,
        checkCarHistory, highlightedRequestId, triggerHighlight,
        unreadMessagesCount, fetchInboxMessages, fetchSentMessages, sendInternalMessage, markMessageAsRead,
        isFocusMode, setIsFocusMode, hasUnsavedChanges, setHasUnsavedChanges, isMailboxOpen, setIsMailboxOpen,
        searchCarMakes, searchCarModels, searchArchive, expandedArchiveCarId, setExpandedArchiveCarId, addTechnician, updateTechnician, deleteTechnician,
        deferredPrompt, installPwa,
        factoryResetOperations, factoryResetFull,
        fetchServerFinancials, fetchServerExpenses, fetchServerRevenues, addRevenue, deleteRevenue, fetchArchiveData, fetchCarMakes,
        fetchPayrollDraft, savePayrollDraft, checkIfEmployeePaidThisMonth, fetchEmployeeTransactionsForMonth,
        isSessionError,
        incomingRequest, setIncomingRequest,
        reservations, fetchReservations, addReservation, updateReservationStatus, updateReservation, deleteReservation, parseReservationText,
        fetchRequestTabContent, fetchFullRequestForSave, isOnline, realtimeStatus, retryConnection, refreshSessionAndReload,
        lastRemoteDeleteId, setLastRemoteDeleteId
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppContext must be used within an AppProvider');
    return context;
};
