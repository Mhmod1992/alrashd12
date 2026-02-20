
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { Client, Car, CarMake, CarModel, InspectionRequest, PaymentType, RequestStatus, CarSnapshot, InspectionType, Broker, Reservation } from '../types';
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

interface NewRequestFormProps {
    clients: Client[];
    carMakes: CarMake[];
    carModels: CarModel[];
    inspectionTypes: InspectionType[];
    brokers: Broker[];
    onCancel: () => void;
    onSuccess: (newRequest?: InspectionRequest) => void;
    initialReservationData?: Reservation;
    initialData?: InspectionRequest; // For Edit Mode
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
    initialData
}) => {
    const {
        settings, authUser, addClient, addCar, addRequest, addNotification,
        addCarMake, addCarModel, addBroker, showNewRequestSuccessModal, hideNewRequestSuccessModal, showConfirmModal,
        searchClients, searchCarMakes, searchCarModels, checkCarHistory,
        ensureLocalClient, clients, fetchCarModelsByMake, fetchClientRequests,
        setSelectedRequestId, setPage, carMakes: contextCarMakes, carModels: contextCarModels,
        can, updateReservationStatus, updateReservation, updateRequestAndAssociatedData, cars,
        fetchAndUpdateSingleRequest
    } = useAppContext();

    // Responsive Logic
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [currentStep, setCurrentStep] = useState(1);

    // Determine Role & Mode
    const isReceptionist = authUser?.role === 'receptionist';
    const isEditMode = !!initialData;
    const TOTAL_STEPS = isReceptionist ? 3 : 4;

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Form state
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [carMakeId, setCarMakeId] = useState('');
    const [carModelId, setCarModelId] = useState('');
    const [carYear, setCarYear] = useState(new Date().getFullYear());
    const [plateChars, setPlateChars] = useState('');
    const [plateNums, setPlateNums] = useState('');
    const [inspectionTypeId, setInspectionTypeId] = useState('');
    const [inspectionPrice, setInspectionPrice] = useState<number | ''>('');

    // Default payment to Unpaid for receptionists
    const [paymentType, setPaymentType] = useState<PaymentType | ''>(isReceptionist ? PaymentType.Unpaid : '');
    const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
    const [splitCardAmount, setSplitCardAmount] = useState<number>(0);

    const [paymentNote, setPaymentNote] = useState('');
    const [useBroker, setUseBroker] = useState(false);
    const [brokerId, setBrokerId] = useState('');
    const [brokerCommission, setBrokerCommission] = useState(0);
    const [useChassisNumber, setUseChassisNumber] = useState(false);
    const [chassisNumber, setChassisNumber] = useState('');
    const [carMakeSearchTerm, setCarMakeSearchTerm] = useState('');
    const [isMakeDropdownOpen, setIsMakeDropdownOpen] = useState(false);

    const [carModelSearchTerm, setCarModelSearchTerm] = useState('');
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);


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
    const [foundHistory, setFoundHistory] = useState<{ car: Car; previousRequests: InspectionRequest[]; lastClient?: Client } | null>(null);
    const historyDebounceRef = useRef<number | null>(null);

    // Debt Logic & Existing Client Info
    const [unpaidDebtAlert, setUnpaidDebtAlert] = useState<any[] | null>(null);
    const [existingClientSummary, setExistingClientSummary] = useState<{ count: number; lastVisit: string; name: string; isVip?: boolean } | null>(null);
    const [isWelcomeCardVisible, setIsWelcomeCardVisible] = useState(false);
    const [isCheckingDebt, setIsCheckingDebt] = useState(false);
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
    const typeInputRef = useRef<HTMLSelectElement>(null);
    const priceInputRef = useRef<HTMLInputElement>(null);

    // Ref for Car Section (for auto scroll)
    const carSectionRef = useRef<HTMLDivElement>(null);
    const clientSectionRef = useRef<HTMLFieldSetElement>(null);

    // Scanner States
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isCarScannerOpen, setIsCarScannerOpen] = useState(false);

    // --- POPULATE FOR EDIT MODE ---
    useEffect(() => {
        if (initialData) {
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
            setInspectionPrice(req.price);
            setPaymentType(req.payment_type);
            setPaymentNote(req.payment_note || '');
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
        }
    }, [initialData, clients, cars, contextCarMakes, contextCarModels]);


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

    // NEW: Reservation Data Parsing for Manual Fill
    const reservationFillData = useMemo(() => {
        if (!initialReservationData) return null;

        const plateText = initialReservationData.plate_text || '';
        const plateNums = plateText.match(/\d+/g)?.join('') || '';
        const plateLetters = plateText.replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();
        const formattedLetters = plateLetters.length > 0 && !plateLetters.includes(' ') ? plateLetters.split('').join(' ') : plateLetters;

        const carParts = (initialReservationData.car_details || '').split(' - ');
        const make = carParts[0] || '';
        const model = carParts[1] || '';
        const year = carParts[2] || '';

        return {
            name: initialReservationData.client_name || '',
            phone: initialReservationData.client_phone || '',
            make,
            model,
            year,
            plateNums,
            plateChars: formattedLetters,
            service: initialReservationData.service_type || ''
        };
    }, [initialReservationData]);

    const handleManualFill = (field: 'name' | 'phone' | 'make' | 'model' | 'year' | 'plate' | 'service') => {
        if (!reservationFillData) return;

        switch (field) {
            case 'name':
                setClientName(reservationFillData.name);
                setTimeout(() => {
                    nameInputRef.current?.focus();
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
                    phoneInputRef.current?.focus();
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
                setTimeout(() => {
                    makeInputRef.current?.focus();
                    setIsMakeDropdownOpen(true);
                    if (reservationFillData.make.length >= 1) {
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
                addNotification({
                    title: 'تنبيه',
                    message: 'يرجى كتابة الموديل يدوياً لضمان اختياره بشكل صحيح من القائمة.',
                    type: 'info'
                });
                setTimeout(() => modelInputRef.current?.focus(), 50);
                break;
            case 'year':
                const yr = parseInt(reservationFillData.year);
                if (!isNaN(yr)) setCarYear(yr);
                setTimeout(() => yearInputRef.current?.focus(), 50);
                break;
            case 'plate':
                setPlateNums(reservationFillData.plateNums);
                setPlateChars(reservationFillData.plateChars);
                setTimeout(() => plateCharInputRef.current?.focus(), 50);
                break;
            case 'service':
                if (reservationFillData.service) {
                    const matchedType = inspectionTypes.find(t =>
                        t.name.toLowerCase().includes(reservationFillData.service.toLowerCase()) ||
                        reservationFillData.service.toLowerCase().includes(t.name.toLowerCase())
                    );

                    if (matchedType) {
                        setInspectionTypeId(matchedType.id);
                        setInspectionPrice(matchedType.price);
                        addNotification({ title: 'تم الاختيار', message: `تم تحديد نوع الفحص: ${matchedType.name}`, type: 'success' });
                    } else {
                        addNotification({ title: 'تنبيه', message: 'لم يتم العثور على نوع فحص مطابق تماماً، يرجى الاختيار من القائمة.', type: 'info' });
                    }
                    if (currentStep < 3) setCurrentStep(3);
                    setTimeout(() => typeInputRef.current?.focus(), 50);
                }
                break;
        }
    };

    // Reset suggestion indices when lists change
    useEffect(() => setNameSuggestionIndex(-1), [nameSuggestions]);
    useEffect(() => setPhoneSuggestionIndex(-1), [phoneSuggestions]);
    useEffect(() => setMakeSuggestionIndex(-1), [makeSuggestions]);
    useEffect(() => setModelSuggestionIndex(-1), [modelSuggestions]);

    // --- AUTO SCROLL EFFECTS ---
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
                        isVip: exactClient.is_vip
                    });
                    
                    setIsWelcomeCardVisible(true); // Show Floating Card

                    // Filter Debts
                    const debts = history.filter(r => 
                         r.status === RequestStatus.WAITING_PAYMENT || 
                         (r.payment_type === PaymentType.Unpaid && r.status !== RequestStatus.COMPLETE)
                    );

                    if (debts.length > 0) {
                        setUnpaidDebtAlert(debts);
                    } else {
                        setUnpaidDebtAlert(null);
                    }

                    // Auto-fill name if empty
                    if (!clientName) setClientName(exactClient.name);
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
    }, [clientPhone, searchClients, fetchClientRequests, clientName]);


    const handleFillCarData = () => {
        if (!foundHistory) return;
        const { car } = foundHistory;
        setCarYear(car.year);
        addNotification({ title: 'تم الربط', message: 'سيتم استخدام ملف السيارة الموجود في النظام.', type: 'info' });
    };

    const handleSplitCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setSplitCashAmount(val);
        if (inspectionPrice !== '') {
            setSplitCardAmount(Number(inspectionPrice) - val);
        }
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
            const results = await searchCarMakes(val);
            setMakeSuggestions(results);
            setIsSearchingMake(false);
        }, 300);
    };

    const displayMakes = useMemo(() => {
        if (carMakeSearchTerm.trim()) {
            return makeSuggestions.length > 0 ? makeSuggestions : contextCarMakes.filter(m => m.name_ar.includes(carMakeSearchTerm) || m.name_en.toLowerCase().includes(carMakeSearchTerm.toLowerCase()));
        }
        return contextCarMakes;
    }, [carMakeSearchTerm, makeSuggestions, contextCarMakes]);

    const displayModels = useMemo(() => {
        if (carModelSearchTerm.trim()) {
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
            const results = await searchCarModels(carMakeId, val);
            setModelSuggestions(results);
            setIsSearchingModel(false);
        }, 300);
    };

    const handleModelFocus = () => {
        if (!carMakeId) return;
        setIsModelDropdownOpen(true);

        const hasModels = contextCarModels.some(m => m.make_id === carMakeId);
        if (!hasModels && !isLoadingModels) {
            setIsLoadingModels(true);
            fetchCarModelsByMake(carMakeId).finally(() => setIsLoadingModels(false));
        }
    };

    const handleNameFocus = () => {
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
                 isVip: client.is_vip
             });
             
             setIsWelcomeCardVisible(true);

             // 2. Check Debts
             const debts = history.filter(r => 
                r.status === RequestStatus.WAITING_PAYMENT || 
                (r.payment_type === PaymentType.Unpaid && r.status !== RequestStatus.COMPLETE)
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
                    setTimeout(() => {
                        if (useChassisNumber) {
                            chassisInputRef.current?.focus();
                        } else {
                            plateCharInputRef.current?.focus();
                        }
                    }, 500);
                }
            }
        } catch (error) {
            console.error("Error checking client history:", error);
        } finally {
            setIsCheckingDebt(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'name' | 'phone' | 'make' | 'model') => {
        let suggestions: any[], isOpen: boolean, setIndex: Function, index: number, selectFn: Function, setOpen: Function;

        switch (type) {
            case 'name': [suggestions, isOpen, setIndex, index, selectFn, setOpen] = [nameSuggestions, isNameSuggestionsOpen, setNameSuggestionIndex, nameSuggestionIndex, handleClientSelection, setIsNameSuggestionsOpen]; break;
            case 'phone': [suggestions, isOpen, setIndex, index, selectFn, setOpen] = [phoneSuggestions, isPhoneSuggestionsOpen, setPhoneSuggestionIndex, phoneSuggestionIndex, handleClientSelection, setIsPhoneSuggestionsOpen]; break;
            case 'make': [suggestions, isOpen, setIndex, index, selectFn, setOpen] = [displayMakes, isMakeDropdownOpen, setMakeSuggestionIndex, makeSuggestionIndex, handleMakeSelection, setIsMakeDropdownOpen]; break;
            case 'model': [suggestions, isOpen, setIndex, index, selectFn, setOpen] = [displayModels, isModelDropdownOpen, setModelSuggestionIndex, modelSuggestionIndex, handleModelSelection, setIsModelDropdownOpen]; break;
            default: return;
        }

        if (!isOpen || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setIndex((prev: number) => (prev + 1) % suggestions.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setIndex((prev: number) => (prev - 1 + suggestions.length) % suggestions.length);
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
        if (modelInputRef.current) {
            modelInputRef.current.focus();
        }
    };

    const handleModelSelection = (model: CarModel) => {
        setCarModelId(model.id);
        setCarModelSearchTerm(model.name_en);
        setIsModelDropdownOpen(false);
        setErrors(prev => ({ ...prev, carModel: false }));

        if (yearInputRef.current) {
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
                    modelInputRef.current?.focus();
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
                    yearInputRef.current?.focus();
                } catch (e) {
                    addNotification({ title: 'خطأ', message: 'فشل إضافة الموديل.', type: 'error' });
                }
            }
        });
    };

    const validateStep = (step: number) => {
        const newErrors: Record<string, boolean> = {};
        let firstInvalidField: HTMLElement | null = null;

        const checkField = (field: string, ref: React.RefObject<HTMLElement>) => {
            if (newErrors[field] && !firstInvalidField) firstInvalidField = ref.current;
        };

        switch (step) {
            case 1:
                if (!clientName.trim()) newErrors['clientName'] = true;
                if (clientPhone.length < 10) newErrors['clientPhone'] = true;

                checkField('clientName', nameInputRef);
                checkField('clientPhone', phoneInputRef);
                break;
            case 2:
                if (useChassisNumber) {
                    if (chassisNumber.length < 5) newErrors['chassisNumber'] = true;
                } else {
                    if (plateChars.trim().length < 1) newErrors['plateChars'] = true;
                    if (plateNums.trim().length < 1) newErrors['plateNums'] = true;
                }
                if (!foundHistory) {
                    if (!carMakeId) newErrors['carMake'] = true;
                    if (!carModelId) newErrors['carModel'] = true;
                }

                checkField('chassisNumber', chassisInputRef);
                checkField('plateChars', plateCharInputRef);
                checkField('plateNums', plateNumInputRef);
                checkField('carMake', makeInputRef);
                checkField('carModel', modelInputRef);
                break;
            case 3:
                if (!inspectionTypeId) newErrors['inspectionType'] = true;
                if (Number(inspectionPrice) <= 0) newErrors['inspectionPrice'] = true;
                if (!isReceptionist) {
                    if (!paymentType) newErrors['paymentType'] = true;
                    if (paymentType === PaymentType.Split) {
                        const totalSplit = splitCashAmount + splitCardAmount;
                        if (totalSplit !== Number(inspectionPrice)) {
                            addNotification({ title: 'خطأ في الدفع', message: 'المبالغ غير متطابقة.', type: 'error' });
                            return false;
                        }
                    }
                }
                checkField('inspectionType', typeInputRef);
                checkField('inspectionPrice', priceInputRef);
                break;
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            if (firstInvalidField) {
                firstInvalidField.focus();
                firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            if (newErrors['carMake'] || newErrors['carModel']) {
                addNotification({ title: 'بيانات ناقصة', message: 'الرجاء اختيار الشركة والموديل من القائمة أو إضافتهما.', type: 'error' });
            } else {
                addNotification({ title: 'بيانات ناقصة', message: 'الرجاء تعبئة الحقول المطلوبة.', type: 'error' });
            }
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => prev + 1);
            setTimeout(() => {
                if (currentStep === 1) {
                    if (useChassisNumber) chassisInputRef.current?.focus();
                    else plateCharInputRef.current?.focus();
                } else if (currentStep === 2) {
                    typeInputRef.current?.focus();
                }
            }, 300);
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => prev - 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

        if (!authUser) {
            addNotification({ title: 'خطأ', message: 'لا يمكن تحديد موظف حالي.', type: 'error' });
            return;
        }

        try {
            // Find or Create Client
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
            
            // Reservation Handling
            if (initialReservationData) {
                const make = contextCarMakes.find(m => m.id === carMakeId) || makeSuggestions.find(m => m.id === carMakeId);
                const model = contextCarModels.find(m => m.id === carModelId) || modelSuggestions.find(m => m.id === carModelId);

                const plateValue = useChassisNumber ? (chassisNumber || '') : (previewArabicChars + ' ' + plateNums);

                await updateReservation(initialReservationData.id, {
                    client_name: clientName,
                    client_phone: clientPhone,
                    car_details: `${make?.name_ar || carMakeSearchTerm} - ${model?.name_ar || carModelSearchTerm} - ${carYear}`,
                    car_make_id: make?.id,
                    car_model_id: model?.id,
                    plate_text: plateValue,
                    status: 'confirmed',
                    notes: `نوع الفحص: ${inspectionTypes.find(t => t.id === inspectionTypeId)?.name || 'غير محدد'} | السعر: ${inspectionPrice}`
                });

                addNotification({ title: 'تم التثبيت', message: 'تم تأكيد بيانات الحجز وتثبيته بنجاح.', type: 'success' });
                onSuccess({ id: 'reservation-confirmed' } as any); 
                onCancel(); 
                return;
            }

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

            const newStatus = isReceptionist ? RequestStatus.WAITING_PAYMENT : (isEditMode && initialData ? initialData.status : RequestStatus.NEW);
            const finalPaymentType = isReceptionist ? PaymentType.Unpaid : paymentType;

            const requestData = {
                client_id: client.id,
                car_snapshot: carSnapshot,
                inspection_type_id: inspectionTypeId,
                payment_type: finalPaymentType as PaymentType,
                payment_note: (paymentType === PaymentType.Transfer || paymentType === PaymentType.Unpaid) && paymentNote.trim() ? paymentNote.trim() : undefined,
                split_payment_details: paymentType === PaymentType.Split ? { cash: splitCashAmount, card: splitCardAmount } : undefined,
                price: Number(inspectionPrice),
                status: newStatus,
                broker: (!isReceptionist && useBroker && brokerId) ? { id: brokerId, commission: brokerCommission } : null,
                updated_at: new Date().toISOString() // Force update timestamp
            };

            if (isEditMode && initialData) {
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
                        request: requestData as any
                    }
                });

                // Force fetch the specific request to update global state immediately
                await fetchAndUpdateSingleRequest(initialData.id);

                addNotification({ title: 'نجاح', message: 'تم تحديث الطلب بنجاح.', type: 'success' });
                onSuccess(initialData);
                onCancel();
            } else {
                let carId = '';
                if (foundHistory) {
                    carId = foundHistory.car.id;
                } else {
                    const car: Car = {
                        id: uuidv4(),
                        make_id: make.id,
                        model_id: model.id,
                        year: carYear,
                        plate_number: plateNumberArabic,
                        plate_number_en: plateNumberEnglish,
                        vin: vin
                    };
                    await addCar(car);
                    carId = car.id;
                }
                const newReq = {
                    id: uuidv4(),
                    ...requestData,
                    car_id: carId,
                    created_at: new Date().toISOString(),
                    employee_id: authUser.id,
                    inspection_data: {},
                    general_notes: [],
                    category_notes: {},
                    structured_findings: [],
                    activity_log: [],
                    attached_files: [],
                };
                const newAddedRequest = await addRequest(newReq as any);
                if (newAddedRequest) {
                    showNewRequestSuccessModal(newAddedRequest.id, newAddedRequest.request_number);
                    onSuccess(newAddedRequest);
                    onCancel(); 
                }
            }
        } catch (error) {
            console.error(error);
            addNotification({
                title: 'خطأ',
                message: 'حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.',
                type: 'error',
            });
        }
    };

    const handleViewPreviousReport = (reqId: string) => {
        onCancel();
        setSelectedRequestId(reqId);
        setPage('print-report');
    };

    const getStepTitle = (step: number) => {
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
            setTimeout(() => makeInputRef.current?.focus(), 500);
        } else {
            addNotification({
                title: 'فشل المسح',
                message: 'لم يتم التعرف على أحرف أو أرقام في الصورة.',
                type: 'error',
            });
        }
        setIsScannerOpen(false);
    }, [addNotification]);

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

        setTimeout(() => {
            yearInputRef.current?.focus();
        }, 100);
    }, [addNotification, fetchCarModelsByMake]);

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

                <ReservationReviewCard 
                    data={reservationFillData} 
                    onManualFill={handleManualFill} 
                />

                <div className={isMobile && currentStep !== 1 ? 'hidden' : 'block animate-fade-in'}>
                    <StepClient 
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
                    />
                </div>

                <div className={isMobile && currentStep !== 2 ? 'hidden' : 'block animate-fade-in'} ref={carSectionRef}>
                    <StepCar 
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
                        handleFillCarData={handleFillCarData}
                        canViewHistory={can('view_car_history_on_create')}
                        carMakeSearchTerm={carMakeSearchTerm}
                        handleMakeChange={handleMakeChange}
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
                    />
                </div>

                <div className={isMobile && currentStep !== 3 ? 'hidden' : 'block animate-fade-in'}>
                    <StepDetails 
                        inspectionTypeId={inspectionTypeId}
                        setInspectionTypeId={setInspectionTypeId}
                        inspectionTypes={inspectionTypes}
                        inspectionPrice={inspectionPrice}
                        setInspectionPrice={setInspectionPrice}
                        paymentType={paymentType}
                        setPaymentType={setPaymentType}
                        isReceptionist={isReceptionist}
                        paymentNote={paymentNote}
                        setPaymentNote={setPaymentNote}
                        splitCashAmount={splitCashAmount}
                        setSplitCashAmount={setSplitCashAmount}
                        splitCardAmount={splitCardAmount}
                        typeInputRef={typeInputRef}
                        priceInputRef={priceInputRef}
                        getInputClass={getInputClass}
                    />
                </div>

                {!isReceptionist && (
                    <div className={isMobile && currentStep !== 4 ? 'hidden' : 'block animate-fade-in'}>
                        <StepBroker 
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

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-700 md:static md:bg-transparent md:border-t-0 md:p-0 md:mt-6 z-20">
                    <div className="flex justify-between gap-4 max-w-4xl mx-auto md:max-w-none md:justify-end">
                        {isMobile ? (
                            <>
                                <Button type="button" variant="secondary" onClick={currentStep === 1 ? onCancel : handleBack} className="w-1/3">
                                    {currentStep === 1 ? 'إلغاء' : 'السابق'}
                                </Button>

                                {currentStep < TOTAL_STEPS ? (
                                    <Button type="button" onClick={handleNext} className="w-2/3 flex-1 justify-center">
                                        التالي <ChevronRightIcon className="w-4 h-4 ms-2 transform rotate-180" />
                                    </Button>
                                ) : (
                                    <Button type="submit" className="w-2/3 flex-1 justify-center font-bold text-lg">
                                        {initialReservationData ? 'تأكيد البيانات وتثبيت الحجز' : (isReceptionist ? 'حفظ الطلب' : (isEditMode ? 'حفظ التعديلات' : 'إنشاء الطلب'))}
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Button type="button" variant="secondary" onClick={onCancel}>
                                    إلغاء
                                </Button>
                                <Button type="submit" className="font-bold">
                                    {initialReservationData ? 'تأكيد البيانات وتثبيت الحجز' : (isReceptionist ? 'حفظ الطلب' : (isEditMode ? 'حفظ التعديلات' : 'إنشاء الطلب'))}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </form>
            
            {/* Render Floating Card */}
            {existingClientSummary && (
                <ClientWelcomeCard 
                    isVisible={isWelcomeCardVisible}
                    clientName={existingClientSummary.name}
                    visitCount={existingClientSummary.count}
                    lastVisit={existingClientSummary.lastVisit}
                    isVip={existingClientSummary.isVip}
                    onClose={() => setIsWelcomeCardVisible(false)}
                />
            )}

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
