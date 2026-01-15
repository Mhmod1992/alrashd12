import { Note, StructuredFinding, VoiceMemo, ActivityLog } from '../../../types';

/**
 * تنظيف العناصر من الخصائص المؤقتة قبل الحفظ
 */
export const clean = <T extends Note | StructuredFinding | VoiceMemo | ActivityLog>(items: T[]): Partial<T>[] => {
    return items.map(({ status, localFile, localBlob, isTranscribing, isEditingTranscription, ...item }: any) => item);
};

/**
 * تنظيف ملاحظات الفئات من الخصائص المؤقتة
 */
export const cleanCategoryNotes = (notesMap: Record<string, Note[]>) => {
    const newMap: Record<string, Note[]> = {};
    for (const key in notesMap) {
        newMap[key] = clean(notesMap[key]) as Note[];
    }
    return newMap;
};

/**
 * تنظيف المذكرات الصوتية من الخصائص المؤقتة
 */
export const cleanVoiceMemos = (memosMap: Record<string, VoiceMemo[]>) => {
    const newMap: Record<string, VoiceMemo[]> = {};
    for (const key in memosMap) {
        newMap[key] = clean(memosMap[key]) as VoiceMemo[];
    }
    return newMap;
};

/**
 * تحديث حالة العناصر إلى خطأ
 */
export const updateStatusToError = <T extends { id: string; status?: string }>(items: T[]): T[] => {
    return items.map(item => ({ ...item, status: 'error' }));
};

/**
 * تنظيف البيانات للمقارنة (إزالة الخصائص المؤقتة)
 */
export const cleanDataForComparison = (data: any) => {
    return JSON.parse(JSON.stringify(data, (key, value) => (key === 'status' || key === 'localFile' || key === 'localBlob' || key === 'isTranscribing' || key === 'isEditingTranscription') ? undefined : value));
};

/**
 * تحديث العناصر بعد الحفظ - دمج العناصر المحفوظة مع العناصر الحالية
 */
export const updateItemsAfterSave = <T extends { id: string }>(
    prevItems: T[],
    currentUploaded: T[],
    idKey: keyof T = 'id' as keyof T
): T[] => {
    const uploadedMap = new Map(currentUploaded.map(item => [item[idKey], item]));
    return prevItems.map(item => uploadedMap.get(item[idKey]) || item);
};
