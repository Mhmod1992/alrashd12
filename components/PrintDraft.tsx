import React from 'react';
import { InspectionRequest, Client, Car, CarMake, CarModel, InspectionType, CustomFindingCategory } from '../types';

interface PrintDraftProps {
    request: InspectionRequest;
    client: Client;
    car: Car;
    carMake: CarMake;
    carModel: CarModel;
    inspectionType: InspectionType;
    price: number;
    appName: string;
    logoUrl?: string;
    customFindingCategories: CustomFindingCategory[];
}

const DraftWatermark: React.FC<{ text?: string }> = ({ text }) => {
    if (!text) return null;
    const reactId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
    const patternId = `wm-print-pat-${reactId}`;

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

const PrintDraft = React.forwardRef<HTMLDivElement, PrintDraftProps>((props, ref) => {
  const { request, client, car, carMake, carModel, inspectionType, price, appName, logoUrl } = props;
  
  return (
    <div ref={ref} className="print-only relative overflow-hidden">
      <DraftWatermark text={inspectionType?.name} />
      <div className="p-8 relative z-10" dir="rtl">
        <header className="flex justify-between items-center border-b-2 pb-4 mb-4">
            <div>
                <h1 className="text-3xl font-bold">{appName}</h1>
                <p>تقرير فحص مبدئي</p>
            </div>
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-16" />}
        </header>
        <div className="grid grid-cols-2 gap-4 text-lg">
            <p><strong>رقم الطلب:</strong> {request?.request_number}</p>
            <p><strong>تاريخ الطلب:</strong> {new Date(request?.created_at).toLocaleString('ar-EG')}</p>
            <p><strong>اسم العميل:</strong> {client?.name}</p>
            <p><strong>رقم الهاتف:</strong> {client?.phone}</p>
            <p><strong>السيارة:</strong> {carMake?.name_ar} {carModel?.name_ar}</p>
            <p><strong>سنة الصنع:</strong> {car?.year}</p>
            <p><strong>رقم اللوحة/الشاصي:</strong> {car?.plate_number}</p>
            <p><strong>نوع الفحص:</strong> <span className="bg-yellow-100 px-1 rounded">{inspectionType?.name}</span></p>
            <p className="font-bold text-xl"><strong>المبلغ:</strong> {price} ريال</p>
        </div>
        <footer className="mt-8 pt-4 border-t-2 text-center text-sm">
            <p>هذا التقرير هو مسودة أولية وقد لا يحتوي على جميع تفاصيل الفحص النهائية.</p>
            <p>{appName}</p>
        </footer>
      </div>
    </div>
  );
});

export default PrintDraft;
