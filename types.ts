

export type Page = 'dashboard' | 'requests' | 'waiting-requests' | 'clients' | 'settings' | 'fill-request' | 'print-report' | 'financials' | 'request-draft' | 'profile' | 'brokers' | 'expenses' | 'revenues' | 'mailbox' | 'archive' | 'paper-archive' | 'employees' | 'reservations';

export enum RequestStatus {
  IN_PROGRESS = 'قيد التنفيذ',
  COMPLETE = 'مكتمل',
  NEW = 'جديد',
  WAITING_PAYMENT = 'بانتظار الدفع',
}

export enum PaymentType {
  Cash = 'نقدي',
  Card = 'بطاقة',
  Transfer = 'تحويل',
  Split = 'دفع مجزأ (نقدي + بطاقة)',
  Unpaid = 'غير مدفوع',
}

export type Role = 'general_manager' | 'manager' | 'employee' | 'receptionist';

export const PERMISSIONS = {
  view_dashboard: 'عرض لوحة التحكم',
  view_login_notifications: 'عرض إشعارات تسجيل الدخول',
  send_internal_messages: 'إرسال رسائل داخلية',
  create_requests: 'إنشاء طلبات',
  view_completed_requests: 'عرض الطلبات المكتملة',
  view_waiting_requests: 'عرض الطلبات بانتظار الدفع',
  update_requests_data: 'تحديث بيانات الطلب الأساسية',
  change_request_status: 'تغيير حالة الطلب (إعادة فتح)',
  mark_request_complete: 'تحديد الطلب كمكتمل (إغلاق الطلب)',
  delete_requests: 'حذف الطلبات',
  print_request: 'معاينة وطباعة الطلب',
  export_data: 'تصدير البيانات (Excel/JSON)',
  fill_requests: 'تعبئة بيانات الفحص',
  view_request_info: 'عرض بطاقة معلومات الطلب',
  view_car_history_on_create: 'عرض سجل السيارة عند إنشاء طلب',
  view_archive: 'عرض أرشيف الفحص الشامل',
  manage_paper_archive: 'إدارة أرشيف الورقيات',
  manage_notes: 'إدارة الملاحظات (إضافة/تعديل/حذف)',
  manage_findings: 'إدارة بنود الفحص (إضافة/تعديل/حذف)',
  view_activity_log: 'عرض سجل النشاط',
  view_financials: 'عرض البيانات المالية',
  manage_expenses: 'إدارة المصروفات (إضافة/تعديل)',
  manage_revenues: 'إدارة الإيرادات الأخرى',
  delete_expenses: 'حذف المصروفات',
  edit_request_price: 'تعديل سعر الطلب يدوياً',
  process_payment: 'تحصيل المدفوعات وتفعيل الطلبات',
  manage_clients: 'ادارة العملاء',
  manage_employees: 'إدارة الموظفين والصلاحيات',
  manage_brokers: 'إدارة السماسرة',
  manage_technicians: 'إدارة الفنيين (غير المستخدمين)',
  manage_settings_general: 'إدارة الإعدادات العامة',
  manage_settings_technical: 'إدارة الإعدادات الفنية',
  manage_appearance: 'إدارة المظهر',
  manage_api_keys: 'إدارة مفاتيح الربط (API Keys)',
  manage_reservations: 'إدارة الحجوزات الواردة',
  view_requests_list: 'عرض صفحة إدارة الطلبات',
  view_settings: 'عرض صفحة الإعدادات',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export interface Reservation {
  id: string;
  source_text: string;
  client_name: string;
  client_phone: string;
  car_details: string; // Text description e.g. "Toyota Camry 2023"
  plate_text: string; // Raw plate text
  service_type: string;
  notes?: string;
  status: 'new' | 'confirmed' | 'converted' | 'cancelled';
  car_make_id?: string;
  car_model_id?: string;
  created_at: string;
}

// ... Payroll Types ...
export interface PayrollItem {
  id: string;
  type: 'employee' | 'technician';
  name: string;
  role: string;
  baseSalary: number;
  bonus: number;
  bonusNote: string;
  deductions: number;
  deductionNote: string;
  netSalary: number;
  isPaid?: boolean;
}

export interface PayrollDraft {
  id?: string;
  month: number;
  year: number;
  items: PayrollItem[];
  last_updated?: string;
  status: 'draft' | 'approved';
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  is_vip?: boolean;
}

export interface CarMake {
  id: string;
  name_ar: string;
  name_en: string;
  logo_url?: string;
}

export interface CarModel {
  id: string;
  make_id: string;
  name_ar: string;
  name_en: string;
}

export interface Car {
  id: string;
  make_id: string;
  model_id: string;
  year: number;
  plate_number: string | null;
  plate_number_en?: string | null;
  vin?: string | null;
}

export interface InspectionType {
  id: string;
  name: string;
  price: number;
  finding_category_ids: string[];
  fill_tab_order_ids?: string[];
}

export interface Broker {
  id: string;
  name: string;
  phone?: string;
  default_commission: number;
  is_active: boolean;
  created_by?: string;
  created_by_name?: string;
}

export interface Technician {
  id: string;
  name: string;
  title: string;
  is_active: boolean;
  salary?: number;
}

export type HighlightColor = 'yellow' | 'red' | 'green' | 'blue';

export interface Note {
  id: string;
  text: string;
  originalText?: string;
  image?: string;
  authorId: string;
  authorName: string;
  status?: 'saving' | 'saved' | 'error';
  highlightColor?: HighlightColor;
  localFile?: File;
  translations?: Record<string, string>;
  displayTranslation?: { lang: 'ar' | 'en' | 'hi' | 'ur'; isActive: boolean; };
  categoryId?: string | 'general';
}

export interface CustomFindingCategory {
  id: string;
  name: string;
}

export interface StructuredFinding {
  findingId: string;
  findingName: string;
  value: string;
  categoryId: string;
  status?: 'saving' | 'saved' | 'error';
}

export interface PredefinedFinding {
  id: string;
  name: string;
  category_id: string;
  options: string[];
  reference_image?: string;
  group?: string;
  groups?: string[];
  reference_image_position?: string;
  orderIndex?: number;
  report_position?: 'right' | 'center' | 'left';
  is_bundle?: boolean;
  linked_finding_ids?: string[];
  bundle_default_value?: string;
}

export interface AttachedFile {
  name: string;
  type: string;
  data: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeName: string;
  action: string;
  details: string;
  imageUrl?: string;
  link_id?: string;
  link_page?: Page;
}

export interface VoiceMemo {
  id: string;
  audioData: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  duration: number;
  status?: 'saving' | 'saved' | 'error';
  transcription?: string;
  isTranscribing?: boolean;
  isEditingTranscription?: boolean;
  localBlob?: Blob;
}

export interface CarSnapshot {
  make_ar: string;
  make_en: string;
  model_ar: string;
  model_en: string;
  year: number;
}

export interface SplitPaymentDetails {
  cash: number;
  card: number;
}

export type ReportStamp = 'CUSTOMER_REQUEST_INCOMPLETE';

export interface InspectionRequest {
  id: string;
  request_number: number;
  client_id: string;
  car_id: string;
  car_snapshot?: CarSnapshot;
  inspection_type_id: string;
  payment_type: PaymentType;
  split_payment_details?: SplitPaymentDetails;
  price: number;
  status: RequestStatus;
  created_at: string;
  updated_at?: string;
  employee_id: string | null;
  broker?: {
    id: string;
    commission: number;
  };
  payment_note?: string;
  inspection_data?: Record<string, any>;
  general_notes?: Note[];
  category_notes?: Record<string, Note[]>;
  voice_memos?: Record<string, VoiceMemo[]>;
  structured_findings?: StructuredFinding[];
  activity_log?: ActivityLog[];
  attached_files?: AttachedFile[];
  technician_assignments?: Record<string, string[]>;
  report_stamps?: ReportStamp[];
  report_url?: string;
  report_generated_at?: string;
}

export interface PlateCharacterMap {
  ar: string;
  en: string;
}

export interface PlatePreviewSettings {
  backgroundColor: string;
  borderColor: string;
  fontColor: string;
  fontFamily: string;
  fontSize: string;
  letterSpacing: string;
  separatorImageUrl: string | null;
  separatorWidth: string;
  separatorHeight: string;
}

export interface QrCodeStyle {
  dotsOptions: {
    style: 'dots' | 'rounded' | 'square';
  };
  cornersSquareOptions: {
    style: 'dot' | 'square' | 'extra-rounded';
  };
  color: string;
}

export interface ReportFontSizes {
  headerTitle: string;
  headerSubtitle: string;
  headerAdditional: string;
  sectionTitle: string;
  categoryTitle: string;
  blockTitle: string;
  blockHeader: string;
  blockContent: string;
  blockLabel: string;
  carName: string;
  findingTitle: string;
  findingValue: string;
  noteText: string;
  disclaimer: string;
}

export interface ReportSettings {
  reportLogoUrl: string | null;
  primaryColor: string;
  appNameColor: string;
  sectionTitleBackgroundColor: string;
  sectionTitleFontColor: string;
  findingsHeaderBackgroundColor: string;
  findingsHeaderFontColor: string;
  noteImageBorderColor: string;
  noteImageBorderRadius: string;
  fontFamily: string;
  fontSizes: ReportFontSizes;
  pageBackgroundColor: string;
  textColor: string;
  borderColor: string;
  disclaimerText: string;
  headerSubtitleText: string;
  headerTitleBold: boolean;
  headerSubtitleBold: boolean;
  headerAdditionalTexts: { id: string; text: string; bold: boolean }[];
  headerCustomFields: { id: string; label: string; value: string }[]; // New Field
  showQrCode: boolean;
  findingContainerBackgroundColor: string;
  qrCodePosition: 'left' | 'right';
  qrCodeSize: string;
  findingCardSize: 'x-small' | 'small' | 'medium' | 'large';
  showPageNumbers: boolean;
  noteImageSize: 'small' | 'medium' | 'large';
  qrCodeContent: string;
  workshopStampUrl: string | null;
  qrCodeStyle: QrCodeStyle;
  watermarkOpacity: number;
  watermarkSize: number;
  watermarkRepeatSpacing: number;
  watermarkRotation: number;
  watermarkTextStyle: 'filled' | 'outline';
  bulletColor: string;
  bulletSize: number;
  bulletStyle: 'circle' | 'square' | 'dash';
  showPriceOnReport: boolean;
  workshopLogoHeight: number;
  carLogoHeight: number;
  noteHighlightOpacity: number;
}

export interface CustomReportTemplate {
  id: string;
  name: string;
  settings: ReportSettings;
}

export interface DraftSettings {
  customImageUrl: string | null;
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
  showImageForInspectionTypeIds: string[];
  imageStyle?: 'absolute' | 'float';
}

export interface Settings {
  appName: string;
  logoUrl: string | null;
  design: 'aero' | 'classic' | 'glass';
  sidebarStyle: 'default' | 'minimal';
  headerStyle: 'default' | 'elevated';
  backgroundImageUrl: string | null;
  backgroundColor: string | null;
  glassmorphismIntensity: number;
  plateCharacters: PlateCharacterMap[];
  platePreviewSettings: PlatePreviewSettings;
  reportSettings: ReportSettings;
  draftSettings?: DraftSettings;
  customReportTemplates: CustomReportTemplate[];
  geminiApiKey: string | null;
  googleMapsLink?: string;
  locationUrl?: string;
  databaseCapacity: number;
  storageCapacity: number;
  setupCompleted?: boolean;
  allowSignup?: boolean; // New setting to toggle signup button
}

export interface UserPreferences {
  design?: 'aero' | 'classic' | 'glass';
  sidebarStyle?: 'default' | 'minimal';
  headerStyle?: 'default' | 'elevated';
  backgroundImageUrl?: string | null;
  backgroundColor?: string | null;
  glassmorphismIntensity?: number;
  isTechnician?: boolean; // Add isTechnician here
}

export type SettingsPage = 'general' | 'appearance' | 'request' | 'employees' | 'technicians' | 'cars' | 'plate' | 'report' | 'api' | 'draft';

export interface Employee {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: Permission[];
  is_active: boolean;
  password?: string;
  preferences?: UserPreferences;
  salary?: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface AppNotification {
  id: string;
  created_at: string;
  title: string;
  message: string;
  is_read: boolean;
  link?: Page;
  link_id?: string;
  type: 'login' | 'general' | 'new_request' | 'status_change' | 'delete_request' | 'update_request';
  user_id?: string | null;
  created_by_name?: string;
}

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  icon?: 'info' | 'warning' | 'success';
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  employeeId: string;
  employeeName: string;
}

export interface Revenue {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: PaymentType;
  employeeId: string;
  employeeName: string;
}

export interface InternalMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  receiver_name: string;
  subject: string;
  content: string;
  is_read: boolean;
  priority: 'normal' | 'high' | 'urgent';
  created_at: string;
}

export interface FinancialStats {
  totalRevenue: number;
  totalOtherRevenue: number;
  actualCashFlow: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  unpaidTotal: number;
  totalExpenses: number;
  totalAdvances: number;
  totalCommissions: number;
  netProfit: number;
  ledgerData: any[];
  dailyRevenueChart: { label: string; value: number }[];
  paymentDistribution: { label: string; value: number; color: string }[];
  brokerSummary: { name: string; amount: number; count: number }[];
  forecast: {
    history: { date: string; value: number; label: string }[];
    data: { date: string; value: number; label: string }[];
    trend: string;
  };
  filteredRequests: InspectionRequest[];
  filteredExpenses: Expense[];
  filteredRevenues: Revenue[];
}

export interface ArchiveResult {
  car: Car & { make?: CarMake; model?: CarModel };
  client?: Client;
  lastVisit: string;
  visitCount: number;
  id: string;
}