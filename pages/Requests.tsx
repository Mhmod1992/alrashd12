
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { InspectionRequest, RequestStatus, Car, PaymentType, Reservation } from '../types';
import Button from '../components/Button';
import PlusIcon from '../components/icons/PlusIcon';
import SearchIcon from '../components/icons/SearchIcon';
import FilterIcon from '../components/icons/FilterIcon';
import Modal from '../components/Modal';
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
import { uuidv4 } from '../lib/utils';

const StatBlock: React.FC<{ title: string; count: number; icon: React.ReactElement<{ className?: string }>; color: string; }> = ({ title, count, icon, color }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm flex items-center gap-4 border-l-4" style={{ borderColor: color }}>
        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-700/50" style={{ color }}>
            {/* Clone element to merge classes instead of overwriting */}
            {React.cloneElement(icon, { className: `w-6 h-6 ${icon.props.className || ''}` })}
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{count}</p>
        </div>
    </div>
);


const Requests: React.FC = () => {
    const {
        requests, clients, cars, carMakes, carModels, inspectionTypes, brokers, can, authUser, settings,
        initialRequestModalState, setInitialRequestModalState,
        searchedRequests, searchRequestByNumber, clearSearchedRequests,
        loadMoreRequests, hasMoreRequests, isLoadingMore, isRefreshing,
        setPage, setSelectedRequestId, addNotification, fetchRequestsByCarId,
        updateRequest, employees, showConfirmModal, fetchRequestsByDateRange,
        fetchRequestByRequestNumber, reservations, updateReservationStatus, addRequest, fetchReservations,
        searchClients, addClient, addCar, searchCarMakes, searchCarModels,
        lastRemoteDeleteId
    } = useAppContext();

    const [requestNumberQuery, setRequestNumberQuery] = useState('');
    const [comprehensiveQuery, setComprehensiveQuery] = useState('');
    const [waitingSearchTerm, setWaitingSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<RequestStatus | 'الكل'>('الكل');
    const [employeeFilter, setEmployeeFilter] = useState<string>('الكل');

    // Date Filter State
    const [dateFilter, setDateFilter] = useState<'today' | 'all' | 'yesterday' | 'month' | 'range'>('today');
    const [rangeStartDate, setRangeStartDate] = useState('');
    const [rangeEndDate, setRangeEndDate] = useState('');
    const [serverFetchedData, setServerFetchedData] = useState<InspectionRequest[] | null>(null);
    const [isFetchingDateRange, setIsFetchingDateRange] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [requestToUpdate, setRequestToUpdate] = useState<InspectionRequest | null>(null);
    const [plateDisplayLanguage, setPlateDisplayLanguage] = useState<'ar' | 'en'>('ar');
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
    const [activatingRes, setActivatingRes] = useState<Reservation | null>(null);
    const [isActivating, setIsActivating] = useState(false);
    const [isReservationsModalOpen, setIsReservationsModalOpen] = useState(false);
    const [reservationSearchTerm, setReservationSearchTerm] = useState('');

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

    // --- REAL-TIME SYNC FOR FILTERED DATA ---
    useEffect(() => {
        if (!serverFetchedData) return;

        let hasChanges = false;
        let newData = [...serverFetchedData];
        const todayStr = new Date().toLocaleDateString('en-CA');

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
            newData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setServerFetchedData(newData);
        }

    }, [requests, dateFilter]); 

    // --- Listen for Remote Deletion Events ---
    useEffect(() => {
        if (lastRemoteDeleteId && serverFetchedData) {
            setServerFetchedData(prev => prev ? prev.filter(r => r.id !== lastRemoteDeleteId) : null);
        }
    }, [lastRemoteDeleteId]);

    // --- SEARCH EXECUTION ---
    const executeSearch = useCallback((term: string) => {
        const trimmedTerm = term.trim();

        if (searchDebounceRef.current) {
            window.clearTimeout(searchDebounceRef.current);
        }

        if (trimmedTerm === '') {
            clearSearchedRequests();
            return;
        }

        searchDebounceRef.current = window.setTimeout(async () => {
            await searchRequestByNumber(trimmedTerm);
        }, 400);
    }, [searchRequestByNumber, clearSearchedRequests]);

    const handleRequestNumberQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value.replace(/\D/g, '');
        setRequestNumberQuery(term);
        if (comprehensiveQuery) setComprehensiveQuery('');
        executeSearch(term);
    };

    const handleComprehensiveQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setComprehensiveQuery(term);
        if (requestNumberQuery) setRequestNumberQuery('');
        executeSearch(term);
    };

    const searchInitialized = useRef(false);

    // Initialize search from URL params
    useEffect(() => {
        if (searchInitialized.current) return;

        const params = new URLSearchParams(window.location.search);
        const searchParam = params.get('search');
        if (searchParam) {
            setComprehensiveQuery(searchParam);
            setDateFilter('all');
            executeSearch(searchParam);
            searchInitialized.current = true;
        }
    }, [executeSearch]);

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
        const now = new Date();
        let start = new Date();
        let end = new Date();

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

    const clearFilters = () => {
        setRequestNumberQuery('');
        setComprehensiveQuery('');
        setStatusFilter('الكل');
        setEmployeeFilter('الكل');
        setRangeStartDate('');
        setRangeEndDate('');
        setDateFilter('today'); 
        clearSearchedRequests();
    };

    const handleScanSuccess = async (decodedText: string) => {
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

    const handleResendWhatsApp = (request: InspectionRequest) => {
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

        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleActivateClick = (res: Reservation) => {
        setActivatingRes(res);
        let price = 0;
        const priceMatch = res.notes?.match(/السعر:\s*(\d+)/);
        if (priceMatch) price = parseInt(priceMatch[1]);

        setPaymentMethod(PaymentType.Cash);
        setSplitCashAmount(0);
        setSplitCardAmount(price || 0);
        setIsPaymentModalOpen(true);
    };

    const confirmActivation = async () => {
        if (!activatingRes || !authUser) return;
        setIsActivating(true);
        try {
            // 1. Find or Create Client
            let client = clients.find(c => c.phone === activatingRes.client_phone);
            if (!client) {
                const results = await searchClients(activatingRes.client_phone);
                client = results.find(c => c.phone === activatingRes.client_phone);
                if (!client) {
                    client = await addClient({ id: uuidv4() as any, name: activatingRes.client_name, phone: activatingRes.client_phone });
                }
            }

            // 2. Find or Create Car
            let car = cars.find(c => c.plate_number === activatingRes.plate_text);
            const parts = activatingRes.car_details.split(' - ');

            if (!car) {
                const year = parseInt(parts[2]?.trim()) || new Date().getFullYear();

                car = await addCar({
                    id: uuidv4() as any,
                    make_id: activatingRes.car_make_id || '',
                    model_id: activatingRes.car_model_id || '',
                    year: year,
                    plate_number: activatingRes.plate_text,
                    plate_number_en: activatingRes.plate_text,
                });
            }

            // 3. Create Request
            const price = paymentMethod === PaymentType.Split ? (splitCashAmount + splitCardAmount) : (paymentMethod === PaymentType.Cash ? splitCashAmount : splitCardAmount);

            const makeObj = carMakes.find(m => m.id === activatingRes.car_make_id);
            const modelObj = carModels.find(m => m.id === activatingRes.car_model_id);

            const typeMatch = activatingRes.notes?.match(/نوع الفحص:\s*([^|]+)/);
            const typeName = typeMatch ? typeMatch[1].trim() : '';
            const iType = inspectionTypes.find(t => t.name === typeName);

            await addRequest({
                id: uuidv4() as any,
                client_id: client.id,
                car_id: car.id,
                car_snapshot: {
                    make_ar: makeObj?.name_ar || parts[0]?.trim() || '',
                    make_en: makeObj?.name_en || '',
                    model_ar: modelObj?.name_ar || parts[1]?.trim() || '',
                    model_en: modelObj?.name_en || '',
                    year: parseInt(parts[2]?.trim()) || new Date().getFullYear()
                },
                inspection_type_id: iType?.id || inspectionTypes[0]?.id || '',
                price: price,
                status: RequestStatus.NEW,
                payment_type: paymentMethod,
                split_payment_details: paymentMethod === PaymentType.Split ? { cash: splitCashAmount, card: splitCardAmount } : undefined,
                created_at: new Date().toISOString(),
                employee_id: authUser.id,
                inspection_data: {},
                general_notes: [],
                category_notes: {},
                structured_findings: [],
                activity_log: [],
                attached_files: []
            } as any);

            // 4. Update Reservation
            await updateReservationStatus(activatingRes.id, 'converted');

            addNotification({ title: 'تم التفعيل', message: 'تم فتح طلب فحص جديد وتحصيل المبلغ.', type: 'success' });
            setIsPaymentModalOpen(false);
            setActivatingRes(null);
        } catch (error) {
            console.error(error);
            addNotification({ title: 'خطأ', message: 'فشل تفعيل الحجز.', type: 'error' });
        } finally {
            setIsActivating(false);
        }
    };

    const confirmPayment = async () => {
        if (activatingRes) {
            await confirmActivation();
            return;
        }
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

        let statusFilteredReqs = otherReqs.filter(req => statusFilter === 'الكل' || req.status === statusFilter);

        if (employeeFilter !== 'الكل') {
            statusFilteredReqs = statusFilteredReqs.filter(req => req.employee_id === employeeFilter);
        }

        if (!can('view_completed_requests')) {
            statusFilteredReqs = statusFilteredReqs.filter(req => req.status !== RequestStatus.COMPLETE);
        }

        statusFilteredReqs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

    const totalCount = dataToDisplay.length + waitingPaymentRequests.length;
    const newCount = dataToDisplay.filter(r => r.status === RequestStatus.NEW).length;
    const inProgressCount = dataToDisplay.filter(r => r.status === RequestStatus.IN_PROGRESS).length;
    const completeCount = dataToDisplay.filter(r => r.status === RequestStatus.COMPLETE).length;

    const activeFilterClasses = 'bg-white dark:bg-slate-700 shadow-md text-blue-600 dark:text-blue-400';
    const inactiveFilterClasses = 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50';

    const DateFilterButton: React.FC<{ filter: 'all' | 'today' | 'yesterday' | 'month' | 'range'; label: string }> = ({ filter, label }) => (
        <button
            onClick={() => setDateFilter(filter)}
            className={`flex-1 text-center font-semibold py-2 px-3 rounded-lg transition-all duration-200 text-sm ${dateFilter === filter ? activeFilterClasses : inactiveFilterClasses}`}
        >
            {label}
        </button>
    );

    const creatorEmployee = useMemo(() => {
        if (!paymentRequest || !employees) return null;
        return employees.find(e => e.id === paymentRequest.employee_id);
    }, [paymentRequest, employees]);

    return (
        <div className="container mx-auto">
            <div className="flex flex-col md:grid md:grid-cols-3 items-center justify-between mb-8 gap-4">
                {/* 1. Page Title (Right) */}
                <div className="text-center md:text-right order-1">
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">إدارة الطلبات</h2>
                </div>

                {/* 2. Main Actions (Center) */}
                <div className="flex items-center justify-center gap-3 order-3 md:order-2 w-full">
                    {reservations.filter(r => r.status === 'confirmed').length > 0 && (
                        <button
                            onClick={() => setIsReservationsModalOpen(true)}
                            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-amber-200 dark:shadow-none transition-all"
                        >
                            <Icon name="calendar-check" className="w-5 h-5" />
                            <span>الحجوزات</span>
                            <span className="bg-white text-amber-600 px-1.5 py-0.5 rounded-full text-xs">
                                {reservations.filter(r => r.status === 'confirmed').length}
                            </span>
                        </button>
                    )}
                    {can('create_requests') && (
                        <Button 
                            onClick={() => setIsModalOpen(true)} 
                            leftIcon={<PlusIcon className="w-5 h-5" />}
                            className="shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all px-8 py-2.5 font-bold text-lg"
                        >
                            إنشاء طلب جديد
                        </Button>
                    )}
                </div>
                
                {/* 3. Empty Spacer for Balance (Left) */}
                <div className="hidden md:block order-3"></div>
            </div>

            {/* Modal for Confirmed Reservations Table */}
            <Modal
                isOpen={isReservationsModalOpen}
                onClose={() => setIsReservationsModalOpen(false)}
                title="قائمة الحجوزات المؤكدة بانتظار الحضور"
                size="5xl"
            >
                <div className="space-y-4">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <SearchIcon className="h-4 h-4 text-slate-400" />
                        </span>
                        <input
                            type="text"
                            placeholder="بحث في الحجوزات (الاسم، الهاتف، السيارة...)"
                            value={reservationSearchTerm}
                            onChange={(e) => setReservationSearchTerm(e.target.value)}
                            className="block w-full p-2.5 pl-9 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm"
                        />
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase">
                                <tr>
                                    <th className="p-3">العميل</th>
                                    <th className="p-3">السيارة</th>
                                    <th className="p-3">التفاصيل / السعر</th>
                                    <th className="p-3">تاريخ الحجز</th>
                                    <th className="p-3 text-center">بواسطة</th>
                                    <th className="p-3 text-center">الإجراء</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {reservations
                                    .filter(r => r.status === 'confirmed')
                                    .filter(r =>
                                        !reservationSearchTerm ||
                                        r.client_name?.includes(reservationSearchTerm) ||
                                        r.client_phone?.includes(reservationSearchTerm) ||
                                        r.car_details?.includes(reservationSearchTerm) ||
                                        r.notes?.includes(reservationSearchTerm)
                                    )
                                    .map(res => (
                                        <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-3">
                                                <div className="font-bold text-slate-800 dark:text-slate-200">{res.client_name}</div>
                                                <div className="text-xs text-slate-500 font-mono tracking-wider dir-ltr inline-block">{res.client_phone}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <Icon name="car" className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{res.car_details}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1">{res.plate_text}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 p-2 rounded-lg border border-amber-100 dark:border-amber-800/50 text-[11px] font-medium">
                                                    {res.notes || res.service_type}
                                                </div>
                                            </td>
                                            <td className="p-3 text-xs text-slate-500">
                                                {new Date(res.created_at).toLocaleDateString('ar-SA')}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-400">واتساب</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <Button
                                                    onClick={() => {
                                                        setIsReservationsModalOpen(false);
                                                        handleActivateClick(res);
                                                    }}
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 shadow-sm"
                                                    leftIcon={<Icon name="check-circle" className="w-4 h-4" />}
                                                >
                                                    تفعيل وفتح طلب
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                {reservations.filter(r => r.status === 'confirmed').length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center">
                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                <Icon name="calendar-check" className="w-12 h-12 opacity-20" />
                                                <p className="italic">لا توجد حجوزات مؤكدة حالياً</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-6 space-y-4 animate-slide-in-down">
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

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl shadow-inner w-full">
                        <DateFilterButton filter="today" label="اليوم" />
                        <DateFilterButton filter="yesterday" label="أمس" />
                        <DateFilterButton filter="month" label="هذا الشهر" />
                        <DateFilterButton filter="range" label="نطاق محدد" />
                        <DateFilterButton filter="all" label="الكل" />
                    </div>

                    {dateFilter === 'range' && (
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
                        <div className="relative md:col-span-2 flex items-center gap-2">
                            <div className="relative flex-grow">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <SearchIcon className="h-5 w-5 text-slate-400" />
                                </span>
                                <input
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
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <FilterIcon className="h-5 w-5 text-slate-400" />
                            </span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'الكل')}
                                className={`${searchInputClasses} appearance-none`}
                            >
                                <option value="الكل">فلترة حسب الحالة (الكل)</option>
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
                            <button
                                onClick={clearSearchedRequests}
                                className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/40 dark:hover:text-red-400 dark:hover:border-red-800 transition-all shadow-md group"
                                title="مسح نتائج البحث"
                            >
                                <XIcon className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                            </button>
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
                    />
                </div>
            )}

            {!isFetchingDateRange && (
                <RequestTable
                    requests={dataToDisplay}
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
                />
            )}

            {isLoadMoreVisible && (
                <div className="text-center mt-6">
                    <Button onClick={loadMoreRequests} variant="secondary" disabled={isLoadingMore}>
                        {isLoadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}
                    </Button>
                </div>
            )}

            {isModalOpen && (
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إنشاء طلب جديد" size="4xl">
                    <NewRequestForm
                        clients={clients}
                        carMakes={carMakes}
                        carModels={carModels}
                        inspectionTypes={inspectionTypes}
                        brokers={brokers}
                        onCancel={() => setIsModalOpen(false)}
                        onSuccess={() => setIsModalOpen(false)}
                    />
                </Modal>
            )}

            {isUpdateModalOpen && requestToUpdate && (
                <Modal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} title={`تحديث الطلب #${requestToUpdate.request_number}`} size="4xl">
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
                    <Button variant="secondary" onClick={() => { setIsPaymentModalOpen(false); setActivatingRes(null); }}>إلغاء</Button>
                    <Button onClick={confirmPayment} disabled={isActivating}>
                        {isActivating ? (
                            <span className="flex items-center gap-2">
                                <RefreshCwIcon className="w-4 h-4 animate-spin" />
                                جاري التفعيل...
                            </span>
                        ) : (activatingRes ? 'تفعيل الحجز وفتح الطلب' : 'تأكيد الاستلام')}
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={!!historyModalCar} onClose={() => setHistoryModalCar(null)} title={`سجل الفحص لـ ${historyModalCar?.carName}`} size="2xl">
                {isLoadingHistory ? (
                    <div className="flex justify-center items-center p-8">
                        <RefreshCwIcon className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {carHistoryRequests.map(req => (
                            <div key={req.id} className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200">#{req.request_number}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {new Date(req.created_at).toLocaleDateString('en-GB')} - {req.status}
                                    </p>
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
