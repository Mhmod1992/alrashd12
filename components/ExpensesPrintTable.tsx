
import React from 'react';
import { Expense } from '../types';

interface ExpensesPrintTableProps {
  expenses: Expense[];
}

const ExpensesPrintTable: React.FC<ExpensesPrintTableProps> = ({ expenses }) => {
  if (!expenses || expenses.length === 0) return null;

  const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="hidden print:block w-full mt-10">
      <table className="w-full border-collapse border border-black text-[8.5pt] leading-tight">
        <thead>
          <tr className="bg-rose-50 italic">
             <th colSpan={4} className="border border-black p-1.5 text-right font-black bg-rose-100 text-rose-900 uppercase tracking-widest">
                بيان المصروفات التفصيلي للفترة المحددة
             </th>
          </tr>
          <tr className="bg-gray-100 text-[8pt]">
            <th className="border border-black p-1 text-center font-bold w-32">التاريخ</th>
            <th className="border border-black p-1 text-right font-bold w-48">الفئة</th>
            <th className="border border-black p-1 text-right font-bold">الوصف / البيان</th>
            <th className="border border-black p-1 text-center font-bold w-32">المبلغ (ريال)</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td className="border border-black p-1 text-center text-[7.5pt] font-mono whitespace-nowrap">
                {new Date(expense.date).toLocaleDateString('ar-SA')}
              </td>
              <td className="border border-black p-1 text-right font-bold text-[8pt]">{expense.category}</td>
              <td className="border border-black p-1 text-right text-[8pt]">{expense.description}</td>
              <td className="border border-black p-1 text-center font-black text-[9pt] bg-rose-50/20 text-rose-700">
                {expense.amount.toLocaleString()}
              </td>
            </tr>
          ))}
          
          <tr className="bg-rose-100 font-black border-t-2 border-black">
            <td colSpan={3} className="border border-black p-2 text-center text-sm">إجمالي المصروفات</td>
            <td className="border border-black p-2 text-center text-[10pt] text-rose-900 bg-rose-200">
                {total.toLocaleString()} ر.س
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 p-3 border border-dashed border-rose-300 rounded-xl bg-rose-50/30 print:bg-transparent">
        <p className="text-[7.5pt] font-bold text-rose-800">
            * تم قيد هذه المصروفات بمعرفة: {expenses.length > 0 ? expenses[0].employeeName : 'النظام'}
        </p>
      </div>
    </div>
  );
};

export default ExpensesPrintTable;
