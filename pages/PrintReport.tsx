
import React, { useRef, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import InspectionReport from '../components/InspectionReport';
import Icon from '../components/Icon';
import Button from '../components/Button';
import WhatsappIcon from '../components/icons/WhatsappIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import ReportTranslationModal from '../components/ReportTranslationModal';
import { InspectionRequest, ReportSettings, CustomFindingCategory } from '../types';

const ensureLibraries = async (): Promise<void> => {
    const isLoaded = () => (window as any).jspdf && (window as any).html2canvas;
    
    if (isLoaded()) return Promise.resolve();

    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (isLoaded()) {
                clearInterval(interval);
                resolve();
            } else if (attempts > 100) { 
                clearInterval(interval);
                const script1 = document.createElement('script');
                script1.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                script1.onload = () => {
                    const script2 = document.createElement('script');
                    script2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
                    script2.onload = () => resolve();
                    document.body.appendChild(script2);
                };
                script1.onerror = reject;
                document.body.appendChild(script1);
            }
        }, 100);
    });
};

const ensureFonts = async () => {
    await document.fonts.ready;
    const font = "16px 'Tajawal'";
    if (!document.fonts.check(font)) {
        await new Promise(r => setTimeout(r, 1000)); 
    }
};

const urlToBase64 = async (url: string): Promise<string> => {
    if (!url || url.startsWith('data:')) return url;
    const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const fetchImage = async (targetUrl: string): Promise<string> => {
        const response = await fetch(targetUrl, { cache: 'force-cache', mode: 'cors' });
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    try {
        return await fetchImage(url);
    } catch (e1) {
        try {
            return await fetchImage(`https://corsproxy.io/?${encodeURIComponent(url)}`);
        } catch (e2) {
            try {
                return await fetchImage(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
            } catch (e3) {
                console.warn(`Failed to convert image: ${url}. Using fallback.`);
                return FALLBACK_IMAGE;
            }
        }
    }
};

const PrintReport: React.FC = () => {
    const { 
        selectedRequestId, requests, clients, cars, carMakes, 
        carModels, inspectionTypes, setPage, predefinedFindings, 
        customFindingCategories, settings, addNotification, goBack,
        fetchAndUpdateSingleRequest, updateRequest, uploadImage
    } = useAppContext();

    const reportRef = useRef<HTMLDivElement>(null);
    const originalRequest = requests.find(r => r.id === selectedRequestId);
    
    // Translation State
    const [translatedRequest, setTranslatedRequest] = useState<InspectionRequest | null>(null);
    const [translatedSettings, setTranslatedSettings] = useState<ReportSettings | null>(null);
    const [translatedCategories, setTranslatedCategories] = useState<CustomFindingCategory[] | null>(null);
    const [reportDirection, setReportDirection] = useState<'rtl' | 'ltr'>('rtl');
    const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);

    const [isDataReady, setIsDataReady] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingState, setLoadingState] = useState('');
    const [previewScale, setPreviewScale] = useState(1);
    
    // Effective Data (Original OR Translated)
    const request = translatedRequest || originalRequest;
    const reportSettings = translatedSettings || settings.reportSettings;
    const effectiveCategories = translatedCategories || customFindingCategories;

    useEffect(() => {
        if (request && typeof request.inspection_data !== 'undefined') {
            setIsDataReady(true);
        } else {
            setIsDataReady(false);
            if (selectedRequestId) {
                fetchAndUpdateSingleRequest(selectedRequestId);
            }
        }
    }, [request, selectedRequestId, fetchAndUpdateSingleRequest]);

    useEffect(() => {
        const handleResize = () => {
            const screenWidth = window.innerWidth;
            const a4WidthPx = 794; 
            const padding = 32; 
            const availableWidth = screenWidth - padding;
            if (availableWidth < a4WidthPx) {
                setPreviewScale(availableWidth / a4WidthPx);
            } else {
                setPreviewScale(1);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize(); 
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const client = request ? clients.find(c => c.id === request.client_id) : undefined;
    const car = request ? cars.find(c => c.id === request.car_id) : undefined;
    const carModel = car ? carModels.find(m => m.id === car.model_id) : undefined;
    const carMake = car ? carMakes.find(m => m.id === car.make_id) : undefined;
    const inspectionType = request ? inspectionTypes.find(i => i.id === request.inspection_type_id) : undefined;

    const handlePrint = () => {
        window.print();
    };

    const handleTranslateComplete = (
        newRequest: InspectionRequest, 
        newSettings: ReportSettings, 
        direction: 'rtl' | 'ltr', 
        newCategories: CustomFindingCategory[]
    ) => {
        setTranslatedRequest(newRequest);
        setTranslatedSettings(newSettings);
        setReportDirection(direction);
        setTranslatedCategories(newCategories);
    };

    const handleClearTranslation = () => {
        setTranslatedRequest(null);
        setTranslatedSettings(null);
        setTranslatedCategories(null);
        setReportDirection('rtl');
        addNotification({ title: 'تم', message: 'تمت العودة للتقرير الأصلي.', type: 'info' });
    };

    const generatePdfInstance = async () => {
        if (!reportRef.current) return null;
        
        setIsGenerating(true);
        setLoadingState('جاري التحضير...');

        try {
            await ensureLibraries();
            setLoadingState('جاري تحميل الخطوط...');
            await ensureFonts();

            setLoadingState('جاري معالجة الصور...');

            const originalElement = reportRef.current;
            const clone = originalElement.cloneNode(true) as HTMLElement;
            
            // =========================================================
            // 🛠️ منطقة التحكم في التصميم (الترتيب الطبقي) 🛠️
            // =========================================================
            
            /* 1. إعدادات البطاقة الكلية (الحاوية الرئيسية) */
            const MAIN_CARD = {
                minHeight: '200px',
                margin: '8px 0',
                padding: '6px',
                bgColor: '#ffffff',
                borderColor: '#e2e8f0',
                borderRadius: '8px'
            };

            /* 2. إعدادات الصورة */
            const IMAGE_CONFIG = {
                height: '130px',
                marginBottom: '4px'
            };

            // =========================================================

            // --- 🛠️ معالجة النصوص الملونة ---
            const coloredSpans = clone.querySelectorAll('span[style*="background-color"]');
            coloredSpans.forEach((span) => {
                const originalText = span.innerHTML;
                span.innerHTML = `<span class="inner-text-mover">${originalText}</span>`;
            });

            clone.style.width = '794px'; 
            clone.style.minHeight = '1123px';
            clone.style.position = 'fixed';
            clone.style.left = '0';
            clone.style.top = '0';
            clone.style.zIndex = '-9999';
            clone.style.background = '#ffffff';
            clone.style.overflow = 'visible';
            
            // Apply Direction
            clone.style.direction = reportDirection;
            clone.style.textAlign = reportDirection === 'rtl' ? 'right' : 'left';
            
            const style = document.createElement('style');
            style.innerHTML = `
                /* Reset */
                .print-clone * { 
                    box-sizing: border-box !important; 
                    font-family: 'Tajawal', sans-serif !important; 
                }

                /* --- CARD CONTAINER --- */
                .print-clone .finding-item { 
                    position: relative !important; 
                    display: flex !important; 
                    flex-direction: column !important;
                    align-items: center !important; 
                    justify-content: flex-start !important;
                    min-height: ${MAIN_CARD.minHeight} !important;
                    height: auto !important;
                    margin: ${MAIN_CARD.margin} !important;
                    padding: ${MAIN_CARD.padding} !important;
                    border: 1px solid ${MAIN_CARD.borderColor} !important; 
                    background: ${MAIN_CARD.bgColor} !important; 
                    border-radius: ${MAIN_CARD.borderRadius} !important;
                    box-shadow: none !important;
                    page-break-inside: avoid !important;
                }
                
                /* --- 1. IMAGE --- */
                .print-clone .finding-img-container { 
                    order: 1 !important;
                    position: relative !important;
                    display: flex !important; 
                    align-items: center !important; 
                    justify-content: center !important; 
                    width: 100% !important;
                    height: ${IMAGE_CONFIG.height} !important;
                    background: transparent !important; 
                    margin-bottom: ${IMAGE_CONFIG.marginBottom} !important;
                    overflow: hidden !important;
                }
                
                .print-clone .finding-img-container img { 
                    width: auto !important; height: auto !important;
                    max-width: 100% !important; max-height: 100% !important;
                    object-fit: contain !important;
                }

                /* --- 2. WRAPPER (Container for Text) --- */
                .print-clone .finding-text-wrapper {
                    order: 2 !important;
                    position: static !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    width: 98% !important;
                    /* إزالة تنسيق الصندوق الموحد */
                    background-color: transparent !important;
                    border: none !important;
                    padding: 0 !important;
                    min-height: 50px !important;
                    overflow: visible !important;
                }

                /* Name Style (Floating Top Layer - Badge) */
                .print-clone .finding-text-wrapper h4 {
                    position: relative !important;
                    z-index: 10 !important; /* طبقة علوية */
                    
                    /* مظهر الشارة */
                    background-color: #ffffff !important;
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 12px !important;
                    padding: 2px 10px !important;
                    box-shadow: 0 2px 3px rgba(0,0,0,0.05) !important;
                    
                    /* التموضع */
                    margin: 0 !important;
                    margin-bottom: -10px !important; /* تداخل سلبي ليسقط فوق العنصر التالي */
                    top: -2mm !important; /* 🟢 رفع الاسم 2 مم للأعلى */
                    
                    /* النص */
                    font-size: 10px !important;
                    color: #1e293b !important;
                    font-weight: bold !important;
                    text-align: center !important;
                    width: auto !important;
                    max-width: 95% !important;
                }
                
                /* Status Style (Base Bottom Layer - Card) */
                .print-clone .finding-text-wrapper p {
                    position: relative !important;
                    z-index: 5 !important; /* طبقة سفلية */
                    
                    /* مظهر الصندوق */
                    background-color: #f8fafc !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 6px !important;
                    
                    /* الحواشي (مع زيادة الحاشية العلوية لاستيعاب الاسم المتداخل) */
                    padding: 12px 8px 4px 8px !important; 
                    margin: 0 !important;
                    
                    /* النص */
                    width: 100% !important;
                    text-align: center !important;
                    font-size: 11px !important;
                    font-weight: bold !important;
                    color: #334155 !important;
                    white-space: nowrap !important;
                }

                /* Hide unwanted containers */
                .print-clone .finding-content { display: contents !important; }

                /* Fix Headers & Layout */
                .print-clone .info-block { top: 2px !important; position: relative !important; }
                .print-clone .finding-category h3 { top: -4px !important; position: relative !important; }

                /* Colored Text Fix */
                .print-clone span[style*="background-color"] {
                     position: relative !important; display: inline-block !important;
                     top: -1px !important; padding: 0 4px !important; line-height: 1.4 !important;
                }

                /* Logo Fixes */
                .print-clone img { object-fit: contain !important; }
                .print-clone .target-logo { height: 90px !important; width: auto !important; }
                .print-clone .target-car-logo img { height: 60px !important; width: auto !important; }
                .print-clone .flex-row-reverse { flex-direction: ${reportDirection === 'rtl' ? 'row-reverse' : 'row'} !important; }
            `;
            clone.appendChild(style);
            clone.classList.add('print-clone');
            
            document.body.appendChild(clone);

            const qrContainer = clone.querySelector('.target-qr');
            if (qrContainer) {
                const originalCanvas = originalElement.querySelector('.target-qr canvas') as HTMLCanvasElement;
                if (originalCanvas) {
                    const img = document.createElement('img');
                    img.src = originalCanvas.toDataURL("image/png");
                    img.style.width = '100%'; img.style.height = '100%'; img.style.display = 'block';
                    qrContainer.innerHTML = ''; qrContainer.appendChild(img);
                }
            }

            const images = Array.from(clone.querySelectorAll('img'));
            const imagePromises = images.map(async (img) => {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('data:')) {
                    try {
                        const base64 = await urlToBase64(src);
                        img.setAttribute('src', base64);
                    } catch (e) { }
                }
            });
            await Promise.all(imagePromises);
            await new Promise(r => setTimeout(r, 1000));

            setLoadingState('جاري التقاط الشاشة...');

            const canvas = await (window as any).html2canvas(clone, {
                useCORS: true, allowTaint: true, logging: false, scale: 2, windowWidth: 794, width: 794,
                scrollY: 0, scrollX: 0, x: 0, y: 0, backgroundColor: '#ffffff',
                onclone: (doc: Document) => { const el = doc.querySelector('.print-clone') as HTMLElement; if(el) el.style.transform = 'none'; }
            }) as HTMLCanvasElement;

            document.body.removeChild(clone);
            setLoadingState('جاري إنشاء ملف PDF...');

            const { jsPDF } = (window as any).jspdf;
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            const pdfWidth = 210; 
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [pdfWidth, pdfHeight] });
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            
            return pdf;
        } catch(e: any) {
            addNotification({ title: 'خطأ', message: 'فشل إنشاء الملف.', type: 'error' });
            return null;
        } finally {
            setIsGenerating(false); setLoadingState('');
        }
    };

    const handleWhatsAppShare = async () => {
        if (!client?.phone) { addNotification({ title: 'بيانات ناقصة', message: 'رقم هاتف العميل غير متوفر.', type: 'warning' }); return; }
        try {
            const pdf = await generatePdfInstance();
            if (!pdf) return;
            setLoadingState('جاري الرفع إلى السيرفر...');
            const blob = pdf.output('blob');
            const file = new File([blob], `Report_${request?.request_number}.pdf`, { type: 'application/pdf' });
            const publicUrl = await uploadImage(file, 'reports');
            if (originalRequest && !translatedRequest) { 
                await updateRequest({ id: originalRequest.id, report_url: publicUrl, report_generated_at: new Date().toISOString() });
            }
            openWhatsapp(publicUrl);
            addNotification({ title: 'تم', message: 'تم إرسال التقرير.', type: 'success' });
        } catch (error: any) { addNotification({ title: 'خطأ', message: 'فشل الإرسال.', type: 'error' }); }
    };

    const openWhatsapp = (link: string) => {
        let phone = client?.phone.replace(/\D/g, '') || ''; 
        if (phone.startsWith('05')) phone = '966' + phone.substring(1);
        else if (phone.length === 9 && phone.startsWith('5')) phone = '966' + phone;
        const carName = request?.car_snapshot ? `${request.car_snapshot.make_en} ${request.car_snapshot.model_en} ${request.car_snapshot.year}` : 'السيارة';
        const message = `مرحباً سيد ${client?.name || ''}،\nإليك تقرير الفحص الفني لسيارتك ${carName}:\n${link}\n\nشكراً لثقتكم بنا.`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleDownloadPdf = async () => {
        const pdf = await generatePdfInstance();
        if (pdf) pdf.save(`Report_${request?.request_number}.pdf`);
    };

    if (!request || !isDataReady) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-4">
                <RefreshCwIcon className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" />
                <p className="text-xl text-gray-700 dark:text-gray-300">{ request ? 'جاري تحميل بيانات التقرير...' : 'لم يتم العثور على الطلب.' }</p>
                { !request && <Button onClick={() => setPage('requests')} className="mt-4">العودة</Button> }
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 min-h-screen flex flex-col">
            <header className="no-print bg-white dark:bg-slate-800 p-4 shadow-md flex justify-between items-center sticky top-0 z-50">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    معاينة التقرير
                    {translatedRequest && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full border border-purple-200">مترجم (مؤقت)</span>}
                </h2>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={goBack} size="sm" disabled={isGenerating}>
                        <Icon name="back" className="w-4 h-4 transform scale-x-[-1]" />
                        <span className="hidden sm:inline ms-1">العودة</span>
                    </Button>
                    
                    {translatedRequest ? (
                        <Button onClick={handleClearTranslation} variant="secondary" size="sm" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100">
                            <Icon name="refresh-cw" className="w-4 h-4" />
                            <span className="hidden sm:inline ms-1">إلغاء الترجمة</span>
                        </Button>
                    ) : (
                        <Button onClick={() => setIsTranslationModalOpen(true)} variant="secondary" size="sm" className="text-purple-600 border-purple-200 hover:bg-purple-50">
                            <SparklesIcon className="w-4 h-4" />
                            <span className="hidden sm:inline ms-1">ترجمة التقرير</span>
                        </Button>
                    )}

                    <Button onClick={handleWhatsAppShare} variant="whatsapp" size="sm" disabled={isGenerating}>
                        <WhatsappIcon className="w-4 h-4" />
                        <span className="hidden sm:inline ms-1">إرسال</span>
                    </Button>
                     <Button variant="secondary" onClick={handlePrint} size="sm" disabled={isGenerating}>
                        <Icon name="print" className="w-4 h-4" />
                        <span className="hidden sm:inline ms-1">طباعة</span>
                    </Button>
                    <Button onClick={handleDownloadPdf} size="sm" disabled={isGenerating}>
                        <Icon name="document-report" className="w-4 h-4" />
                        <span className="hidden sm:inline ms-1">PDF</span>
                    </Button>
                </div>
            </header>
            
            {isGenerating && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                    <p className="text-2xl font-bold mb-2">{loadingState}</p>
                    <p className="text-sm opacity-75">يرجى الانتظار...</p>
                </div>
            )}
            
            <main className="flex-1 bg-gray-200 dark:bg-gray-900/50 py-8 overflow-auto print-container print:py-0 print:bg-white print:overflow-visible" dir={reportDirection}>
                <div className="flex justify-center w-full min-h-full print:block print:w-full print:h-auto">
                    <div className="origin-top transition-transform duration-200 print-reset-transform" style={{ transform: `scale(${previewScale})`, marginBottom: `-${(1 - previewScale) * 100}%` }}>
                        <div className="report-wrapper bg-white shadow-2xl print:shadow-none mx-auto overflow-hidden print:overflow-visible print:h-auto print:min-h-0 print:w-full" style={{ width: '210mm', minHeight: '297mm' }}>
                            { client && car && inspectionType ?
                                <InspectionReport
                                    ref={reportRef}
                                    request={request}
                                    client={client}
                                    car={car}
                                    carMake={carMake}
                                    carModel={carModel}
                                    inspectionType={inspectionType}
                                    customFindingCategories={effectiveCategories}
                                    predefinedFindings={predefinedFindings}
                                    settings={{ ...settings, reportSettings: reportSettings }}
                                    isPrintView={true}
                                    reportDirection={reportDirection}
                                />
                                 : <div className="p-8 text-center">جاري تحميل البيانات...</div>
                            }
                        </div>
                    </div>
                </div>
            </main>

            {originalRequest && (
                <ReportTranslationModal 
                    isOpen={isTranslationModalOpen}
                    onClose={() => setIsTranslationModalOpen(false)}
                    originalRequest={originalRequest}
                    originalSettings={settings.reportSettings}
                    categories={customFindingCategories}
                    apiKey={settings.geminiApiKey}
                    addNotification={addNotification}
                    onTranslateComplete={handleTranslateComplete}
                />
            )}
        </div>
    );
};

export default PrintReport;
