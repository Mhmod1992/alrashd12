import { Page, UserPreferences } from '../types';

export const REQUESTS_PAGE_SIZE = 50;
export const INACTIVITY_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 Hours

// Keys that are considered personal preferences
export const PERSONAL_SETTING_KEYS: (keyof UserPreferences)[] = [
    'design',
    'sidebarStyle',
    'headerStyle',
    'backgroundImageUrl',
    'backgroundColor',
    'glassmorphismIntensity'
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
