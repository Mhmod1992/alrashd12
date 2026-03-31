import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';
import { InspectionRequest, Notification, CustomFindingCategory, PredefinedFinding, Note } from '../types';
import SparklesIcon from './icons/SparklesIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';

interface AiAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: InspectionRequest;
    categories: CustomFindingCategory[];
    predefinedFindings: PredefinedFinding[];
    apiKey: string | null;
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    onSave: (analysis: string) => Promise<void>;
}

const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({
    isOpen, onClose, request, categories, predefinedFindings, apiKey, addNotification, onSave
}) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisText, setAnalysisText] = useState(request.ai_analysis || '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setAnalysisText(request.ai_analysis || '');
        }
    }, [isOpen, request.ai_analysis]);

    const handleAnalyze = async () => {
        if (!apiKey) {
            addNotification({ title: 'مفتاح API مفقود', message: 'يرجى إعداد مفتاح Gemini API في الإعدادات أولاً.', type: 'error' });
            return;
        }

        setIsAnalyzing(true);
        try {
            const ai = new GoogleGenAI({ apiKey });

            // Prepare data for AI
            const reportData = {
                car: `${request.car_snapshot?.make_ar} ${request.car_snapshot?.model_ar} ${request.car_snapshot?.year}`,
                findings: request.structured_findings?.map(f => {
                    const cat = categories.find(c => c.id === f.categoryId)?.name;
                    const pref = predefinedFindings.find(p => p.id === f.findingId)?.name;
                    return `${cat}: ${pref} - ${f.value}`;
                }) || [],
                generalNotes: request.general_notes?.map(n => n.text) || [],
                categoryNotes: Object.entries(request.category_notes || {}).flatMap(([catId, notes]) => {
                    const cat = categories.find(c => c.id === catId)?.name;
                    return (notes as Note[]).map(n => `${cat}: ${n.text}`);
                })
            };

            const prompt = `
أنت الآن تلعب دور "كبير المهندسين الفنيين". مهمتك هي تحويل بيانات الفحص الخام إلى "شرح تقني" رصين، مع الالتزام التام بالبروتوكول التالي:

أولاً: قاموس المصطلحات الفنية (فهم اللهجة المحلية):

عند تحليل الملاحظات، يجب عليك فهم المصطلحات التالية بمعناها الدقيق في سوق فحص السيارات:



طعجة: تعني وجود أثر ارتطام أو انحناء في المعدن (بسيط أو قوي) وليس مجرد انبعاج سطحي، ويجب شرح أثرها على استقامة القطعة.

نتعة: تعني تأخر أو ضربة في استجابة ناقل الحركة (الجير).

حدفية: تعني انحراف السيارة عن مسارها المستقيم أثناء القيادة.

صوت ونين: يشير عادةً إلى مشاكل في الدفرنش أو المحامل (الرمانات).

ثانياً: بروتوكول "إيقاف الفحص" (الأولوية القصوى):



إذا وجدت عبارة "لم يتم إكمال الفحص بناءً على طلب العميل" في أي جزء، ابدأ تقريرك بعبارة مستقلة: "تنبيه: هذا التقرير غير مكتمل، حيث تم إيقاف عملية الفحص بناءً على رغبة العميل."

ثالثاً: الهيكل التنظيمي للتحليل (الأمانة في النقل):



النقل الحرفي: يجب كتابة "الملاحظة الفنية" كما وردت في التقرير تماماً (مثلاً: طعجة في الشاصيه) بخط عريض (Bold).

الشرح التقني: في السطر التالي، اشرح المعنى الهندسي لهذه الملاحظة وأثرها على أداء أو سلامة المركبة بأسلوب مباشر.

منع التكرار: لا تذكر ماركة السيارة، طرازها، أو سنة صنعها.

الخلاصة: أضف قسماً بعنوان "خلاصة حالة السيارة" يلخص الوضع الفني العام.

رابعاً: المحظورات:



الحياد التجاري: يُمنع تماماً التطرق للبيع، الشراء، أو القيمة المالية.

التنفيذ: ابدأ بالتحليل فوراً دون مقدمات ترحيبية.

البنود المفحوصة:
${reportData.findings.join('\n')}

ملاحظات عامة:
${reportData.generalNotes.join('\n')}

ملاحظات الأقسام:
${reportData.categoryNotes.join('\n')}
`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });

            if (response.text) {
                setAnalysisText(response.text);
                addNotification({ title: 'تم التحليل', message: 'تم استخراج التحليل بنجاح، يمكنك مراجعته الآن.', type: 'success' });
            } else {
                throw new Error('لم يتم إرجاع أي نص من النموذج.');
            }
        } catch (error: any) {
            console.error("AI Analysis Error:", error);
            addNotification({ title: 'خطأ في التحليل', message: error.message || 'حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.', type: 'error' });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(analysisText);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="التحليل الذكي للتقرير" size="2xl">
            <div className="flex flex-col gap-4">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3">
                    <SparklesIcon className="w-6 h-6 flex-shrink-0 mt-0.5 text-blue-600" />
                    <div>
                        <h4 className="font-bold mb-1">تحليل التقرير باستخدام الذكاء الاصطناعي</h4>
                        <p className="text-sm">سيقوم النظام بقراءة جميع الملاحظات والبنود المسجلة في هذا التقرير، واستخراج ملخص فني احترافي يسهل فهمه. يمكنك مراجعة وتعديل النص قبل اعتماده.</p>
                    </div>
                </div>

                {!analysisText && !isAnalyzing && (
                    <div className="flex justify-center py-8">
                        <Button onClick={handleAnalyze} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full shadow-lg flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5" />
                            <span>بدء التحليل الذكي</span>
                        </Button>
                    </div>
                )}

                {isAnalyzing && (
                    <div className="flex flex-col items-center justify-center py-12 text-blue-600">
                        <RefreshCwIcon className="w-10 h-10 animate-spin mb-4" />
                        <p className="font-bold">جاري قراءة وتحليل التقرير...</p>
                        <p className="text-sm text-slate-500 mt-2">قد يستغرق هذا بضع ثوانٍ</p>
                    </div>
                )}

                {analysisText && !isAnalyzing && (
                    <div className="flex flex-col gap-3 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <label className="font-bold text-slate-700">نتيجة التحليل (قابلة للتعديل):</label>
                            <Button onClick={handleAnalyze} variant="secondary" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                <RefreshCwIcon className="w-4 h-4 ml-1" />
                                إعادة التحليل
                            </Button>
                        </div>
                        <textarea
                            value={analysisText}
                            onChange={(e) => setAnalysisText(e.target.value)}
                            className="w-full h-64 p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none leading-relaxed"
                            placeholder="سيظهر التحليل هنا..."
                            dir="rtl"
                        />
                        
                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <Button variant="secondary" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                            <Button onClick={handleSave} disabled={isSaving || !analysisText.trim()} className="bg-green-600 hover:bg-green-700 text-white">
                                {isSaving ? <RefreshCwIcon className="w-5 h-5 animate-spin" /> : <Icon name="save" className="w-5 h-5" />}
                                <span className="mr-2">اعتماد وحفظ التحليل</span>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default AiAnalysisModal;
