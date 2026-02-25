
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { InspectionRequest, RequestStatus, StructuredFinding, Note, PaymentType, ActivityLog, Settings, PredefinedFinding, VoiceMemo, ReportStamp, HighlightColor, CustomFindingCategory, Page } from '../types';

import Icon from '../components/Icon';
import Modal from '../components/Modal';
import RefreshCwIcon from '../components/icons/RefreshCwIcon';
import Button from '../components/Button';
import SearchIcon from '../components/icons/SearchIcon';
import Drawer from '../components/Drawer';
import MoreVerticalIcon from '../components/icons/MoreVerticalIcon';
import { uuidv4, estimateObjectSize, formatBytes } from '../lib/utils';
import ImageGallery from '../components/ImageGallery';
import ChevronDownIcon from '../components/icons/ChevronDownIcon';
import { GoogleGenAI, Type } from "@google/genai";
import FindingCard from '../components/FindingCard';
import MicrophoneIcon from '../components/icons/MicrophoneIcon';

import CarIcon from '../components/icons/CarIcon';
import ReviewModeModal, { ReviewItem } from '../components/ReviewModeModal';
import EyeIcon from '../components/icons/EyeIcon';
import LockIcon from '../components/icons/LockIcon';
import TechnicianSelectionModal from '../components/TechnicianSelectionModal';
import UserCircleIcon from '../components/icons/UserCircleIcon';
import XIcon from '../components/icons/XIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import AlertTriangleIcon from '../components/icons/AlertTriangleIcon';
import WifiOffIcon from '../components/icons/WifiOffIcon';
import ClipboardListIcon from '../components/icons/ClipboardListIcon';
import WhatsappIcon from '../components/icons/WhatsappIcon';


// Imported Components (Refactored)
import AudioPlayer from '../components/AudioPlayer';
import StatusIndicator from '../components/StatusIndicator';
import MiniPlateDisplay from '../components/MiniPlateDisplay';
import { StickyNoteInput } from '../components/StickyNoteInput';

// FillRequest Components

import FindingSearchSelect from './FillRequest/components/FindingSearchSelect';
import BatchFindingEntry from './FillRequest/components/BatchFindingEntry';
import FillRequestHeader from './FillRequest/components/FillRequestHeader';

// FillRequest Constants
import { highlightColors } from './FillRequest/constants';

// FillRequest Utils
import { formatLogDetails, getActionIcon, groupLogsByDate, formatLogTimestamp } from './FillRequest/utils/activityLog';
import { supabase } from '../lib/supabaseClient';
import { clean, cleanCategoryNotes, cleanVoiceMemos, updateStatusToError, cleanDataForComparison, updateItemsAfterSave } from './FillRequest/utils/helpers';


