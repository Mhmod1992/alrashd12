import { Page, UserPreferences } from '../types';

export const REQUESTS_PAGE_SIZE = 50;
export const LIGHTWEIGHT_REQUEST_COLUMNS = 'id, request_number, client_id, car_id, car_snapshot, inspection_type_id, payment_type, price, status, created_at, employee_id, broker, updated_at, report_stamps, payment_note, split_payment_details, technician_assignments, inspection_data';
export const INACTIVITY_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 Hours

// Keys that are considered personal preferences
export const PERSONAL_SETTING_KEYS: (keyof UserPreferences)[] = [
    'design',
    'sidebarStyle',
    'headerStyle',
    'backgroundImageUrl',
    'backgroundColor',
    'glassmorphismIntensity',
    'disableAutoSortRequests'
];

// --- NAVIGATION CONFIGURATION ---
export const ROOT_PAGES: Page[] = [
    'dashboard',
    'requests',
    'waiting-requests',
    'clients',
    'financials',
    'settings',
    'brokers',
    'expenses',
    'revenues',
    'mailbox',
    'archive',
    'employees',
    'reservations'
];

export const PARENT_MAP: Partial<Record<Page, Page>> = {
    'fill-request': 'requests',
    'print-report': 'requests',
    'request-draft': 'requests',
    'profile': 'dashboard',
};
