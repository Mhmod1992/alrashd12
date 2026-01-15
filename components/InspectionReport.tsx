
import React, { useMemo, useEffect, useRef } from 'react';
import { InspectionRequest, Client, Car, CarMake, CarModel, InspectionType, CustomFindingCategory, PredefinedFinding, Settings, Note, StructuredFinding, ReportSettings, ReportStamp, ReportFontSizes, HighlightColor } from '../types';
import { useAppContext } from '../context/AppContext';
import Icon from './Icon';

interface InspectionReportProps {
    request: InspectionRequest;
    client: Client;
    car: Car;
    carMake?: CarMake;
    carModel?: CarModel;
    inspectionType: InspectionType;
    customFindingCategories: CustomFindingCategory[];
    predefinedFindings: PredefinedFinding[];
    settings: Settings;
    isPrintView?: boolean;
    reportDirection?: 'rtl' | 'ltr';
}

declare const QRCodeStyling: any;

const highlightBaseColors: Record<HighlightColor, { rgb: string; text: string }> = {
    yellow: { rgb: '250, 204, 21', text: 'text-yellow-950' },
    red: { rgb: '239, 68, 68', text: 'text-red-950' },
    green: { rgb: '34, 197, 94', text: 'text-green-950' },
    blue: { rgb: '59, 130, 246', text: 'text-blue-950' },
};

const getHighlightStyle = (color: HighlightColor, opacity: number): React.CSSProperties => {
    const config = highlightBaseColors[color];
    return {
        backgroundColor: `rgba(${config.rgb}, ${opacity})`,
    };
};

const printSizeMap: Record<string, string> = {
    'text-6xl': 'text-5xl', 'text-5xl': 'text-4xl', 'text-4xl': 'text-3xl',
    'text-3xl': 'text-2xl', 'text-2xl': 'text-xl', 'text-xl': 'text-lg',
    'text-lg': 'text-base', 'text-base': 'text-sm', 'text-sm': 'text-xs',
    'text-xs': 'text-[10px]', 'text-[10px]': 'text-[9px]', 'text-[9px]': 'text-[8px]',
};
const getPrintSize = (screenSize: string | undefined): string | undefined => screenSize ? (printSizeMap[screenSize] || screenSize) : undefined;

