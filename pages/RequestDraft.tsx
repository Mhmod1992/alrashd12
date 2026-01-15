import React, { useRef, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Icon from '../components/Icon';
import Button from '../components/Button';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import MiniPlateDisplay from '../components/MiniPlateDisplay';

// Satisfy TS that this is on the window object from the script tag
declare const QRCodeStyling: any;

const DraftQRCode: React.FC<{ requestNumber: number }> = ({ requestNumber }) => {
    const qrCodeRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!qrCodeRef.current || typeof QRCodeStyling === 'undefined') return;

        // Draft QR codes are a special text format for internal app use.
        const content = `AERO-DRAFT-${requestNumber}`;
        const size = 80; 

        // Old Style: Simple squares, standard black
        const qrCode = new QRCodeStyling({
            width: size,
            height: size,
            data: content,
            margin: 0,
            dotsOptions: { color: '#000000', type: 'square' }, 
            cornersSquareOptions: { color: '#000000', type: 'square' },
            cornersDotOptions: { color: '#000000', type: 'square' },
            backgroundOptions: { color: 'transparent' },
        });
        
        qrCodeRef.current.innerHTML = '';
        qrCode.append(qrCodeRef.current);

    }, [requestNumber]);

    return (
        <div ref={qrCodeRef} />
    );
};


