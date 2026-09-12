
import React from 'react';
import { InspectionRequest, PaymentType, Client, Car, CarMake, CarModel } from '../types';

interface ExcelPrintTableProps {
  requests: InspectionRequest[];
  clients: Client[];
  cars: Car[];
  carMakes: CarMake[];
  carModels: CarModel[];
}

const ExcelPrintTable: React.FC<ExcelPrintTableProps> = ({ requests, clients, cars, carMakes, carModels }) => {
  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'غير معروف';
  
  const getCarInfo = (request: InspectionRequest) => {
    if (request.car_snapshot) {
      const { make_en, model_en, year } = request.car_snapshot;
      return `${make_en || ''} ${model_en || ''} ${year}`;
    }
    const car = cars.find(c => c.id === request.car_id);
    if (!car) return 'سيارة غير معروفة';
    const make = carMakes.find(m => m.id === car.make_id)?.name_en;
    const model = carModels.find(m => m.id === car.model_id)?.name_en;
    return `${make || ''} ${model || ''} ${car.year}`;
  };

  const getPaymentLabel = (type: PaymentType, details?: any) => {
    switch (type) {
      case PaymentType.Cash: return 'نقدي';
      case PaymentType.Card: return 'بطاقة (شبكة)';
      case PaymentType.Transfer: return 'تحويل بنكي';
      case PaymentType.Unpaid: return 'آجل';
      case PaymentType.Split: 
        return `مجزأ (ن:${details?.cash} / ب:${details?.card})`;
      default: return type;
    }
  };

  const getPaymentColorClass = (type: PaymentType) => {
    switch (type) {
      case PaymentType.Cash: return 'text-emerald-700 bg-emerald-50/50 print:!text-emerald-700 print:!bg-emerald-50';
      case PaymentType.Card: return 'text-blue-700 bg-blue-50/50 print:!text-blue-700 print:!bg-blue-50';
      case PaymentType.Transfer: return 'text-amber-700 bg-amber-50/50 print:!text-amber-700 print:!bg-amber-50';
      case PaymentType.Unpaid: return 'text-rose-700 bg-rose-50/50 print:!text-rose-700 print:!bg-rose-50';
      case PaymentType.Split: return 'text-purple-700 bg-purple-50/50 print:!text-purple-700 print:!bg-purple-50';
      default: return 'text-slate-700';
    }
  };

  const totals = {
    price: requests.reduce((acc, r) => acc + r.price, 0),
    commission: requests.reduce((acc, r) => acc + (r.broker?.commission || 0), 0),
    net: requests.reduce((acc, r) => acc + (r.price - (r.broker?.commission || 0)), 0),
  };

  return (
    <div className="hidden print:block w-full mt-4">
      <table className="w-full border-collapse border border-black text-[8.5pt] leading-tight">
        <thead>
          <tr className="bg-gray-100 italic">
             <th colSpan={9} className="border border-black p-1.5 text-right font-black bg-gray-200">
                بيانات العمليات التفصيلية للفترة المحددة
             </th>
          </tr>
          <tr className="bg-gray-100 text-[8pt]">
            <th className="border border-black p-1 text-center font-bold w-10">#</th>
            <th className="border border-black p-1 text-right font-bold">العميل</th>
            <th className="border border-black p-1 text-right font-bold">السيارة</th>
            <th className="border border-black p-1 text-center font-bold w-20">التاريخ</th>
            <th className="border border-black p-1 text-center font-bold w-16">المبلغ</th>
            <th className="border border-black p-1 text-center font-bold w-20">طريقة الدفع</th>
            <th className="border border-black p-1 text-right font-bold">البيان / الملاحظات</th>
            <th className="border border-black p-1 text-center font-bold w-16">العمولة</th>
            <th className="border border-black p-1 text-center font-bold w-16">الصافي</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request, index) => {
            const commission = request.broker?.commission || 0;
            const net = request.price - commission;
            return (
              <tr key={request.id}>
                <td className="border border-black p-1 text-center text-[7.5pt]">{request.request_number}</td>
                <td className="border border-black p-1 text-right font-bold text-[8pt]">{getClientName(request.client_id)}</td>
                <td className="border border-black p-1 text-right text-[7pt]">{getCarInfo(request)}</td>
                <td className="border border-black p-1 text-center text-[7.5pt] font-mono whitespace-nowrap">
                  {new Date(request.created_at).toLocaleDateString('en-GB')}
                </td>
                <td className="border border-black p-1 text-center font-bold text-[8pt] bg-gray-50/50">
                  {request.price.toLocaleString()}
                </td>
                <td className={`border border-black p-1 text-center font-bold text-[8pt] ${getPaymentColorClass(request.payment_type)}`}>
                  {getPaymentLabel(request.payment_type, request.split_payment_details)}
                </td>
                <td className="border border-black p-1 text-right text-[7.5pt] max-w-[150px]">
                  {request.payment_note || '-'}
                </td>
                <td className="border border-black p-1 text-center text-[8pt] text-red-700">
                  {commission > 0 ? commission.toLocaleString() : '-'}
                </td>
                <td className="border border-black p-1 text-center font-black text-[8pt] bg-gray-50/50 text-emerald-800">
                  {net.toLocaleString()}
                </td>
              </tr>
            );
          })}
          
          {/* TOTALS FOOTER */}
          <tr className="bg-gray-100 font-bold border-t-2 border-black">
            <td colSpan={4} className="border border-black p-1.5 text-center text-xs font-black">الإجماليات الكلية</td>
            <td className="border border-black p-1.5 text-center text-[8.5pt] font-black">{totals.price.toLocaleString()}</td>
            <td className="border border-black p-1.5"></td>
            <td className="border border-black p-1.5"></td>
            <td className="border border-black p-1.5 text-center text-[8.5pt] text-red-700">{totals.commission.toLocaleString()}</td>
            <td className="border border-black p-1.5 text-center text-[9.5pt] font-black bg-gray-200">{totals.net.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      
      <div className="mt-6 flex justify-between px-10 text-[7pt] font-bold text-slate-500 italic">
        <span>توقيع المحاسب: ________________</span>
        <span>توقيع المدير: ________________</span>
        <span>تاريخ الاعتماد: ____ / ____ / 202__ م</span>
      </div>
    </div>
  );
};

export default ExcelPrintTable;
