import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import Icon from '../components/Icon';
import Button from '../components/Button';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import MiniPlateDisplay from '../components/MiniPlateDisplay';
import { supabase } from '../lib/supabaseClient';
import { Client, Car, CarMake, CarModel, InspectionType, InspectionRequest } from '../types';

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


// Draft watermark component that repeats diagonally across the entire printable page
const DraftWatermark: React.FC<{ text?: string }> = ({ text }) => {
    if (!text) return null;
    const reactId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
    const patternId = `wm-draft-pat-${reactId}`;

    return (
        <div 
            className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none" 
            aria-hidden="true"
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
            <svg 
                className="w-full h-full" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: '100%', height: '100%', display: 'block', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >
                <defs>
                    <pattern
                        id={patternId}
                        width="240"
                        height="150"
                        patternUnits="userSpaceOnUse"
                        patternTransform="rotate(-30 0 0)"
                    >
                        <text
                            x="120"
                            y="75"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#64748b"
                            fillOpacity="0.13"
                            fontSize="21"
                            fontWeight="bold"
                            style={{ 
                                fontFamily: 'inherit',
                                WebkitPrintColorAdjust: 'exact',
                                printColorAdjust: 'exact'
                            }}
                        >
                            {text}
                        </text>
                    </pattern>
                </defs>
                <rect 
                    width="100%" 
                    height="100%" 
                    fill={`url(#${patternId})`} 
                    style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                />
            </svg>
        </div>
    );
};

