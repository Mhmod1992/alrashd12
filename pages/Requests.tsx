
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import useSessionStorage from '../hooks/useSessionStorage';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { InspectionRequest, RequestStatus, Car, PaymentType, Reservation } from '../types';
import Button from '../components/Button';
import PlusIcon from '../components/icons/PlusIcon';
import SearchIcon from '../components/icons/SearchIcon';
import FilterIcon from '../components/icons/FilterIcon';
import Modal from '../components/Modal';
import ExportRequestsModal from '../components/ExportRequestsModal';
import ImportRequestsModal from '../components/ImportRequestsModal';
import NewRequestForm from '../components/NewRequestForm';
import RequestTable from '../components/RequestTable';
import FileTextIcon from '../components/icons/FileTextIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import XIcon from '../components/icons/XIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import HistoryIcon from '../components/icons/HistoryIcon';
import CreditCardIcon from '../components/icons/CreditCardIcon';
import WhatsappIcon from '../components/icons/WhatsappIcon';
import DollarSignIcon from '../components/icons/DollarSignIcon';
import Icon from '../components/Icon';
import InAppScannerModal from '../components/InAppScannerModal';
import { Skeleton } from '../components/Skeleton';
import { uuidv4, timeAgo } from '../lib/utils';

const StatBlock: React.FC<{ title: string; count: number; icon: React.ReactElement<{ className?: string }>; color: string; }> = ({ title, count, icon, color }) => (
    <div 
        className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 border border-slate-100 dark:border-slate-700 relative overflow-hidden group transition-all hover:shadow-md"
    >
        {/* Subtle background tint */}
        <div 
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none" 
            style={{ backgroundColor: color }}
        />
        
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 flex-shrink-0" style={{ color }}>
            {React.cloneElement(icon, { className: `w-5 h-5 sm:w-6 sm:h-6 ${icon.props.className || ''}` })}
        </div>
        
        <div className="text-center sm:text-right">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{title}</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 font-numeric">{count}</p>
        </div>

        {/* Decorative accent line */}
        <div 
            className="absolute bottom-0 right-0 h-1 w-1/3 rounded-tl-full opacity-50"
            style={{ backgroundColor: color }}
        />
    </div>
);


