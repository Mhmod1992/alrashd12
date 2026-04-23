
import React from 'react';
import { InspectionRequest, Broker } from '../types';

interface CommissionsPrintTableProps {
  requests: InspectionRequest[];
  brokers: Broker[];
}

const CommissionsPrintTable: React.FC<CommissionsPrintTableProps> = ({ requests, brokers }) => {
  const commissionedRequests = requests.filter(r => r.broker && (r.broker.commission || 0) > 0);
  
  if (commissionedRequests.length === 0) return null;

  const total = commissionedRequests.reduce((acc, curr) => acc + (curr.broker?.commission || 0), 0);
  const getBrokerName = (id: string) => brokers.find(b => b.id === id)?.name || 'غير معروف';

  return (
    <div className="hidden print:block w-full mt-8">
      <table className="w-full border-collapse border border-black text-[8.5pt] leading-tight">
        <thead>
          <tr className="bg-purple-50 italic">
             <th colSpan={5} className="border border-black p-1.5 text-right font-black bg-purple-100 text-purple-900">
                بيان عمولات السماسرة والمندوبين
             </th>
          </tr>
          <tr className="bg-gray-100 text-[8pt]">
            <th className="border border-black p-1 text-center font-bold w-12">رقم الطلب</th>
            <th className="border border-black p-1 text-right font-bold w-48">اسم السمسار</th>
            <th className="border border-black p-1 text-center font-bold w-24">التاريخ</th>
            <th className="border border-black p-1 text-center font-bold w-20">قيمة الطلب</th>
            <th className="border border-black p-1 text-center font-bold w-24">قيمة العمولة</th>
          </tr>
        </thead>
        <tbody>
          {commissionedRequests.map((request) => (
            <tr key={request.id}>
              <td className="border border-black p-1 text-center text-[7.5pt] font-mono">#{request.request_number}</td>
              <td className="border border-black p-1 text-right font-bold text-[8pt]">{getBrokerName(request.broker!.id)}</td>
              <td className="border border-black p-1 text-center text-[7.5pt]">
                {new Date(request.created_at).toLocaleDateString('ar-SA')}
              </td>
              <td className="border border-black p-1 text-center text-[8pt]">{request.price.toLocaleString()}</td>
              <td className="border border-black p-1 text-center font-black text-[9pt] bg-purple-50/20 text-purple-700">
                {(request.broker?.commission || 0).toLocaleString()}
              </td>
            </tr>
          ))}
          
          <tr className="bg-purple-100 font-black border-t-2 border-black">
            <td colSpan={4} className="border border-black p-2 text-center text-sm">إجمالي العمولات المستحقة</td>
            <td className="border border-black p-2 text-center text-[10pt] text-purple-900 bg-purple-200">
                {total.toLocaleString()} ر.س
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default CommissionsPrintTable;
