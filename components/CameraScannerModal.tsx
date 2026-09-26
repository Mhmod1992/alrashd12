import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import Modal from './Modal';
import Button from './Button';
import { useAppContext } from '../context/AppContext';
import Icon from './Icon';
import { cleanJsonString } from '../lib/utils';
import RefreshCwIcon from './icons/RefreshCwIcon';

interface CameraScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanComplete?: (plateData: { letters: string, numbers: string }) => void;
    onCarIdentify?: (carData: { makeId: string; makeName: string; modelId: string; modelName: string; year: number }) => void;
    mode?: 'plate' | 'car';
}

const CameraScannerModal: React.FC<CameraScannerModalProps> = ({ 
    isOpen, 
    onClose, 
    onScanComplete, 
    onCarIdentify,
    mode = 'plate' 
}) => {
    const { addNotification, settings, carMakes, carModels, fetchCarModelsByMake } = useAppContext();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [step, setStep] = useState<'capture' | 'processing' | 'review'>('capture');
    const [error, setError] = useState<string | null>(null);
    const [scanLanguage, setScanLanguage] = useState<'ar' | 'en'>('en');

    // Zoom & Camera Lens Controls
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [hasHardwareZoom, setHasHardwareZoom] = useState<boolean>(false);
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    
    // --- Review State (For Car Mode) ---
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [aiRawData, setAiRawData] = useState<{ make: string, model: string, year: number } | null>(null);
    
    // Form Selection State
    const [selectedMakeId, setSelectedMakeId] = useState('');
    const [selectedMakeName, setSelectedMakeName] = useState(''); // Fallback if not in DB
    const [selectedModelId, setSelectedModelId] = useState('');
    const [selectedModelName, setSelectedModelName] = useState(''); // Fallback
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // كلمات شائعة في تصميم اللوحة السعودية يجب تجاهلها
    const IGNORED_TERMS = [
        'KSA', 'SAUDI', 'ARABIA', 'KINGDOM', 'K.S.A', 
        'السعودية', 'المملكة', 'العربية', 'نقل', 'خصوصي'
    ];

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const resetState = () => {
        setStep('capture');
        setError(null);
        setCapturedImage(null);
        setAiRawData(null);
        setSelectedMakeId('');
        setSelectedMakeName('');
        setSelectedModelId('');
        setSelectedModelName('');
        setZoomLevel(1);
    };

    // Enumerate Available Back Cameras
    useEffect(() => {
        if (!isOpen) return;

        const getCameras = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                setAvailableCameras(videoDevices);
            } catch (e) {
                console.warn("Unable to enumerate media devices:", e);
            }
        };

        getCameras();
    }, [isOpen]);

    // Apply Zoom to Track (Hardware) or Fallback
    const applyZoom = useCallback(async (targetZoom: number) => {
        setZoomLevel(targetZoom);
        if (!streamRef.current) return;

        const track = streamRef.current.getVideoTracks()[0];
        if (!track) return;

        try {
            const capabilities = (track.getCapabilities && track.getCapabilities()) || {};
            // @ts-ignore
            if (capabilities.zoom) {
                // @ts-ignore
                const min = capabilities.zoom.min || 1;
                // @ts-ignore
                const max = capabilities.zoom.max || 5;
                const safeZoom = Math.min(Math.max(targetZoom, min), max);

                await track.applyConstraints({
                    advanced: [{ zoom: safeZoom }] as any
                });
                setHasHardwareZoom(true);
            }
        } catch (e) {
            // Hardware zoom not supported or failed, fallback to software digital crop/scale
            setHasHardwareZoom(false);
        }
    }, []);

    // Start Camera with Smart Constraint
    useEffect(() => {
        const startCamera = async () => {
            if (isOpen && step === 'capture') {
                setError(null);
                stopCamera();
                try {
                    const videoConstraints: MediaTrackConstraints = {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        advanced: [{ focusMode: "continuous" }] as any
                    };

                    if (selectedCameraId) {
                        videoConstraints.deviceId = { exact: selectedCameraId };
                    } else {
                        videoConstraints.facingMode = { ideal: 'environment' };
                    }

                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        video: videoConstraints 
                    });

                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        streamRef.current = stream;

                        // Check hardware zoom capability on track
                        const track = stream.getVideoTracks()[0];
                        if (track && track.getCapabilities) {
                            const capabilities = track.getCapabilities() as any;
                            if (capabilities?.zoom) {
                                setHasHardwareZoom(true);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    setError("لا يمكن الوصول إلى الكاميرا. يرجى التأكد من منح الصلاحية والمحاولة مرة أخرى.");
                    addNotification({ title: "خطأ في الكاميرا", message: "لا يمكن الوصول إلى الكاميرا.", type: 'error'});
                }
            } else {
                stopCamera();
            }
        };

        startCamera();

        return () => {
            stopCamera();
        };
    }, [isOpen, step, selectedCameraId, stopCamera, addNotification]);

    // --- Smart Matching Logic ---
    useEffect(() => {
        if (step === 'review' && aiRawData && mode === 'car') {
            const { make, model, year } = aiRawData;
            setSelectedYear(year || new Date().getFullYear());

            // 1. Try to find Make in DB
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const targetMake = normalize(make);
            
            const foundMake = carMakes.find(m => 
                normalize(m.name_en) === targetMake || 
                normalize(m.name_ar) === targetMake ||
                normalize(m.name_en).includes(targetMake)
            );

            if (foundMake) {
                setSelectedMakeId(foundMake.id);
                setSelectedMakeName(foundMake.name_en); // Display purposes
                
                // Fetch models for this make
                setIsLoadingModels(true);
                fetchCarModelsByMake(foundMake.id).then(() => {
                    setIsLoadingModels(false);
                });
            } else {
                setSelectedMakeName(make); // Keep AI text if not found
            }
        }
    }, [step, aiRawData, mode, carMakes, fetchCarModelsByMake]);

    // --- Secondary Effect: Match Model after Make is selected ---
    useEffect(() => {
        if (step === 'review' && selectedMakeId && aiRawData && !isLoadingModels) {
             const { model } = aiRawData;
             const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
             const targetModel = normalize(model);

             const relevantModels = carModels.filter(m => m.make_id === selectedMakeId);
             
             const foundModel = relevantModels.find(m => 
                normalize(m.name_en) === targetModel || 
                normalize(m.name_ar) === targetModel ||
                normalize(m.name_en).includes(targetModel)
             );

             if (foundModel) {
                 setSelectedModelId(foundModel.id);
                 setSelectedModelName(foundModel.name_en);
             } else {
                 setSelectedModelName(model);
             }
        }
    }, [selectedMakeId, carModels, aiRawData, step, isLoadingModels]);
    
    const handleCapture = async () => {
        if (!settings.geminiApiKey) {
            addNotification({
                title: 'مفتاح API مطلوب',
                message: 'الرجاء الانتقال إلى الإعدادات -> Gemini API لإضافة مفتاح أولاً.',
                type: 'error'
            });
            return;
        }

        if (!videoRef.current || !canvasRef.current) return;
        
        setStep('processing');
        setError(null);
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
            setError("لا يمكن الوصول إلى سياق الرسم.");
            setStep('capture');
            return;
        }

        // Capture & Crop Logic taking Zoom Level into account
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        // Base framing ratio
        const widthRatio = mode === 'plate' ? 0.8 : 0.9;
        const heightRatio = mode === 'plate' ? 0.4 : 0.7;

        // If software digital zoom is active (not handled by hardware track)
        const effectiveZoom = hasHardwareZoom ? 1 : zoomLevel;

        const cropWidth = (videoWidth * widthRatio) / effectiveZoom;
        const cropHeight = (videoHeight * heightRatio) / effectiveZoom;
        const cropX = Math.max(0, (videoWidth - cropWidth) / 2);
        const cropY = Math.max(0, (videoHeight - cropHeight) / 2);

        const MAX_DIMENSION = 900;
        let canvasWidth = cropWidth;
        let canvasHeight = cropHeight;

        if (canvasWidth > canvasHeight) {
            if (canvasWidth > MAX_DIMENSION) {
                canvasHeight = Math.round((canvasHeight * MAX_DIMENSION) / canvasWidth);
                canvasWidth = MAX_DIMENSION;
            }
        } else {
            if (canvasHeight > MAX_DIMENSION) {
                canvasWidth = Math.round((canvasWidth * MAX_DIMENSION) / canvasHeight);
                canvasHeight = MAX_DIMENSION;
            }
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvasWidth, canvasHeight);

        const base64Image = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        setCapturedImage(`data:image/jpeg;base64,${base64Image}`);
        
        try {
            const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
            const imagePart = {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image,
                },
            };
            
            if (mode === 'plate') {
                 const prompt = scanLanguage === 'ar'
                    ? `Analyze this Saudi Arabian license plate. 
                       EXTRACT ONLY the primary large registration Arabic letters and the numbers.
                       IGNORE all decorative, regional or small text like "KSA", "Saudi Arabia", "السعودية", or "المملكة".
                       Respond format: "LETTERS NUMBERS" (e.g., "أ ب ج 1234").`
                    : `Analyze this Saudi Arabian license plate. 
                       EXTRACT ONLY the primary large registration English letters and the numbers.
                       IGNORE all decorative, regional or small text like "KSA", "Saudi Arabia", "السعودية", or "المملكة".
                       Respond format: "LETTERS NUMBERS" (e.g., "A B J 1234").`;
                
                const response = await ai.models.generateContent({
                    model: 'gemini-flash-lite-latest',
                    contents: { parts: [imagePart, { text: prompt }] },
                });

                let text = response.text?.trim() || '';
                text = text.replace(/ـ/g, '');

                if (!text) {
                    if (onScanComplete) onScanComplete({ letters: '', numbers: '' });
                    onClose();
                    return;
                }

                let cleanText = text;
                IGNORED_TERMS.forEach(term => {
                    const regex = new RegExp(`\\b${term}\\b`, 'gi');
                    cleanText = cleanText.replace(regex, '');
                });
                
                const textWithoutSpaces = cleanText.replace(/\s+/g, '');
                let letters = '';
                let numbers = '';

                if (scanLanguage === 'ar') {
                    letters = (textWithoutSpaces.match(/[\u0621-\u064A]+/g) || []).join('').slice(0, 4);
                } else {
                    letters = (textWithoutSpaces.match(/[a-zA-Z]+/g) || []).join('').toUpperCase().slice(0, 4);
                }
                numbers = (textWithoutSpaces.match(/\d+/g) || []).join('').slice(0, 4);
                
                if (onScanComplete) onScanComplete({ letters, numbers });
                resetState();
                onClose();

            } else if (mode === 'car') {
                const prompt = `Identify the car manufacturer (make), model, and estimated year from this image. 
                Return the result strictly in JSON format.
                If unsure about the exact year, estimate the start of the model generation.
                Use English for 'make' and 'model'.`;

                const response = await ai.models.generateContent({
                    model: 'gemini-flash-lite-latest',
                    contents: { parts: [imagePart, { text: prompt }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                make: { type: Type.STRING },
                                model: { type: Type.STRING },
                                year: { type: Type.NUMBER },
                            },
                            required: ["make", "model", "year"]
                        }
                    }
                });

                const jsonText = response.text;
                if (jsonText) {
                    const carData = JSON.parse(cleanJsonString(jsonText));
                    setAiRawData(carData);
                    setStep('review');
                } else {
                    throw new Error("Empty response from AI");
                }
            }
            
        } catch (apiError: any) {
            console.error("Gemini API error:", apiError);
            setError("حدث خطأ أثناء التحليل. حاول مرة أخرى.");
            setStep('capture');
        }
    };

    const handleConfirmReview = () => {
        if (onCarIdentify) {
            const makeObj = carMakes.find(m => m.id === selectedMakeId);
            const modelObj = carModels.find(m => m.id === selectedModelId);

            onCarIdentify({
                makeId: selectedMakeId,
                makeName: makeObj ? makeObj.name_en : selectedMakeName,
                modelId: selectedModelId,
                modelName: modelObj ? modelObj.name_en : selectedModelName,
                year: selectedYear
            });
        }
        resetState();
        onClose();
    };

    const filteredModels = useMemo(() => {
        return carModels.filter(m => m.make_id === selectedMakeId);
    }, [carModels, selectedMakeId]);
    
    return (
        <Modal isOpen={isOpen} onClose={() => { resetState(); onClose(); }} title={mode === 'car' ? (step === 'review' ? "مراجعة وتأكيد" : "التعرف على السيارة") : "مسح لوحة السيارة"} size="3xl">
            {step === 'capture' && (
                <>
                    {/* Viewfinder Container */}
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
                        {error ? (
                            <div className="text-center text-white p-4">
                                <p className="font-semibold">حدث خطأ</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        ) : (
                            <div className="w-full h-full overflow-hidden flex items-center justify-center">
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    className="w-full h-full object-cover transition-transform duration-300 ease-out"
                                    style={{
                                        transform: !hasHardwareZoom && zoomLevel > 1 ? `scale(${zoomLevel})` : 'scale(1)'
                                    }}
                                />
                            </div>
                        )}

                        {/* Scanner Target Guide Box */}
                        {!error && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div 
                                    className={`relative border-2 border-amber-400 rounded-xl transition-all duration-300 ${mode === 'car' ? 'w-[90%] h-[70%]' : 'w-4/5 h-2/5'}`} 
                                    style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
                                >
                                    {/* Corner Accent Brackets */}
                                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-amber-400 rounded-tl-sm" />
                                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-amber-400 rounded-tr-sm" />
                                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-amber-400 rounded-bl-sm" />
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-amber-400 rounded-br-sm" />
                                    
                                    {/* Subtle Center Guide */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-40">
                                        <div className="w-6 h-6 border border-white/60 rounded-full flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Floating Lens / Zoom Control Pill [ 0.5x | 1x | 2x ] */}
                        {!error && (
                            <div className="absolute bottom-3 inset-x-0 flex justify-center items-center z-20 pointer-events-auto">
                                <div className="inline-flex items-center p-1 bg-black/70 backdrop-blur-md rounded-full border border-white/20 shadow-xl gap-1">
                                    {/* 0.5x Button */}
                                    <button
                                        type="button"
                                        onClick={() => applyZoom(0.5)}
                                        className={`px-3 py-1 rounded-full text-xs font-black transition-all ${
                                            zoomLevel === 0.5
                                                ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                                                : 'text-white/80 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        0.5x
                                    </button>

                                    {/* 1x Button (Default / Main Lens) */}
                                    <button
                                        type="button"
                                        onClick={() => applyZoom(1)}
                                        className={`px-3 py-1 rounded-full text-xs font-black transition-all ${
                                            zoomLevel === 1
                                                ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                                                : 'text-white/80 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        1x
                                    </button>

                                    {/* 2x Button (Telephoto / Zoom In) */}
                                    <button
                                        type="button"
                                        onClick={() => applyZoom(2)}
                                        className={`px-3 py-1 rounded-full text-xs font-black transition-all ${
                                            zoomLevel === 2
                                                ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                                                : 'text-white/80 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        2x
                                    </button>
                                </div>
                            </div>
                        )}

                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>

                    {/* Controls & Options Bar */}
                    <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                        
                        {/* Language Selector for Plate */}
                        {mode === 'plate' && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">لغة اللوحة:</span>
                                <div className="inline-flex rounded-lg shadow-xs bg-slate-100 dark:bg-slate-700 p-0.5 border dark:border-slate-600">
                                    <button 
                                        type="button"
                                        onClick={() => setScanLanguage('ar')} 
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                                            scanLanguage === 'ar' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500 dark:text-slate-300'
                                        }`}
                                    >
                                        عربي
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setScanLanguage('en')} 
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                                            scanLanguage === 'en' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500 dark:text-slate-300'
                                        }`}
                                    >
                                        English
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Optional Camera Switcher if device has multiple video inputs */}
                        {availableCameras.length > 1 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">العدسة:</span>
                                <select
                                    value={selectedCameraId}
                                    onChange={(e) => setSelectedCameraId(e.target.value)}
                                    className="text-xs p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 max-w-[180px] truncate"
                                >
                                    <option value="">تلقائي (الرئيسية)</option>
                                    {availableCameras.map((cam, idx) => (
                                        <option key={cam.deviceId || idx} value={cam.deviceId}>
                                            {cam.label || `كاميرا ${idx + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                    </div>

                    {mode === 'car' && (
                        <div className="mt-2 text-center">
                            <p className="text-xs text-slate-500 dark:text-slate-400">وجّه الكاميرا نحو السيارة بالكامل مع استخدام الزوم إذا لزم الأمر.</p>
                        </div>
                    )}

                    {/* Action Capture Button */}
                    <div className="mt-4 flex justify-center">
                        <Button onClick={handleCapture} size="md" className="py-3 px-8 rounded-full text-base font-bold shadow-lg">
                            <Icon name="camera" className="w-5 h-5"/>
                            <span className="ms-2">التقاط وقراءة</span>
                        </Button>
                    </div>
                </>
            )}

            {step === 'processing' && (
                <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCwIcon className="w-16 h-16 animate-spin text-blue-500 mb-4" />
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">جاري تحليل الصورة وقراءة اللوحة...</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">يرجى الانتظار بينما يقوم الذكاء الاصطناعي بالتعرف على البيانات.</p>
                </div>
            )}

            {step === 'review' && mode === 'car' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    <div className="order-2 md:order-1 space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <strong>نتيجة AI:</strong> {aiRawData?.make} {aiRawData?.model} ({aiRawData?.year})
                            <br/>
                            <span className="text-xs opacity-80">يرجى التأكد من البيانات أدناه قبل الاعتماد.</span>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">الشركة المصنعة</label>
                            <div className="relative">
                                <select 
                                    value={selectedMakeId} 
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        setSelectedMakeId(id);
                                        const make = carMakes.find(m => m.id === id);
                                        if (make) {
                                            setSelectedMakeName(make.name_en);
                                            fetchCarModelsByMake(make.id);
                                        }
                                        setSelectedModelId('');
                                        setSelectedModelName('');
                                    }}
                                    className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">-- اختر من القائمة --</option>
                                    {carMakes.map(make => (
                                        <option key={make.id} value={make.id}>{make.name_en} - {make.name_ar}</option>
                                    ))}
                                    <option value="" disabled>──────────</option>
                                    <option value="other">غير موجود في القائمة (استخدم نص AI)</option>
                                </select>
                                {!selectedMakeId && (
                                    <input 
                                        type="text" 
                                        value={selectedMakeName} 
                                        onChange={(e) => setSelectedMakeName(e.target.value)} 
                                        placeholder="اكتب اسم الشركة..." 
                                        className="mt-2 w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                                    />
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">الموديل</label>
                             <div className="relative">
                                <select 
                                    value={selectedModelId} 
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        setSelectedModelId(id);
                                        const model = carModels.find(m => m.id === id);
                                        if (model) setSelectedModelName(model.name_en);
                                    }}
                                    className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    disabled={!selectedMakeId || isLoadingModels}
                                >
                                    <option value="">{isLoadingModels ? 'جاري التحميل...' : '-- اختر الموديل --'}</option>
                                    {filteredModels.map(model => (
                                        <option key={model.id} value={model.id}>{model.name_en} - {model.name_ar}</option>
                                    ))}
                                </select>
                                {!selectedModelId && (
                                    <input 
                                        type="text" 
                                        value={selectedModelName} 
                                        onChange={(e) => setSelectedModelName(e.target.value)} 
                                        placeholder="اكتب اسم الموديل..." 
                                        className="mt-2 w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                                    />
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">سنة الصنع</label>
                            <input 
                                type="number" 
                                value={selectedYear} 
                                onChange={(e) => setSelectedYear(Number(e.target.value))} 
                                className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button variant="secondary" onClick={() => setStep('capture')} className="flex-1">إعادة التصوير</Button>
                            <Button onClick={handleConfirmReview} className="flex-1">تأكيد واستخدام البيانات</Button>
                        </div>
                    </div>
                    
                    <div className="order-1 md:order-2 flex flex-col items-center justify-center bg-black/5 rounded-xl p-2 h-full min-h-[200px]">
                        {capturedImage && (
                            <img src={capturedImage} alt="Captured" className="max-w-full max-h-[300px] object-contain rounded-lg shadow-md" />
                        )}
                        <p className="text-xs text-slate-500 mt-2">الصورة الملتقطة</p>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default CameraScannerModal;
