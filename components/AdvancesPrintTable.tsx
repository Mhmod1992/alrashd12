
import React from 'react';
import { Expense } from '../types';

interface AdvancesPrintTableProps {
  advances: Expense[];
}

const AdvancesPrintTable: React.FC<AdvancesPrintTableProps> = ({ advances }) => {
  if (!advances || advances.length === 0) return null;

  const total = advances.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="hidden print:block w-full mt-8">
      <table className="w-full border-collapse border border-black text-[8.5pt] leading-tight">
        <thead>
          <tr className="bg-amber-50 italic">
             <th colSpan={4} className="border border-black p-1.5 text-right font-black bg-amber-100 text-amber-900">
                بيان سلف الموظفين (نقدية خارجة من الدرج)
             </th>
          </tr>
          <tr className="bg-gray-100 text-[8pt]">
            <th className="border border-black p-1 text-center font-bold w-32">التاريخ</th>
            <th className="border border-black p-1 text-right font-bold w-48">اسم الموظف</th>
            <th className="border border-black p-1 text-right font-bold">الوصف / البيان</th>
            <th className="border border-black p-1 text-center font-bold w-32">المبلغ (ريال)</th>
          </tr>
        </thead>
        <tbody>
          {advances.map((advance) => (
            <tr key={advance.id}>
              <td className="border border-black p-1 text-center text-[7.5pt] font-mono whitespace-nowrap">
                {new Date(advance.date).toLocaleDateString('ar-SA')}
              </td>
              <td className="border border-black p-1 text-right font-bold text-[8pt]">{advance.description.split('-')[0] || advance.employeeName}</td>
              <td className="border border-black p-1 text-right text-[8pt]">{advance.description}</td>
              <td className="border border-black p-1 text-center font-black text-[9pt] bg-amber-50/20 text-amber-700">
                {advance.amount.toLocaleString()}
              </td>
            </tr>
          ))}
          
          <tr className="bg-amber-100 font-black border-t-2 border-black">
            <td colSpan={3} className="border border-black p-2 text-center text-sm">إجمالي السلف</td>
            <td className="border border-black p-2 text-center text-[10pt] text-amber-900 bg-amber-200">
                {total.toLocaleString()} ر.س
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default AdvancesPrintTable;
