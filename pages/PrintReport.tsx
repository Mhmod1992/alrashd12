
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import InspectionReport from '../components/InspectionReport';
import Icon from '../components/Icon';
import Button from '../components/Button';
import WhatsappIcon from '../components/icons/WhatsappIcon';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import SparklesIcon from '../components/icons/SparklesIcon';
import ReportTranslationModal from '../components/ReportTranslationModal';
import AiAnalysisModal from '../components/AiAnalysisModal';
import Modal from '../components/Modal'; 
import { InspectionRequest, ReportSettings, CustomFindingCategory, Note } from '../types';
import DocumentScannerModal from '../components/DocumentScannerModal';
import CameraPage from '../components/CameraPage';
import CameraIcon from '../components/icons/CameraIcon';
import ReactMarkdown from 'react-markdown';
import UploadIcon from '../components/icons/UploadIcon';
import TrashIcon from '../components/icons/TrashIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import { motion, AnimatePresence } from 'motion/react';
import { pdf } from '@react-pdf/renderer';
import OrderPdf from '../components/reports/OrderPdf';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker using Vite's ?url import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// --- Image Optimization Helper ---
// Updated to accept 'grayscale' parameter. Default is true for backward compatibility with 'document' style.
const optimizeDocumentImage = async (file: File, grayscale: boolean = true): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const maxWidth = 1200; // Max width for documents
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

            // Draw white background (prevents transparency issues)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            // Apply filters based on mode
            if (grayscale) {
                ctx.filter = 'grayscale(100%) contrast(120%)';
            } else {
                // Slight contrast boost for color documents, but no grayscale
                ctx.filter = 'contrast(105%)';
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Blob creation failed'));
                    return;
                }
                const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });
                resolve(newFile);
            }, 'image/jpeg', 0.7); // Slightly higher quality for potential color images
            
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