const generateWatermarkStyle = (text: string, settings: ReportSettings): React.CSSProperties => {
    const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const opacity = settings.watermarkOpacity ?? 0.06;
    const fontSize = settings.watermarkSize ?? 30;
    const hSpacing = settings.watermarkRepeatSpacing ?? 250;
    const vSpacing = hSpacing * 0.4;
    const rotation = settings.watermarkRotation ?? -25;
    const isOutline = settings.watermarkTextStyle === 'outline';
    const color = `rgba(0,0,0,${opacity})`;

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${hSpacing}" height="${vSpacing}">
            <text x="50%" y="50%" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="${isOutline ? 'none' : color}" stroke="${isOutline ? color : 'none'}" stroke-width="${isOutline ? '1' : '0'}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rotation}, ${hSpacing / 2}, ${vSpacing / 2})">
                ${safeText}
            </text>
        </svg>
    `;

    return {
        backgroundImage: `url("data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}")`,
        backgroundRepeat: 'repeat',
        backgroundPosition: '0 0',
        backgroundSize: `${hSpacing}px ${vSpacing}px`,
        WebkitPrintColorAdjust: 'exact',
        // @ts-ignore
        printColorAdjust: 'exact'
    };
};

const ReportHeader: React.FC<{ appName: string; logoUrl: string | null; settings: ReportSettings; requestNumber: number; isPrintView?: boolean; direction?: 'rtl' | 'ltr' }> = ({ appName, logoUrl, settings, requestNumber, isPrintView, direction }) => {
    const qrCodeRef = useRef<HTMLDivElement>(null);
    const { fontSizes } = settings;

    useEffect(() => {
        if (!settings.showQrCode || !qrCodeRef.current || typeof QRCodeStyling === 'undefined') return;
        const content = settings.qrCodeContent.replace('{request_number}', String(requestNumber));
        const size = parseInt(settings.qrCodeSize, 10) || 96;
        const qrCode = new QRCodeStyling({
            width: size, height: size, data: content, margin: 0,
            dotsOptions: { color: settings.qrCodeStyle?.color || '#000000', type: settings.qrCodeStyle?.dotsOptions?.style || 'square' },
            cornersSquareOptions: { color: settings.qrCodeStyle?.color || '#000000', type: settings.qrCodeStyle?.cornersSquareOptions?.style || 'square' },
            backgroundOptions: { color: 'transparent' },
        });
        qrCodeRef.current.innerHTML = '';
        qrCode.append(qrCodeRef.current);
    }, [settings, requestNumber]);

    return (
        <header data-setting-section="colors-backgrounds" className={`flex justify-between items-start ${isPrintView ? 'pb-2 mb-2 border-b-2' : 'pb-4 mb-4 border-b-2'} ${settings.qrCodePosition === 'right' ? 'flex-row-reverse' : ''}`} style={{ borderColor: settings.borderColor }}>
            <div className={`text-${direction === 'ltr' ? 'left' : 'right'}`}>
                <h1 data-setting-section="colors-primary" className={`${isPrintView ? getPrintSize(fontSizes.headerTitle) : fontSizes.headerTitle} ${settings.headerTitleBold ? 'font-bold' : 'font-normal'}`} style={{ color: settings.appNameColor }}>{appName}</h1>
                <p className={`mt-1 ${isPrintView ? getPrintSize(fontSizes.headerSubtitle) : fontSizes.headerSubtitle} ${settings.headerSubtitleBold ? 'font-bold' : 'font-normal'}`} style={{ color: settings.textColor, opacity: 0.8 }}>{settings.headerSubtitleText}</p>
                
                {/* Custom Fields (CR, VAT, etc.) */}
                {settings.headerCustomFields && settings.headerCustomFields.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] sm:text-xs" style={{ color: settings.textColor }}>
                        {settings.headerCustomFields.map(field => (
                            <div key={field.id}>
                                <span className="font-bold opacity-80">{field.label}:</span> <span className="font-mono opacity-100">{field.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-2 space-y-1">
                    {settings.headerAdditionalTexts && settings.headerAdditionalTexts.map(textItem => (
                        <p key={textItem.id} className={`${isPrintView ? getPrintSize(fontSizes.headerAdditional) : fontSizes.headerAdditional} ${textItem.bold ? 'font-bold' : 'font-normal'}`} style={{ color: settings.textColor, opacity: 0.7 }}>{textItem.text}</p>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-4">
                {settings.showQrCode && (
                    <div data-setting-section="branding-qr" className="target-qr border flex items-center justify-center bg-white overflow-hidden" style={{ borderColor: settings.borderColor, width: settings.qrCodeSize, height: settings.qrCodeSize }}>
                        <div ref={qrCodeRef} className="flex justify-center items-center [&>canvas]:max-w-full [&>canvas]:max-h-full [&>svg]:max-w-full [&>svg]:max-h-full" />
                    </div>
                )}
                {logoUrl && <img src={logoUrl} alt="Workshop Logo" className={`target-logo w-auto object-contain`} style={{ height: `${settings.workshopLogoHeight ?? 90}px` }} />}
            </div>
        </header>
    );
};

const InfoBlock: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; settings: ReportSettings; className?: string; contentClassName?: string; isPrintView?: boolean; direction?: 'rtl' | 'ltr' }> = ({ title, icon, children, settings, className = "", contentClassName = "space-y-2", isPrintView, direction }) => (
    <div data-setting-section="colors-backgrounds" className={`info-block border rounded-lg ${isPrintView ? 'p-2' : 'p-2'} flex flex-col ${className}`} style={{ borderColor: settings.borderColor }}>
        <h3 data-setting-section="colors-primary" className={`font-bold flex items-center gap-2 ${isPrintView ? 'mb-1 pb-1' : 'mb-2 pb-1'} border-b ${isPrintView ? getPrintSize(settings.fontSizes.blockTitle) : settings.fontSizes.blockTitle} ${direction === 'ltr' ? 'flex-row' : ''}`} style={{ color: settings.primaryColor, borderColor: settings.borderColor }}>
            {icon}
            {title}
        </h3>
        <div className={`flex-grow ${contentClassName}`}>{children}</div>
    </div>
);

const InfoPair: React.FC<{ label: string; value?: React.ReactNode; className?: string; isPrintView?: boolean; fontSizes: ReportFontSizes; direction?: 'rtl' | 'ltr' }> = ({ label, value, className = "", isPrintView, fontSizes, direction }) => (
    <div className={`flex justify-between items-center gap-2 ${className} ${direction === 'ltr' ? 'flex-row' : ''}`}>
        <span className={`font-semibold whitespace-nowrap opacity-80 ${isPrintView ? getPrintSize(fontSizes.blockLabel) : fontSizes.blockLabel}`}>{label}:</span>
        <div className={`text-${direction === 'ltr' ? 'right' : 'left'} font-medium ${isPrintView ? getPrintSize(fontSizes.blockContent) : fontSizes.blockContent}`}>{value || '-'}</div>
    </div>
);

const FindingCategorySection: React.FC<{ title: string, children: React.ReactNode; settings: ReportSettings; technicians?: string[]; isPrintView?: boolean; direction?: 'rtl' | 'ltr' }> = ({ title, children, settings, technicians, isPrintView, direction }) => (
    <div data-setting-section="colors-backgrounds" className={`finding-category border rounded-lg overflow-hidden ${isPrintView ? 'mb-2' : 'mb-4'}`} style={{ borderColor: settings.borderColor }}>
        <div data-setting-section="colors-section-titles" className={`${isPrintView ? 'p-1' : 'p-2'} flex justify-center items-center`} style={{ backgroundColor: settings.findingsHeaderBackgroundColor, color: settings.findingsHeaderFontColor }}>
            <h3 className={`font-bold ${isPrintView ? getPrintSize(settings.fontSizes.categoryTitle) : settings.fontSizes.categoryTitle}`}>{title}</h3>
        </div>
        <div className={isPrintView ? 'p-2' : 'p-3'} style={{ backgroundColor: settings.findingContainerBackgroundColor }}>
            {children}
            {technicians && technicians.length > 0 && (
                <div className={`border-t flex ${direction === 'ltr' ? 'justify-start' : 'justify-end'} items-center gap-2 ${isPrintView ? 'mt-2 pt-1' : 'mt-4 pt-2'}`} style={{ borderColor: settings.borderColor }}>
                    <span className="text-xs opacity-70" style={{ color: settings.textColor }}>{direction === 'ltr' ? 'Inspected by:' : 'تم الفحص بواسطة:'}</span>
                    <span className={`font-bold ${isPrintView ? 'text-xs' : 'text-sm'}`} style={{ color: settings.primaryColor }}>{technicians.join('، ')}</span>
                </div>
            )}
        </div>
    </div>
);

const FindingItem: React.FC<{ finding: StructuredFinding; predefinedFinding?: PredefinedFinding; settings: ReportSettings; isPrintView?: boolean; direction?: 'rtl' | 'ltr' }> = ({ finding, predefinedFinding, settings, isPrintView, direction }) => {
    const { fontSizes } = settings;
    return (
        <div data-setting-section="layout-cards" className="finding-item border rounded-lg text-center flex flex-col shadow-sm bg-white overflow-hidden h-full" style={{ borderColor: settings.borderColor }}>
            <div className="finding-img-container bg-white flex items-center justify-center overflow-hidden relative p-1 h-20 flex-shrink-0">
                {predefinedFinding?.reference_image ? (
                    <img
                        src={predefinedFinding.reference_image}
                        alt={finding.findingName}
                        className="w-full h-full object-contain"
                        style={{ objectPosition: predefinedFinding?.reference_image_position || 'center' }}
                    />
                ) : (
                    <span className={`text-gray-300 ${isPrintView ? 'text-[10px]' : 'text-xs'}`}>No Img</span>
                )}
            </div>
            <div className={`finding-content flex-grow flex flex-col items-center justify-center text-center w-full ${isPrintView ? 'p-1' : 'p-2'}`} style={{ backgroundColor: '#f8fafc' }}>
                <div className="finding-text-wrapper w-full flex flex-col items-center justify-center">
                    <h4 className={`font-bold w-full leading-tight line-clamp-2 mb-1 break-words whitespace-pre-wrap ${isPrintView ? 'text-[9px]' : fontSizes.findingTitle}`}><span>{finding.findingName}</span></h4>
                    {finding.value?.trim() && <p className={`font-medium w-full text-slate-600 break-words whitespace-pre-wrap ${isPrintView ? 'text-[9px]' : fontSizes.findingValue}`}><span>{finding.value}</span></p>}
                </div>
            </div>
        </div>
    );
};

const ImageNoteCard: React.FC<{ note: Note; categoryName: string; settings: ReportSettings; isPrintView?: boolean; direction?: 'rtl' | 'ltr' }> = ({ note, categoryName, settings, isPrintView, direction }) => {
    const { fontSizes } = settings;
    const aspectClass = { small: 'aspect-[16/9]', medium: 'aspect-[4/3]', large: 'aspect-square' }[settings.noteImageSize] || 'aspect-[4/3]';
    const displayLang = note.displayTranslation?.isActive ? note.displayTranslation.lang : undefined;
    const displayText = (displayLang && note.translations?.[displayLang]) ? note.translations[displayLang] : note.text;

    const highlightStyle = note.highlightColor ? getHighlightStyle(note.highlightColor, settings.noteHighlightOpacity || 0.1) : {};
    const textClassName = note.highlightColor ? `px-1.5 py-0.5 rounded-md inline decoration-clone leading-relaxed font-bold ${highlightBaseColors[note.highlightColor].text}` : '';

    return (
        <div data-setting-section="layout-cards" className="image-note-card bg-white rounded-lg border shadow-sm flex flex-col items-center text-center" style={{ borderColor: settings.borderColor }}>
            {note.image && <img src={note.image} alt="Note" className={`object-cover w-full ${aspectClass} mx-auto`} style={{ borderBottom: `1px solid ${settings.noteImageBorderColor}` }} />}
            <div className={`flex-grow flex flex-col w-full ${isPrintView ? 'p-2' : 'p-3'}`}>
                <p className="text-xs font-bold mb-1 w-full" style={{ color: settings.primaryColor }}>{categoryName}</p>
                <div className={`flex-grow mb-2 w-full break-words whitespace-pre-wrap ${isPrintView ? getPrintSize(fontSizes.noteText) : fontSizes.noteText}`}>
                    {note.highlightColor ? (
                        <span style={highlightStyle} className={textClassName}>{displayText}</span>
                    ) : (
                        <span style={{ color: settings.textColor }}>{displayText}</span>
                    )}
                </div>
                {note.authorName && <p className="text-xs font-semibold mt-auto pt-2 border-t w-full" style={{ color: settings.textColor, opacity: 0.7, borderColor: settings.borderColor }}>{note.authorName}</p>}
            </div>
        </div>
    );
};

const FormattedPlate: React.FC<{ plateNumber: string; settings: Settings; isPrintView?: boolean }> = ({ plateNumber, settings, isPrintView }) => {
    const parts = plateNumber.split(' ').filter(Boolean);
    const arabicLettersRaw = parts.filter(p => !/^\d+$/.test(p)).join('');
    const numbersRaw = parts.find(p => /^\d+$/.test(p)) || '';
    const arToEnMap = new Map<string, string>();
    if (settings?.plateCharacters) { settings.plateCharacters.forEach(pc => { arToEnMap.set(pc.ar.replace('ـ', ''), pc.en); }); }
    const englishLetters = arabicLettersRaw.split('').map(char => arToEnMap.get(char) || char).join('');

    return (
        <div className={`flex flex-row items-center ${isPrintView ? 'gap-2' : 'gap-4'}`} dir="rtl">
            <div className={`flex flex-row ${isPrintView ? 'gap-1' : 'gap-1.5'}`}>
                {arabicLettersRaw.split('').map((ar, i) => (
                    <div key={i} className="flex flex-col items-center font-bold">
                        <span className={`${isPrintView ? 'text-sm' : 'text-base'} leading-tight`}>{ar}</span>
                        <div className="w-full h-px bg-slate-300 dark:bg-slate-600 my-0.5 opacity-50"></div>
                        <span className={`font-sans ${isPrintView ? 'text-[9px]' : 'text-[11px]'} leading-tight mt-0.5`}>{englishLetters[i] || ''}</span>
                    </div>
                ))}
            </div>
            <div className={`flex flex-row tracking-tight border-r ${isPrintView ? 'pr-2' : 'pr-3'}`} dir="ltr" style={{ borderColor: '#cbd5e1' }}>
                {numbersRaw.split('').map((num, i) => (
                    <div key={i} className="flex flex-col items-center font-bold">
                        <span className={`font-numeric ${isPrintView ? 'text-sm' : 'text-base'} leading-tight`}>{num}</span>
                        <div className="w-full h-px bg-slate-300 dark:bg-slate-600 my-0.5 opacity-50"></div>
                        <span className={`font-numeric ${isPrintView ? 'text-[9px]' : 'text-[11px]'} leading-tight mt-0.5`}>{num}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const InspectionReport = React.forwardRef<HTMLDivElement, InspectionReportProps>((props, ref) => {
    const { request, client, car, carMake, carModel, inspectionType, customFindingCategories, predefinedFindings, settings, isPrintView, reportDirection = 'rtl' } = props;
    const { appName, reportSettings } = settings;
    const { fontSizes } = reportSettings;
    const { technicians, employees } = useAppContext();

    const carDetails = useMemo(() => {
        if (request.car_snapshot) {
            return {
                makeNameEn: request.car_snapshot.make_en, modelNameEn: request.car_snapshot.model_en,
                makeNameAr: request.car_snapshot.make_ar, modelNameAr: request.car_snapshot.model_ar,
                year: request.car_snapshot.year,
            };
        }
        return {
            makeNameEn: carMake?.name_en || 'Unknown', modelNameEn: carModel?.name_en || 'Unknown',
            makeNameAr: carMake?.name_ar || 'غير معروف', modelNameAr: carModel?.name_ar || 'غير معروف',
            year: car.year,
        };
    }, [request.car_snapshot, car, carMake, carModel]);

    const visibleCategoryIds = inspectionType.finding_category_ids;

    const hasAnyFindings = useMemo(() => {
        const { structured_findings, general_notes, category_notes } = request;
        if (structured_findings && structured_findings.length > 0) return true;
        if (general_notes && general_notes.length > 0) return true;
        if (category_notes && Object.values(category_notes).some(notes => notes && (notes as Note[]).length > 0)) return true;
        return false;
    }, [request]);

    const allImageNotes = useMemo(() => {
        const collectedNotes: { note: Note; categoryName: string }[] = [];
        visibleCategoryIds.forEach(catId => {
            const category = customFindingCategories.find(c => c.id === catId);
            if (category) {
                const imageNotes = ((request.category_notes?.[catId] as Note[]) || []).filter(note => !!note.image);
                imageNotes.forEach(note => collectedNotes.push({ note, categoryName: category.name }));
            }
        });
        ((request.general_notes as Note[]) || []).filter(note => !!note.image).forEach(note => collectedNotes.push({ note, categoryName: reportDirection === 'ltr' ? 'General Notes' : 'ملاحظات عامة' }));
        return collectedNotes;
    }, [request.category_notes, request.general_notes, visibleCategoryIds, customFindingCategories, reportDirection]);

    const generalTextOnlyNotes = ((request.general_notes as Note[]) || []).filter(note => !note.image);
    
    // Updated Logic: Get Technicians (Workers) AND Employees (System Users marked as Technicians)
    const getAssignedTechnicians = (categoryId: string) => {
        const assignedIds = request.technician_assignments?.[categoryId] || [];
        const techNames = technicians.filter(t => assignedIds.includes(t.id)).map(t => t.name);
        const empNames = employees.filter(e => assignedIds.includes(e.id)).map(e => e.name);
        return [...techNames, ...empNames];
    };

    const getStampText = (stamp: ReportStamp): React.ReactNode => {
        if (stamp === 'CUSTOMER_REQUEST_INCOMPLETE') return <>{reportDirection === 'ltr' ? 'INCOMPLETE REQUEST' : 'لم يتم اكمال الفحص'}<br /><span className="text-xl">{reportDirection === 'ltr' ? 'By Client Request' : 'بناء على طلب العميل'}</span></>;
        return '';
    };

    const getBulletStyle = (): React.CSSProperties => {
        const size = reportSettings.bulletSize ?? 6;
        const color = reportSettings.bulletColor ?? '#94a3b8';
        const style = reportSettings.bulletStyle ?? 'circle';
        return { width: `${size}px`, height: style === 'dash' ? '2px' : `${size}px`, backgroundColor: color, borderRadius: style === 'circle' ? '9999px' : style === 'square' ? '2px' : '0', marginTop: style === 'dash' ? `${size / 2}px` : '6px' };
    };

    return (
        <div style={{ backgroundColor: reportSettings.pageBackgroundColor, color: reportSettings.textColor, fontFamily: reportSettings.fontFamily }}>
            <div ref={ref} className={`relative ${isPrintView ? 'p-[10mm] print:p-0' : 'p-4 sm:p-6 print:p-0'}`} dir={reportDirection}>
                {request.report_stamps && request.report_stamps.length > 0 && (
                    <div className={`absolute inset-0 z-10 flex flex-col ${reportDirection === 'ltr' ? 'items-start' : 'items-end'} justify-start gap-8 pointer-events-none p-12 pt-40`}>
                        {request.report_stamps.map(stamp => <div key={stamp} className="border-2 border-red-500/90 text-red-500/90 p-3 rounded-md transform -rotate-12 text-center [filter:drop-shadow(0_4px_3px_rgba(0,0,0,0.5))] max-w-xs"><span className="text-2xl font-black tracking-wider leading-tight">{getStampText(stamp)}</span></div>)}
                    </div>
                )}

                <div className="relative z-0">
                    <div className="report-header-section">
                        <ReportHeader appName={appName} logoUrl={reportSettings.reportLogoUrl} settings={reportSettings} requestNumber={request.request_number} isPrintView={isPrintView} direction={reportDirection} />
                        
                        <div className={`${isPrintView ? 'mb-2 space-y-2' : 'mb-6 space-y-4'}`}>
                            <InfoBlock title={reportDirection === 'ltr' ? "Client Details" : "بيانات العميل"} icon={<Icon name="employee" className="w-5 h-5" />} settings={reportSettings} contentClassName={isPrintView ? `grid ${reportSettings.showPriceOnReport ? 'grid-cols-3' : 'grid-cols-2'} gap-2 items-center` : `grid grid-cols-1 ${reportSettings.showPriceOnReport ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6 items-center`} isPrintView={isPrintView} direction={reportDirection}>
                                <div className={`flex justify-start items-center ${isPrintView ? 'gap-2' : 'gap-3'}`}><span className={`font-bold opacity-70 whitespace-nowrap ${isPrintView ? getPrintSize(fontSizes.blockLabel) : fontSizes.blockLabel}`}>{reportDirection === 'ltr' ? 'Name:' : 'الاسم:'}</span><span className={`font-bold ${isPrintView ? getPrintSize(fontSizes.blockHeader) : fontSizes.blockHeader}`}>{client.name}</span></div>
                                <div className={`flex justify-start items-center ${isPrintView ? 'gap-2' : 'gap-3'}`}><span className={`font-bold opacity-70 whitespace-nowrap ${isPrintView ? getPrintSize(fontSizes.blockLabel) : fontSizes.blockLabel}`}>{reportDirection === 'ltr' ? 'Phone:' : 'الجوال:'}</span><span className={`font-bold dir-ltr ${isPrintView ? getPrintSize(fontSizes.blockHeader) : fontSizes.blockHeader}`}>{client.phone}</span></div>
                                {reportSettings.showPriceOnReport && <div className={`flex justify-start items-center ${isPrintView ? 'gap-2' : 'gap-3'}`}><span className={`font-bold opacity-70 whitespace-nowrap ${isPrintView ? getPrintSize(fontSizes.blockLabel) : fontSizes.blockLabel}`}>{reportDirection === 'ltr' ? 'Total:' : 'المبلغ:'}</span><span className={`font-bold ${isPrintView ? getPrintSize(fontSizes.blockHeader) : fontSizes.blockHeader}`}>{request.price} {reportDirection === 'ltr' ? 'SAR' : 'ريال'}</span></div>}
                            </InfoBlock>

                            <div className={isPrintView ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 md:grid-cols-3 gap-4"}>
                                <div className={isPrintView ? "col-span-2" : "md:col-span-2"}>
                                    <InfoBlock title={reportDirection === 'ltr' ? "Vehicle Details" : "بيانات السيارة"} icon={<Icon name="cars" className="w-5 h-5" />} settings={reportSettings} className="h-full" isPrintView={isPrintView} direction={reportDirection}>
                                        <div className={isPrintView ? "flex flex-row items-center justify-between gap-2 px-0 h-full" : "flex flex-col sm:flex-row items-center justify-between gap-6 px-2 h-full"}>
                                            <div className="space-y-1">
                                                <h2 className={`font-black opacity-90 leading-tight ${isPrintView ? getPrintSize(fontSizes.carName) : fontSizes.carName}`}>{`${carDetails.makeNameEn} ${carDetails.modelNameEn}`}</h2>
                                                <p className={`font-semibold opacity-75 ${isPrintView ? getPrintSize(fontSizes.blockContent) : fontSizes.blockContent}`}>{`${carDetails.makeNameAr} ${carDetails.modelNameAr}`}</p>
                                                <div className={`flex wrap items-center ${isPrintView ? 'gap-1 pt-1' : 'gap-3 pt-2'}`}><span className={`inline-block bg-slate-100 border border-slate-200 rounded font-bold ${isPrintView ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm'}`} style={{ borderColor: reportSettings.borderColor }}>{reportDirection === 'ltr' ? 'Year' : 'سنة الصنع'} {carDetails.year}</span></div>
                                            </div>
                                            {carMake?.logo_url && <div className={`target-car-logo flex-shrink-0 self-center ${isPrintView ? 'block' : 'hidden sm:block'} opacity-80 mix-blend-multiply`}><img src={carMake.logo_url} alt="Logo" className={`w-auto object-contain max-w-[200px]`} style={{ height: `${reportSettings.carLogoHeight ?? 60}px` }} /></div>}
                                            <div className={`flex-shrink-0 self-center ${reportDirection === 'ltr' ? 'border-l-4 mr-10 pl-6' : 'border-r-4 ml-10 pr-6'} ${isPrintView ? 'py-0' : 'py-2'}`} style={{ borderColor: reportSettings.borderColor }}>
                                                {car.vin || (car.plate_number && car.plate_number.startsWith('شاصي')) ? <div className="text-center"><div className="text-xs opacity-70 mb-1">VIN</div><span className={`font-mono tracking-wider font-bold bg-slate-100 rounded ${isPrintView ? 'text-sm p-1' : 'text-lg p-2'}`}>{car.vin || car.plate_number?.replace('شاصي ', '')}</span></div> : car.plate_number ? <div className={`transform origin-center ${isPrintView ? 'scale-100 p-0' : 'scale-150 p-2'}`}><FormattedPlate plateNumber={car.plate_number} settings={settings} isPrintView={isPrintView} /></div> : <div className="text-center text-sm text-gray-400">No Plate</div>}
                                            </div>
                                        </div>
                                    </InfoBlock>
                                </div>
                                <div>
                                    <InfoBlock title={reportDirection === 'ltr' ? "Request Info" : "بيانات الطلب"} icon={<Icon name="document-report" className="w-5 h-5" />} settings={reportSettings} className="h-full" isPrintView={isPrintView} direction={reportDirection}>
                                        <InfoPair label={reportDirection === 'ltr' ? "Report No." : "رقم التقرير"} value={<strong>#{request.request_number}</strong>} isPrintView={isPrintView} fontSizes={fontSizes} direction={reportDirection} />
                                        <InfoPair label={reportDirection === 'ltr' ? "Date" : "التاريخ"} value={new Date(request.created_at).toLocaleDateString('en-GB')} isPrintView={isPrintView} fontSizes={fontSizes} direction={reportDirection} />
                                        <InfoPair label={reportDirection === 'ltr' ? "Time" : "الوقت"} value={new Date(request.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} isPrintView={isPrintView} fontSizes={fontSizes} direction={reportDirection} />
                                        <InfoPair label={reportDirection === 'ltr' ? "Type" : "نوع الفحص"} value={inspectionType.name} isPrintView={isPrintView} fontSizes={fontSizes} direction={reportDirection} />
                                    </InfoBlock>
                                </div>
                            </div>
                        </div>
                    </div>

                    {hasAnyFindings && (
                        <div className={isPrintView ? 'my-2' : 'my-4'}>
                            <h2 data-setting-section="colors-section-titles" className={`font-bold text-center rounded-lg ${isPrintView ? 'py-1' : 'py-2'} ${isPrintView ? getPrintSize(fontSizes.sectionTitle) : fontSizes.sectionTitle}`} style={{ backgroundColor: reportSettings.sectionTitleBackgroundColor, color: reportSettings.sectionTitleFontColor }}>
                                {reportDirection === 'ltr' ? 'Technical Inspection Results' : 'نتائج الفحص الفني'}
                            </h2>
                        </div>
                    )}

                    {visibleCategoryIds.map(catId => {
                        const category = customFindingCategories.find(c => c.id === catId);
                        if (!category) return null;
                        const allFindingsForCategory = (request.structured_findings || []).filter(f => f.categoryId === catId);
                        const sortedFindings = allFindingsForCategory.map(finding => {
                            const predefined = predefinedFindings.find(pf => pf.id === finding.findingId);
                            let positionPriority = 2;
                            if (predefined?.report_position === 'right') positionPriority = reportDirection === 'ltr' ? 3 : 1;
                            else if (predefined?.report_position === 'left') positionPriority = reportDirection === 'ltr' ? 1 : 3;
                            else if (predefined?.report_position === 'center') positionPriority = 2;
                            return { finding, predefined, positionPriority };
                        }).sort((a, b) => {
                            if (a.positionPriority !== b.positionPriority) return a.positionPriority - b.positionPriority;
                            return (a.predefined?.orderIndex ?? Number.MAX_SAFE_INTEGER) - (b.predefined?.orderIndex ?? Number.MAX_SAFE_INTEGER);
                        });

                        const textOnlyNotes = ((request.category_notes?.[catId] as Note[]) || []).filter(note => !note.image);
                        const techNames = getAssignedTechnicians(catId);
                        const watermarkStyle = generateWatermarkStyle(category.name, reportSettings);

                        if (allFindingsForCategory.length === 0 && textOnlyNotes.length === 0) {
                            return <FindingCategorySection title={category.name} key={catId} settings={reportSettings} technicians={techNames} isPrintView={isPrintView} direction={reportDirection}><div className={`text-center ${isPrintView ? 'py-2' : 'py-6'}`}><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxMGI5ODEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgNkw5IDE3bC01LTUiLz48L3N2Zz4=" alt="No Issues" className="mx-auto" style={{ width: '40px', height: '40px', display: 'block' }} /><p className="mt-2 font-bold" style={{ color: '#475569' }}>{reportDirection === 'ltr' ? 'No Issues Found' : 'بدون ملاحظات'}</p></div></FindingCategorySection>;
                        }

                        return (
                            <FindingCategorySection title={category.name} key={catId} settings={reportSettings} technicians={techNames} isPrintView={isPrintView} direction={reportDirection}>
                                {sortedFindings.length > 0 && <div className={`flex flex-wrap justify-center ${isPrintView ? 'gap-1.5' : 'gap-4'}`}>{sortedFindings.map(({ finding, predefined }) => <div key={finding.findingId} className={`${isPrintView ? 'w-[19%]' : 'w-[45%] sm:w-[30%] md:w-[22%] lg:w-[18%]'}`}><FindingItem finding={finding} predefinedFinding={predefined} settings={reportSettings} isPrintView={isPrintView} direction={reportDirection} /></div>)}</div>}
                                {textOnlyNotes.length > 0 && (
                                    <div data-setting-section="text-disclaimer" className={`w-full mt-2 rounded-lg border-2 border-dashed relative overflow-hidden ${isPrintView ? 'p-2' : 'p-3'}`} style={{ borderColor: reportSettings.borderColor, backgroundColor: '#ffffff', zIndex: 10, breakInside: 'auto', ...watermarkStyle }}>
                                        <div className="relative z-10"><h4 className={`font-bold border-b pb-1 mb-2 ${isPrintView ? 'text-xs' : 'text-sm'}`} style={{ color: reportSettings.primaryColor, borderColor: reportSettings.borderColor }}>{reportDirection === 'ltr' ? (allFindingsForCategory.length > 0 ? 'Technician Notes:' : 'Notes:') : (allFindingsForCategory.length > 0 ? 'ملاحظات الفني:' : 'ملاحظات:')}</h4><div className="space-y-1 p-0 m-0">{textOnlyNotes.map(note => { 
                                            const displayText = (note.displayTranslation?.isActive && note.translations?.[note.displayTranslation.lang]) ? note.translations[note.displayTranslation.lang] : note.text; 
                                            const highlightStyle = note.highlightColor ? getHighlightStyle(note.highlightColor, reportSettings.noteHighlightOpacity || 0.1) : {};
                                            const textClassName = note.highlightColor ? `px-1.5 py-0.5 rounded-md inline decoration-clone leading-relaxed font-bold ${highlightBaseColors[note.highlightColor].text}` : '';
                                            return <div key={note.id} className={`py-0.5 flex items-start ${isPrintView ? getPrintSize(fontSizes.noteText) : fontSizes.noteText}`}><span className={`inline-block ${reportDirection === 'ltr' ? 'me-4 ms-3' : 'ms-4 me-3'} flex-shrink-0`} style={getBulletStyle()}></span><div className="flex-1 min-w-0 break-words whitespace-pre-wrap">{note.highlightColor ? <span style={highlightStyle} className={textClassName}>{displayText}</span> : <span style={{ color: settings.reportSettings.textColor }}>{displayText}</span>}</div></div>; 
                                        })}</div></div>
                                    </div>
                                )}
                            </FindingCategorySection>
                        );
                    })}

                    {generalTextOnlyNotes.length > 0 && (
                        <FindingCategorySection title={reportDirection === 'ltr' ? "General Notes" : "ملاحظات عامة"} settings={reportSettings} isPrintView={isPrintView} direction={reportDirection}>
                            <div data-setting-section="text-disclaimer" className={`bg-white rounded-lg border-2 border-dashed relative overflow-hidden ${isPrintView ? 'p-2' : 'p-3'}`} style={{ borderColor: reportSettings.borderColor, backgroundColor: '#ffffff', ...generateWatermarkStyle(reportDirection === 'ltr' ? 'General Notes' : 'ملاحظات عامة', reportSettings) }}>
                                <div className="relative z-10 space-y-1 p-0 m-0">{generalTextOnlyNotes.map(note => { 
                                    const displayText = (note.displayTranslation?.isActive && note.translations?.[note.displayTranslation.lang]) ? note.translations[note.displayTranslation.lang] : note.text; 
                                    const highlightStyle = note.highlightColor ? getHighlightStyle(note.highlightColor, reportSettings.noteHighlightOpacity || 0.1) : {};
                                    const textClassName = note.highlightColor ? `px-1.5 py-0.5 rounded-md inline decoration-clone leading-relaxed font-bold ${highlightBaseColors[note.highlightColor].text}` : '';
                                    return <div key={note.id} className={`py-1 flex items-start ${isPrintView ? getPrintSize(fontSizes.noteText) : fontSizes.noteText}`}><span className={`inline-block ${reportDirection === 'ltr' ? 'me-4 ms-3' : 'ms-4 me-3'} flex-shrink-0`} style={getBulletStyle()}></span><div className="flex-1 min-w-0 break-words whitespace-pre-wrap">{note.highlightColor ? <span style={highlightStyle} className={textClassName}>{displayText}</span> : <span style={{ color: settings.reportSettings.textColor }}>{displayText}</span>}</div></div>; 
                                })}</div>
                            </div>
                        </FindingCategorySection>
                    )}

                    {allImageNotes.length > 0 && (
                        <FindingCategorySection title={reportDirection === 'ltr' ? "Attachments" : "الصور والملاحظات المرفقة"} settings={reportSettings} isPrintView={isPrintView} direction={reportDirection}>
                            <div className={`grid grid-cols-3 ${isPrintView ? 'gap-2' : 'gap-3'}`}>{allImageNotes.map(({ note, categoryName }) => <ImageNoteCard key={note.id} note={note} categoryName={categoryName} settings={reportSettings} isPrintView={isPrintView} direction={reportDirection} />)}</div>
                        </FindingCategorySection>
                    )}

                    <footer className={`border-t-2 flex justify-between items-start gap-4 ${isPrintView ? 'mt-4 pt-2' : 'mt-6 pt-4'}`} style={{ borderColor: reportSettings.borderColor }}>
                        <div className="flex-grow" style={{ color: reportSettings.textColor, opacity: 0.8 }}>
                            <p data-setting-section="text-disclaimer" className={`break-words whitespace-pre-wrap ${isPrintView ? getPrintSize(fontSizes.disclaimer) : fontSizes.disclaimer}`}><span className="font-bold">{reportDirection === 'ltr' ? 'Disclaimer:' : 'إخلاء مسؤولية:'}</span> {reportSettings.disclaimerText}</p>
                        </div>
                        <div data-setting-section="branding-stamp" className="flex-shrink-0 text-center">
                            <p className="font-bold text-xs mb-1" style={{ color: reportSettings.textColor, opacity: 0.7 }}>{reportDirection === 'ltr' ? 'Stamp' : 'ختم الورشة'}</p>
                            {reportSettings.workshopStampUrl ? <img src={reportSettings.workshopStampUrl} alt="Stamp" className={`${isPrintView ? 'w-16 h-16' : 'w-20 h-20'} print:w-16 print:h-16 object-contain mx-auto`} /> : <div className="w-20 h-20 border-2 border-dashed rounded-md flex items-center justify-center" style={{ borderColor: reportSettings.borderColor, opacity: 0.5 }}><span className="text-[10px]" style={{ color: reportSettings.textColor, opacity: 0.5 }}>{reportDirection === 'ltr' ? 'Stamp Here' : 'مكان الختم'}</span></div>}
                        </div>
                    </footer>
                    {reportSettings.showPageNumbers && <div className="page-footer-container"></div>}
                </div>
            </div>
        </div>
    );
});

export default InspectionReport;
