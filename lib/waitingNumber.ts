import { supabase } from './supabaseClient';
import { InspectionRequest, RequestStatus } from '../types';

const STORAGE_KEY = 'al_fahs_highest_waiting_number';

/**
 * Extracts the waiting number from an inspection request.
 * Checks waiting_number property first, then inspection_data.waiting_number, then payment_note [W-xxx].
 */
export const getWaitingNumber = (req: Partial<InspectionRequest> | null | undefined): number | null => {
  if (!req) return null;
  if (typeof req.waiting_number === 'number' && !isNaN(req.waiting_number)) {
    return req.waiting_number;
  }
  if (req.inspection_data && typeof req.inspection_data.waiting_number === 'number' && !isNaN(req.inspection_data.waiting_number)) {
    return req.inspection_data.waiting_number;
  }
  if (req.payment_note) {
    const match = req.payment_note.match(/\[W-(\d+)\]/i);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
};

/**
 * Synchronously computes the next waiting number (100 to 1000 cycle).
 * Resets back to 100 after reaching 1000.
 */
export const getNextWaitingNumber = (
  existingRequests?: Array<{ waiting_number?: number; payment_note?: string; status?: RequestStatus; inspection_data?: any }>
): number => {
  let highest = 99;

  // 1. Scan in-memory requests
  if (existingRequests && Array.isArray(existingRequests)) {
    for (const r of existingRequests) {
      const num = getWaitingNumber(r as any);
      if (num !== null && !isNaN(num) && num > highest) {
        highest = num;
      }
    }
  }

  // 2. Check localStorage cache
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > highest) {
          highest = parsed;
        }
      }
    }
  } catch (e) {
    // Ignore storage read errors
  }

  // 3. Cycle: 100 to 1000. Reset to 100 after 1000.
  let nextNumber = 100;
  if (highest >= 100 && highest < 1000) {
    nextNumber = highest + 1;
  } else {
    nextNumber = 100;
  }

  // 4. Ensure no collision with currently active waiting requests
  const activeNumbers = new Set<number>();
  if (existingRequests && Array.isArray(existingRequests)) {
    for (const r of existingRequests) {
      if (r.status === RequestStatus.WAITING_PAYMENT) {
        const activeNum = getWaitingNumber(r as any);
        if (activeNum !== null) activeNumbers.add(activeNum);
      }
    }
  }

  let attempts = 0;
  while (activeNumbers.has(nextNumber) && attempts < 901) {
    nextNumber = nextNumber >= 1000 ? 100 : nextNumber + 1;
    attempts++;
  }

  // 5. Update localStorage cache
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(nextNumber));
    }
  } catch (e) {
    // Ignore storage write errors
  }

  return nextNumber;
};

/**
 * Asynchronously queries the database to guarantee cross-device synchronization
 * of the waiting counter before returning the next number (100 to 1000 cycle).
 * Resets back to 100 after reaching 1000.
 */
export const getNextWaitingNumberAsync = async (
  existingRequests?: Array<{ waiting_number?: number; payment_note?: string; status?: RequestStatus; inspection_data?: any }>
): Promise<number> => {
  let highest = 99;

  // 1. Direct query to Supabase inspection_requests to fetch recently created or active requests across all devices
  try {
    const { data: dbRequests } = await supabase
      .from('inspection_requests')
      .select('payment_note, inspection_data, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (dbRequests && Array.isArray(dbRequests)) {
      for (const r of dbRequests) {
        const num = getWaitingNumber(r as any);
        if (num !== null && !isNaN(num) && num > highest) {
          highest = num;
        }
      }
    }
  } catch (err) {
    console.warn('Could not query remote waiting numbers:', err);
  }

  // 2. Scan all existing local requests (kept synced via real-time WebSocket)
  if (existingRequests && Array.isArray(existingRequests)) {
    for (const r of existingRequests) {
      const num = getWaitingNumber(r as any);
      if (num !== null && !isNaN(num) && num > highest) {
        highest = num;
      }
    }
  }

  // 3. Check localStorage cache
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > highest) {
          highest = parsed;
        }
      }
    }
  } catch (e) {
    // Ignore storage read errors
  }

  // 4. Cycle: 100 to 1000. Reset to 100 after 1000.
  let nextNumber = 100;
  if (highest >= 100 && highest < 1000) {
    nextNumber = highest + 1;
  } else {
    nextNumber = 100;
  }

  // 5. Ensure the chosen number does NOT collide with any active waiting request
  const activeNumbers = new Set<number>();
  if (existingRequests && Array.isArray(existingRequests)) {
    for (const r of existingRequests) {
      if (r.status === RequestStatus.WAITING_PAYMENT) {
        const activeNum = getWaitingNumber(r as any);
        if (activeNum !== null) activeNumbers.add(activeNum);
      }
    }
  }

  let attempts = 0;
  while (activeNumbers.has(nextNumber) && attempts < 901) {
    nextNumber = nextNumber >= 1000 ? 100 : nextNumber + 1;
    attempts++;
  }

  // 6. Cache the latest generated waiting number locally
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(nextNumber));
    }
  } catch (e) {
    // Ignore storage write errors
  }

  return nextNumber;
};
