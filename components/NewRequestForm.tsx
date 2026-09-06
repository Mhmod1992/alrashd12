
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { Client, Car, CarMake, CarModel, InspectionRequest, PaymentType, RequestStatus, CarSnapshot, InspectionType, Broker, Reservation, TaxMode, getNextWaitingNumber, getWaitingNumber } from '../types';
import Button from './Button';
import { uuidv4 } from '../lib/utils';
import Modal from './Modal';
import CameraScannerModal from './CameraScannerModal';
import ChevronRightIcon from './icons/ChevronRightIcon';
import { supabase } from '../lib/supabaseClient';

// Sub-components
import ReservationReviewCard from './new-request/ReservationReviewCard';
import StepClient from './new-request/StepClient';
import StepCar from './new-request/StepCar';
import StepDetails from './new-request/StepDetails';
import StepBroker from './new-request/StepBroker';
import ClientWelcomeCard from './new-request/ClientWelcomeCard';
import ClientHistoryModal from './ClientHistoryModal';
import CarHistoryModal from './CarHistoryModal';
import CustomDatePicker from './CustomDatePicker';

interface NewRequestFormProps {
    clients: Client[];
    carMakes: CarMake[];
    carModels: CarModel[];
    inspectionTypes: InspectionType[];
    brokers: Broker[];
    onCancel: () => void;
    onSuccess: (newRequest?: InspectionRequest) => void;
    initialReservationData?: Partial<Reservation>;
    initialData?: InspectionRequest; // For Edit Mode
    isReservationMode?: boolean;
    forceWhatsApp?: boolean;
    forceCustomDate?: boolean;
}