const compressImageForPdf = async (url: string, maxWidth: number = 600, quality: number = 0.5): Promise<string> => {
    if (!url) return '';
    
    return new Promise(async (resolve) => {
        try {
            if (url.startsWith('data:')) {
                const img = new Image();
                img.onload = () => {
                   const result = processImage(img);
                   resolve(result);
                };
                img.onerror = () => resolve(url);
                img.src = url;
                return;
            }

            const processImage = (img: HTMLImageElement) => {
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
                if (!ctx) return url;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                
                return canvas.toDataURL('image/jpeg', quality);
            };

            const tryLoad = (src: string, isProxy: boolean = false): Promise<string> => {
                return new Promise((res, rej) => {
                    const img = new Image();
                    if (!isProxy) img.crossOrigin = "anonymous";
                    img.onload = () => res(processImage(img));
                    img.onerror = rej;
                    img.src = src;
                });
            };

            try {
                // Try direct load with crossOrigin and cache-busting for Supabase
                const cacheBuster = url.includes('supabase.co') ? (url.includes('?') ? '&' : '?') + `t=${Date.now()}` : '';
                resolve(await tryLoad(url + cacheBuster));
            } catch (e) {
                try {
                    // Fallback to weserv.nl proxy - very reliable for images
                    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${maxWidth}&output=jpg&q=${Math.round(quality * 100)}`;
                    resolve(await tryLoad(proxyUrl, true));
                } catch (e2) {
                    try {
                        // All-origins fallback
                        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                        resolve(await tryLoad(proxyUrl, true));
                    } catch (e3) {
                        console.warn('Compression failed all methods, using original', url);
                        resolve(url);
                    }
                }
            }
        } catch (err) {
            console.error('Compression error:', err);
            resolve(url);
        }
    });
};

const urlToBase64 = async (url: string, compress: boolean = false): Promise<string> => {
    if (!url) return '';
    if (compress) return await compressImageForPdf(url);
    if (url.startsWith('data:')) return url;

    const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const fetchImage = async (targetUrl: string, useCors: boolean = true): Promise<string> => {
        const options: RequestInit = { cache: 'no-store' };
        if (useCors) options.mode = 'cors';
        
        const response = await fetch(targetUrl, options);
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
        // Direct attempt with cache-busting
        const cacheBuster = url.includes('supabase.co') ? (url.includes('?') ? '&' : '?') + `t=${Date.now()}` : '';
        return await fetchImage(url + cacheBuster);
    } catch (e1) {
        try {
            // Weserv.nl proxy - more reliable
            return await fetchImage(`https://images.weserv.nl/?url=${encodeURIComponent(url)}`, false);
        } catch (e2) {
            try {
                // Allorigins fallback
                return await fetchImage(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, false);
            } catch (e3) {
                console.warn(`Failed to convert image: ${url}. Using fallback.`);
                return FALLBACK_IMAGE;
            }
        }
    }
};

const formatArabicDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = days[date.getDay()];
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;
    return `${year}/${month}/${day} يوم ${dayName} الساعة ${hours}:${minutes} ${ampm}`;
};

const PrintReport: React.FC = () => {
    const { 
        selectedRequestId, requests, clients, cars, carMakes, 
        carModels, inspectionTypes, setPage, predefinedFindings, 
        customFindingCategories, settings, addNotification, goBack,
        fetchAndUpdateSingleRequest, updateRequest, uploadImage, deleteImage, authUser, technicians, employees, sendWhatsAppMessage
    } = useAppContext();

    const reportRef = useRef<HTMLDivElement>(null);
    const originalRequest = requests.find(r => r.id === selectedRequestId);
    
    // Translation State
    const [translatedRequest, setTranslatedRequest] = useState<InspectionRequest | null>(null);
    const [translatedSettings, setTranslatedSettings] = useState<ReportSettings | null>(null);
    const [translatedCategories, setTranslatedCategories] = useState<CustomFindingCategory[] | null>(null);
    const [reportDirection, setReportDirection] = useState<'rtl' | 'ltr'>('rtl');
    const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);

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
    const [isExtractingPdf, setIsExtractingPdf] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    // Delete Confirmation Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteTargetFile, setDeleteTargetFile] = useState<{ data: string, type: string } | null>(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');

    const [isDataReady, setIsDataReady] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [loadingState, setLoadingState] = useState('');
    const [previewScale, setPreviewScale] = useState(1);
    const [uploadStats, setUploadStats] = useState<{ original: string; compressed: string; savings: number } | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    
    // Check if coming from print button to hide back button
    const searchParams = new URLSearchParams(window.location.search);
    const fromPrint = searchParams.get('from') === 'print';

    // Prevent back navigation if fromPrint is true
    useEffect(() => {
        if (fromPrint) {
            window.history.pushState(null, '', window.location.href);
            const handlePopState = () => {
                window.history.pushState(null, '', window.location.href);
                addNotification({ 
                    title: 'تنبيه', 
                    message: 'يرجى إغلاق هذه الصفحة بدلاً من الرجوع.', 
                    type: 'info' 
                });
            };
            window.addEventListener('popstate', handlePopState);
            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, [fromPrint, addNotification]);

    // Prevent page closure during WhatsApp sending
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isSendingWhatsApp) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isSendingWhatsApp]);

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

    // --- Upload Handlers ---
    const handleUploadClick = (type: 'manual_paper' | 'internal_draft') => {
        setCurrentUploadType(type);
        setIsSourceChoiceModalOpen(true);
    };

    const processFiles = async (files: File[], type: string, source: 'image' | 'pdf' = 'image') => {
        if (!originalRequest) return;
        setIsUploading(true);
        setUploadStats(null);
        let totalOriginalSize = 0;
        let totalOptimizedSize = 0;

        try {
            const newAttachments = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                totalOriginalSize += file.size;

                let optimizedFile = file;
                
                // Don't optimize already scanned files, but optimize direct uploads
                if (!file.name.startsWith('scanned_')) {
                     // Pass true for grayscale only if internal draft
                     const shouldGrayscale = type === 'internal_draft';
                     optimizedFile = await optimizeDocumentImage(file, shouldGrayscale);
                }

                totalOptimizedSize += optimizedFile.size;

                let folder = 'drafts';
                let prefix = 'Draft';

                if (source === 'pdf') {
                    folder = 'pdf_extracts';
                    prefix = 'PDF-Extract';
                } else if (type === 'manual_paper') {
                    folder = 'colored_attachments';
                    prefix = 'Colored';
                } else if (type === 'internal_draft') {
                    folder = 'drafts';
                    prefix = 'Draft';
                }

                const timestamp = Date.now();
                const customFileName = `Req-${originalRequest.request_number}_${prefix}_${timestamp}_${i+1}`;
                const publicUrl = await uploadImage(optimizedFile, 'attached_files', folder, customFileName); 
                
                newAttachments.push({
                    name: customFileName + '.jpg',
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

            const savings = totalOriginalSize > 0 ? Math.round(((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100) : 0;
            
            setUploadStats({
                original: (totalOriginalSize / 1024 / 1024).toFixed(2) + ' MB',
                compressed: (totalOptimizedSize / 1024 / 1024).toFixed(2) + ' MB',
                savings: savings
            });
            
            const msg = type === 'internal_draft' ? 'تم حفظ المسودة الداخلية.' : 'تمت الأرشفة بنجاح.';
            addNotification({ title: 'تم الحفظ', message: msg, type: 'success' });
            
            // Switch tab to show the new files
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
    
    const extractPdfPages = async (file: File): Promise<File[]> => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;
            const extractedFiles: File[] = [];

            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                // Scale 1.5 usually gives a good balance between quality and size
                const viewport = page.getViewport({ scale: 1.5 });
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Canvas context not available');

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport,
                    canvas: canvas
                };

                await page.render(renderContext).promise;

                const blob = await new Promise<Blob | null>((resolve) => {
                    // Compress to JPEG with 0.7 quality to keep size small
                    canvas.toBlob(resolve, 'image/jpeg', 0.7);
                });

                if (blob) {
                    const fileName = `${file.name.replace(/\.[^/.]+$/, "")}_page_${i}.jpg`;
                    extractedFiles.push(new File([blob], fileName, { type: 'image/jpeg' }));
                }
            }
            return extractedFiles;
        } catch (error) {
            console.error("Error extracting PDF pages:", error);
            throw error;
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !originalRequest) return;
        const files: File[] = Array.from(e.target.files);

        // Check if there's a PDF file
        const pdfFiles = files.filter(f => f.type === 'application/pdf');
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        if (pdfFiles.length > 0) {
            setIsExtractingPdf(true);
            try {
                let allExtractedImages: File[] = [...imageFiles];
                for (const pdfFile of pdfFiles) {
                    const extracted = await extractPdfPages(pdfFile);
                    allExtractedImages = [...allExtractedImages, ...extracted];
                }
                
                if (allExtractedImages.length > 0) {
                    processFiles(allExtractedImages, currentUploadType, 'pdf');
                }
            } catch (error) {
                addNotification({ title: 'خطأ', message: 'حدث خطأ أثناء استخراج صفحات PDF.', type: 'error' });
            } finally {
                setIsExtractingPdf(false);
                e.target.value = ''; // Reset input
            }
            return;
        }

        // Single image goes to scanner to allow cropping/adjusting
        if (imageFiles.length === 1) {
             setScannerFile(imageFiles[0]);
             setIsScannerOpen(true);
             e.target.value = '';
             return;
        }

        // Multiple files processed directly
        if (imageFiles.length > 0) {
            processFiles(imageFiles, currentUploadType);
        }
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

    const initiateDelete = (file: { data: string, type: string }) => {
        setDeleteTargetFile(file);
        setDeletePassword('');
        setDeleteError('');
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!originalRequest || !deleteTargetFile) return;

        if (deleteTargetFile.type === 'internal_draft') {
            if (deletePassword !== originalRequest.request_number.toString()) {
                setDeleteError('كلمة المرور غير صحيحة.');
                return;
            }
        }

        try {
            await deleteImage(deleteTargetFile.data);
            const updatedFiles = (originalRequest.attached_files || []).filter(f => f.data !== deleteTargetFile.data);
            await updateRequest({
                id: originalRequest.id,
                attached_files: updatedFiles
            });
             addNotification({ title: 'تم الحذف', message: 'تم حذف الصفحة.', type: 'info' });
             setIsDeleteModalOpen(false);
             setDeleteTargetFile(null);
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

    const handleSaveAiAnalysis = async (analysis: string) => {
        if (!originalRequest) return;
        await updateRequest({
            id: originalRequest.id,
            ai_analysis: analysis
        });
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

            const coloredSpans = clone.querySelectorAll('.highlighted-note');
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
                .print-clone .finding-text-wrapper { order: 2 !important; position: static !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; width: 98% !important; background-color: transparent !important; border: none !important; padding: 0 !important; min-height: 50px !important; overflow: visible !important; }
                .print-clone .finding-text-wrapper h4 { position: relative !important; z-index: 10 !important; background-color: #ffffff !important; border: 1px solid #cbd5e1 !important; border-radius: 12px !important; padding: 2px 10px !important; box-shadow: 0 2px 3px rgba(0,0,0,0.05) !important; margin: 0 !important; margin-bottom: -12px !important; top: -3mm !important; font-size: 10px !important; color: #1e293b !important; font-weight: bold !important; text-align: center !important; width: 95% !important; white-space: normal !important; line-height: 1.3 !important; min-height: 18px !important; }
                .print-clone .finding-text-wrapper p { position: relative !important; z-index: 5 !important; background-color: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 6px !important; padding: 14px 8px 4px 8px !important; margin: 0 !important; width: 100% !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important; color: #334155 !important; white-space: normal !important; line-height: 1.4 !important; }
                .print-clone .finding-content { display: contents !important; }
                .print-clone .info-block { top: 2px !important; position: relative !important; }
                .print-clone .finding-category h3 { top: -4px !important; position: relative !important; }
                .print-clone .highlighted-note { position: relative !important; display: inline-block !important; top: -1px !important; padding: 0 4px !important; line-height: 1.4 !important; }
                .print-clone img { object-fit: contain !important; }
                .print-clone .target-logo { height: 90px !important; width: auto !important; }
                .print-clone .target-car-logo img { height: 60px !important; width: auto !important; }
                .print-clone .flex-row-reverse { flex-direction: ${reportDirection === 'rtl' ? 'row-reverse' : 'row'} !important; }
                .print-clone .image-note-card { border-width: 1.5px !important; border-color: #cbd5e1 !important; }
                .print-clone .image-note-category { font-size: 11px !important; font-weight: 800 !important; margin-bottom: 2px !important; font-family: 'Tajawal', sans-serif !important; }
                .print-clone .image-note-text { font-size: 12px !important; line-height: 1.4 !important; font-weight: 500 !important; color: #000000 !important; font-family: 'Tajawal', sans-serif !important; padding-top: 2px !important; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
            `;
            clone.appendChild(style);
            clone.classList.add('print-clone');

            // Add generation info to the footer of the clone
            const footerDisclaimer = clone.querySelector('[data-setting-section="text-disclaimer"]');
            if (footerDisclaimer && footerDisclaimer.parentElement) {
                const infoLine = document.createElement('div');
                infoLine.style.cssText = `
                    font-size: 8px; 
                    color: #94a3b8; 
                    margin-top: 6px; 
                    border-top: 0.5px solid #e2e8f0; 
                    padding-top: 4px; 
                    display: flex; 
                    gap: 15px; 
                    flex-direction: ${reportDirection === 'ltr' ? 'row' : 'row-reverse'};
                `;
                
                const userLabel = reportDirection === 'ltr' ? 'Downloaded by: ' : 'تم تحميل التقرير بواسطة: ';
                const userName = authUser?.name || '';
                const timeLabel = reportDirection === 'ltr' ? 'Date: ' : 'التاريخ والوقت: ';
                const timeValue = reportDirection === 'ltr' ? new Date().toLocaleString('en-US') : formatArabicDateTime(new Date());
                
                infoLine.innerHTML = `
                    <div style="display: flex; gap: 4px; flex-direction: ${reportDirection === 'ltr' ? 'row' : 'row-reverse'};">
                        <span>${userLabel}</span>
                        <span style="font-weight: 700 !important; color: #64748b;">${userName}</span>
                    </div>
                    <span>${timeLabel}${timeValue}</span>
                `;
                footerDisclaimer.parentElement.appendChild(infoLine);
            }

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
                useCORS: true, allowTaint: true, logging: false, scale: 3, windowWidth: 794, width: 794,
                scrollY: 0, scrollX: 0, x: 0, y: 0, backgroundColor: '#ffffff',
                onclone: (doc: Document) => { const el = doc.querySelector('.print-clone') as HTMLElement; if(el) el.style.transform = 'none'; }
            }) as HTMLCanvasElement;

            document.body.removeChild(clone);
            setLoadingState('جاري إنشاء ملف PDF...');

            const { jsPDF } = (window as any).jspdf;
            const imgData = canvas.toDataURL('image/jpeg', 0.98);
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

                        pdf.addImage(imgBase64, 'JPEG', x, y, finalW, finalH, undefined, 'FAST');
                        
                    } catch (err) {
                        console.error(`Failed to add attachment ${file.name} to PDF`, err);
                    }
                }
            }
            // -----------------------------------------------------
            
            return pdf;
        } catch(e: any) {
            addNotification({ title: 'خطأ', message: 'فشل إنشاء الملف.', type: 'error' });
            return null;
        } finally {
            setIsGenerating(false); setLoadingState('');
        }
    };

    const getPdfFilename = () => {
        const make = request?.car_snapshot?.make_en || carMake?.name_en || carMake?.name_ar || '';
        const model = request?.car_snapshot?.model_en || carModel?.name_en || carModel?.name_ar || '';
        const year = request?.car_snapshot?.year || car?.year || '';
        const reqNum = request?.request_number || '';
        
        if (make && model && year) {
            return `${make} ${model} ${year} Rp${reqNum}.pdf`;
        }
        return `Report_${reqNum}.pdf`;
    };

    const generateNativePdfBlob = async (): Promise<Blob | null> => {
        if (!request || !client || !car || !inspectionType) return null;
        
        setIsGenerating(true);
        setLoadingState('جاري تجهيز البيانات...');

        try {
            // 1. Capture QR Code if exists
            let qrCodeBase64 = undefined;
            const qrCanvas = document.querySelector('.target-qr canvas') as HTMLCanvasElement;
            if (qrCanvas) {
                qrCodeBase64 = qrCanvas.toDataURL('image/png');
            }

            setLoadingState('جاري معالجة الصور...');
            
            // 2. Prepare attachments (excluding internal drafts)
            const validAttachments = (originalRequest?.attached_files || []).filter(f => f.type !== 'internal_draft');
            
            // 3. Convert all essential images to base64 with compression to reduce PDF size
            const processImage = async (url: string, shouldCompress: boolean = true) => {
                if (!url) return undefined;
                try {
                    return await urlToBase64(url, shouldCompress);
                } catch (e) {
                    console.warn('Failed to process image for PDF:', url);
                    return url;
                }
            };

            const [logoBase64, carLogoBase64, stampBase64] = await Promise.all([
                processImage(reportSettings.reportLogoUrl || '', true),
                processImage(carMake?.logo_url || '', true),
                processImage(reportSettings.workshopStampUrl || '', true)
            ]);

            // Process finding images (if any were added to the PDF component)
            setLoadingState('جاري ضغط صور الفحص...');
            const usedFindingIds = new Set(request.structured_findings?.map(f => f.findingId) || []);
            const processedPredefinedFindings = await Promise.all(predefinedFindings.map(async pf => {
                if (usedFindingIds.has(pf.id) && pf.reference_image) {
                    const base64 = await processImage(pf.reference_image, true);
                    return { ...pf, reference_image: base64 };
                }
                return pf;
            }));
            
            // Process note images
            const processedGeneralNotes = await Promise.all(((request.general_notes as Note[]) || []).map(async n => {
                if (n.image) {
                    const base64 = await processImage(n.image, true);
                    return { ...n, image: base64 };
                }
                return n;
            }));

            const processedCategoryNotes = { ...request.category_notes };
            for (const catId in processedCategoryNotes) {
                const notes = processedCategoryNotes[catId] as Note[];
                if (notes) {
                    processedCategoryNotes[catId] = await Promise.all(notes.map(async n => {
                        if (n.image) {
                            const base64 = await processImage(n.image, true);
                            return { ...n, image: base64 };
                        }
                        return n;
                    }));
                }
            }

            // Process attachments - these are usually the biggest part of the file size
            setLoadingState('جاري ضغط المرفقات...');
            const processedAttachments = await Promise.all(validAttachments.map(async (file) => {
                const base64 = await processImage(file.data, true);
                return { ...file, data: base64 || file.data };
            }));

            setLoadingState('جاري توليد ملف PDF...');

            const blob = await pdf(
                <OrderPdf 
                    request={{
                        ...request,
                        general_notes: processedGeneralNotes,
                        category_notes: processedCategoryNotes
                    }}
                    client={client}
                    car={car}
                    carMake={carMake ? { ...carMake, logo_url: carLogoBase64 || carMake.logo_url } : undefined}
                    carModel={carModel}
                    inspectionType={inspectionType}
                    customFindingCategories={effectiveCategories}
                    predefinedFindings={processedPredefinedFindings}
                    settings={{
                        ...settings,
                        reportSettings: {
                            ...reportSettings,
                            reportLogoUrl: logoBase64 || null,
                            workshopStampUrl: stampBase64 || null
                        }
                    }}
                    reportDirection={reportDirection}
                    qrCodeBase64={qrCodeBase64}
                    attachments={processedAttachments}
                    downloadedBy={authUser?.name}
                    downloadDateTime={reportDirection === 'ltr' ? new Date().toLocaleString('en-US') : formatArabicDateTime(new Date())}
                    technicians={technicians}
                    employees={employees}
                />
            ).toBlob();

            return blob;
        } catch (error: any) {
            console.error('Native PDF Generation Error:', error);
            addNotification({ title: 'خطأ', message: 'فشل إنشاء ملف PDF.', type: 'error' });
            return null;
        } finally {
            setIsGenerating(false);
            setLoadingState('');
        }
    };

    const uploadReportToStorage = async (blob: Blob): Promise<string> => {
        setLoadingState('جاري الرفع إلى الأرشيف...');
        const pdfFilename = getPdfFilename();
        const customNameWithoutExt = pdfFilename.replace(/\.pdf$/, '');
        const file = new File([blob], pdfFilename, { type: 'application/pdf' });
        const publicUrl = await uploadImage(file, 'reports', undefined, customNameWithoutExt);
        
        // Only update the database if we are NOT in translation mode
        if (originalRequest && !translatedRequest) { 
            await updateRequest({ 
                id: originalRequest.id, 
                report_url: publicUrl, 
                report_generated_at: new Date().toISOString() 
            });
        }
        return publicUrl;
    };

    const handleWhatsAppShare = async () => {
        if (!client?.phone) { addNotification({ title: 'بيانات ناقصة', message: 'رقم هاتف العميل غير متوفر.', type: 'warning' }); return; }
        if (isSendingWhatsApp) return;

        setIsSendingWhatsApp(true);
        try {
            // --- OPTIMIZATION: Check if we can reuse an existing report ---
            // Only reuse if:
            // 1. We have a report_url and report_generated_at
            // 2. We are NOT in translation mode (translated reports are temporary/different)
            // 3. The report was generated AFTER the last update to the request
            if (originalRequest?.report_url && originalRequest?.report_generated_at && !translatedRequest) {
                const generatedAt = new Date(originalRequest.report_generated_at).getTime();
                const updatedAt = originalRequest.updated_at ? new Date(originalRequest.updated_at).getTime() : 0;
                
                // If generated after last update, verify the link is still valid
                if (generatedAt > updatedAt) {
                    try {
                        // Attempt a HEAD request to check if the file exists
                        const response = await fetch(originalRequest.report_url, { method: 'HEAD' });
                        if (response.ok) {
                            // File exists, reuse the link
                            await openWhatsapp(originalRequest.report_url);
                            return;
                        } else {
                            console.log("Existing report URL returned non-OK status. Generating a new one.");
                        }
                    } catch (fetchError) {
                        // If fetch fails (e.g., CORS, network error, or file deleted), assume it's invalid and generate a new one
                        console.log("Could not verify existing report URL. Generating a new one.", fetchError);
                    }
                }
            }

            // Otherwise, generate a new one
            const blob = await generateNativePdfBlob();
            if (!blob) return;
            
            const publicUrl = await uploadReportToStorage(blob);
            await openWhatsapp(publicUrl);
        } catch (error: any) { 
            console.error('WhatsApp Share Error:', error);
            addNotification({ title: 'خطأ', message: 'فشل الإرسال.', type: 'error' }); 
        } finally {
            setLoadingState('');
            setIsSendingWhatsApp(false);
        }
    };

    const openWhatsapp = async (link: string) => {
        let phone = client?.phone.replace(/\D/g, '') || ''; 
        if (phone.startsWith('05')) phone = '966' + phone.substring(1);
        else if (phone.length === 9 && phone.startsWith('5')) phone = '966' + phone;

        const clientNameRaw = client?.name || 'العميل';
        const clientNameFormatted = `*${clientNameRaw}*`;
        const carInfo = `*${carMake?.name_ar || carMake?.name_en || ''} ${carModel?.name_ar || carModel?.name_en || ''} ${car?.year || ''}*`.trim();
        const workshopName = `*${settings.appName}*`;
        const reviewLink = reportSettings.qrCodeContent || settings.googleMapsLink || '';

        const message = `تحية طيبة، السيد/ة ${clientNameFormatted} المحترم/ة،\n\nنود إفادتكم بصدور تقرير الفحص الفني لمركبتكم ${carInfo}. يمكنكم استعراض التفاصيل الكاملة من خلال الرابط:\n🔗 ${link}\n\nنسعى دوماً لتقديم أفضل تجربة لعملائنا، لذا تهمنا مشاركتكم لتقييم الخدمة عبر الرابط التالي:\n⭐ ${reviewLink}\n\nمع خالص التقدير، إدارة وفريق ${workshopName}`;
        
        await sendWhatsAppMessage(phone, message, clientNameRaw);
    };

    const handleDownloadPdf = async () => {
        const pdf = await generatePdfInstance();
        if (pdf) pdf.save(getPdfFilename());
    };

    const handleDownloadNativePdf = async () => {
        try {
            const blob = await generateNativePdfBlob();
            if (!blob) return;

            // Also upload to storage if it doesn't exist yet to keep archive in sync
            if (!originalRequest?.report_url) {
                await uploadReportToStorage(blob);
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = getPdfFilename();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            addNotification({ title: 'تم بنجاح', message: 'تم تحميل التقرير وأرشفته في السيرفر.', type: 'success' });
        } catch (error) {
            console.error('Download error:', error);
            addNotification({ title: 'خطأ', message: 'فشل تحميل التقرير.', type: 'error' });
        } finally {
            setLoadingState('');
        }
    };

    if (!request || !isDataReady) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-4">
                <RefreshCwIcon className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" />
                <p className="text-xl text-gray-700 dark:text-gray-300">{ request ? 'جاري تحميل بيانات التقرير...' : 'لم يتم العثور على الطلب.' }</p>
                { !request && (
                    fromPrint ? (
                        <Button onClick={() => window.close()} className="mt-4 bg-slate-100 text-slate-700 hover:bg-slate-200">إغلاق الصفحة</Button>
                    ) : (
                        <Button onClick={() => setPage('requests')} className="mt-4">العودة</Button>
                    )
                ) }
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 min-h-screen flex flex-col print:!bg-white print:!min-h-0 print:!border-none">
            <header className="no-print bg-white dark:bg-slate-800 p-4 shadow-md flex justify-between items-center sticky top-0 z-50">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    معاينة التقرير
                    {translatedRequest && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full border border-purple-200">مترجم (مؤقت)</span>}
                </h2>
                <div className="flex gap-2">
                    {!fromPrint && (
                        <Button variant="secondary" onClick={isSendingWhatsApp ? undefined : goBack} size="sm" disabled={isGenerating || isSendingWhatsApp}>
                            <Icon name="back" className="w-4 h-4 transform scale-x-[-1]" />
                            <span className="hidden sm:inline ms-1">العودة</span>
                        </Button>
                    )}
                    {fromPrint && (
                        <Button variant="secondary" onClick={isSendingWhatsApp ? undefined : () => window.close()} size="sm" className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100" disabled={isSendingWhatsApp}>
                            <Icon name="close" className="w-4 h-4" />
                            <span className="hidden sm:inline ms-1">إغلاق الصفحة</span>
                        </Button>
                    )}
                    
                    <Button
                        variant="secondary"
                        onClick={() => !isSendingWhatsApp && setIsPaperModalOpen(true)}
                        size="sm"
                        className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                        disabled={isSendingWhatsApp}
                    >
                        <Icon name="folder-open" className="w-4 h-4" />
                        <span className="hidden sm:inline ms-1">المرفقات ({paperImages.length})</span>
                    </Button>

                    <Button onClick={() => setIsAiModalOpen(true)} variant="secondary" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                        <SparklesIcon className="w-4 h-4" />
                        <span className="hidden sm:inline ms-1">تحليل التقرير</span>
                    </Button>

                    {translatedRequest ? (
                        <Button onClick={handleClearTranslation} variant="secondary" size="sm" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" disabled={isSendingWhatsApp}>
                            <Icon name="refresh-cw" className="w-4 h-4" />
                            <span className="hidden sm:inline ms-1">إلغاء الترجمة</span>
                        </Button>
                    ) : (
                        <Button onClick={() => setIsTranslationModalOpen(true)} variant="secondary" size="sm" className="text-purple-600 border-purple-200 hover:bg-purple-50" disabled={isSendingWhatsApp}>
                            <SparklesIcon className="w-4 h-4" />
                            <span className="hidden sm:inline ms-1">ترجمة التقرير</span>
                        </Button>
                    )}

                    <Button onClick={handleWhatsAppShare} variant="whatsapp" size="sm" disabled={isGenerating || isSendingWhatsApp} className={isSendingWhatsApp ? 'opacity-90' : ''}>
                        {isSendingWhatsApp ? (
                            <RefreshCwIcon className="w-4 h-4 animate-spin" />
                        ) : (
                            <WhatsappIcon className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline ms-1">{isSendingWhatsApp ? 'جاري الإرسال...' : 'إرسال واتساب'}</span>
                    </Button>
                     <Button variant="secondary" onClick={handlePrint} size="sm" disabled={isGenerating || isSendingWhatsApp}>
                        <Icon name="print" className="w-4 h-4" />
                        <span className="hidden sm:inline ms-1">طباعة</span>
                    </Button>
                    <Button onClick={handleDownloadNativePdf} size="sm" disabled={isGenerating || isSendingWhatsApp}>
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
            
            <main className="flex-1 bg-gray-200 dark:bg-gray-900/50 py-8 overflow-auto print-container print:!py-0 print:!bg-white print:overflow-visible print:!px-0 print:!mx-0 print:!border-none" dir={reportDirection}>
                <div className="flex justify-center w-full min-h-full print:block print:w-full print:h-auto print:!m-0 print:!p-0 print:!bg-white print:!border-none">
                    <div className="origin-top transition-transform duration-200 print:transform-none print:!m-0 print:!p-0 print:!bg-white print:!border-none" style={{ transform: `scale(${previewScale})`, marginBottom: `-${(1 - previewScale) * 100}%` }}>
                        <div className="report-wrapper bg-white shadow-2xl print:shadow-none mx-auto overflow-hidden print:overflow-visible print:h-auto print:min-h-0 print:w-full print:max-w-none print:!m-0 print:!p-0 print:!bg-white print:!border-none print:!ring-0" style={{ width: '210mm', minHeight: '297mm' }}>
                            { client && car && inspectionType ?
                                <>
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
                                    {publicImages.length > 0 && (
                                        <div className="w-full mt-4 border-t-2 border-slate-200 pt-8 print:break-before-page p-4">
                                            <h3 className="text-xl font-bold mb-4 text-slate-800 print:hidden" style={{ fontFamily: reportSettings.fontFamily }}>
                                                المرفقات ({publicImages.length})
                                            </h3>
                                            <div className="flex flex-col gap-4">
                                                {publicImages.map((file, idx) => (
                                                    <div key={idx} className="w-full break-inside-avoid mb-4">
                                                        <img src={file.data} alt={`Attachment ${idx + 1}`} className="w-full h-auto object-contain border rounded-lg" style={{ maxHeight: '290mm' }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
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

            {originalRequest && (
                <AiAnalysisModal
                    isOpen={isAiModalOpen}
                    onClose={() => setIsAiModalOpen(false)}
                    request={originalRequest}
                    categories={customFindingCategories}
                    predefinedFindings={predefinedFindings}
                    apiKey={settings.geminiApiKey}
                    addNotification={addNotification}
                    onSave={handleSaveAiAnalysis}
                />
            )}

            {/* Paper Archive Viewer & Manager Modal */}
            <Modal isOpen={isPaperModalOpen} onClose={() => setIsPaperModalOpen(false)} title="أرشيف الطلب (المرفقات)" size="4xl">
                <div className="flex flex-col h-[85vh] md:h-[70vh]">
                    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-700 p-4 overflow-hidden">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center mb-3 flex-shrink-0">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Icon name="gallery" className="w-4 h-4" /> الصفحات المحفوظة ({displayedImages.length})
                            </h4>
                            {isLoadingDetails && (
                                <div className="text-xs text-blue-500 flex items-center gap-1 animate-pulse">
                                    <RefreshCwIcon className="w-3 h-3 animate-spin"/>
                                    جاري التحديث...
                                </div>
                            )}
                        </div>
                        
                        {/* Tabs */}
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

                        {/* NEW: Contextual Actions Toolbar */}
                        <div className="mb-4 flex flex-col gap-3">
                            {isExtractingPdf && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg animate-pulse flex items-center justify-center gap-3">
                                    <RefreshCwIcon className="w-5 h-5 text-blue-600 animate-spin" />
                                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">جاري استخراج الصفحات من ملف PDF...</span>
                                </div>
                            )}
                            {activeArchiveTab === 'public' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleUploadClick('manual_paper')} disabled={isUploading || isExtractingPdf} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                        <UploadIcon className="w-5 h-5" />
                                        <span className="font-bold text-sm">إضافة مرفق جديد (ملون)</span>
                                    </button>
                                    <button 
                                        onClick={() => { setCurrentUploadType('manual_paper'); pdfInputRef.current?.click(); }} 
                                        disabled={isUploading || isExtractingPdf}
                                        className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                        title="رفع ملف PDF"
                                    >
                                        <Icon name="document-report" className="w-5 h-5" />
                                        <span className="font-bold text-sm hidden sm:inline">رفع PDF</span>
                                    </button>
                                </div>
                            )}
                            
                            {activeArchiveTab === 'internal' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleUploadClick('internal_draft')} disabled={isUploading || isExtractingPdf} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800">
                                        <Icon name="edit" className="w-5 h-5" />
                                        <span className="font-bold text-sm">إضافة مسودة (داخلي)</span>
                                    </button>
                                    <button 
                                        onClick={() => { setCurrentUploadType('internal_draft'); pdfInputRef.current?.click(); }} 
                                        disabled={isUploading || isExtractingPdf}
                                        className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                        title="رفع ملف PDF"
                                    >
                                        <Icon name="document-report" className="w-5 h-5" />
                                        <span className="font-bold text-sm hidden sm:inline">رفع PDF</span>
                                    </button>
                                </div>
                            )}

                            {activeArchiveTab === 'all' && (
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center text-slate-500 text-sm">
                                    يرجى اختيار تبويب "مرفقات التقرير" أو "مسودات داخلية" لإضافة ملفات جديدة.
                                </div>
                            )}

                            {/* Upload Stats */}
                            {uploadStats && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-fade-in shadow-sm flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <CheckCircleIcon className="w-4 h-4 text-green-600"/>
                                        <span className="text-xs font-bold text-green-700 dark:text-green-300">تم الرفع بنجاح (توفير {uploadStats.savings}%)</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        {uploadStats.original} ➜ <span className="font-bold text-green-600">{uploadStats.compressed}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Gallery Grid */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                            {displayedImages.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {displayedImages.map((file, idx) => (
                                        <div key={file.data || idx} className="relative group rounded-lg overflow-hidden border dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm aspect-[3/4]">
                                            <img src={file.data} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <a href={file.data} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-full text-slate-800 hover:bg-blue-50 transition-colors">
                                                    <Icon name="eye" className="w-4 h-4" />
                                                </a>
                                                <button onClick={() => initiateDelete(file)} className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] p-1 text-center truncate">
                                                {file.name}
                                                {file.type === 'internal_draft' && <span className="block text-[8px] text-yellow-300">(مسودة)</span>}
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
                    
                    <div className="pt-4 mt-4 border-t dark:border-slate-700 flex justify-end flex-shrink-0">
                        <Button variant="secondary" onClick={() => setIsPaperModalOpen(false)}>إغلاق</Button>
                    </div>
                </div>
            </Modal>
            
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelected} className="hidden" />
            <input ref={pdfInputRef} type="file" accept="application/pdf" multiple onChange={handleFileSelected} className="hidden" />

            <Modal isOpen={isSourceChoiceModalOpen} onClose={() => setIsSourceChoiceModalOpen(false)} title="اختر مصدر الصورة" size="sm">
                <div className="p-4 flex flex-col gap-4">
                    <Button onClick={() => { setIsSourceChoiceModalOpen(false); setIsCameraOpen(true); }} className="w-full py-4 text-lg justify-center" variant="secondary" leftIcon={<CameraIcon className="w-6 h-6"/>}>
                        من الكاميرا
                    </Button>
                    <Button onClick={() => { setIsSourceChoiceModalOpen(false); fileInputRef.current?.click(); }} className="w-full py-4 text-lg justify-center" variant="secondary" leftIcon={<UploadIcon className="w-6 h-6"/>}>
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
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="تأكيد الحذف" size="sm">
                <div className="p-4">
                    {deleteTargetFile?.type === 'internal_draft' ? (
                        <div className="space-y-4">
                            <p className="text-slate-600 dark:text-slate-300">يرجى إدخال كلمة المرور لتأكيد الحذف.</p>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور</label>
                                <input 
                                    type="text" 
                                    value={deletePassword} 
                                    onChange={(e) => {
                                        setDeletePassword(e.target.value);
                                        setDeleteError('');
                                    }}
                                    className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-600 focus:ring-2 focus:ring-red-500 outline-none"
                                    placeholder="أدخل كلمة المرور"
                                />
                                {deleteError && <p className="text-red-500 text-xs mt-1">{deleteError}</p>}
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>إلغاء</Button>
                                <Button variant="danger" onClick={confirmDelete}>حذف المسودة</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-slate-600 dark:text-slate-300">هل أنت متأكد من حذف هذه الصفحة من الأرشيف؟ لا يمكن التراجع عن هذا الإجراء.</p>
                            <div className="flex gap-2 justify-end pt-2">
                                <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>إلغاء</Button>
                                <Button variant="danger" onClick={confirmDelete}>تأكيد الحذف</Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
            
            {/* Floating Price Card - Desktop only, hidden during print */}
            <AnimatePresence>
                <motion.div 
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="fixed top-24 left-8 z-[60] hidden lg:flex flex-col items-center gap-2 p-5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 print:hidden select-none hover:scale-105 transition-transform"
                >
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                        <Icon name="car" className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">سعر الطلب</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black text-blue-600 dark:text-blue-400 drop-shadow-sm">
                            {originalRequest?.price || 0}
                        </span>
                        <span className="text-sm font-black text-slate-500 dark:text-slate-400">ر.س</span>
                    </div>
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent my-1" />
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
                            {inspectionType?.name || 'فحص فني'}
                        </span>
                        <div className="flex items-center gap-1 text-[9px] text-slate-400">
                            <Icon name="history" className="w-3 h-3" />
                            <span>رقم الطلب: {originalRequest?.request_number}</span>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default PrintReport;
