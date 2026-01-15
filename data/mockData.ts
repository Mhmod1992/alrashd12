

import { InspectionRequest, Client, Car, RequestStatus, CarMake, CarModel, InspectionType, Broker, PaymentType, CustomFindingCategory, PredefinedFinding, Settings, Employee, Permission, Note, PERMISSIONS } from '../types';

export const mockClients: Client[] = [
  { id: 'cli-1', name: 'عبدالله محمد', phone: '0501234567', is_vip: true },
  { id: 'cli-2', name: 'سالم أحمد', phone: '0557654321', is_vip: false },
  { id: 'cli-3', name: 'خالد يوسف', phone: '0533344556', is_vip: false },
];

export const mockCarMakes: CarMake[] = [
  { id: 'make-1', name_ar: 'تويوتا', name_en: 'Toyota' },
  { id: 'make-2', name_ar: 'هيونداي', name_en: 'Hyundai' },
  { id: 'make-3', name_ar: 'فورد', name_en: 'Ford' },
];

export const mockCarModels: CarModel[] = [
  { id: 'model-1', make_id: 'make-1', name_ar: 'كامري', name_en: 'Camry' },
  { id: 'model-2', make_id: 'make-1', name_ar: 'كورولا', name_en: 'Corolla' },
  { id: 'model-3', make_id: 'make-2', name_ar: 'سوناتا', name_en: 'Sonata' },
  { id: 'model-4', make_id: 'make-2', name_ar: 'إلنترا', name_en: 'Elantra' },
  { id: 'model-5', make_id: 'make-3', name_ar: 'تورس', name_en: 'Taurus' },
  { id: 'model-6', make_id: 'make-3', name_ar: 'إكسبلورر', name_en: 'Explorer' },
];

export const mockCars: Car[] = [
  { id: 'car-1', make_id: 'make-1', model_id: 'model-1', year: 2022, plate_number: 'أ ب ج 1234' },
  { id: 'car-2', make_id: 'make-2', model_id: 'model-3', year: 2021, plate_number: 'د هـ و 5678' },
  { id: 'car-3', make_id: 'make-3', model_id: 'model-5', year: 2023, plate_number: 'س ص ط 9012' },
  { id: 'car-4', make_id: 'make-3', model_id: 'model-5', year: 2022, plate_number: 'ق ر ك 3456' },
  { id: 'car-5', make_id: 'make-1', model_id: 'model-1', year: 2020, plate_number: 'ل م ن 7890' },
];

export const mockCustomFindingCategories: CustomFindingCategory[] = [
    { id: 'cat-1', name: 'البودي الخارجي' },
    { id: 'cat-2', name: 'المحرك وناقل الحركة' },
    { id: 'cat-3', name: 'الشاصيه ونظام التعليق' },
    { id: 'cat-4', name: 'الفحص بالكمبيوتر' },
];

export const mockPredefinedFindings: PredefinedFinding[] = [
    { id: 'find-1', name: 'الصدام الأمامي', category_id: 'cat-1', options: ['سليم', 'مرشوش', 'مغير', 'تالف'], reference_image: 'https://i.ibb.co/Front-Bumper.jpg' },
    { id: 'find-2', name: 'الكبوت', category_id: 'cat-1', options: ['سليم', 'مرشوش', 'مغير', 'تالف'], reference_image: 'https://i.ibb.co/Hood.jpg' },
    { id: 'find-3', name: 'الرفرف الأمامي يمين', category_id: 'cat-1', options: ['سليم', 'مرشوش', 'مغير', 'تالف'] },
    { id: 'find-4', name: 'حالة المحرك', category_id: 'cat-2', options: ['ممتازة', 'جيدة', 'تحتاج صيانة'] },
    { id: 'find-5', name: 'حالة ناقل الحركة', category_id: 'cat-2', options: ['ممتازة', 'جيدة', 'يوجد تأخير'] },
    { id: 'find-6', name: 'أضرار الشاصيه', category_id: 'cat-3', options: ['لا يوجد', 'ضربة خفيفة', 'ضربة قوية'] },
    { id: 'find-7', name: 'نتيجة فحص الكمبيوتر', category_id: 'cat-4', options: ['لا توجد أكواد أعطال', 'يوجد أكواد أعطال'] },
];


export const mockInspectionTypes: InspectionType[] = [
    { id: 'type-1', name: 'فحص كامل', price: 350, finding_category_ids: ['cat-1', 'cat-2', 'cat-3', 'cat-4'] },
    { id: 'type-2', name: 'فحص كمبيوتر', price: 150, finding_category_ids: ['cat-4'] },
    { id: 'type-3', name: 'فحص بودي', price: 200, finding_category_ids: ['cat-1', 'cat-3'] },
];

export const mockBrokers: Broker[] = [
    { id: 'broker-1', name: 'مكتب النهضة', default_commission: 50, is_active: true },
    { id: 'broker-2', name: 'معرض الفلاح', default_commission: 75, is_active: true },
    { id: 'broker-3', name: 'سمسار مستقل', default_commission: 30, is_active: false },
];

