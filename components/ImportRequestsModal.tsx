import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAppContext } from '../context/AppContext';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';
import RefreshCwIcon from './icons/RefreshCwIcon';

interface ImportRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ImportRequestsModal: React.FC<ImportRequestsModalProps> = ({ isOpen, onClose }) => {
    const { addNotification, fetchRequests, uploadImage, authUser } = useAppContext();
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState<string>('');
    const [previewData, setPreviewData] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportProgress('جاري قراءة الملف...');
        setIsImporting(true);

        try {
            const fileContent = await file.text();
            const importedData = JSON.parse(fileContent);

            if (importedData.version !== '1.0' || importedData.type !== 'requests_database' || !importedData.data) {
                throw new Error('ملف غير صالح أو إصدار غير مدعوم.');
            }

            const requests = importedData.data;

            setImportProgress('جاري تحليل البيانات ومطابقتها...');

            // Analyze data
            const analysis = {
                totalRequests: requests.length,
                newClients: 0,
                newCars: 0,
                newInspectionTypes: 0,
                duplicateRequests: 0,
                readyToImport: 0,
                requestsToProcess: requests
            };

            // Fetch existing data for matching
            const { data: existingClients } = await supabase.from('clients').select('id, phone');
            const { data: existingCars } = await supabase.from('cars').select('id, vin, plate_number');
            const { data: existingTypes } = await supabase.from('inspection_types').select('id, name');
            const { data: existingRequests } = await supabase.from('inspection_requests').select('request_number');

            const existingClientPhones = new Set(existingClients?.map(c => c.phone) || []);
            const existingCarVins = new Set(existingCars?.map(c => c.vin).filter(Boolean) || []);
            const existingCarPlates = new Set(existingCars?.map(c => c.plate_number).filter(Boolean) || []);
            const existingTypeNames = new Set(existingTypes?.map(t => t.name) || []);
            const existingRequestNumbers = new Set(existingRequests?.map(r => r.request_number) || []);

            const uniqueNewClients = new Set();
            const uniqueNewCars = new Set();
            const uniqueNewTypes = new Set();

            for (const req of requests) {
                if (existingRequestNumbers.has(req.request_number)) {
                    analysis.duplicateRequests++;
                    continue;
                }

                analysis.readyToImport++;

                // Check Client
                if (req.client && req.client.phone && !existingClientPhones.has(req.client.phone)) {
                    uniqueNewClients.add(req.client.phone);
                }

                // Check Car
                if (req.car) {
                    const hasVin = req.car.vin && existingCarVins.has(req.car.vin);
                    const hasPlate = req.car.plate_number && existingCarPlates.has(req.car.plate_number);
                    if (!hasVin && !hasPlate) {
                        uniqueNewCars.add(req.car.vin || req.car.plate_number || Math.random());
                    }
                }

                // Check Inspection Type
                if (req.inspection_type && req.inspection_type.name && !existingTypeNames.has(req.inspection_type.name)) {
                    uniqueNewTypes.add(req.inspection_type.name);
                }
            }

            analysis.newClients = uniqueNewClients.size;
            analysis.newCars = uniqueNewCars.size;
            analysis.newInspectionTypes = uniqueNewTypes.size;

            setPreviewData(analysis);
        } catch (error: any) {
            console.error('Import analysis error:', error);
            addNotification({ title: 'خطأ', message: error.message || 'حدث خطأ أثناء قراءة الملف.', type: 'error' });
        } finally {
            setIsImporting(false);
            setImportProgress('');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const confirmImport = async () => {
        if (!previewData || !previewData.requestsToProcess) return;

        setIsImporting(true);
        try {
            const requests = previewData.requestsToProcess;

            // 1. Fetch current DB state to map IDs
            setImportProgress('جاري جلب البيانات المرجعية...');
            const { data: dbClients } = await supabase.from('clients').select('*');
            const { data: dbCars } = await supabase.from('cars').select('*');
            const { data: dbTypes } = await supabase.from('inspection_types').select('*');
            const { data: dbMakes } = await supabase.from('car_makes').select('*');
            const { data: dbModels } = await supabase.from('car_models').select('*');
            const { data: dbRequests } = await supabase.from('inspection_requests').select('request_number');
            const { data: dbEmployees } = await supabase.from('employees').select('*');
            const { data: dbBrokers } = await supabase.from('brokers').select('*');

            const existingRequestNumbers = new Set(dbRequests?.map(r => r.request_number) || []);

            // Maps to hold Phone -> ID, VIN -> ID, etc.
            const clientMap = new Map(dbClients?.map(c => [c.phone, c.id]));
            const carMap = new Map();
            dbCars?.forEach(c => {
                if (c.vin) carMap.set(`vin_${c.vin}`, c.id);
                if (c.plate_number) carMap.set(`plate_${c.plate_number}`, c.id);
            });
            const typeMap = new Map(dbTypes?.map(t => [t.name, t.id]));
            const makeMap = new Map(dbMakes?.map(m => [m.name_ar, m.id]));
            const modelMap = new Map(dbModels?.map(m => [m.name_ar, m.id]));
            const employeeMap = new Map(dbEmployees?.map(e => [e.name, e.id]));
            const brokerMap = new Map(dbBrokers?.map(b => [b.name, b.id]));

            let importedCount = 0;

            for (let i = 0; i < requests.length; i++) {
                const req = requests[i];
                setImportProgress(`جاري استيراد الطلب ${i + 1} من ${requests.length}...`);

                // Skip duplicates
                if (existingRequestNumbers.has(req.request_number)) continue;

                // --- Resolve Client ---
                let clientId = req.client_id;
                if (req.client && req.client.phone) {
                    if (clientMap.has(req.client.phone)) {
                        clientId = clientMap.get(req.client.phone);
                    } else {
                        // Create new client
                        const { data: newClient, error: clientErr } = await supabase.from('clients').insert({
                            name: req.client.name,
                            phone: req.client.phone
                        }).select().single();
                        if (clientErr) throw clientErr;
                        clientId = newClient.id;
                        clientMap.set(newClient.phone, newClient.id);
                    }
                }

                // --- Resolve Car ---
                let carId = req.car_id;
                if (req.car) {
                    const carKeyVin = req.car.vin ? `vin_${req.car.vin}` : null;
                    const carKeyPlate = req.car.plate_number ? `plate_${req.car.plate_number}` : null;

                    if (carKeyVin && carMap.has(carKeyVin)) {
                        carId = carMap.get(carKeyVin);
                    } else if (carKeyPlate && carMap.has(carKeyPlate)) {
                        carId = carMap.get(carKeyPlate);
                    } else {
                        // Need to create Car. First resolve Make and Model
                        let makeId = req.car.make_id;
                        if (req.car.make && req.car.make.name_ar) {
                            if (makeMap.has(req.car.make.name_ar)) {
                                makeId = makeMap.get(req.car.make.name_ar);
                            } else {
                                const { data: newMake } = await supabase.from('car_makes').insert({ name_ar: req.car.make.name_ar, name_en: req.car.make.name_en || req.car.make.name_ar }).select().single();
                                if (newMake) {
                                    makeId = newMake.id;
                                    makeMap.set(newMake.name_ar, newMake.id);
                                }
                            }
                        }

                        let modelId = req.car.model_id;
                        if (req.car.model && req.car.model.name_ar && makeId) {
                            if (modelMap.has(req.car.model.name_ar)) {
                                modelId = modelMap.get(req.car.model.name_ar);
                            } else {
                                const { data: newModel } = await supabase.from('car_models').insert({ make_id: makeId, name_ar: req.car.model.name_ar, name_en: req.car.model.name_en || req.car.model.name_ar }).select().single();
                                if (newModel) {
                                    modelId = newModel.id;
                                    modelMap.set(newModel.name_ar, newModel.id);
                                }
                            }
                        }

                        const { data: newCar, error: carErr } = await supabase.from('cars').insert({
                            make_id: makeId,
                            model_id: modelId,
                            year: req.car.year,
                            plate_number: req.car.plate_number,
                            plate_number_en: req.car.plate_number_en,
                            vin: req.car.vin
                        }).select().single();

                        if (carErr) throw carErr;
                        carId = newCar.id;
                        if (newCar.vin) carMap.set(`vin_${newCar.vin}`, newCar.id);
                        if (newCar.plate_number) carMap.set(`plate_${newCar.plate_number}`, newCar.id);
                    }
                }

                // --- Resolve Inspection Type ---
                let typeId = req.inspection_type_id;
                if (req.inspection_type && req.inspection_type.name) {
                    if (typeMap.has(req.inspection_type.name)) {
                        typeId = typeMap.get(req.inspection_type.name);
                    } else {
                        const { data: newType, error: typeErr } = await supabase.from('inspection_types').insert({
                            name: req.inspection_type.name,
                            price: req.inspection_type.price
                        }).select().single();
                        if (typeErr) throw typeErr;
                        typeId = newType.id;
                        typeMap.set(newType.name, newType.id);
                    }
                }

                // --- Resolve Employee ---
                // As requested, the importer becomes the creator of the request
                const employeeId = authUser?.id || null;

                // --- Resolve Broker ---
                let brokerId = req.broker;
                if (req.broker_details && req.broker_details.name) {
                    if (brokerMap.has(req.broker_details.name)) {
                        brokerId = brokerMap.get(req.broker_details.name);
                    } else {
                        const { data: newBroker, error: brokerErr } = await supabase.from('brokers').insert({
                            name: req.broker_details.name,
                            phone: req.broker_details.phone || '',
                            default_commission: req.broker_details.default_commission || req.broker_details.commission_rate || 0
                        }).select().single();
                        if (brokerErr) throw brokerErr;
                        brokerId = newBroker.id;
                        brokerMap.set(newBroker.name, newBroker.id);
                    }
                } else {
                    brokerId = null; // Clear invalid ID if no broker details provided
                }

                // --- Handle Images and Media ---
                const processMedia = async (url: any, bucket: string, defaultExt: string = 'jpg'): Promise<any> => {
                    if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
                    try {
                        const response = await fetch(url);
                        if (response.ok) {
                            const blob = await response.blob();
                            // Try to get extension from content-type or URL, fallback to defaultExt
                            let ext = defaultExt;
                            if (blob.type) {
                                const mimeExt = blob.type.split('/')[1];
                                if (mimeExt && !mimeExt.includes(';')) ext = mimeExt;
                            }
                            const file = new File([blob], `imported_${Date.now()}.${ext}`, { type: blob.type });
                            return await uploadImage(file, bucket);
                        }
                    } catch (err) {
                        console.error(`Error uploading imported media from ${url}:`, err);
                    }
                    return url; // Fallback to original URL if fetch/upload fails
                };

                // car_snapshot is an object, not a URL
                const carSnapshot = req.car_snapshot;

                // Process general notes images
                let processedGeneralNotes = req.general_notes;
                if (Array.isArray(processedGeneralNotes)) {
                    setImportProgress(`جاري استيراد صور الملاحظات العامة للطلب ${i + 1}...`);
                    processedGeneralNotes = await Promise.all(processedGeneralNotes.map(async (note: any) => {
                        if (note.image) {
                            note.image = await processMedia(note.image, 'note_images', 'jpg');
                        }
                        return note;
                    }));
                }

                // Process category notes images
                let processedCategoryNotes = req.category_notes;
                if (processedCategoryNotes && typeof processedCategoryNotes === 'object') {
                    setImportProgress(`جاري استيراد صور ملاحظات الفحص للطلب ${i + 1}...`);
                    for (const catId in processedCategoryNotes) {
                        if (Array.isArray(processedCategoryNotes[catId])) {
                            processedCategoryNotes[catId] = await Promise.all(processedCategoryNotes[catId].map(async (note: any) => {
                                if (note.image) {
                                    note.image = await processMedia(note.image, 'note_images', 'jpg');
                                }
                                return note;
                            }));
                        }
                    }
                }

                // Process structured findings images
                let processedFindings = req.structured_findings;
                if (Array.isArray(processedFindings)) {
                    setImportProgress(`جاري استيراد صور بنود الفحص للطلب ${i + 1}...`);
                    processedFindings = await Promise.all(processedFindings.map(async (finding: any) => {
                        if (finding.image) {
                            finding.image = await processMedia(finding.image, 'finding_images', 'jpg');
                        }
                        return finding;
                    }));
                }

                // Process voice memos
                let processedVoiceMemos = req.voice_memos;
                if (processedVoiceMemos && typeof processedVoiceMemos === 'object') {
                    setImportProgress(`جاري استيراد الملاحظات الصوتية للطلب ${i + 1}...`);
                    for (const key in processedVoiceMemos) {
                        if (Array.isArray(processedVoiceMemos[key])) {
                            processedVoiceMemos[key] = await Promise.all(processedVoiceMemos[key].map(async (memo: any) => {
                                if (memo.audioData && typeof memo.audioData === 'string' && memo.audioData.startsWith('http')) {
                                    memo.audioData = await processMedia(memo.audioData, 'note_images', 'webm');
                                }
                                return memo;
                            }));
                        }
                    }
                }

                // Process activity log images
                let processedActivityLog = req.activity_log;
                if (Array.isArray(processedActivityLog)) {
                    setImportProgress(`جاري استيراد صور سجل النشاط للطلب ${i + 1}...`);
                    processedActivityLog = await Promise.all(processedActivityLog.map(async (log: any) => {
                        if (log.imageUrl) {
                            log.imageUrl = await processMedia(log.imageUrl, 'note_images', 'jpg');
                        }
                        return log;
                    }));
                }

                // Process attached files
                let processedAttachedFiles = req.attached_files;
                if (Array.isArray(processedAttachedFiles)) {
                    setImportProgress(`جاري استيراد الملفات المرفقة للطلب ${i + 1}...`);
                    processedAttachedFiles = await Promise.all(processedAttachedFiles.map(async (file: any) => {
                        if (file.url) {
                            file.url = await processMedia(file.url, 'attachments', 'jpg');
                        }
                        return file;
                    }));
                }

                // --- Insert Request ---
                const newRequestData = {
                    request_number: req.request_number,
                    client_id: clientId,
                    car_id: carId,
                    inspection_type_id: typeId,
                    payment_type: req.payment_type,
                    split_payment_details: req.split_payment_details,
                    price: req.price,
                    status: req.status,
                    created_at: req.created_at,
                    updated_at: req.updated_at,
                    employee_id: employeeId,
                    broker: brokerId ? (typeof brokerId === 'object' ? brokerId : { id: brokerId, commission: req.broker?.commission || 0 }) : null,
                    payment_note: req.payment_note,
                    inspection_data: req.inspection_data,
                    general_notes: processedGeneralNotes,
                    category_notes: processedCategoryNotes,
                    voice_memos: processedVoiceMemos,
                    structured_findings: processedFindings,
                    activity_log: processedActivityLog,
                    attached_files: processedAttachedFiles,
                    technician_assignments: req.technician_assignments,
                    report_stamps: req.report_stamps,
                    car_snapshot: carSnapshot
                };

                const { error: reqErr } = await supabase.from('inspection_requests').insert(newRequestData);
                if (reqErr) throw reqErr;

                importedCount++;
            }

            addNotification({ title: 'نجاح', message: `تم استيراد ${importedCount} طلب بنجاح.`, type: 'success' });
            fetchRequests(); // Refresh the table
            onClose();
        } catch (error: any) {
            console.error('Import execution error:', error);
            addNotification({ title: 'خطأ', message: error.message || 'حدث خطأ أثناء الاستيراد.', type: 'error' });
        } finally {
            setIsImporting(false);
            setImportProgress('');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="استيراد الطلبات" size="lg">
            <div className="space-y-6 p-4">
                {!previewData ? (
                    <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <Icon name="upload" className="w-16 h-16 text-blue-500 mb-4" />
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">اختر ملف الطلبات (JSON)</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center max-w-md">
                            قم برفع ملف JSON الذي تم تصديره مسبقاً من النظام. سيقوم النظام بمطابقة العملاء والسيارات لتجنب التكرار.
                        </p>
                        <input
                            type="file"
                            accept=".json"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                            className="flex items-center gap-2"
                        >
                            {isImporting ? <RefreshCwIcon className="w-5 h-5 animate-spin" /> : <Icon name="document-report" className="w-5 h-5" />}
                            <span>{isImporting ? importProgress || 'جاري المعالجة...' : 'اختيار ملف JSON'}</span>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                            <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
                                <Icon name="document-report" className="w-5 h-5" />
                                ملخص الاستيراد
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">إجمالي الطلبات في الملف</p>
                                    <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{previewData.totalRequests}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">طلبات مكررة (سيتم تخطيها)</p>
                                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{previewData.duplicateRequests}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">طلبات سيتم استيرادها</p>
                                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{previewData.readyToImport}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 text-sm">عناصر جديدة سيتم إنشاؤها تلقائياً:</h4>
                            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                <li className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded">
                                    <span>عملاء جدد:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{previewData.newClients}</span>
                                </li>
                                <li className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded">
                                    <span>سيارات جديدة:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{previewData.newCars}</span>
                                </li>
                                <li className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded">
                                    <span>أنواع فحص جديدة:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{previewData.newInspectionTypes}</span>
                                </li>
                            </ul>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setPreviewData(null)} disabled={isImporting}>إلغاء</Button>
                            <Button onClick={confirmImport} disabled={isImporting || previewData.readyToImport === 0} className="flex items-center gap-2">
                                {isImporting ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <Icon name="check-circle" className="w-4 h-4" />}
                                <span>{isImporting ? importProgress || 'جاري الاستيراد...' : 'تأكيد وبدء الاستيراد'}</span>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ImportRequestsModal;