// This component contains only the content to be printed/displayed on the "paper".
const PrintablePage: React.FC<{
    request: InspectionRequest;
    client?: Client;
    car?: Car;
    carMake?: CarMake;
    carModel?: CarModel;
    inspectionType: InspectionType;
}> = ({ request, client, car, carMake, carModel, inspectionType }) => {
    const { settings } = useAppContext();
    
    const carDetails = useMemo(() => {
        let logoUrl = carMake?.logo_url || '';
        
        if (request.car_snapshot) {
            return {
                makeNameEn: request.car_snapshot.make_en || 'Unknown',
                modelNameEn: request.car_snapshot.model_en || 'Unknown',
                year: request.car_snapshot.year,
                logoUrl,
            };
        }
        return {
            makeNameEn: carMake?.name_en || 'Unknown',
            modelNameEn: carModel?.name_en || 'Unknown',
            year: car?.year || new Date().getFullYear(),
            logoUrl,
        };
    }, [request.car_snapshot, car, carMake, carModel]);

    const draftSettings = settings.draftSettings;
    const showImage = draftSettings?.customImageUrl &&
        (!draftSettings.showImageForInspectionTypeIds || 
         draftSettings.showImageForInspectionTypeIds.length === 0 || 
         draftSettings.showImageForInspectionTypeIds.includes(inspectionType.id));

    // Determine layout mode: 'float' (default if undefined) or 'absolute'
    const isFloatMode = draftSettings?.imageStyle !== 'absolute';

    const visibleSignatures = useMemo(() => {
        if (!draftSettings?.signatureFields) return [];
        return draftSettings.signatureFields.filter(field => 
            !field.applicableInspectionTypeIds || 
            field.applicableInspectionTypeIds.length === 0 || 
            field.applicableInspectionTypeIds.includes(inspectionType.id)
        );
    }, [draftSettings?.signatureFields, inspectionType.id]);

    const plateToDisplay = car?.vin ? `شاصي: ${car.vin}` : (car?.plate_number || '');

    return (
        <div 
            className="printable-content relative bg-white dark:bg-slate-800 flex flex-col w-full max-w-[210mm] sm:w-[210mm] min-h-auto sm:min-h-[297mm] p-4 sm:p-[15mm] box-border text-black overflow-hidden print:w-[210mm] print:min-h-[297mm] print:p-[15mm] print:m-0"
        >
            {/* Full-Page Slanted Transparent Watermark for Inspection Type */}
            <DraftWatermark text={inspectionType?.name} />
            
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
                    {/* Custom Checkboxes below image if absolute */}
                    {draftSettings.customFields && draftSettings.customFields.length > 0 && (
                        <>
                            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                                {draftSettings.customFields.map(field => (
                                    <div key={field.id} className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 border border-black rounded-sm flex-shrink-0" />
                                        <span className="text-[10px] font-bold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: field.textColor || '#000000' }}>
                                            {field.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-1 border-b border-black w-full" />
                        </>
                    )}
                </div>
            )}

            <header className="relative flex flex-col pb-4 border-b-2 border-black dark:border-slate-400 z-10">
                <div className="w-full flex justify-between items-end relative">
                    
                    {/* LEFT SIDE (Start in RTL): Inspection Type, Request Number & Vehicle Name */}
                    <div className="flex flex-col gap-1 max-w-[60%]">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-300">#{request.request_number}</h1>
                        <div className="flex items-center gap-3">
                            <div className="border border-black dark:border-slate-400 rounded px-2 py-1 text-center font-bold text-xs sm:text-sm bg-transparent">
                               <span className="me-1 text-slate-800 dark:text-slate-300">نوع الفحص:</span>
                               <span className="bg-yellow-300 border border-black px-1 rounded text-black inline-block">{inspectionType.name}</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1">
                            {carDetails.logoUrl && (
                                <img
                                    src={carDetails.logoUrl}
                                    alt={`${carDetails.makeNameEn} Logo`}
                                    className="max-w-[40px] max-h-[40px] object-contain opacity-90 mix-blend-multiply flex-shrink-0"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            )}
                            <p className="text-base sm:text-lg break-words leading-tight"><strong className="font-bold">{carDetails.makeNameEn}</strong> {carDetails.modelNameEn} {carDetails.year}</p>
                        </div>
                    </div>

                    {/* RIGHT SIDE: Group containing [Date+Plate Column] and [QR Code] */}
                    <div className="flex items-end gap-2 sm:gap-4 flex-shrink-0">
                        
                        {/* Column 1: Date/Time (Top) -> Plate (Bottom) */}
                        <div className="flex flex-col items-center gap-1">
                            {/* Date & Time Row */}
                            <div className="text-[10px] sm:text-xs font-bold flex flex-row items-center gap-1 sm:gap-2 text-slate-700">
                                <span className="font-mono">{new Date(request.created_at).toLocaleDateString('en-GB')}</span>
                                <span className="text-slate-400">|</span>
                                <span className="font-mono">{new Date(request.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            
                            {/* Plate Component */}
                            <div className="transform scale-75 sm:scale-90 origin-bottom">
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
                <div className="flex justify-between items-end mb-2">
                    <h2 className="text-base sm:text-lg font-bold">ملاحظات الفحص</h2>
                    {visibleSignatures.length > 0 && (
                        <div className="flex gap-4 sm:gap-6 items-end text-xs sm:text-sm">
                            {visibleSignatures.map(field => (
                                <div key={field.id} className="flex items-baseline gap-1 sm:gap-2">
                                    <span className="font-bold" style={{ 
                                        fontSize: field.fontSize ? `${field.fontSize}px` : '14px',
                                        color: field.textColor || '#000000'
                                    }}>{field.label}</span>
                                    <span className="text-gray-400">.......................</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-grow p-2 lined-paper border border-gray-300 dark:border-slate-600 rounded-md min-h-[300px]">
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
                            {/* Custom Checkboxes below image if float */}
                            {draftSettings.customFields && draftSettings.customFields.length > 0 && (
                                <>
                                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                                        {draftSettings.customFields.map(field => (
                                            <div key={field.id} className="flex items-center gap-2">
                                                <div className="w-4 h-4 border border-black rounded-sm flex-shrink-0" />
                                                <span className="text-xs font-bold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: field.textColor || '#000000' }}>
                                                    {field.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 border-b border-black w-full" />
                                </>
                            )}
                        </div>
                    )}
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
        settings,
        fetchAndUpdateSingleRequest,
        isRefreshing
    } = useAppContext();

    const [isContentReady, setIsContentReady] = useState(false);
    const [isDraftQuality, setIsDraftQuality] = useState(settings.draftSettings?.defaultPrintAsDraft ?? true);
    const [isFetchingRequest, setIsFetchingRequest] = useState(false);

    // Direct fetched entities for missing local state
    const [directRequest, setDirectRequest] = useState<InspectionRequest | null>(null);
    const [directClient, setDirectClient] = useState<Client | null>(null);
    const [directCar, setDirectCar] = useState<Car | null>(null);

    // Update isDraftQuality when settings loaded (if not already set)
    useEffect(() => {
        if (settings.draftSettings) {
            setIsDraftQuality(settings.draftSettings.defaultPrintAsDraft ?? true);
        }
    }, [settings.draftSettings]);

    // Active fetch request if not found in local requests
    useEffect(() => {
        if (!selectedRequestId) return;
        const localReq = requests.find(r => r.id === selectedRequestId);
        if (localReq) {
            setDirectRequest(localReq);
            return;
        }

        setIsFetchingRequest(true);
        // Fetch via context updater and direct query
        supabase.from('inspection_requests').select('*').eq('id', selectedRequestId).maybeSingle()
            .then(({ data }) => {
                if (data) setDirectRequest(data as InspectionRequest);
            });

        fetchAndUpdateSingleRequest(selectedRequestId)
            .catch(err => {
                console.error("Failed to fetch request for draft:", err);
            })
            .finally(() => {
                setIsFetchingRequest(false);
            });
    }, [selectedRequestId, requests, fetchAndUpdateSingleRequest]);

    const activeRequest = directRequest || requests.find(r => r.id === selectedRequestId);

    // Ensure client & car are available (fetch directly if missing from local memory on mobile)
    useEffect(() => {
        if (!activeRequest) return;

        // Fetch client if missing
        if (activeRequest.client_id) {
            const localClient = clients.find(c => c.id === activeRequest.client_id);
            if (localClient) {
                setDirectClient(localClient);
            } else {
                supabase.from('clients').select('*').eq('id', activeRequest.client_id).maybeSingle()
                    .then(({ data }) => {
                        if (data) setDirectClient(data as Client);
                    });
            }
        }

        // Fetch car if missing
        if (activeRequest.car_id) {
            const localCar = cars.find(c => c.id === activeRequest.car_id);
            if (localCar) {
                setDirectCar(localCar);
            } else {
                supabase.from('cars').select('*').eq('id', activeRequest.car_id).maybeSingle()
                    .then(({ data }) => {
                        if (data) setDirectCar(data as Car);
                    });
            }
        }
    }, [activeRequest, clients, cars]);

    const activeClient = directClient || (activeRequest ? clients.find(c => c.id === activeRequest.client_id) : undefined);
    const activeCar = directCar || (activeRequest ? cars.find(c => c.id === activeRequest.car_id) : undefined);
    const activeCarModel = activeCar ? carModels.find(m => m.id === activeCar.model_id) : undefined;
    const activeCarMake = activeCar ? carMakes.find(m => m.id === activeCar.make_id) : undefined;
    const activeInspectionType = activeRequest 
        ? (inspectionTypes.find(i => i.id === activeRequest.inspection_type_id) || { id: activeRequest.inspection_type_id, name: 'فحص' } as InspectionType)
        : undefined;

    // Fail-safe: Data is considered ready as long as we have activeRequest and activeInspectionType
    const isDataMissing = !activeRequest || !activeInspectionType;

    // Image Preloading Logic with fast 2.5s maximum timeout
    useEffect(() => {
        const urlsToLoad = [
            settings.logoUrl,
            activeCarMake?.logo_url,
            settings.draftSettings?.customImageUrl
        ].filter(Boolean) as string[];
        
        if (urlsToLoad.length > 0) {
            setIsContentReady(false);
            
            let loadedCount = 0;
            const total = urlsToLoad.length;
            
            const handleImageLoad = () => {
                loadedCount++;
                if (loadedCount >= total) {
                    setTimeout(() => setIsContentReady(true), 200);
                }
            };

            urlsToLoad.forEach(url => {
                const img = new Image();
                img.src = url;
                img.onload = handleImageLoad;
                img.onerror = () => {
                    handleImageLoad();
                };
            });

            // Fast fail-safe timeout (2.5 seconds) so user NEVER gets stuck on mobile
            const timeout = setTimeout(() => {
                setIsContentReady(true);
            }, 2500);

            return () => clearTimeout(timeout);
        } else {
            const timer = setTimeout(() => setIsContentReady(true), 80);
            return () => clearTimeout(timer);
        }
    }, [settings.logoUrl, activeCarMake?.logo_url, settings.draftSettings?.customImageUrl]);

    // Printing Logic (Only when content is ready AND data is available)
    useEffect(() => {
        if (shouldPrintDraft && isContentReady && !isDataMissing && !isFetchingRequest && !isRefreshing) {
            const timer = setTimeout(() => {
                window.print();
                window.sessionStorage.setItem('skipScrollRestoration', 'true');
                setShouldPrintDraft(false); 
                goBack(); 
            }, 600);

            return () => clearTimeout(timer);
        }
    }, [shouldPrintDraft, isContentReady, isDataMissing, isFetchingRequest, isRefreshing, setShouldPrintDraft, goBack]);

    if (isDataMissing || !isContentReady || isFetchingRequest) {
        return (
             <div className="flex flex-col items-center justify-center h-screen text-center p-6 sm:p-8 bg-slate-50 dark:bg-slate-900" dir="rtl">
                <div className="relative">
                    <RefreshCwIcon className="w-14 h-14 sm:w-16 sm:h-16 text-blue-500 animate-spin mb-4" />
                    {!isContentReady && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Icon name="gallery" className="w-6 h-6 text-blue-400 animate-pulse" />
                        </div>
                    )}
                </div>
                <p className="text-lg sm:text-xl text-gray-800 dark:text-gray-200 font-bold mb-2">
                    {(!isContentReady) ? 'جاري تجهيز الطباعة...' : (isFetchingRequest || isRefreshing) ? 'جاري جلب البيانات من الخادم...' : 'جاري معالجة الطلب...'}
                </p>
                <div className="max-w-md">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {(!isContentReady) 
                            ? 'يرجى الانتظار، نقوم بتحميل الشعار والرسوم لضمان طباعة سليمة واحترافية.' 
                            : 'سيتم نقلك فوراً إلى نافذة الطباعة بمجرد اكتمال البيانات.'}
                    </p>
                </div>
                
                {/* Allow aborting if stuck */}
                {(!activeRequest && isContentReady && !isFetchingRequest && !isRefreshing) && (
                    <div className="flex flex-col items-center gap-2 mt-6">
                        <p className="text-red-500 text-sm mb-2">تعذر العثور على بيانات هذا الطلب.</p>
                        <Button onClick={() => setPage('requests')} variant="secondary">
                            العودة للطلبات
                        </Button>
                    </div>
                )}
            </div>
        );
    }
    
    const handlePrint = () => window.print();
    const handleStartFilling = () => setPage('fill-request');
    const handleBack = () => {
        window.sessionStorage.setItem('skipScrollRestoration', 'true');
        goBack();
    };

    const pageData = {
        request: activeRequest,
        client: activeClient,
        car: activeCar,
        carMake: activeCarMake,
        carModel: activeCarModel,
        inspectionType: activeInspectionType
    };

    return (
        <div className={isDraftQuality ? 'draft-quality-print' : ''} dir="rtl">
            
            {/* Action Header (No Print) */}
            <div className="no-print sticky top-0 z-20 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-xs">
                 <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 sm:py-4 gap-2 border-b border-gray-200 dark:border-slate-700">
                    <h2 className="text-base sm:text-xl font-bold text-gray-800 dark:text-gray-200">
                        مسودة طلب فحص يدوي #{activeRequest.request_number}
                    </h2>
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                        <Button variant="secondary" onClick={handleBack} leftIcon={<Icon name="back" className="w-4 h-4 sm:w-5 sm:h-5 transform scale-x-[-1]" />}>
                           العودة
                        </Button>
                        {!shouldPrintDraft && (
                            <>
                                <Button onClick={handleStartFilling} variant="secondary" leftIcon={<Icon name="edit" className="w-4 h-4 sm:w-5 sm:h-5" />}>
                                   بدء التعبئة
                                </Button>
                                <div className="flex items-center gap-2 sm:gap-3 p-1 sm:p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <label htmlFor="draft-quality-toggle" className="hidden sm:flex items-center cursor-pointer gap-2">
                                        <input
                                            type="checkbox"
                                            id="draft-quality-toggle"
                                            checked={isDraftQuality}
                                            onChange={(e) => setIsDraftQuality(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                                            جودة مسودة
                                        </span>
                                    </label>
                                    <Button onClick={handlePrint} leftIcon={<Icon name="print" className="w-4 h-4 sm:w-5 sm:h-5" />}>
                                        طباعة
                                    </Button>
                                </div>
                            </>
                        )}
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
                body, * {
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
                    width: 100% !important;
                    min-height: 100vh !important;
                    color: black !important;
                }
                .printable-content, .printable-content *, .printable-content svg, .printable-content svg * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .printable-content header {
                    display: flex !important;
                }
                .lined-paper {
                    background-image: linear-gradient(to bottom, transparent calc(2.5rem - 1px), #d1d5db calc(2.5rem - 1px)) !important;
                }
                .draft-quality-print .printable-content {
                    filter: grayscale(80%) opacity(75%);
                }
            `}
            </style>
            
            {/* Screen View (Responsive Container on Mobile & Desktop) */}
            <div className="no-print py-4 sm:py-8 px-2 sm:px-4 bg-gray-100 dark:bg-gray-900 flex justify-center overflow-x-auto">
                 <div className="shadow-2xl rounded-lg overflow-hidden max-w-full">
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