export const mockSettings: Settings = {
    appName: "نظام ورشة المستقبل",
    logoUrl: null, 
    design: 'aero',
    sidebarStyle: 'default',
    headerStyle: 'default',
    backgroundImageUrl: null,
    backgroundColor: null,
    glassmorphismIntensity: 5,
    geminiApiKey: null,
    databaseCapacity: 500,
    storageCapacity: 1, 
    allowSignup: true,
    plateCharacters: [
        { ar: 'أ', en: 'A' }, { ar: 'ب', en: 'B' }, { ar: 'ح', en: 'J' },
        { ar: 'د', en: 'D' }, { ar: 'ر', en: 'R' }, { ar: 'س', en: 'S' },
        { ar: 'ص', en: 'X' }, { ar: 'ط', en: 'T' }, { ar: 'ع', en: 'E' },
        { ar: 'ق', en: 'G' }, { ar: 'ك', en: 'K' }, { ar: 'ل', en: 'L' },
        { ar: 'م', en: 'Z' }, { ar: 'ن', en: 'N' }, { ar: 'هـ', en: 'H' },
        { ar: 'و', en: 'U' }, { ar: 'ى', en: 'V' }
    ],
    platePreviewSettings: {
        backgroundColor: '#FFFFFF',
        borderColor: '#000000',
        fontColor: '#000000',
        fontFamily: 'monospace',
        fontSize: '32px',
        letterSpacing: '0.1em',
        separatorImageUrl: null,
        separatorWidth: 'auto',
        separatorHeight: '80%',
    },
    reportSettings: {
        reportLogoUrl: null,
        primaryColor: '#3b82f6', 
        appNameColor: '#2563eb', 
        sectionTitleBackgroundColor: '#e0f2fe', 
        sectionTitleFontColor: '#0369a1', 
        findingsHeaderBackgroundColor: '#2563eb', 
        findingsHeaderFontColor: '#ffffff', 
        noteImageBorderColor: '#e2e8f0', 
        noteImageBorderRadius: '0.5rem', 
        fontFamily: "'Tajawal', sans-serif",
        fontSizes: {
            headerTitle: 'text-3xl',
            headerSubtitle: 'text-sm',
            headerAdditional: 'text-xs',
            sectionTitle: 'text-2xl',
            categoryTitle: 'text-xl',
            blockTitle: 'text-base',
            blockHeader: 'text-lg',
            blockContent: 'text-sm',
            blockLabel: 'text-sm',
            carName: 'text-xl', 
            findingTitle: 'text-sm',
            findingValue: 'text-sm',
            noteText: 'text-sm',
            disclaimer: 'text-xs',
        },
        pageBackgroundColor: '#ffffff',
        textColor: '#1e293b', 
        borderColor: '#cbd5e1', 
        disclaimerText: 'هذا التقرير يعكس حالة السيارة وقت الفحص بناءً على فحص ظاهري وفني بالأجهزة المتاحة. الورشة غير مسؤولة عن أي أعطال قد تظهر مستقبلًا أو لم يتم اكتشافها أثناء الفحص.',
        headerSubtitleText: 'تقرير فحص فني للسيارات',
        headerTitleBold: true,
        headerSubtitleBold: false,
        headerAdditionalTexts: [],
        headerCustomFields: [
            { id: 'cr-1', label: 'السجل التجاري', value: '1010XXXXXX' },
            { id: 'vat-1', label: 'الرقم الضريبي', value: '3000XXXXXX' },
        ],
        showQrCode: true,
        findingContainerBackgroundColor: '#f8fafc', 
        qrCodePosition: 'left',
        qrCodeSize: '96px', 
        findingCardSize: 'medium',
        showPageNumbers: true,
        noteImageSize: 'medium',
        qrCodeContent: 'https://example.com/report/{request_number}',
        workshopStampUrl: null,
        qrCodeStyle: {
            dotsOptions: { style: 'square' },
            cornersSquareOptions: { style: 'square' },
            color: '#000000'
        },
        watermarkOpacity: 0.06,
        watermarkSize: 45,
        watermarkRepeatSpacing: 350,
        watermarkRotation: -25,
        watermarkTextStyle: 'filled',
        bulletColor: '#94a3b8',
        bulletSize: 6,
        bulletStyle: 'circle',
        showPriceOnReport: true,
        workshopLogoHeight: 90,
        carLogoHeight: 60,
        noteHighlightOpacity: 0.1
    },
    draftSettings: {
        customImageUrl: null,
        imageX: 20,
        imageY: 80,
        imageWidth: 170,
        imageHeight: 90,
        showImageForInspectionTypeIds: [],
    },
    customReportTemplates: [],
};

const allPermissions: Permission[] = Object.keys(PERMISSIONS) as Permission[];

