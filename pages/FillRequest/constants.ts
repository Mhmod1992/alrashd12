// Updated color map for Note Cards (Full Backgrounds)
export const highlightColors: Record<'yellow' | 'red' | 'green' | 'blue', { name: string; bg: string; ring: string; border: string; cardBg: string }> = {
    yellow: { name: 'تنبيه', bg: 'bg-yellow-400', ring: 'ring-yellow-500', border: 'border-yellow-400', cardBg: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800' },
    red: { name: 'خطر', bg: 'bg-red-500', ring: 'ring-red-600', border: 'border-red-500', cardBg: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800' },
    green: { name: 'تأكيد', bg: 'bg-green-500', ring: 'ring-green-600', border: 'border-green-500', cardBg: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800' },
    blue: { name: 'معلومات', bg: 'bg-blue-500', ring: 'ring-blue-600', border: 'border-blue-500', cardBg: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' },
};
