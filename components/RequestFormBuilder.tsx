
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { Client, Car, CarMake, CarModel, InspectionRequest, PaymentType, RequestStatus, CarSnapshot, InspectionType } from '../types';
import Button from './Button';
import { uuidv4 } from '../lib/utils';
import LicensePlatePreview from './LicensePlatePreview';
import PlusIcon from './icons/PlusIcon';
import Modal from './Modal';
import CameraScannerModal from './CameraScannerModal';
import Icon from './Icon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import HistoryIcon from './icons/HistoryIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import SparklesIcon from './icons/SparklesIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';

interface RequestFormBuilderProps {
    mode: 'create' | 'edit';
    initialData?: InspectionRequest;
    onCancel: () => void;
    onSuccess: (request?: InspectionRequest) => void;
}

const RequestFormBuilder: React.FC<RequestFormBuilderProps> = ({ 
    mode, 
    initialData, 
    onCancel, 
    onSuccess 
}) => {
    const {
        settings, authUser, addClient, addCar, addRequest, addNotification,
        findOrCreateCarMake, findOrCreateCarModel, addBroker, showNewRequestSuccessModal, hideNewRequestSuccessModal,
        searchClients, searchCarMakes, searchCarModels, checkCarHistory,
        updateRequestAndAssociatedData, fetchCarModelsByMake, fetchClientRequests,
        clients, cars, inspectionTypes, brokers, carMakes, carModels
    } = useAppContext();

    // --- Configuration ---
    const isReceptionist = authUser?.role === 'receptionist';
    const isEditMode = mode === 'edit';
    const TOTAL_STEPS = isReceptionist ? 3 : 4; 

    // --- State Management ---
    const [currentStep, setCurrentStep] = useState(1);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [errors, setErrors] = useState<Record<string, boolean>>({});

    // Form Fields
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [carMakeId, setCarMakeId] = useState('');
    const [carModelId, setCarModelId] = useState('');
    const [carYear, setCarYear] = useState(new Date().getFullYear());
    const [plateChars, setPlateChars] = useState('');
    const [plateNums, setPlateNums] = useState('');
    const [inspectionTypeId, setInspectionTypeId] = useState('');
    const [inspectionPrice, setInspectionPrice] = useState<number | ''>('');
    const [paymentType, setPaymentType] = useState<PaymentType | ''>(isReceptionist ? PaymentType.Unpaid : '');
    const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
    const [splitCardAmount, setSplitCardAmount] = useState<number>(0);
    const [paymentNote, setPaymentNote] = useState('');
    const [useBroker, setUseBroker] = useState(false);
    const [brokerId, setBrokerId] = useState('');
    const [brokerCommission, setBrokerCommission] = useState(0);
    const [useChassisNumber, setUseChassisNumber] = useState(false);
    const [chassisNumber, setChassisNumber] = useState('');
    
    // Search & Dropdown States
    const [carMakeSearchTerm, setCarMakeSearchTerm] = useState('');
    const [isMakeDropdownOpen, setIsMakeDropdownOpen] = useState(false);
    const [carModelSearchTerm, setCarModelSearchTerm] = useState('');
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [phoneSuggestions, setPhoneSuggestions] = useState<Client[]>([]);
    const [nameSuggestions, setNameSuggestions] = useState<Client[]>([]);
    const [isPhoneSuggestionsOpen, setIsPhoneSuggestionsOpen] = useState(false);
    const [isNameSuggestionsOpen, setIsNameSuggestionsOpen] = useState(false);
    
    // Suggestion Index for Keyboard Nav
    const [phoneSuggestionIndex, setPhoneSuggestionIndex] = useState(-1);
    const [nameSuggestionIndex, setNameSuggestionIndex] = useState(-1);
    const [makeSuggestionIndex, setMakeSuggestionIndex] = useState(-1);
    const [modelSuggestionIndex, setModelSuggestionIndex] = useState(-1);

    // UI Refs for Auto-Scroll and Focus
    const clientSectionRef = useRef<HTMLFieldSetElement>(null);
    const carSectionRef = useRef<HTMLFieldSetElement>(null);
    const detailsSectionRef = useRef<HTMLFieldSetElement>(null);
    
    const makeDropdownRef = useRef<HTMLDivElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

    // Inputs Refs (For Focus Management)
    const nameInputRef = useRef<HTMLInputElement>(null);
    const phoneInputRef = useRef<HTMLInputElement>(null);
    const plateCharInputRef = useRef<HTMLInputElement>(null);
    const plateNumInputRef = useRef<HTMLInputElement>(null);
    const chassisInputRef = useRef<HTMLInputElement>(null);
    const makeInputRef = useRef<HTMLInputElement>(null);
    const modelInputRef = useRef<HTMLInputElement>(null);
    const yearInputRef = useRef<HTMLInputElement>(null);
    const typeInputRef = useRef<HTMLSelectElement>(null);
    const priceInputRef = useRef<HTMLInputElement>(null);
    const paymentTypeRef = useRef<HTMLSelectElement>(null);

    const formRef = useRef<HTMLFormElement>(null);
    const debounceRef = useRef<number | null>(null);
    const debtCheckDebounceRef = useRef<number | null>(null);

    // Smart Features State
    const [isCheckingHistory, setIsCheckingHistory] = useState(false);
    const [foundHistory, setFoundHistory] = useState<{ car: Car; previousRequests: InspectionRequest[]; lastClient?: Client } | null>(null);
    const historyDebounceRef = useRef<number | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isCarScannerOpen, setIsCarScannerOpen] = useState(false);
    const [isAddBrokerModalOpen, setIsAddBrokerModalOpen] = useState(false);
    const [newBrokerData, setNewBrokerData] = useState({ name: '', default_commission: 0 });

    // Unpaid Debt Alert State
    const [unpaidDebtAlert, setUnpaidDebtAlert] = useState<InspectionRequest[] | null>(null);
    const [isCheckingDebt, setIsCheckingDebt] = useState(false);

    // Helper to get input classes dynamically based on error state
    const getInputClass = (fieldName: string) => {
        const base = "mt-1 block w-full p-3 border rounded-lg shadow-sm focus:ring-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";
        if (errors[fieldName]) {
            return `${base} border-red-500 focus:ring-red-500 focus:border-red-500 animate-pulse`;
        }
        return `${base} border-slate-300 dark:border-slate-600 focus:ring-blue-500`;
    };

    const formInputClasses = "mt-1 block w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 transition-colors duration-200";

    // --- Responsive Listener ---
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Validation Logic ---
    const validateForm = () => {
        const newErrors: Record<string, boolean> = {};
        let firstInvalidField: HTMLElement | null = null;
        let invalidStep = 0;

        // Step 1: Client
        if (!clientName.trim()) {
            newErrors['clientName'] = true;
            if (!firstInvalidField) { firstInvalidField = nameInputRef.current; invalidStep = 1; }
        }
        if (clientPhone.length < 10) {
            newErrors['clientPhone'] = true;
            if (!firstInvalidField) { firstInvalidField = phoneInputRef.current; invalidStep = 1; }
        }

        // Step 2: Car
        if (useChassisNumber) {
            if (!chassisNumber.trim()) {
                newErrors['chassisNumber'] = true;
                if (!firstInvalidField) { firstInvalidField = chassisInputRef.current; invalidStep = 2; }
            }
        } else {
            if (!plateChars.trim()) {
                newErrors['plateChars'] = true;
                if (!firstInvalidField) { firstInvalidField = plateCharInputRef.current; invalidStep = 2; }
            }
            if (!plateNums.trim()) {
                newErrors['plateNums'] = true;
                if (!firstInvalidField) { firstInvalidField = plateNumInputRef.current; invalidStep = 2; }
            }
        }

        if (!carMakeSearchTerm.trim()) {
            newErrors['carMake'] = true;
            if (!firstInvalidField) { firstInvalidField = makeInputRef.current; invalidStep = 2; }
        }
        if (!carModelSearchTerm.trim()) {
            newErrors['carModel'] = true;
            if (!firstInvalidField) { firstInvalidField = modelInputRef.current; invalidStep = 2; }
        }
        if (!carYear) {
             newErrors['carYear'] = true;
             if (!firstInvalidField) { firstInvalidField = yearInputRef.current; invalidStep = 2; }
        }

        // Step 3: Details
        if (!inspectionTypeId) {
            newErrors['inspectionType'] = true;
            if (!firstInvalidField) { firstInvalidField = typeInputRef.current; invalidStep = 3; }
        }
        if (!inspectionPrice) {
            newErrors['inspectionPrice'] = true;
            if (!firstInvalidField) { firstInvalidField = priceInputRef.current; invalidStep = 3; }
        }
        if (!isReceptionist && !paymentType) {
            newErrors['paymentType'] = true;
            if (!firstInvalidField) { firstInvalidField = paymentTypeRef.current; invalidStep = 3; }
        }

        setErrors(newErrors);

        if (firstInvalidField) {
            // If mobile and error is in another step, switch step
            if (isMobile && invalidStep !== currentStep) {
                setCurrentStep(invalidStep);
                // Wait for render then focus
                setTimeout(() => firstInvalidField?.focus(), 100);
            } else {
                firstInvalidField.focus();
                // Optional: Scroll into view smoothly
                firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }

        return true;
    };


    // --- Unpaid Debt Check (Async) ---
    useEffect(() => {
        if (!clientPhone || clientPhone.length < 9) {
            setUnpaidDebtAlert(null);
            setIsCheckingDebt(false);
            return;
        }
        if (debtCheckDebounceRef.current) clearTimeout(debtCheckDebounceRef.current);
        setIsCheckingDebt(true);
        debtCheckDebounceRef.current = window.setTimeout(async () => {
            try {
                const foundClients = await searchClients(clientPhone);
                const exactClient = foundClients.find(c => c.phone.includes(clientPhone));
                if (exactClient) {
                    const history = await fetchClientRequests(exactClient.id);
                    const debts = history.filter(r => 
                        r.status === RequestStatus.WAITING_PAYMENT || 
                        (r.payment_type === PaymentType.Unpaid && r.status !== RequestStatus.COMPLETE)
                    );
                    if (debts.length > 0) {
                        setUnpaidDebtAlert(debts);
                        if (!clientName) setClientName(exactClient.name);
                    } else {
                        setUnpaidDebtAlert(null);
                    }
                } else {
                    setUnpaidDebtAlert(null);
                }
            } catch (err) {
                console.error("Error checking debts:", err);
            } finally {
                setIsCheckingDebt(false);
            }
        }, 600);
    }, [clientPhone, searchClients, fetchClientRequests, clientName]);

    // --- Initialization (Edit Mode) ---
    useEffect(() => {
        if (isEditMode && initialData) {
            const req = initialData;
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
            
            if (req.car_snapshot) {
                setCarMakeSearchTerm(req.car_snapshot.make_en);
                setCarModelSearchTerm(req.car_snapshot.model_en);
                setCarYear(req.car_snapshot.year);
            } 
            
            const existingCar = cars.find(c => c.id === req.car_id);
            if (existingCar) {
                setCarMakeId(existingCar.make_id);
                setCarModelId(existingCar.model_id);
                if (!req.car_snapshot) setCarYear(existingCar.year);

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

            if (req.broker) {
                setUseBroker(true);
                setBrokerId(req.broker.id);
                setBrokerCommission(req.broker.commission);
            }
        }
    }, [isEditMode, initialData, clients, cars]);

    // --- Outside Click Handlers ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (makeDropdownRef.current && !makeDropdownRef.current.contains(event.target as Node)) setIsMakeDropdownOpen(false);
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) setIsModelDropdownOpen(false);
            // Check refs for parent divs of inputs
            if (phoneInputRef.current && !phoneInputRef.current.parentElement?.contains(event.target as Node)) setIsPhoneSuggestionsOpen(false);
            if (nameInputRef.current && !nameInputRef.current.parentElement?.contains(event.target as Node)) setIsNameSuggestionsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Plate Logic ---
    const { arToEnMap, enToArMap } = useMemo(() => {
        const arToEn = new Map<string, string>();
        const enToAr = new Map<string, string>();
        settings.plateCharacters.forEach(pc => {
            const arChar = pc.ar.replace('ـ', '');
            arToEn.set(arChar, pc.en);
            enToAr.set(pc.en.toUpperCase(), pc.ar);
        });
        return { arToEnMap: arToEn, enToArMap: enToAr };
    }, [settings.plateCharacters]);

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

    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const convertToArabicNumerals = (numStr: string): string => numStr.replace(/\s/g, '').split('').map(digit => arabicNumerals[parseInt(digit, 10)] || digit).join('');
    
    const englishTop = previewEnglishChars; 
    const arabicBottom = previewArabicChars; 
    const englishBottom = useMemo(() => plateNums.replace(/\s/g, '').replace(/\D/g, '').slice(0, 4).split('').join(' '), [plateNums]); 
    const arabicTop = useMemo(() => convertToArabicNumerals(englishBottom), [englishBottom]); 

    // --- History Check Logic (Smart Alert) ---
    useEffect(() => {
        if (isEditMode || isReceptionist) return;

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
        }, 800); 

    }, [plateChars, plateNums, useChassisNumber, chassisNumber, checkCarHistory, isEditMode, isReceptionist]);

    // --- Smart Action: Fill Data from History ---
    const handleUseHistoryData = () => {
        if (!foundHistory) return;
        const { car, lastClient } = foundHistory;

        const make = carMakes.find(m => m.id === car.make_id);
        const model = carModels.find(m => m.id === car.model_id);
        
        setCarMakeId(car.make_id);
        setCarMakeSearchTerm(make?.name_en || '');
        
        fetchCarModelsByMake(car.make_id).then(() => {
            setCarModelId(car.model_id);
            setCarModelSearchTerm(model?.name_en || '');
        });

        setCarYear(car.year);

        if (lastClient) {
            setClientName(lastClient.name);
            setClientPhone(lastClient.phone);
        }

        addNotification({ title: 'تم التعبئة', message: 'تم نسخ بيانات السيارة والعميل السابق.', type: 'success' });
        
        // Auto Scroll to Details
        if(detailsSectionRef.current && !isMobile) {
            detailsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // --- Global KeyDown Handler for Form ---
    const handleFormKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const target = e.target as HTMLElement;
            // Allow Enter in Textareas
            if (target.tagName.toLowerCase() === 'textarea') return;

            // Prevent default form submission to handle manually
            e.preventDefault();

            // Check if any dropdown suggestion is open
            if (isPhoneSuggestionsOpen || isNameSuggestionsOpen || isMakeDropdownOpen || isModelDropdownOpen) {
                // Let the specific input keydown handler (handleKeyDown) deal with selection
                return;
            }

            // If no dropdown open, validate and submit
            if (validateForm()) {
                handleSubmit();
            }
            // If validation failed, validateForm() already focused the error field
        }
    };

    // --- Field Handlers & Keyboard Navigation ---
    const handleKeyDown = (
        e: React.KeyboardEvent, 
        type: 'phone' | 'name' | 'make' | 'model', 
        suggestions: any[], 
        isOpen: boolean, 
        setIndex: React.Dispatch<React.SetStateAction<number>>, 
        currentIndex: number,
        selectFn: (item: any) => void,
        nextRef?: React.RefObject<HTMLElement>
    ) => {
        if (!isOpen || suggestions.length === 0) {
            // Handled by global form keydown
            return; 
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter') {
            e.preventDefault(); // Stop bubbling to global submit
            e.stopPropagation(); 
            if (currentIndex >= 0) selectFn(suggestions[currentIndex]);
            else selectFn(suggestions[0]); // Default to first if none highlighted
        } else if (e.key === 'Tab') {
            e.preventDefault(); 
            const itemToSelect = currentIndex >= 0 ? suggestions[currentIndex] : suggestions[0];
            selectFn(itemToSelect);
            if (nextRef && nextRef.current) {
                setTimeout(() => nextRef.current?.focus(), 10);
            }
        }
    };

    const handleClientSelection = (client: Client) => {
        setClientName(client.name);
        setClientPhone(client.phone);
        setIsPhoneSuggestionsOpen(false);
        setIsNameSuggestionsOpen(false);
        setErrors(prev => ({ ...prev, clientName: false, clientPhone: false })); // Clear errors
        
        // Auto Scroll on Desktop
        if (!isMobile && carSectionRef.current) {
            carSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            plateCharInputRef.current?.focus(); 
        }
    };

    const handleMakeSelection = (make: CarMake) => {
        setCarMakeId(make.id);
        setCarMakeSearchTerm(make.name_en);
        setIsMakeDropdownOpen(false);
        setErrors(prev => ({ ...prev, carMake: false }));
        fetchCarModelsByMake(make.id);
        modelInputRef.current?.focus(); 
    };

    const handleModelSelection = (model: CarModel) => {
        setCarModelId(model.id);
        setCarModelSearchTerm(model.name_en);
        setIsModelDropdownOpen(false);
        setErrors(prev => ({ ...prev, carModel: false }));
        
        // Auto Scroll to Details
        if (!isMobile && detailsSectionRef.current) {
            detailsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
        setClientPhone(digits);
        setErrors(prev => ({ ...prev, clientPhone: false }));
        setPhoneSuggestionIndex(-1); 
        if (digits.length >= 4) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = window.setTimeout(async () => {
                 const results = await searchClients(digits);
                 setPhoneSuggestions(results);
                 setIsPhoneSuggestionsOpen(results.length > 0);
            }, 300);
        } else {
            setIsPhoneSuggestionsOpen(false);
        }
    };
    
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setClientName(val);
        setErrors(prev => ({ ...prev, clientName: false }));
        setNameSuggestionIndex(-1);
        if (val.length >= 3) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = window.setTimeout(async () => {
                 const results = await searchClients(val);
                 setNameSuggestions(results);
                 setIsNameSuggestionsOpen(results.length > 0);
            }, 300);
        } else {
            setIsNameSuggestionsOpen(false);
        }
    };

    const handleMakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCarMakeSearchTerm(val);
        setCarMakeId(''); setCarModelId(''); setCarModelSearchTerm('');
        setErrors(prev => ({ ...prev, carMake: false }));
        setMakeSuggestionIndex(-1);
        if (val.trim()) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = window.setTimeout(async () => {
                 const results = await searchCarMakes(val);
                 setIsMakeDropdownOpen(true);
            }, 300);
        } else {
            setIsMakeDropdownOpen(false);
        }
    };
    
    const filteredMakes = useMemo(() => {
        const term = carMakeSearchTerm.toLowerCase();
        return carMakes.filter(m => m.name_en.toLowerCase().includes(term) || m.name_ar.toLowerCase().includes(term));
    }, [carMakes, carMakeSearchTerm]);
    
    const filteredModels = useMemo(() => {
        if(!carMakeId) return [];
        const term = carModelSearchTerm.toLowerCase();
        const models = carModels.filter(m => m.make_id === carMakeId);
        return models.filter(m => m.name_en.toLowerCase().includes(term) || m.name_ar.toLowerCase().includes(term));
    }, [carModels, carMakeId, carModelSearchTerm]);


    // --- Submission ---
    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        // Final Validation (Reuse validateForm)
        if (!validateForm()) return;

        // Optimistic Close (for create mode)
        if (!isEditMode) {
            onSuccess(); 
            showNewRequestSuccessModal(null, null); 
        }

        try {
            // 1. Client Logic
            let clientId = '';
            const existingClient = clients.find(c => c.phone === clientPhone);
            if (existingClient) {
                clientId = existingClient.id;
            } else {
                const newC = await addClient({ id: uuidv4(), name: clientName, phone: clientPhone });
                clientId = newC.id;
            }

            // 2. Car Logic
            let carId = '';
            let carSnapshot: CarSnapshot;
            
            if (foundHistory) {
                carId = foundHistory.car.id;
                carSnapshot = {
                    make_ar: carMakeSearchTerm, make_en: carMakeSearchTerm, 
                    model_ar: carModelSearchTerm, model_en: carModelSearchTerm,
                    year: carYear
                };
            } else {
                const make = await findOrCreateCarMake(carMakeSearchTerm);
                const model = await findOrCreateCarModel(carModelSearchTerm, make.id);
                
                const plateAr = useChassisNumber ? null : `${previewArabicChars.replace(/\s/g, '')} ${plateNums.replace(/\s/g, '')}`;
                const plateEn = useChassisNumber ? null : `${previewEnglishChars.replace(/\s/g, '')} ${plateNums.replace(/\s/g, '')}`;

                const newCar = await addCar({
                    id: uuidv4(),
                    make_id: make.id,
                    model_id: model.id,
                    year: carYear,
                    plate_number: plateAr,
                    plate_number_en: plateEn,
                    vin: useChassisNumber ? chassisNumber : null
                });
                carId = newCar.id;
                carSnapshot = { make_ar: make.name_ar, make_en: make.name_en, model_ar: model.name_ar, model_en: model.name_en, year: carYear };
            }

            // 3. Request Data Construction
            const reqData = {
                client_id: clientId,
                car_id: carId,
                car_snapshot: carSnapshot,
                inspection_type_id: inspectionTypeId,
                price: Number(inspectionPrice),
                payment_type: isReceptionist ? PaymentType.Unpaid : (paymentType as PaymentType),
                status: isReceptionist ? RequestStatus.WAITING_PAYMENT : RequestStatus.NEW,
                payment_note: (paymentType === PaymentType.Transfer || paymentType === PaymentType.Unpaid) ? paymentNote : undefined,
                split_payment_details: paymentType === PaymentType.Split ? { cash: splitCashAmount, card: splitCardAmount } : undefined,
                broker: (useBroker && brokerId) ? { id: brokerId, commission: brokerCommission } : undefined,
                employee_id: authUser?.id || '',
                created_at: isEditMode && initialData ? initialData.created_at : new Date().toISOString(),
                // Empty arrays for new request
                inspection_data: isEditMode && initialData ? initialData.inspection_data : {},
                general_notes: isEditMode && initialData ? initialData.general_notes : [],
                category_notes: isEditMode && initialData ? initialData.category_notes : {},
                structured_findings: isEditMode && initialData ? initialData.structured_findings : [],
                activity_log: isEditMode && initialData ? initialData.activity_log : [],
                attached_files: isEditMode && initialData ? initialData.attached_files : [],
            };

            if (isEditMode && initialData) {
                // UPDATE
                await updateRequestAndAssociatedData({
                    originalRequest: initialData,
                    formData: {
                        client_id: clientId,
                        car: { /* Update car details if changed logic needed here */ }, 
                        request: reqData
                    }
                });
                addNotification({ title: 'نجاح', message: 'تم تحديث الطلب.', type: 'success' });
                onSuccess(); // Close modal
            } else {
                // CREATE
                const newReq = await addRequest({ id: uuidv4(), ...reqData } as any);
                showNewRequestSuccessModal(newReq.id, newReq.request_number);
            }

        } catch (error) {
            console.error(error);
            if (!isEditMode) hideNewRequestSuccessModal();
            addNotification({ title: 'خطأ', message: 'فشل حفظ الطلب.', type: 'error' });
        }
    };

    // --- Define Steps Configuration ---
    const stepsList = useMemo(() => {
        const base = [
            { num: 1, title: 'العميل', icon: 'employee' },
            { num: 2, title: 'السيارة', icon: 'cars' },
            { num: 3, title: 'الفحص', icon: 'document-report' },
        ];
        if (!isReceptionist) {
            base.push({ num: 4, title: 'الإنهاء', icon: 'save' });
        }
        return base;
    }, [isReceptionist]);

    // --- Render Helpers ---
    const showStep = (step: number) => {
        if (!isMobile) return true;
        return currentStep === step;
    };

    const renderStepContent = (step: number) => {
        return (
            <div className={!isMobile ? "grid grid-cols-1 gap-6" : ""}>
                {/* STEP 1: CLIENT */}
                <div className={showStep(1) ? 'block animate-fade-in' : 'hidden'}>
                    <fieldset ref={clientSectionRef} className="bg-white dark:bg-slate-800/50 p-6 rounded-lg shadow-sm border dark:border-slate-700 h-full scroll-mt-20">
                        <legend className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                             <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                             بيانات العميل
                        </legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-sm font-medium mb-1">اسم العميل</label>
                                <input 
                                    ref={nameInputRef}
                                    type="text" 
                                    value={clientName} 
                                    onChange={handleNameChange} 
                                    onKeyDown={(e) => handleKeyDown(e, 'name', nameSuggestions, isNameSuggestionsOpen, setNameSuggestionIndex, nameSuggestionIndex, handleClientSelection, phoneInputRef)}
                                    onFocus={() => nameSuggestions.length > 0 && setIsNameSuggestionsOpen(true)} 
                                    className={getInputClass('clientName')}
                                    placeholder="الاسم الثلاثي" 
                                    autoComplete="off"
                                />
                                {isNameSuggestionsOpen && (
                                    <ul className="absolute z-10 w-full bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                                        {nameSuggestions.map((c, idx) => (
                                            <li key={c.id} onClick={() => handleClientSelection(c)} className={`px-4 py-2 cursor-pointer text-sm ${idx === nameSuggestionIndex ? 'bg-blue-100 dark:bg-slate-600' : 'hover:bg-blue-50 dark:hover:bg-slate-700'}`}>
                                                {c.name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="relative">
                                <label className="block text-sm font-medium mb-1">رقم الجوال</label>
                                <div className="relative">
                                    <input 
                                        ref={phoneInputRef}
                                        type="tel" 
                                        value={clientPhone} 
                                        onChange={handlePhoneChange} 
                                        onKeyDown={(e) => handleKeyDown(e, 'phone', phoneSuggestions, isPhoneSuggestionsOpen, setPhoneSuggestionIndex, phoneSuggestionIndex, handleClientSelection, plateCharInputRef)}
                                        onFocus={() => phoneSuggestions.length > 0 && setIsPhoneSuggestionsOpen(true)} 
                                        className={getInputClass('clientPhone')} 
                                        placeholder="05xxxxxxxx" 
                                        style={{direction: 'ltr', textAlign: 'right'}} 
                                        autoComplete="off"
                                    />
                                    {isCheckingDebt && (
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2">
                                            <RefreshCwIcon className="w-4 h-4 animate-spin text-blue-500" />
                                        </div>
                                    )}
                                </div>
                                {isPhoneSuggestionsOpen && (
                                    <ul className="absolute z-10 w-full bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                                        {phoneSuggestions.map((c, idx) => (
                                            <li key={c.id} onClick={() => handleClientSelection(c)} className={`px-4 py-2 cursor-pointer text-sm flex justify-between ${idx === phoneSuggestionIndex ? 'bg-blue-100 dark:bg-slate-600' : 'hover:bg-blue-50 dark:hover:bg-slate-700'}`}>
                                                <span>{c.phone}</span> <span className="text-slate-400">{c.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* Unpaid Debt Alert */}
                        {unpaidDebtAlert && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fade-in">
                                <div className="flex items-start gap-2">
                                    <AlertTriangleIcon className="w-5 h-5 text-red-600 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-red-700 dark:text-red-400 text-sm">تنبيه: مديونية سابقة</h4>
                                        <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                                            هذا العميل لديه {unpaidDebtAlert.length} طلبات سابقة غير مدفوعة.
                                        </p>
                                        <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300 mt-1">
                                            {unpaidDebtAlert.map(r => (
                                                <li key={r.id}>طلب #{r.request_number} ({r.price} ريال) - {r.status}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </fieldset>
                </div>

                {/* STEP 2: CAR */}
                <div className={showStep(2) ? 'block animate-fade-in' : 'hidden'}>
                    <fieldset ref={carSectionRef} className="bg-white dark:bg-slate-800/50 p-6 rounded-lg shadow-sm border dark:border-slate-700 h-full scroll-mt-20">
                         <legend className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                             <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                             بيانات السيارة
                        </legend>
                        
                        {/* Plate / VIN Input */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium">{useChassisNumber ? 'رقم الشاصي (VIN)' : 'رقم اللوحة'}</label>
                                <div className="flex items-center">
                                    <input type="checkbox" id="use-chassis" checked={useChassisNumber} onChange={() => setUseChassisNumber(!useChassisNumber)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                                    <label htmlFor="use-chassis" className="ms-2 text-xs text-slate-500">استخدام رقم الشاصي</label>
                                </div>
                            </div>
                            
                            {!useChassisNumber ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 relative">
                                        <input 
                                            ref={plateCharInputRef}
                                            type="text" placeholder="حروف" value={plateChars} 
                                            onChange={e => {
                                                const val = e.target.value.replace(/\s/g, ''); 
                                                setPlateChars(val.slice(0,4).split('').join(' '));
                                                setErrors(p => ({...p, plateChars: false}));
                                            }}
                                            className={`${getInputClass('plateChars')} text-center font-bold text-lg`}
                                            style={{direction: 'ltr'}}
                                        />
                                        <input 
                                            ref={plateNumInputRef}
                                            type="text" placeholder="أرقام" value={plateNums}
                                            onChange={e => {
                                                setPlateNums(e.target.value.replace(/\D/g, '').slice(0,4).split('').join(' '));
                                                setErrors(p => ({...p, plateNums: false}));
                                            }}
                                            onBlur={() => !foundHistory && makeInputRef.current?.focus()}
                                            className={`${getInputClass('plateNums')} text-center font-bold text-lg`}
                                            style={{direction: 'ltr'}}
                                        />
                                        <Button type="button" variant="secondary" onClick={() => setIsScannerOpen(true)} className="px-3" title="مسح اللوحة">
                                            <Icon name="scan-plate" className="w-5 h-5"/>
                                        </Button>

                                        {isCheckingHistory && (
                                            <div className="absolute left-[-30px] top-1/2 -translate-y-1/2">
                                                <RefreshCwIcon className="w-5 h-5 animate-spin text-blue-500" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg shadow-inner flex justify-center">
                                        <LicensePlatePreview 
                                            arabicTop={arabicTop}
                                            arabicBottom={arabicBottom}
                                            englishTop={englishTop}
                                            englishBottom={englishBottom}
                                            settings={settings.platePreviewSettings}
                                            plateCharacters={settings.plateCharacters}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input ref={chassisInputRef} type="text" value={chassisNumber} onChange={e => { setChassisNumber(e.target.value.toUpperCase()); setErrors(p => ({...p, chassisNumber: false})); }} className={getInputClass('chassisNumber')} placeholder="WBA..." style={{direction:'ltr'}} />
                                     {isCheckingHistory && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            <RefreshCwIcon className="w-5 h-5 animate-spin text-blue-500" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* --- SMART HISTORY ALERT --- */}
                        {foundHistory && (
                            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 animate-slide-in-down">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-amber-100 dark:bg-amber-800 p-2 rounded-full text-amber-600 dark:text-amber-400 mt-1">
                                            <HistoryIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-amber-800 dark:text-amber-200">هذه السيارة زارتنا من قبل</h4>
                                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                                عدد الزيارات السابقة: <strong>{foundHistory.previousRequests.length}</strong>
                                            </p>
                                            {foundHistory.lastClient && (
                                                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                                    <UserCircleIcon className="w-3 h-3" />
                                                    آخر عميل: {foundHistory.lastClient.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleUseHistoryData}
                                        className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700 px-3 py-2 rounded-md transition-colors font-bold shadow-sm"
                                    >
                                        استخدام البيانات
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Make & Model */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                             <div className="relative" ref={makeDropdownRef}>
                                <label className="flex justify-between text-sm font-medium mb-1">
                                    الشركة
                                    <button type="button" onClick={() => setIsCarScannerOpen(true)} className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                                        <SparklesIcon className="w-3 h-3"/> تعرف تلقائي
                                    </button>
                                </label>
                                <input 
                                    ref={makeInputRef}
                                    type="text" 
                                    value={carMakeSearchTerm} 
                                    onChange={handleMakeChange} 
                                    onFocus={() => setIsMakeDropdownOpen(true)} 
                                    onKeyDown={(e) => handleKeyDown(e, 'make', filteredMakes, isMakeDropdownOpen, setMakeSuggestionIndex, makeSuggestionIndex, handleMakeSelection, modelInputRef)}
                                    className={getInputClass('carMake')} 
                                    placeholder="بحث..." 
                                    autoComplete="off"
                                />
                                {isMakeDropdownOpen && (
                                    <ul className="absolute z-10 w-full bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                                        {filteredMakes.map((m, idx) => (
                                            <li key={m.id} onClick={() => handleMakeSelection(m)} className={`px-4 py-2 cursor-pointer text-sm ${idx === makeSuggestionIndex ? 'bg-blue-100 dark:bg-slate-600' : 'hover:bg-blue-50 dark:hover:bg-slate-700'}`}>
                                                {m.name_en} - {m.name_ar}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                             </div>
                             <div className="relative" ref={modelDropdownRef}>
                                <label className="block text-sm font-medium mb-1">الموديل</label>
                                <input 
                                    ref={modelInputRef}
                                    type="text" 
                                    value={carModelSearchTerm} 
                                    onChange={e => { setCarModelSearchTerm(e.target.value); setIsModelDropdownOpen(true); setErrors(p => ({...p, carModel: false})); }}
                                    onFocus={() => setIsModelDropdownOpen(true)}
                                    onKeyDown={(e) => handleKeyDown(e, 'model', filteredModels, isModelDropdownOpen, setModelSuggestionIndex, modelSuggestionIndex, handleModelSelection, null)}
                                    className={getInputClass('carModel')}
                                    placeholder="بحث..."
                                    disabled={!carMakeId}
                                    autoComplete="off"
                                />
                                {isModelDropdownOpen && carMakeId && (
                                     <ul className="absolute z-10 w-full bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                                        {filteredModels.map((m, idx) => (
                                            <li key={m.id} onClick={() => handleModelSelection(m)} className={`px-4 py-2 cursor-pointer text-sm ${idx === modelSuggestionIndex ? 'bg-blue-100 dark:bg-slate-600' : 'hover:bg-blue-50 dark:hover:bg-slate-700'}`}>
                                                {m.name_en} - {m.name_ar}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                             </div>
                             <div>
                                 <label className="block text-sm font-medium mb-1">سنة الصنع</label>
                                 <input ref={yearInputRef} type="number" value={carYear} onChange={e => { setCarYear(Number(e.target.value)); setErrors(p => ({...p, carYear: false})); }} className={getInputClass('carYear')} />
                             </div>
                        </div>

                    </fieldset>
                </div>

                {/* STEP 3: DETAILS */}
                <div className={showStep(3) ? 'block animate-fade-in' : 'hidden'}>
                     <fieldset ref={detailsSectionRef} className="bg-white dark:bg-slate-800/50 p-6 rounded-lg shadow-sm border dark:border-slate-700 h-full scroll-mt-20">
                         <legend className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                             <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                             تفاصيل الطلب
                        </legend>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">نوع الفحص</label>
                                <select ref={typeInputRef} value={inspectionTypeId} onChange={e => { setInspectionTypeId(e.target.value); setErrors(p => ({...p, inspectionType: false})); }} className={getInputClass('inspectionType')}>
                                    <option value="">اختر...</option>
                                    {inspectionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">السعر (ريال)</label>
                                <input ref={priceInputRef} type="number" value={inspectionPrice} onChange={e => { setInspectionPrice(Number(e.target.value)); setErrors(p => ({...p, inspectionPrice: false})); }} className={getInputClass('inspectionPrice')} />
                            </div>
                            {!isReceptionist && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">طريقة الدفع</label>
                                    <select ref={paymentTypeRef} value={paymentType} onChange={e => { setPaymentType(e.target.value as PaymentType); setErrors(p => ({...p, paymentType: false})); }} className={getInputClass('paymentType')}>
                                        <option value="">اختر...</option>
                                        {Object.values(PaymentType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    
                                    {paymentType === PaymentType.Split && (
                                        <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-sm grid grid-cols-2 gap-2">
                                            <input type="number" placeholder="نقدي" value={splitCashAmount} onChange={e => { const v = Number(e.target.value); setSplitCashAmount(v); setSplitCardAmount(Number(inspectionPrice) - v); }} className="p-1 border rounded" />
                                            <input type="number" placeholder="بطاقة" value={splitCardAmount} readOnly className="p-1 border rounded bg-gray-200" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                     </fieldset>
                </div>

                {/* STEP 4: BROKER (Hidden for Receptionist) */}
                <div className={showStep(4) && !isReceptionist ? 'block animate-fade-in' : 'hidden'}>
                     <fieldset className="bg-white dark:bg-slate-800/50 p-6 rounded-lg shadow-sm border dark:border-slate-700 h-full">
                         <legend className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                             <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
                             السمسار وإنهاء
                        </legend>
                        <div className="flex items-center mb-4">
                            <input type="checkbox" checked={useBroker} onChange={e => setUseBroker(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <label className="ms-2 text-sm">تضمين سمسار</label>
                        </div>
                        {useBroker && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">اختر السمسار</label>
                                    <div className="flex gap-2">
                                        <select value={brokerId} onChange={e => { const b = brokers.find(br => br.id === e.target.value); setBrokerId(e.target.value); if(b) setBrokerCommission(b.default_commission); }} className={formInputClasses}>
                                            <option value="">اختر...</option>
                                            {brokers.filter(b => b.is_active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                        <Button type="button" onClick={() => setIsAddBrokerModalOpen(true)} className="px-3"><PlusIcon className="w-5 h-5"/></Button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">العمولة</label>
                                    <input type="number" value={brokerCommission} onChange={e => setBrokerCommission(Number(e.target.value))} className={formInputClasses} />
                                </div>
                            </div>
                        )}
                     </fieldset>
                </div>
            </div>
        );
    };

    // --- Footer Buttons ---
    const renderFooter = () => {
        // Desktop Footer: Single Action Row
        if (!isMobile) {
            return (
                <div className="flex justify-end gap-4 mt-6 pt-4 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
                    <Button onClick={(e) => handleSubmit(e as any)}>{isEditMode ? 'حفظ التعديلات' : (isReceptionist ? 'إنشاء الطلب' : 'حفظ')}</Button>
                </div>
            );
        }

        // Mobile Footer: Modern Navbar
        return (
             <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t dark:border-slate-700 z-20 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                  <div className="flex justify-between items-center gap-4">
                      {currentStep > 1 && (
                          <button 
                            type="button" 
                            onClick={() => setCurrentStep(p => p - 1)} 
                            className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm"
                          >
                              <ChevronRightIcon className="w-5 h-5" />
                          </button>
                      )}
                      
                      {currentStep < TOTAL_STEPS ? (
                          <Button type="button" onClick={() => { if(validateForm()) setCurrentStep(p => p + 1); }} className="flex-1 justify-center py-3 text-lg shadow-lg shadow-blue-500/20">
                              التالي <ChevronRightIcon className="w-5 h-5 ms-2 transform rotate-180" />
                          </Button>
                      ) : (
                          <Button type="button" onClick={(e) => handleSubmit(e as any)} className="flex-1 justify-center py-3 font-bold text-lg shadow-lg shadow-blue-500/20">
                              <CheckCircleIcon className="w-5 h-5 me-2" />
                              {isReceptionist ? 'إتمام الطلب' : 'إنشاء الطلب'}
                          </Button>
                      )}
                      
                      {currentStep === 1 && (
                          <button type="button" onClick={onCancel} className="text-sm font-medium text-slate-500 dark:text-slate-400 p-2">
                              إلغاء
                          </button>
                      )}
                  </div>
              </div>
        );
    };

    return (
        <>
            <form ref={formRef} onKeyDown={handleFormKeyDown} onSubmit={e => e.preventDefault()} className="pb-24 md:pb-0">
                {isMobile && (
                    <div className="mb-6 relative px-2">
                       {/* Stepper Container */}
                       <div className="flex justify-between items-center relative z-10">
                          {stepsList.map((step, index) => {
                              const isCompleted = currentStep > step.num;
                              const isActive = currentStep === step.num;
                              
                              return (
                                  <div key={step.num} className="flex flex-col items-center flex-1 relative">
                                      {/* Connecting Line (Behind) */}
                                      {index !== stepsList.length - 1 && (
                                          <div className={`absolute top-4 left-1/2 w-full h-[2px] -z-10 ${isCompleted ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                      )}
                                      
                                      <div className={`
                                          w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2
                                          ${isActive 
                                              ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-lg shadow-blue-500/30' 
                                              : isCompleted 
                                                  ? 'bg-green-500 border-green-500 text-white' 
                                                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'
                                          }
                                      `}>
                                          {isCompleted ? <CheckCircleIcon className="w-5 h-5" /> : <Icon name={step.icon as any} className="w-4 h-4" />}
                                      </div>
                                      
                                      <span className={`text-[10px] mt-1 font-medium transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                                          {step.title}
                                      </span>
                                  </div>
                              );
                          })}
                       </div>
                    </div>
                )}

                {renderStepContent(currentStep)}
                {renderFooter()}
            </form>

            <CameraScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                onScanComplete={(data) => { setPlateChars(data.letters.split('').join(' ')); setPlateNums(data.numbers.split('').join(' ')); setIsScannerOpen(false); }}
                mode="plate"
            />
            
            <CameraScannerModal
              isOpen={isCarScannerOpen}
              onClose={() => setIsCarScannerOpen(false)} 
              onCarIdentify={(data) => {
                  // Use IDs if available to ensure correct linking
                  setCarMakeId(data.makeId === 'other' ? '' : data.makeId);
                  setCarMakeSearchTerm(data.makeName);
                  
                  if (data.makeId && data.makeId !== 'other') {
                      fetchCarModelsByMake(data.makeId);
                  }

                  setCarModelId(data.modelId);
                  setCarModelSearchTerm(data.modelName);
                  setCarYear(data.year);
                  
                  setIsCarScannerOpen(false);
                  addNotification({ title: 'تم التعرف', message: `تم تحديد ${data.makeName} ${data.modelName}`, type: 'success' });
              }}
              mode="car"
            />
            
            <Modal isOpen={isAddBrokerModalOpen} onClose={() => setIsAddBrokerModalOpen(false)} title="إضافة سمسار" size="sm">
                <div className="space-y-4">
                    <input type="text" placeholder="الاسم" value={newBrokerData.name} onChange={e => setNewBrokerData(p => ({...p, name: e.target.value}))} className={formInputClasses} />
                    <input type="number" placeholder="العمولة" value={newBrokerData.default_commission} onChange={e => setNewBrokerData(p => ({...p, default_commission: Number(e.target.value)}))} className={formInputClasses} />
                    <Button onClick={async () => {
                        const b = await addBroker({ ...newBrokerData, is_active: true });
                        setBrokerId(b.id);
                        setBrokerCommission(b.default_commission);
                        setIsAddBrokerModalOpen(false);
                    }}>حفظ</Button>
                </div>
            </Modal>
        </>
    );
};

export default RequestFormBuilder;
