
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../lib/supabaseClient';
import { InspectionRequest } from '../types';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import SearchIcon from '../components/icons/SearchIcon';
import FolderOpenIcon from '../components/icons/FolderOpenIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import CameraIcon from '../components/icons/CameraIcon';
import UploadIcon from '../components/icons/UploadIcon';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import XIcon from '../components/icons/XIcon';
import { SkeletonTable } from '../components/Skeleton';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import { formatBytes } from '../lib/utils';
import DocumentScannerModal from '../components/DocumentScannerModal';
import CameraPage from '../components/CameraPage';
import CustomDatePicker from '../components/CustomDatePicker';
import InAppScannerModal from '../components/InAppScannerModal';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker using Vite's ?url import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// --- Image Optimization Helper ---
const optimizeDocumentImage = async (file: File, grayscale: boolean = false): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const maxWidth = 1400; // Max width for documents - slightly increased for better clarity
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

            // Draw white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            // Apply filters based on mode
            if (grayscale) {
                ctx.filter = 'grayscale(100%) contrast(120%) brightness(105%)';
            } else {
                // Slight contrast and saturation boost for color documents to keep text popping
                ctx.filter = 'contrast(110%) saturate(110%)';
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Check for WebP support
            const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
            const format = supportsWebP ? 'image/webp' : 'image/jpeg';
            const extension = supportsWebP ? '.webp' : '.jpg';
            const quality = supportsWebP ? 0.6 : 0.7; // WebP manages quality better at lower percentages

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Blob creation failed'));
                    return;
                }
                const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + extension, { type: format });
                resolve(newFile);
            }, format, quality);
            
            URL.revokeObjectURL(img.src);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(img.src);
            reject(err);
        };
    });
};