export const mockEmployees: Employee[] = [
  {
    id: 'emp-1',
    email: 'gm@example.com',
    name: 'أحمد علي (مدير عام)',
    role: 'general_manager',
    is_active: true,
    permissions: allPermissions,
    password: 'password123',
    salary: 8000
  },
  {
    id: 'emp-2',
    email: 'employee@example.com',
    name: 'محمد خالد (موظف)',
    role: 'employee',
    is_active: true,
    permissions: ['view_dashboard', 'fill_requests', 'create_requests'],
    password: 'password123',
    salary: 4000
  },
  {
    id: 'emp-3',
    email: 'manager@example.com',
    name: 'سارة عبدالله (مدير)',
    role: 'manager',
    is_active: true,
    permissions: [
        'view_dashboard', 
        'manage_clients', 
        'create_requests', 
        'update_requests_data', 
        'fill_requests', 
        'delete_requests',
        'manage_settings_general',
        'manage_expenses'
    ],
    password: 'password123',
    salary: 6000
  },
];


const today = new Date();
const getRecentDate = (daysAgo: number, hour: number) => {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
};

export const mockRequests: InspectionRequest[] = [
  {
    id: 'req-1',
    request_number: 1001,
    client_id: 'cli-1',
    car_id: 'car-1',
    car_snapshot: { make_ar: 'تويوتا', make_en: 'Toyota', model_ar: 'كامري', model_en: 'Camry', year: 2022 },
    inspection_type_id: 'type-1',
    payment_type: PaymentType.Card,
    price: 350,
    status: RequestStatus.COMPLETE,
    created_at: getRecentDate(1, 10), 
    employee_id: 'emp-1',
    broker: { id: 'broker-1', commission: 50 },
    inspection_data: {}, general_notes: [], category_notes: {}, voice_memos: {}, structured_findings: [], activity_log: [], attached_files: [],
  },
  {
    id: 'req-2',
    request_number: 1002,
    client_id: 'cli-2',
    car_id: 'car-2',
    inspection_type_id: 'type-2',
    payment_type: PaymentType.Cash,
    price: 150,
    status: RequestStatus.IN_PROGRESS,
    created_at: getRecentDate(2, 11), 
    employee_id: 'emp-2',
    inspection_data: {},
    general_notes: [
        {
            id: 'gn-1',
            text: 'السيارة بحالة عامة جيدة وتحتاج فقط للإصلاحات المذكورة.',
            authorId: 'emp-2',
            authorName: 'محمد خالد (موظف)'
        }
    ],
    category_notes: {
        'cat-4': [
            {
                id: 'cn-1',
                text: 'تم العثور على رمز خطأ P0135 يشير إلى مشكلة في دائرة سخان حساس الأكسجين.',
                authorId: 'emp-2',
                authorName: 'محمد خالد (موظف)'
            }
        ]
    },
    voice_memos: {},
    structured_findings: [
        {
            findingId: 'find-7',
            findingName: 'نتيجة فحص الكمبيوتر',
            value: 'يوجد أكواد أعطال',
            categoryId: 'cat-4',
        }
    ],
    activity_log: [],
    attached_files: [],
  },
  {
    id: 'req-3',
    request_number: 1003,
    client_id: 'cli-3',
    car_id: 'car-3',
    inspection_type_id: 'type-1',
    payment_type: PaymentType.Unpaid,
    price: 350,
    status: RequestStatus.IN_PROGRESS,
    created_at: getRecentDate(3, 15), 
    employee_id: 'emp-1',
    inspection_data: {}, general_notes: [], category_notes: {}, voice_memos: {}, structured_findings: [], activity_log: [], attached_files: [],
  },
    {
    id: 'req-4',
    request_number: 1004,
    client_id: 'cli-1',
    car_id: 'car-4',
    inspection_type_id: 'type-1',
    payment_type: PaymentType.Cash,
    price: 350,
    status: RequestStatus.COMPLETE,
    created_at: getRecentDate(4, 9), 
    employee_id: 'emp-2',
    broker: { id: 'broker-2', commission: 75 },
    inspection_data: {}, general_notes: [], category_notes: {}, voice_memos: {}, structured_findings: [], activity_log: [], attached_files: [],
  },
  {
    id: 'req-5',
    request_number: 1005,
    client_id: 'cli-2',
    car_id: 'car-5',
    inspection_type_id: 'type-3',
    payment_type: PaymentType.Card,
    price: 200,
    status: RequestStatus.COMPLETE,
    created_at: getRecentDate(5, 14), 
    employee_id: 'emp-1',
    inspection_data: {}, general_notes: [], category_notes: {}, voice_memos: {}, structured_findings: [], activity_log: [], attached_files: [],
  },
  {
    id: 'req-6',
    request_number: 1006,
    client_id: 'cli-1',
    car_id: 'car-1', 
    car_snapshot: { make_ar: 'تويوتا', make_en: 'Toyota', model_ar: 'كامري', model_en: 'Camry', year: 2022 },
    inspection_type_id: 'type-3',
    payment_type: PaymentType.Cash,
    price: 200,
    status: RequestStatus.NEW,
    created_at: getRecentDate(0, 9), 
    employee_id: 'emp-2',
    inspection_data: {}, general_notes: [], category_notes: {}, voice_memos: {}, structured_findings: [], activity_log: [], attached_files: [],
  },
];
