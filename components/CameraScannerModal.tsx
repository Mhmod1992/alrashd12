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
    const [scanLanguage, setScanLanguage] = useState<'ar' | 'en'>('ar');
    
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
    };

    useEffect(() => {
        const startCamera = async () => {
            if (isOpen && step === 'capture') {
                setError(null);
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: 'environment' } 
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        streamRef.current = stream;
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
    }, [isOpen, step, stopCamera, addNotification]);

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

        // Capture Logic
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const widthRatio = mode === 'plate' ? 0.8 : 0.9;
        const heightRatio = mode === 'plate' ? 0.4 : 0.7;
        const cropWidth = videoWidth * widthRatio;
        const cropHeight = videoHeight * heightRatio;
        const cropX = (videoWidth - cropWidth) / 2;
        const cropY = (videoHeight - cropHeight) / 2;
        const MAX_DIMENSION = 800;
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

        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
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
                // ... Existing Plate Logic ...
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
                onClose(); // Close strictly for plate mode as we don't have review UI for it yet

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
                    setStep('review'); // Switch to review mode
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
            // Find selected make/model names from list if ID is selected, otherwise use text
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
                    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                        {error ? (
                            <div className="text-center text-white p-4">
                                <p className="font-semibold">حدث خطأ</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        ) : (
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        )}

                        {!error && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div 
                                    className={`border-4 border-white/50 rounded-xl shadow-lg transition-all duration-300 ${mode === 'car' ? 'w-[90%] h-[70%]' : 'w-4/5 h-2/5'}`} 
                                    style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}
                                ></div>
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>

                    {mode === 'plate' && (
                        <div className="mt-4 text-center">
                             <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">اختر لغة الأحرف على اللوحة:</p>
                             <div className="inline-flex rounded-lg shadow-sm bg-slate-100 dark:bg-slate-700 p-1">
                                <button onClick={() => setScanLanguage('ar')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${scanLanguage === 'ar' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow' : 'text-slate-500 dark:text-slate-300'}`}>حروف عربية</button>
                                <button onClick={() => setScanLanguage('en')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${scanLanguage === 'en' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow' : 'text-slate-500 dark:text-slate-300'}`}>حروف إنجليزية</button>
                            </div>
                        </div>
                    )}
                    
                    {mode === 'car' && (
                        <div className="mt-4 text-center">
                            <p className="text-sm text-slate-600 dark:text-slate-400">وجه الكاميرا نحو السيارة بالكامل.</p>
                        </div>
                    )}

                    <div className="mt-4 flex justify-center">
                        <Button onClick={handleCapture} size="md" className="py-4 px-8 rounded-full text-lg">
                            <Icon name="camera" className="w-6 h-6"/>
                            <span className="ms-2">التقاط</span>
                        </Button>
                    </div>
                </>
            )}

            {step === 'processing' && (
                <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCwIcon className="w-16 h-16 animate-spin text-blue-500 mb-4" />
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">جاري تحليل الصورة...</p>
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
                            {/* Make Select / Input Combo */}
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
                                        // Reset model when make changes
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