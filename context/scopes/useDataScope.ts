
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    InspectionRequest, Client, Car, CarMake, CarModel, InspectionType,
    Broker, CustomFindingCategory, PredefinedFinding, Employee,
    Notification, AppNotification, Expense, Revenue, ActivityLog,
    InternalMessage, Technician, Reservation, RequestStatus, Page
} from '../../types';
import { REQUESTS_PAGE_SIZE } from '../constants';
import { uuidv4 } from '../../lib/utils'; // You might need to adjust this import path if utils is elsewhere

export const useDataScope = (
    authUser: Employee | null
) => {

    const [requests, setRequests] = useState<InspectionRequest[]>([]);
    const [requestsOffset, setRequestsOffset] = useState(0);
    const [hasMoreRequests, setHasMoreRequests] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchedRequests, setSearchedRequests] = useState<InspectionRequest[] | null>(null);
    const [highlightedRequestId, setHighlightedRequestId] = useState<string | null>(null);
    const [incomingRequest, setIncomingRequest] = useState<InspectionRequest | null>(null);
    const [lastRemoteDeleteId, setLastRemoteDeleteId] = useState<string | null>(null);

    const [clients, setClients] = useState<Client[]>([]);
    const [cars, setCars] = useState<Car[]>([]);

    const [carMakes, setCarMakes] = useState<CarMake[]>([]);
    const [carModels, setCarModels] = useState<CarModel[]>([]);
    const [loadedMakesForModels, setLoadedMakesForModels] = useState<Set<string>>(new Set());

    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [inspectionTypes, setInspectionTypes] = useState<InspectionType[]>([]);
    const [customFindingCategories, setCustomFindingCategories] = useState<CustomFindingCategory[]>([]);
    const [predefinedFindings, setPredefinedFindings] = useState<PredefinedFinding[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);

    const [systemLogs, setSystemLogs] = useState<ActivityLog[]>([]);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const triggerHighlight = useCallback((requestId: string) => {
        setHighlightedRequestId(requestId);
        setTimeout(() => setHighlightedRequestId(null), 2000);
    }, []);

    const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
        const id = uuidv4();
        // @ts-ignore
        setNotifications(prev => [...prev, { ...notification, id }]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
    }, []);

    const fetchAllData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            // Added 'attached_files' to the select list
            const [
                { data: reqs, error: reqError }, { data: mks }, { data: types },
                { data: brks }, { data: cats }, { data: finds }, { data: exps },
                { data: clts }, { data: crs }, { data: emps }, { data: techs }, { data: notifs },
                { data: res }
            ] = await Promise.all([
                supabase.from('inspection_requests')
                    .select('id, request_number, client_id, car_id, car_snapshot, inspection_type_id, payment_type, price, status, created_at, employee_id, broker, activity_log, technician_assignments, updated_at, attached_files, report_stamps')
                    .order('created_at', { ascending: false })
                    .limit(REQUESTS_PAGE_SIZE),
                supabase.from('car_makes').select('*'),
                supabase.from('inspection_types').select('*'),
                supabase.from('brokers').select('*'),
                supabase.from('custom_finding_categories').select('*'),
                supabase.from('predefined_findings').select('*'),
                supabase.from('expenses').select('*'),
                supabase.from('clients').select('*').limit(100),
                supabase.from('cars').select('*').limit(100),
                supabase.from('employees').select('*'),
                supabase.from('technicians').select('*'),
                supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
                supabase.from('reservations').select('*').order('created_at', { ascending: false }).limit(50),
            ]);

            if (reqError) throw reqError;

            const requestsData = reqs || [];
            const carsData = crs || [];
            const clientsData = clts || [];

            setRequests(requestsData);
            setRequestsOffset(requestsData.length);
            setHasMoreRequests(requestsData.length >= REQUESTS_PAGE_SIZE);
            setClients(clientsData);
            setCars(carsData);
            setCarMakes(mks || []);
            setInspectionTypes(types || []);
            setBrokers(brks || []);
            setCustomFindingCategories(cats || []);
            setPredefinedFindings(finds || []);
            setExpenses((exps || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setEmployees(emps || []);
            setTechnicians(techs || []);
            setAppNotifications(notifs as AppNotification[] || []);
            setReservations(res || []);

            // --- PROACTIVE LOADING FOR INITIAL BATCH ---
            const missingCarIds = Array.from(new Set(requestsData.map(r => r.car_id)))
                .filter(id => id && !carsData.some(c => c.id === id));

            const missingClientIds = Array.from(new Set(requestsData.map(r => r.client_id)))
                .filter(id => id && !clientsData.some(c => c.id === id));

            if (missingCarIds.length > 0) {
                const { data: moreCars } = await supabase.from('cars').select('*').in('id', missingCarIds);
                if (moreCars) setCars(prev => [...prev, ...moreCars.filter(mc => !prev.some(pc => pc.id === mc.id))]);
            }
            if (missingClientIds.length > 0) {
                const { data: moreClients } = await supabase.from('clients').select('*').in('id', missingClientIds);
                if (moreClients) setClients(prev => [...prev, ...moreClients.filter(mc => !prev.some(pc => pc.id === mc.id))]);
            }

            if (authUser) {
                const { count, error } = await supabase
                    .from('internal_messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('receiver_id', authUser.id)
                    .eq('is_read', false);

                if (!error && count !== null) {
                    setUnreadMessagesCount(count);
                }
            }

        } catch (error: any) {
            console.error("Error fetching data from Supabase:", error);
            addNotification({ title: 'خطأ', message: 'فشل تحميل البيانات من الخادم.', type: 'error' });
        } finally {
            setIsRefreshing(false);
        }
    }, [addNotification, authUser]);

    const fetchCarModelsByMake = useCallback(async (makeId: string) => {
        if (loadedMakesForModels.has(makeId)) return;

        try {
            const { data: models, error } = await supabase.from('car_models').select('*').eq('make_id', makeId);
            if (error) throw error;

            if (models) {
                setCarModels(prev => {
                    const newModels = models.filter(nm => !prev.some(pm => pm.id === nm.id));
                    return [...prev, ...newModels];
                });
                setLoadedMakesForModels(prev => new Set(prev).add(makeId));
            }
        } catch (e) {
            console.error(`Failed to fetch models for make ${makeId}`, e);
            addNotification({ title: 'تحذير', message: 'فشل تحميل موديلات السيارات.', type: 'warning' });
        }
    }, [loadedMakesForModels, addNotification]);

    const fetchCarMakes = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('car_makes').select('*').order('name_ar', { ascending: true });
            if (error) throw error;
            setCarMakes(data || []);
        } catch (error) {
            console.error("Failed to fetch car makes", error);
            addNotification({ title: 'خطأ', message: 'فشل تحميل قائمة الشركات.', type: 'error' });
        }
    }, [addNotification]);

    const ensureEntitiesLoaded = useCallback(async (fetchedRequests: InspectionRequest[]) => {
        if (!fetchedRequests || fetchedRequests.length === 0) return;

        const clientIdsToFetch = Array.from(new Set(fetchedRequests.map(r => r.client_id)))
            .filter(id => id && !clients.some(c => c.id === id));

        const carIdsToFetch = Array.from(new Set(fetchedRequests.map(r => r.car_id)))
            .filter(id => id && !cars.some(c => c.id === id));

        const promises = [];

        if (clientIdsToFetch.length > 0) {
            promises.push(
                supabase.from('clients').select('*').in('id', clientIdsToFetch)
                    .then(({ data }) => {
                        if (data && data.length > 0) {
                            setClients(prev => {
                                const existingIds = new Set(prev.map(c => c.id));
                                const newClients = data.filter(c => !existingIds.has(c.id));
                                return [...prev, ...newClients];
                            });
                        }
                    })
            );
        }

        if (carIdsToFetch.length > 0) {
            promises.push(
                supabase.from('cars').select('*').in('id', carIdsToFetch)
                    .then(({ data }) => {
                        if (data && data.length > 0) {
                            setCars(prev => {
                                const existingIds = new Set(prev.map(c => c.id));
                                const newCars = data.filter(c => !existingIds.has(c.id));
                                return [...prev, ...newCars];
                            });
                        }
                    })
            );
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }, [clients, cars]);

    const markNotificationAsRead = useCallback(async (id: string) => {
        setAppNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (error) console.error("Failed to mark notification as read", error);
    }, []);

    const markAllNotificationsAsRead = useCallback(async () => {
        setAppNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        if (authUser) {
            const { error } = await supabase.from('notifications')
                .update({ is_read: true })
                .eq('user_id', authUser.id)
                .eq('is_read', false);
            if (error) console.error("Failed to mark all notifications as read", error);
        }
    }, [authUser]);

    const createActivityLog = useCallback((action: string, details: string, imageUrl?: string, link_id?: string, link_page?: Page): ActivityLog | null => {
        if (!authUser) return null;
        return { id: uuidv4(), timestamp: new Date().toISOString(), employeeId: authUser.id, employeeName: authUser.name, action, details, imageUrl, link_id, link_page };
    }, [authUser]);

    const fetchRequestByRequestNumber = useCallback(async (reqNum: number): Promise<InspectionRequest | null> => {
        // select('*') ensures attached_files is fetched
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

    const fetchRequestsByDateRange = useCallback(async (startDate: string, endDate: string): Promise<InspectionRequest[]> => {
        // Added 'attached_files' to select list
        const { data, error } = await supabase.from('inspection_requests')
            .select('id, request_number, client_id, car_id, car_snapshot, inspection_type_id, payment_type, price, status, created_at, employee_id, broker, activity_log, technician_assignments, updated_at, attached_files, report_stamps')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });
        if (error) {
            addNotification({ title: 'خطأ', message: 'فشل تحميل الطلبات حسب التاريخ.', type: 'error' });
            return [];
        }
        if (data) await ensureEntitiesLoaded(data);
        return data || [];
    }, [addNotification, ensureEntitiesLoaded]);

    const fetchPaperArchiveRequests = useCallback(async (startDate: string, endDate: string): Promise<InspectionRequest[]> => {
        // Fetches ALL requests in a date range for archiving purposes
        const { data, error } = await supabase.from('inspection_requests')
            .select('id, request_number, client_id, car_id, car_snapshot, inspection_type_id, payment_type, price, status, created_at, employee_id, broker, updated_at, attached_files')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });

        if (error) {
            addNotification({ title: 'خطأ', message: 'فشل تحميل الأرشيف.', type: 'error' });
            return [];
        }
        
        const requestsData = data || [];
        
        if (requestsData.length > 0) {
            await ensureEntitiesLoaded(requestsData);
        }
        return requestsData;
    }, [addNotification, ensureEntitiesLoaded]);

    const fetchAllPaperArchiveRequests = useCallback(async (): Promise<InspectionRequest[]> => {
        // Fetches ALL requests up to a limit for archiving purposes
        const { data, error } = await supabase.from('inspection_requests')
            .select('id, request_number, client_id, car_id, car_snapshot, inspection_type_id, payment_type, price, status, created_at, employee_id, broker, updated_at, attached_files')
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) {
            addNotification({ title: 'خطأ', message: 'فشل تحميل الأرشيف الكامل.', type: 'error' });
            return [];
        }

        const requestsData = data || [];

        if (requestsData.length > 0) {
            await ensureEntitiesLoaded(requestsData);
        }
        return requestsData;
    }, [addNotification, ensureEntitiesLoaded]);

    return {
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
        markAllNotificationsAsRead,
        fetchRequestByRequestNumber,
        fetchRequestsByDateRange,
        fetchPaperArchiveRequests,
        fetchAllPaperArchiveRequests
    };
};