// This component contains only the content to be printed/displayed on the "paper".
const PrintablePage = ({ request, client, car, carMake, carModel, inspectionType }) => {
    const { settings } = useAppContext();
    
    const carDetails = React.useMemo(() => {
        if (request.car_snapshot) {
            return {
                makeNameEn: request.car_snapshot.make_en,
                modelNameEn: request.car_snapshot.model_en,
                year: request.car_snapshot.year,
            };
        }
        return {
            makeNameEn: carMake?.name_en || 'غير معروف',
            modelNameEn: carModel?.name_en || 'غير معروف',
            year: car.year,
        };
    }, [request.car_snapshot, car, carMake, carModel]);

    const draftSettings = settings.draftSettings;
    const showImage = draftSettings?.customImageUrl &&
        (!draftSettings.showImageForInspectionTypeIds || 
         draftSettings.showImageForInspectionTypeIds.length === 0 || 
         draftSettings.showImageForInspectionTypeIds.includes(inspectionType.id));

    // Determine layout mode: 'float' (default if undefined) or 'absolute'
    const isFloatMode = draftSettings?.imageStyle !== 'absolute';

    const plateToDisplay = car.vin ? `شاصي: ${car.vin}` : (car.plate_number || '');

    return (
        <div 
            className="printable-content relative bg-white dark:bg-slate-800 flex flex-col w-[210mm] min-h-[297mm] p-[15mm] box-border text-black"
        >
             {/* ABSOLUTE POSITIONED IMAGE (Rendered outside normal flow if mode is absolute) */}
             {showImage && !isFloatMode && (
                <div
                    className="absolute z-0"
                    style={{
                        left: `${draftSettings.imageX}mm`,
                        top: `${draftSettings.imageY}mm`,
                        width: `${draftSettings.imageWidth}mm`,
                        height: `${draftSettings.imageHeight}mm`,
                    }}
                >
                    <img 
                        src={draftSettings.customImageUrl} 
                        alt="Custom Draft Image"
                        className="w-full h-full object-contain"
                    />
                </div>
            )}

            <header className="relative flex flex-col pb-4 border-b-2 border-black dark:border-slate-400 z-10">
                <div className="w-full flex justify-between items-end">
                    
                    {/* LEFT SIDE (Start in RTL): Inspection Type, Request Number & Vehicle Name */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="border border-black dark:border-slate-400 rounded px-2 py-1 text-center font-bold text-sm">
                               <strong className="me-1">نوع الفحص:</strong>
                               <span>{inspectionType.name}</span>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-300">#{request.request_number}</h1>
                        </div>
                        
                        <div className="flex items-baseline gap-2">
                            <p className="text-lg font-bold">{`${carDetails.makeNameEn} ${carDetails.modelNameEn} ${carDetails.year}`}</p>
                        </div>
                    </div>

                    {/* RIGHT SIDE: Group containing [Date+Plate Column] and [QR Code] */}
                    <div className="flex items-end gap-4">
                        
                        {/* Column 1: Date/Time (Top) -> Plate (Bottom) */}
                        <div className="flex flex-col items-center gap-1">
                            {/* Date & Time Row */}
                            <div className="text-xs font-bold flex flex-row items-center gap-2 text-slate-700">
                                <span className="font-mono">{new Date(request.created_at).toLocaleDateString('en-GB')}</span>
                                <span className="text-slate-400">|</span>
                                <span className="font-mono">{new Date(request.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            
                            {/* Plate Component */}
                            <div className="transform scale-90 origin-bottom">
                                <MiniPlateDisplay plateNumber={plateToDisplay} settings={settings} />
                            </div>
                        </div>

                        {/* Column 2: QR Code (Old Style) */}
                        <div className="flex-shrink-0 border-2 border-black p-0.5">
                            <DraftQRCode requestNumber={request.request_number} />
                        </div>
                    </div>

                </div>
            </header>

            <section className="mt-4 flex-grow flex flex-col z-10">
                <h2 className="text-lg font-bold mb-2">ملاحظات الفحص</h2>
                <div className="flex-grow p-2 lined-paper border border-gray-300 dark:border-slate-600 rounded-md">
                    {/* FLOAT POSITIONED IMAGE (Rendered inside flow if mode is float) */}
                    {showImage && isFloatMode && (
                        <div
                            className="float-left -mt-2 -ml-2 mb-2 mr-4 relative z-10"
                            style={{
                                width: `${draftSettings.imageWidth}mm`,
                                height: `${draftSettings.imageHeight}mm`,
                            }}
                        >
                            <img 
                                src={draftSettings.customImageUrl} 
                                alt="Custom Draft Image"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    )}
                    {/* This div will have the lined background and will expand */}
                </div>
            </section>
        </div>
    );
};


const RequestDraft: React.FC = () => {
    const { 
        selectedRequestId, 
        requests, 
        clients, 
        cars, 
        carMakes, 
        carModels, 
        inspectionTypes, 
        setPage, 
        goBack, 
        shouldPrintDraft,
        setShouldPrintDraft,
        settings
    } = useAppContext();

    const [isContentReady, setIsContentReady] = useState(false);
    const [isDraftQuality, setIsDraftQuality] = useState(true);

    // Image Preloading Logic
    useEffect(() => {
        // If there's a custom image in settings, we must wait for it to load
        const imageUrl = settings.draftSettings?.customImageUrl;
        
        if (imageUrl) {
            setIsContentReady(false);
            const img = new Image();
            img.src = imageUrl;
            
            // Success handler
            img.onload = () => {
                setIsContentReady(true);
            };
            
            // Error handler (don't block the page if image fails)
            img.onerror = () => {
                console.warn("Failed to preload draft background image.");
                setIsContentReady(true);
            };

            // Fail-safe timeout (e.g., 3 seconds) in case onload never fires
            const timeout = setTimeout(() => {
                setIsContentReady(true);
            }, 3000);

            return () => clearTimeout(timeout);
        } else {
            // No image to load, ready immediately
            setIsContentReady(true);
        }
    }, [settings.draftSettings?.customImageUrl]);

    // Printing Logic (Only when content is ready)
    React.useEffect(() => {
        if (shouldPrintDraft && isContentReady) {
            // Short delay to allow DOM render after isContentReady becomes true
            const timer = setTimeout(() => {
                window.print();
                setShouldPrintDraft(false); 
                goBack(); 
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [shouldPrintDraft, isContentReady, setShouldPrintDraft, goBack]);

    const request = requests.find(r => r.id === selectedRequestId);
    
    // Data fetching logic
    const client = request ? clients.find(c => c.id === request.client_id) : undefined;
    const car = request ? cars.find(c => c.id === request.car_id) : undefined;
    const carModel = car ? carModels.find(m => m.id === car.model_id) : undefined;
    const carMake = car ? carMakes.find(m => m.id === car.make_id) : undefined;
    const inspectionType = request ? inspectionTypes.find(i => i.id === request.inspection_type_id) : undefined;

    // Loading State (While fetching data OR while preloading image)
    if (!request || !client || !car || !inspectionType || !isContentReady) {
        return (
             <div className="flex flex-col items-center justify-center h-screen text-center p-8">
                <RefreshCwIcon className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-lg text-gray-700 dark:text-gray-300 font-semibold">
                    {!isContentReady ? 'جاري تجهيز المسودة والصور...' : 'جاري تحميل بيانات الطلب...'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">يرجى الانتظار قليلاً لضمان جودة الطباعة.</p>
                
                {/* Allow aborting if stuck too long */}
                {(!request && isContentReady) && (
                    <Button onClick={() => setPage('requests')} className="mt-6" variant="secondary">
                        العودة للطلبات
                    </Button>
                )}
            </div>
        );
    }
    
    const handlePrint = () => window.print();
    const handleStartFilling = () => setPage('fill-request');
    const handleBack = () => goBack();

    const pageData = { request, client, car, carMake, carModel, inspectionType };

    return (
        <div className={isDraftQuality ? 'draft-quality-print' : ''}>
            
            {/* Action Header (No Print) */}
            <div className="no-print sticky top-0 z-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                 <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                        مسودة طلب فحص يدوي
                    </h2>
                    <div className="flex items-center gap-4">
                        <Button variant="secondary" onClick={handleBack} leftIcon={<Icon name="back" className="w-5 h-5 transform scale-x-[-1]" />}>
                           العودة
                        </Button>
                        <Button onClick={handleStartFilling} variant="secondary" leftIcon={<Icon name="edit" className="w-5 h-5" />}>
                           بدء التعبئة
                        </Button>
                        <div className="flex items-center gap-3 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                            <label htmlFor="draft-quality-toggle" className="flex items-center cursor-pointer gap-2">
                                <input
                                    type="checkbox"
                                    id="draft-quality-toggle"
                                    checked={isDraftQuality}
                                    onChange={(e) => setIsDraftQuality(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    طباعة بجودة مسودة
                                </span>
                            </label>
                            <Button onClick={handlePrint} leftIcon={<Icon name="print" className="w-5 h-5" />}>
                                طباعة
                            </Button>
                        </div>
                    </div>
                 </div>
            </div>

            {/* Print Styles */}
            <style type="text/css" media="print">
            {`
                @page {
                    size: A4;
                    margin: 0;
                }
                body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .print-container {
                    padding: 0;
                    margin: 0;
                    background: white;
                }
                .printable-content {
                    border: none !important;
                    box-shadow: none !important;
                    border-radius: 0 !important;
                    width: 100%;
                    height: 100vh; /* Fill the page */
                    color: black !important;
                }
                .printable-content * {
                    color: black !important;
                    border-color: black !important;
                }
                .lined-paper {
                    background-image: linear-gradient(to bottom, transparent calc(2.5rem - 1px), #d1d5db calc(2.5rem - 1px)) !important;
                }
                .draft-quality-print .printable-content {
                    filter: grayscale(80%) opacity(75%);
                }
            `}
            </style>
            
            {/* Screen View (will be hidden on print) */}
            <div className="no-print py-8 bg-gray-200 dark:bg-gray-800 flex justify-center">
                 <div className="shadow-2xl">
                    <PrintablePage {...pageData} />
                </div>
            </div>

            {/* Print View (hidden on screen, visible on print) */}
            <div className="hidden print:block print-container">
                <PrintablePage {...pageData} />
            </div>
        </div>
    );
};
export default RequestDraft;