const PaperArchive: React.FC = () => {
    const { 
        clients, 
        cars, 
        carMakes, 
        carModels, 
        can, 
        addNotification, 
        updateRequest, 
        uploadImage, 
        deleteImage,
        fetchPaperArchiveRequests,
        fetchAllPaperArchiveRequests,
        fetchRequestByRequestNumber,
        authUser,
        createActivityLog
    } = useAppContext();

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [archiveStatusFilter, setArchiveStatusFilter] = useState<'all' | 'archived' | 'not_archived'>('not_archived');
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'month' | 'custom' | 'all'>('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<InspectionRequest | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [filteredRequests, setFilteredRequests] = useState<InspectionRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadStats, setUploadStats] = useState<{ original: string; compressed: string; savings: number } | null>(null);

    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerFile, setScannerFile] = useState<File | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [activeArchiveTab, setActiveArchiveTab] = useState<'all' | 'internal' | 'colored' | 'pdf'>('all');

    const [isSourceChoiceModalOpen, setIsSourceChoiceModalOpen] = useState(false);
    const [currentUploadType, setCurrentUploadType] = useState<'manual_paper' | 'internal_draft'>('manual_paper');
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
    const [isExtractingPdf, setIsExtractingPdf] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    // Delete Confirmation Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteTargetFile, setDeleteTargetFile] = useState<{ data: string, type: string } | null>(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');

    // Debounce search query
    useEffect(() => {
        // Instant local search for speed
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            const isNumeric = /^\d+$/.test(query);
            
            setFilteredRequests(prev => {
                return prev.filter(r => {
                    const client = clients.find(c => c.id === r.client_id);
                    const car = cars.find(c => c.id === r.car_id);
                    const make = carMakes.find(m => m.id === car?.make_id);
                    const model = carModels.find(m => m.id === car?.model_id);

                    if (isNumeric) {
                        return r.request_number.toString().includes(query) || client?.phone.includes(query);
                    }

                    return (
                        client?.name.toLowerCase().includes(query) ||
                        car?.plate_number?.toLowerCase().includes(query) ||
                        car?.vin?.toLowerCase().includes(query) ||
                        make?.name_ar.toLowerCase().includes(query) ||
                        make?.name_en?.toLowerCase().includes(query) ||
                        model?.name_ar.toLowerCase().includes(query) ||
                        model?.name_en?.toLowerCase().includes(query)
                    );
                });
            });
        }

        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, clients, cars, carMakes, carModels]);

    const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table');
    const [zoomLevel, setZoomLevel] = useState(1);
    const [gallerySubFilter, setGallerySubFilter] = useState<'all' | 'drafts_only' | 'attachments_only'>('all');
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const [lightboxImages, setLightboxImages] = useState<{url: string, title: string, subTitle: string, requestId: string, file: any}[]>([]);

    const openLightbox = (images: {url: string, title: string, subTitle: string, requestId: string, file: any}[], index: number) => {
        setLightboxImages(images);
        setSelectedImageIndex(index);
        setZoomLevel(1);
    };

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.5, 4));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.5, 1));
    const resetZoom = () => setZoomLevel(1);

    // Fetch Logic
    const loadData = async () => {
        setIsLoading(true);
        try {
            // If searching, use search endpoint (client-side filter for now as per existing logic, or enhance context)
            // The user requested "Search directly from database". 
            // The existing 'fetchPaperArchiveRequests' filters by date.
            // We need a way to search globally without date constraints if a query exists.
            
            if (debouncedSearchQuery) {
                // Perform a global search using the existing searchRequestByNumber logic but adapted for this view
                // Since searchRequestByNumber updates 'searchedRequests' in context, we might want to use a local fetch here
                // to avoid messing with the global search state if possible, OR just use the global search function 
                // and map the results.
                
                // Let's use a direct supabase query here for the specific archive search requirements
                // This mirrors the logic in AppContext.tsx searchRequestByNumber but returns data directly
                
                const query = debouncedSearchQuery.trim();
                let data: InspectionRequest[] = [];

                // 1. Search by Request Number
                if (/^\d+$/.test(query)) {
                    const { data: byNum } = await supabase
                        .from('inspection_requests')
                        .select('*')
                        .eq('request_number', Number(query));
                    if (byNum) data = [...data, ...byNum];
                }

                // 2. Search by Client Name/Phone
                const { data: clientsFound } = await supabase
                    .from('clients')
                    .select('id')
                    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
                    .limit(50);
                
                if (clientsFound && clientsFound.length > 0) {
                    const clientIds = clientsFound.map(c => c.id);
                    const { data: byClient } = await supabase
                        .from('inspection_requests')
                        .select('*')
                        .in('client_id', clientIds)
                        .order('created_at', { ascending: false })
                        .limit(50);
                    if (byClient) data = [...data, ...byClient];
                }

                // 3. Search by Car (Plate/VIN) - Simplified for this view
                const { data: carsFound } = await supabase
                    .from('cars')
                    .select('id')
                    .or(`plate_number.ilike.%${query}%,plate_number_en.ilike.%${query}%,vin.ilike.%${query}%`)
                    .limit(50);

                if (carsFound && carsFound.length > 0) {
                    const carIds = carsFound.map(c => c.id);
                    const { data: byCar } = await supabase
                        .from('inspection_requests')
                        .select('*')
                        .in('car_id', carIds)
                        .order('created_at', { ascending: false })
                        .limit(50);
                    if (byCar) data = [...data, ...byCar];
                }

                // Deduplicate
                const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());
                
                // Apply Archive Filter locally since we fetched by search
                let finalData = uniqueData;
                if (archiveStatusFilter === 'archived') {
                    finalData = uniqueData.filter(r => r.attached_files?.some(f => f.type === 'internal_draft'));
                } else if (archiveStatusFilter === 'not_archived') {
                    finalData = uniqueData.filter(r => !r.attached_files?.some(f => f.type === 'internal_draft'));
                }

                setFilteredRequests(finalData);
                setIsLoading(false);
                return;
            }

            // Normal Date-based Fetch
            let data: InspectionRequest[] = [];
            if (dateFilter === 'all') {
                data = await fetchAllPaperArchiveRequests();
            } else {
                const now = new Date();
                let start = new Date();
                let end = new Date();

                switch (dateFilter) {
                    case 'today':
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);
                        break;
                    case 'yesterday':
                        start.setDate(now.getDate() - 1);
                        start.setHours(0, 0, 0, 0);
                        end.setDate(now.getDate() - 1);
                        end.setHours(23, 59, 59, 999);
                        break;
                    case 'month':
                        start = new Date(now.getFullYear(), now.getMonth(), 1);
                        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                        break;
                    case 'custom':
                        if (customStartDate && customEndDate) {
                             start = new Date(customStartDate);
                             start.setHours(0, 0, 0, 0);
                             end = new Date(customEndDate);
                             end.setHours(23, 59, 59, 999);
                        } else {
                            setIsLoading(false);
                            setFilteredRequests([]);
                            return;
                        }
                        break;
                }
                data = await fetchPaperArchiveRequests(start.toISOString(), end.toISOString());
            }

            // Apply Archive Filter
            if (archiveStatusFilter === 'archived') {
                data = data.filter(r => r.attached_files?.some(f => f.type === 'internal_draft'));
            } else if (archiveStatusFilter === 'not_archived') {
                data = data.filter(r => !r.attached_files?.some(f => f.type === 'internal_draft'));
            }

            setFilteredRequests(data);

        } catch (error) {
             console.error("Failed to load archive data", error);
             addNotification({ title: 'خطأ', message: 'فشل تحميل البيانات.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Trigger load on filter change
    useEffect(() => {
        loadData();
    }, [dateFilter, customStartDate, customEndDate, debouncedSearchQuery, archiveStatusFilter]);

    useEffect(() => {
        if (!isUploadModalOpen) {
            setUploadStats(null);
            setScannerFile(null);
            setActiveArchiveTab('all');
        }
    }, [isUploadModalOpen]);

    const displayedRequests = useMemo(() => {
        let data = filteredRequests;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(r => {
                const client = clients.find(c => c.id === r.client_id);
                const car = cars.find(c => c.id === r.car_id);
                const make = carMakes.find(m => m.id === car?.make_id);
                const model = carModels.find(m => m.id === car?.model_id);
                return (
                    r.request_number.toString().includes(q) ||
                    client?.name.toLowerCase().includes(q) ||
                    make?.name_ar.toLowerCase().includes(q) ||
                    make?.name_en.toLowerCase().includes(q) ||
                    model?.name_ar.toLowerCase().includes(q)
                );
            });
        }
        return data.sort((a, b) => b.request_number - a.request_number);
    }, [filteredRequests, searchQuery, clients, cars, carMakes, carModels]);

    const openUploadModal = async (request: InspectionRequest, autoCamera: boolean = false) => {
        setSelectedRequest(request);
        setIsUploadModalOpen(true);
        setIsLoadingDetails(true);
        
        // Check if mobile device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
        
        if (autoCamera) {
            setActiveArchiveTab('internal');
            setCurrentUploadType('internal_draft');
            setIsCameraOpen(true);
        } else {
            setActiveArchiveTab('all');
        }
        
        try {
            const freshRequest = await fetchRequestByRequestNumber(request.request_number);
            if (freshRequest) {
                setSelectedRequest(freshRequest);
                setFilteredRequests(prev => prev.map(r => r.id === freshRequest.id ? freshRequest : r));
            }
        } catch (error) {
            console.error("Failed to load request details", error);
        } finally {
            setIsLoadingDetails(false);
        }
    };
    
    const handleUploadClick = (type: 'manual_paper' | 'internal_draft') => {
        setCurrentUploadType(type);
        setIsSourceChoiceModalOpen(true);
    };

    const extractPdfPages = async (file: File): Promise<File[]> => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;
            const extractedFiles: File[] = [];

            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                // Scale 1.5 usually gives a good balance between quality and size (around 1200px width for A4)
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
        if (!e.target.files || !selectedRequest) return;
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

        // Single image goes to scanner
        if (imageFiles.length === 1) {
             setScannerFile(imageFiles[0]);
             setIsScannerOpen(true);
             e.target.value = ''; // Reset input
             return;
        }

        // Multiple files processed directly
        if (imageFiles.length > 0) {
            processFiles(imageFiles, currentUploadType);
        }
        e.target.value = ''; // Reset input
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

    const handleQRScan = async (decodedText: string) => {
        console.log("Scanner Success RAW (Archive):", decodedText);
        setIsQRScannerOpen(false);
        
        let requestNumberStr = decodedText;
        
        try {
            const url = new URL(decodedText);
            const pathParts = url.pathname.split('/');
            const numberPart = pathParts.pop();
            if (numberPart && /^\d+$/.test(numberPart)) {
                requestNumberStr = numberPart;
            }
        } catch (e) {
            // Not a URL, try to find a number at the end or just use the whole string
            const match = decodedText.match(/\d+$/);
            if (match) {
                requestNumberStr = match[0];
            }
        }

        const requestNumber = parseInt(requestNumberStr);
        console.log("Parsed Archive Request Number:", requestNumber);

        if (isNaN(requestNumber)) {
            addNotification({ title: 'خطأ', message: 'لم يتم العثور على رقم طلب صالح في الكود.', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const req = await fetchRequestByRequestNumber(requestNumber);
            if (req) {
                openUploadModal(req, true);
                addNotification({ title: 'نجاح', message: `تم العثور على الطلب #${requestNumber}`, type: 'success' });
            } else {
                addNotification({ title: 'تنبيه', message: `الطلب رقم #${requestNumber} غير موجود.`, type: 'warning' });
            }
        } catch (error) {
            console.error("Error fetching request by QR:", error);
            addNotification({ title: 'خطأ', message: 'حدث خطأ أثناء البحث عن الطلب.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const processFiles = async (files: File[], type: string, source: 'image' | 'pdf' = 'image') => {
        if (!selectedRequest) return;
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
                if (!file.name.startsWith('scanned_')) {
                     // Color by default for all archive types as requested
                     optimizedFile = await optimizeDocumentImage(file, false);
                }
                
                totalOptimizedSize += optimizedFile.size;

                let folder = 'drafts';
                let prefix = 'Draft';
                let finalType = type;

                if (source === 'pdf') {
                    folder = 'pdf_extracts';
                    prefix = 'PDF-Page';
                    finalType = 'pdf_page';
                } else if (type === 'manual_paper') {
                    folder = 'colored_attachments';
                    prefix = 'Colored';
                } else if (type === 'internal_draft') {
                    folder = 'drafts';
                    prefix = 'Draft';
                }

                const timestamp = Date.now();
                const extension = optimizedFile.type.split('/')[1] === 'webp' ? '.webp' : '.jpg';
                const customFileName = `Req-${selectedRequest.request_number}_${prefix}_${timestamp}_${i+1}`;
                const publicUrl = await uploadImage(optimizedFile, 'attached_files', folder, customFileName); 
                
                newAttachments.push({
                    name: customFileName + extension,
                    type: finalType,
                    data: publicUrl,
                    archived_by_name: authUser?.name || 'مجهول',
                    archived_at: new Date().toISOString()
                });
            }

            const existingFiles = selectedRequest.attached_files || [];
            const updatedFiles = [...existingFiles, ...newAttachments];
            
            const newLog = createActivityLog(
                'أرشفة ورقيات',
                `تم رفع ${files.length} ملفات للأرشفة للطلب #${selectedRequest.request_number}`,
                undefined,
                selectedRequest.id,
                'paper-archive'
            );
            const updatedLog = newLog ? [newLog, ...(selectedRequest.activity_log || [])] : (selectedRequest.activity_log || []);

            await updateRequest({
                id: selectedRequest.id,
                attached_files: updatedFiles,
                activity_log: updatedLog
            });

            setSelectedRequest(prev => prev ? ({ ...prev, attached_files: updatedFiles, activity_log: updatedLog }) : null);
            
            // Auto-update UI based on filters: if "Not Archived" filter is active and we just archived it, remove from list
            if (archiveStatusFilter === 'not_archived' && updatedFiles.some(f => f.type === 'internal_draft')) {
                setFilteredRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
            } else if (archiveStatusFilter === 'archived' && !updatedFiles.some(f => f.type === 'internal_draft')) {
                setFilteredRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
            } else {
                setFilteredRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, attached_files: updatedFiles, activity_log: updatedLog } : r));
            }

            const savings = totalOriginalSize > 0 ? Math.round(((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100) : 0;
            
            setUploadStats({
                original: formatBytes(totalOriginalSize),
                compressed: formatBytes(totalOptimizedSize),
                savings: savings
            });

            const msg = type === 'internal_draft' ? 'تم حفظ المسودة الداخلية.' : 'تمت الأرشفة بنجاح.';
            addNotification({ title: 'تم الحفظ', message: msg, type: 'success' });

            if (activeArchiveTab !== 'all') {
                if (type === 'internal_draft') setActiveArchiveTab('internal');
                else setActiveArchiveTab('colored');
            }

        } catch (error: any) {
            console.error(error);
            addNotification({ title: 'خطأ', message: `فشل رفع الصور: ${error.message}`, type: 'error' });
        } finally {
            setIsUploading(false);
        }
    };
    
    const initiateDelete = (file: { data: string, type: string }) => {
        setDeleteTargetFile(file);
        setDeletePassword('');
        setDeleteError('');
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!selectedRequest || !deleteTargetFile) return;

        if (deleteTargetFile.type === 'internal_draft') {
            if (deletePassword !== selectedRequest.request_number.toString()) {
                setDeleteError('كلمة المرور غير صحيحة.');
                return;
            }
        }

        try {
            try {
                await deleteImage(deleteTargetFile.data);
            } catch (storageError) {
                console.warn("Storage deletion warning:", storageError);
            }

            const updatedFiles = (selectedRequest.attached_files || []).filter(f => f.data !== deleteTargetFile.data);
            
            await updateRequest({
                id: selectedRequest.id,
                attached_files: updatedFiles
            });
            
             setSelectedRequest(prev => prev ? ({ ...prev, attached_files: updatedFiles }) : null);
             
             // Auto-update UI based on filters: if "Archived" filter is active and we just removed the last archive file, remove from list
             if (archiveStatusFilter === 'archived' && !updatedFiles.some(f => f.type === 'internal_draft')) {
                 setFilteredRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
             } else if (archiveStatusFilter === 'not_archived' && updatedFiles.some(f => f.type === 'internal_draft')) {
                 // Technically this case shouldn't happen during delete but for safety:
                 setFilteredRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
             } else {
                 setFilteredRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, attached_files: updatedFiles } : r));
             }
             
             addNotification({ title: 'تم الحذف', message: 'تم حذف الصفحة.', type: 'info' });
             setIsDeleteModalOpen(false);
             setDeleteTargetFile(null);
        } catch (error) {
             console.error("DB update failed:", error);
             addNotification({ title: 'خطأ', message: 'فشل تحديث سجل الطلب.', type: 'error' });
        }
    };

    if (!can('manage_paper_archive')) {
        return <div className="p-8 text-center text-red-500">ليس لديك صلاحية الوصول لهذه الصفحة.</div>;
    }

    const getRequestStatus = (req: InspectionRequest) => {
        return (req.attached_files?.length || 0) > 0;
    };

    const paperImages = selectedRequest?.attached_files || [];
    const internalImages = paperImages.filter(f => f.type === 'internal_draft');
    const coloredImages = paperImages.filter(f => f.type === 'manual_paper');
    const pdfImages = paperImages.filter(f => f.type === 'pdf_page');
    
    const displayedImages = useMemo(() => {
        if (activeArchiveTab === 'all') return paperImages;
        if (activeArchiveTab === 'internal') return internalImages;
        if (activeArchiveTab === 'colored') return coloredImages;
        if (activeArchiveTab === 'pdf') return pdfImages;
        return paperImages;
    }, [activeArchiveTab, paperImages, internalImages, coloredImages, pdfImages]);

    // Flatten all images for global gallery view
    const allArchivedImages = useMemo(() => {
        const images: {url: string, title: string, subTitle: string, requestId: string, file: any}[] = [];
        displayedRequests.forEach(req => {
            const client = clients.find(c => c.id === req.client_id);
            const car = cars.find(c => c.id === req.car_id);
            const make = carMakes.find(m => m.id === car?.make_id);
            const model = carModels.find(m => m.id === car?.model_id);
            const requestTitle = `طلب #${req.request_number}`;
            const clientName = client?.name || 'عميل غير معروف';
            const carName = `${make?.name_ar || ''} ${model?.name_ar || ''} ${car?.plate_number || ''}`;

            (req.attached_files || []).forEach(file => {
                images.push({
                    url: file.data,
                    title: requestTitle,
                    subTitle: `${clientName} | ${carName}`,
                    requestId: req.id,
                    file: file
                });
            });
        });
        return images;
    }, [displayedRequests, clients, cars, carMakes, carModels]);

    return (
        <div className="container mx-auto animate-fade-in p-4 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                    <Icon name="folder-open" className="w-8 h-8 text-blue-600" />
                    أرشيف الورقيات
                </h2>
                
                <div className="flex flex-wrap gap-2 items-center bg-slate-200 dark:bg-slate-700 p-1.5 rounded-xl">
                    <button onClick={() => {
                        const prevDay = new Date();
                        if (dateFilter === 'today') {
                            prevDay.setDate(prevDay.getDate() - 1);
                            setDateFilter('yesterday');
                        } else if (dateFilter === 'yesterday') {
                            prevDay.setDate(prevDay.getDate() - 2);
                            setCustomStartDate(prevDay.toISOString().split('T')[0]);
                            setCustomEndDate(prevDay.toISOString().split('T')[0]);
                            setDateFilter('custom');
                        } else if (dateFilter === 'custom' && customStartDate === customEndDate) {
                            const current = new Date(customStartDate);
                            current.setDate(current.getDate() - 1);
                            setCustomStartDate(current.toISOString().split('T')[0]);
                            setCustomEndDate(current.toISOString().split('T')[0]);
                            loadData();
                        } else {
                             // Default fallback from other filters to yesterday
                             setDateFilter('yesterday');
                        }
                    }} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-300 transition-all" title="اليوم السابق">
                        <Icon name="chevron-right" className="w-5 h-5" />
                    </button>

                    <button onClick={() => setDateFilter('today')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'today' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>اليوم</button>
                    <button onClick={() => setDateFilter('yesterday')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'yesterday' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>أمس</button>
                    
                    <button onClick={() => {
                         const nextDay = new Date();
                         if (dateFilter === 'yesterday') {
                             setDateFilter('today');
                         } else if (dateFilter === 'custom' && customStartDate === customEndDate) {
                             const current = new Date(customStartDate);
                             current.setDate(current.getDate() + 1);
                             const today = new Date();
                             today.setHours(0,0,0,0);
                             if (current > today) {
                                 setDateFilter('today');
                             } else {
                                 setCustomStartDate(current.toISOString().split('T')[0]);
                                 setCustomEndDate(current.toISOString().split('T')[0]);
                                 loadData();
                             }
                         }
                    }} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-300 transition-all" title="اليوم التالي" disabled={dateFilter === 'today'}>
                        <Icon name="chevron-left" className="w-5 h-5" />
                    </button>

                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

                    <button onClick={() => setDateFilter('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'month' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>هذا الشهر</button>
                    <button onClick={() => setDateFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'all' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>الكل</button>
                    <button onClick={() => setDateFilter('custom')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'custom' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>مخصص</button>
                </div>

                <div className="flex bg-slate-200 dark:bg-slate-700 p-1.5 rounded-xl">
                    <button 
                        onClick={() => setViewMode('table')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <Icon name="list" className="w-4 h-4" />
                        <span>قائمة</span>
                    </button>
                    <button 
                        onClick={() => {
                            setViewMode('gallery');
                            setArchiveStatusFilter('all');
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'gallery' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <Icon name="gallery" className="w-4 h-4" />
                        <span>معرض</span>
                    </button>
                </div>
            </div>

            {dateFilter === 'custom' && (
                <div className="mb-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-end animate-fade-in">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">من تاريخ</label>
                        <CustomDatePicker 
                            value={customStartDate} 
                            onChange={setCustomStartDate} 
                            className="p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-600 text-sm w-full"
                            placeholder="من تاريخ"
                            maxDate={customEndDate ? new Date(customEndDate) : undefined}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">إلى تاريخ</label>
                        <CustomDatePicker 
                            value={customEndDate} 
                            onChange={setCustomEndDate} 
                            className="p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 dark:border-slate-600 text-sm w-full"
                            placeholder="إلى تاريخ"
                            minDate={customStartDate ? new Date(customStartDate) : undefined}
                        />
                    </div>
                    <Button onClick={loadData} disabled={isLoading || !customStartDate || !customEndDate} size="sm">تطبيق</Button>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col gap-4">
                    
                    {/* Top Controls: Search & QR */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                         <div className="relative flex-grow w-full md:max-w-md flex gap-2">
                            <div className="relative flex-grow">
                                <Icon name="search" className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="بحث برقم الطلب، اسم العميل، اللوحة..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pr-9 pl-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <button 
                                onClick={() => setIsQRScannerOpen(true)}
                                className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center"
                                title="مسح كود QR"
                            >
                                <Icon name="scan" className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="text-xs text-slate-500 font-bold bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg">
                            {filteredRequests.length} طلبات
                        </div>
                    </div>

                    {/* Archive Status Filters */}
                    <div className="flex gap-2 border-t border-slate-200 dark:border-slate-700 pt-4">
                        <button 
                            onClick={() => setArchiveStatusFilter('all')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${archiveStatusFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}
                        >
                            الكل
                        </button>
                        <button 
                            onClick={() => setArchiveStatusFilter('archived')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${archiveStatusFilter === 'archived' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'}`}
                        >
                            مؤرشف
                        </button>
                        <button 
                            onClick={() => setArchiveStatusFilter('not_archived')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${archiveStatusFilter === 'not_archived' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'}`}
                        >
                            غير مؤرشف
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                         <div className="p-12 text-center">
                            <RefreshCwIcon className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">جاري تحميل البيانات...</p>
                        </div>
                    ) : viewMode === 'table' ? (
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-4 border-b dark:border-slate-700 sticky right-0 z-20 bg-slate-50 dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">السيارة</th>
                                    <th className="p-4 border-b dark:border-slate-700">رقم الطلب</th>
                                    <th className="p-4 border-b dark:border-slate-700">العميل</th>
                                    <th className="p-4 border-b dark:border-slate-700 text-center">الحالة</th>
                                    <th className="p-4 border-b dark:border-slate-700 text-center">بواسطة</th>
                                    <th className="p-4 border-b dark:border-slate-700 text-center">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredRequests.map(req => {
                                    const client = clients.find(c => c.id === req.client_id);
                                    const car = cars.find(c => c.id === req.car_id);
                                    const make = carMakes.find(m => m.id === car?.make_id);
                                    const model = carModels.find(m => m.id === car?.model_id);
                                    const isArchived = getRequestStatus(req);

                                    const makeEn = req.car_snapshot?.make_en || make?.name_en || '-';
                                    const modelEn = req.car_snapshot?.model_en || model?.name_en || '-';
                                    const year = req.car_snapshot?.year || car?.year || '-';
                                    const plate = car?.plate_number_en || car?.plate_number || '-';

                                    return (
                                        <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <td className="p-4 sticky right-0 z-10 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm" dir="ltr">
                                                    {makeEn} {modelEn}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-slate-500">{year}</span>
                                                    <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                                                        {plate}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600">
                                                    #{req.request_number}
                                                </span>
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    {new Date(req.created_at).toLocaleDateString('en-GB')}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{client?.name || '-'}</div>
                                                <div className="text-xs text-slate-500 font-mono mt-0.5 dir-ltr text-right">{client?.phone || '-'}</div>
                                            </td>
                                            <td className="p-4 text-center">
                                                {isArchived ? (
                                                    <div className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-md text-xs font-bold border border-green-100 dark:border-green-800">
                                                        <CheckCircleIcon className="w-3.5 h-3.5" />
                                                        <span>مؤرشف ({req.attached_files?.filter(f => f.type === 'internal_draft').length || 0})</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-700">
                                                        <XIcon className="w-3.5 h-3.5" />
                                                        <span>غير مؤرشف</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                                    {req.attached_files?.find(f => f.archived_by_name)?.archived_by_name || '-'}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <Button 
                                                    size="sm" 
                                                    variant={isArchived ? "secondary" : "primary"}
                                                    onClick={() => openUploadModal(req, !isArchived)}
                                                    leftIcon={<Icon name="folder-open" className="w-4 h-4" />}
                                                    className="shadow-sm"
                                                >
                                                    {isArchived ? 'عرض الملفات' : 'أرشفة'}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredRequests.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <Icon name="folder-open" className="w-16 h-16 mb-4 opacity-10" />
                                                <p className="text-slate-500 font-bold">لا توجد طلبات للعرض</p>
                                                <p className="text-slate-400 text-xs mt-1">جرب تغيير الفلتر أو البحث بكلمة أخرى</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
                             {/* Gallery Specific Sub-Filters */}
                             <div className="flex flex-wrap gap-2 mb-6 justify-center">
                                 <button 
                                     onClick={() => setGallerySubFilter('all')}
                                     className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${gallerySubFilter === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}
                                 >
                                     عرض الكل
                                 </button>
                                 <button 
                                     onClick={() => setGallerySubFilter('drafts_only')}
                                     className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${gallerySubFilter === 'drafts_only' ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-yellow-400'}`}
                                 >
                                     مسودات فقط
                                 </button>
                                 <button 
                                     onClick={() => setGallerySubFilter('attachments_only')}
                                     className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${gallerySubFilter === 'attachments_only' ? 'bg-blue-500 text-white border-blue-500 shadow-lg scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}
                                 >
                                     مرفقات فقط
                                 </button>
                             </div>

                             {displayedRequests.filter(req => {
                                 const files = req.attached_files || [];
                                 
                                 // First level: global tab filter (already applied to images, but here we filter cards)
                                 let matchesTab = false;
                                 if (activeArchiveTab === 'all') matchesTab = files.length > 0;
                                 else if (activeArchiveTab === 'internal') matchesTab = files.some(f => f.type === 'internal_draft');
                                 else if (activeArchiveTab === 'colored') matchesTab = files.some(f => f.type === 'manual_paper');
                                 else if (activeArchiveTab === 'pdf') matchesTab = files.some(f => f.type === 'pdf_page');
                                 
                                 if (!matchesTab) return false;

                                 // Second level: Gallery Sub-Filter (Drafts only vs Attachments only)
                                 if (gallerySubFilter === 'drafts_only') {
                                     return files.some(f => f.type === 'internal_draft');
                                 }
                                 if (gallerySubFilter === 'attachments_only') {
                                     return files.some(f => f.type === 'manual_paper' || f.type === 'pdf_page');
                                 }

                                 return true;
                             }).length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {displayedRequests.filter(req => {
                                        const files = req.attached_files || [];
                                        
                                        let matchesTab = false;
                                        if (activeArchiveTab === 'all') matchesTab = files.length > 0;
                                        else if (activeArchiveTab === 'internal') matchesTab = files.some(f => f.type === 'internal_draft');
                                        else if (activeArchiveTab === 'colored') matchesTab = files.some(f => f.type === 'manual_paper');
                                        else if (activeArchiveTab === 'pdf') matchesTab = files.some(f => f.type === 'pdf_page');
                                        
                                        if (!matchesTab) return false;

                                        if (gallerySubFilter === 'drafts_only') {
                                            return files.some(f => f.type === 'internal_draft');
                                        }
                                        if (gallerySubFilter === 'attachments_only') {
                                            return files.some(f => f.type === 'manual_paper' || f.type === 'pdf_page');
                                        }

                                        return true;
                                    }).map((req) => {
                                        const client = clients.find(c => c.id === req.client_id);
                                        const car = cars.find(c => c.id === req.car_id);
                                        const make = carMakes.find(m => m.id === car?.make_id);
                                        const model = carModels.find(m => m.id === car?.model_id);
                                        const carName = `${make?.name_ar || ''} ${model?.name_ar || ''} ${car?.plate_number || ''}`;

                                        const reqImages = (req.attached_files || []).filter(f => {
                                            let matches = true;
                                            if (activeArchiveTab === 'internal') matches = (f.type === 'internal_draft');
                                            else if (activeArchiveTab === 'colored') matches = (f.type === 'manual_paper');
                                            else if (activeArchiveTab === 'pdf') matches = (f.type === 'pdf_page');
                                            
                                            if (!matches) return false;

                                            if (gallerySubFilter === 'drafts_only') return f.type === 'internal_draft';
                                            if (gallerySubFilter === 'attachments_only') return f.type !== 'internal_draft';

                                            return true;
                                        });

                                        return (
                                            <div 
                                                key={req.id} 
                                                className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group h-full"
                                            >
                                                {/* Card Header - Enhanced with subtle pattern or better hierarchy */}
                                                <div className="p-4 border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 relative overflow-hidden">
                                                    {/* Decorative background accent */}
                                                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-8 -mt-8"></div>
                                                    
                                                    <div className="relative flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-md tracking-wider">طلب #{req.request_number}</span>
                                                                <span className="text-[10px] text-slate-400 font-medium">{new Date(req.created_at).toLocaleDateString('ar-SA')}</span>
                                                            </div>
                                                            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm truncate max-w-[180px] leading-tight mt-1">{client?.name || 'عميل مجهول'}</h3>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate tracking-tight">{carName}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <button 
                                                            onClick={() => openUploadModal(req)} 
                                                            className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-800 shadow-none hover:shadow-sm"
                                                            title="إضافة ملفات"
                                                        >
                                                            <PlusIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Mini Gallery - More sophisticated layout */}
                                                <div className="flex-1 p-3 bg-white dark:bg-slate-800">
                                                    <div className="grid grid-cols-2 gap-2.5 h-full min-h-[170px]">
                                                        {reqImages.length > 0 ? (
                                                            <>
                                                                {reqImages.slice(0, 3).map((img, idx) => (
                                                                    <div 
                                                                        key={img.data} 
                                                                        className={`relative rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700/50 cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 ${idx === 0 && reqImages.length > 2 ? 'row-span-2' : 'h-24 md:h-auto'}`}
                                                                        onClick={() => {
                                                                            const globalIdx = allArchivedImages.findIndex(ai => ai.url === img.data);
                                                                            if (globalIdx !== -1) openLightbox(allArchivedImages, globalIdx);
                                                                        }}
                                                                    >
                                                                        <img src={img.data} alt="req-img" className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-110" />
                                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors"></div>
                                                                        
                                                                        {/* Discreet type indicator */}
                                                                        <div className="absolute bottom-2 right-2">
                                                                            {img.type === 'internal_draft' && <span className="px-1.5 py-0.5 bg-yellow-500 text-[8px] font-black text-black rounded-md shadow-sm uppercase">مسودة</span>}
                                                                            {img.type === 'pdf_page' && <span className="px-1.5 py-0.5 bg-red-500 text-[8px] font-black text-white rounded-md shadow-sm uppercase">PDF</span>}
                                                                            {img.type === 'manual_paper' && <span className="px-1.5 py-0.5 bg-blue-500 text-[8px] font-black text-white rounded-md shadow-sm uppercase">ملون</span>}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {reqImages.length > 3 && (
                                                                    <div 
                                                                        className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
                                                                        onClick={() => openUploadModal(req)}
                                                                    >
                                                                        <span className="text-xl font-black text-slate-400 dark:text-slate-500 tracking-tighter">+{reqImages.length - 3}</span>
                                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">المزيد</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="col-span-2 flex flex-col items-center justify-center py-10 text-slate-300 dark:text-slate-600 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl group-hover:border-blue-200 dark:group-hover:border-blue-900 transition-colors">
                                                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                                                    <Icon name="gallery" className="w-10 h-10 opacity-30" />
                                                                </div>
                                                                <span className="text-xs font-bold uppercase tracking-widest opacity-60">لا يوجد أرشفة</span>
                                                                <button onClick={() => openUploadModal(req)} className="mt-3 text-[10px] font-black text-blue-600 hover:underline uppercase tracking-tight">ابدأ الأرشفة الآن</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card Footer - Professional Status Badges */}
                                                <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 mt-auto border-t dark:border-slate-700 flex justify-between items-center">
                                                    <div className="flex gap-1.5">
                                                        {reqImages.filter(f => f.type === 'internal_draft').length > 0 && (
                                                            <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-md border border-yellow-200/50 dark:border-yellow-700/30">
                                                                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                                                                <span className="text-[9px] font-black text-yellow-700 dark:text-yellow-400">{reqImages.filter(f => f.type === 'internal_draft').length}</span>
                                                            </div>
                                                        )}
                                                        {reqImages.filter(f => f.type === 'manual_paper').length > 0 && (
                                                            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md border border-blue-200/50 dark:border-blue-700/30">
                                                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                                                <span className="text-[9px] font-black text-blue-700 dark:text-blue-400">{reqImages.filter(f => f.type === 'manual_paper').length}</span>
                                                            </div>
                                                        )}
                                                        {reqImages.filter(f => f.type === 'pdf_page').length > 0 && (
                                                            <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md border border-red-200/50 dark:border-red-700/30">
                                                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                                                                <span className="text-[9px] font-black text-red-700 dark:text-red-400">{reqImages.filter(f => f.type === 'pdf_page').length}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => openUploadModal(req)} 
                                                        className="group/btn flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-tight"
                                                    >
                                                        <span>كل الملفات</span>
                                                        <Icon name="chevron-left" className="w-3 h-3 transform transition-transform group-hover/btn:-translate-x-1" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                             ) : (
                                <div className="p-20 text-center text-slate-400">
                                    <Icon name="gallery" className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                    <p className="font-bold">لا توجد طلبات مؤرشفة للعرض في هذه الفترة</p>
                                </div>
                             )}
                        </div>
                    )}
                </div>
            </div>

            {/* Same Modal Structure as PrintReport.tsx */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title={`أرشيف الطلب رقم #${selectedRequest?.request_number}`} size="4xl">
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
                        <div className="flex border-b dark:border-slate-700 mb-4 overflow-x-auto no-scrollbar">
                            <button
                                className={`flex-shrink-0 px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeArchiveTab === 'all' ? 'border-b-2 border-slate-600 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                onClick={() => setActiveArchiveTab('all')}
                            >
                                    الكل ({paperImages.length})
                            </button>
                            <button
                                className={`flex-shrink-0 px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeArchiveTab === 'internal' ? 'border-b-2 border-yellow-500 text-yellow-600 dark:text-yellow-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                onClick={() => setActiveArchiveTab('internal')}
                            >
                                    المسودات ({internalImages.length})
                            </button>
                            <button
                                className={`flex-shrink-0 px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeArchiveTab === 'colored' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                onClick={() => setActiveArchiveTab('colored')}
                            >
                                    المرفقات الملونة ({coloredImages.length})
                            </button>
                            <button
                                className={`flex-shrink-0 px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeArchiveTab === 'pdf' ? 'border-b-2 border-red-500 text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                onClick={() => setActiveArchiveTab('pdf')}
                            >
                                    ملفات PDF ({pdfImages.length})
                            </button>
                        </div>

                        {/* Contextual Actions Toolbar */}
                        <div className="mb-4 flex flex-col gap-3">
                            {isExtractingPdf && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg animate-pulse flex items-center justify-center gap-3">
                                    <RefreshCwIcon className="w-5 h-5 text-blue-600 animate-spin" />
                                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">جاري استخراج الصفحات من ملف PDF...</span>
                                </div>
                            )}
                            {activeArchiveTab === 'colored' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleUploadClick('manual_paper')} disabled={isUploading || isExtractingPdf} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                        <CameraIcon className="w-5 h-5" />
                                        <span className="font-bold text-sm">إضافة مرفق جديد (ملون)</span>
                                    </button>
                                    <button 
                                        onClick={() => { setCurrentUploadType('manual_paper'); fileInputRef.current?.click(); }} 
                                        disabled={isUploading || isExtractingPdf}
                                        className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-all"
                                        title="رفع من الجهاز"
                                    >
                                        <UploadIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                            
                            {activeArchiveTab === 'internal' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleUploadClick('internal_draft')} disabled={isUploading || isExtractingPdf} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800">
                                        <CameraIcon className="w-5 h-5" />
                                        <span className="font-bold text-sm">إضافة مسودة (داخلي)</span>
                                    </button>
                                    <button 
                                        onClick={() => { setCurrentUploadType('internal_draft'); fileInputRef.current?.click(); }} 
                                        disabled={isUploading || isExtractingPdf}
                                        className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-all"
                                        title="رفع من الجهاز"
                                    >
                                        <UploadIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            )}

                            {activeArchiveTab === 'pdf' && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setCurrentUploadType('manual_paper'); pdfInputRef.current?.click(); }} 
                                        disabled={isUploading || isExtractingPdf}
                                        className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 transition-all transition-all"
                                    >
                                        <Icon name="document-report" className="w-5 h-5" />
                                        <span className="font-bold text-sm">رفع واستخراج صفحات من ملف PDF</span>
                                    </button>
                                </div>
                            )}

                            {activeArchiveTab === 'all' && (
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center text-slate-500 text-sm">
                                    يرجى اختيار تبويب "المسودات"، "المرفقات الملونة"، أو "ملفات PDF" لإضافة ملفات جديدة.
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
                                                <a href={file.data} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-lg text-slate-800 hover:bg-blue-50 transition-colors">
                                                    <Icon name="eye" className="w-4 h-4" />
                                                </a>
                                                <button onClick={() => initiateDelete(file)} className="p-2 bg-white rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] p-2 text-center">
                                                <div className="truncate font-bold mb-1">{file.name}</div>
                                                {file.type === 'internal_draft' && <span className="inline-block px-1 bg-yellow-500 text-black rounded text-[8px] font-bold mb-1">مسودة</span>}
                                                {file.archived_by_name && (
                                                    <div className="text-[9px] text-blue-200 border-t border-white/20 pt-1 mt-1">
                                                        بواسطة: <span className="text-white">{file.archived_by_name}</span>
                                                        {file.archived_at && <div className="text-slate-300">{new Date(file.archived_at).toLocaleString('ar-SA')}</div>}
                                                    </div>
                                                )}
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
                        <Button variant="secondary" onClick={() => setIsUploadModalOpen(false)}>إغلاق</Button>
                    </div>
                </div>
            </Modal>

            {/* Global Lightbox / Gallery Viewer */}
            {selectedImageIndex !== null && lightboxImages.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-fade-in text-white overflow-hidden">
                    {/* Lightbox Header - Restored to fixed position */}
                    <div className="p-4 flex justify-between items-center bg-black/60 backdrop-blur-md border-b border-white/10 z-50">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setSelectedImageIndex(null)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                            <div>
                                <h5 className="font-bold text-sm">{lightboxImages[selectedImageIndex].title}</h5>
                                <p className="text-[10px] opacity-70">{lightboxImages[selectedImageIndex].subTitle}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="flex items-center bg-white/10 rounded-lg overflow-hidden border border-white/10 shadow-lg">
                                <button 
                                    onClick={handleZoomIn}
                                    className="p-2 hover:bg-white/20 transition-colors border-l border-white/5"
                                    title="تكبير"
                                >
                                    <Icon name="plus" className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={resetZoom}
                                    className="px-3 py-1 text-[10px] font-bold hover:bg-white/20 transition-colors border-l border-white/5 min-w-[50px] text-center"
                                    title="إعادة التعيين"
                                >
                                    {Math.round(zoomLevel * 100)}%
                                </button>
                                <button 
                                    onClick={handleZoomOut}
                                    className="p-2 hover:bg-white/20 transition-colors"
                                    title="تصغير"
                                >
                                    <Icon name="minus" className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="text-[10px] font-mono font-bold text-slate-400">
                                {selectedImageIndex + 1} / {lightboxImages.length}
                            </div>
                            <div className="flex gap-2">
                                <a 
                                    href={lightboxImages[selectedImageIndex].url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                                    title="فتح في نافذة جديدة"
                                >
                                    <Icon name="external-link" className="w-5 h-5" />
                                </a>
                                <button
                                    onClick={() => initiateDelete(lightboxImages[selectedImageIndex].file)}
                                    className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                                    title="حذف"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Image Area */}
                    <div className="flex-1 relative bg-slate-950 overflow-auto scrollbar-hide">
                        {/* Navigation Arrows - Using fixed position to stay visible during scroll */}
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedImageIndex(prev => prev! > 0 ? prev! - 1 : lightboxImages.length - 1);
                                setZoomLevel(1);
                            }}
                            className="fixed left-6 top-1/2 -translate-y-1/2 p-4 bg-black/40 hover:bg-white/10 rounded-full transition-all z-50 border border-white/10 backdrop-blur-sm"
                        >
                            <Icon name="chevron-left" className="w-8 h-8" />
                        </button>

                        <div 
                            className="min-w-full min-h-full flex"
                            style={{ padding: zoomLevel > 1 ? '40vh 20vw' : '2.5rem' }}
                        >
                            <div className="relative m-auto flex flex-col items-center">
                                <img 
                                    src={lightboxImages[selectedImageIndex].url} 
                                    alt="Gallery Preview" 
                                    className={`shadow-2xl transition-transform duration-300 origin-center ${zoomLevel >= 2.5 ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                                    style={{ 
                                        transform: `scale(${zoomLevel})`,
                                        maxWidth: zoomLevel > 1 ? 'none' : '90vw',
                                        maxHeight: zoomLevel > 1 ? 'none' : '70vh'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (zoomLevel === 1) setZoomLevel(1.5);
                                        else if (zoomLevel <= 1.5) setZoomLevel(2);
                                        else if (zoomLevel <= 2) setZoomLevel(2.5);
                                        else resetZoom();
                                    }}
                                />
                                
                                {lightboxImages[selectedImageIndex].file && (
                                    <div className={`mt-6 transition-opacity duration-300 ${zoomLevel > 1 ? 'opacity-40' : 'opacity-100'} flex flex-col items-center gap-2`}>
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold shadow-lg ${
                                            lightboxImages[selectedImageIndex].file.type === 'internal_draft' ? 'bg-yellow-500 text-black' :
                                            lightboxImages[selectedImageIndex].file.type === 'pdf_page' ? 'bg-red-600 text-white' :
                                            'bg-blue-600 text-white'
                                        }`}>
                                            {lightboxImages[selectedImageIndex].file.type === 'internal_draft' ? 'مسودة داخلية' :
                                             lightboxImages[selectedImageIndex].file.type === 'pdf_page' ? 'صفحة PDF' : 'مرفق ملون'}
                                        </span>
                                        {lightboxImages[selectedImageIndex].file.archived_by_name && (
                                            <div className="bg-white/5 backdrop-blur-md px-3 py-2 rounded-lg text-center border border-white/10">
                                                <div className="text-[10px] font-bold">{lightboxImages[selectedImageIndex].file.archived_by_name}</div>
                                                {lightboxImages[selectedImageIndex].file.archived_at && (
                                                    <div className="text-[8px] opacity-50 mt-1">{new Date(lightboxImages[selectedImageIndex].file.archived_at).toLocaleString('ar-SA')}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedImageIndex(prev => prev! < lightboxImages.length - 1 ? prev! + 1 : 0);
                                setZoomLevel(1);
                            }}
                            className="fixed right-6 top-1/2 -translate-y-1/2 p-4 bg-black/40 hover:bg-white/10 rounded-full transition-all z-50 border border-white/10 backdrop-blur-sm"
                        >
                            <Icon name="chevron-right" className="w-8 h-8" />
                        </button>
                    </div>

                    {/* Thumbnails Section */}
                    <div className="h-24 bg-black/40 backdrop-blur-sm p-2 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-shrink-0">
                        {lightboxImages.map((img, idx) => (
                            <button
                                key={img.url + idx}
                                onClick={() => setSelectedImageIndex(idx)}
                                className={`h-full aspect-[3/4] flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${idx === selectedImageIndex ? 'border-blue-500 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-transparent opacity-50 hover:opacity-80'}`}
                            >
                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

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
            
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelected} className="hidden" />
            <input ref={pdfInputRef} type="file" accept="application/pdf" multiple onChange={handleFileSelected} className="hidden" />

            <DocumentScannerModal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                imageFile={scannerFile} 
                onConfirm={handleScannerConfirm}
                // Removed forceFilter to allow color for all document types as requested
            />
            
            <CameraPage 
                isOpen={isCameraOpen} 
                onClose={() => setIsCameraOpen(false)} 
                onCapture={handleCameraCapture} 
            />
            
            <InAppScannerModal
                isOpen={isQRScannerOpen}
                onClose={() => setIsQRScannerOpen(false)}
                onScanSuccess={handleQRScan}
            />

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
        </div>
    );
};

export default PaperArchive;