const Requests: React.FC = () => {
    const {
        requests, clients, cars, carMakes, carModels, inspectionTypes, brokers, can, authUser, settings,
        initialRequestModalState, setInitialRequestModalState,
        searchedRequests, searchRequestByNumber, clearSearchedRequests,
        loadMoreRequests, hasMoreRequests, isLoadingMore, isRefreshing,
        setPage, selectedRequestId, setSelectedRequestId, addNotification, fetchRequestsByCarId, sendWhatsAppMessage,
        updateRequest, employees, showConfirmModal, fetchRequestsByDateRange,
        fetchRequestByRequestNumber, reservations, updateReservationStatus, addRequest, fetchReservations,
        searchClients, addClient, addCar, searchCarMakes, searchCarModels, fetchCarModelsByMake,
        lastRemoteDeleteId, fetchRequests, fetchRequestsCount, triggerHighlight, searchReservations
    } = useAppContext();

    const [requestNumberQuery, setRequestNumberQuery] = useSessionStorage('requests_number_query', '');
    const [comprehensiveQuery, setComprehensiveQuery] = useSessionStorage('requests_comprehensive_query', '');
    const [waitingSearchTerm, setWaitingSearchTerm] = useSessionStorage('requests_waiting_search', '');
    const [statusFilter, setStatusFilter] = useSessionStorage<RequestStatus | 'الكل' | 'active'>('requests_status_filter', 'الكل');
    const [employeeFilter, setEmployeeFilter] = useSessionStorage<string>('requests_employee_filter', 'الكل');

    // Date Filter State
    const [dateFilter, setDateFilter] = useSessionStorage<'today' | 'all' | 'yesterday' | 'month' | 'range'>('requests_date_filter', 'today');
    const [rangeStartDate, setRangeStartDate] = useSessionStorage('requests_range_start', '');
    const [rangeEndDate, setRangeEndDate] = useSessionStorage('requests_range_end', '');
    const [serverFetchedData, setServerFetchedData] = useState<InspectionRequest[] | null>(null);
    const [isFetchingDateRange, setIsFetchingDateRange] = useState(false);
    const [dbTotalCount, setDbTotalCount] = useState<number | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [requestToUpdate, setRequestToUpdate] = useState<InspectionRequest | null>(null);
    const [plateDisplayLanguage, setPlateDisplayLanguage] = useSessionStorage<'ar' | 'en'>('requests_plate_lang', 'ar');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [showStats, setShowStats] = useState(false);

    // Search Debounce Ref
    const searchDebounceRef = useRef<number | null>(null);
    const isFirstMount = useRef(true);

    // State for Car History Modal
    const [historyModalCar, setHistoryModalCar] = useState<{ carId: string, carName: string } | null>(null);
    const [carHistoryRequests, setCarHistoryRequests] = useState<InspectionRequest[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentRequest, setPaymentRequest] = useState<InspectionRequest | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentType>(PaymentType.Cash);
    const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
    const [splitCardAmount, setSplitCardAmount] = useState<number>(0);

    const [isReservationsAccordionOpen, setIsReservationsAccordionOpen] = useState(false);
    const [reservationMiniSearchTerm, setReservationMiniSearchTerm] = useState('');
    const [reservationMiniFilter, setReservationMiniFilter] = useState<'today' | 'yesterday' | 'all'>('today');
    const [reservationSearchResults, setReservationSearchResults] = useState<Reservation[] | null>(null);
    const [isSearchingReservations, setIsSearchingReservations] = useState(false);
    const [selectedNote, setSelectedNote] = useState<string | null>(null);
    const [prefilledReservation, setPrefilledReservation] = useState<Reservation | null>(null);

    const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);

    // Smart Back Logic: Scroll to and highlight the selected request when returning to the page
    useEffect(() => {
        if (selectedRequestId) {
            // Check if we should skip scroll restoration (e.g. after completing a request)
            const skipScroll = window.sessionStorage.getItem('skipScrollRestoration');
            if (skipScroll === 'true') {
                window.sessionStorage.removeItem('skipScrollRestoration');
                setSelectedRequestId(null);
                return;
            }

            // Wait for the table to render and data to be ready
            const timer = setTimeout(() => {
                const element = document.getElementById(`request-row-${selectedRequestId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    triggerHighlight(selectedRequestId);
                    // Clear the selected ID after a delay to prevent re-triggering on every render
                    // but keep it long enough for the highlight animation to be visible
                    setTimeout(() => setSelectedRequestId(null), 3000);
                }
            }, 800); // Slightly longer delay to ensure table data is loaded
            return () => clearTimeout(timer);
        }
    }, [selectedRequestId, triggerHighlight, setSelectedRequestId]);
    const actionsMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
                setIsActionsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fixed: Added 'border' class to ensure borders are visible
    const searchInputClasses = "block w-full p-3 pl-10 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";
    const formInputClasses = searchInputClasses;

    const isLoadingData = isFetchingDateRange || isRefreshing;

    useEffect(() => {
        let timerId: number;
        if (isLoadingData) {
            setShowStats(false);
        } else {
            // After loading finishes (initial or refresh), wait briefly to show stats (fractions of a second)
            timerId = window.setTimeout(() => {
                setShowStats(true);
            }, 100);
        }
        // Cleanup timer on unmount or if loading state changes again
        return () => window.clearTimeout(timerId);
    }, [isLoadingData]);

    // --- INITIALIZATION EFFECT ---
    useEffect(() => {
        if (isFirstMount.current) {
            // NOTE: We do NOT clear searchedRequests here anymore to allow Header search to persist.
            // Clearing should be handled by the navigation source (Sidebar/Dashboard).
            isFirstMount.current = false;
        }

        if (initialRequestModalState === 'new') {
            if (can('create_requests')) {
                setIsModalOpen(true);
            }
            setInitialRequestModalState(null);
        }
    }, [initialRequestModalState, setInitialRequestModalState, can]);

    const handleProcessing = () => {
        setIsModalOpen(false);
        setIsProcessingModalOpen(true);
    };

    // Smart search for reservations in accordion
    useEffect(() => {
        if (!reservationMiniSearchTerm.trim()) {
            setReservationSearchResults(null);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingReservations(true);
            try {
                const results = await searchReservations(reservationMiniSearchTerm);
                setReservationSearchResults(results);
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsSearchingReservations(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [reservationMiniSearchTerm, searchReservations]);

    const filteredMiniReservations = useMemo(() => {
        const source = reservationSearchResults !== null ? reservationSearchResults : reservations;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;

        return source.filter(res => {
            if (reservationSearchResults !== null) return true; // Already filtered by DB search

            // Filter by status (only 'new' or 'confirmed'?)
            if (res.status === 'converted' || res.status === 'cancelled') return false;

            // Filter by date
            const resDate = new Date(res.created_at).getTime();
            if (reservationMiniFilter === 'today') {
                if (resDate < today) return false;
            } else if (reservationMiniFilter === 'yesterday') {
                if (resDate < yesterday || resDate >= today) return false;
            }

            return true;
        });
    }, [reservations, reservationMiniFilter, reservationSearchResults]);

    const todayNewReservationsCount = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return reservations.filter(r => r.status === 'new' && new Date(r.created_at).getTime() >= today).length;
    }, [reservations]);

    // Ensure car models are loaded for reservations to show English names
    useEffect(() => {
        const makeIds = new Set(reservations.map(r => r.car_make_id).filter(Boolean) as string[]);
        makeIds.forEach(id => fetchCarModelsByMake(id));
    }, [reservations, fetchCarModelsByMake]);

    const handleConvertReservation = (res: Reservation) => {
        setPrefilledReservation(res);
        setIsModalOpen(true);
    };

    const handleSuccess = (newRequest?: InspectionRequest) => {
        setIsProcessingModalOpen(false);
        if (prefilledReservation) {
            updateReservationStatus(prefilledReservation.id, 'converted');
            setPrefilledReservation(null);
        }
    };

    // --- REAL-TIME SYNC FOR FILTERED DATA ---
    useEffect(() => {
        if (!serverFetchedData) return;

        let hasChanges = false;
        let newData = [...serverFetchedData];
        
        // Custom Date Logic: Day starts at 4 AM
        const now = new Date();
        if (now.getHours() < 4) {
            now.setDate(now.getDate() - 1);
        }
        const todayStr = now.toLocaleDateString('en-CA');

        // 1. Update Existing items
        newData = newData.map(localItem => {
            const freshItem = requests.find(r => r.id === localItem.id);
            if (freshItem && (
                freshItem.status !== localItem.status || 
                freshItem.updated_at !== localItem.updated_at ||
                JSON.stringify(freshItem.report_stamps) !== JSON.stringify(localItem.report_stamps) ||
                freshItem.payment_type !== localItem.payment_type ||
                freshItem.price !== localItem.price
            )) {
                hasChanges = true;
                return freshItem;
            }
            return localItem;
        });

        // 2. Insert New items (Only for 'Today' filter)
        if (dateFilter === 'today') {
            requests.forEach(req => {
                const reqDate = new Date(req.created_at).toLocaleDateString('en-CA');
                if (reqDate === todayStr && !newData.find(r => r.id === req.id)) {
                    newData.unshift(req);
                    hasChanges = true;
                }
            });
        }

        if (hasChanges) {
            newData.sort((a, b) => {
                const aIsComplete = a.status === RequestStatus.COMPLETE;
                const bIsComplete = b.status === RequestStatus.COMPLETE;
                
                if (aIsComplete && !bIsComplete) return 1;
                if (!aIsComplete && bIsComplete) return -1;

                const dateA = new Date(a.created_at);
                const dateB = new Date(b.created_at);
                // Adjust for 4 AM shift start: treat 00:00-03:59 as "next day" (add 24h) for sorting
                if (dateA.getHours() < 4) dateA.setHours(dateA.getHours() + 24);
                if (dateB.getHours() < 4) dateB.setHours(dateB.getHours() + 24);
                return dateB.getTime() - dateA.getTime();
            });
            setServerFetchedData(newData);
        }

    }, [requests, dateFilter]); 

    // --- Listen for Remote Deletion Events ---
    useEffect(() => {
        if (lastRemoteDeleteId && serverFetchedData) {
            setServerFetchedData(prev => prev ? prev.filter(r => r.id !== lastRemoteDeleteId) : null);
        }
    }, [lastRemoteDeleteId]);

    // --- DATABASE TOTAL COUNT FETCHING ---
    useEffect(() => {
        const fetchCount = async () => {
            let start: string | undefined;
            let end: string | undefined;

            if (dateFilter !== 'all') {
                const now = new Date();
                if (now.getHours() < 4) now.setDate(now.getDate() - 1);

                const s = new Date(now);
                const e = new Date(now);

                if (dateFilter === 'today') {
                    s.setHours(0, 0, 0, 0);
                    e.setHours(23, 59, 59, 999);
                } else if (dateFilter === 'yesterday') {
                    s.setDate(now.getDate() - 1);
                    s.setHours(0, 0, 0, 0);
                    e.setDate(now.getDate() - 1);
                    e.setHours(23, 59, 59, 999);
                } else if (dateFilter === 'month') {
                    s.setDate(1);
                    s.setHours(0, 0, 0, 0);
                    e.setMonth(now.getMonth() + 1, 0);
                    e.setHours(23, 59, 59, 999);
                } else if (dateFilter === 'range' && rangeStartDate && rangeEndDate) {
                    s.setTime(new Date(rangeStartDate).getTime());
                    s.setHours(0, 0, 0, 0);
                    e.setTime(new Date(rangeEndDate).getTime());
                    e.setHours(23, 59, 59, 999);
                } else if (dateFilter === 'range') {
                    return; // Wait for range to be applied
                }
                start = s.toISOString();
                end = e.toISOString();
            }

            const count = await fetchRequestsCount(start, end);
            setDbTotalCount(count);
        };

        fetchCount();
    }, [dateFilter, rangeStartDate, rangeEndDate, fetchRequestsCount, requests.length]);

    const [isSearching, setIsSearching] = useState(false);

    const clearFilters = useCallback(() => {
        setRequestNumberQuery('');
        setComprehensiveQuery('');
        setStatusFilter('الكل');
        setEmployeeFilter('الكل');
        setRangeStartDate('');
        setRangeEndDate('');
        setDateFilter('today'); 
        clearSearchedRequests();

        // Clear search from URL
        const params = new URLSearchParams(window.location.search);
        let changed = false;
        if (params.has('search')) {
            params.delete('search');
            changed = true;
        }
        if (params.has('order_id')) {
            params.delete('order_id');
            changed = true;
        }
        if (changed) {
            const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
            window.history.replaceState(window.history.state, '', newUrl);
        }
    }, [setRequestNumberQuery, setComprehensiveQuery, setStatusFilter, setEmployeeFilter, setRangeStartDate, setRangeEndDate, setDateFilter, clearSearchedRequests]);

    // --- SEARCH EXECUTION ---
    const executeSearch = useCallback((orderIdTerm?: string, generalTerm?: string) => {
        if (searchDebounceRef.current) {
            window.clearTimeout(searchDebounceRef.current);
        }

        const params = new URLSearchParams(window.location.search);
        
        // Use provided terms or fall back to current state
        const finalOrderId = orderIdTerm !== undefined ? orderIdTerm.trim() : requestNumberQuery.trim();
        const finalGeneral = generalTerm !== undefined ? generalTerm.trim() : comprehensiveQuery.trim();

        // Sync to URL
        if (finalOrderId) {
            params.set('order_id', finalOrderId);
        } else {
            params.delete('order_id');
        }

        if (finalGeneral) {
            params.set('search', finalGeneral);
        } else {
            params.delete('search');
        }

        const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
        window.history.replaceState(window.history.state, '', newUrl);

        if (!finalOrderId && !finalGeneral) {
            // If both search fields are empty, reset all filters to default
            clearFilters();
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        searchDebounceRef.current = window.setTimeout(async () => {
            // Priority: If Order ID is present, search by it (exact)
            if (finalOrderId) {
                await searchRequestByNumber(finalOrderId, true);
            } else if (finalGeneral) {
                await searchRequestByNumber(finalGeneral, false);
            }
            setIsSearching(false);
        }, 400);
    }, [requestNumberQuery, comprehensiveQuery, searchRequestByNumber, clearSearchedRequests, clearFilters]);

    const handleRequestNumberQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value.replace(/\D/g, '');
        setRequestNumberQuery(term);
        // Independent: No longer clearing comprehensiveQuery
        executeSearch(term, undefined);
    };

    const handleComprehensiveQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setComprehensiveQuery(term);
        // Independent: No longer clearing requestNumberQuery
        executeSearch(undefined, term);
    };

    const searchInitialized = useRef(false);

    // Initialize search from URL params
    useEffect(() => {
        if (searchInitialized.current) return;

        const params = new URLSearchParams(window.location.search);
        const orderIdParam = params.get('order_id');
        const searchParam = params.get('search');
        
        let shouldSearch = false;

        if (orderIdParam) {
            setRequestNumberQuery(orderIdParam);
            shouldSearch = true;
        }
        
        if (searchParam) {
            setComprehensiveQuery(searchParam);
            shouldSearch = true;
        }

        if (shouldSearch) {
            setDateFilter('all');
            executeSearch(orderIdParam || undefined, searchParam || undefined);
            searchInitialized.current = true;
        }
    }, [executeSearch, setRequestNumberQuery, setComprehensiveQuery, setDateFilter]);

    // --- SERVER SIDE DATE FETCHING LOGIC ---
    const executeDateFetch = useCallback(async (start: string, end: string) => {
        setIsFetchingDateRange(true);
        setServerFetchedData(null);
        clearSearchedRequests();
        setRequestNumberQuery('');
        setComprehensiveQuery('');

        try {
            const data = await fetchRequestsByDateRange(start, end);
            setServerFetchedData(data);
        } catch (error) {
            console.error("Date fetch failed", error);
            addNotification({ title: 'خطأ', message: 'فشل جلب البيانات.', type: 'error' });
        } finally {
            setIsFetchingDateRange(false);
        }
    }, [fetchRequestsByDateRange, clearSearchedRequests, addNotification]);

    useEffect(() => {
        // Custom Date Logic: Day starts at 4 AM
        const now = new Date();
        const currentHour = now.getHours();
        
        // If before 4 AM, we are still in the "previous" day logically
        if (currentHour < 4) {
            now.setDate(now.getDate() - 1);
        }

        let start = new Date(now);
        let end = new Date(now);

        if (dateFilter === 'all') {
            setServerFetchedData(null); 
            return;
        }

        if (dateFilter === 'range') {
            return;
        }

        if (dateFilter === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (dateFilter === 'yesterday') {
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(now.getDate() - 1);
            end.setHours(23, 59, 59, 999);
        } else if (dateFilter === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }

        executeDateFetch(start.toISOString(), end.toISOString());

    }, [dateFilter]); // eslint-disable-next-line react-hooks/exhaustive-deps

    const handleApplyCustomRange = () => {
        if (!rangeStartDate || !rangeEndDate) return;
        const start = new Date(rangeStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(rangeEndDate);
        end.setHours(23, 59, 59, 999);
        executeDateFetch(start.toISOString(), end.toISOString());
    };

    const handleOpenUpdateModal = (request: InspectionRequest) => {
        setRequestToUpdate(request);
        setIsUpdateModalOpen(true);
    };

    const handleRowClick = (requestId: string) => {
        setSelectedRequestId(requestId);
        setPage('fill-request');
    };

    const handleOpenHistoryModal = async (event: React.MouseEvent, carId: string, carName: string) => {
        event.stopPropagation();
        setHistoryModalCar({ carId, carName });
        setIsLoadingHistory(true);
        try {
            const history = await fetchRequestsByCarId(carId);
            setCarHistoryRequests(history);
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل تحميل سجل السيارة.', type: 'error' });
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleScanSuccess = async (decodedText: string) => {
        console.log("Scanner Success RAW:", decodedText);
        const trimmedText = decodedText.trim();
        let requestNumber: number | null = null;
        let isDraftCode = false;

        if (trimmedText.startsWith('AERO-DRAFT-')) {
            isDraftCode = true;
            requestNumber = parseInt(trimmedText.replace('AERO-DRAFT-', ''), 10);
        } else {
            try {
                const url = new URL(trimmedText);
                const pathParts = url.pathname.split('/');
                const numberPart = pathParts.pop();
                if (numberPart && /^\d+$/.test(numberPart)) {
                    requestNumber = parseInt(numberPart, 10);
                }
            } catch (e) {
                if (trimmedText.startsWith('AERO-REPORT-')) {
                    requestNumber = parseInt(trimmedText.replace('AERO-REPORT-', ''), 10);
                } else if (/^\d+$/.test(trimmedText)) {
                    requestNumber = parseInt(trimmedText, 10);
                }
            }
        }

        console.log("Parsed Request Number:", requestNumber, "isDraft:", isDraftCode);

        if (!requestNumber || isNaN(requestNumber)) {
            addNotification({ title: 'خطأ', message: 'رمز QR غير صالح أو لا يمكن قراءته.', type: 'error' });
            setIsScannerOpen(false);
            return;
        }

        setIsScannerOpen(false);
        const request = await fetchRequestByRequestNumber(requestNumber);

        if (!request) {
            addNotification({ title: 'غير موجود', message: `لم يتم العثور على الطلب رقم ${requestNumber} في النظام.`, type: 'warning' });
            return;
        }

        setSelectedRequestId(request.id);

        if (isDraftCode) {
            if (request.status === RequestStatus.COMPLETE) {
                setPage('print-report');
            } else {
                setPage('fill-request');
            }
        } else {
            if (request.status === RequestStatus.COMPLETE) {
                setPage('print-report');
            } else {
                setPage('fill-request');
            }
        }
    };


    const handleProcessPaymentClick = (request: InspectionRequest) => {
        setPaymentRequest(request);
        setPaymentMethod(PaymentType.Cash);
        setSplitCashAmount(0);
        setSplitCardAmount(request.price);
        setIsPaymentModalOpen(true);
    };

    const handleSplitCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setSplitCashAmount(val);
        if (paymentRequest) {
            setSplitCardAmount(paymentRequest.price - val);
        }
    };

    const handleResendWhatsApp = async (request: InspectionRequest) => {
        const client = clients.find(c => c.id === request.client_id);
        if (!client || !client.phone) {
            addNotification({ title: 'خطأ', message: 'رقم هاتف العميل غير موجود.', type: 'error' });
            return;
        }

        let phone = client.phone.replace(/\D/g, '');
        if (phone.startsWith('05')) {
            phone = '966' + phone.substring(1);
        } else if (phone.length === 9 && phone.startsWith('5')) {
            phone = '966' + phone;
        }

        const message = `مرحباً ${client.name}،\n\nنود تذكيركم بالطلب رقم #${request.request_number} الذي لا يزال بانتظار الدفع.\n\nالمبلغ المطلوب: ${request.price} ريال.\n\nشكراً لكم.`;

        await sendWhatsAppMessage(phone, message);
    };

    const confirmPayment = async () => {
        if (!paymentRequest) return;
        if (paymentMethod === PaymentType.Split) {
            if (splitCashAmount + splitCardAmount !== paymentRequest.price) {
                addNotification({ title: 'خطأ', message: 'مجموع المبالغ لا يساوي قيمة الطلب.', type: 'error' });
                return;
            }
        }

        try {
            await updateRequest({
                id: paymentRequest.id,
                status: RequestStatus.NEW,
                payment_type: paymentMethod,
                split_payment_details: paymentMethod === PaymentType.Split ? { cash: splitCashAmount, card: splitCardAmount } : undefined
            });
            addNotification({ title: 'نجاح', message: 'تم استلام الدفعة وتفعيل الطلب.', type: 'success' });
            setIsPaymentModalOpen(false);
            setPaymentRequest(null);
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل معالجة الدفع.', type: 'error' });
        }
    };

    const handleDeleteSuccess = useCallback((id: string) => {
        if (serverFetchedData) {
            setServerFetchedData(prev => prev ? prev.filter(r => r.id !== id) : null);
        }
    }, [serverFetchedData]);

    const isLoadMoreVisible = searchedRequests === null && serverFetchedData === null && hasMoreRequests && dateFilter === 'all';
    const isAnyFilterActive = requestNumberQuery.trim() !== '' || comprehensiveQuery.trim() !== '' || statusFilter !== 'الكل' || employeeFilter !== 'الكل' || dateFilter !== 'today';

    const [displayLimit, setDisplayLimit] = useSessionStorage('requests_display_limit', 10);
    const [isPaginatingLocal, setIsPaginatingLocal] = useState(false);
    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        setDisplayLimit(10);
    }, [dateFilter, statusFilter, employeeFilter, requestNumberQuery, comprehensiveQuery, waitingSearchTerm]);

    const { dataToDisplay, waitingPaymentRequests, carsWithHistory } = useMemo(() => {
        let sourceData: InspectionRequest[];

        if (searchedRequests !== null) {
            sourceData = searchedRequests;
        }
        else if (serverFetchedData !== null) {
            sourceData = serverFetchedData;
        }
        else {
            sourceData = requests;
        }

        const carIdToRequestCount = new Map<string, number>();
        requests.forEach(req => {
            carIdToRequestCount.set(req.car_id, (carIdToRequestCount.get(req.car_id) || 0) + 1);
        });
        const carsWithHistorySet = new Set<string>();
        carIdToRequestCount.forEach((count, carId) => {
            if (count > 1) {
                carsWithHistorySet.add(carId);
            }
        });

        let waitingReqs: InspectionRequest[] = [];
        let otherReqs: InspectionRequest[] = [];

        if (authUser?.role !== 'receptionist') {
            waitingReqs = sourceData.filter(r => r.status === RequestStatus.WAITING_PAYMENT);
            otherReqs = sourceData.filter(r => r.status !== RequestStatus.WAITING_PAYMENT);
        } else {
            otherReqs = sourceData;
        }

        if (waitingSearchTerm.trim()) {
            waitingReqs = waitingReqs.filter(r => String(r.request_number).includes(waitingSearchTerm.trim()));
        }

        let statusFilteredReqs = otherReqs.filter(req => {
            if (statusFilter === 'الكل') return true;
            if (statusFilter === 'active') return req.status === RequestStatus.NEW || req.status === RequestStatus.IN_PROGRESS;
            return req.status === statusFilter;
        });

        if (employeeFilter !== 'الكل') {
            statusFilteredReqs = statusFilteredReqs.filter(req => req.employee_id === employeeFilter);
        }

        if (!can('view_completed_requests')) {
            statusFilteredReqs = statusFilteredReqs.filter(req => req.status !== RequestStatus.COMPLETE);
        }

        statusFilteredReqs.sort((a, b) => {
            const aIsComplete = a.status === RequestStatus.COMPLETE;
            const bIsComplete = b.status === RequestStatus.COMPLETE;
            
            if (aIsComplete && !bIsComplete) return 1;
            if (!aIsComplete && bIsComplete) return -1;

            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            // Adjust for 4 AM shift start: treat 00:00-03:59 as "next day" (add 24h) for sorting
            if (dateA.getHours() < 4) dateA.setHours(dateA.getHours() + 24);
            if (dateB.getHours() < 4) dateB.setHours(dateB.getHours() + 24);
            return dateB.getTime() - dateA.getTime();
        });

        return { dataToDisplay: statusFilteredReqs, waitingPaymentRequests: waitingReqs, carsWithHistory: carsWithHistorySet };
    }, [requests, searchedRequests, serverFetchedData, statusFilter, employeeFilter, authUser, waitingSearchTerm, can]);


    const [serverCarsWithHistory, setServerCarsWithHistory] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchHistory = async () => {
             const uniqueCarIds = Array.from(new Set(dataToDisplay.map(r => r.car_id))).filter(Boolean);
             if (uniqueCarIds.length === 0) return;

             const chunks = [];
             const chunkSize = 20;
             for (let i = 0; i < uniqueCarIds.length; i += chunkSize) {
                 chunks.push(uniqueCarIds.slice(i, i + chunkSize));
             }

             const newHistorySet = new Set<string>();

             for (const chunk of chunks) {
                 const { data } = await supabase
                     .from('inspection_requests')
                     .select('car_id')
                     .in('car_id', chunk);
                 
                 if (data) {
                     const counts = new Map<string, number>();
                     data.forEach((row: any) => {
                         counts.set(row.car_id, (counts.get(row.car_id) || 0) + 1);
                     });
                     counts.forEach((count, id) => {
                         if (count > 1) newHistorySet.add(id);
                     });
                 }
             }
             
             setServerCarsWithHistory(prev => {
                 const next = new Set(prev);
                 newHistorySet.forEach(id => next.add(id));
                 return next;
             });
        };

        const timeoutId = setTimeout(fetchHistory, 1000);
        return () => clearTimeout(timeoutId);
    }, [dataToDisplay]);

    const combinedCarsWithHistory = useMemo(() => {
        const combined = new Set(carsWithHistory);
        serverCarsWithHistory.forEach(id => combined.add(id));
        return combined;
    }, [carsWithHistory, serverCarsWithHistory]);

    const totalCount = dbTotalCount !== null && searchedRequests === null ? dbTotalCount : (dataToDisplay.length + waitingPaymentRequests.length);
    const newCount = dataToDisplay.filter(r => r.status === RequestStatus.NEW).length;
    const inProgressCount = dataToDisplay.filter(r => r.status === RequestStatus.IN_PROGRESS).length;
    const completeCount = dataToDisplay.filter(r => r.status === RequestStatus.COMPLETE).length;

    const activeFilterClasses = 'bg-white dark:bg-slate-700 shadow-md text-blue-600 dark:text-blue-400';
    const inactiveFilterClasses = 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50';

    const DateFilterButton: React.FC<{ filter: 'all' | 'today' | 'yesterday' | 'month' | 'range'; label: string }> = ({ filter, label }) => (
        <button
            onClick={() => setDateFilter(filter)}
            className={`flex-1 md:flex-1 min-w-[80px] md:min-w-0 text-center font-bold py-2 px-3 rounded-lg transition-all duration-200 text-xs sm:text-sm whitespace-nowrap ${dateFilter === filter ? activeFilterClasses : inactiveFilterClasses}`}
        >
            {label}
        </button>
    );

    const creatorEmployee = useMemo(() => {
        if (!paymentRequest || !employees) return null;
        return employees.find(e => e.id === paymentRequest.employee_id);
    }, [paymentRequest, employees]);

    const paginatedDataToDisplay = useMemo(() => {
        if (dateFilter === 'today') {
            return dataToDisplay;
        }
        return dataToDisplay.slice(0, displayLimit);
    }, [dataToDisplay, displayLimit, dateFilter]);

    const handleLoadMore = useCallback(() => {
        if (displayLimit < dataToDisplay.length && !isPaginatingLocal) {
            setIsPaginatingLocal(true);
            setTimeout(() => {
                setDisplayLimit(prev => prev + 10);
                setIsPaginatingLocal(false);
            }, 500);
        } else if (displayLimit >= dataToDisplay.length && isLoadMoreVisible && !isLoadingMore) {
            loadMoreRequests();
        }
    }, [displayLimit, dataToDisplay.length, isPaginatingLocal, isLoadMoreVisible, isLoadingMore, loadMoreRequests]);

    return (
        <div className="container mx-auto">
            <div className="flex flex-col md:grid md:grid-cols-3 items-center justify-between mb-8 gap-4">
                {/* 1. Page Title (Right) */}
                <div className="text-center md:text-right order-1 relative" ref={actionsMenuRef}>
                    <button 
                        onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
                        className="flex items-center justify-center md:justify-start gap-2 w-full md:w-auto hover:opacity-80 transition-opacity"
                    >
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">إدارة الطلبات</h2>
                        {can('create_requests') && (
                            <Icon name="chevron-down" className={`w-6 h-6 text-slate-500 transition-transform ${isActionsMenuOpen ? 'rotate-180' : ''}`} />
                        )}
                    </button>
                    
                    {isActionsMenuOpen && can('create_requests') && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden">
                            <button
                                onClick={() => { setIsImportModalOpen(true); setIsActionsMenuOpen(false); }}
                                className="w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
                            >
                                <Icon name="upload" className="w-4 h-4 text-blue-500" />
                                <span>استيراد طلبات</span>
                            </button>
                            <button
                                onClick={() => { setIsExportModalOpen(true); setIsActionsMenuOpen(false); }}
                                className="w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors border-t border-slate-100 dark:border-slate-700"
                            >
                                <Icon name="download" className="w-4 h-4 text-emerald-500" />
                                <span>تصدير طلبات</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. Main Actions (Center) */}
                <div className="flex items-center justify-center gap-3 order-3 md:order-2 w-full">
                    {can('create_requests') && (
                        <div className="flex gap-2">
                            <Button 
                                onClick={() => setIsModalOpen(true)} 
                                leftIcon={<PlusIcon className="w-5 h-5" />}
                                className="shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all px-8 py-2.5 font-bold text-lg"
                            >
                                إنشاء طلب جديد
                            </Button>
                        </div>
                    )}
                </div>
                
                {/* 3. Empty Spacer for Balance (Left) */}
                <div className="hidden md:block order-3"></div>
            </div>

            {/* The Hybrid Hub: Reservations Accordion */}
            <div className="mb-6">
                <button
                    onClick={() => setIsReservationsAccordionOpen(!isReservationsAccordionOpen)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 shadow-sm border ${
                        isReservationsAccordionOpen 
                        ? 'bg-blue-600 text-white border-blue-500' 
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isReservationsAccordionOpen ? 'bg-white/20' : 'bg-blue-50 dark:bg-blue-900/30'}`}>
                            <Icon name="calendar-check" className={`w-5 h-5 ${isReservationsAccordionOpen ? 'text-white' : 'text-blue-600'}`} />
                        </div>
                        <span className="font-bold text-lg">حجوزات اليوم الواردة</span>
                        {todayNewReservationsCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
                                {todayNewReservationsCount}
                            </span>
                        )}
                    </div>
                    <Icon 
                        name="chevron-down" 
                        className={`w-6 h-6 transition-transform duration-300 ${isReservationsAccordionOpen ? 'rotate-180' : ''}`} 
                    />
                </button>

                {isReservationsAccordionOpen && (
                    <div className="mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-in-down">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                            <div className="flex items-center bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg shadow-inner w-full md:w-auto">
                                <button
                                    onClick={() => setReservationMiniFilter('today')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${reservationMiniFilter === 'today' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}
                                >
                                    اليوم
                                </button>
                                <button
                                    onClick={() => setReservationMiniFilter('yesterday')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${reservationMiniFilter === 'yesterday' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}
                                >
                                    أمس
                                </button>
                                <button
                                    onClick={() => setReservationMiniFilter('all')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${reservationMiniFilter === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}
                                >
                                    الكل
                                </button>
                            </div>

                            <div className="relative w-full md:w-64">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <SearchIcon className="h-4 w-4 text-slate-400" />
                                </span>
                                <input
                                    type="text"
                                    placeholder="بحث ذكي (رقم، عميل، سيارة، هاتف)..."
                                    value={reservationMiniSearchTerm}
                                    onChange={(e) => setReservationMiniSearchTerm(e.target.value)}
                                    className="block w-full p-2 pl-9 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500"
                                />
                                {isSearchingReservations && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <RefreshCwIcon className="w-3 h-3 animate-spin text-blue-500" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                                    <tr>
                                        <th className="p-3">رقم الحجز</th>
                                        <th className="p-3">السيارة</th>
                                        <th className="p-3">العميل</th>
                                        <th className="p-3">الملاحظات</th>
                                        <th className="p-3">الحالة</th>
                                        <th className="p-3 text-center">الإجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {filteredMiniReservations.map(res => {
                                        const isWhatsApp = res.source_text?.toLowerCase().includes('whatsapp') || res.source_text?.includes('واتساب');
                                        
                                        return (
                                            <tr key={res.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                                <td className="p-3 font-mono text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-blue-600 dark:text-blue-400 font-bold">
                                                            {res.reservation_number ? `#RSV-${String(res.reservation_number).padStart(4, '0')}` : '---'}
                                                        </span>
                                                        {isWhatsApp && (
                                                            <div className="bg-green-100 dark:bg-green-900/30 p-1 rounded-full" title="حجز واتساب">
                                                                <WhatsappIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-medium text-slate-700 dark:text-slate-300">
                                                        {(() => {
                                                            const make = carMakes.find(m => m.id === res.car_make_id);
                                                            const model = carModels.find(m => m.id === res.car_model_id);
                                                            if (make && model) {
                                                                return `${make.name_en} ${model.name_en}`;
                                                            }
                                                            return res.car_details;
                                                        })()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{res.plate_text}</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{res.client_name}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono">{res.client_phone}</div>
                                                </td>
                                                <td className="p-3 max-w-[150px]">
                                                    {res.notes ? (
                                                        <div 
                                                            className="relative overflow-hidden cursor-pointer hover:text-blue-500 transition-colors"
                                                            onClick={() => setSelectedNote(res.notes || null)}
                                                        >
                                                            <div className={`${res.notes.length > 25 ? 'animate-marquee whitespace-nowrap' : ''} text-xs text-slate-600 dark:text-slate-400`}>
                                                                {res.notes}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        res.status === 'new' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                                        res.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                                                        res.status === 'converted' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' :
                                                        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                                    }`}>
                                                        {res.status === 'new' ? 'جديد' : 
                                                         res.status === 'confirmed' ? 'مؤكد' : 
                                                         res.status === 'converted' ? 'تم التحويل' : 'ملغي'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => handleConvertReservation(res)}
                                                        disabled={res.status === 'converted'}
                                                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm ${
                                                            res.status === 'converted' 
                                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                                        }`}
                                                    >
                                                        <Icon name="refresh-cw" className="w-3 h-3" />
                                                        <span>تحويل</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredMiniReservations.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400 italic text-xs">
                                                {isSearchingReservations ? 'جاري البحث...' : 'لا توجد حجوزات تطابق البحث'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-6 space-y-4 animate-slide-in-down">
                {searchedRequests === null && (
                    <>
                        {showStats ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                                <StatBlock title="إجمالي المعروض" count={totalCount} icon={<FileTextIcon />} color="#3b82f6" />
                                <StatBlock title="جديد" count={newCount} icon={<SparklesIcon className="animate-pulse" />} color="#8b5cf6" />
                                <StatBlock title="قيد التنفيذ" count={inProgressCount} icon={<RefreshCwIcon className="animate-spin" />} color="#f59e0b" />
                                <StatBlock title="مكتمل" count={completeCount} icon={<CheckCircleIcon />} color="#10b981" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Skeleton className="h-24 rounded-lg" />
                                <Skeleton className="h-24 rounded-lg" />
                                <Skeleton className="h-24 rounded-lg" />
                                <Skeleton className="h-24 rounded-lg" />
                            </div>
                        )}
                    </>
                )}

                <div className={`${searchedRequests === null ? 'border-t border-slate-200 dark:border-slate-700 pt-4' : ''} space-y-4`}>
                    {searchedRequests === null && (
                        <div className="bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl shadow-inner w-full overflow-x-auto no-scrollbar">
                            <div className="flex items-center min-w-max md:min-w-0 md:w-full gap-1">
                                <DateFilterButton filter="today" label="اليوم" />
                                <DateFilterButton filter="yesterday" label="أمس" />
                                <DateFilterButton filter="month" label="هذا الشهر" />
                                <DateFilterButton filter="range" label="نطاق محدد" />
                                <DateFilterButton filter="all" label="الكل" />
                            </div>
                        </div>
                    )}

                    {searchedRequests === null && dateFilter === 'range' && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-2 animate-fade-in">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">من تاريخ</label>
                                <input type="date" value={rangeStartDate} onChange={e => setRangeStartDate(e.target.value)} className={formInputClasses.replace('p-3 pl-10', 'p-2.5')} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">إلى تاريخ</label>
                                <input type="date" value={rangeEndDate} onChange={e => setRangeEndDate(e.target.value)} className={formInputClasses.replace('p-3 pl-10', 'p-2.5')} />
                            </div>
                            <div className="md:col-span-2">
                                <Button onClick={handleApplyCustomRange} disabled={isFetchingDateRange || !rangeStartDate || !rangeEndDate}>
                                    {isFetchingDateRange ? 'جاري البحث...' : 'تطبيق'}
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <div className={`relative ${searchedRequests === null ? 'md:col-span-2' : 'md:col-span-4'} flex items-center gap-2`}>
                            <div className="relative flex-grow">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <SearchIcon className="h-5 w-5 text-slate-400" />
                                </span>
                                <input
                                    id="order-id-search"
                                    name="order-id-search"
                                    type="text"
                                    placeholder="بحث برقم الطلب"
                                    value={requestNumberQuery}
                                    onChange={handleRequestNumberQueryChange}
                                    className={searchInputClasses}
                                />
                            </div>
                            <div className="relative flex-grow">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <SearchIcon className="h-5 w-5 text-slate-400" />
                                </span>
                                <input
                                    id="general-search"
                                    name="general-search"
                                    type="text"
                                    placeholder="بحث بالعميل، الهاتف، السيارة..."
                                    value={comprehensiveQuery}
                                    onChange={handleComprehensiveQueryChange}
                                    className={searchInputClasses}
                                />
                            </div>
                            <Button variant="secondary" onClick={() => setIsScannerOpen(true)} className="p-3" title="مسح الرمز ضوئياً">
                                <Icon name="scan-plate" className="w-5 h-5" />
                            </Button>
                        </div>
                        
                        {searchedRequests === null && (
                            <>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <FilterIcon className="h-5 w-5 text-slate-400" />
                                    </span>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'الكل' | 'active')}
                                        className={`${searchInputClasses} appearance-none`}
                                    >
                                        <option value="الكل">فلترة حسب الحالة (الكل)</option>
                                        <option value="active">نشط (جديد + قيد التنفيذ)</option>
                                        <option value={RequestStatus.NEW}>جديد</option>
                                        <option value={RequestStatus.IN_PROGRESS}>قيد التنفيذ</option>
                                        <option value={RequestStatus.COMPLETE}>مكتمل</option>
                                    </select>
                                </div>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Icon name="employee" className="h-5 w-5 text-slate-400" />
                                    </span>
                                    <select
                                        value={employeeFilter}
                                        onChange={(e) => setEmployeeFilter(e.target.value)}
                                        className={`${searchInputClasses} appearance-none`}
                                    >
                                        <option value="الكل">فلترة حسب الموظف (الكل)</option>
                                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                    </select>
                                </div>
                                {isAnyFilterActive && (
                                    <Button variant="secondary" size="sm" onClick={clearFilters} className="p-2 h-full" title="مسح الفلاتر">
                                        <XIcon className="w-4 h-4" />
                                        <span className="hidden sm:inline">مسح الفلاتر</span>
                                    </Button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Search Active Status Banner */}
                    {searchedRequests !== null && (
                        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-3 rounded-xl animate-fade-in shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/30 animate-pulse">
                                    <SearchIcon className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-blue-900 dark:text-blue-200">وضع البحث نشط حالياً</p>
                                    <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 font-medium">يتم عرض الطلبات التي تطابق معايير البحث فقط. اضغط على (X) للعودة.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-center justify-center px-4 border-r-2 border-blue-200 dark:border-blue-800">
                                    <span className="text-[10px] font-bold text-blue-500/80 dark:text-blue-400/80 uppercase tracking-tighter">إجمالي النتائج</span>
                                    <span className="text-2xl font-black text-blue-700 dark:text-blue-300 leading-tight">
                                        {searchedRequests.length}
                                    </span>
                                </div>
                                <button
                                    onClick={clearFilters}
                                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/40 dark:hover:text-red-400 dark:hover:border-red-800 transition-all shadow-md group"
                                    title="مسح نتائج البحث"
                                >
                                    <XIcon className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isFetchingDateRange && (
                <div className="text-center p-8">
                    <RefreshCwIcon className="w-8 h-8 mx-auto animate-spin text-blue-500" />
                    <p className="mt-2 text-slate-500">جاري تحميل البيانات من الخادم...</p>
                </div>
            )}

            {!isFetchingDateRange && authUser?.role !== 'receptionist' && can('view_waiting_requests') && (waitingPaymentRequests.length > 0 || waitingSearchTerm) && (
                <div className="mb-8 animate-fade-in">
                    <div className="mb-4">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-slate-400" />
                            </span>
                            <input
                                type="text"
                                placeholder="ابحث برقم الطلب في قائمة الانتظار..."
                                value={waitingSearchTerm}
                                onChange={(e) => setWaitingSearchTerm(e.target.value)}
                                className={searchInputClasses}
                            />
                        </div>
                    </div>
                    <RequestTable
                        requests={waitingPaymentRequests}
                        clients={clients}
                        cars={cars}
                        carMakes={carMakes}
                        carModels={carModels}
                        inspectionTypes={inspectionTypes}
                        employees={employees}
                        title="طلبات بانتظار الدفع"
                        onOpenUpdateModal={handleOpenUpdateModal}
                        plateDisplayLanguage={plateDisplayLanguage}
                        setPlateDisplayLanguage={setPlateDisplayLanguage}
                        isRefreshing={isRefreshing}
                        isLive={true}
                        onHistoryClick={handleOpenHistoryModal}
                        carsWithHistory={combinedCarsWithHistory}
                        onProcessPayment={can('process_payment') ? handleProcessPaymentClick : undefined}
                        onResendWhatsApp={handleResendWhatsApp}
                        onDeleteSuccess={handleDeleteSuccess} // Callback for immediate update
                        onRefresh={fetchRequests}
                    />
                </div>
            )}

            {!isFetchingDateRange && (
                <>
                    <RequestTable
                        requests={paginatedDataToDisplay}
                        clients={clients}
                        cars={cars}
                        carMakes={carMakes}
                        carModels={carModels}
                        inspectionTypes={inspectionTypes}
                        employees={employees}
                        title={searchedRequests ? "نتائج البحث" : (dateFilter !== 'all' ? `الطلبات (${dateFilter === 'today' ? 'اليوم' : dateFilter === 'yesterday' ? 'أمس' : 'المحددة'})` : "قائمة الطلبات النشطة")}
                        onOpenUpdateModal={handleOpenUpdateModal}
                        plateDisplayLanguage={plateDisplayLanguage}
                        setPlateDisplayLanguage={setPlateDisplayLanguage}
                        isRefreshing={isRefreshing}
                        isLive={true}
                        onRowClick={handleRowClick}
                        onHistoryClick={handleOpenHistoryModal}
                        carsWithHistory={combinedCarsWithHistory}
                        onDeleteSuccess={handleDeleteSuccess} // Callback for immediate update
                        onRefresh={fetchRequests}
                        isLoading={isSearching}
                        onLoadMore={handleLoadMore}
                        hasMore={dateFilter !== 'today' && (isLoadMoreVisible || displayLimit < dataToDisplay.length)}
                        isLoadingMore={isLoadingMore || isPaginatingLocal}
                        searchTokens={searchedRequests ? (requestNumberQuery || comprehensiveQuery).toLowerCase().split(/\s+/).filter(t => t.length > 0) : undefined}
                        highlightedRequestId={selectedRequestId}
                        triggerHighlight={triggerHighlight}
                    />
                </>
            )}

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setPrefilledReservation(null); }} title="إنشاء طلب جديد" size="5xl">
                    <NewRequestForm
                        clients={clients}
                        carMakes={carMakes}
                        carModels={carModels}
                        inspectionTypes={inspectionTypes}
                        brokers={brokers}
                        onCancel={() => { setIsModalOpen(false); setPrefilledReservation(null); }}
                        onSuccess={handleSuccess}
                        initialReservationData={prefilledReservation || undefined}
                    />
                </Modal>
            )}

            {selectedNote && (
                <Modal isOpen={!!selectedNote} onClose={() => setSelectedNote(null)} title="تفاصيل الملاحظة" size="md">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border dark:border-slate-700 max-h-[60vh] overflow-y-auto">
                        <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                            {selectedNote}
                        </p>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button onClick={() => setSelectedNote(null)}>إغلاق</Button>
                    </div>
                </Modal>
            )}

            {isExportModalOpen && (
                <ExportRequestsModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                />
            )}

            {isImportModalOpen && (
                <ImportRequestsModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                />
            )}

            <Modal isOpen={isProcessingModalOpen} onClose={() => {}} title="" size="sm" hideCloseButton>
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <RefreshCwIcon className="w-12 h-12 text-blue-500 animate-spin" />
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">جاري إنشاء الطلب...</p>
                </div>
            </Modal>

            {isUpdateModalOpen && requestToUpdate && (
                <Modal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} title={`تحديث الطلب #${requestToUpdate.request_number}`} size="5xl">
                    <NewRequestForm
                        initialData={requestToUpdate}
                        clients={clients}
                        carMakes={carMakes}
                        carModels={carModels}
                        inspectionTypes={inspectionTypes}
                        brokers={brokers}
                        onCancel={() => setIsUpdateModalOpen(false)}
                        onSuccess={() => setIsUpdateModalOpen(false)}
                    />
                </Modal>
            )}

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="تحصيل المبلغ وتفعيل الطلب" size="md">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        سيتم تحويل حالة الطلب <strong>#{paymentRequest?.request_number}</strong> إلى "جديد" وسيتمكن الفنيون من رؤيته.
                    </p>

                    <div className="space-y-2 text-sm bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border dark:border-slate-600">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">تاريخ الإنشاء:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {paymentRequest ? new Date(paymentRequest.created_at).toLocaleDateString('en-GB') : ''}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">تم الإنشاء بواسطة:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {creatorEmployee?.name || 'غير معروف'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg border dark:border-slate-600 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">المبلغ المطلوب</p>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">{paymentRequest?.price.toLocaleString('en-US')} ريال</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">طريقة الدفع</label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => {
                                const newMethod = e.target.value as PaymentType;
                                setPaymentMethod(newMethod);
                                if (newMethod === PaymentType.Split && paymentRequest) {
                                    setSplitCashAmount(0);
                                    setSplitCardAmount(paymentRequest.price);
                                }
                            }}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        >
                            <option value={PaymentType.Cash}>نقدي</option>
                            <option value={PaymentType.Card}>بطاقة</option>
                            <option value={PaymentType.Transfer}>تحويل بنكي</option>
                            <option value={PaymentType.Split}>نقدي - بطاقة</option>
                            <option value={PaymentType.Unpaid}>غير مدفوع (آجل)</option>
                        </select>
                    </div>

                    {paymentMethod === PaymentType.Split && (
                        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 animate-fade-in">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">نقدي</label>
                                <input
                                    type="number"
                                    value={splitCashAmount}
                                    onChange={handleSplitCashChange}
                                    className="w-full p-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">بطاقة (تلقائي)</label>
                                <input
                                    type="number"
                                    value={splitCardAmount}
                                    readOnly
                                    className="w-full p-2 text-sm border rounded bg-slate-100 dark:bg-slate-600 dark:border-slate-500 text-slate-500 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-4 mt-2 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>إلغاء</Button>
                    <Button onClick={confirmPayment}>تأكيد الاستلام</Button>
                </div>
            </Modal>

            <Modal isOpen={!!historyModalCar} onClose={() => setHistoryModalCar(null)} title={`سجل الفحص لـ ${historyModalCar?.carName}`} size="2xl">
                {isLoadingHistory ? (
                    <div className="flex justify-center items-center p-8">
                        <RefreshCwIcon className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4 pb-3 border-b dark:border-slate-700">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                تم العثور على {carHistoryRequests.length} سجلات سابقة لهذه السيارة
                            </p>
                            <Button 
                                size="sm" 
                                variant="primary" 
                                onClick={() => {
                                    const car = cars.find(c => c.id === historyModalCar?.carId);
                                    const searchTerm = car?.plate_number || car?.plate_number_en || historyModalCar?.carName || '';
                                    const url = new URL(window.location.href);
                                    url.searchParams.set('page', 'requests');
                                    url.searchParams.set('search', searchTerm);
                                    window.open(url.toString(), '_blank');
                                }}
                                className="w-full sm:w-auto"
                            >
                                <div className="flex items-center gap-2">
                                    <SearchIcon className="w-4 h-4" />
                                    <span>البحث في جميع السجلات</span>
                                </div>
                            </Button>
                        </div>
                        
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                            {carHistoryRequests.map(req => (
                                <div key={req.id} className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200">#{req.request_number}</p>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(req.created_at).toLocaleDateString('en-GB')} - {req.status}
                                            </p>
                                            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded w-fit">
                                                {timeAgo(req.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            setSelectedRequestId(req.id);
                                            setPage('print-report');
                                            setHistoryModalCar(null);
                                        }}
                                    >
                                        عرض التقرير
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>

            <InAppScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
            />

        </div>
    );
};

export default Requests;