const NewRequestForm: React.FC<NewRequestFormProps> = ({
    clients: initialClients = [],
    carMakes: initialMakes = [],
    carModels: initialModels = [],
    inspectionTypes = [],
    brokers = [],
    onCancel,
    onSuccess,
    initialReservationData,
    initialData,
    isReservationMode = false,
    forceWhatsApp = false,
    forceCustomDate = false
}) => {
    const {
        settings, authUser, addClient, addCar, addRequest, addRequestOptimized, addNotification,
        addCarMake, addCarModel, addBroker, showNewRequestSuccessModal, hideNewRequestSuccessModal, showConfirmModal,
        searchClients, searchCarMakes, searchCarModels, checkCarHistory,
        ensureLocalClient, clients, fetchCarModelsByMake, fetchClientRequests,
        setSelectedRequestId, setPage, carMakes: contextCarMakes, carModels: contextCarModels,
        can, updateReservationStatus, updateReservation, updateRequestAndAssociatedData, updateRequest, cars,
        fetchAndUpdateSingleRequest, isCreatingRequest, setIsCreatingRequest, updateClient, addReservation, page,
        sendWhatsAppMessage, whatsappApiStatus, requests, reservations, searchReservations
    } = useAppContext();

    // Responsive Logic
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [currentStep, setCurrentStep] = useState(1);
    const [customDate, setCustomDate] = useState<string>(() => {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    });
    const [sendWhatsAppStartNotify, setSendWhatsAppStartNotify] = useState<boolean>(true);
    const [sendWhatsAppReservationConfirm, setSendWhatsAppReservationConfirm] = useState<boolean>(true);

    // Determine Role & Mode
    const isReceptionistRole = authUser?.role === 'receptionist';
    const isReceptionistMode = isReceptionistRole || page === 'waiting-requests';
    const isEditMode = !!initialData;
    const shouldShowWhatsAppCheckbox = !isReservationMode && !isEditMode && (!!initialReservationData || !isReceptionistMode);
    const hasBrokerStep = !isReceptionistMode && !isReservationMode && can('add_broker_commission');
    const TOTAL_STEPS = hasBrokerStep ? 4 : 3;

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Form state
    const [showClientFields, setShowClientFields] = useState(() => {
        const saved = localStorage.getItem('showClientFields');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [showPlateField, setShowPlateField] = useState(() => {
        const saved = localStorage.getItem('showPlateField');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        localStorage.setItem('showClientFields', JSON.stringify(showClientFields));
    }, [showClientFields]);

    useEffect(() => {
        localStorage.setItem('showPlateField', JSON.stringify(showPlateField));
    }, [showPlateField]);

    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [carMakeId, setCarMakeId] = useState('');
    const [carModelId, setCarModelId] = useState('');
    const [carYear, setCarYear] = useState(new Date().getFullYear());
    const [plateChars, setPlateChars] = useState('');
    const [plateNums, setPlateNums] = useState('');
    const [inspectionTypeId, setInspectionTypeId] = useState('');
    const [inspectionPrice, setInspectionPrice] = useState<number | ''>('');
    const [taxMode, setTaxMode] = useState<TaxMode>(TaxMode.None);

    const calculatedPrice = useMemo(() => {
        const base = Number(inspectionPrice) || 0;
        if (taxMode === TaxMode.Add) return Math.round(base * 1.15 * 100) / 100;
        if (taxMode === TaxMode.Deduct) return Math.round((base / 1.15) * 100) / 100;
        return base;
    }, [inspectionPrice, taxMode]);

    // Default payment to WaitingPayment for receptionists
    const [paymentType, setPaymentType] = useState<PaymentType | ''>(isReceptionistMode ? PaymentType.WaitingPayment : '');
    const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
    const [splitCardAmount, setSplitCardAmount] = useState<number>(0);

    const [paymentNote, setPaymentNote] = useState('');
    const [isFromReservation, setIsFromReservation] = useState(false);
    const [reservationNotes, setReservationNotes] = useState('');
    const [useBroker, setUseBroker] = useState(false);
    const [brokerId, setBrokerId] = useState('');
    const [brokerCommission, setBrokerCommission] = useState(0);
    const [useChassisNumber, setUseChassisNumber] = useState(false);
    const [chassisNumber, setChassisNumber] = useState('');
    const [carMakeSearchTerm, setCarMakeSearchTerm] = useState('');
    const [isMakeDropdownOpen, setIsMakeDropdownOpen] = useState(false);

    const [carModelSearchTerm, setCarModelSearchTerm] = useState('');
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

    const [inspectionTypeSearchTerm, setInspectionTypeSearchTerm] = useState('');
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const [typeSuggestionIndex, setTypeSuggestionIndex] = useState(-1);
    const typeDropdownRef = useRef<HTMLDivElement>(null);
    const typeListRef = useRef<HTMLUListElement>(null);

    // State for suggestions
    const [phoneSuggestions, setPhoneSuggestions] = useState<Client[]>([]);
    const [nameSuggestions, setNameSuggestions] = useState<Client[]>([]);
    const [makeSuggestions, setMakeSuggestions] = useState<CarMake[]>([]);
    const [modelSuggestions, setModelSuggestions] = useState<CarModel[]>([]);

    const [isPhoneSuggestionsOpen, setIsPhoneSuggestionsOpen] = useState(false);
    const [isNameSuggestionsOpen, setIsNameSuggestionsOpen] = useState(false);
    const debounceRef = useRef<number | null>(null);

    // Loading states for search fields
    const [isSearchingClientName, setIsSearchingClientName] = useState(false);
    const [isSearchingClientPhone, setIsSearchingClientPhone] = useState(false);
    const [isSearchingMake, setIsSearchingMake] = useState(false);
    const [isSearchingModel, setIsSearchingModel] = useState(false);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // History Logic
    const [isCheckingHistory, setIsCheckingHistory] = useState(false);
    const [foundHistory, setFoundHistory] = useState<{ car: Car; previousRequests: InspectionRequest[]; lastClient?: Client; make_name_ar?: string; make_name_en?: string; model_name_ar?: string; model_name_en?: string; } | null>(null);
    const historyDebounceRef = useRef<number | null>(null);

    // Debt Logic & Existing Client Info
    const [unpaidDebtAlert, setUnpaidDebtAlert] = useState<any[] | null>(null);
    const [existingClientSummary, setExistingClientSummary] = useState<{ count: number; lastVisit: string; name: string; isVip?: boolean; clientObj?: Client } | null>(null);
    const [isWelcomeCardVisible, setIsWelcomeCardVisible] = useState(false);
    const [isCheckingDebt, setIsCheckingDebt] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isCarHistoryModalOpen, setIsCarHistoryModalOpen] = useState(false);
    const [matchedReservationHint, setMatchedReservationHint] = useState<Reservation | null>(null);
    const debtDebounceRef = useRef<number | null>(null);

    // State for keyboard navigation
    const formRef = useRef<HTMLFormElement>(null);
    const [nameSuggestionIndex, setNameSuggestionIndex] = useState(-1);
    const [phoneSuggestionIndex, setPhoneSuggestionIndex] = useState(-1);
    const [makeSuggestionIndex, setMakeSuggestionIndex] = useState(-1);
    const [modelSuggestionIndex, setModelSuggestionIndex] = useState(-1);

    // Errors State
    const [errors, setErrors] = useState<Record<string, boolean>>({});

    // REFS FOR SCROLLING
    const nameInputRef = useRef<HTMLInputElement>(null);
    const phoneInputRef = useRef<HTMLInputElement>(null);
    const makeDropdownRef = useRef<HTMLDivElement>(null);
    const makeListRef = useRef<HTMLUListElement>(null);
    const makeInputRef = useRef<HTMLInputElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const modelListRef = useRef<HTMLUListElement>(null);
    const modelInputRef = useRef<HTMLInputElement>(null);
    const yearInputRef = useRef<HTMLInputElement>(null);
    const plateCharInputRef = useRef<HTMLInputElement>(null);
    const plateNumInputRef = useRef<HTMLInputElement>(null);
    const chassisInputRef = useRef<HTMLInputElement>(null);
    const typeInputRef = useRef<HTMLInputElement>(null);
    const priceInputRef = useRef<HTMLInputElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Ref for Car Section (for auto scroll)
    const carSectionRef = useRef<HTMLDivElement>(null);
    const clientSectionRef = useRef<HTMLFieldSetElement>(null);

    // Scanner States
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isCarScannerOpen, setIsCarScannerOpen] = useState(false);

    // --- POPULATE FOR EDIT MODE ---
    const populatedIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (initialData && populatedIdRef.current !== initialData.id) {
            const req = initialData;
            // Client
            const existingClient = clients.find(c => c.id === req.client_id);
            if (existingClient) {
                setClientName(existingClient.name);
                setClientPhone(existingClient.phone);
            } else {
                searchClients(req.client_id).then(res => {
                    if (res && res.length > 0) {
                        setClientName(res[0].name);
                        setClientPhone(res[0].phone);
                    }
                });
            }

            // Car
            const existingCar = cars.find(c => c.id === req.car_id);
            
            if (req.car_snapshot) {
                setCarMakeSearchTerm(req.car_snapshot.make_en);
                setCarModelSearchTerm(req.car_snapshot.model_en);
                setCarYear(req.car_snapshot.year);
            }

            if (existingCar) {
                setCarMakeId(existingCar.make_id);
                setCarModelId(existingCar.model_id);
                // Fallback if snapshot missing
                if (!req.car_snapshot) {
                    setCarYear(existingCar.year);
                    const make = contextCarMakes.find(m => m.id === existingCar.make_id);
                    const model = contextCarModels.find(m => m.id === existingCar.model_id);
                    if (make) setCarMakeSearchTerm(make.name_en);
                    if (model) setCarModelSearchTerm(model.name_en);
                }

                if (existingCar.vin) {
                    setUseChassisNumber(true);
                    setChassisNumber(existingCar.vin);
                } else if (existingCar.plate_number) {
                    if (existingCar.plate_number.startsWith('شاصي')) {
                        setUseChassisNumber(true);
                        setChassisNumber(existingCar.plate_number.replace('شاصي ', ''));
                    } else {
                        setUseChassisNumber(false);
                        const parts = existingCar.plate_number.split(' ');
                        const nums = parts.find(p => /^\d+$/.test(p)) || '';
                        const letters = parts.filter(p => !/^\d+$/.test(p)).join(' ');
                        setPlateNums(nums);
                        setPlateChars(letters);
                    }
                }
            }

            // Details
            setInspectionTypeId(req.inspection_type_id);
            const typeObj = inspectionTypes.find(t => t.id === req.inspection_type_id);
            if (typeObj) setInspectionTypeSearchTerm(typeObj.name);
            setInspectionPrice(req.price);
            setPaymentType(req.payment_type);
            
            let rawNote = (req.payment_note || '').replace(/\[W-\d+\]\s*/gi, '').trim();
            if (rawNote.includes('[WA-RES]')) {
                setIsFromReservation(true);
                setPaymentNote(rawNote.replace('[WA-RES]', '').trim());
            } else {
                setPaymentNote(rawNote);
            }

            if (req.payment_type === PaymentType.Split && req.split_payment_details) {
                setSplitCashAmount(req.split_payment_details.cash);
                setSplitCardAmount(req.split_payment_details.card);
            } else {
                setSplitCashAmount(req.price);
                setSplitCardAmount(0);
            }

            // Broker
            if (req.broker) {
                setUseBroker(true);
                setBrokerId(req.broker.id);
                setBrokerCommission(req.broker.commission);
            }

            // Mark as populated for this ID
            populatedIdRef.current = req.id;
        }
    }, [initialData, clients, cars, contextCarMakes, contextCarModels, inspectionTypes]);


    useEffect(() => {
        if (initialReservationData) {
            setIsFromReservation(true);
        }
    }, [initialReservationData]);

    // Helper to get input classes dynamically based on error state
    const getInputClass = (fieldName: string) => {
        const base = "mt-1 block w-full p-3 border rounded-lg shadow-sm focus:ring-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";
        if (errors[fieldName]) {
            return `${base} border-red-500 focus:ring-red-500 focus:border-red-500 animate-pulse`;
        }
        return `${base} border-slate-300 dark:border-slate-600 focus:ring-blue-500`;
    };

    const normalizedPlateCharacters = useMemo(() => {
        return settings.plateCharacters.map(pc => ({
            ...pc,
            ar: pc.ar.replace('ـ', '')
        }));
    }, [settings.plateCharacters]);

    const allowedPlateChars = useMemo(() => {
        const allowed = new Set<string>();
        normalizedPlateCharacters.forEach((pc) => {
            allowed.add(pc.ar);
            allowed.add(pc.en.toLowerCase());
            allowed.add(pc.en.toUpperCase());
        });
        return allowed;
    }, [normalizedPlateCharacters]);

    const { arToEnMap, enToArMap } = useMemo(() => {
        const arToEn = new Map<string, string>();
        const enToAr = new Map<string, string>();
        normalizedPlateCharacters.forEach(pc => {
            arToEn.set(pc.ar, pc.en);
            enToAr.set(pc.en.toUpperCase(), pc.ar);
        });
        return { arToEnMap: arToEn, enToArMap: enToAr };
    }, [normalizedPlateCharacters]);

    const { previewArabicChars, previewEnglishChars } = useMemo(() => {
        const rawChars = plateChars.replace(/\s/g, '').slice(0, 4);
        let arabic = '';
        let english = '';
        for (const char of rawChars.split('')) {
            const upperChar = char.toUpperCase();
            if (arToEnMap.has(char)) {
                arabic += char;
                english = (arToEnMap.get(char) || '') + english;
            } else if (enToArMap.has(upperChar)) {
                english += upperChar;
                arabic = (enToArMap.get(upperChar) || '') + arabic;
            }
        }
        return {
            previewArabicChars: arabic.split('').join(' '),
            previewEnglishChars: english.split('').join(' ')
        };
    }, [plateChars, arToEnMap, enToArMap]);

    // FIX: Define variables for LicensePlatePreview props
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const convertToArabicNumerals = (numStr: string): string => numStr.replace(/\s/g, '').split('').map(digit => arabicNumerals[parseInt(digit, 10)] || digit).join('');
    
    const englishTop = previewEnglishChars;
    const arabicBottom = previewArabicChars;
    const englishBottom = useMemo(() => plateNums.replace(/\s/g, '').replace(/\D/g, '').slice(0, 4).split('').join(' '), [plateNums]);
    const arabicTop = useMemo(() => convertToArabicNumerals(englishBottom), [englishBottom]);

    // NEW: Smart Data Fragmentation Logic
    const compoundMakes = ['مرسيدس بنز', 'لاند روفر', 'رينج روفر', 'استون مارتن', 'الفا روميو', 'جراند شيروكي'];

    const reservationFillData = useMemo(() => {
        if (!initialReservationData) return null;

        let carText = (initialReservationData.car_details || '').trim();
        
        // 1. Extract Year (4 digits starting with 19 or 20)
        const yearMatch = carText.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? yearMatch[0] : '';
        if (yearMatch) {
            carText = carText.replace(yearMatch[0], '').trim();
        }

        // 2. Extract Make (Handle compound names and known makes)
        let make = '';
        let model = '';
        
        // Try compound first
        const foundCompound = compoundMakes.find(cm => carText.toLowerCase().startsWith(cm.toLowerCase()));
        
        // Try context makes
        const foundContextMake = contextCarMakes.find(m => 
            carText.toLowerCase().startsWith(m.name_en.toLowerCase()) || 
            (m.name_ar && carText.startsWith(m.name_ar))
        );

        if (foundCompound) {
            make = foundCompound;
            model = carText.substring(foundCompound.length).trim();
        } else if (foundContextMake) {
            const nameToUse = carText.startsWith(foundContextMake.name_ar || '') ? (foundContextMake.name_ar || '') : foundContextMake.name_en;
            make = nameToUse;
            model = carText.substring(nameToUse.length).trim();
        } else {
            const parts = carText.split(/\s+/);
            make = parts[0] || '';
            model = parts.slice(1).join(' ').trim();
        }

        // 3. Extract Price
        const price = initialReservationData.price || 0;

        const plateText = initialReservationData.plate_text || '';
        const plateNums = plateText.match(/\d+/g)?.join('') || '';
        const plateLetters = plateText.replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();
        const formattedLetters = plateLetters.length > 0 && !plateLetters.includes(' ') ? plateLetters.split('').join(' ') : plateLetters;

        return {
            name: initialReservationData.client_name || '',
            phone: initialReservationData.client_phone || '',
            make,
            model,
            year,
            plateNums,
            plateChars: formattedLetters,
            service: initialReservationData.service_type || '',
            price,
            originalText: initialReservationData.car_details || ''
        };
    }, [initialReservationData, contextCarMakes]);

    const handleManualFill = (field: 'name' | 'phone' | 'make' | 'model' | 'year' | 'plate' | 'service' | 'price') => {
        if (!reservationFillData) return;

        switch (field) {
            case 'name':
                setClientName(reservationFillData.name);
                setTimeout(() => {
                    if (!isMobile) nameInputRef.current?.focus();
                    if (reservationFillData.name.length >= 3) {
                        setIsSearchingClientName(true);
                        searchClients(reservationFillData.name).then(results => {
                            setNameSuggestions(results);
                            setIsNameSuggestionsOpen(results.length > 0);
                            setIsSearchingClientName(false);
                        });
                    }
                }, 50);
                break;
            case 'phone':
                const digits = reservationFillData.phone.replace(/\D/g, '').slice(0, 10);
                setClientPhone(digits);
                setTimeout(() => {
                    if (!isMobile) phoneInputRef.current?.focus();
                    if (digits.length > 3) {
                        setIsSearchingClientPhone(true);
                        searchClients(digits).then(results => {
                            setPhoneSuggestions(results);
                            setIsPhoneSuggestionsOpen(results.length > 0);
                            setIsSearchingClientPhone(false);
                        });
                    }
                }, 50);
                break;
            case 'make':
                setCarMakeSearchTerm(reservationFillData.make);
                
                // Try to resolve Make ID immediately
                const termMake = reservationFillData.make.trim().toLowerCase();
                const matchedMake = contextCarMakes.find(m => 
                    m.name_en.toLowerCase() === termMake || 
                    (m.name_ar && m.name_ar === reservationFillData.make.trim())
                );
                if (matchedMake) {
                    setCarMakeId(matchedMake.id);
                    fetchCarModelsByMake(matchedMake.id);
                }

                if (/\d/.test(reservationFillData.make) || reservationFillData.make.split(/\s+/).length > 2) {
                    addNotification({
                        title: 'تنبيه التوزيع',
                        message: 'يرجى التأكد من فصل اسم الشركة عن الموديل يدوياً.',
                        type: 'warning'
                    });
                }
                setTimeout(() => {
                    if (!isMobile) makeInputRef.current?.focus();
                    setIsMakeDropdownOpen(true);
                    if (reservationFillData.make.length >= 1 && !matchedMake) {
                        setIsSearchingMake(true);
                        searchCarMakes(reservationFillData.make).then(results => {
                            setMakeSuggestions(results);
                            setIsMakeDropdownOpen(results.length > 0);
                            setIsSearchingMake(false);
                        });
                    }
                }, 50);
                break;
            case 'model':
                setCarModelSearchTerm(reservationFillData.model);
                
                let resolvedMakeId = carMakeId;
                if (!resolvedMakeId && reservationFillData.make) {
                    const matched = contextCarMakes.find(m => 
                        m.name_en.toLowerCase() === reservationFillData.make.toLowerCase() || 
                        (m.name_ar && m.name_ar === reservationFillData.make)
                    );
                    if (matched) {
                        setCarMakeId(matched.id);
                        resolvedMakeId = matched.id;
                    }
                }

                setTimeout(() => {
                    if (!isMobile) modelInputRef.current?.focus();
                    setIsModelDropdownOpen(true);
                    if (resolvedMakeId) {
                        const hasModels = contextCarModels.some(m => m.make_id === resolvedMakeId);
                        if (!hasModels) {
                            setIsLoadingModels(true);
                            fetchCarModelsByMake(resolvedMakeId).finally(() => setIsLoadingModels(false));
                        }
                    }

                    if (reservationFillData.model.length >= 1 && resolvedMakeId) {
                        setIsSearchingModel(true);
                        searchCarModels(resolvedMakeId, reservationFillData.model).then(results => {
                            setModelSuggestions(results);
                            setIsModelDropdownOpen(results.length > 0);
                            setIsSearchingModel(false);
                        });
                    }
                }, 50);
                break;
            case 'year':
                const yr = parseInt(reservationFillData.year);
                if (!isNaN(yr)) {
                    setCarYear(yr);
                } else {
                    setCarYear(undefined as any);
                }
                if (!isMobile) setTimeout(() => yearInputRef.current?.focus(), 50);
                break;
            case 'plate':
                setPlateNums(reservationFillData.plateNums);
                setPlateChars(reservationFillData.plateChars);
                if (!isMobile) setTimeout(() => plateCharInputRef.current?.focus(), 50);
                break;
            case 'service':
                if (reservationFillData.service) {
                    const matchedType = inspectionTypes.find(t =>
                        t.name.toLowerCase().includes(reservationFillData.service.toLowerCase()) ||
                        reservationFillData.service.toLowerCase().includes(t.name.toLowerCase())
                    );

                    if (matchedType) {
                        setInspectionTypeId(matchedType.id);
                        setInspectionTypeSearchTerm(matchedType.name);
                        setInspectionPrice(matchedType.price);
                        addNotification({ title: 'تم الاختيار', message: `تم تحديد نوع الفحص: ${matchedType.name}`, type: 'success' });
                    } else {
                        addNotification({ title: 'تنبيه', message: 'لم يتم العثور على نوع فحص مطابق تماماً، يرجى الاختيار من القائمة.', type: 'info' });
                    }
                    if (currentStep < 2 && isMobile) setCurrentStep(2);
                    else if (currentStep < 3 && !isMobile) setCurrentStep(3);
                    if (!isMobile) setTimeout(() => typeInputRef.current?.focus(), 50);
                }
                break;
            case 'price':
                if (reservationFillData.price > 0) {
                    setInspectionPrice(reservationFillData.price);
                }
                break;
        }
    };

    useEffect(() => {
        if (initialReservationData && isReservationMode) {
            setClientName(initialReservationData.client_name || '');
            setClientPhone(initialReservationData.client_phone || '');
            setCarMakeId(initialReservationData.car_make_id || '');
            setCarModelId(initialReservationData.car_model_id || '');
            
            // Extract year from car_details if possible
            const yearMatch = initialReservationData.car_details?.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) setCarYear(parseInt(yearMatch[0]));

            // Extract plate info
            const plateText = initialReservationData.plate_text || '';
            if (plateText.startsWith('شاصي')) {
                setUseChassisNumber(true);
                setChassisNumber(plateText.replace('شاصي ', ''));
            } else {
                const parts = plateText.split(' ');
                const nums = parts.find(p => /^\d+$/.test(p)) || '';
                const letters = parts.filter(p => !/^\d+$/.test(p)).join(' ');
                setPlateNums(nums);
                setPlateChars(letters);
            }

            setInspectionPrice(initialReservationData.price || '');
            setReservationNotes(initialReservationData.notes || '');
        } else if (initialReservationData && reservationFillData) {
            // This is for WhatsApp conversion (not reservation mode)
            addNotification({
                title: 'بيانات الحجز جاهزة',
                message: 'انقر على البيانات في الشريط الأخضر العلوي لتعبئة الحقول بسرعة.',
                type: 'info'
            });
        }
    }, [initialReservationData, reservationFillData, isReservationMode]);

    // Reset suggestion indices when lists change
    useEffect(() => setNameSuggestionIndex(-1), [nameSuggestions]);
    useEffect(() => setPhoneSuggestionIndex(-1), [phoneSuggestions]);
    useEffect(() => setMakeSuggestionIndex(-1), [makeSuggestions]);
    useEffect(() => setModelSuggestionIndex(-1), [modelSuggestions]);

    // --- AUTO SCROLL EFFECTS ---
    const scrollToBottom = () => {
        // Only scroll if not mobile (as per user request "Large Screen") or if desired on both.
        // User said "In the big screen", so let's check !isMobile or just do it generally as it's good UX.
        // However, on mobile the keyboard might pop up, so scrolling to bottom might be jarring if not careful.
        // Let's enable it for now, the browser handles scrollIntoView well.
        if (bottomRef.current) {
            // Use a small timeout to allow UI to settle if needed (e.g. keyboard opening)
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        }
    };

    useEffect(() => {
        if (isMakeDropdownOpen && makeDropdownRef.current) {
            setTimeout(() => {
                makeDropdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [isMakeDropdownOpen]);

    useEffect(() => {
        if (isModelDropdownOpen && modelDropdownRef.current) {
            setTimeout(() => {
                modelDropdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [isModelDropdownOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (makeDropdownRef.current && !makeDropdownRef.current.contains(event.target as Node)) {
                setIsMakeDropdownOpen(false);
            }
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
                setIsTypeDropdownOpen(false);
            }
            if (phoneInputRef.current && !phoneInputRef.current.parentElement?.contains(event.target as Node)) {
                setIsPhoneSuggestionsOpen(false);
            }
            if (nameInputRef.current && !nameInputRef.current.parentElement?.contains(event.target as Node)) {
                setIsNameSuggestionsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Scroll Sync for Dropdowns
    useEffect(() => {
        if (isMakeDropdownOpen && makeListRef.current && makeSuggestionIndex >= 0) {
            const item = makeListRef.current.children[makeSuggestionIndex] as HTMLElement;
            if (item) item.scrollIntoView({ block: 'nearest' });
        }
    }, [makeSuggestionIndex, isMakeDropdownOpen]);

    useEffect(() => {
        if (isModelDropdownOpen && modelListRef.current && modelSuggestionIndex >= 0) {
            const item = modelListRef.current.children[modelSuggestionIndex] as HTMLElement;
            if (item) item.scrollIntoView({ block: 'nearest' });
        }
    }, [modelSuggestionIndex, isModelDropdownOpen]);

    useEffect(() => {
        if (isTypeDropdownOpen && typeListRef.current && typeSuggestionIndex >= 0) {
            const item = typeListRef.current.children[typeSuggestionIndex] as HTMLElement;
            if (item) item.scrollIntoView({ block: 'nearest' });
        }
    }, [typeSuggestionIndex, isTypeDropdownOpen]);

    // --- Automatic History Check Effect ---
    useEffect(() => {
        if (!can('view_car_history_on_create') || isEditMode) {
            return;
        }

        if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);

        const hasPlate = !useChassisNumber && plateChars.trim().length >= 3 && plateNums.trim().length >= 1;
        const hasVin = useChassisNumber && chassisNumber.trim().length >= 5;

        if (!hasPlate && !hasVin) {
            setFoundHistory(null);
            setIsCheckingHistory(false);
            return;
        }

        setIsCheckingHistory(true);
        historyDebounceRef.current = window.setTimeout(async () => {
            const plate = !useChassisNumber ? `${plateChars} ${plateNums}` : null;
            const vin = useChassisNumber ? chassisNumber : null;

            const result = await checkCarHistory(plate, vin);
            setFoundHistory(result);
            setIsCheckingHistory(false);
        }, 1000);

    }, [plateChars, plateNums, useChassisNumber, chassisNumber, checkCarHistory, can, isEditMode]);

    // --- Unpaid Debt & Existing Client Check Effect ---
    useEffect(() => {
        if (!clientPhone || clientPhone.length < 9) {
            setUnpaidDebtAlert(null);
            setExistingClientSummary(null);
            setIsWelcomeCardVisible(false); // Hide if phone cleared
            setIsCheckingDebt(false);
            return;
        }

        if (debtDebounceRef.current) clearTimeout(debtDebounceRef.current);

        setIsCheckingDebt(true);
        debtDebounceRef.current = window.setTimeout(async () => {
            try {
                // First verify client exists
                const foundClients = await searchClients(clientPhone);
                const exactClient = foundClients.find(c => c.phone.includes(clientPhone));

                if (exactClient) {
                    // Fetch full history to determine visit count & debts
                    const history = await fetchClientRequests(exactClient.id);
                    
                    // Set Summary
                    setExistingClientSummary({
                        count: history.length,
                        lastVisit: history.length > 0 ? history[0].created_at : '',
                        name: exactClient.name,
                        isVip: exactClient.is_vip,
                        clientObj: exactClient
                    });
                    
                    // DO NOT automatically show welcome card here, wait for selection or blur
                    // setIsWelcomeCardVisible(true); 

                    // Filter Debts
                    const debts = history.filter(r => 
                         r.status !== RequestStatus.CANCELLED && 
                         r.status !== RequestStatus.WAITING_PAYMENT &&
                         r.payment_type === PaymentType.Unpaid
                    );

                    if (debts.length > 0) {
                        setUnpaidDebtAlert(debts);
                    } else {
                        setUnpaidDebtAlert(null);
                    }

                    // Auto-fill name if empty
                    setClientName(prev => prev.trim() === '' ? exactClient.name : prev);
                } else {
                    setUnpaidDebtAlert(null);
                    setExistingClientSummary(null);
                    setIsWelcomeCardVisible(false);
                }
            } catch (error) {
                console.error("Debt check failed", error);
            } finally {
                setIsCheckingDebt(false);
            }
        }, 600);
    }, [clientPhone, searchClients, fetchClientRequests]);

    // --- Search Reservations for Hint Effect ---
    useEffect(() => {
        if (isReservationMode || !clientPhone) {
            setMatchedReservationHint(null);
            return;
        }

        const cleanPhone = clientPhone.replace(/\D/g, '');
        // Require at least 9 digits (full phone number) before searching for reservation hint
        if (cleanPhone.length < 9) {
            setMatchedReservationHint(null);
            return;
        }

        const last9 = cleanPhone.slice(-9);
        const isPhoneMatching = (resPhone?: string) => {
            if (!resPhone) return false;
            const cleanResPhone = resPhone.replace(/\D/g, '');
            if (cleanResPhone.length < 9) return false;
            return cleanResPhone.endsWith(last9) || last9.endsWith(cleanResPhone.slice(-9));
        };

        // 1. Search local context first (only 'new' status - pending confirmation)
        const localMatch = reservations.find(r => 
            r.status === 'new' && 
            isPhoneMatching(r.client_phone)
        );

        if (localMatch) {
            setMatchedReservationHint(localMatch);
        } else {
            // 2. Query Supabase with last 9 digits
            let isSubscribed = true;
            searchReservations(last9).then(results => {
                if (!isSubscribed) return;
                const match = results.find(r => r.status === 'new' && isPhoneMatching(r.client_phone));
                setMatchedReservationHint(match || null);
            }).catch(() => {
                if (isSubscribed) setMatchedReservationHint(null);
            });

            return () => { isSubscribed = false; };
        }
    }, [clientPhone, isReservationMode, reservations, searchReservations]);


    const handleFillCarData = () => {
        if (!foundHistory) return;
        const { car } = foundHistory;
        setCarYear(car.year);
        addNotification({ title: 'تم الربط', message: 'سيتم استخدام ملف السيارة الموجود في النظام.', type: 'info' });
    };

    // Sync split payment when price changes
    useEffect(() => {
        if (paymentType === PaymentType.Split) {
            const price = Number(inspectionPrice) || 0;
            // If cash is already set, keep it but cap it at the new price
            const newCash = Math.min(splitCashAmount, price);
            setSplitCashAmount(newCash);
            setSplitCardAmount(price - newCash);
        }
    }, [inspectionPrice, paymentType]);

    const handleSplitCashChange = (val: number) => {
        const price = Number(inspectionPrice) || 0;
        const cash = Math.max(0, Math.min(val, price));
        setSplitCashAmount(cash);
        setSplitCardAmount(price - cash);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
        setClientPhone(digits);
        setErrors(prev => ({ ...prev, clientPhone: false }));

        if (digits.trim().length < 4) {
            setPhoneSuggestions([]);
            setIsPhoneSuggestionsOpen(false);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        setIsSearchingClientPhone(true);
        debounceRef.current = window.setTimeout(async () => {
            const results = await searchClients(digits);
            setPhoneSuggestions(results);
            setIsPhoneSuggestionsOpen(results.length > 0);
            setIsSearchingClientPhone(false);
        }, 300);
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        setClientName(name);
        setErrors(prev => ({ ...prev, clientName: false }));

        // If phone is entered, do NOT search by name
        if (clientPhone.trim().length > 0) {
            setNameSuggestions([]);
            setIsNameSuggestionsOpen(false);
            return;
        }

        if (name.trim().length < 3) {
            setNameSuggestions([]);
            setIsNameSuggestionsOpen(false);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        setIsSearchingClientName(true);
        debounceRef.current = window.setTimeout(async () => {
            const results = await searchClients(name);
            setNameSuggestions(results);
            setIsNameSuggestionsOpen(results.length > 0);
            setIsSearchingClientName(false);
        }, 300);
    };

    const handleMakeFocus = () => {
        setIsMakeDropdownOpen(true);
    };

    // --- Server-Side Search for Make ---
    const handleMakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCarMakeSearchTerm(val);
        setCarMakeId('');
        setCarModelId('');
        setCarModelSearchTerm('');
        setErrors(prev => ({ ...prev, carMake: false }));
        setMakeSuggestionIndex(-1);
        setIsMakeDropdownOpen(true);

        if (!val.trim()) {
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        setIsSearchingMake(true);
        debounceRef.current = window.setTimeout(async () => {
            const results = await searchCarMakes(val.trim());
            setMakeSuggestions(results);
            setIsSearchingMake(false);
        }, 300);
    };

    const displayMakes = useMemo(() => {
        const term = carMakeSearchTerm.trim();
        if (term) {
            return makeSuggestions.length > 0 ? makeSuggestions : contextCarMakes.filter(m => m.name_ar.includes(term) || m.name_en.toLowerCase().includes(term.toLowerCase()));
        }
        return contextCarMakes;
    }, [carMakeSearchTerm, makeSuggestions, contextCarMakes]);

    const displayModels = useMemo(() => {
        const term = carModelSearchTerm.trim();
        if (term) {
            return modelSuggestions;
        }
        return contextCarModels.filter(m => m.make_id === carMakeId);
    }, [carModelSearchTerm, modelSuggestions, contextCarModels, carMakeId]);

    const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCarModelSearchTerm(val);
        setCarModelId('');
        setErrors(prev => ({ ...prev, carModel: false }));

        setIsModelDropdownOpen(true);

        if (!val.trim() || !carMakeId) {
            setModelSuggestions([]);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        setIsSearchingModel(true);
        debounceRef.current = window.setTimeout(async () => {
            const results = await searchCarModels(carMakeId, val.trim());
            setModelSuggestions(results);
            setIsSearchingModel(false);
        }, 300);
    };

    const handleModelFocus = () => {
        let currentMakeId = carMakeId;

        // If makeId is missing but search term exists, try to resolve it
        if (!currentMakeId && carMakeSearchTerm.trim()) {
            const term = carMakeSearchTerm.trim().toLowerCase();
            const match = contextCarMakes.find(m => 
                m.name_en.toLowerCase() === term || 
                (m.name_ar && m.name_ar === carMakeSearchTerm.trim())
            );
            if (match) {
                setCarMakeId(match.id);
                currentMakeId = match.id;
            }
        }

        if (!currentMakeId) return;
        setIsModelDropdownOpen(true);

        const hasModels = contextCarModels.some(m => m.make_id === currentMakeId);
        if (!hasModels && !isLoadingModels) {
            setIsLoadingModels(true);
            fetchCarModelsByMake(currentMakeId).finally(() => setIsLoadingModels(false));
        }
    };

    const handleNameFocus = () => {
        // If phone is entered, do NOT open name suggestions
        if (clientPhone.trim().length > 0) return;

        if (clientName.trim().length >= 3 && nameSuggestions.length > 0) {
            setIsNameSuggestionsOpen(true);
        }
    };

    const handlePhoneFocus = () => {
        if (clientPhone.trim().length >= 4 && phoneSuggestions.length > 0) {
            setIsPhoneSuggestionsOpen(true);
        }
    };

    const handleClientSelection = async (client: Client, currentInput?: HTMLElement) => {
        setClientName(client.name);
        setClientPhone(client.phone);
        setIsPhoneSuggestionsOpen(false);
        setIsNameSuggestionsOpen(false);
        setErrors(prev => ({ ...prev, clientName: false, clientPhone: false }));

        setIsCheckingDebt(true);
        try {
             // 1. Fetch History
             const history = await fetchClientRequests(client.id);
             
             setExistingClientSummary({
                 count: history.length,
                 lastVisit: history.length > 0 ? history[0].created_at : '',
                 name: client.name,
                 isVip: client.is_vip,
                 clientObj: client
             });
             
             setIsWelcomeCardVisible(true);

             // 2. Check Debts
             const debts = history.filter(r => 
                r.status !== RequestStatus.CANCELLED &&
                r.status !== RequestStatus.WAITING_PAYMENT && 
                r.payment_type === PaymentType.Unpaid
             );

            if (debts.length > 0) {
                setUnpaidDebtAlert(debts);
                if (clientSectionRef.current) {
                    clientSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                setUnpaidDebtAlert(null);
                if (!isMobile && carSectionRef.current) {
                    carSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    if (history.length === 0) {
                        setTimeout(() => {
                            if (useChassisNumber) {
                                chassisInputRef.current?.focus();
                            } else {
                                plateCharInputRef.current?.focus();
                            }
                        }, 500);
                    }
                }
            }
        } catch (error) {
            console.error("Error checking client history:", error);
        } finally {
            setIsCheckingDebt(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'name' | 'phone' | 'make' | 'model' | 'inspectionType') => {
        let suggestions: any[], isOpen: boolean, setIndex: Function, index: number, selectFn: Function, setOpen: Function;

        switch (type) {
            case 'name': [suggestions, isOpen, setIndex, index, selectFn, setOpen] = [nameSuggestions, isNameSuggestionsOpen, setNameSuggestionIndex, nameSuggestionIndex, handleClientSelection, setIsNameSuggestionsOpen]; break;
            case 'phone': [suggestions, isOpen, setIndex, index, selectFn, setOpen] = [phoneSuggestions, isPhoneSuggestionsOpen, setPhoneSuggestionIndex, phoneSuggestionIndex, handleClientSelection, setIsPhoneSuggestionsOpen]; break;
            case 'make': [suggestions, isOpen, setIndex, index, selectFn, setOpen] = [displayMakes, isMakeDropdownOpen, setMakeSuggestionIndex, makeSuggestionIndex, handleMakeSelection, setIsMakeDropdownOpen]; break;
            case 'model': [suggestions, isOpen, setIndex, index, selectFn, setOpen] = [displayModels, isModelDropdownOpen, setModelSuggestionIndex, modelSuggestionIndex, handleModelSelection, setIsModelDropdownOpen]; break;
            case 'inspectionType': [suggestions, isOpen, setIndex, index, selectFn, setOpen] = [displayInspectionTypes, isTypeDropdownOpen, setTypeSuggestionIndex, typeSuggestionIndex, handleTypeSelection, setIsTypeDropdownOpen]; break;
            default: return;
        }

        if (!isOpen || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setIndex((prev: number) => {
                    const next = (prev + 1) % suggestions.length;
                    document.getElementById(`suggestion-${type}-${next}`)?.scrollIntoView({ block: 'nearest' });
                    return next;
                });
                break;
            case 'ArrowUp':
                e.preventDefault();
                setIndex((prev: number) => {
                    const next = (prev - 1 + suggestions.length) % suggestions.length;
                    document.getElementById(`suggestion-${type}-${next}`)?.scrollIntoView({ block: 'nearest' });
                    return next;
                });
                break;
            case 'Enter':
                e.preventDefault();
                if (index > -1) {
                    selectFn(suggestions[index]);
                } else if (suggestions.length > 0) {
                    selectFn(suggestions[0]);
                }
                break;
            case 'Tab':
                if (index > -1) {
                    e.preventDefault();
                    selectFn(suggestions[index]);
                } else if (suggestions.length > 0) {
                    e.preventDefault();
                    selectFn(suggestions[0]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setOpen(false);
                break;
        }
    };

    const handleMakeSelection = async (make: CarMake) => {
        setCarMakeId(make.id);
        setCarModelId('');
        setCarMakeSearchTerm(make.name_en);
        setCarModelSearchTerm('');
        setIsMakeDropdownOpen(false);
        setErrors(prev => ({ ...prev, carMake: false }));

        setIsLoadingModels(true);
        try {
            await fetchCarModelsByMake(make.id);
        } finally {
            setIsLoadingModels(false);
        }

        setIsModelDropdownOpen(true);
        if (modelInputRef.current && !isMobile) {
            modelInputRef.current.focus();
        }
    };

    const handleModelSelection = (model: CarModel) => {
        setCarModelId(model.id);
        setCarModelSearchTerm(model.name_en);
        setIsModelDropdownOpen(false);
        setErrors(prev => ({ ...prev, carModel: false }));

        if (yearInputRef.current && !isMobile) {
            yearInputRef.current.focus();
        }
    };

    const handleCreateNewMake = (name: string) => {
        setIsMakeDropdownOpen(false);
        showConfirmModal({
            title: 'إضافة شركة جديدة',
            message: `هل أنت متأكد من إضافة "${name}" كشركة مصنعة جديدة؟\nيرجى التحقق من القائمة لتجنب التكرار.`,
            onConfirm: async () => {
                try {
                    const newMake = await addCarMake({ name_ar: name, name_en: name });
                    setCarMakeId(newMake.id);
                    setCarMakeSearchTerm(newMake.name_en);
                    addNotification({ title: 'تم الإضافة', message: 'تم إضافة الشركة بنجاح.', type: 'success' });
                    if (!isMobile) modelInputRef.current?.focus();
                } catch (e) {
                    addNotification({ title: 'خطأ', message: 'فشل إضافة الشركة.', type: 'error' });
                }
            }
        });
    };

    const handleCreateNewModel = (name: string) => {
        setIsModelDropdownOpen(false);
        showConfirmModal({
            title: 'إضافة موديل جديد',
            message: `هل أنت متأكد من إضافة "${name}" كموديل جديد لهذه الشركة؟`,
            onConfirm: async () => {
                try {
                    const newModel = await addCarModel({ name_ar: name, name_en: name, make_id: carMakeId });
                    setCarModelId(newModel.id);
                    setCarModelSearchTerm(newModel.name_en);
                    addNotification({ title: 'تم الإضافة', message: 'تم إضافة الموديل بنجاح.', type: 'success' });
                    if (!isMobile) yearInputRef.current?.focus();
                } catch (e) {
                    addNotification({ title: 'خطأ', message: 'فشل إضافة الموديل.', type: 'error' });
                }
            }
        });
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInspectionTypeSearchTerm(val);
        setInspectionTypeId('');
        setErrors(prev => ({ ...prev, inspectionType: false }));
        setIsTypeDropdownOpen(true);
    };

    const handleTypeFocus = () => {
        setIsTypeDropdownOpen(true);
        scrollToBottom();
    };

    const handleTypeSelection = (type: InspectionType) => {
        setInspectionTypeId(type.id);
        setInspectionTypeSearchTerm(type.name);
        // Removed setInspectionPrice(type.price) to prevent overwriting user-entered price
        setIsTypeDropdownOpen(false);
        setErrors(prev => ({ ...prev, inspectionType: false }));
        if (!isMobile) priceInputRef.current?.focus();
    };

    const displayInspectionTypes = useMemo(() => {
        const counts: Record<string, number> = {};
        requests.forEach(r => {
            if (r.inspection_type_id) {
                counts[r.inspection_type_id] = (counts[r.inspection_type_id] || 0) + 1;
            }
        });
        
        let types = [...inspectionTypes].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
        
        const term = inspectionTypeSearchTerm.trim().toLowerCase();
        if (term) {
            return types.filter(t => t.name.toLowerCase().includes(term));
        }
        return types;
    }, [inspectionTypeSearchTerm, inspectionTypes, requests]);

    const validateClient = () => {
        const newErrors: Record<string, boolean> = {};
        if (showClientFields) {
            if (!clientName.trim()) newErrors['clientName'] = true;
            if (clientPhone.length < 10) newErrors['clientPhone'] = true;
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(prev => ({ ...prev, ...newErrors }));
            if (!isMobile) {
                if (newErrors['clientName']) nameInputRef.current?.focus();
                else if (newErrors['clientPhone']) phoneInputRef.current?.focus();
            }
            addNotification({ title: 'بيانات ناقصة', message: 'الرجاء تعبئة اسم ورقم هاتف العميل بشكل صحيح.', type: 'error' });
            return false;
        }
        return true;
    };

    const validateCar = () => {
        const newErrors: Record<string, boolean> = {};
        if (!isReservationMode) {
            if (useChassisNumber) {
                if (chassisNumber.length < 5) newErrors['chassisNumber'] = true;
            } else if (showPlateField) {
                if (plateChars.trim().length < 1) newErrors['plateChars'] = true;
                if (plateNums.trim().length < 1) newErrors['plateNums'] = true;
            }
        }
        
        if (!foundHistory) {
            if (!carMakeId) newErrors['carMake'] = true;
            if (!carModelId) newErrors['carModel'] = true;
            if (!carYear || carYear < 1900 || carYear > 2100) newErrors['carYear'] = true;
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(prev => ({ ...prev, ...newErrors }));
            if (!isMobile) {
                if (newErrors['chassisNumber']) chassisInputRef.current?.focus();
                else if (newErrors['plateChars']) plateCharInputRef.current?.focus();
                else if (newErrors['plateNums']) plateNumInputRef.current?.focus();
                else if (newErrors['carMake']) makeInputRef.current?.focus();
                else if (newErrors['carModel']) modelInputRef.current?.focus();
                else if (newErrors['carYear']) yearInputRef.current?.focus();
            }
            if (newErrors['carMake'] || newErrors['carModel']) {
                addNotification({ title: 'بيانات ناقصة', message: 'الرجاء اختيار الشركة والموديل من القائمة أو إضافتهما.', type: 'error' });
            } else {
                addNotification({ title: 'بيانات ناقصة', message: 'الرجاء تعبئة بيانات السيارة المطلوبة.', type: 'error' });
            }
            return false;
        }
        return true;
    };

    const validateDetails = () => {
        const newErrors: Record<string, boolean> = {};
        if (!inspectionTypeId) newErrors['inspectionType'] = true;
        if (Number(inspectionPrice) <= 0) newErrors['inspectionPrice'] = true;

        if (!isReservationMode) {
            if (!isReceptionistMode) {
                if (!paymentType) newErrors['paymentType'] = true;
                if (paymentType === PaymentType.Split) {
                    const totalSplit = splitCashAmount + splitCardAmount;
                    if (Math.abs(totalSplit - (Number(inspectionPrice) || 0)) > 0.01) {
                        addNotification({ title: 'خطأ في الدفع', message: 'المبالغ غير متطابقة.', type: 'error' });
                        return false;
                    }
                }
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(prev => ({ ...prev, ...newErrors }));
            if (!isMobile) {
                if (newErrors['inspectionType']) typeInputRef.current?.focus();
                else if (newErrors['inspectionPrice']) priceInputRef.current?.focus();
            }
            addNotification({ title: 'بيانات ناقصة', message: 'الرجاء تعبئة تفاصيل الفحص والسعر.', type: 'error' });
            return false;
        }
        return true;
    };

    const validateStep = (step: number) => {
        if (isMobile) {
            if (step === 1) return validateCar();
            if (step === 2) return validateDetails();
            if (step === 3 && hasBrokerStep) return true;
            if ((step === 3 && !hasBrokerStep) || step === 4) return validateClient();
            return true;
        } else {
            if (step === 1) return validateClient();
            if (step === 2) return validateCar();
            if (step === 3) return validateDetails();
            return true;
        }
    };

    const validateAll = () => {
        const isCarValid = validateCar();
        if (!isCarValid) {
            if (isMobile) setCurrentStep(1);
            return false;
        }
        const isDetailsValid = validateDetails();
        if (!isDetailsValid) {
            if (isMobile) setCurrentStep(2);
            return false;
        }
        const isClientValid = validateClient();
        if (!isClientValid) {
            if (isMobile) setCurrentStep(hasBrokerStep ? 4 : 3);
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => prev + 1);
            if (!isMobile) {
                setTimeout(() => {
                    if (currentStep === 1) {
                        typeInputRef.current?.focus();
                    } else if (currentStep === 2) {
                        if (useChassisNumber) chassisInputRef.current?.focus();
                        else plateCharInputRef.current?.focus();
                    }
                }, 300);
            }
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => prev - 1);
    };

    const handleCancel = () => {
        const hasData = Boolean(
            clientName.trim() ||
            clientPhone.trim() ||
            carMakeId ||
            carModelId ||
            plateChars.trim() ||
            plateNums.trim() ||
            chassisNumber.trim() ||
            carMakeSearchTerm.trim() ||
            carModelSearchTerm.trim() ||
            inspectionTypeId ||
            (inspectionPrice !== '' && inspectionPrice !== 0) ||
            paymentNote.trim() ||
            reservationNotes.trim() ||
            brokerId
        );

        if (hasData) {
            showConfirmModal({
                title: 'تأكيد الإلغاء',
                message: 'هل أنت متأكد من الإلغاء؟ سيتم فقد البيانات المدخلة.',
                icon: 'warning',
                onConfirm: () => {
                    onCancel();
                }
            });
        } else {
            onCancel();
        }
    };

    const handleReservationSubmit = async () => {
        if (!validateAll()) return;

        try {
            const make = contextCarMakes.find(m => m.id === carMakeId) || makeSuggestions.find(m => m.id === carMakeId);
            const model = contextCarModels.find(m => m.id === carModelId) || modelSuggestions.find(m => m.id === carModelId);
            const type = inspectionTypes.find(t => t.id === inspectionTypeId);

            const car_details = `${make?.name_ar || carMakeSearchTerm} ${model?.name_ar || carModelSearchTerm} ${carYear}`;
            const plate_text = useChassisNumber ? `شاصي ${chassisNumber}` : `${plateChars} ${plateNums}`;

            const reservationData = {
                source_text: initialReservationData?.source_text || 'إدخال يدوي (نموذج ديناميكي)',
                client_name: clientName,
                client_phone: clientPhone,
                car_details,
                plate_text,
                service_type: type?.name || 'فحص عام',
                notes: reservationNotes || paymentNote,
                car_make_id: carMakeId,
                car_model_id: carModelId,
                price: Number(inspectionPrice) || 0
            };

            if (initialReservationData?.id) {
                await updateReservation(initialReservationData.id, reservationData);
                addNotification({ title: 'تم التحديث', message: 'تم تحديث بيانات الحجز بنجاح.', type: 'success' });
            } else {
                const savedReservation = await addReservation(reservationData);
                
                if (sendWhatsAppReservationConfirm && whatsappApiStatus === 'connected' && clientPhone) {
                    try {
                        const cleanPhone = clientPhone.replace(/\D/g, '');
                        const phoneWithCode = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone}`;
                        
                        const customer_name = clientName;
                        const car_name = make && model ? `${make.name_en} ${model.name_en} ${carYear}` : car_details;
                        const booking_no = savedReservation.reservation_number ? `RSV-${String(savedReservation.reservation_number).padStart(4, '0')}` : '---';

                        const whatsAppMessage = `أهلاً بك ${customer_name}،

يسعدنا تأكيد حجز موعد فحص مركبتكم بنجاح في مركزنا.

السيارة: ${car_name}
رقم الحجز: ${booking_no}

يرجى إبراز رقم الحجز عند الوصول للمركز.

يسعد فريقنا بخدمتكم في الموعد المحدد، ونتطلع لاستقبالكم.`;

                        await sendWhatsAppMessage(phoneWithCode, whatsAppMessage, customer_name, { suppressModal: true });
                    } catch (wsErr) {
                        console.error("Failed to send reservation confirmation whatsapp message", wsErr);
                    }
                }
            }

            onSuccess();
        } catch (error) {
            console.error("Failed to save reservation", error);
            addNotification({ title: 'خطأ', message: 'فشل حفظ الحجز.', type: 'error' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReservationMode) {
            await handleReservationSubmit();
            return;
        }

        if (!validateAll()) return;

        if (!authUser) {
            addNotification({ title: 'خطأ', message: 'لا يمكن تحديد موظف حالي.', type: 'error' });
            return;
        }

        // Close form and show global loading state immediately
        onCancel();
        setIsCreatingRequest(true);

        try {
            // Construct Common Data
            let make = contextCarMakes.find(m => m.id === carMakeId) || makeSuggestions.find(m => m.id === carMakeId);
            let model = contextCarModels.find(m => m.id === carModelId) || modelSuggestions.find(m => m.id === carModelId);

            // --- FIX START ---
            // If editing a request with a make/model not in the current loaded context (e.g. pagination limits), fetch it directly.
            if (!make && carMakeId) {
                const { data } = await supabase.from('car_makes').select('*').eq('id', carMakeId).single();
                if (data) make = data;
            }

            if (!model && carModelId) {
                const { data } = await supabase.from('car_models').select('*').eq('id', carModelId).single();
                if (data) model = data;
            }
            // --- FIX END ---

            if (!make || !model) throw new Error('Selected make or model not found in context.');

            const plateNumberArabic = useChassisNumber ? null : previewArabicChars.replace(/\s/g, '') + ' ' + plateNums.replace(/\s/g, '').replace(/\D/g, '');
            const plateNumberEnglish = useChassisNumber ? null : previewEnglishChars.replace(/\s/g, '') + ' ' + plateNums.replace(/\s/g, '').replace(/\D/g, '');
            const vin = useChassisNumber ? chassisNumber : null;
            
            const carSnapshot: CarSnapshot = {
                make_ar: make.name_ar, make_en: make.name_en,
                model_ar: model.name_ar, model_en: model.name_en,
                year: carYear
            };

            const newStatus = isReceptionistMode ? RequestStatus.WAITING_PAYMENT : (isEditMode && initialData ? initialData.status : RequestStatus.NEW);
            const finalPaymentType = isReceptionistMode ? PaymentType.WaitingPayment : paymentType;

            let paymentNoteValue = undefined;
            if (initialReservationData || isFromReservation) {
                paymentNoteValue = `[WA-RES] ${paymentNote.trim()}`.trim();
            } else {
                paymentNoteValue = paymentNote.trim() ? paymentNote.trim() : undefined;
            }

            let waitingNum = 100;
            if (newStatus === RequestStatus.WAITING_PAYMENT) {
                waitingNum = getNextWaitingNumber(requests);
                paymentNoteValue = `[W-${waitingNum}] ${paymentNoteValue || ''}`.trim();
            }

            const splitPaymentDetails = paymentType === PaymentType.Split ? { cash: splitCashAmount, card: splitCardAmount } : undefined;
            const brokerValue = (!isReceptionistMode && useBroker && brokerId) ? { id: brokerId, commission: brokerCommission } : null;

            if (isEditMode && initialData) {
                // Find or Create Client (Only for Edit Mode)
                let client: Client | undefined;
                client = clients.find(c => c.phone === clientPhone);

                if (!client) {
                    const existingClients = await searchClients(clientPhone);
                    client = existingClients.find(c => c.phone === clientPhone);

                    if (client) {
                        ensureLocalClient(client);
                    } else {
                        client = { id: uuidv4(), name: clientName, phone: clientPhone };
                        await addClient(client);
                    }
                }

                // Update client name if it changed
                if (client && client.name !== clientName) {
                    const updatedClient = { ...client, name: clientName };
                    await updateClient(updatedClient);
                    client = updatedClient;
                }

                 await updateRequestAndAssociatedData({
                    originalRequest: initialData,
                    formData: {
                        client_id: client.id,
                        car: {
                            make_id: make.id,
                            model_id: model.id,
                            year: carYear,
                            plate_number: plateNumberArabic,
                            plate_number_en: plateNumberEnglish,
                            vin: vin
                        },
                        request: {
                            client_id: client.id,
                            car_snapshot: carSnapshot,
                            inspection_type_id: inspectionTypeId,
                            payment_type: finalPaymentType as PaymentType,
                            payment_note: paymentNoteValue,
                            split_payment_details: splitPaymentDetails,
                            price: Number(inspectionPrice),
                            status: newStatus,
                            broker: brokerValue,
                            updated_at: new Date().toISOString()
                        } as any
                    }
                });

                // Force fetch the specific request to update global state immediately
                await fetchAndUpdateSingleRequest(initialData.id);

                addNotification({ title: 'نجاح', message: 'تم تحديث الطلب بنجاح.', type: 'success' });
                onSuccess(initialData);
            } else {
                const requestDate = forceCustomDate && customDate ? new Date(customDate) : new Date();

                const newAddedRequest = await addRequestOptimized({
                    clientName,
                    clientPhone,
                    carMakeId: make.id,
                    carModelId: model.id,
                    carYear,
                    plateNumber: plateNumberArabic,
                    plateNumberEn: plateNumberEnglish,
                    vin: vin,
                    carSnapshot,
                    inspectionTypeId,
                    paymentType: finalPaymentType as string,
                    paymentNote: paymentNoteValue || '',
                    splitPaymentDetails: splitPaymentDetails,
                    price: Number(inspectionPrice),
                    status: newStatus,
                    employeeId: authUser.id,
                    broker: brokerValue,
                    createdAt: requestDate.toISOString(),
                    reservationId: initialReservationData?.id || null
                });

                if (newAddedRequest) {
                    if (newStatus === RequestStatus.WAITING_PAYMENT) {
                        newAddedRequest.waiting_number = waitingNum;
                    } else {
                        // Ensure official sequential numbering for completed/new requests
                        let nextOfficialNum = 1;
                        try {
                            const { data: maxData } = await supabase
                                .from('inspection_requests')
                                .select('request_number')
                                .neq('status', RequestStatus.WAITING_PAYMENT)
                                .neq('id', newAddedRequest.id)
                                .order('request_number', { ascending: false })
                                .limit(1);
                            if (maxData && maxData.length > 0 && maxData[0].request_number) {
                                nextOfficialNum = Number(maxData[0].request_number) + 1;
                            }
                        } catch (e) {
                            const maxLocal = requests
                                .filter(r => r.status !== RequestStatus.WAITING_PAYMENT && r.id !== newAddedRequest.id)
                                .reduce((max, r) => Math.max(max, Number(r.request_number) || 0), 0);
                            nextOfficialNum = maxLocal + 1;
                        }

                        if (newAddedRequest.request_number !== nextOfficialNum) {
                            await updateRequest({ id: newAddedRequest.id, request_number: nextOfficialNum });
                            newAddedRequest.request_number = nextOfficialNum;
                        }
                    }

                    if (whatsappApiStatus === 'connected' && clientPhone !== '0000000000') {
                        if (newStatus === RequestStatus.WAITING_PAYMENT) {
                            // Automatically send WhatsApp for waiting payment requests with w - {waitingNum}
                            const makeName = carSnapshot.make_en || '';
                            const modelName = carSnapshot.model_en || '';
                            const yearName = carYear || '';
                            const carInfo = (makeName || modelName) ? `🚙 *السيارة: ${makeName} ${modelName} ${yearName}*\n` : '';
                            const inspectionTypeObj = inspectionTypes.find(t => t.id === inspectionTypeId);
                            const inspectionTypeName = inspectionTypeObj ? inspectionTypeObj.name : 'فحص';

                            let phone = clientPhone.replace(/\D/g, '');
                            if (phone.startsWith('05')) {
                                phone = '966' + phone.substring(1);
                            } else if (phone.length === 9 && phone.startsWith('5')) {
                                phone = '966' + phone;
                            }

                            const message = `أهلاً *${clientName}*، طلبك جاهز للدفع.\n\n🧾 *الطلب: w - ${waitingNum} (بانتظار الدفع)*\n${carInfo}📋 *نوع الفحص: ${inspectionTypeName}*\n💳 *المبلغ: ${Number(inspectionPrice)} ريال*\n\nالرجاء إتمام الدفع لدى الكاشير لبدء الفحص.`;
                            await sendWhatsAppMessage(phone, message, clientName, { suppressModal: true });
                        } else if (sendWhatsAppStartNotify && finalPaymentType !== PaymentType.Unpaid) {
                            const message = `حياكم الله *${clientName}*،

*#${newAddedRequest.request_number}*

تم تأكيد استلام مركبتكم *${carSnapshot.make_en || ''} ${carSnapshot.model_en || ''} ${carYear || ''}*
وبدء إجراءات الفحص الفني في مركزنا.
نعمل حالياً على إتمام الفحص وتجهيز التقرير بأعلى معايير الدقة والجودة،
وسيتم إشعاركم فور الجاهزية.
شكراً لاختياركم مركزنا.

*ادارة مركز الراشد*`;
                            await sendWhatsAppMessage(clientPhone, message, clientName, { suppressModal: true });
                        }
                    }

                    showNewRequestSuccessModal(
                        newAddedRequest.id,
                        newStatus === RequestStatus.WAITING_PAYMENT ? waitingNum : newAddedRequest.request_number,
                        forceWhatsApp
                    );
                    onSuccess(newAddedRequest);
                }
            }
        } catch (error) {
            console.error(error);
            addNotification({
                title: 'خطأ',
                message: 'حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.',
                type: 'error',
            });
        } finally {
            setIsCreatingRequest(false);
        }
    };

    const handleViewPreviousReport = (reqId: string) => {
        const url = `${window.location.origin}${window.location.pathname}?page=print-report&requestId=${reqId}&from=print`;
        window.open(url, '_blank');
    };

    const handleViewCarHistory = () => {
        if (!foundHistory) return;
        setIsCarHistoryModalOpen(true);
    };

    const getStepTitle = (step: number) => {
        if (isMobile) {
            switch (step) {
                case 1: return 'بيانات السيارة';
                case 2: return 'تفاصيل الطلب';
                case 3: return hasBrokerStep ? 'السمسار وإنهاء' : 'بيانات العميل';
                case 4: return 'بيانات العميل';
                default: return '';
            }
        }
        switch (step) {
            case 1: return 'بيانات العميل';
            case 2: return 'بيانات السيارة';
            case 3: return 'تفاصيل الطلب';
            case 4: return 'السمسار وإنهاء';
            default: return '';
        }
    }

    const handleScanComplete = useCallback((plateData: { letters: string, numbers: string }) => {
        if (plateData.letters || plateData.numbers) {
            setPlateChars(plateData.letters.split('').join(' '));
            setPlateNums(plateData.numbers.split('').join(' '));
            addNotification({
                title: 'تم المسح بنجاح',
                message: 'تم تعبئة حقول اللوحة. الرجاء المراجعة.',
                type: 'success',
            });
            if (!isMobile) setTimeout(() => makeInputRef.current?.focus(), 500);
        } else {
            addNotification({
                title: 'فشل المسح',
                message: 'لم يتم التعرف على أحرف أو أرقام في الصورة.',
                type: 'error',
            });
        }
        setIsScannerOpen(false);
    }, [addNotification, isMobile]);

    const handleCarIdentifyComplete = useCallback((data: { makeId: string; makeName: string; modelId: string; modelName: string; year: number }) => {
        setIsCarScannerOpen(false);

        setCarMakeId(data.makeId === 'other' ? '' : data.makeId);
        setCarMakeSearchTerm(data.makeName);

        if (data.makeId && data.makeId !== 'other') {
            fetchCarModelsByMake(data.makeId);
        }

        setCarModelId(data.modelId);
        setCarModelSearchTerm(data.modelName);
        setCarYear(data.year);

        setErrors(prev => ({ ...prev, carMake: false, carModel: false, carYear: false }));

        addNotification({
            title: 'تمت التعبئة',
            message: `تم اعتماد البيانات: ${data.makeName} ${data.modelName}`,
            type: 'success',
        });

        if (!isMobile) {
            setTimeout(() => {
                yearInputRef.current?.focus();
            }, 100);
        }
    }, [addNotification, fetchCarModelsByMake, isMobile]);

    const handleMagicFill = useCallback(() => {
        const defaultClient = initialClients.find(c => c.is_system_default);
        if (defaultClient) {
            setClientName(defaultClient.name);
            setClientPhone(defaultClient.phone);
            addNotification({
                title: 'تعبئة سريعة',
                message: `تم اختيار العميل العام: ${defaultClient.name}`,
                type: 'success'
            });
            // Auto scroll to car section if name/phone are set
            if (!isMobile) {
                setTimeout(() => {
                    carSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                    if (useChassisNumber) chassisInputRef.current?.focus();
                    else plateCharInputRef.current?.focus();
                }, 300);
            }
        } else {
            addNotification({
                title: 'تنبيه',
                message: 'لم يتم تعيين عميل عام في النظام بعد. يمكنك تعيينه من صفحة العملاء.',
                type: 'info'
            });
        }
    }, [initialClients, addNotification, isMobile, useChassisNumber]);

    return (
        <>
            {isMobile && (
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {getStepTitle(currentStep)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            خطوة {currentStep} من {TOTAL_STEPS}
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
                        ></div>
                    </div>
                </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 pb-20 md:pb-0">

                {forceCustomDate && (
                    <div className="bg-amber-500/10 dark:bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 shadow-sm animate-fade-in">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-amber-600 dark:text-amber-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    <span>إنشاء طلب جديد بتاريخ مخصص</span>
                                </h4>
                                <p className="text-xs text-amber-650 dark:text-amber-500/80">
                                    أنت تقوم بإنشاء هذا الطلب بتاريخ قديم أو مخصص يدوياً.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <CustomDatePicker
                                    value={customDate.split('T')[0]}
                                    onChange={(dateVal) => {
                                        const timePart = customDate.includes('T') ? customDate.split('T')[1] : '12:00';
                                        setCustomDate(`${dateVal}T${timePart}`);
                                    }}
                                    maxDate={null}
                                    className="p-2.5 bg-white dark:bg-slate-900 border border-amber-500/30 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                />
                                <input
                                    type="time"
                                    value={customDate.includes('T') ? customDate.split('T')[1].slice(0, 5) : '12:00'}
                                    onChange={(e) => {
                                        const datePart = customDate.split('T')[0];
                                        setCustomDate(`${datePart}T${e.target.value || '12:00'}`);
                                    }}
                                    className="p-2.5 bg-white dark:bg-slate-900 border border-amber-500/30 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono w-28"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Toggles for display - ONLY in Reservation Mode */}
                {isReservationMode && (
                    <div className="flex flex-wrap gap-4 mb-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border dark:border-slate-700 shadow-sm">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                                type="checkbox" 
                                checked={showClientFields} 
                                onChange={(e) => setShowClientFields(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all"
                            />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">إظهار بيانات العميل</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                                type="checkbox" 
                                checked={showPlateField} 
                                onChange={(e) => setShowPlateField(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all"
                            />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">إظهار حقل اللوحة</span>
                        </label>
                    </div>
                )}

                {!isReservationMode && (
                    <ReservationReviewCard 
                        data={reservationFillData} 
                        onManualFill={handleManualFill} 
                    />
                )}

                {/* Reservation Hint Card for Incoming Reservations */}
                {matchedReservationHint && !isReservationMode && (
                    <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-amber-50 dark:from-slate-800 dark:via-indigo-950/40 dark:to-amber-950/20 border-2 border-indigo-200 dark:border-indigo-800/60 p-4 rounded-2xl shadow-md animate-fade-in mb-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm shrink-0 mt-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="space-y-1 w-full">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">💡 تلميح: حجز سابق مسجل</span>
                                    <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-md">
                                        رقم الحجز: #{matchedReservationHint.reservation_number || 'بدون رقم'}
                                    </span>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    تم العثور على حجز وارد للعميل: <span className="text-indigo-600 dark:text-indigo-400">{matchedReservationHint.client_name}</span>
                                </p>
                                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1 bg-white/60 dark:bg-slate-900/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-700 dark:text-slate-200">السيارة:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-100 font-sans dir-ltr inline-block">
                                            {(() => {
                                                const allMakes = (contextCarMakes && contextCarMakes.length > 0) ? contextCarMakes : initialMakes;
                                                const allModels = (contextCarModels && contextCarModels.length > 0) ? contextCarModels : initialModels;
                                                
                                                let makeEn = '';
                                                let modelEn = '';

                                                if (matchedReservationHint.car_make_id) {
                                                    const makeObj = allMakes.find(m => m.id === matchedReservationHint.car_make_id);
                                                    if (makeObj) makeEn = makeObj.name_en || makeObj.name_ar;
                                                }

                                                if (matchedReservationHint.car_model_id) {
                                                    const modelObj = allModels.find(m => m.id === matchedReservationHint.car_model_id);
                                                    if (modelObj) modelEn = modelObj.name_en || modelObj.name_ar;
                                                }

                                                const yearMatch = matchedReservationHint.car_details?.match(/\b(19|20)\d{2}\b/);
                                                const yearStr = yearMatch ? yearMatch[0] : '';

                                                if (makeEn || modelEn) {
                                                    return `${makeEn} ${modelEn} ${yearStr}`.trim();
                                                }

                                                return matchedReservationHint.car_details || 'غير مسجلة';
                                            })()}
                                        </span>
                                    </div>
                                    {matchedReservationHint.notes && (
                                        <div className="flex items-start gap-2">
                                            <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">الملاحظة:</span>
                                            <span className="text-amber-700 dark:text-amber-400 font-semibold">{matchedReservationHint.notes}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className={isMobile && currentStep !== (hasBrokerStep ? 4 : 3) ? 'hidden' : 'block animate-fade-in'}>
                    {(isReservationMode ? showClientFields : true) && (
                        <StepClient 
                            stepNumber={isMobile ? TOTAL_STEPS : 1}
                            clientName={clientName}
                            clientPhone={clientPhone}
                            onNameChange={handleNameChange}
                            onPhoneChange={handlePhoneChange}
                            onNameFocus={handleNameFocus}
                            onPhoneFocus={handlePhoneFocus}
                            onKeyDown={handleKeyDown}
                            nameInputRef={nameInputRef}
                            phoneInputRef={phoneInputRef}
                            isSearchingClientName={isSearchingClientName}
                            isSearchingClientPhone={isSearchingClientPhone}
                            isNameSuggestionsOpen={isNameSuggestionsOpen}
                            isPhoneSuggestionsOpen={isPhoneSuggestionsOpen}
                            nameSuggestions={nameSuggestions}
                            phoneSuggestions={phoneSuggestions}
                            nameSuggestionIndex={nameSuggestionIndex}
                            phoneSuggestionIndex={phoneSuggestionIndex}
                            setNameSuggestionIndex={setNameSuggestionIndex}
                            setPhoneSuggestionIndex={setPhoneSuggestionIndex}
                            onClientSelection={handleClientSelection}
                            unpaidDebtAlert={unpaidDebtAlert}
                            getInputClass={getInputClass}
                            existingClientSummary={existingClientSummary}
                            isReservationMode={isReservationMode}
                            onMagicFill={handleMagicFill}
                            hasDefaultClient={initialClients.some(c => c.is_system_default)}
                            isMobile={isMobile}
                            whatsappApiStatus={(shouldShowWhatsAppCheckbox || (isReservationMode && (!initialReservationData || !initialReservationData.id))) ? whatsappApiStatus : undefined}
                            sendWhatsAppStartNotify={sendWhatsAppStartNotify}
                            setSendWhatsAppStartNotify={setSendWhatsAppStartNotify}
                            sendWhatsAppReservationConfirm={sendWhatsAppReservationConfirm}
                            setSendWhatsAppReservationConfirm={setSendWhatsAppReservationConfirm}
                        />
                    )}
                </div>

                <div className={isMobile && currentStep !== 1 ? 'hidden' : 'block animate-fade-in'} ref={carSectionRef}>
                    <StepCar 
                        stepNumber={isMobile ? 1 : 2}
                        useChassisNumber={useChassisNumber}
                        setUseChassisNumber={setUseChassisNumber}
                        plateChars={plateChars}
                        setPlateChars={setPlateChars}
                        plateNums={plateNums}
                        setPlateNums={setPlateNums}
                        chassisNumber={chassisNumber}
                        setChassisNumber={setChassisNumber}
                        isCheckingHistory={isCheckingHistory}
                        settings={settings}
                        plateCharInputRef={plateCharInputRef}
                        plateNumInputRef={plateNumInputRef}
                        chassisInputRef={chassisInputRef}
                        makeInputRef={makeInputRef}
                        modelInputRef={modelInputRef}
                        yearInputRef={yearInputRef}
                        makeDropdownRef={makeDropdownRef}
                        modelDropdownRef={modelDropdownRef}
                        makeListRef={makeListRef}
                        modelListRef={modelListRef}
                        setIsScannerOpen={setIsScannerOpen}
                        setIsCarScannerOpen={setIsCarScannerOpen}
                        foundHistory={foundHistory}
                        handleViewPreviousReport={handleViewPreviousReport}
                        handleViewCarHistory={handleViewCarHistory}
                        handleFillCarData={handleFillCarData}
                        canViewHistory={can('view_car_history_on_create')}
                        carMakeSearchTerm={carMakeSearchTerm}
                        handleMakeChange={handleMakeChange}
                        handleMakeFocus={handleMakeFocus}
                        setIsMakeDropdownOpen={setIsMakeDropdownOpen}
                        handleKeyDown={handleKeyDown}
                        isMakeDropdownOpen={isMakeDropdownOpen}
                        isSearchingMake={isSearchingMake}
                        displayMakes={displayMakes}
                        handleMakeSelection={handleMakeSelection}
                        handleCreateNewMake={handleCreateNewMake}
                        makeSuggestionIndex={makeSuggestionIndex}
                        setMakeSuggestionIndex={setMakeSuggestionIndex}
                        carModelSearchTerm={carModelSearchTerm}
                        handleModelChange={handleModelChange}
                        handleModelFocus={handleModelFocus}
                        isModelDropdownOpen={isModelDropdownOpen}
                        setIsModelDropdownOpen={setIsModelDropdownOpen}
                        isSearchingModel={isSearchingModel}
                        isLoadingModels={isLoadingModels}
                        displayModels={displayModels}
                        handleModelSelection={handleModelSelection}
                        handleCreateNewModel={handleCreateNewModel}
                        modelSuggestionIndex={modelSuggestionIndex}
                        setModelSuggestionIndex={setModelSuggestionIndex}
                        carMakeId={carMakeId}
                        carYear={carYear}
                        setCarYear={setCarYear}
                        getInputClass={getInputClass}
                        previewArabicChars={previewArabicChars}
                        previewEnglishChars={previewEnglishChars}
                        arabicTop={arabicTop}
                        arabicBottom={arabicBottom}
                        englishTop={englishTop}
                        englishBottom={englishBottom}
                        isReservationMode={isReservationMode}
                        showPlateField={isReservationMode ? showPlateField : true}
                    />
                </div>

                <div className={isMobile && currentStep !== 2 ? 'hidden' : 'block animate-fade-in'}>
                    <StepDetails 
                        stepNumber={isMobile ? 2 : 3}
                        inspectionTypeId={inspectionTypeId}
                        setInspectionTypeId={setInspectionTypeId}
                        inspectionTypes={inspectionTypes}
                        inspectionPrice={inspectionPrice}
                        setInspectionPrice={setInspectionPrice}
                        taxMode={taxMode}
                        setTaxMode={setTaxMode}
                        calculatedPrice={calculatedPrice}
                        paymentType={paymentType}
                        setPaymentType={setPaymentType as any}
                        isReceptionist={isReceptionistMode}
                        paymentNote={paymentNote}
                        setPaymentNote={setPaymentNote}
                        reservationNotes={reservationNotes}
                        setReservationNotes={setReservationNotes}
                        splitCashAmount={splitCashAmount}
                        onSplitCashChange={handleSplitCashChange}
                        splitCardAmount={splitCardAmount}
                        typeInputRef={typeInputRef}
                        priceInputRef={priceInputRef}
                        getInputClass={getInputClass}
                        onInspectionTypeFocus={handleTypeFocus}
                        isReservationMode={isReservationMode}
                        inspectionTypeSearchTerm={inspectionTypeSearchTerm}
                        handleTypeChange={handleTypeChange}
                        isTypeDropdownOpen={isTypeDropdownOpen}
                        setIsTypeDropdownOpen={setIsTypeDropdownOpen}
                        displayInspectionTypes={displayInspectionTypes}
                        handleTypeSelection={handleTypeSelection}
                        typeSuggestionIndex={typeSuggestionIndex}
                        setTypeSuggestionIndex={setTypeSuggestionIndex}
                        typeDropdownRef={typeDropdownRef}
                        typeListRef={typeListRef}
                        handleKeyDown={handleKeyDown}
                        isEditMode={isEditMode}
                    />
                </div>

                {hasBrokerStep && (
                    <div className={isMobile && currentStep !== 3 ? 'hidden' : 'block animate-fade-in'}>
                        <StepBroker 
                            stepNumber={isMobile ? 3 : 4}
                            useBroker={useBroker}
                            setUseBroker={setUseBroker}
                            brokerId={brokerId}
                            setBrokerId={setBrokerId}
                            brokerCommission={brokerCommission}
                            setBrokerCommission={setBrokerCommission}
                            brokers={brokers}
                        />
                    </div>
                )}

                {/* Bottom Spacer for Mobile Sticky Footer */}
                {isMobile && <div className="h-24" />}

                <div className="sticky bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-700 md:static md:bg-transparent md:border-t-0 md:p-0 md:mt-6 z-20">
                    <div className="flex justify-between gap-4 max-w-4xl mx-auto md:max-w-none md:justify-end">
                        {isMobile ? (
                            <>
                                <Button type="button" variant="secondary" onClick={currentStep === 1 ? handleCancel : handleBack} className="w-1/3">
                                    {currentStep === 1 ? 'إلغاء' : 'السابق'}
                                </Button>

                                {currentStep < TOTAL_STEPS ? (
                                    <Button type="button" onClick={handleNext} className="w-2/3 flex-1 justify-center">
                                        التالي <ChevronRightIcon className="w-4 h-4 ms-2 transform rotate-180" />
                                    </Button>
                                ) : (
                                    <Button 
                                    type="submit" 
                                    className="w-2/3 flex-1 justify-center font-bold text-lg"
                                    disabled={isCreatingRequest || (isReservationMode && (!carMakeId || !carModelId || !carYear || !inspectionTypeId || !inspectionPrice))}
                                >
                                    {isReservationMode ? 'حفظ الحجز' : (initialReservationData ? 'تأكيد البيانات وتثبيت الحجز' : (isReceptionistMode ? 'حفظ الطلب' : (isEditMode ? 'حفظ التعديلات' : 'إنشاء الطلب')))}
                                </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Button type="button" variant="secondary" onClick={handleCancel}>
                                    إلغاء
                                </Button>
                                <Button 
                                    type="submit" 
                                    className="font-bold"
                                    disabled={isCreatingRequest || (isReservationMode && (!carMakeId || !carModelId || !carYear || !inspectionTypeId || !inspectionPrice))}
                                >
                                    {isReservationMode ? 'حفظ الحجز' : (initialReservationData ? 'تأكيد البيانات وتثبيت الحجز' : (isReceptionistMode ? 'حفظ الطلب' : (isEditMode ? 'حفظ التعديلات' : 'إنشاء الطلب')))}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
                <div ref={bottomRef} />
            </form>
            
            {/* Render Floating Card */}
            {existingClientSummary && (
                <ClientWelcomeCard 
                    isVisible={isWelcomeCardVisible}
                    clientName={existingClientSummary.name}
                    visitCount={existingClientSummary.count}
                    lastVisit={existingClientSummary.lastVisit}
                    isVip={existingClientSummary.isVip}
                    unpaidRequestsCount={unpaidDebtAlert?.length || 0}
                    totalDebt={unpaidDebtAlert?.reduce((sum, req) => sum + (Number(req.price) || 0), 0) || 0}
                    onClose={() => setIsWelcomeCardVisible(false)}
                    onViewHistory={() => {
                        setIsWelcomeCardVisible(false);
                        setIsHistoryModalOpen(true);
                    }}
                />
            )}

            <ClientHistoryModal 
                isOpen={isHistoryModalOpen} 
                client={existingClientSummary?.clientObj || (clientPhone ? clients.find(c => c.phone.includes(clientPhone)) || null : null)} 
                onClose={() => setIsHistoryModalOpen(false)} 
            />

            <CarHistoryModal 
                isOpen={isCarHistoryModalOpen}
                car={foundHistory?.car || null}
                requests={foundHistory?.previousRequests || []}
                onClose={() => setIsCarHistoryModalOpen(false)}
            />

            <CameraScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanComplete={handleScanComplete}
                mode="plate"
            />

            <CameraScannerModal
                isOpen={isCarScannerOpen}
                onClose={() => setIsCarScannerOpen(false)}
                onCarIdentify={handleCarIdentifyComplete}
                mode="car"
            />
        </>
    );
};

export default NewRequestForm;
