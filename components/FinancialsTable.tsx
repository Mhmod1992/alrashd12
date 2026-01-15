
import React, { useMemo } from 'react';
import { InspectionRequest, PaymentType, Client, Car, CarMake, CarModel } from '../types';
import Icon from './Icon';
import BanknotesIcon from './icons/BanknotesIcon';
import CreditCardIcon from './icons/CreditCardIcon';

const PaymentMethodBadge: React.FC<{ request: InspectionRequest }> = ({ request }) => {
    const baseClasses = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border";

    switch (request.payment_type) {
        case PaymentType.Cash:
            return <span className={`${baseClasses} bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300`}><BanknotesIcon className="w-3.5 h-3.5" /> نقدي</span>;
        case PaymentType.Card:
            return <span className={`${baseClasses} bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300`}><CreditCardIcon className="w-3.5 h-3.5" /> بطاقة</span>;
        case PaymentType.Transfer:
            return <span className={`${baseClasses} bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300`}><Icon name="refresh-cw" className="w-3.5 h-3.5" /> تحويل</span>;
        case PaymentType.Unpaid:
            return <span className={`${baseClasses} bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300`}><Icon name="history" className="w-3.5 h-3.5" /> آجل</span>;
        case PaymentType.Split:
            return (
                <div className="flex flex-col text-[10px] font-bold text-purple-700 bg-purple-50 p-1 rounded border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
                    <div className="flex items-center gap-1"><Icon name="document-report" className="w-3 h-3"/> <span>مجزأ</span></div>
                    <span className="opacity-80 mt-0.5 font-numeric">ن:{request.split_payment_details?.cash} | ب:{request.split_payment_details?.card}</span>
                </div>
            );
        default:
            return <span className="text-slate-500">{request.payment_type}</span>;
    }
};

const FinancialsTable: React.FC<{
  requests: InspectionRequest[];
  clients: Client[];
  cars: Car[];
  carMakes: CarMake[];
  carModels: CarModel[];
}> = ({ requests, clients, cars, carMakes, carModels }) => {

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'غير معروف';
  const getCarInfo = (carId: string) => {
    const car = cars.find(c => c.id === carId);
    if (!car) return 'سيارة غير معروفة';
    const make = carMakes.find(m => m.id === car.make_id)?.name_ar;
    const model = carModels.find(m => m.id === car.model_id)?.name_ar;
    return `${make || ''} ${model || ''} (${car.year})`;
  };

  const totals = useMemo(() => {
    return {
      price: requests.reduce((acc, r) => acc + r.price, 0),
      commission: requests.reduce((acc, r) => acc + (r.broker?.commission || 0), 0),
      net: requests.reduce((acc, r) => acc + (r.price - (r.broker?.commission || 0)), 0),
    };
  }, [requests]);

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm text-right">
        <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 dark:text-slate-400 border-b border-slate-200 dark:border-slate-600">
          {/* TOTALS ROW - MOVED TO TOP */}
           {requests.length > 0 && (
            <tr className="bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 border-b-2 border-blue-100 dark:border-blue-800">
                <td colSpan={4} className="px-4 py-3 text-center font-black text-sm">مجموع النتائج الحالية</td>
                <td className="px-4 py-3 font-black text-sm font-numeric">{totals.price.toLocaleString('en-US')}</td>
                <td></td>
                <td></td>
                <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400 font-numeric">{totals.commission.toLocaleString('en-US')}</td>
                <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400 text-sm font-numeric">{totals.net.toLocaleString('en-US')}</td>
            </tr>
          )}
          <tr>
            <th className="px-4 py-4 font-bold">#</th>
            <th className="px-4 py-4 font-bold">العميل</th>
            <th className="px-4 py-4 font-bold">السيارة</th>
            <th className="px-4 py-4 font-bold">التاريخ</th>
            <th className="px-4 py-4 font-bold">المبلغ</th>
            <th className="px-4 py-4 font-bold">طريقة الدفع</th>
            <th className="px-4 py-4 font-bold">بيان الدفع / التحويل</th>
            <th className="px-4 py-4 font-bold">العمولة</th>
            <th className="px-4 py-4 font-bold">صافي الدخل</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {requests.map((request) => {
            const commission = request.broker?.commission || 0;
            const netIncome = request.price - commission;
            return (
              <tr key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-4">
                  <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs font-mono text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200 dark:border-slate-600 font-numeric">
                    #{request.request_number}
                  </span>
                </td>
                <td className="px-4 py-4 font-bold text-slate-800 dark:text-slate-200">{getClientName(request.client_id)}</td>
                <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300">{getCarInfo(request.car_id)}</td>
                <td className="px-4 py-4 whitespace-nowrap text-[10px] font-mono text-slate-500 font-numeric">{new Date(request.created_at).toLocaleDateString('en-GB')}</td>
                <td className="px-4 py-4 font-black font-numeric">{request.price.toLocaleString('en-US')}</td>
                <td className="px-4 py-4"><PaymentMethodBadge request={request} /></td>
                <td className="px-4 py-4 text-[11px] text-slate-500 dark:text-slate-400">
                  {request.payment_note ? (
                      <span className="block max-w-[150px] truncate bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded text-yellow-800 dark:text-yellow-200 border border-yellow-100 dark:border-yellow-800" title={request.payment_note}>
                          {request.payment_note}
                      </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-4 text-rose-600 dark:text-rose-400 font-bold font-numeric">{commission > 0 ? commission.toLocaleString('en-US') : '-'}</td>
                <td className="px-4 py-4 font-bold text-emerald-600 dark:text-emerald-400 font-numeric">{netIncome.toLocaleString('en-US')}</td>
              </tr>
            );
          })}
          {requests.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center p-12 text-slate-400">
                لا توجد طلبات لعرضها في هذه الفترة.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FinancialsTable;
