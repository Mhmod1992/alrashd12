
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import InspectionReport from '../components/InspectionReport';
import Icon from '../components/Icon';
import Button from '../components/Button';
import WhatsappIcon from '../components/icons/WhatsappIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import ReportTranslationModal from '../components/ReportTranslationModal';
import Modal from '../components/Modal';
import { InspectionRequest, ReportSettings, CustomFindingCategory } from '../types';
import DocumentScannerModal from '../components/DocumentScannerModal';
import CameraPage from '../components/CameraPage';
import CameraIcon from '../components/icons/CameraIcon';
import UploadIcon from '../components/icons/UploadIcon';
import TrashIcon from '../components/icons/TrashIcon';

// --- Image Optimization Helper ---
const optimizeDocumentImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const maxWidth = 1200;
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.filter = 'grayscale(100%) contrast(120%)';
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Blob creation failed'));
                    return;
                }
                const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });
                resolve(newFile);
            }, 'image/jpeg', 0.6);

            URL.revokeObjectURL(img.src);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(img.src);
            reject(err);
        };
    });
};

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
        fetchAndUpdateSingleRequest, updateRequest, uploadImage, deleteImage
    } = useAppContext();

    const reportRef = useRef<HTMLDivElement>(null);
    const originalRequest = requests.find(r => r.id === selectedRequestId);

    // Translation State
    const [translatedRequest, setTranslatedRequest] = useState<InspectionRequest | null>(null);
    const [translatedSettings, setTranslatedSettings] = useState<ReportSettings | null>(null);
    const [translatedCategories, setTranslatedCategories] = useState<CustomFindingCategory[] | null>(null);
    const [reportDirection, setReportDirection] = useState<'rtl' | 'ltr'>('rtl');
    const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);

    // Paper Archive State
    const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerFile, setScannerFile] = useState<File | null>(null);
    const [activeArchiveTab, setActiveArchiveTab] = useState<'all' | 'public' | 'internal'>('all');

    // New state for source choice logic
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isSourceChoiceModalOpen, setIsSourceChoiceModalOpen] = useState(false);
    const [currentUploadType, setCurrentUploadType] = useState<'manual_paper' | 'internal_draft'>('manual_paper');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isDataReady, setIsDataReady] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingState, setLoadingState] = useState('');
    const [previewScale, setPreviewScale] = useState(1);

    // Effective Data (Original OR Translated)
    const request = translatedRequest || originalRequest;
    const reportSettings = translatedSettings || settings.reportSettings;
    const effectiveCategories = translatedCategories || customFindingCategories;

    const paperImages = useMemo(() => {
        return originalRequest?.attached_files?.filter(f => f.type === 'manual_paper' || f.type === 'internal_draft') || [];
    }, [originalRequest]);

    const publicImages = useMemo(() => paperImages.filter(f => f.type !== 'internal_draft'), [paperImages]);
    const internalImages = useMemo(() => paperImages.filter(f => f.type === 'internal_draft'), [paperImages]);

    const displayedImages = useMemo(() => {
        if (activeArchiveTab === 'all') return paperImages;
        if (activeArchiveTab === 'public') return publicImages;
        return internalImages;
    }, [activeArchiveTab, paperImages, publicImages, internalImages]);

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

    // --- Upload Handlers (Refactored to match PaperArchive) ---
    const handleUploadClick = (type: 'manual_paper' | 'internal_draft') => {
        setCurrentUploadType(type);
        setIsSourceChoiceModalOpen(true);
    };

    const processFiles = async (files: File[], type: string) => {
        if (!originalRequest) return;
        setIsUploading(true);

        try {
            const newAttachments = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                let optimizedFile = file;

                if (!file.name.startsWith('scanned_')) {
                    optimizedFile = await optimizeDocumentImage(file);
                }

                const publicUrl = await uploadImage(optimizedFile, 'attached_files');

                newAttachments.push({
                    name: `req_${originalRequest.request_number}_${type}_${Date.now()}_${i}.jpg`,
                    type: type,
                    data: publicUrl
                });
            }

            const existingFiles = originalRequest.attached_files || [];
            const updatedFiles = [...existingFiles, ...newAttachments];

            await updateRequest({
                id: originalRequest.id,
                attached_files: updatedFiles
            });

            const msg = type === 'internal_draft' ? 'تم حفظ المسودة الداخلية.' : 'تمت الأرشفة بنجاح.';
            addNotification({ title: 'تم الحفظ', message: msg, type: 'success' });

            if (activeArchiveTab !== 'all') {
                if (type === 'internal_draft') setActiveArchiveTab('internal');
                else setActiveArchiveTab('public');
            }

        } catch (error: any) {
            console.error(error);
            addNotification({ title: 'خطأ', message: `فشل رفع الصور: ${error.message}`, type: 'error' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !originalRequest) return;
        const files: File[] = Array.from(e.target.files);

        if (files.length === 1 && files[0].type.startsWith('image/')) {
            setScannerFile(files[0]);
            setIsScannerOpen(true);
            e.target.value = '';
            return;
        }

        processFiles(files, currentUploadType);
        e.target.value = '';
    };

    const handleCameraCapture = (file: File) => {
        setScannerFile(file);
        setIsScannerOpen(true);
    };

    const handleScannerConfirm = (processedFile: File) => {
        setIsScannerOpen(false);
        setScannerFile(null);
        processFiles([processedFile], currentUploadType);
    };

    const handleDeleteImage = async (fileUrl: string) => {
        if (!originalRequest) return;
        const confirm = window.confirm("هل أنت متأكد من حذف هذه الصفحة من الأرشيف؟");
        if (!confirm) return;

        try {
            await deleteImage(fileUrl);
            const updatedFiles = (originalRequest.attached_files || []).filter(f => f.data !== fileUrl);
            await updateRequest({
                id: originalRequest.id,
                attached_files: updatedFiles
            });
            addNotification({ title: 'تم الحذف', message: 'تم حذف الصفحة.', type: 'info' });
        } catch (error) {
            addNotification({ title: 'خطأ', message: 'فشل الحذف.', type: 'error' });
        }
    };


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

            const MAIN_CARD = { minHeight: '200px', margin: '8px 0', padding: '6px', bgColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px' };
            const IMAGE_CONFIG = { height: '130px', marginBottom: '4px' };

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
            clone.style.direction = reportDirection;
            clone.style.textAlign = reportDirection === 'rtl' ? 'right' : 'left';

            const style = document.createElement('style');
            style.innerHTML = `
                .print-clone * { box-sizing: border-box !important; font-family: 'Tajawal', sans-serif !important; }
                .print-clone .finding-item { position: relative !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: flex-start !important; min-height: ${MAIN_CARD.minHeight} !important; height: auto !important; margin: ${MAIN_CARD.margin} !important; padding: ${MAIN_CARD.padding} !important; border: 1px solid ${MAIN_CARD.borderColor} !important; background: ${MAIN_CARD.bgColor} !important; border-radius: ${MAIN_CARD.borderRadius} !important; box-shadow: none !important; page-break-inside: avoid !important; }
                .print-clone .finding-img-container { order: 1 !important; position: relative !important; display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; height: ${IMAGE_CONFIG.height} !important; background: transparent !important; margin-bottom: ${IMAGE_CONFIG.marginBottom} !important; overflow: hidden !important; }
                .print-clone .finding-img-container img { width: auto !important; height: auto !important; max-width: 100% !important; max-height: 100% !important; object-fit: contain !important; }
                .print-clone .finding-item { position: relative !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: flex-start !important; min-height: ${MAIN_CARD.minHeight} !important; height: auto !important; margin: ${MAIN_CARD.margin} !important; padding: ${MAIN_CARD.padding} !important; border: 1px solid ${MAIN_CARD.borderColor} !important; background: ${MAIN_CARD.bgColor} !important; border-radius: ${MAIN_CARD.borderRadius} !important; box-shadow: none !important; page-break-inside: avoid !important; padding-top: 25px !important; overflow: visible !important; }
                .print-clone .finding-img-container { order: 1 !important; position: relative !important; display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; height: ${IMAGE_CONFIG.height} !important; background: transparent !important; margin-bottom: 2px !important; overflow: hidden !important; z-index: 1 !important; }
                .print-clone .finding-img-container img { width: auto !important; height: auto !important; max-width: 100% !important; max-height: 100% !important; object-fit: contain !important; }
                .print-clone .finding-text-wrapper { order: 2 !important; position: static !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: flex-start !important; width: 100% !important; background-color: transparent !important; border: none !important; padding: 0 !important; min-height: auto !important; overflow: visible !important; }
                /* Absolute positioning for the Title to force it to be the top layer */
                .print-clone .finding-text-wrapper h4 { 
                    position: absolute !important;
                    top: -12px !important; 
                    left: 0 !important; 
                    right: 0 !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                    z-index: 100 !important; 
                    background-color: #ffffff !important; 
                    border: 1px solid #cbd5e1 !important; 
                    border-radius: 12px !important; 
                    /* Control text vertical position: Top Rigth Bottom Left*/
                    padding: 1px 12px 5px 12px !important; 
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; 
                    font-size: 11px !important; 
                    color: #1e293b !important; 
                    font-weight: bold !important; 
                    text-align: center !important; 
                    width: 90% !important; 
                    white-space: normal !important; 
                    line-height: normal !important; 
                    min-height: auto !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .print-clone .finding-text-wrapper p { 
                    position: relative !important; 
                    z-index: 5 !important; 
                    background-color: #f8fafc !important; 
                    border: 1px solid #e2e8f0 !important; 
                    border-radius: 6px !important; 
                    padding: 8px 6px 4px 6px !important; 
                    margin: 0 !important; 
                    margin-top: 4px !important; /* Visual separation from image */
                    width: 100% !important; 
                    text-align: center !important; 
                    font-size: 11px !important; 
                    font-weight: bold !important; 
                    color: #334155 !important; 
                    white-space: normal !important; 
                    line-height: 1.4 !important; 
                }
                .print-clone .finding-content { display: contents !important; }
                .print-clone .info-block { top: 2px !important; position: relative !important; }
                .print-clone .finding-category h3 { top: -4px !important; position: relative !important; }
                .print-clone span[style*="background-color"] { position: relative !important; display: inline-block !important; top: -1px !important; padding: 0 4px !important; line-height: 1.4 !important; }
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
                onclone: (doc: Document) => { const el = doc.querySelector('.print-clone') as HTMLElement; if (el) el.style.transform = 'none'; }
            }) as HTMLCanvasElement;

            document.body.removeChild(clone);
            setLoadingState('جاري إنشاء ملف PDF...');

            const { jsPDF } = (window as any).jspdf;
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            const pdfWidth = 210;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [pdfWidth, pdfHeight] });
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

            // --- APPEND ATTACHMENTS (Excluding 'internal_draft') ---
            const attachments = originalRequest?.attached_files || [];
            const validAttachments = attachments.filter(f => f.type !== 'internal_draft');

            if (validAttachments.length > 0) {
                setLoadingState(`جاري إرفاق المستندات (${validAttachments.length})...`);

                for (let i = 0; i < validAttachments.length; i++) {
                    const file = validAttachments[i];
                    try {
                        const imgBase64 = await urlToBase64(file.data);

                        // Add new A4 page
                        pdf.addPage([210, 297], 'p');

                        // Calculate dimensions to fit image within A4 while maintaining aspect ratio
                        const imgProps = pdf.getImageProperties(imgBase64);
                        const pdfPageWidth = 210;
                        const pdfPageHeight = 297;
                        const margin = 0; // Full page

                        const availWidth = pdfPageWidth - (margin * 2);
                        const availHeight = pdfPageHeight - (margin * 2);

                        const widthRatio = availWidth / imgProps.width;
                        const heightRatio = availHeight / imgProps.height;
                        const ratio = Math.min(widthRatio, heightRatio);

                        const finalW = imgProps.width * ratio;
                        const finalH = imgProps.height * ratio;

                        // Center the image
                        const x = margin + (availWidth - finalW) / 2;
                        const y = margin + (availHeight - finalH) / 2;

                        pdf.addImage(imgBase64, imgProps.fileType, x, y, finalW, finalH, undefined, 'FAST');

                    } catch (err) {
                        console.error(`Failed to add attachment ${file.name} to PDF`, err);
                    }
                }
            }
            // -----------------------------------------------------

            return pdf;
        } catch (e: any) {
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
                <p className="text-xl text-gray-700 dark:text-gray-300">{request ? 'جاري تحميل بيانات التقرير...' : 'لم يتم العثور على الطلب.'}</p>
                {!request && <Button onClick={() => setPage('requests')} className="mt-4">العودة</Button>}
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

                    <Button
                        variant="secondary"
                        onClick={() => setIsPaperModalOpen(true)}
                        size="sm"
                        className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                    >
                        <Icon name="folder-open" className="w-4 h-4" />
                        <span className="hidden sm:inline ms-1">أرشيف الطلب ({paperImages.length})</span>
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
                            {client && car && inspectionType ?
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

            {/* Paper Archive Viewer & Manager Modal */}
            <Modal isOpen={isPaperModalOpen} onClose={() => setIsPaperModalOpen(false)} title="أرشيف الطلب (المرفقات)" size="4xl">
                <div className="flex flex-col h-[75vh]">
                    <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
                        <div className="md:w-2/3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-700 p-4 flex flex-col overflow-hidden order-2 md:order-1">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2 flex-shrink-0">
                                <Icon name="gallery" className="w-4 h-4" /> الصفحات المحفوظة
                            </h4>

                            <div className="flex border-b dark:border-slate-700 mb-4">
                                <button
                                    className={`flex-1 py-2 text-sm font-bold transition-colors ${activeArchiveTab === 'all' ? 'border-b-2 border-slate-600 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    onClick={() => setActiveArchiveTab('all')}
                                >
                                    الكل ({paperImages.length})
                                </button>
                                <button
                                    className={`flex-1 py-2 text-sm font-bold transition-colors ${activeArchiveTab === 'public' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    onClick={() => setActiveArchiveTab('public')}
                                >
                                    مرفقات التقرير ({publicImages.length})
                                </button>
                                <button
                                    className={`flex-1 py-2 text-sm font-bold transition-colors ${activeArchiveTab === 'internal' ? 'border-b-2 border-yellow-500 text-yellow-600 dark:text-yellow-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    onClick={() => setActiveArchiveTab('internal')}
                                >
                                    مسودات داخلية ({internalImages.length})
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                                {displayedImages.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {displayedImages.map((file, idx) => (
                                            <div key={file.data || idx} className="relative group rounded-lg overflow-hidden border dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm aspect-[3/4] cursor-pointer" onClick={() => setPreviewImage(file.data)}>
                                                <img src={file.data} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); setPreviewImage(file.data); }} className="p-2 bg-white rounded-full text-slate-800 hover:bg-blue-50 transition-colors">
                                                        <Icon name="eye" className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(file.data); }} className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] p-1 text-center truncate">
                                                    {file.name}
                                                    {file.type === 'internal_draft' && <span className="block text-[8px] text-yellow-300">(مسودة داخلية)</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <Icon name="folder-open" className="w-12 h-12 mb-2 opacity-20" />
                                        <p className="text-sm">لا توجد صفحات في هذا القسم.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="md:w-1/3 flex flex-col gap-4 order-1 md:order-2 flex-shrink-0">
                            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">إضافة مستندات</h3>
                                <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
                                    <button onClick={() => handleUploadClick('manual_paper')} disabled={isUploading} className="flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                        <UploadIcon className="w-5 h-5" />
                                        <span className="font-bold text-sm">رفع ملفات</span>
                                    </button>
                                    <button onClick={() => handleUploadClick('internal_draft')} disabled={isUploading} className="flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800">
                                        <Icon name="edit" className="w-5 h-5" />
                                        <span className="font-bold text-sm">مسودة (داخلي)</span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 text-center">
                                    الملفات المرفوعة كـ "مسودة" لن تظهر للعميل.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 mt-4 border-t dark:border-slate-700 flex justify-end flex-shrink-0">
                        <Button variant="secondary" onClick={() => setIsPaperModalOpen(false)}>إغلاق</Button>
                    </div>
                </div>
            </Modal>

            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelected} className="hidden" />

            <Modal isOpen={isSourceChoiceModalOpen} onClose={() => setIsSourceChoiceModalOpen(false)} title="اختر مصدر الصورة" size="sm">
                <div className="p-4 flex flex-col gap-4">
                    <Button onClick={() => { setIsSourceChoiceModalOpen(false); setIsCameraOpen(true); }} className="w-full py-4 text-lg justify-center" variant="secondary" leftIcon={<CameraIcon className="w-6 h-6" />}>
                        من الكاميرا
                    </Button>
                    <Button onClick={() => { setIsSourceChoiceModalOpen(false); fileInputRef.current?.click(); }} className="w-full py-4 text-lg justify-center" variant="secondary" leftIcon={<UploadIcon className="w-6 h-6" />}>
                        من الجهاز
                    </Button>
                </div>
            </Modal>

            <DocumentScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                imageFile={scannerFile}
                onConfirm={handleScannerConfirm}
                forceFilter={currentUploadType === 'internal_draft' ? 'bw' : undefined}
            />

            <CameraPage
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleCameraCapture}
            />

            <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="معاينة الصورة" size="4xl">
                <div className="flex justify-center items-center bg-black/90 p-4 rounded-lg">
                    {previewImage && (
                        <img src={previewImage} alt="Preview" className="max-w-full max-h-[80vh] object-contain" />
                    )}
                </div>
                <div className="flex justify-end pt-4">
                    <Button variant="secondary" onClick={() => setPreviewImage(null)}>إغلاق</Button>
                </div>
            </Modal>
        </div>
    );
};

export default PrintReport;
