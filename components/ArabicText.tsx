import React from 'react';
import { Text } from '@react-pdf/renderer';

// دالة لمعالجة مشكلة حرف "لا" مع مكتبة react-pdf وخط Tajawal
const formatArabic = (text: any): any => {
  if (typeof text !== 'string') return text;
  
  // التحقق مما إذا كان النص يحتوي على أحرف عربية
  const arabicRegex = /[\u0600-\u06FF]/;
  if (!arabicRegex.test(text)) return text;
  
  // بما أن react-pdf أصبح يدعم العربية تلقائياً ولكنه يفشل في دمج (ل + ا)
  // سنقوم بوضع "تطويل" (Tatweel / Kashida) مخفي بين اللام والألف 
  // هذا سيجبر المكتبة على رسم الحرفين متصلين وتجنب الاختفاء أو التقطع
  let fixed = text;
  fixed = fixed.replace(/لا/g, 'لـا');
  fixed = fixed.replace(/لأ/g, 'لـأ');
  fixed = fixed.replace(/لإ/g, 'لـإ');
  fixed = fixed.replace(/لآ/g, 'لـآ');
  
  return fixed;
};

// مكون بديل عن Text يعالج النصوص تلقائياً
export const ArabicText = ({ children, style, ...props }: any) => {
  const processChildren = (child: any): any => {
    if (typeof child === 'string') {
      return formatArabic(child);
    }
    if (Array.isArray(child)) {
      return child.map(processChildren); // حذفنا .join('') لدعم تضمين عناصر React
    }
    return child;
  };

  return (
    <Text style={style} {...props}>
      {processChildren(children)}
    </Text>
  );
};
