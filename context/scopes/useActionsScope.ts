import React, { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { uuidv4 } from '../../lib/utils';
import {
    InspectionRequest, Client, Car, CarMake, CarModel, InspectionType,
    Broker, CustomFindingCategory, PredefinedFinding, Expense, Revenue,
    InternalMessage, Technician, Reservation, ActivityLog, Employee,
    AppNotification, Notification, PaymentType, Page
} from '../../types';

export const useActionsScope = (
    requests: InspectionRequest[],
    setRequests: React.Dispatch<React.SetStateAction<InspectionRequest[]>>,
    setSearchedRequests: React.Dispatch<React.SetStateAction<InspectionRequest[] | null>>,
    setClients: React.Dispatch<React.SetStateAction<Client[]>>,
    setCars: React.Dispatch<React.SetStateAction<Car[]>>,
    setCarMakes: React.Dispatch<React.SetStateAction<CarMake[]>>,
    setCarModels: React.Dispatch<React.SetStateAction<CarModel[]>>,
    setBrokers: React.Dispatch<React.SetStateAction<Broker[]>>,
    employees: Employee[],
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>,
    setTechnicians: React.Dispatch<React.SetStateAction<Technician[]>>,
    setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>,
    setInspectionTypes: React.Dispatch<React.SetStateAction<InspectionType[]>>,
    setCustomFindingCategories: React.Dispatch<React.SetStateAction<CustomFindingCategory[]>>,
    setPredefinedFindings: React.Dispatch<React.SetStateAction<PredefinedFinding[]>>,
    setReservations: React.Dispatch<React.SetStateAction<Reservation[]>>,
    setUnreadMessagesCount: React.Dispatch<React.SetStateAction<number>>,
    setSystemLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>,
    authUser: Employee | null,
    setAuthUser: React.Dispatch<React.SetStateAction<Employee | null>>,
    addNotification: (notification: Omit<Notification, 'id'>) => void,
    createActivityLog: (action: string, details: string, imageUrl?: string, link_id?: string, link_page?: Page) => ActivityLog | null,
    fetchAllData: () => Promise<void>
) => {

    const sendSystemNotification = useCallback(async (notification: {
        title: string;
        message: string;
        type: 'login' | 'general' | 'new_request' | 'status_change' | 'delete_request' | 'update_request';
        link?: Page;
        link_id?: string;
        user_id?: string | null;
    }) => {
        try {
            const { error } = await supabase.from('notifications').insert({
                ...notification,
                created_by_name: authUser?.name || 'النظام',
                is_read: false
            });
            if (error) throw error;
        } catch (e) {
            console.error("Failed to send system notification:", e);
        }
    }, [authUser]);

    // --- REQUESTS ---
    const updateRequest = useCallback(async (updatedRequest: Partial<InspectionRequest> & { id: string }): Promise<void> => {
        setRequests(prev => prev.map(r => r.id === updatedRequest.id ? { ...r, ...updatedRequest } : r));
        setSearchedRequests(prev => {
            if (!prev) return null;
            return prev.map(r => r.id === updatedRequest.id ? { ...r, ...updatedRequest } : r);
        });
        const { error } = await supabase.from('inspection_requests').update(updatedRequest).eq('id', updatedRequest.id);
        if (error) throw error;
    }, [setRequests, setSearchedRequests]);

    const updateRequestAndAssociatedData = useCallback(async (payload: { originalRequest: InspectionRequest; formData: { client_id: string; car: Partial<Omit<Car, 'id'>>; request: any; } }) => {
        const { originalRequest, formData } = payload;
        const { client_id, car: carData, request: requestData } = formData;
        if (Object.keys(carData).length > 0) {
            const { error: carError } = await supabase.from('cars').update(carData).eq('id', originalRequest.car_id);
            if (carError) throw carError;
            const { data: updatedCar } = await supabase.from('cars').select('*').eq('id', originalRequest.car_id).single();
            if (updatedCar) setCars(prev => prev.map(c => c.id === updatedCar.id ? updatedCar : c));
        }
        const currentRequest = requests.find(r => r.id === originalRequest.id) || originalRequest;
        const newLog = createActivityLog('تعديل بيانات الطلب', `تم تحديث البيانات الأساسية للطلب #${originalRequest.request_number}`);
        const updatedLog = newLog ? [newLog, ...(currentRequest.activity_log || [])] : (currentRequest.activity_log || []);
        await updateRequest({ ...requestData, client_id, activity_log: updatedLog, id: originalRequest.id });
    }, [createActivityLog, requests, updateRequest, setCars]);

    const deleteRequest = useCallback(async (id: string): Promise<void> => {
        const requestToDelete = requests.find(r => r.id === id);
        const reqNum = requestToDelete ? requestToDelete.request_number : '???';
        const { error } = await supabase.from('inspection_requests').delete().eq('id', id);
        if (error) throw error;
        setRequests(prev => prev.filter(r => r.id !== id));
        setSearchedRequests(prev => {
            if (!prev) return null;
            return prev.filter(r => r.id !== id);
        });
        if (authUser) {
            setSystemLogs(prev => [{ id: uuidv4(), timestamp: new Date().toISOString(), employeeId: authUser.id, employeeName: authUser.name, action: 'حذف طلب', details: `تم حذف الطلب رقم #${reqNum}` }, ...prev]);
            sendSystemNotification({ title: 'حذف طلب', message: `قام ${authUser.name} بحذف الطلب رقم #${reqNum}`, type: 'delete_request' });
        }
    }, [requests, authUser, sendSystemNotification, setRequests, setSearchedRequests, setSystemLogs]);

    const deleteRequestsBatch = useCallback(async (ids: string[]): Promise<void> => {
        const { error } = await supabase.from('inspection_requests').delete().in('id', ids);
        if (error) throw error;
        setRequests(prev => prev.filter(r => !ids.includes(r.id)));
        setSearchedRequests(prev => {
            if (!prev) return null;
            return prev.filter(r => !ids.includes(r.id));
        });
        if (authUser && ids.length > 0) {
            setSystemLogs(prev => [{ id: uuidv4(), timestamp: new Date().toISOString(), employeeId: authUser.id, employeeName: authUser.name, action: 'حذف جماعي', details: `تم حذف ${ids.length} طلبات` }, ...prev]);
        }
    }, [authUser, setRequests, setSearchedRequests, setSystemLogs]);

    const addRequest = useCallback(async (request: Omit<InspectionRequest, 'request_number'>): Promise<InspectionRequest> => {
        const { request_number, ...requestData } = request as any;
        const { data, error } = await supabase.from('inspection_requests').insert(requestData).select().single();
        if (error) throw error;
        sendSystemNotification({ title: 'طلب جديد', message: `تم إنشاء طلب جديد برقم #${data.request_number}`, type: 'new_request', link: 'requests', link_id: data.id });
        return data;
    }, [sendSystemNotification]);


    // --- CLIENTS ---
    const ensureLocalClient = useCallback((client: Client) => {
        setClients(prev => prev.some(c => c.id === client.id) ? prev : [...prev, client]);
    }, [setClients]);

    const addClient = useCallback(async (client: Client): Promise<Client> => {
        const { data, error } = await supabase.from('clients').insert(client).select().single();
        if (error) throw error;
        setClients(prev => [...prev, data as Client]);
        return data as Client;
    }, [setClients]);

    const updateClient = useCallback(async (client: Client) => {
        const { error } = await supabase.from('clients').update(client).eq('id', client.id);
        if (error) throw error;
        setClients(prev => prev.map(c => c.id === client.id ? client : c));
    }, [setClients]);

    const deleteClient = useCallback(async (id: string) => {
        const { count } = await supabase.from('inspection_requests').select('id', { count: 'exact', head: true }).eq('client_id', id);
        if (count && count > 0) throw new Error('لا يمكن حذف عميل لديه طلبات فحص.');
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
        setClients(prev => prev.filter(c => c.id !== id));
    }, [setClients]);


    // --- CARS ---
    const addCar = useCallback(async (car: Car): Promise<Car> => {
        const { data, error } = await supabase.from('cars').insert(car).select().single();
        if (error) throw error;
        setCars(prev => [...prev, data as Car]);
        return data as Car;
    }, [setCars]);


    // --- INSPECTION TYPES ---
    const addInspectionType = useCallback(async (type: Omit<InspectionType, 'id'>) => {
        const { data, error } = await supabase.from('inspection_types').insert(type).select().single();
        if (error) throw error;
        setInspectionTypes(prev => [...prev, data as InspectionType]);
    }, [setInspectionTypes]);

    const updateInspectionType = useCallback(async (type: InspectionType) => {
        const { error } = await supabase.from('inspection_types').update(type).eq('id', type.id);
        if (error) throw error;
        setInspectionTypes(prev => prev.map(t => t.id === type.id ? type : t));
    }, [setInspectionTypes]);

    const deleteInspectionType = useCallback(async (id: string) => {
        const { error } = await supabase.from('inspection_types').delete().eq('id', id);
        if (error) throw error;
        setInspectionTypes(prev => prev.filter(t => t.id !== id));
    }, [setInspectionTypes]);


    // --- FINDING CATEGORIES ---
    const addFindingCategory = useCallback(async (category: Omit<CustomFindingCategory, 'id'>) => {
        const { data, error } = await supabase.from('custom_finding_categories').insert(category).select().single();
        if (error) throw error;
        setCustomFindingCategories(prev => [...prev, data as CustomFindingCategory]);
    }, [setCustomFindingCategories]);

    const updateFindingCategory = useCallback(async (category: CustomFindingCategory) => {
        const { error } = await supabase.from('custom_finding_categories').update(category).eq('id', category.id);
        if (error) throw error;
        setCustomFindingCategories(prev => prev.map(c => c.id === category.id ? category : c));
    }, [setCustomFindingCategories]);

    const deleteFindingCategory = useCallback(async (id: string) => {
        const { error } = await supabase.from('custom_finding_categories').delete().eq('id', id);
        if (error) throw error;
        setCustomFindingCategories(prev => prev.filter(c => c.id !== id));
        setPredefinedFindings(prev => prev.filter(f => f.category_id !== id));
    }, [setCustomFindingCategories, setPredefinedFindings]);


    // --- PREDEFINED FINDINGS ---
    const addPredefinedFinding = useCallback(async (finding: Omit<PredefinedFinding, 'id'>) => {
        const { data, error } = await supabase.from('predefined_findings').insert(finding).select().single();
        if (error) throw error;
        setPredefinedFindings(prev => [...prev, data as PredefinedFinding]);
    }, [setPredefinedFindings]);

    const updatePredefinedFinding = useCallback(async (finding: PredefinedFinding) => {
        const { error } = await supabase.from('predefined_findings').update(finding).eq('id', finding.id);
        if (error) throw error;
        setPredefinedFindings(prev => prev.map(f => f.id === finding.id ? finding : f));
    }, [setPredefinedFindings]);

    const deletePredefinedFinding = useCallback(async (id: string) => {
        const { error } = await supabase.from('predefined_findings').delete().eq('id', id);
        if (error) throw error;
        setPredefinedFindings(prev => prev.filter(f => f.id !== id));
    }, [setPredefinedFindings]);


    // --- CAR MAKES & MODELS ---
    const addCarMake = useCallback(async (make: Omit<CarMake, 'id'>): Promise<CarMake> => {
        const { data, error } = await supabase.from('car_makes').insert(make).select().single();
        if (error) throw error;
        setCarMakes(prev => [...prev, data as CarMake]);
        return data as CarMake;
    }, [setCarMakes]);

    const addCarMakesBulk = useCallback(async (makes: Omit<CarMake, 'id'>[]): Promise<void> => {
        const { data, error } = await supabase.from('car_makes').insert(makes).select();
        if (error) throw error;
        setCarMakes(prev => [...prev, ...data as CarMake[]]);
    }, [setCarMakes]);

    const updateCarMake = useCallback(async (make: CarMake) => {
        const { error } = await supabase.from('car_makes').update(make).eq('id', make.id);
        if (error) throw error;
        setCarMakes(prev => prev.map(m => m.id === make.id ? make : m));
    }, [setCarMakes]);

    const deleteCarMake = useCallback(async (id: string) => {
        const { error } = await supabase.from('car_makes').delete().eq('id', id);
        if (error) throw error;
        setCarMakes(prev => prev.filter(m => m.id !== id));
        setCarModels(prev => prev.filter(m => m.make_id !== id));
    }, [setCarMakes, setCarModels]);

    const deleteAllCarMakes = useCallback(async () => {
        const { error } = await supabase.from('car_makes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        setCarMakes([]);
        setCarModels([]);
    }, [setCarMakes, setCarModels]);

    const deleteModelsByMakeId = useCallback(async (makeId: string) => {
        const { error } = await supabase.from('car_models').delete().eq('make_id', makeId);
        if (error) throw error;
        setCarModels(prev => prev.filter(m => m.make_id !== makeId));
    }, [setCarModels]);

    const addCarModel = useCallback(async (model: Omit<CarModel, 'id'>): Promise<CarModel> => {
        const { data, error } = await supabase.from('car_models').insert(model).select().single();
        if (error) throw error;
        setCarModels(prev => [...prev, data as CarModel]);
        return data as CarModel;
    }, [setCarModels]);

    const addCarModelsBulk = useCallback(async (models: Omit<CarModel, 'id'>[]): Promise<void> => {
        const { data, error } = await supabase.from('car_models').insert(models).select();
        if (error) throw error;
        setCarModels(prev => [...prev, ...data as CarModel[]]);
    }, [setCarModels]);

    const updateCarModel = useCallback(async (model: CarModel) => {
        const { error } = await supabase.from('car_models').update(model).eq('id', model.id);
        if (error) throw error;
        setCarModels(prev => prev.map(m => m.id === model.id ? model : m));
    }, [setCarModels]);

    const deleteCarModel = useCallback(async (id: string) => {
        const { error } = await supabase.from('car_models').delete().eq('id', id);
        if (error) throw error;
        setCarModels(prev => prev.filter(m => m.id !== id));
    }, [setCarModels]);

    const findOrCreateCarMake = useCallback(async (name: string): Promise<CarMake> => {
        const searchTerm = name.trim().toLowerCase();
        let { data: existingMake } = await supabase.from('car_makes').select('*').or(`name_en.ilike.%${searchTerm}%,name_ar.ilike.%${searchTerm}%`).maybeSingle();
        if (existingMake) return existingMake;
        return addCarMake({ name_ar: name, name_en: name });
    }, [addCarMake]);

    const findOrCreateCarModel = useCallback(async (name: string, makeId: string): Promise<CarModel> => {
        const searchTerm = name.trim().toLowerCase();
        let { data: existingModel } = await supabase.from('car_models').select('*').eq('make_id', makeId).or(`name_en.ilike.%${searchTerm}%,name_ar.ilike.%${searchTerm}%`).maybeSingle();
        if (existingModel) return existingModel;
        return addCarModel({ name_ar: name, name_en: name, make_id: makeId });
    }, [addCarModel]);


    // --- BROKERS ---
    const addBroker = useCallback(async (broker: Omit<Broker, 'id'>): Promise<Broker> => {
        const brokerWithAudit = {
            ...broker,
            created_by: authUser?.id,
            created_by_name: authUser?.name
        };
        const { data, error } = await supabase.from('brokers').insert(brokerWithAudit).select().single();
        if (error) throw error;
        setBrokers(prev => [...prev, data as Broker]);
        return data as Broker;
    }, [authUser, setBrokers]);

    const updateBroker = useCallback(async (broker: Broker) => {
        const { error } = await supabase.from('brokers').update(broker).eq('id', broker.id);
        if (error) throw error;
        setBrokers(prev => prev.map(b => b.id === broker.id ? broker : b));
    }, [setBrokers]);

    const deleteBroker = useCallback(async (id: string) => {
        const { error } = await supabase.from('brokers').delete().eq('id', id);
        if (error) throw error;
        setBrokers(prev => prev.filter(b => b.id !== id));
    }, [setBrokers]);


    // --- EMPLOYEES ---
    const addEmployee = useCallback(async (employeeData: Omit<Employee, 'id'>): Promise<Employee | undefined> => {
        const { data, error } = await supabase.functions.invoke('create-user', { body: employeeData });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        if (data && data.employee) {
            setEmployees(prev => [...prev, data.employee]);
            return data.employee;
        }
    }, [setEmployees]);

    const updateEmployee = useCallback(async (employeeUpdate: Pick<Employee, 'id'> & Partial<Omit<Employee, 'id'>> & { resetPassword?: boolean }) => {
        const { id, resetPassword, ...updateData } = employeeUpdate;
        if (resetPassword) {
            const emp = employees.find(e => e.id === id);
            if (emp) await supabase.auth.resetPasswordForEmail(emp.email);
            return;
        }
        const { data, error } = await supabase.from('employees').update(updateData).eq('id', id).select().single();
        if (error) throw error;
        if (data) {
            setEmployees(prev => prev.map(e => e.id === id ? data : e));
            if (authUser && authUser.id === id) {
                setAuthUser(prev => prev ? ({ ...prev, ...data }) : data);
            }
        }
        return data ?? undefined;
    }, [authUser, employees, setEmployees, setAuthUser]);

    const adminChangePassword = useCallback(async (userId: string, newPassword: string) => {
        const { data, error } = await supabase.functions.invoke('update-user-password', { body: { userId, newPassword } });
        if (error || data?.error) throw new Error(data?.error || error?.message);
    }, []);

    const deleteEmployee = useCallback(async (id: string) => {
        const { error } = await supabase.functions.invoke('delete-user', { body: { userId: id } });
        if (error) throw error;
        setEmployees(prev => prev.filter(e => e.id !== id));
    }, [setEmployees]);


    // --- EXPENSES & REVENUES ---
    const addExpense = useCallback(async (expense: Omit<Expense, 'id'>) => {
        const { error } = await supabase.from('expenses').insert(expense);
        if (error) throw error;
        fetchAllData();
    }, [fetchAllData]);

    const updateExpense = useCallback(async (expense: Expense) => {
        const { error } = await supabase.from('expenses').update(expense).eq('id', expense.id);
        if (error) throw error;
        fetchAllData();
    }, [fetchAllData]);

    const deleteExpense = useCallback(async (id: string) => {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
        setExpenses(prev => prev.filter(e => e.id !== id));
    }, [setExpenses]);

    const addRevenue = useCallback(async (revenue: Omit<Revenue, 'id'>) => {
        const payload = { date: revenue.date, category: revenue.category, description: revenue.description, amount: revenue.amount, payment_method: revenue.payment_method, employee_id: revenue.employeeId, employee_name: revenue.employeeName };
        const { error } = await supabase.from('other_revenues').insert(payload);
        if (error) throw error;
    }, []);

    const deleteRevenue = useCallback(async (id: string) => {
        const { error } = await supabase.from('other_revenues').delete().eq('id', id);
        if (error) throw error;
    }, []);


    // --- MESSAGES ---
    const sendInternalMessage = useCallback(async (message: Omit<InternalMessage, 'id' | 'created_at' | 'sender_id' | 'sender_name' | 'is_read'>) => {
        if (!authUser) return;
        const { error } = await supabase.from('internal_messages').insert({ ...message, sender_id: authUser.id, sender_name: authUser.name, is_read: false });
        if (error) throw error;
    }, [authUser]);

    const markMessageAsRead = useCallback(async (id: string) => {
        const { error } = await supabase.from('internal_messages').update({ is_read: true }).eq('id', id);
        if (error) throw error;
        setUnreadMessagesCount(prev => Math.max(0, prev - 1));
    }, [setUnreadMessagesCount]);


    // --- TECHNICIANS ---
    const addTechnician = useCallback(async (tech: Omit<Technician, 'id'>): Promise<Technician> => {
        const { data, error } = await supabase.from('technicians').insert(tech).select().single();
        if (error) throw error;
        setTechnicians(prev => [...prev, data as Technician]);
        return data as Technician;
    }, [setTechnicians]);

    const updateTechnician = useCallback(async (tech: Technician) => {
        const { error } = await supabase.from('technicians').update(tech).eq('id', tech.id);
        if (error) throw error;
        setTechnicians(prev => prev.map(t => t.id === tech.id ? tech : t));
    }, [setTechnicians]);

    const deleteTechnician = useCallback(async (id: string) => {
        const { error } = await supabase.from('technicians').delete().eq('id', id);
        if (error) throw error;
        setTechnicians(prev => prev.filter(t => t.id !== id));
    }, [setTechnicians]);


    // --- RESERVATIONS ---
    const addReservation = useCallback(async (reservation: Omit<Reservation, 'id' | 'created_at' | 'status'>) => {
        const { data, error } = await supabase.from('reservations').insert({ ...reservation, status: 'new' }).select().single();
        if (error) throw error;
        setReservations(prev => [data as Reservation, ...prev]);
        addNotification({ title: 'نجاح', message: 'تمت إضافة الحجز.', type: 'success' });
    }, [addNotification, setReservations]);

    const updateReservationStatus = useCallback(async (id: string, status: 'new' | 'confirmed' | 'converted' | 'cancelled') => {
        const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
        if (error) throw error;
        setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    }, [setReservations]);

    const updateReservation = useCallback(async (id: string, data: Partial<Omit<Reservation, 'id' | 'created_at'>>) => {
        const { error } = await supabase.from('reservations').update(data).eq('id', id);
        if (error) throw error;
        setReservations(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
        addNotification({ title: 'تم التحديث', message: 'تم تحديث بيانات الحجز بنجاح.', type: 'success' });
    }, [addNotification, setReservations]);

    const deleteReservation = useCallback(async (id: string) => {
        const { error } = await supabase.from('reservations').delete().eq('id', id);
        if (error) throw error;
        setReservations(prev => prev.filter(r => r.id !== id));
    }, [setReservations]);

    return {
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
        addReservation, updateReservationStatus, updateReservation, deleteReservation,
        sendSystemNotification
    };
};