export const FillRequest: React.FC = () => {
    const {
        authUser, selectedRequestId, requests, searchedRequests, clients, cars, carMakes,
        carModels, inspectionTypes, setPage, setSettingsPage, predefinedFindings, customFindingCategories,
        setSelectedRequestId, updateRequest, addNotification, uploadImage,
        deleteImage, can, settings, goBack, showConfirmModal, createActivityLog,
        fetchRequestTabContent, fetchFullRequestForSave, setIsFocusMode,
        hasUnsavedChanges, setHasUnsavedChanges, unreadMessagesCount, setIsMailboxOpen, technicians
    } = useAppContext();

    const focusRingClass = `focus:ring-${settings.design === 'classic' ? 'teal' : settings.design === 'glass' ? 'indigo' : 'blue'}-500`;
    const themeColor = settings.design === 'classic' ? 'teal' : settings.design === 'glass' ? 'indigo' : 'blue';

    const [sessionEgress, setSessionEgress] = useState(0);
    const [isLoadingTab, setIsLoadingTab] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

    // UI state
    const [isTechnicianModalOpen, setIsTechnicianModalOpen] = useState(false);
    const [technicianModalTarget, setTechnicianModalTarget] = useState<{ id: string, name: string } | null>(null);
    const [colorPickerOpenFor, setColorPickerOpenFor] = useState<string | null>(null);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const [multiSelectMode, setMultiSelectMode] = useState<Record<string, boolean>>({}); // key: 'general' or categoryId
    const [selectedNoteIds, setSelectedNoteIds] = useState<Record<string, Set<string>>>({}); // key: 'general' or categoryId
    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);

    // View Modes
    const [findingsViewMode, setFindingsViewMode] = useState<'grid' | 'list'>('grid');
    const [isGroupedView, setIsGroupedView] = useState(false);
    // Main Accordion Control
    const [isFindingsSectionOpen, setIsFindingsSectionOpen] = useState(true);

    // Ref to track mounted state for async operations
    const isMounted = useRef(true);
    // Ref to track last user interaction time (prevents sync wars)
    const lastInteractionRef = useRef<number>(0);

    // Refs for new layout
    const contentRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);
    const [footerHeight, setFooterHeight] = useState(0);
    const [showScrollTop, setShowScrollTop] = useState(false);


    // Activity Log Filter
    const [activityLogFilter, setActivityLogFilter] = useState<string>('all');
    const [activityLogCategoryFilter, setActivityLogCategoryFilter] = useState<string>('all');
    const [activityLogSearch, setActivityLogSearch] = useState<string>('');

    // Scroll to Bottom Helper
    const scrollToBottom = useCallback(() => {
        if (contentRef.current) {
            contentRef.current.scrollTo({
                top: contentRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, []);

    const scrollToTop = () => {
        if (contentRef.current) {
            contentRef.current.scrollTo({
                top: 0,
                behavior: 'smooth',
            });
        }
    };

    // Scroll Event Listener
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        setShowScrollTop(scrollTop > 300);
    };

    useEffect(() => {
        isMounted.current = true;
        setIsFocusMode(true);
        // Reset loading lock when we switch requests
        setIsInitialDataLoaded(false);
        setLoadedTabs(new Set());

        return () => {
            isMounted.current = false;
            setIsFocusMode(false);
            setHasUnsavedChanges(false);
        };
    }, [selectedRequestId, setIsFocusMode, setHasUnsavedChanges]);

    // Resize Observer for dynamic footer height
    useEffect(() => {
        const footerEl = footerRef.current;
        if (!footerEl) return;

        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                setFooterHeight(entry.contentRect.height);
            }
        });

        observer.observe(footerEl);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                const targetElement = event.target as HTMLElement;
                if (!targetElement.closest('.color-picker-trigger')) {
                    setColorPickerOpenFor(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const trackDataTransfer = useCallback((size: number) => {
        setSessionEgress(prev => prev + size);
    }, []);

    const request = useMemo(() => {
        return requests.find(r => r.id === selectedRequestId) || searchedRequests?.find(r => r.id === selectedRequestId);
    }, [requests, searchedRequests, selectedRequestId]);

    // LOCKED STATE CHECK
    const isLocked = request?.status === RequestStatus.COMPLETE;

    const [generalNotes, setGeneralNotes] = useState<Note[]>([]);
    const [structuredFindings, setStructuredFindings] = useState<StructuredFinding[]>([]);
    const [categoryNotes, setCategoryNotes] = useState<Record<string, Note[]>>({});
    const [voiceMemos, setVoiceMemos] = useState<Record<string, VoiceMemo[]>>({});
    const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);

    const [isFindingModalOpen, setIsFindingModalOpen] = useState(false);
    const [findingSearchTerm, setFindingSearchTerm] = useState('');
    const [selectedFindingsInModal, setSelectedFindingsInModal] = useState<Set<string>>(new Set());

    const [isEditNoteModalOpen, setIsEditNoteModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<{ note: Note; categoryId: string | 'general' } | null>(null);
    const [modalNoteData, setModalNoteData] = useState<{ text: string; image: string | null; highlightColor: HighlightColor | null }>({ text: '', image: null, highlightColor: null });
    const [modalNoteFile, setModalNoteFile] = useState<File | null>(null);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
    const [isCompletionToggled, setIsCompletionToggled] = useState(false);

    const [deletingNoteIds, setDeletingNoteIds] = useState<Set<string>>(new Set());
    const [deletingFindingIds, setDeletingFindingIds] = useState<Set<string>>(new Set());

    const [activeFindingGroup, setActiveFindingGroup] = useState<string | null>(null);
    const [categorySubTab, setCategorySubTab] = useState<'main' | 'voice'>('main');

    const inspectionType = useMemo(() => request ? inspectionTypes.find(i => i.id === request.inspection_type_id) : undefined, [request, inspectionTypes]);

    // --- FIX: Respect the FILL ORDER if defined in the inspection package (inspectionType.fill_tab_order_ids) ---
    const visibleFindingCategories = useMemo(() => {
        // Use fill_tab_order_ids if available, otherwise fallback to finding_category_ids
        const visibleIds = inspectionType?.fill_tab_order_ids || inspectionType?.finding_category_ids || [];

        // Map the IDs to their corresponding category objects in the exact order they appear in visibleIds
        return visibleIds
            .map(id => customFindingCategories.find(c => c.id === id))
            .filter((c): c is CustomFindingCategory => !!c); // Remove undefined values
    }, [inspectionType, customFindingCategories]);

    // Full tab sequence for navigation
    const allTabsInOrder = useMemo(() => [
        ...visibleFindingCategories.map(c => c.id),
        'general-notes'
    ], [visibleFindingCategories]);

    const arToEnMap = useMemo(() => {
        const map = new Map<string, string>();
        if (settings?.plateCharacters) {
            settings.plateCharacters.forEach(pc => {
                map.set(pc.ar.replace('ـ', ''), pc.en);
            });
        }
        return map;
    }, [settings?.plateCharacters]);

    const allImages = useMemo(() => {
        if (!request) return [];
        const images: {
            id: string;
            imageUrl: string;
            text: string;
            categoryName: string;
            authorName: string;
        }[] = [];

        ((request?.general_notes as Note[]) || []).forEach(note => {
            if (note.image) {
                images.push({
                    id: note.id,
                    imageUrl: note.image,
                    text: note.text,
                    categoryName: 'ملاحظات عامة',
                    authorName: note.authorName || 'غير معروف',
                });
            }
        });

        Object.entries(request?.category_notes || {}).forEach(([catId, notes]) => {
            const category = customFindingCategories.find(c => c.id === catId);
            const categoryName = category ? category.name : 'قسم غير معروف';
            ((notes as Note[]) || []).forEach(note => {
                if (note.image) {
                    images.push({
                        id: note.id,
                        imageUrl: note.image,
                        text: note.text,
                        categoryName: categoryName,
                        authorName: note.authorName || 'غير معروف',
                    });
                }
            });
        });

        return images;
    }, [request, customFindingCategories]);

    const generalTextOnlyNotes = ((request?.general_notes as Note[]) || []).filter(note => !note.image);

    const getDefaultTab = useCallback(() => {
        const tabsInOrder = [
            ...visibleFindingCategories.map(c => c.id),
            'general-notes',
            'gallery',
        ];
        return tabsInOrder[0];
    }, [visibleFindingCategories]);

    const [activeTab, setActiveTab] = useState<string>(getDefaultTab());
    const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

    const debounceTimeoutRef = useRef<number | null>(null);
    const inspectionDataRef = useRef({ generalNotes, categoryNotes, structuredFindings, voiceMemos, activityLog });
    const prevRequestRef = useRef<InspectionRequest | undefined>(undefined);

    // Draft Keys for LocalStorage
    const getDraftKey = useCallback((id: string) => `request_draft_${id}`, []);

    // --- Persist State to Local Storage on Change ---
    useEffect(() => {
        if (request && isInitialDataLoaded) {
            const dataToSave = {
                generalNotes,
                categoryNotes,
                structuredFindings,
                voiceMemos,
                activityLog, // Optional to save locally, but good for restoring state
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem(getDraftKey(request.id), JSON.stringify(dataToSave));
        }
    }, [generalNotes, categoryNotes, structuredFindings, voiceMemos, activityLog, request, isInitialDataLoaded, getDraftKey]);


    useEffect(() => {
        if (!request) return;

        const loadContent = async () => {
            let group: 'general' | 'categories' | 'gallery' | null = null;

            if (activeTab === 'general-notes') {
                if (loadedTabs.has('general')) return;
                group = 'general';
            } else if (activeTab === 'gallery') {
                if (loadedTabs.has('general') && loadedTabs.has('categories')) return;
                group = 'gallery';
            } else {
                if (loadedTabs.has('categories')) return;
                group = 'categories';
            }

            setIsLoadingTab(true);
            try {
                // First: Check Local Storage for Draft/Failed items
                const draftStr = localStorage.getItem(getDraftKey(request.id));
                let localDraft: any = null;
                if (draftStr) {
                    try { localDraft = JSON.parse(draftStr); } catch (e) { }
                }

                // If we haven't loaded from server for this group yet, do it now
                await fetchRequestTabContent(request.id, group);

                if (isMounted.current) {
                    // --- SMART MERGE LOGIC START ---
                    // We need to merge server data (which was just set to state by fetchRequestTabContent implicitly via context update -> useEffect sync)
                    // But wait, the context update is async. We should probably rely on the 'request' prop update in the other useEffect.

                    // However, to ensure immediate availability if we have local data:
                    if (localDraft) {
                        // We set local data first if available to show "unsaved" work immediately
                        // The server sync effect below will handle the merging properly
                        if (group === 'general' && !loadedTabs.has('general')) {
                            setGeneralNotes(prev => {
                                // Prioritize local items that are 'saving' or 'error'
                                const localItems = localDraft.generalNotes || [];
                                const unsaved = localItems.filter((n: Note) => n.status === 'saving' || n.status === 'error');
                                // Merge logic handled in the main sync useEffect
                                return localItems.length > 0 ? localItems : prev;
                            });
                        }
                        // Similar logic could be applied for categories, but the main sync effect is safer
                    }

                    setLoadedTabs(prev => {
                        const newSet = new Set(prev);
                        if (group === 'gallery') {
                            newSet.add('general');
                            newSet.add('categories');
                        } else if (group) {
                            newSet.add(group);
                        }
                        return newSet;
                    });
                    setIsInitialDataLoaded(true);
                }
            } catch (error) {
                console.error("Failed to load tab content:", error);

                // Fallback to local draft if server fails
                const draftStr = localStorage.getItem(getDraftKey(request.id));
                if (draftStr && isMounted.current) {
                    try {
                        const draft = JSON.parse(draftStr);
                        if (draft.generalNotes) setGeneralNotes(draft.generalNotes);
                        if (draft.categoryNotes) setCategoryNotes(draft.categoryNotes);
                        if (draft.structuredFindings) setStructuredFindings(draft.structuredFindings);

                        addNotification({
                            title: 'تنبيه الاتصال',
                            message: 'فشل الاتصال بالسحابة. يتم عرض نسخة المسودة المحفوظة محلياً.',
                            type: 'info'
                        });
                        setIsInitialDataLoaded(true); // Treat as loaded so user can edit
                    } catch (e) {
                        console.error("Failed to parse draft:", e);
                    }
                } else {
                    addNotification({ title: 'خطأ', message: 'فشل تحميل البيانات. الرجاء التحقق من الاتصال.', type: 'error' });
                }
            } finally {
                if (isMounted.current) setIsLoadingTab(false);
            }
        };

        loadContent();
    }, [activeTab, request, loadedTabs, fetchRequestTabContent, addNotification, getDraftKey]);


    const latestRequestRef = useRef(request);
    useEffect(() => { latestRequestRef.current = request; }, [request]);

    const performSave = useCallback(async (isFinalSave = false, finalStatus?: RequestStatus, overrides?: { activityLog?: ActivityLog[], structuredFindings?: StructuredFinding[] }) => {
        const currentRequest = latestRequestRef.current;
        if (!currentRequest) return;
        if (isLocked && !finalStatus) return;

        // Update interaction timestamp to prevent immediate sync from overwriting local state
        lastInteractionRef.current = Date.now();

        // Failsafe: Don't save if we haven't successfully loaded the initial state
        if (!isInitialDataLoaded) {
            console.warn("Save aborted: Initial cloud data not loaded yet.");
            return;
        }

        const { generalNotes: localGeneralNotes, categoryNotes: localCategoryNotes, voiceMemos: localVoiceMemos } = inspectionDataRef.current;
        // Use overridden findings if provided (crucial for deletion), otherwise use current Ref
        const localFindings = overrides?.structuredFindings ?? inspectionDataRef.current.structuredFindings;

        const finalActivityLog = overrides?.activityLog ?? inspectionDataRef.current.activityLog;

        const clean = (items: (Note | StructuredFinding | VoiceMemo | ActivityLog)[]) => items.map(({ status, localFile, localBlob, isTranscribing, isEditingTranscription, ...item }: any) => item);
        const cleanCategoryNotes = (notesMap: Record<string, Note[]>) => {
            const newMap: Record<string, Note[]> = {};
            for (const key in notesMap) { newMap[key] = clean(notesMap[key]) as Note[]; }
            return newMap;
        };
        const cleanVoiceMemos = (memosMap: Record<string, VoiceMemo[]>) => {
            const newMap: Record<string, VoiceMemo[]> = {};
            for (const key in memosMap) { newMap[key] = clean(memosMap[key]) as VoiceMemo[]; }
            return newMap;
        }

        // Handle Image Uploads for items that have localFile (e.g. after a failed attempt)
        const uploadedGeneralNotes = [...localGeneralNotes];
        for (let i = 0; i < uploadedGeneralNotes.length; i++) {
            const note = uploadedGeneralNotes[i];
            if ((note.status === 'saving' || note.status === 'error') && note.localFile) {
                try {
                    const url = await uploadImage(note.localFile, 'note_images');
                    uploadedGeneralNotes[i] = { ...note, image: url, localFile: undefined };
                } catch (e) {
                    console.error("Retry upload failed for general note:", note.id, e);
                    // Keep status as saving/error so retry logic picks it up again? 
                    // Actually if upload fails, we should throw to trigger error state in UI
                    throw e;
                }
            }
        }

        const uploadedCategoryNotes = { ...localCategoryNotes };
        for (const catId in uploadedCategoryNotes) {
            uploadedCategoryNotes[catId] = [...(uploadedCategoryNotes[catId] || [])];
            for (let i = 0; i < uploadedCategoryNotes[catId].length; i++) {
                const note = uploadedCategoryNotes[catId][i];
                if ((note.status === 'saving' || note.status === 'error') && note.localFile) {
                    try {
                        const url = await uploadImage(note.localFile, 'note_images');
                        uploadedCategoryNotes[catId][i] = { ...note, image: url, localFile: undefined };
                    } catch (e) {
                        console.error("Retry upload failed for category note:", note.id, e);
                        throw e;
                    }
                }
            }
        }

        // ... Similar logic for voice memos ...

        const updates: Partial<InspectionRequest> & { id: string } = {
            id: currentRequest.id,
            updated_at: new Date().toISOString()
        };

        if (finalStatus) updates.status = finalStatus;
        
        // Merge Activity Log
        // Identify logs that are in local state but not in server state (New Logs)
        const serverActivityLog = currentRequest.activity_log || [];
        const localActivityLog = finalActivityLog || [];
        
        // Find logs created locally that aren't on server yet
        // We assume logs have unique IDs.
        const newLogs = localActivityLog.filter(localLog => !serverActivityLog.some(serverLog => serverLog.id === localLog.id));
        
        // Combine: New Logs + Server Logs. 
        // Note: Activity Log is usually sorted desc by date.
        // If we just prepend new logs to server logs, it should be correct for most cases.
        if (newLogs.length > 0) {
             updates.activity_log = [...newLogs, ...serverActivityLog];
        } else if (overrides?.activityLog) {
             // If we have an override (e.g. from deletion), use it, but be careful not to lose server logs?
             // Deletion usually passes the *full* new log list.
             // If deletion happened, we removed an item.
             // If we use the merge logic above, the deleted item (which is in serverActivityLog) will reappear!
             
             // If 'overrides' is present, it means an explicit action (like delete) happened.
             // In that case, we might want to trust the override, BUT we still need to respect *other* users' additions.
             
             // This is tricky. 'handleRemoveGeneralNote' calls updateRequest directly, so it doesn't use performSave.
             // So 'overrides' here is likely only used if we call performSave manually?
             // 'performSave' is called with overrides in 'handleSave' (manual save button)? No.
             
             // Let's assume for standard 'debouncedSave', overrides is undefined.
             updates.activity_log = [...newLogs, ...serverActivityLog];
        } else {
             // No local changes to log, but we might want to ensure we don't send stale log if we are just saving notes.
             // Actually, if we don't send activity_log in updates, it won't be changed.
             // But if we *do* send it, it overwrites.
             
             // If there are no new logs, do we need to send activity_log?
             // Only if we want to update it.
             // If we don't include it in 'updates', Supabase won't change it.
             // That's the safest bet!
             
             // But wait, 'finalActivityLog' is derived from 'inspectionDataRef.current.activityLog'.
             // If we added a log 5 seconds ago, it's in 'inspectionDataRef'.
             // Is it in 'serverActivityLog'? Maybe not yet if sync blocked.
             // So 'newLogs' logic handles it.
             
             // If newLogs is empty, we don't need to send activity_log.
             // UNLESS we deleted something? But deletions are handled separately.
        }

        // --- SMART MERGE: Server State + Local Unsaved Changes ---
        // This prevents overwriting changes from other users (Realtime) with stale local state.

        if (loadedTabs.has('general')) {
            const serverGeneralNotes = currentRequest.general_notes || [];
            const localUnsavedGeneral = uploadedGeneralNotes.filter(n => n.status === 'saving' || n.status === 'error');
            
            // Start with server notes
            const mergedGeneral = [...serverGeneralNotes];
            
            // Append local unsaved notes (avoid duplicates if they somehow exist)
            localUnsavedGeneral.forEach(n => {
                const index = mergedGeneral.findIndex(sn => sn.id === n.id);
                if (index >= 0) {
                    mergedGeneral[index] = n; // Update existing (if we are editing it)
                } else {
                    mergedGeneral.push(n); // Add new
                }
            });
            
            updates.general_notes = clean(mergedGeneral) as Note[];
        }

        if (loadedTabs.has('categories')) {
            // Merge Category Notes
            const serverCategoryNotes = currentRequest.category_notes || {};
            const mergedCategoryNotes: Record<string, Note[]> = { ...serverCategoryNotes };
            
            for (const catId in uploadedCategoryNotes) {
                const serverNotes = mergedCategoryNotes[catId] || [];
                const localUnsaved = uploadedCategoryNotes[catId].filter(n => n.status === 'saving' || n.status === 'error');
                
                const mergedList = [...serverNotes];
                localUnsaved.forEach(n => {
                     const index = mergedList.findIndex(sn => sn.id === n.id);
                     if (index >= 0) mergedList[index] = n;
                     else mergedList.push(n);
                });
                
                mergedCategoryNotes[catId] = mergedList;
            }
            updates.category_notes = cleanCategoryNotes(mergedCategoryNotes);

            // Merge Findings
            const serverFindings = currentRequest.structured_findings || [];
            const localUnsavedFindings = localFindings.filter(f => f.status === 'saving' || f.status === 'error');
            
            const mergedFindingsMap = new Map();
            serverFindings.forEach(f => mergedFindingsMap.set(f.findingId, f));
            localUnsavedFindings.forEach(f => mergedFindingsMap.set(f.findingId, f)); // Local overrides server for same finding ID
            
            updates.structured_findings = clean(Array.from(mergedFindingsMap.values())) as StructuredFinding[];
            
            // Merge Voice Memos (Simplified - assuming append only for now)
            updates.voice_memos = cleanVoiceMemos(localVoiceMemos); 
        }

        const payloadSize = estimateObjectSize(updates);
        trackDataTransfer(payloadSize);

        try {
            await updateRequest(updates);

            const updateItemsAfterSave = <T extends { status?: 'saving' | 'saved' | 'error' }>(prevItems: T[], currentUploaded: T[], idKey: keyof T = 'id' as keyof T): T[] => {
                return prevItems.map(item => {
                    // Mark as saved if it was saving/error AND exists in the uploaded payload
                    // @ts-ignore
                    if (item.status === 'saving' || item.status === 'error') {
                        // @ts-ignore
                        const uploaded = currentUploaded.find(u => u[idKey] === item[idKey]);
                        return { ...item, ...(uploaded || {}), status: 'saved' } as T;
                    }
                    return item;
                });
            };

            if (isMounted.current) {
                if (loadedTabs.has('general')) {
                    setGeneralNotes(prev => updateItemsAfterSave(prev, uploadedGeneralNotes));
                }
                if (loadedTabs.has('categories')) {
                    setStructuredFindings(prev => updateItemsAfterSave(prev, localFindings, 'findingId' as keyof StructuredFinding));
                    setCategoryNotes(prev => {
                        const newMap = { ...prev };
                        for (const key in newMap) {
                            newMap[key] = updateItemsAfterSave(newMap[key], uploadedCategoryNotes[key] || []);
                        }
                        return newMap;
                    });
                    // Voice memos update ...
                }

                setHasUnsavedChanges(false);
                // We DON'T clear the draft entirely, but we could update it to reflect 'saved' status
                // Or just rely on the useEffect that syncs state to local storage.
            }

        } catch (error) {
            console.error("Failed to auto-save request:", error);
            if (isMounted.current) {
                // Mark items as 'error' so user sees retry button
                const updateStatusToError = <T extends { status?: 'saving' | 'saved' | 'error' }>(items: T[]): T[] => items.map(item => item.status === 'saving' ? { ...item, status: 'error' } : item);

                setGeneralNotes(prev => updateStatusToError(prev));
                setStructuredFindings(prev => updateStatusToError(prev));
                setCategoryNotes(prev => { const newMap = { ...prev }; for (const key in newMap) { newMap[key] = updateStatusToError(newMap[key]); } return newMap; });
                // Voice memos...
            }
            throw error;
        }
    }, [updateRequest, trackDataTransfer, loadedTabs, setHasUnsavedChanges, isLocked, getDraftKey, uploadImage]);

    const debouncedSave = useCallback(() => {
        if (isLocked) return;
        setHasUnsavedChanges(true);
        lastInteractionRef.current = Date.now();
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = window.setTimeout(() => { if (isMounted.current) performSave(); }, 1500);
    }, [performSave, setHasUnsavedChanges, isLocked]);

    const addActivityLogEntry = useCallback((action: string, details: string, imageUrl?: string, linkId?: string, linkPage?: Page) => {
        if (isLocked) return;
        const newLog = createActivityLog(action, details, imageUrl, linkId, linkPage);
        if (newLog) {
            setActivityLog(prev => [newLog, ...prev]);
            debouncedSave();
        }
    }, [createActivityLog, debouncedSave, isLocked]);


    useEffect(() => {
        if (request && request.status === RequestStatus.NEW && can('fill_requests')) {
            const newLog = createActivityLog('تغيير حالة الطلب', 'تم تغيير الحالة من "جديد" إلى "قيد التنفيذ"');
            if (newLog) {
                const updates = {
                    id: request.id,
                    status: RequestStatus.IN_PROGRESS,
                    activity_log: [newLog, ...(request.activity_log || [])]
                };
                updateRequest(updates).catch(err => {
                    console.error("Failed to update status to In Progress:", err);
                    addNotification({ title: 'خطأ', message: 'فشل تحديث حالة الطلب تلقائياً.', type: 'error' });
                });
            }
        }
    }, [request, can, updateRequest, createActivityLog, addNotification]);

    useEffect(() => {
        inspectionDataRef.current = { generalNotes, categoryNotes, structuredFindings, voiceMemos, activityLog };
    }, [generalNotes, categoryNotes, structuredFindings, voiceMemos, activityLog]);

    const handleServerUpdate = useCallback((serverRequest: InspectionRequest) => {
        // --- PREVENT SYNC WARS: Skip sync if user just interacted ---
        if (Date.now() - lastInteractionRef.current < 2000) {
            return;
        }

        const cleanDataForComparison = (data: any) => JSON.stringify(data, (key, value) =>
            ['status', 'localFile', 'localBlob', 'isTranscribing', 'isEditingTranscription', 'originalText', 'translations', 'displayTranslation'].includes(key) ? undefined : value
        );

        // 1. General Notes
        const serverGeneralNotes = serverRequest.general_notes || [];
        setGeneralNotes(prev => {
            const unsaved = prev.filter(n => n.status === 'error' || n.status === 'saving');
            const merged = [...serverGeneralNotes];
            unsaved.forEach(n => {
                if (!merged.find(sn => sn.id === n.id)) merged.push(n);
            });

            if (cleanDataForComparison(merged) !== cleanDataForComparison(prev)) return merged;
            return prev;
        });

        // 2. Category Notes
        const serverCategoryNotes = serverRequest.category_notes || {};
        setCategoryNotes(prev => {
            const newMap = { ...serverCategoryNotes };
            let changed = false;

            // Check for unsaved local notes in each category
            Object.keys(prev).forEach(catId => {
                const unsaved = prev[catId].filter(n => n.status === 'error' || n.status === 'saving');
                if (unsaved.length > 0) {
                    if (!newMap[catId]) newMap[catId] = [];
                    newMap[catId] = [...newMap[catId]]; // Clone to avoid mutation
                    const currentServerList = newMap[catId];
                    unsaved.forEach(n => {
                        if (!currentServerList.find((sn: Note) => sn.id === n.id)) {
                            currentServerList.push(n);
                            changed = true;
                        }
                    });
                }
            });

            if (!changed && cleanDataForComparison(newMap) === cleanDataForComparison(prev)) return prev;
            return newMap;
        });

        // 3. Findings
        const serverFindings = serverRequest.structured_findings || [];
        setStructuredFindings(prev => {
            const unsaved = prev.filter(f => f.status === 'error' || f.status === 'saving');
            const mergedMap = new Map();
            serverFindings.forEach(f => mergedMap.set(f.findingId, { ...f, status: 'saved' }));
            unsaved.forEach(f => mergedMap.set(f.findingId, f));

            const newArr = Array.from(mergedMap.values());
            // @ts-ignore
            if (cleanDataForComparison(newArr) !== cleanDataForComparison(prev)) return newArr;
            return prev;
        });

        // 4. Activity Log
        const serverActivityLog = serverRequest.activity_log || [];
        setActivityLog(prev => {
            const combined = [...serverActivityLog];
            prev.forEach(l => {
                if (!combined.find(sl => sl.id === l.id)) combined.push(l);
            });
            combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            if (JSON.stringify(combined) !== JSON.stringify(prev)) return combined;
            return prev;
        });

    }, []);

    // --- REALTIME SUBSCRIPTION ---
    useEffect(() => {
        if (!request?.id) return;

        const channel = supabase
            .channel(`request-${request.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'inspection_requests',
                    filter: `id=eq.${request.id}`
                },
                (payload) => {
                    const newRequest = payload.new as InspectionRequest;
                    handleServerUpdate(newRequest);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [request?.id, handleServerUpdate]);

    // --- MAIN SYNC LOGIC ---
    useEffect(() => {
        if (!request) return;

        // 1. Initial Load (or Request Change)
        if (request.id !== prevRequestRef.current?.id) {
            setActivityLog(request.activity_log || []);

            // Try to load from Local Storage first (Persistence)
            const draftStr = localStorage.getItem(getDraftKey(request.id));
            if (draftStr) {
                try {
                    const draft = JSON.parse(draftStr);
                    // Base: Server Data
                    const combinedGeneral = [...(request.general_notes || [])];
                    const combinedCategories = { ...(request.category_notes || {}) };
                    const combinedFindings = [...(request.structured_findings || [])];

                    // Overlay: Local Unsaved Items
                    if (draft.generalNotes) {
                        const unsavedGeneral = (draft.generalNotes as Note[]).filter(n => n.status === 'error' || n.status === 'saving');
                        unsavedGeneral.forEach(n => {
                            if (!combinedGeneral.find(sn => sn.id === n.id)) combinedGeneral.push(n);
                        });
                    }
                    if (draft.categoryNotes) {
                        for (const catId in draft.categoryNotes) {
                            const unsavedCatNotes = (draft.categoryNotes[catId] as Note[]).filter(n => n.status === 'error' || n.status === 'saving');
                            if (!combinedCategories[catId]) combinedCategories[catId] = [];
                            unsavedCatNotes.forEach(n => {
                                if (!combinedCategories[catId].find((sn: Note) => sn.id === n.id)) combinedCategories[catId].push(n);
                            });
                        }
                    }
                    if (draft.structuredFindings) {
                        const unsavedFindings = (draft.structuredFindings as StructuredFinding[]).filter(f => f.status === 'error' || f.status === 'saving');
                        const findingsMap = new Map();
                        combinedFindings.forEach(f => findingsMap.set(f.findingId, f));
                        unsavedFindings.forEach(f => findingsMap.set(f.findingId, f)); // Overwrite server with local unsaved
                        // @ts-ignore
                        setStructuredFindings(Array.from(findingsMap.values()));
                    } else {
                        setStructuredFindings(combinedFindings);
                    }

                    setGeneralNotes(combinedGeneral);
                    setCategoryNotes(combinedCategories);

                } catch (e) {
                    // Fallback to server only
                    setGeneralNotes(request.general_notes || []);
                    setCategoryNotes(request.category_notes || {});
                    setStructuredFindings(request.structured_findings || []);
                }
            } else {
                setGeneralNotes(request.general_notes || []);
                setCategoryNotes(request.category_notes || {});
                setStructuredFindings(request.structured_findings || []);
            }

            setVoiceMemos(request.voice_memos || {});

            const defTab = getDefaultTab();
            setActiveTab(defTab);
            setActiveFindingGroup(null);
            setLoadedTabs(new Set());
            setCategorySubTab('main');
            setHasUnsavedChanges(false);
            setIsFindingsSectionOpen(true);
            setIsInitialDataLoaded(true);

            prevRequestRef.current = request;
            return;
        }

        handleServerUpdate(request);

    }, [request, getDraftKey, getDefaultTab, setHasUnsavedChanges, handleServerUpdate]);

    const client = clients.find(c => c.id === request?.client_id);
    const car = cars.find(c => c.id === request?.car_id);
    const carModel = car ? carModels.find(m => m.id === car?.model_id) : undefined;
    const carMake = car ? carMakes.find(m => m.id === car?.make_id) : undefined;

    const carDetails = useMemo(() => {
        if (request?.car_snapshot) {
            return {
                makeNameEn: request.car_snapshot.make_en,
                modelNameEn: request.car_snapshot.model_en,
                makeNameAr: request.car_snapshot.make_ar,
                modelNameAr: request.car_snapshot.model_ar,
                year: request.car_snapshot.year,
            };
        }
        return {
            makeNameEn: carMake?.name_en || 'غير معروف',
            modelNameEn: carModel?.name_en || 'غير معروف',
            makeNameAr: carMake?.name_ar || 'غير معروف',
            modelNameAr: carModel?.name_ar || 'غير معروف',
            year: car?.year,
        };
    }, [request?.car_snapshot, car, carMake, carModel]);

    const handleAddNote = useCallback(async (noteData: { text: string; file: File | null; color: HighlightColor | null }) => {
        if (isLocked || !authUser) return;

        // Mark interaction to pause sync
        lastInteractionRef.current = Date.now();

        const isGeneral = activeTab === 'general-notes'; // Fixed: activeTab
        const categoryId = isGeneral ? 'general' : activeTab; // Fixed: activeTab

        const noteId = uuidv4();
        const { text, file, color } = noteData;

        // Optimistic UI update
        const previewUrl = file ? URL.createObjectURL(file) : undefined;
        const placeholderNote: Note = {
            id: noteId,
            text,
            originalText: text, // Store original text for formalization
            image: previewUrl,
            status: 'saving',
            authorId: authUser.id,
            authorName: authUser.name,
            highlightColor: color || undefined,
            displayTranslation: { lang: 'ar', isActive: false }, // Default to Arabic, inactive
            categoryId: categoryId,
            localFile: file || undefined // Store file locally for retry
        };

        if (isGeneral) {
            setGeneralNotes(prev => [...prev, placeholderNote]);
        } else {
            setCategoryNotes(prev => ({ ...prev, [categoryId]: [...(prev[categoryId] || []), placeholderNote] }));
        }

        scrollToBottom();

        if (file) {
            trackDataTransfer(file.size);
        }

        try {
            let imageUrl: string | undefined = undefined;
            if (file) {
                imageUrl = await uploadImage(file, 'note_images');
            }

            if (previewUrl && imageUrl !== previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }

            const categoryName = isGeneral ? 'عامة' : customFindingCategories.find(c => c.id === categoryId)?.name || 'غير معروف';
            addActivityLogEntry(isGeneral ? 'إضافة ملاحظة عامة' : 'إضافة ملاحظة', `"${text}"${isGeneral ? '' : ` في قسم "${categoryName}"`}`, imageUrl, noteId);

            // Update to saved state with real image URL
            const finalNote: Note = { ...placeholderNote, image: imageUrl, status: 'saving', localFile: undefined }; // keep 'saving' until performSave confirms

            if (isMounted.current) {
                if (isGeneral) {
                    setGeneralNotes(prev => prev.map(n => n.id === noteId ? finalNote : n));
                } else {
                    setCategoryNotes(prev => ({ ...prev, [categoryId]: prev[categoryId].map(n => n.id === noteId ? finalNote : n) }));
                }
                scrollToBottom();
            }

            debouncedSave();

        } catch (error) {
            console.error("Failed to add note:", error);
            addNotification({ title: 'خطأ في الشبكة', message: 'فشل حفظ الملاحظة. تم حفظها محلياً، يمكنك إعادة المحاولة عند توفر النت.', type: 'error' });

            const errorNote: Note = { ...placeholderNote, status: 'error', localFile: file || undefined };

            if (isMounted.current) {
                if (isGeneral) {
                    setGeneralNotes(prev => prev.map(n => n.id === noteId ? errorNote : n));
                } else {
                    setCategoryNotes(prev => ({ ...prev, [categoryId]: (prev[categoryId] || []).map(n => n.id === noteId ? errorNote : n) }));
                }
            }
        }
    }, [isLocked, authUser, activeTab, customFindingCategories, addActivityLogEntry, debouncedSave, trackDataTransfer, uploadImage, addNotification, scrollToBottom]); // Fixed: activeTab

    const handleRemoveGeneralNote = async (idToRemove: string) => {
        if (isLocked) return;
        if (deletingNoteIds.has(idToRemove) || !request) return;

        // Mark interaction
        lastInteractionRef.current = Date.now();

        const noteToDelete = generalNotes.find(note => note.id === idToRemove);
        if (!noteToDelete) return;

        setDeletingNoteIds(prev => new Set(prev).add(idToRemove));

        try {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

            if (noteToDelete.image) {
                trackDataTransfer(200);
                deleteImage(noteToDelete.image).catch(err => {
                    console.error("Failed to delete image from storage", err);
                    // Don't block UI on image delete fail
                });
            }

            const newGeneralNotes = generalNotes.filter(note => note.id !== idToRemove);
            const newLog = createActivityLog('حذف ملاحظة عامة', `"${noteToDelete.text}"`, noteToDelete.image);
            const newActivityLog = newLog ? [newLog, ...activityLog] : activityLog;

            const updatedRequest: Partial<InspectionRequest> & { id: string } = {
                id: request.id,
                general_notes: newGeneralNotes.map(({ status, ...rest }) => rest as Note),
                activity_log: newActivityLog,
                updated_at: new Date().toISOString()
            };

            trackDataTransfer(estimateObjectSize(updatedRequest));
            await updateRequest(updatedRequest);

            if (isMounted.current) {
                setGeneralNotes(newGeneralNotes);
                setActivityLog(newActivityLog);
            }

        } catch (error) {
            console.error("Deletion failed:", error);
            addNotification({ title: 'خطأ', message: 'فشل حذف الملاحظة.', type: 'error' });
        } finally {
            if (isMounted.current) {
                setDeletingNoteIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(idToRemove);
                    return newSet;
                });
            }
        }
    };

    const handleDeleteAllGeneralNotes = () => {
        if (isLocked) return;
        if (generalNotes.length === 0) return;
        showConfirmModal({
            title: 'حذف جميع الملاحظات العامة',
            message: 'هل أنت متأكد من حذف جميع الملاحظات العامة؟ لا يمكن التراجع عن هذا الإجراء.',
            onConfirm: async () => {
                if (!request) return;

                lastInteractionRef.current = Date.now(); // Mark interaction

                const newLog = createActivityLog('حذف جماعي', 'تم حذف جميع الملاحظات العامة');
                const newActivityLog = newLog ? [newLog, ...activityLog] : activityLog;

                const updatedRequest: Partial<InspectionRequest> & { id: string } = {
                    id: request.id,
                    general_notes: [],
                    activity_log: newActivityLog,
                    updated_at: new Date().toISOString()
                };

                try {
                    trackDataTransfer(estimateObjectSize(updatedRequest));
                    await updateRequest(updatedRequest);
                    if (isMounted.current) {
                        setGeneralNotes([]);
                        setActivityLog(newActivityLog);
                    }
                    addNotification({ title: 'نجاح', message: 'تم حذف جميع الملاحظات العامة.', type: 'success' });
                } catch (e) {
                    addNotification({ title: 'خطأ', message: 'فشل الحذف الجماعي.', type: 'error' });
                }
            }
        });
    };

    const handleRemoveCategoryNote = async (categoryId: string, idToRemove: string) => {
        if (isLocked) return;
        if (deletingNoteIds.has(idToRemove) || !request) return;

        // Mark interaction
        lastInteractionRef.current = Date.now();

        const notesForCategory = categoryNotes[categoryId] || [];
        const noteToDelete = notesForCategory.find(note => note.id === idToRemove);
        if (!noteToDelete) return;

        setDeletingNoteIds(prev => new Set(prev).add(idToRemove));

        try {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

            if (noteToDelete.image) {
                trackDataTransfer(200);
                deleteImage(noteToDelete.image).catch(err => {
                    console.error("Failed to delete image from storage", err);
                });
            }

            const newNotesForCategory = notesForCategory.filter(note => note.id !== idToRemove);
            const newCategoryNotes = { ...categoryNotes, [categoryId]: newNotesForCategory };

            const categoryName = customFindingCategories.find(c => c.id === categoryId)?.name || 'غير معروف';
            const newLog = createActivityLog('حذف ملاحظة', `"${noteToDelete.text}" من قسم "${categoryName}"`, noteToDelete.image);
            const newActivityLog = newLog ? [newLog, ...activityLog] : activityLog;

            const cleanCategoryNotes = (notesMap: Record<string, Note[]>) => {
                const newMap: Record<string, Note[]> = {};
                for (const key in notesMap) { newMap[key] = (notesMap[key] || []).map(({ status, ...rest }) => rest) as Note[]; }
                return newMap;
            };

            const updatedRequest: Partial<InspectionRequest> & { id: string } = {
                id: request.id,
                category_notes: cleanCategoryNotes(newCategoryNotes),
                activity_log: newActivityLog,
                updated_at: new Date().toISOString()
            };

            trackDataTransfer(estimateObjectSize(updatedRequest));
            await updateRequest(updatedRequest);

            if (isMounted.current) {
                setCategoryNotes(newCategoryNotes);
                setActivityLog(newActivityLog);
            }

        } catch (error) {
            console.error("Deletion failed:", error);
            addNotification({ title: 'خطأ', message: 'فشل حذف الملاحظة.', type: 'error' });
        } finally {
            if (isMounted.current) {
                setDeletingNoteIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(idToRemove);
                    return newSet;
                });
            }
        }
    };

    const handleDeleteAllCategoryNotes = (categoryId: string) => {
        if (isLocked) return;
        if (!categoryNotes[categoryId] || categoryNotes[categoryId].length === 0) return;
        showConfirmModal({
            title: 'حذف جميع الملاحظات في هذا القسم',
            message: 'هل أنت متأكد من حذف جميع الملاحظات في هذا القسم؟',
            onConfirm: async () => {
                if (!request) return;

                lastInteractionRef.current = Date.now(); // Mark interaction

                const categoryName = customFindingCategories.find(c => c.id === categoryId)?.name || 'غير معروف';
                const newLog = createActivityLog('حذف جماعي', `تم حذف جميع الملاحظات من قسم "${categoryName}"`);
                const newActivityLog = newLog ? [newLog, ...activityLog] : activityLog;

                const newCategoryNotes = { ...categoryNotes };
                delete newCategoryNotes[categoryId];

                const cleanCategoryNotes = (notesMap: Record<string, Note[]>) => {
                    const newMap: Record<string, Note[]> = {};
                    for (const key in notesMap) { newMap[key] = (notesMap[key] || []).map(({ status, ...rest }) => rest) as Note[]; }
                    return newMap;
                };

                const updatedRequest: Partial<InspectionRequest> & { id: string } = {
                    id: request.id,
                    category_notes: cleanCategoryNotes(newCategoryNotes),
                    activity_log: newActivityLog,
                    updated_at: new Date().toISOString()
                };

                try {
                    trackDataTransfer(estimateObjectSize(updatedRequest));
                    await updateRequest(updatedRequest);
                    if (isMounted.current) {
                        setCategoryNotes(newCategoryNotes);
                        setActivityLog(newActivityLog);
                    }
                    addNotification({ title: 'نجاح', message: 'تم حذف جميع ملاحظات القسم.', type: 'success' });
                } catch (e) {
                    addNotification({ title: 'خطأ', message: 'فشل الحذف الجماعي.', type: 'error' });
                }
            }
        });
    }

    const openEditNoteModal = (note: Note, categoryId: string | 'general') => {
        if (isLocked) return;
        setEditingNote({ note, categoryId });
        setModalNoteData({ text: note.text, image: note.image || null, highlightColor: note.highlightColor || null });
        setModalNoteFile(null);
        setIsEditNoteModalOpen(true);
    };

    const handleHighlightColorChange = (noteId: string, categoryId: string | 'general', color: HighlightColor | null) => {
        if (isLocked) return;

        const notesList = categoryId === 'general' ? generalNotes : categoryNotes[categoryId] || [];
        const originalNote = notesList.find(n => n.id === noteId);

        const updateLogic = (prevNotes: Note[]) => prevNotes.map(n =>
            n.id === noteId
                ? { ...n, highlightColor: color === null ? undefined : color, status: 'saving' as const }
                : n
        );

        if (categoryId === 'general') {
            setGeneralNotes(updateLogic);
        } else {
            setCategoryNotes(prev => ({
                ...prev,
                [categoryId]: updateLogic(prev[categoryId] || [])
            }));
        }

        if (originalNote) {
            const oldColorName = originalNote.highlightColor ? highlightColors[originalNote.highlightColor].name : 'أبيض';
            const newColorName = color ? highlightColors[color].name : 'أبيض';
            const categoryName = categoryId === 'general' ? 'ملاحظات عامة' : customFindingCategories.find(c => c.id === categoryId)?.name || 'غير معروف';
            const details = `قام ${authUser.name} بتغيير لون الملاحظة "${originalNote.text.substring(0, 30)}..." من (${oldColorName}) إلى (${newColorName}) في قسم "${categoryName}"`;
            addActivityLogEntry('تلوين ملاحظة', details, undefined, noteId);
        }

        debouncedSave();
        setColorPickerOpenFor(null);
    };

    const handleSaveEditedNote = async () => {
        if (isLocked) return;
        if (!editingNote) return;

        setIsUploading(true);

        const originalNote = editingNote.note;
        const { categoryId } = editingNote;

        if (modalNoteFile) trackDataTransfer(modalNoteFile.size);

        try {
            let finalImageUrl = modalNoteData.image || undefined;
            if (modalNoteFile) {
                finalImageUrl = await uploadImage(modalNoteFile, 'note_images');
                if (originalNote.image && originalNote.image !== finalImageUrl) {
                    trackDataTransfer(200);
                    deleteImage(originalNote.image).catch(err => {
                        console.error("Failed to delete old image.", err);
                    });
                }
            } else if (originalNote.image && !modalNoteData.image) {
                trackDataTransfer(200);
                deleteImage(originalNote.image).catch(err => {
                    console.error("Failed to delete old image.", err);
                });
            }

            const updatedNote: Note = {
                ...originalNote,
                text: modalNoteData.text,
                originalText: originalNote.originalText || originalNote.text, // Ensure originalText is preserved before modification
                image: finalImageUrl,
                highlightColor: modalNoteData.highlightColor || undefined,
                status: 'saving'
            };

            const textChanged = originalNote.text !== modalNoteData.text;
            const imageChanged = originalNote.image !== finalImageUrl;
            const colorChanged = originalNote.highlightColor !== modalNoteData.highlightColor;

            if (!textChanged && !imageChanged && !colorChanged) {
                setIsEditNoteModalOpen(false);
                setEditingNote(null);
                setIsUploading(false);
                return;
            }

            let logDetails = `تم تغيير النص القديم "${originalNote.text}" إلى النص الجديد "${modalNoteData.text}".`;
            if (imageChanged) {
                logDetails = `تم تغيير النص من "${originalNote.text}" إلى "${modalNoteData.text}" وتحديث الصورة.`;
            } else if (textChanged) {
                logDetails = `تم تغيير النص من "${originalNote.text}" إلى "${modalNoteData.text}" .`;
            } else {
                logDetails = `تم تحديث صورة الملاحظة "${modalNoteData.text}".`;
            }

            if (isMounted.current) {
                if (categoryId === 'general') {
                    setGeneralNotes(prev => prev.map(n => n.id === originalNote.id ? updatedNote : n));
                    addActivityLogEntry('تعديل ملاحظة عامة', logDetails, finalImageUrl, originalNote.id);
                } else {
                    setCategoryNotes(prev => ({ ...prev, [categoryId]: prev[categoryId].map(n => n.id === originalNote.id ? updatedNote : n) }));
                    const categoryName = customFindingCategories.find(c => c.id === categoryId)?.name || 'غير معروف';
                    addActivityLogEntry('تعديل ملاحظة', `${logDetails} في قسم "${categoryName}"`, finalImageUrl, originalNote.id);
                }

                setIsEditNoteModalOpen(false);
                setEditingNote(null);
            }

            debouncedSave();

        } catch (error) {
            console.error("Edit failed:", error);
            addNotification({ title: 'خطأ في الشبكة', message: 'فشل حفظ التعديلات. تم الاحتفاظ بها محلياً للمحاولة لاحقاً.', type: 'error' });

            const errorNote: Note = {
                ...originalNote,
                text: modalNoteData.text,
                originalText: originalNote.originalText || originalNote.text,
                highlightColor: modalNoteData.highlightColor || undefined,
                status: 'error',
                localFile: modalNoteFile || undefined
            };

            if (isMounted.current) {
                if (categoryId === 'general') {
                    setGeneralNotes(prev => prev.map(n => n.id === originalNote.id ? errorNote : n));
                } else {
                    setCategoryNotes(prev => ({
                        ...prev, [categoryId]: (prev[categoryId] || []).map(n => n.id === originalNote.id ? errorNote : n)
                    }));
                }
                setIsEditNoteModalOpen(false);
                setEditingNote(null);
            }
        } finally {
            if (isMounted.current) setIsUploading(false);
        }
    };

    // --- Update Callbacks for Review Mode ---
    const handleUpdateNoteFromReview = useCallback((updatedNote: Note, categoryId: string | 'general') => {
        if (isLocked) return;
        const updateState = (note: Note) => {
            // Ensure originalText is set if not already, to properly track changes
            return { ...note, originalText: note.originalText || note.text, status: 'saving' as const };
        };

        if (categoryId === 'general') {
            setGeneralNotes(prev => prev.map(n => n.id === updatedNote.id ? updateState(updatedNote) : n));
            addActivityLogEntry('تعديل ملاحظة عامة (مراجعة)', `تم تعديل النص إلى "${updatedNote.text}"`, undefined, updatedNote.id);
        } else {
            setCategoryNotes(prev => ({
                ...prev,
                [categoryId]: (prev[categoryId] || []).map(n => n.id === updatedNote.id ? updateState(updatedNote) : n)
            }));
            const categoryName = customFindingCategories.find(c => c.id === categoryId)?.name || 'غير معروف';
            addActivityLogEntry('تعديل ملاحظة (مراجعة)', `في قسم "${categoryName}" تم تعديل النص إلى "${updatedNote.text}"`, undefined, updatedNote.id);
        }
        debouncedSave();
    }, [addActivityLogEntry, customFindingCategories, debouncedSave, isLocked]);

    const handleUpdateFindingFromReview = useCallback((findingId: string, newValue: string) => {
        if (isLocked) return;
        setStructuredFindings(prev => prev.map(sf => sf.findingId === findingId ? { ...sf, value: newValue, status: 'saving' } : sf));
        addActivityLogEntry('تعديل بند فحص (مراجعة)', `تم تعديل قيمة البند إلى "${newValue}"`, undefined, findingId);
        debouncedSave();
    }, [addActivityLogEntry, debouncedSave, isLocked]);

    const handleDeleteFromReview = useCallback((item: ReviewItem) => {
        if (isLocked) return;
        if (item.type === 'note') {
            if (item.categoryId === 'general') {
                handleRemoveGeneralNote(item.id);
            } else {
                handleRemoveCategoryNote(item.categoryId, item.id);
            }
        } else { // type === 'finding'
            if (deletingFindingIds.has(item.id) || !request) return;
            setDeletingFindingIds(prev => new Set(prev).add(item.id));

            try {
                if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
                const newStructuredFindings = structuredFindings.filter(sf => sf.findingId !== item.id);
                const categoryName = item.categoryName;
                const newLog = createActivityLog('حذف بند فحص (مراجعة)', `تم حذف بند "${item.title}" من قسم "${categoryName}"`);
                const newActivityLog = newLog ? [newLog, ...activityLog] : activityLog;

                const updatedRequest: Partial<InspectionRequest> & { id: string } = {
                    id: request.id,
                    structured_findings: newStructuredFindings.map(({ status, ...rest }) => rest as StructuredFinding),
                    activity_log: newActivityLog,
                    updated_at: new Date().toISOString()
                };

                trackDataTransfer(estimateObjectSize(updatedRequest));
                updateRequest(updatedRequest).then(() => {
                    if (isMounted.current) {
                        setStructuredFindings(newStructuredFindings);
                        setActivityLog(newActivityLog);
                    }
                });
            } catch (e) {
                console.error("Delete failed from review", e);
            } finally {
                if (isMounted.current) {
                    setDeletingNoteIds(prev => { const newSet = new Set(prev); newSet.delete(item.id); return newSet; });
                }
            }
        }
    }, [handleRemoveGeneralNote, handleRemoveCategoryNote, structuredFindings, request, deletingFindingIds, activityLog, createActivityLog, updateRequest, trackDataTransfer, isLocked]);


    const openImagePreview = useCallback((imageUrl: string) => { setPreviewImageUrl(imageUrl); setIsPreviewModalOpen(true); }, []);

    const handleSave = async () => {
        if (isLocked) return;
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        try {
            const newLog = createActivityLog('حفظ مؤقت', 'تم حفظ جميع التغييرات يدوياً.');
            const newLogArray = newLog ? [newLog, ...activityLog] : activityLog;
            setActivityLog(newLogArray);
            await performSave(false, undefined, { activityLog: newLogArray });
            addNotification({ title: 'نجاح', message: 'تم حفظ التغييرات بنجاح.', type: 'success' });
        } catch { }
    };

    const handleGoBack = async () => {
        if (hasUnsavedChanges) {
            showConfirmModal({
                title: 'تغييرات غير محفوظة',
                message: 'لديك تغييرات لم يتم حفظها. هل أنت متأكد من الخروج؟ ستفقد التعديلات الأخيرة.',
                onConfirm: () => {
                    setHasUnsavedChanges(false);
                    goBack();
                }
            });
        } else {
            goBack();
        }
    };

    const handlePreviewAndPrint = async () => {
        // Find if any category lacks technicians
        const categoriesWithNoTechs = visibleFindingCategories.filter(cat => {
            const assigned = request?.technician_assignments?.[cat.id] || [];
            return assigned.length === 0;
        });

        if (categoriesWithNoTechs.length > 0) {
            showConfirmModal({
                title: 'تحديد الفنيين مطلوب',
                message: `لم يتم تحديد فنيين للأقسام التالية: ${categoriesWithNoTechs.map(c => c.name).join('، ')}. هل تود المتابعة للطباعة بأي حال؟`,
                onConfirm: async () => {
                    if (!isLocked) await handleSave();
                    setPage('print-report');
                }
            });
            return;
        }

        if (!isLocked) {
            await handleSave();
        }
        setPage('print-report');
    };

    const handleComplete = async () => {
        if (isLocked) return;
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        const newLog = createActivityLog('تغيير حالة الطلب', 'تم تحديد الطلب كمكتمل');
        const newLogArray = newLog ? [newLog, ...activityLog] : activityLog;
        setActivityLog(newLogArray);
        try {
            await performSave(true, RequestStatus.COMPLETE, { activityLog: newLogArray });
            addNotification({ title: 'نجاح', message: 'تم تحديد الطلب كمكتمل.', type: 'success' });
            setPage('requests');
        } catch { }
    };

    const handleToggleStamp = async (stamp: ReportStamp) => {
        if (!request || isLocked) return;

        const currentStamps = request.report_stamps || [];
        const isAdding = !currentStamps.includes(stamp);
        const newStamps = isAdding
            ? [...currentStamps, stamp]
            : currentStamps.filter(s => s !== stamp);

        const stampDisplayName = "لم يكتمل بطلب العميل";
        const action = isAdding ? 'إضافة ختم للتقرير' : 'إزالة ختم من التقرير';

        showConfirmModal({
            title: isAdding ? 'إضافة ختم' : 'إزالة ختم',
            message: isAdding
                ? `هل أنت متأكد من إضافة ختم "${stampDisplayName}" إلى التقرير؟ سيظهر هذا الختم بشكل مائي على جميع صفحات التقرير.`
                : 'هل أنت متأكد من إزالة الختم من التقرير؟',
            onConfirm: async () => {
                const details = `"${stampDisplayName}"`;
                const newLog = createActivityLog(action, details);
                const newActivityLog = newLog ? [newLog, ...activityLog] : activityLog;

                try {
                    await updateRequest({
                        id: request.id,
                        report_stamps: newStamps,
                        activity_log: newActivityLog,
                        updated_at: new Date().toISOString()
                    });

                    setActivityLog(newActivityLog);

                    addNotification({
                        title: 'تم التحديث',
                        message: isAdding ? 'تمت إضافة الختم للتقرير.' : 'تمت إزالة الختم من التقرير.',
                        type: 'success'
                    });
                } catch (error) {
                    addNotification({ title: 'خطأ', message: 'فشل تحديث خيارات التقرير.', type: 'error' });
                }
            }
        });
    };

    const handleTabSwitch = (tabId: string) => {
        setActiveTab(tabId); // Fixed: setActiveTab
        setActiveFindingGroup(null);
        setIsFindingsSectionOpen(true);
        setCategorySubTab('main');
    };

    const handleNextTab = useCallback(() => {
        const currentIndex = allTabsInOrder.indexOf(activeTab);
        if (currentIndex < allTabsInOrder.length - 1) {
            handleTabSwitch(allTabsInOrder[currentIndex + 1]);
        } else {
            handleTabSwitch(allTabsInOrder[0]); // Wrap
        }
    }, [activeTab, allTabsInOrder]);

    const handlePrevTab = useCallback(() => {
        const currentIndex = allTabsInOrder.indexOf(activeTab);
        if (currentIndex > 0) {
            handleTabSwitch(allTabsInOrder[currentIndex - 1]);
        } else {
            handleTabSwitch(allTabsInOrder[allTabsInOrder.length - 1]); // Wrap
        }
    }, [activeTab, allTabsInOrder]);

    const handleModalFindingToggle = (findingId: string) => setSelectedFindingsInModal(prev => { const newSet = new Set(prev); if (newSet.has(findingId)) newSet.delete(findingId); else newSet.add(findingId); return newSet; });

    const handleAddSelectedFindings = () => {
        if (isLocked) return;
        const selectedFindings = predefinedFindings.filter(f => selectedFindingsInModal.has(f.id));

        // Expand bundles
        const expandedFindingsPayload: StructuredFinding[] = [];
        const addedFindingNames: string[] = [];

        selectedFindings.forEach(finding => {
            if (finding.is_bundle && finding.linked_finding_ids) {
                // It's a bundle, find all linked findings
                finding.linked_finding_ids.forEach(linkedId => {
                    const linkedFinding = predefinedFindings.find(pf => pf.id === linkedId);
                    if (linkedFinding) {
                        expandedFindingsPayload.push({
                            findingId: linkedFinding.id,
                            findingName: linkedFinding.name,
                            // Use the configured bundle default value, or empty string
                            value: finding.bundle_default_value || '',
                            categoryId: activeTab, // Fixed: activeTab
                            status: 'saving'
                        });
                        addedFindingNames.push(linkedFinding.name);
                    }
                });
            } else {
                expandedFindingsPayload.push({
                    findingId: finding.id,
                    findingName: finding.name,
                    value: finding.options[0] || '',
                    categoryId: finding.category_id,
                    status: 'saving'
                });
                addedFindingNames.push(finding.name);
            }
        });

        // Deduplication: prevent adding already existing findings in this session
        const existingFindingIds = new Set(structuredFindings.map(sf => sf.findingId));
        const filteredPayload = expandedFindingsPayload.filter(f => !existingFindingIds.has(f.findingId));

        // Internal deduplication: case where bundle expansion or selection has internal duplicates
        const finalUniquePayload: StructuredFinding[] = [];
        const seenInPayload = new Set<string>();
        filteredPayload.forEach(f => {
            if (!seenInPayload.has(f.findingId)) {
                seenInPayload.add(f.findingId);
                finalUniquePayload.push(f);
            }
        });

        if (finalUniquePayload.length > 0) {
            setStructuredFindings(prev => [...prev, ...finalUniquePayload]);

            const activeCategory = customFindingCategories.find(c => c.id === activeTab);
            const categoryName = activeCategory?.name || 'قسم غير معروف';
            const addedNames = filteredPayload.map(f => f.findingName);
            addActivityLogEntry('إضافة بنود فحص', `تمت إضافة: ${addedNames.map(n => `"${n}"`).join('، ')} إلى قسم "${categoryName}"`);
            debouncedSave();
        }
    };

    const handleFindingValueChange = useCallback((findingId: string, newValue: string) => {
        if (isLocked) return;
        setStructuredFindings(prev => prev.map(sf => sf.findingId === findingId ? { ...sf, value: newValue, status: 'saving' } : sf));
        const finding = structuredFindings.find(f => f.findingId === findingId);
        if (finding) {
            const categoryName = customFindingCategories.find(c => c.id === finding.categoryId)?.name || 'غير معروف';
            addActivityLogEntry('تعديل بند فحص', `تغيير قيمة البند "${finding.findingName}" إلى "${newValue}" في قسم "${categoryName}"`, undefined, findingId);
        }
        debouncedSave();
    }, [debouncedSave, isLocked]);

    const handleRemoveFinding = useCallback((findingId: string) => {
        if (isLocked) return;
        if (!request) return;

        const findingToDelete = structuredFindings.find(sf => sf.findingId === findingId);
        if (!findingToDelete) return;

        // 1. Optimistic UI update: Remove it immediately from state
        const newStructuredFindings = structuredFindings.filter(sf => sf.findingId !== findingId);
        setStructuredFindings(newStructuredFindings);

        // 2. Add to activity log 
        const categoryName = customFindingCategories.find(c => c.id === findingToDelete.categoryId)?.name || 'غير معروف';
        addActivityLogEntry('حذف بند فحص', `تم حذف بند "${findingToDelete.findingName}" من قسم "${categoryName}"`);

        // 3. IMMEDIATE SAVE with Override: 
        // Pass the new list directly to performSave to bypass any state/ref race conditions.
        // This ensures the backend gets the list *without* the deleted item.
        performSave(false, undefined, { structuredFindings: newStructuredFindings });

    }, [structuredFindings, request, customFindingCategories, addActivityLogEntry, isLocked, performSave]);

    const handleDeleteAllFindingsForCategory = (categoryId: string) => {
        if (isLocked) return;
        const findingsInCategory = structuredFindings.filter(sf => sf.categoryId === categoryId);
        if (findingsInCategory.length === 0) return;

        showConfirmModal({
            title: 'حذف جميع البنود في هذا القسم',
            message: 'هل أنت متأكد من حذف جميع بنود الفحص في هذا القسم؟',
            onConfirm: () => {
                if (!request) return;

                const categoryName = customFindingCategories.find(c => c.id === categoryId)?.name || 'غير معروف';
                const newStructuredFindings = structuredFindings.filter(sf => sf.categoryId !== categoryId);

                // Optimistic UI updates
                setStructuredFindings(newStructuredFindings);
                addActivityLogEntry('حذف جماعي', `تم حذف جميع البنود من قسم "${categoryName}"`);

                // Immediate Save
                performSave(false, undefined, { structuredFindings: newStructuredFindings });

                addNotification({ title: 'نجاح', message: 'تم حذف البنود.', type: 'success' });
            }
        });
    };

    // --- Global Retry Logic ---
    const errorCount = useMemo(() => {
        let count = 0;
        if (generalNotes.some(n => n.status === 'error')) count++;
        structuredFindings.forEach(f => { if (f.status === 'error') count++; });
        Object.values(categoryNotes).forEach((notes: Note[]) => { if (notes.some(n => n.status === 'error')) count++; });
        Object.values(voiceMemos).forEach((memos: VoiceMemo[]) => { if (memos.some(n => n.status === 'error')) count++; });
        return count;
    }, [generalNotes, structuredFindings, categoryNotes, voiceMemos]);

    const handleRetryAll = async () => {
        if (isLocked) return;

        // 1. Visually reset status to 'saving' for all error items to show immediate response
        const updateStatus = <T extends { status?: 'saving' | 'saved' | 'error' }>(items: T[]): T[] => items.map(item => item.status === 'error' ? { ...item, status: 'saving' } : item);

        setGeneralNotes(prev => updateStatus(prev));
        setStructuredFindings(prev => updateStatus(prev));
        setCategoryNotes(prev => {
            const newMap = { ...prev };
            for (const key in newMap) { newMap[key] = updateStatus(newMap[key]); }
            return newMap;
        });
        setVoiceMemos(prev => {
            const newMap = { ...prev };
            for (const key in newMap) { newMap[key] = updateStatus(newMap[key]); }
            return newMap;
        });

        // 2. Perform the actual save
        await performSave();
    };

    const handleRetryItem = useCallback(async (id: string, type: 'note' | 'finding' | 'voice', categoryId?: string | 'general') => {
        if (isLocked) return;

        if (type === 'note') {
            if (categoryId === 'general') {
                setGeneralNotes(prev => prev.map(n => n.id === id ? { ...n, status: 'saving' } : n));
            } else if (categoryId) {
                setCategoryNotes(prev => ({ ...prev, [categoryId]: (prev[categoryId] || []).map(n => n.id === id ? { ...n, status: 'saving' } : n) }));
            }
        } else if (type === 'finding') {
            setStructuredFindings(prev => prev.map(sf => sf.findingId === id ? { ...sf, status: 'saving' } : sf));
        } else if (type === 'voice') {
            setVoiceMemos(prev => {
                if (!categoryId || categoryId === 'general') return prev;
                return { ...prev, [categoryId]: (prev[categoryId] || []).map(m => m.id === id ? { ...m, status: 'saving' } : m) };
            });
        }

        performSave();
    }, [isLocked, performSave]);

    if (!request) {
        return <div className="p-6 dark:text-gray-300">الرجاء اختيار طلب أولاً. <button onClick={() => setPage('requests')} className="text-blue-600 dark:text-blue-400">العودة للطلبات</button></div>;
    }

    const toggleMultiSelect = (sectionId: string) => {
        const isActive = multiSelectMode[sectionId];
        // Only one section can be in multi-select mode at a time
        setMultiSelectMode(prev => ({ [sectionId]: !prev[sectionId] }));

        // Clear selections when exiting mode
        if (isActive) {
            setSelectedNoteIds(prev => {
                const newSelected = { ...prev };
                delete newSelected[sectionId];
                return newSelected;
            });
        }
    };

    const handleNoteSelection = (sectionId: string, noteId: string) => {
        setSelectedNoteIds(prev => {
            const sectionSet = new Set(prev[sectionId] || []);
            if (sectionSet.has(noteId)) {
                sectionSet.delete(noteId);
            } else {
                sectionSet.add(noteId);
            }
            return { ...prev, [sectionId]: sectionSet };
        });
    };

    const applyColorToSelectedNotes = (color: HighlightColor | null) => {
        if (isLocked) return;
        const activeSection = Object.keys(multiSelectMode).find(key => multiSelectMode[key]);
        if (!activeSection) return;

        const idsToColor = selectedNoteIds[activeSection];
        if (!idsToColor || idsToColor.size === 0) {
            addNotification({ title: 'تنبيه', message: 'لم تحدد أي ملاحظات.', type: 'info' });
            return;
        }

        const updateLogic = (notes: Note[]) => notes.map(note => {
            if (idsToColor.has(note.id)) {
                return { ...note, highlightColor: color === null ? undefined : color, status: 'saving' as const };
            }
            return note;
        });

        if (activeSection === 'general') {
            setGeneralNotes(prev => updateLogic(prev));
        } else {
            setCategoryNotes(prev => ({
                ...prev,
                [activeSection]: updateLogic(prev[activeSection] || [])
            }));
        }

        // Clear selection after applying
        setSelectedNoteIds(prev => ({ ...prev, [activeSection]: new Set() }));

        debouncedSave();
    };

    const renderNotes = (notesArray: Note[], categoryId: string | 'general') => {
        return notesArray.map((note) => {
            const isDeleting = deletingNoteIds.has(note.id);
            const colorStyle = note.highlightColor ? highlightColors[note.highlightColor] : null;

            return (
                <div key={note.id} className="flex items-start gap-3 w-full">
                    <li
                        id={`note-${note.id}`}
                        className={`relative flex flex-col sm:flex-row sm:items-start p-3 border rounded-lg gap-3 animate-slide-in-down hover:shadow-md transition-all w-full h-auto ${colorStyle ? colorStyle.cardBg : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                    >
                        <div className="flex items-start gap-3 flex-grow min-w-0 cursor-pointer color-picker-trigger" onClick={() => !isLocked && setColorPickerOpenFor(note.id)}>
                            {note.image && <img src={note.image} alt="صورة ملاحظة" className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-md cursor-pointer border p-0.5 flex-shrink-0" onClick={(e) => { e.stopPropagation(); openImagePreview(note.image!) }} />}
                            <div className="flex-grow pt-0.5 overflow-hidden w-full">
                                <p className="break-words text-base sm:text-lg dark:text-slate-200 whitespace-pre-wrap leading-relaxed w-full min-w-0">{note.text}</p>
                                {note.authorName && <span className="block text-[10px] text-gray-500 mt-1">أضافها: {note.authorName}</span>}
                            </div>
                            <StatusIndicator status={note.status} onRetry={() => handleRetryItem(note.id, 'note', categoryId)} />
                        </div>
                        {can('manage_notes') && !isLocked && (
                            <div className="flex sm:flex-col items-center justify-end gap-2 mt-2 sm:mt-0 sm:border-r pt-2 sm:pt-0 sm:pr-2 dark:border-slate-700">
                                <button onClick={(e) => { e.stopPropagation(); openEditNoteModal(note, categoryId); }} disabled={isDeleting} className="text-yellow-500 hover:text-yellow-700 p-1"><Icon name="edit" className="w-4 h-4" /></button>
                                <button onClick={(e) => { e.stopPropagation(); if (categoryId === 'general') handleRemoveGeneralNote(note.id); else handleRemoveCategoryNote(categoryId, note.id); }} disabled={isDeleting} className="text-red-500 hover:text-red-700 p-1"><Icon name="delete" className="w-4 h-4" /></button>
                            </div>
                        )}

                        {colorPickerOpenFor === note.id && (
                            <div ref={colorPickerRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-white dark:bg-slate-700 shadow-2xl rounded-2xl border-2 border-blue-100 dark:border-slate-600 p-2 flex flex-row items-center gap-2 animate-scale-in" onClick={e => e.stopPropagation()}>
                                {(Object.keys(highlightColors) as HighlightColor[]).map(color => (
                                    <button key={color} type="button" onClick={() => handleHighlightColorChange(note.id, categoryId, color)} className={`w-6 h-6 rounded-full transition-all ${highlightColors[color].bg} ${note.highlightColor === color ? `ring-2 ring-offset-2 dark:ring-offset-slate-700 ${highlightColors[color].ring}` : 'hover:scale-125 border border-white dark:border-slate-500'}`} title={highlightColors[color].name} />
                                ))}
                                <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                                <button type="button" onClick={() => handleHighlightColorChange(note.id, categoryId, null)} className="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-600 flex items-center justify-center hover:scale-125 transition-transform" title="إزالة اللون"><XIcon className="w-4 h-4 text-slate-500 dark:text-slate-300" /></button>
                            </div>
                        )}
                    </li>
                </div>
            );
        });
    };


    const renderFindingsForCategory = (categoryId: string) => {
        if (!categoryId) return null;
        const activeCategory = customFindingCategories.find(c => c.id === categoryId);
        if (!activeCategory) return null;

        const currentCategoryNotes = categoryNotes[categoryId] || [];
        const rawFindings = structuredFindings.filter(sf => sf.categoryId === categoryId);

        // Deduplication Logic: Ensure only one card per findingId is rendered.
        // We use a Map to keep the most up-to-date version (prioritizing 'saved' over 'saving').
        const uniqueFindingsMap = new Map<string, StructuredFinding>();
        rawFindings.forEach(finding => {
            const existing = uniqueFindingsMap.get(finding.findingId);
            // If doesn't exist, or existing is 'saving' and current is 'saved', replace it.
            if (!existing || (existing.status !== 'saved' && finding.status === 'saved')) {
                uniqueFindingsMap.set(finding.findingId, finding);
            }
        });

        const addedFindings = Array.from(uniqueFindingsMap.values());

        // Define availableFindings for the BatchFindingEntry modal
        const availableFindings = predefinedFindings.filter(f => f.category_id === categoryId);

        const findingsToRender = addedFindings.map(finding => {
            const predefined = predefinedFindings.find(pf => pf.id === finding.findingId);
            return { finding, predefined };
        });

        const assignedTechIds = request?.technician_assignments?.[categoryId] || [];
        const assignedTechs = technicians.filter(t => assignedTechIds.includes(t.id));
        const isInMultiSelectMode = multiSelectMode[categoryId];

        return (
            <div key={activeTab} className="animate-fade-in flex flex-col w-full">

                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                    {/* SubTabs removed or simplified if needed, keeping simple here for flat list */}
                    <div className="flex gap-2">
                        {/* We could add subtabs here if voice memos are needed per category */}
                    </div>

                    {!isLocked && (
                        <button
                            onClick={() => {
                                setTechnicianModalTarget({ id: categoryId, name: activeCategory.name });
                                setIsTechnicianModalOpen(true);
                            }}
                            className={`flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-${themeColor}-600 dark:hover:text-${themeColor}-400 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-${themeColor}-200 dark:hover:border-${themeColor}-800 self-end sm:self-center whitespace-nowrap`}
                        >
                            <UserCircleIcon className="w-4 h-4" />
                            <span>
                                {assignedTechs.length > 0
                                    ? `فنيين (${assignedTechs.length})`
                                    : 'تحديد الفنيين'}
                            </span>
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-4">
                    {availableFindings.length > 0 && (
                        <div className="flex flex-col h-auto bg-[#f8fafc] dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
                            <div className="p-2 flex justify-between items-center cursor-pointer bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => setIsFindingsSectionOpen(!isFindingsSectionOpen)}>
                                <div className="flex items-center gap-2">
                                    <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isFindingsSectionOpen ? 'rotate-180' : ''}`} />
                                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">بنود الفحص ({addedFindings.length})</h4>
                                    {addedFindings.length > 0 && can('manage_findings') && !isLocked && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteAllFindingsForCategory(categoryId); }} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="حذف جميع البنود">
                                            <Icon name="delete" className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex bg-white dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-600 shadow-sm">
                                        <button onClick={() => setFindingsViewMode('grid')} className={`p-1.5 rounded-md transition-all ${findingsViewMode === 'grid' ? `bg-${themeColor}-50 text-${themeColor}-600 dark:bg-${themeColor}-900/30 dark:text-${themeColor}-400` : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`} title="عرض شبكة"><Icon name="findings" className="w-4 h-4" /></button>
                                        <button onClick={() => setFindingsViewMode('list')} className={`p-1.5 rounded-md transition-all ${findingsViewMode === 'list' ? `bg-${themeColor}-50 text-${themeColor}-600 dark:bg-${themeColor}-900/30 dark:text-${themeColor}-400` : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`} title="عرض قائمة"><ClipboardListIcon className="w-4 h-4" /></button>
                                        <button onClick={() => setIsGroupedView(!isGroupedView)} className={`p-1.5 rounded-md transition-all ${isGroupedView ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`} title="عرض المجموعات"><Icon name="appearance" className="w-4 h-4" /></button>
                                    </div>
                                    {!isLocked && <Button onClick={() => setIsFindingModalOpen(true)} size="sm" leftIcon={<Icon name="add" className="w-4 h-4" />} disabled={!can('manage_findings')} className="text-xs px-3 py-1.5 h-8">إضافة بنود</Button>}
                                </div>
                            </div>
                            <div className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${isFindingsSectionOpen ? 'max-h-[5000px]' : 'max-h-0'}`}>
                                <div className="p-2 bg-[#f8fafc] dark:bg-slate-800/50">
                                    {findingsToRender.length > 0 ? (
                                        <div className="flex flex-col gap-4">
                                            {isGroupedView ? (
                                                (() => {
                                                    const groupsMap: Record<string, typeof findingsToRender> = {};
                                                    findingsToRender.forEach(item => {
                                                        const g = item.predefined?.group || item.predefined?.groups?.[0] || 'غير مصنف';
                                                        groupsMap[g] = groupsMap[g] || [];
                                                        groupsMap[g].push(item);
                                                    });
                                                    return Object.entries(groupsMap).map(([groupName, groupItems]) => (
                                                        <div key={groupName} className="flex flex-col gap-3">
                                                            <h5 className="text-[10px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 border-b dark:border-slate-700 pb-1 flex items-center gap-2">
                                                                <div className="w-1 h-3 bg-blue-500 rounded-full"></div>{groupName}
                                                            </h5>
                                                            <div className={findingsViewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2" : "flex flex-col gap-2"}>
                                                                {groupItems.map(({ finding, predefined }) => (
                                                                    <FindingCard key={finding.findingId} finding={finding} predefined={predefined} onUpdate={handleFindingValueChange} onRemove={handleRemoveFinding} onRetry={(id) => handleRetryItem(id, 'finding')} onPreview={openImagePreview} isDeleting={deletingFindingIds.has(finding.findingId)} canManage={can('manage_findings')} isLocked={isLocked} viewMode={findingsViewMode} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ));
                                                })()
                                            ) : (
                                                <div className={findingsViewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2" : "flex flex-col gap-2"}>
                                                    {findingsToRender.map(({ finding, predefined }) => (
                                                        <FindingCard key={finding.findingId} finding={finding} predefined={predefined} onUpdate={handleFindingValueChange} onRemove={handleRemoveFinding} onRetry={(id) => handleRetryItem(id, 'finding')} onPreview={openImagePreview} isDeleting={deletingFindingIds.has(finding.findingId)} canManage={can('manage_findings')} isLocked={isLocked} viewMode={findingsViewMode} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 flex flex-col items-center justify-center">
                                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-2 text-slate-400"><Icon name="findings" className="w-6 h-6" /></div>
                                            <h5 className="text-slate-600 dark:text-slate-400 font-bold mb-1 text-sm">لا توجد بنود مضافة</h5>
                                            {!isLocked && <button onClick={() => setIsFindingModalOpen(true)} className={`group flex flex-col items-center justify-center w-full max-w-sm h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl hover:border-${themeColor}-500 hover:bg-${themeColor}-50 dark:hover:bg-slate-700/50 transition-all duration-300 mt-2`}><div className="w-8 h-8 bg-white dark:bg-slate-800 rounded-full shadow-md flex items-center justify-center mb-2 group-hover:scale-110 transition-transform"><Icon name="add" className={`w-4 h-4 text-${themeColor}-600`} /></div><span className={`text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-${themeColor}-600`}>إضافة بنود فحص</span></button>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Notes Section */}
                    <div className="flex flex-col h-auto">
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 rounded-t-xl shadow-sm flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">الملاحظات النصية ({currentCategoryNotes.length})</h4>
                                {currentCategoryNotes.length > 0 && can('manage_notes') && !isLocked && (
                                    <>
                                        <button onClick={() => handleDeleteAllCategoryNotes(categoryId)} className="text-red-500"><Icon name="delete" className="w-5 h-5" /></button>
                                    </>
                                )}
                            </div>
                            {can('manage_notes') && !isLocked && currentCategoryNotes.length > 0 && (
                                <Button size="sm" variant="secondary" onClick={() => toggleMultiSelect(categoryId)}>
                                    {isInMultiSelectMode ? 'إلغاء' : 'تحديد متعدد'}
                                </Button>
                            )}
                        </div>

                        <div className="bg-[#f8fafc] dark:bg-slate-900/50 p-2 sm:p-4 border-x border-b rounded-b-xl border-slate-200 dark:border-slate-700/50 h-auto custom-scrollbar overflow-x-hidden">
                            {currentCategoryNotes.length > 0 ? (
                                <ul className="space-y-3">
                                    {renderNotes(currentCategoryNotes, categoryId)}
                                </ul>
                            ) : (
                                <div className="text-center py-8 text-slate-400 flex flex-col items-center justify-center h-full">
                                    <Icon name="document-report" className="w-12 h-12 mb-2 opacity-20" />
                                    <p className="text-sm">لا توجد ملاحظات نصية.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <Modal isOpen={isFindingModalOpen} onClose={() => setIsFindingModalOpen(false)} title={`إضافة بنود في: ${activeCategory?.name}`} size="4xl">
                    <BatchFindingEntry
                        categoryId={activeTab}
                        availableFindings={availableFindings}
                        onSave={(newFindings) => {
                            const expandedFindings: StructuredFinding[] = [];
                            newFindings.forEach(f => {
                                const original = predefinedFindings.find(p => p.id === f.findingId);
                                if (original?.is_bundle && original.linked_finding_ids) {
                                    original.linked_finding_ids.forEach(lid => {
                                        const linked = predefinedFindings.find(p => p.id === lid);
                                        if (linked) expandedFindings.push({ findingId: lid, findingName: linked.name, value: original.bundle_default_value || '', categoryId: activeTab, status: 'saving' });
                                    });
                                } else {
                                    expandedFindings.push({ findingId: f.findingId, findingName: original?.name || '', value: f.value, categoryId: activeTab, status: 'saving' });
                                }
                            });
                            const existingIds = new Set(structuredFindings.map(sf => sf.findingId));
                            const uniqueInState = expandedFindings.filter(f => !existingIds.has(f.findingId));

                            const finalUniqueFindings: StructuredFinding[] = [];
                            const seen = new Set<string>();
                            uniqueInState.forEach(f => {
                                if (!seen.has(f.findingId)) {
                                    seen.add(f.findingId);
                                    finalUniqueFindings.push(f);
                                }
                            });

                            if (finalUniqueFindings.length > 0) {
                                setStructuredFindings(prev => [...prev, ...finalUniqueFindings]);

                                // LOGGING THE ADDITION
                                const categoryName = activeCategory?.name || 'قسم غير معروف';
                                const addedNames = finalUniqueFindings.map(f => f.findingName);
                                const namesPreview = addedNames.slice(0, 3).join('، ') + (addedNames.length > 3 ? '...' : '');
                                addActivityLogEntry('إضافة بنود فحص', `تمت إضافة ${finalUniqueFindings.length} بند/بنود إلى قسم "${categoryName}" تشمل: ${namesPreview}`);

                                debouncedSave();
                            }
                            setIsFindingModalOpen(false);
                        }}
                        onClose={() => setIsFindingModalOpen(false)}
                    />
                </Modal>
            </div >
        )
    };

    const isMultiSelectActive = Object.values(multiSelectMode).some(Boolean);
    const activeMultiSelectSection = Object.keys(multiSelectMode).find(key => multiSelectMode[key]);
    const numSelectedInActiveSection = activeMultiSelectSection ? (selectedNoteIds[activeMultiSelectSection]?.size || 0) : 0;

    // --- Activity Log Enhancements ---
    const logParticipants = useMemo(() => {
        const participants = new Map<string, string>();
        activityLog.forEach(log => {
            if (!participants.has(log.employeeId)) {
                participants.set(log.employeeId, log.employeeName);
            }
        });
        return Array.from(participants, ([id, name]) => ({ id, name }));
    }, [activityLog]);

    // --- Dynamic Category Extraction from Logs ---
    const logCategories = useMemo(() => {
        const categories = new Set<string>();
        // Look for patterns like 'في قسم "..."' in details
        const catRegex = /في قسم "([^"]+)"/;
        activityLog.forEach(log => {
            const match = log.details.match(catRegex);
            if (match) {
                categories.add(match[1]);
            } else if (log.action.includes('عامة')) {
                categories.add('ملاحظات عامة');
            }
        });
        return Array.from(categories);
    }, [activityLog]);

    const filteredActivityLog = useMemo(() => {
        let filtered = activityLog;

        // Filter by employee
        if (activityLogFilter !== 'all') {
            filtered = filtered.filter(log => log.employeeId === activityLogFilter);
        }

        // Filter by category
        if (activityLogCategoryFilter !== 'all') {
            filtered = filtered.filter(log => {
                const catRegex = /في قسم "([^"]+)"/;
                const match = log.details.match(catRegex);
                if (activityLogCategoryFilter === 'ملاحظات عامة') {
                    return log.action.includes('عامة') || (match && match[1] === 'ملاحظات عامة');
                }
                return match && match[1] === activityLogCategoryFilter;
            });
        }

        // Filter by search term
        if (activityLogSearch.trim()) {
            const term = activityLogSearch.toLowerCase();
            filtered = filtered.filter(log =>
                log.action.toLowerCase().includes(term) ||
                log.details.toLowerCase().includes(term) ||
                log.employeeName.toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [activityLog, activityLogFilter, activityLogCategoryFilter, activityLogSearch]);

    // --- Helper to Navigate to Item from Log ---
    const handleLogClick = useCallback((log: ActivityLog) => {
        if (!log.link_id && !log.details.includes('قسم')) return;

        // 1. Identify Target Tab
        let targetTab = '';
        if (log.action.includes('ملاحظة عامة') || log.details.includes('ملاحظات عامة')) {
            targetTab = 'general-notes';
        } else {
            const catRegex = /في قسم "([^"]+)"/;
            const match = log.details.match(catRegex);
            if (match) {
                const categoryName = match[1];
                const category = customFindingCategories.find(c => c.name === categoryName);
                if (category) targetTab = category.id;
            }
        }

        if (targetTab) {
            setActiveTab(targetTab);
            setIsActivityDrawerOpen(false);

            // 2. Scroll and Highlight (if we have a link_id)
            if (log.link_id) {
                setTimeout(() => {
                    const element = document.getElementById(`notecard-${log.link_id}`) ||
                        document.getElementById(`finding-${log.link_id}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.classList.add('animate-pulse-blue');
                        setTimeout(() => element.classList.remove('animate-pulse-blue'), 3000);
                    }
                }, 300);
            }
        }
    }, [customFindingCategories, setActiveTab]);

    const formatLogTimestamp = (timestamp: string) => {
        const logDate = new Date(timestamp);
        const now = new Date();
        const diffSeconds = (now.getTime() - logDate.getTime()) / 1000;

        if (diffSeconds < 60 && diffSeconds >= 0) {
            return { datePart: 'الآن', timePart: '' };
        }

        const datePart = logDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/-/g, ' / ');
        const timePart = logDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

        return { datePart, timePart };
    };

    return (
        <div className="flex flex-col h-full relative">

            <FillRequestHeader
                request={request}
                carDetails={carDetails}
                isLocked={isLocked}
                isSubmitting={isSubmitting}
                themeColor={themeColor}
                onGoBack={handleGoBack}
                onOpenTechnicianModal={() => {
                    setTechnicianModalTarget({ id: 'ALL', name: 'كامل الطلب' });
                    setIsTechnicianModalOpen(true);
                }}
                onToggleStamp={handleToggleStamp}
                onSave={handleSave}
                onOpenActivityLog={() => setIsActivityDrawerOpen(true)}
                onOpenInfoModal={() => setIsInfoModalOpen(true)}
            />

            {/* Top Alerts */}
            {isLocked && (
                <div className="w-full bg-green-500 text-white text-center py-2 font-bold shadow-md z-30">
                    <div className="flex items-center justify-center gap-2">
                        <CheckCircleIcon className="w-5 h-5" />
                        هذا الطلب مكتمل ولا يمكن تعديله
                    </div>
                </div>
            )}
            {request.report_stamps?.includes('CUSTOMER_REQUEST_INCOMPLETE') && (
                <div className="w-full bg-red-500 text-white text-center py-2 font-bold shadow-md z-30">
                    <div className="flex items-center justify-center gap-2">
                        <AlertTriangleIcon className="w-5 h-5" />
                        تنبيه: التقرير مختوم بـ "لم يكتمل الفحص بطلب العميل"
                    </div>
                </div>
            )}


            <div className="sticky top-0 z-30 bg-[#f8fafc]/95 dark:bg-slate-800/95 backdrop-blur-sm border-b dark:border-slate-700 shadow-md flex-shrink-0">
                <div className="p-2 overflow-x-auto no-scrollbar">
                    <nav className="flex gap-2 min-w-max justify-center">
                        {visibleFindingCategories.map(category => {
                            const findingsCount = structuredFindings.filter(sf => sf.categoryId === category.id).length;
                            const notesCount = (categoryNotes[category.id] || []).length;
                            const totalCount = findingsCount + notesCount;
                            const isActive = activeTab === category.id;

                            return (
                                <button key={category.id} onClick={() => handleTabSwitch(category.id)} className={`flex items-center gap-2 whitespace-nowrap py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${isActive ? `bg-${themeColor}-600 text-white shadow-md transform scale-105 animate-active-tab` : 'bg-white border border-slate-200 dark:border-slate-600 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                                    {isActive && isLoadingTab ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <Icon name="findings" className="w-4 h-4" />}
                                    <span>{category.name}</span>
                                    {totalCount > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? `bg-white text-${themeColor}-600` : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400'}`}>{totalCount}</span>}
                                </button>
                            );
                        })}
                        <button key="general-notes" onClick={() => handleTabSwitch('general-notes')} className={`flex items-center gap-2 whitespace-nowrap py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${activeTab === 'general-notes' ? `bg-${themeColor}-600 text-white shadow-md transform scale-105 animate-active-tab` : 'bg-white border border-slate-200 dark:border-slate-600 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                            <span>ملاحظات عامة</span>
                            {generalNotes.length > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'general-notes' ? `bg-white text-${themeColor}-600` : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400'}`}>{generalNotes.length}</span>}
                        </button>
                        <button key="gallery" onClick={() => handleTabSwitch('gallery')} className={`flex items-center gap-2 whitespace-nowrap py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${activeTab === 'gallery' ? `bg-${themeColor}-600 text-white shadow-md transform scale-105 animate-active-tab` : 'bg-white border border-slate-200 dark:border-slate-600 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                            <span>المعرض</span>
                        </button>
                    </nav>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div
                ref={contentRef}
                onScroll={handleScroll} // Added Scroll Handler
                className="flex-1 overflow-y-auto bg-[#f8fafc] dark:bg-slate-800 p-4 sm:p-6 pb-4 relative scroll-smooth overflow-x-hidden"
                style={{ paddingBottom: `${footerHeight + 88}px` }}
            >
                {isLoadingTab ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500"><RefreshCwIcon className={`w-10 h-10 animate-spin text-${themeColor}-500 mb-4`} /><p>جاري تحميل البيانات...</p></div>
                ) : (
                    <div className="max-w-6xl mx-auto w-full">
                        {activeTab === 'gallery' && <ImageGallery images={allImages} onImageClick={openImagePreview} />}
                        {activeTab === 'general-notes' && (
                            <div className="flex flex-col h-auto">
                                <div className="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 rounded-t-xl shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">الملاحظات العامة ({generalNotes.length})</h4>
                                        {generalNotes.length > 0 && can('manage_notes') && !isLocked && (
                                            <>
                                                <button onClick={handleDeleteAllGeneralNotes} className="text-red-500"><Icon name="delete" className="w-5 h-5" /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-[#f8fafc] dark:bg-slate-900/50 p-2 sm:p-4 border-x border-b rounded-b-xl h-auto custom-scrollbar">
                                    {generalNotes.length > 0 ? (
                                        <ul className="space-y-3 mt-4">
                                            {renderNotes(generalNotes, 'general')}
                                        </ul>
                                    ) : <div className="text-center py-8 text-slate-400">لا توجد ملاحظات عامة.</div>}
                                </div>
                            </div>
                        )}
                        {activeTab !== 'general-notes' && activeTab !== 'gallery' && renderFindingsForCategory(activeTab)}
                    </div>
                )}
            </div>

            {/* Scroll To Top Button - Moved to Left-4 and adjusted bottom for mobile compatibility */}
            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    className={`fixed bottom-[180px] sm:bottom-36 left-4 sm:right-4 sm:left-auto z-50 p-3 bg-${themeColor}-600 text-white rounded-full shadow-lg hover:bg-${themeColor}-700 transition-all animate-scale-in`}
                    title="للأعلى"
                >
                    <ChevronDownIcon className="w-6 h-6 transform rotate-180" />
                </button>
            )}

            {/* Footer Container */}
            <div ref={footerRef} className="fixed bottom-0 left-0 right-0 z-40">
                {isMultiSelectActive && activeMultiSelectSection ? (
                    <div className="bg-white dark:bg-slate-800 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] border-t dark:border-slate-700 p-3 animate-slide-in-up">
                        <div className="container mx-auto flex justify-between items-center max-w-6xl">
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                {numSelectedInActiveSection > 0 ? `${numSelectedInActiveSection} ملاحظة محددة` : 'حدد الملاحظات لتلوينها'}
                            </span>
                            <div className="flex items-center gap-2">
                                {(Object.keys(highlightColors) as HighlightColor[]).map(color => (
                                    <button key={color} type="button" onClick={() => applyColorToSelectedNotes(color)} className={`w-7 h-7 rounded-full transition-all ${highlightColors[color].bg} hover:scale-110 ring-2 ring-transparent hover:ring-slate-400`} title={highlightColors[color].name} />
                                ))}
                                <button type="button" onClick={() => applyColorToSelectedNotes(null)} className="w-7 h-7 rounded-full border dark:border-slate-500 bg-white dark:bg-slate-600 flex items-center justify-center hover:scale-110 transition-transform ring-2 ring-transparent hover:ring-slate-400" title="إزالة اللون"><XIcon className="w-5 h-5 text-slate-500 dark:text-slate-300" /></button>
                                <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-2"></div>
                                <Button size="sm" onClick={() => toggleMultiSelect(activeMultiSelectSection)}>تم</Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <StickyNoteInput
                        onAddNote={handleAddNote}
                        activeTabId={activeTab}
                        customFindingCategories={customFindingCategories}
                        canManageNotes={can('manage_notes')}
                        isLocked={isLocked}
                        focusRingClass={focusRingClass}
                        openImagePreview={openImagePreview}
                        onReview={() => setIsReviewModalOpen(true)}
                        onPrint={handlePreviewAndPrint}
                        onComplete={can('mark_request_complete') ? handleComplete : undefined}
                        canChangeStatus={!isLocked && can('change_request_status')}
                        canPrint={can('print_request')}
                        allTabsInOrder={allTabsInOrder}
                        onNextTab={handleNextTab}
                        onPrevTab={handlePrevTab}
                    />
                )}
            </div>

            {/* Error Alert Banner */}
            {errorCount > 0 && (
                <div className="fixed left-0 right-0 z-40 px-4" style={{ bottom: `${footerHeight + 90}px` }}>
                    <div className="bg-red-500 text-white p-3 rounded-xl shadow-lg flex justify-between items-center max-w-4xl mx-auto animate-slide-in-up border border-red-600">
                        <div className="flex items-center gap-2">
                            <WifiOffIcon className="w-5 h-5 animate-pulse" />
                            <span className="font-bold text-sm">فشل حفظ {errorCount} تغييرات</span>
                        </div>
                        <button onClick={handleRetryAll} className="bg-white text-red-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-red-50 transition-colors shadow-sm">
                            إعادة المحاولة للكل
                        </button>
                    </div>
                </div>
            )}

            <Modal isOpen={isEditNoteModalOpen} onClose={() => setIsEditNoteModalOpen(false)} title="تعديل الملاحظة" size="lg">
                <div>
                    <textarea value={modalNoteData.text} onChange={e => setModalNoteData(p => ({ ...p, text: e.target.value.toUpperCase() }))} className="w-full p-2 border rounded-md dark:bg-slate-900/50 dark:border-slate-600 text-lg uppercase" rows={4} />
                    <div className="flex items-center gap-4 mt-4">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 font-bold">لون التمييز:</label>
                        <div className="flex items-center gap-2">
                            {(Object.keys(highlightColors) as HighlightColor[]).map(color => (
                                <button key={color} type="button" onClick={() => setModalNoteData(p => ({ ...p, highlightColor: p.highlightColor === color ? null : color }))} className={`w-7 h-7 rounded-full transition-all ${highlightColors[color].bg} ${modalNoteData.highlightColor === color ? `ring-2 ring-offset-2 dark:ring-offset-slate-900 ${highlightColors[color].ring}` : 'hover:scale-110'}`} title={highlightColors[color].name} />
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 border-t dark:border-slate-700 pt-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 font-bold">الصورة المرفقة:</label>
                        <div className="flex items-center gap-4">
                            {modalNoteData.image ? (
                                <div className="relative group">
                                    <img src={modalNoteData.image} className="w-24 h-24 object-cover rounded-xl border shadow-md" alt="معاينة" />
                                    <button onClick={() => { setModalNoteData(p => ({ ...p, image: null })); setModalNoteFile(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 hover:scale-110 transition-all border-2 border-white dark:border-slate-800">
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all group overflow-hidden">
                                    <div className="flex flex-col items-center justify-center py-5">
                                        <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-all">
                                            <Icon name="gallery" className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                                        </div>
                                        <p className="text-[10px] mt-2 font-bold text-slate-500 group-hover:text-blue-600">رفع صورة</p>
                                    </div>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setModalNoteFile(file);
                                            const reader = new FileReader();
                                            reader.onload = (ev) => setModalNoteData(p => ({ ...p, image: ev.target?.result as string }));
                                            reader.readAsDataURL(file);
                                        }
                                    }} />
                                </label>
                            )}
                            <div className="flex-1 text-xs text-slate-500 dark:text-slate-400 leading-tight">
                                <p>يمكنك تغيير الصورة أو إضافتها للملاحظة. الحد الأقصى للجودة 5 ميجا.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 mt-4 border-t dark:border-slate-700">
                    <Button variant="secondary" onClick={() => setIsEditNoteModalOpen(false)}>إلغاء</Button>
                    <Button onClick={handleSaveEditedNote} disabled={isUploading}>{isUploading ? 'جاري الحفظ...' : 'حفظ التعديلات'}</Button>
                </div>
            </Modal>

            <ReviewModeModal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                request={request}
                categories={customFindingCategories}
                predefinedFindings={predefinedFindings}
                onUpdateNote={handleUpdateNoteFromReview}
                onUpdateFinding={handleUpdateFindingFromReview}
                onDelete={handleDeleteFromReview}
                apiKey={settings.geminiApiKey}
                addNotification={addNotification}
                showConfirmModal={showConfirmModal}
            />

            <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} size="4xl" title="معاينة الصورة">{previewImageUrl && <img src={previewImageUrl} alt="معاينة مكبرة" className="max-w-full max-h-[80vh] mx-auto" />}</Modal>
            <TechnicianSelectionModal isOpen={isTechnicianModalOpen} onClose={() => setIsTechnicianModalOpen(false)} request={request} categoryId={technicianModalTarget?.id || ''} categoryName={technicianModalTarget?.name || ''} />
            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="تفاصيل الطلب" size="lg">
                <div className="space-y-6">
                    {/* Header Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border dark:border-slate-600">
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">رقم الطلب</p>
                            <p className={`font-bold text-xl text-${themeColor}-600`}>#{request.request_number}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">الحالة</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${request.status === RequestStatus.COMPLETE ? 'bg-green-100 text-green-800' :
                                request.status === RequestStatus.IN_PROGRESS ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {request.status}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">تاريخ الدخول</p>
                            <p className="font-semibold text-sm">{new Date(request.created_at).toLocaleDateString('en-GB')}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">نوع الفحص</p>
                            <p className="font-semibold text-sm">{inspectionType?.name || 'غير محدد'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Client Info */}
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b dark:border-slate-700 pb-2 mb-3 flex items-center gap-2">
                                <UserCircleIcon className="w-5 h-5 text-slate-400" />
                                بيانات العميل
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400 text-sm">الاسم:</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{client?.name}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 dark:text-slate-400 text-sm">رقم الجوال:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-800 dark:text-slate-200 font-mono tracking-wider" dir="ltr">{client?.phone}</span>
                                        {client?.phone && (
                                            <a 
                                                href={`https://wa.me/${client.phone.replace(/\D/g, '').replace(/^0/, '966')}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="p-1.5 bg-[#25D366] text-white rounded-full hover:bg-[#128C7E] transition-colors shadow-sm"
                                                title="محادثة واتساب"
                                            >
                                                <WhatsappIcon className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Car Info */}
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b dark:border-slate-700 pb-2 mb-3 flex items-center gap-2">
                                <CarIcon className="w-5 h-5 text-slate-400" />
                                بيانات السيارة
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400 text-sm">السيارة:</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{carDetails.makeNameAr} {carDetails.modelNameAr}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400 text-sm">الموديل (English):</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{carDetails.makeNameEn} {carDetails.modelNameEn}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400 text-sm">سنة الصنع:</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{carDetails.year}</span>
                                </div>
                                <div className="pt-2 flex justify-center">
                                    {car?.plate_number ? (
                                        <MiniPlateDisplay plateNumber={car.plate_number} settings={settings} />
                                    ) : (
                                        <span className="text-sm text-slate-400 italic">رقم الشاصي: {car?.vin || 'غير متوفر'}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end pt-6 mt-4 border-t dark:border-slate-700">
                    <Button onClick={() => setIsInfoModalOpen(false)}>إغلاق</Button>
                </div>
            </Modal>

            {/* Activity Log Drawer */}
            <Drawer
                isOpen={isActivityDrawerOpen}
                onClose={() => setIsActivityDrawerOpen(false)}
                title={
                    <div className="flex flex-col gap-3 w-full">
                        <div className="flex items-center justify-between gap-4">
                            <span className="font-bold text-lg">سجل النشاط</span>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">الموظف:</span>
                                    <select
                                        value={activityLogFilter}
                                        onChange={(e) => setActivityLogFilter(e.target.value)}
                                        className={`text-[11px] p-1.5 pr-6 rounded-lg bg-slate-100 dark:bg-slate-700 border-none focus:ring-2 focus:ring-${themeColor}-500/20 font-bold`}
                                    >
                                        <option value="all">الكل</option>
                                        {logParticipants.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-1.5 border-r dark:border-slate-700 pr-2 mr-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">القسم:</span>
                                    <select
                                        value={activityLogCategoryFilter}
                                        onChange={(e) => setActivityLogCategoryFilter(e.target.value)}
                                        className={`text-[11px] p-1.5 pr-6 rounded-lg bg-slate-100 dark:bg-slate-700 border-none focus:ring-2 focus:ring-${themeColor}-500/20 font-bold`}
                                    >
                                        <option value="all">الكل</option>
                                        {logCategories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="relative">
                            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={activityLogSearch}
                                onChange={(e) => setActivityLogSearch(e.target.value)}
                                placeholder="ابحث في السجل..."
                                className={`w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-${themeColor}-500/20 focus:border-${themeColor}-500 transition-all font-medium`}
                            />
                        </div>
                    </div>
                }
            >
                <div className="space-y-6 pb-20">
                    {filteredActivityLog.length > 0 ? (
                        groupLogsByDate(filteredActivityLog).map(([dateGroup, logs]) => (
                            <div key={dateGroup} className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700/50"></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-2">{dateGroup}</span>
                                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700/50"></div>
                                </div>
                                <div className="space-y-3">
                                    {logs.map((log, index) => {
                                        const { timePart } = formatLogTimestamp(log.timestamp);
                                        const iconData = getActionIcon(log.action);
                                        const isClickable = !!(log.link_id || log.details.includes('قسم'));

                                        return (
                                            <div
                                                key={log.id || index}
                                                onClick={() => isClickable && handleLogClick(log)}
                                                className={`group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm transition-all duration-300 ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/80' : ''}`}
                                            >
                                                {isClickable && (
                                                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 dark:bg-blue-900/30 text-blue-600 p-1 rounded-lg">
                                                        <Icon name="search" className="w-3 h-3" />
                                                    </div>
                                                )}
                                                <div className="flex items-start gap-4">
                                                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${iconData.bg} flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                                                        {React.cloneElement(iconData.icon as React.ReactElement<{ className?: string }>, { className: `w-6 h-6 ${iconData.color}` })}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                                            <div className="flex flex-col">
                                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-[13px] leading-snug">
                                                                    {log.action}
                                                                </h4>
                                                                {log.employeeName && (
                                                                    <div className="flex items-center gap-1.5 mt-0.5 opacity-70">
                                                                        <UserCircleIcon className="w-3 h-3 text-slate-400" />
                                                                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                                                            {log.employeeName}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded-md">
                                                                    <Icon name="history" className="w-2.5 h-2.5" />
                                                                    {timePart || 'الآن'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-900/20 p-2.5 rounded-xl border border-dashed border-slate-100 dark:border-slate-700/50 mt-2 break-words whitespace-pre-wrap">
                                                            {formatLogDetails(log.details)}
                                                        </div>

                                                        {log.imageUrl && (
                                                            <div className="mt-4 relative group/img overflow-hidden rounded-xl border dark:border-slate-700 shadow-sm">
                                                                <img
                                                                    src={log.imageUrl}
                                                                    alt="صورة النشاط"
                                                                    className="w-full max-h-48 object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openImagePreview(log.imageUrl!);
                                                                    }}
                                                                />
                                                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors pointer-events-none flex items-center justify-center">
                                                                    <Icon name="search" className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-center">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-2xl animate-pulse"></div>
                                <div className="relative w-24 h-24 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-xl border dark:border-slate-700 rotate-12">
                                    <Icon name="history" className="w-12 h-12 text-blue-500 -rotate-12" />
                                </div>
                            </div>
                            <h5 className="text-lg font-bold text-slate-700 dark:text-slate-200">
                                {activityLogSearch ? 'لا توجد نتائج للبحث' : 'لا توجد أنشطة مسجلة'}
                            </h5>
                            <p className="text-sm text-slate-400 mt-2 max-w-[200px]">
                                {activityLogSearch ? 'جرب البحث بكلمات أخرى أو تغيير القسم' : 'سيتم تسجيل جميع الحركات والأنشطة هنا لسهولة التتبع'}
                            </p>
                        </div>
                    )}
                </div>
            </Drawer>
        </div>
    );
};

export default FillRequest;
