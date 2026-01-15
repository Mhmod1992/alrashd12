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

const PrintDraft = React.forwardRef<HTMLDivElement, PrintDraftProps>((props, ref) => {
  const { request, client, car, carMake, carModel, inspectionType, price, appName, logoUrl } = props;
  
  return (
    <div ref={ref} className="print-only">
      <div className="p-8" dir="rtl">
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
            <p><strong>نوع الفحص:</strong> {inspectionType?.name}</p>
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
