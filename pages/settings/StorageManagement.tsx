import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import RefreshCwIcon from '../../components/icons/RefreshCwIcon';
import TrashIcon from '../../components/icons/TrashIcon';
import DatabaseIcon from '../../components/icons/DatabaseIcon';
import ImageIcon from '../../components/icons/ImageIcon';
import FolderOpenIcon from '../../components/icons/FolderOpenIcon';
import DownloadIcon from '../../components/icons/DownloadIcon';
import EyeIcon from '../../components/icons/EyeIcon';
import CustomDatePicker from '../../components/CustomDatePicker';
import { formatBytes } from '../../lib/utils';
import { supabase } from '../../lib/supabaseClient';

interface StorageItem {
    name: string;
    id: string | null; // null for folders
    updated_at?: string;
    created_at?: string;
    last_accessed_at?: string;
    metadata?: {
        size?: number;
        mimetype?: string;
        [key: string]: any;
    };
    isFolder: boolean;
}

const StorageManagement: React.FC = () => {
    const { addNotification, showConfirmModal, requests } = useAppContext();

    // Navigation & Path state inside 'attached_files'
    const [currentPath, setCurrentPath] = useState<string>(''); // '' means root of attached_files
    const [items, setItems] = useState<StorageItem[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);
    const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
    
    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'older' | 'range'>('all');
    const [daysToKeep, setDaysToKeep] = useState(30);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Sort State: 'desc' = newest first, 'asc' = oldest first
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    // Grouping / Accordion Mode: 'none' | 'months' | 'days' | 'hierarchy'
    type GroupingMode = 'none' | 'months' | 'days' | 'hierarchy';
    const [groupingMode, setGroupingMode] = useState<GroupingMode>('months');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // Date Basis for Grouping & Sorting: 'request_date' (Default) vs 'upload_date'
    type DateBasis = 'request_date' | 'upload_date';
    const [dateBasis, setDateBasis] = useState<DateBasis>('request_date');
    const [requestDatesMap, setRequestDatesMap] = useState<Record<number, string>>({});
    const [isLoadingRequestDates, setIsLoadingRequestDates] = useState(false);

    // Extract Request Number from file name (e.g. Req-4421_Draft_1789499836148_9.jpg -> 4421)
    const extractRequestNumber = (fileName: string): number | null => {
        if (!fileName) return null;
        // Match Req-4421 or req-4421 or REQ_4421 or Req4421
        const m1 = fileName.match(/(?:^|[^a-zA-Z0-9])(?:req|طلب)[-_]?(\d+)/i);
        if (m1 && m1[1]) {
            const num = parseInt(m1[1], 10);
            if (!isNaN(num) && num > 0) return num;
        }
        // Match 4421_Draft_... or 4421-Draft-...
        const m2 = fileName.match(/^(\d+)[-_](?:draft|مسودة)/i);
        if (m2 && m2[1]) {
            const num = parseInt(m2[1], 10);
            if (!isNaN(num) && num > 0) return num;
        }
        return null;
    };

    // Preview modal state
    const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

    // Format ISO date to English numerals (YYYY-MM-DD HH:mm)
    // Extract English Year-Month (YYYY-MM)
    const getYearMonth = (isoDateString?: string) => {
        if (!isoDateString) return 'غير محدد التاريخ';
        const d = new Date(isoDateString);
        if (isNaN(d.getTime())) return 'غير محدد التاريخ';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    // Extract English Year-Month-Day (YYYY-MM-DD)
    const getYearMonthDay = (isoDateString?: string) => {
        if (!isoDateString) return 'غير محدد التاريخ';
        const d = new Date(isoDateString);
        if (isNaN(d.getTime())) return 'غير محدد التاريخ';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatEnglishDate = (isoDateString?: string) => {
        if (!isoDateString) return '-';
        const d = new Date(isoDateString);
        if (isNaN(d.getTime())) return '-';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    // Fetch items at the current path
    const fetchPathContents = useCallback(async (path: string) => {
        setIsFetching(true);
        setSelectedFileNames([]);
        try {
            // Paginate or retrieve up to 5000 items in the folder
            let allItems: any[] = [];
            let offset = 0;
            const limit = 500;
            let keepGoing = true;

            while (keepGoing && offset < 5000) {
                const { data, error } = await supabase.storage
                    .from('attached_files')
                    .list(path, {
                        limit,
                        offset,
                        sortBy: { column: 'name', order: 'asc' }
                    });

                if (error) throw error;
                if (!data || data.length === 0) {
                    keepGoing = false;
                    break;
                }

                allItems = allItems.concat(data);
                if (data.length < limit) {
                    keepGoing = false;
                } else {
                    offset += limit;
                }
            }

            // Filter out placeholder files
            const valid = allItems.filter(item => item.name !== '.emptyFolderPlaceholder');

            const formatted: StorageItem[] = valid.map(item => ({
                ...item,
                isFolder: item.id === null
            }));

            setItems(formatted);
        } catch (error: any) {
            console.error('Error listing storage contents in attached_files:', error);
            addNotification({
                title: 'خطأ',
                message: 'فشل في استعراض محتويات التخزين: ' + (error?.message || 'خطأ غير معروف'),
                type: 'error'
            });
        } finally {
            setIsFetching(false);
        }
    }, [addNotification]);

    useEffect(() => {
        fetchPathContents(currentPath);
    }, [currentPath, fetchPathContents]);

    // Handle navigation into folder
    const handleOpenFolder = (folderName: string) => {
        setCurrentPath(prev => (prev ? `${prev}/${folderName}` : folderName));
    };

    // Handle breadcrumb click
    const handleNavigateBreadcrumb = (index: number, breadcrumbs: string[]) => {
        if (index === -1) {
            setCurrentPath('');
        } else {
            setCurrentPath(breadcrumbs.slice(0, index + 1).join('/'));
        }
    };

    // Extract missing request numbers from file items and fetch their creation dates from database
    useEffect(() => {
        // 1. First seed with any known requests from context
        const seedMap: Record<number, string> = {};
        if (requests && requests.length > 0) {
            requests.forEach(r => {
                if (r.request_number && r.created_at) {
                    seedMap[r.request_number] = r.created_at;
                }
            });
        }

        // 2. Identify unique request numbers from all file items
        const uniqueReqNumbers = new Set<number>();
        items.forEach(item => {
            if (!item.isFolder) {
                const reqNum = extractRequestNumber(item.name);
                if (reqNum) uniqueReqNumbers.add(reqNum);
            }
        });

        const numbersToFetch = Array.from(uniqueReqNumbers).filter(num => {
            return !seedMap[num] && !requestDatesMap[num];
        });

        if (Object.keys(seedMap).length > 0) {
            setRequestDatesMap(prev => ({ ...seedMap, ...prev }));
        }

        if (numbersToFetch.length === 0) return;

        let isMounted = true;
        const fetchDates = async () => {
            setIsLoadingRequestDates(true);
            try {
                const chunkSize = 100;
                const fetchedMap: Record<number, string> = {};
                for (let i = 0; i < numbersToFetch.length; i += chunkSize) {
                    const chunk = numbersToFetch.slice(i, i + chunkSize);
                    const { data, error } = await supabase
                        .from('inspection_requests')
                        .select('request_number, created_at')
                        .in('request_number', chunk);

                    if (!error && data) {
                        data.forEach((r: any) => {
                            if (r.request_number && r.created_at) {
                                fetchedMap[r.request_number] = r.created_at;
                            }
                        });
                    }
                }
                if (isMounted && Object.keys(fetchedMap).length > 0) {
                    setRequestDatesMap(prev => ({ ...prev, ...fetchedMap }));
                }
            } catch (err) {
                console.error('Failed to fetch request dates for storage files:', err);
            } finally {
                if (isMounted) setIsLoadingRequestDates(false);
            }
        };

        fetchDates();

        return () => {
            isMounted = false;
        };
    }, [items, requests]);

    // Effective date based on dateBasis selection ('request_date' vs 'upload_date')
    const getEffectiveDate = useCallback((file: StorageItem): string | undefined => {
        if (dateBasis === 'request_date') {
            const reqNum = extractRequestNumber(file.name);
            if (reqNum && requestDatesMap[reqNum]) {
                return requestDatesMap[reqNum];
            }
        }
        return file.created_at || file.updated_at;
    }, [dateBasis, requestDatesMap]);

    // Filter and Sort files
    const filteredAndSortedItems = useMemo(() => {
        const filtered = items.filter(item => {
            // Search filter
            if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) {
                return false;
            }

            // If it's a folder, don't apply date filters
            if (item.isFolder) return true;

            const effectiveDateStr = getEffectiveDate(item);

            // Date Filters
            if (filterType === 'older') {
                if (!effectiveDateStr) return true;
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - daysToKeep);
                return new Date(effectiveDateStr) < cutoff;
            }

            if (filterType === 'range') {
                if (!effectiveDateStr) return true;
                const date = new Date(effectiveDateStr);
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (date < start) return false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (date > end) return false;
                }
            }

            return true;
        });

        // Sort: Folders always on top, then sort files by effective date according to sortOrder
        filtered.sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            if (a.isFolder && b.isFolder) return a.name.localeCompare(b.name);

            const effectiveA = getEffectiveDate(a);
            const effectiveB = getEffectiveDate(b);
            const dateA = effectiveA ? new Date(effectiveA).getTime() : 0;
            const dateB = effectiveB ? new Date(effectiveB).getTime() : 0;

            if (sortOrder === 'desc') {
                // Newest first
                return dateB - dateA;
            } else {
                // Oldest first
                return dateA - dateB;
            }
        });

        return filtered;
    }, [items, searchQuery, filterType, daysToKeep, startDate, endDate, sortOrder, getEffectiveDate]);

    const displayedFolders = filteredAndSortedItems.filter(i => i.isFolder);
    const displayedFiles = filteredAndSortedItems.filter(i => !i.isFolder);
    const totalFilesSize = displayedFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);

    // 1. Month-based grouping
    const monthGroups = useMemo(() => {
        if (groupingMode !== 'months') return [];
        const map = new Map<string, StorageItem[]>();
        displayedFiles.forEach(file => {
            const ym = getYearMonth(getEffectiveDate(file));
            if (!map.has(ym)) map.set(ym, []);
            map.get(ym)!.push(file);
        });

        const sortedKeys = Array.from(map.keys()).sort((a, b) => {
            if (a === 'غير محدد التاريخ') return 1;
            if (b === 'غير محدد التاريخ') return -1;
            return sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
        });

        return sortedKeys.map(key => {
            const groupFiles = map.get(key) || [];
            const size = groupFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
            return {
                key,
                title: key,
                files: groupFiles,
                size
            };
        });
    }, [displayedFiles, groupingMode, sortOrder, getEffectiveDate]);

    // 2. Day-based grouping
    const dayGroups = useMemo(() => {
        if (groupingMode !== 'days') return [];
        const map = new Map<string, StorageItem[]>();
        displayedFiles.forEach(file => {
            const ymd = getYearMonthDay(getEffectiveDate(file));
            if (!map.has(ymd)) map.set(ymd, []);
            map.get(ymd)!.push(file);
        });

        const sortedKeys = Array.from(map.keys()).sort((a, b) => {
            if (a === 'غير محدد التاريخ') return 1;
            if (b === 'غير محدد التاريخ') return -1;
            return sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
        });

        return sortedKeys.map(key => {
            const groupFiles = map.get(key) || [];
            const size = groupFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
            return {
                key,
                title: key,
                files: groupFiles,
                size
            };
        });
    }, [displayedFiles, groupingMode, sortOrder, getEffectiveDate]);

    // 3. Hierarchy grouping: Month -> Days -> Files
    const hierarchyGroups = useMemo(() => {
        if (groupingMode !== 'hierarchy') return [];
        const map = new Map<string, Map<string, StorageItem[]>>();

        displayedFiles.forEach(file => {
            const effectiveDate = getEffectiveDate(file);
            const ym = getYearMonth(effectiveDate);
            const ymd = getYearMonthDay(effectiveDate);
            if (!map.has(ym)) map.set(ym, new Map());
            const monthSubMap = map.get(ym)!;
            if (!monthSubMap.has(ymd)) monthSubMap.set(ymd, []);
            monthSubMap.get(ymd)!.push(file);
        });

        const sortedMonths = Array.from(map.keys()).sort((a, b) => {
            if (a === 'غير محدد التاريخ') return 1;
            if (b === 'غير محدد التاريخ') return -1;
            return sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
        });

        return sortedMonths.map(ym => {
            const subMap = map.get(ym)!;
            const sortedDays = Array.from(subMap.keys()).sort((a, b) => {
                if (a === 'غير محدد التاريخ') return 1;
                if (b === 'غير محدد التاريخ') return -1;
                return sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
            });

            let monthTotalSize = 0;
            let monthTotalFiles = 0;

            const daysList = sortedDays.map(ymd => {
                const files = subMap.get(ymd) || [];
                const daySize = files.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
                monthTotalSize += daySize;
                monthTotalFiles += files.length;
                return {
                    dayKey: ymd,
                    title: ymd,
                    files,
                    size: daySize
                };
            });

            return {
                monthKey: ym,
                title: ym,
                days: daysList,
                totalFiles: monthTotalFiles,
                totalSize: monthTotalSize
            };
        });
    }, [displayedFiles, groupingMode, sortOrder, getEffectiveDate]);

    // Default: all groups collapsed (طي الكل افتراضياً)
    useEffect(() => {
        setExpandedGroups({});
    }, [groupingMode]);

    const toggleGroupExpand = (key: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const expandAllGroups = () => {
        const all: Record<string, boolean> = {};
        if (groupingMode === 'months') {
            monthGroups.forEach(g => { all[g.key] = true; });
        } else if (groupingMode === 'days') {
            dayGroups.forEach(g => { all[g.key] = true; });
        } else if (groupingMode === 'hierarchy') {
            hierarchyGroups.forEach(m => {
                all[m.monthKey] = true;
                m.days.forEach(d => { all[d.dayKey] = true; });
            });
        }
        setExpandedGroups(all);
    };

    const collapseAllGroups = () => {
        setExpandedGroups({});
    };

    const selectGroupFiles = (files: StorageItem[]) => {
        const fileNames = files.map(f => f.name);
        const allSelected = fileNames.every(name => selectedFileNames.includes(name));
        if (allSelected) {
            setSelectedFileNames(prev => prev.filter(name => !fileNames.includes(name)));
        } else {
            setSelectedFileNames(prev => Array.from(new Set([...prev, ...fileNames])));
        }
    };

    const handleDeleteGroup = (groupTitle: string, groupFiles: StorageItem[]) => {
        const groupSize = groupFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
        showConfirmModal({
            title: `حذف مجموعة (${groupTitle})`,
            message: `هل أنت متأكد من حذف جميع الملفات (${groupFiles.length} ملف بحجم إجمالي ${formatBytes(groupSize)}) الخاصة بالفترة "${groupTitle}"؟ لا يمكن التراجع عن هذا الإجراء.`,
            onConfirm: async () => {
                setIsCleaning(true);
                try {
                    const paths = groupFiles.map(f => getItemFullPath(f.name));
                    await executeBatchDelete(paths);
                    addNotification({
                        title: 'نجاح',
                        message: `تم حذف ملفات الفترة (${groupTitle}) بنجاح (${groupFiles.length} ملف).`,
                        type: 'success'
                    });
                    setSelectedFileNames(prev => prev.filter(name => !paths.some(p => p.endsWith(name))));
                    fetchPathContents(currentPath);
                } catch (err: any) {
                    console.error('Error deleting group files:', err);
                    addNotification({ title: 'خطأ', message: 'فشل حذف ملفات المجموعة: ' + err.message, type: 'error' });
                } finally {
                    setIsCleaning(false);
                }
            }
        });
    };

    const toggleSelect = (name: string) => {
        setSelectedFileNames(prev =>
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    const toggleSelectAll = () => {
        if (selectedFileNames.length > 0 && selectedFileNames.length === displayedFiles.length) {
            setSelectedFileNames([]);
        } else {
            setSelectedFileNames(displayedFiles.map(f => f.name));
        }
    };

    const getItemFullPath = (name: string) => {
        return currentPath ? `${currentPath}/${name}` : name;
    };

    // Helper: Execute array deletion in batches of 100
    const executeBatchDelete = async (filePaths: string[]) => {
        const batchSize = 100;
        for (let i = 0; i < filePaths.length; i += batchSize) {
            const batch = filePaths.slice(i, i + batchSize);
            const { error } = await supabase.storage.from('attached_files').remove(batch);
            if (error) throw error;
        }
    };

    // Single item deletion
    const handleDeleteSingle = (item: StorageItem) => {
        const fullPath = getItemFullPath(item.name);
        showConfirmModal({
            title: item.isFolder ? 'حذف مجلد' : 'حذف ملف',
            message: `هل أنت متأكد من حذف ${item.isFolder ? 'المجلد ومحتوياته' : 'الملف'} "${item.name}" نهائياً من الحاوية؟`,
            onConfirm: async () => {
                try {
                    const { error } = await supabase.storage.from('attached_files').remove([fullPath]);
                    if (error) throw error;
                    addNotification({ title: 'نجاح', message: `تم حذف ${item.name} بنجاح.`, type: 'success' });
                    fetchPathContents(currentPath);
                } catch (err: any) {
                    console.error('Delete error:', err);
                    addNotification({ title: 'خطأ', message: 'فشل حذف العنصر: ' + err.message, type: 'error' });
                }
            }
        });
    };

    // Bulk deletion of selected files
    const handleBulkDelete = () => {
        if (selectedFileNames.length === 0) {
            addNotification({ title: 'تنبيه', message: 'يرجى تحديد ملف واحد على الأقل للحذف.', type: 'warning' });
            return;
        }

        showConfirmModal({
            title: 'حذف الملفات المحددة',
            message: `هل أنت متأكد من حذف ${selectedFileNames.length} ملف نهائياً من المسار الحالي؟ لا يمكن التراجع عن هذا الإجراء!`,
            onConfirm: async () => {
                setIsCleaning(true);
                try {
                    const pathsToDelete = selectedFileNames.map(name => getItemFullPath(name));
                    await executeBatchDelete(pathsToDelete);

                    addNotification({
                        title: 'نجاح',
                        message: `تم حذف ${selectedFileNames.length} ملف بنجاح.`,
                        type: 'success'
                    });
                    setSelectedFileNames([]);
                    fetchPathContents(currentPath);
                } catch (err: any) {
                    console.error('Error deleting files:', err);
                    addNotification({ title: 'خطأ', message: 'فشل حذف بعض أو كل الملفات: ' + err.message, type: 'error' });
                } finally {
                    setIsCleaning(false);
                }
            }
        });
    };

    // Delete files by specific Date Range
    const handleDeleteDateRange = () => {
        if (!startDate || !endDate) {
            addNotification({
                title: 'تنبيه',
                message: 'يرجى تحديد تاريخ البداية وتاريخ النهاية أولاً.',
                type: 'warning'
            });
            return;
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        if (start > end) {
            addNotification({
                title: 'تنبيه',
                message: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية.',
                type: 'warning'
            });
            return;
        }

        // Find all files in the current folder that match the range
        const matchingFiles = items.filter(item => {
            if (item.isFolder || !item.created_at) return false;
            const fileDate = new Date(item.created_at);
            return fileDate >= start && fileDate <= end;
        });

        if (matchingFiles.length === 0) {
            addNotification({
                title: 'تنبيه',
                message: 'لا توجد أي ملفات واقعة في هذه الفترة الزمنية داخل المسار الحالي.',
                type: 'info'
            });
            return;
        }

        const matchingSize = matchingFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);

        showConfirmModal({
            title: 'تأكيد الحذف بنطاق زمني',
            message: `هل أنت متأكد من حذف ${matchingFiles.length} ملف بحجم إجمالي (${formatBytes(matchingSize)})، المحصورة بين ${startDate} و ${endDate} في المسار الحالي (${currentPath || 'الجذر'})؟ هذا الإجراء لا يمكن التراجع عنه!`,
            onConfirm: async () => {
                setIsCleaning(true);
                try {
                    const pathsToDelete = matchingFiles.map(f => getItemFullPath(f.name));
                    await executeBatchDelete(pathsToDelete);

                    addNotification({
                        title: 'تم الحذف بنجاح',
                        message: `تم حذف ${matchingFiles.length} ملف بنجاح وتوفير ${formatBytes(matchingSize)}.`,
                        type: 'success'
                    });
                    setSelectedFileNames([]);
                    fetchPathContents(currentPath);
                } catch (err: any) {
                    console.error('Range delete error:', err);
                    addNotification({ title: 'خطأ', message: 'فشل حذف بعض الملفات: ' + err.message, type: 'error' });
                } finally {
                    setIsCleaning(false);
                }
            }
        });
    };

    // Preview file
    const handlePreview = (fileName: string) => {
        const fullPath = getItemFullPath(fileName);
        const { data } = supabase.storage.from('attached_files').getPublicUrl(fullPath);
        if (data?.publicUrl) {
            setPreviewImage({ url: data.publicUrl, name: fileName });
        }
    };

    // Download file
    const handleDownload = async (fileName: string) => {
        const fullPath = getItemFullPath(fileName);
        try {
            const { data, error } = await supabase.storage.from('attached_files').download(fullPath);
            if (error) throw error;
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error('Download error:', err);
            addNotification({ title: 'خطأ', message: 'فشل تنزيل الملف.', type: 'error' });
        }
    };

    // Render Table Rows for a given file list
    const renderFilesTable = (fileList: StorageItem[]) => {
        return (
            <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 text-xs font-bold border-b border-slate-200/60 dark:border-slate-800">
                    <tr>
                        <th className="p-3 w-10 text-center"></th>
                        <th className="p-3">اسم الملف</th>
                        <th className="p-3 hidden sm:table-cell cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                            <div className="flex items-center gap-1">
                                <span>{dateBasis === 'request_date' ? 'تاريخ الطلب' : 'تاريخ الرفع'} (YYYY-MM-DD HH:mm)</span>
                                <span className="text-indigo-600 font-bold">{sortOrder === 'desc' ? '⬇' : '⬆'}</span>
                            </div>
                        </th>
                        <th className="p-3">الحجم</th>
                        <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                    {fileList.map(file => {
                        const isSelected = selectedFileNames.includes(file.name);
                        const reqNum = extractRequestNumber(file.name);
                        const hasRequestDate = Boolean(reqNum && requestDatesMap[reqNum]);
                        const effectiveDate = getEffectiveDate(file);

                        return (
                            <tr
                                key={file.name}
                                className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}`}
                            >
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelect(file.name)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800"
                                    />
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500">
                                            <ImageIcon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate block max-w-[150px] sm:max-w-xs md:max-w-sm" title={file.name}>
                                                {file.name}
                                            </span>
                                            {reqNum && (
                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                                                    طلب #{reqNum}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-3 whitespace-nowrap hidden sm:table-cell font-mono text-xs text-slate-600 dark:text-slate-400">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5" dir="ltr">
                                            <span>{formatEnglishDate(effectiveDate)}</span>
                                            {dateBasis === 'request_date' && hasRequestDate && (
                                                <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                                                    تاريخ الطلب
                                                </span>
                                            )}
                                        </div>
                                        {dateBasis === 'request_date' && hasRequestDate && (
                                            <span className="text-[10px] text-slate-400" dir="ltr">
                                                رفع: {formatEnglishDate(file.created_at)}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-3 whitespace-nowrap text-xs font-bold text-slate-600 dark:text-slate-400">
                                    {formatBytes(file.metadata?.size || 0)}
                                </td>
                                <td className="p-3 whitespace-nowrap text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <button
                                            onClick={() => handlePreview(file.name)}
                                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title="معاينة"
                                        >
                                            <EyeIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDownload(file.name)}
                                            className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title="تنزيل"
                                        >
                                            <DownloadIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSingle(file)}
                                            className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title="حذف"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    const breadcrumbs = currentPath ? currentPath.split('/') : [];

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <DatabaseIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                إدارة تخزين الملفات المرفقة
                            </h2>
                            <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-md">
                                attached_files
                            </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-2xl text-sm">
                            استعراض واستكشاف كافة المجلدات والملفات داخل حاوية التخزين <code>attached_files</code>، مع الترتيب الزمني والحذف المخصص من مدة إلى مدة.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => fetchPathContents(currentPath)}
                        disabled={isFetching || isCleaning}
                        className="shadow-sm"
                    >
                        <RefreshCwIcon className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                        تحديث القائمة
                    </Button>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Search & Filters Sidebar */}
                <div className="lg:col-span-1 space-y-5">
                    {/* Search Input */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <Icon name="search" className="w-4 h-4 text-indigo-500" />
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">البحث والتصفية</h3>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1.5">بحث باسم الملف أو المجلد:</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ابحث بالاسم..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <Icon name="close" className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filter & Delete by date */}
                        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-xs font-bold text-slate-500 block">تصفية الملفات حسب التاريخ:</label>
                            
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                                <button
                                    onClick={() => setFilterType('all')}
                                    className={`flex-1 py-1.5 rounded-lg transition-all ${filterType === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                                >
                                    الكل
                                </button>
                                <button
                                    onClick={() => setFilterType('older')}
                                    className={`flex-1 py-1.5 rounded-lg transition-all ${filterType === 'older' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                                >
                                    أقدم من
                                </button>
                                <button
                                    onClick={() => setFilterType('range')}
                                    className={`flex-1 py-1.5 rounded-lg transition-all ${filterType === 'range' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                                >
                                    نطاق
                                </button>
                            </div>

                            {filterType === 'older' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs text-slate-500 block">احتفاظ بملفات آخر:</label>
                                    <select
                                        value={daysToKeep}
                                        onChange={(e) => setDaysToKeep(Number(e.target.value))}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:ring-indigo-500"
                                    >
                                        <option value={7}>7 أيام</option>
                                        <option value={15}>15 يوم</option>
                                        <option value={30}>شهر (30 يوم)</option>
                                        <option value={60}>شهران (60 يوم)</option>
                                        <option value={90}>3 أشهر (90 يوم)</option>
                                    </select>
                                </div>
                            )}

                            {filterType === 'range' && (
                                <div className="space-y-3 pt-1">
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-[11px] text-slate-500 block mb-1">من تاريخ (البداية):</label>
                                            <CustomDatePicker value={startDate} onChange={setStartDate} className="w-full" placeholder="YYYY-MM-DD" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] text-slate-500 block mb-1">إلى تاريخ (النهاية):</label>
                                            <CustomDatePicker value={endDate} onChange={setEndDate} className="w-full" placeholder="YYYY-MM-DD" />
                                        </div>
                                    </div>

                                    {/* Direct Button: Delete by Date Range */}
                                    <button
                                        type="button"
                                        onClick={handleDeleteDateRange}
                                        disabled={isCleaning || !startDate || !endDate}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                        حذف الملفات في هذه الفترة
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Quick Navigation Shortcuts */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-xs font-bold text-slate-500 block mb-2">اختصارات المجلدات الشائعة:</label>
                            <div className="space-y-1.5">
                                <button
                                    onClick={() => setCurrentPath('')}
                                    className={`w-full text-right px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${currentPath === '' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                >
                                    <span className="flex items-center gap-2">
                                        <DatabaseIcon className="w-3.5 h-3.5 text-indigo-500" />
                                        الجذر (Root)
                                    </span>
                                    <span className="text-[10px] opacity-70">/</span>
                                </button>
                                <button
                                    onClick={() => setCurrentPath('drafts')}
                                    className={`w-full text-right px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${currentPath === 'drafts' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                >
                                    <span className="flex items-center gap-2">
                                        <FolderOpenIcon className="w-3.5 h-3.5 text-amber-500" />
                                        المسودات (drafts)
                                    </span>
                                </button>
                                <button
                                    onClick={() => setCurrentPath('colored_attachments')}
                                    className={`w-full text-right px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${currentPath === 'colored_attachments' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                >
                                    <span className="flex items-center gap-2">
                                        <FolderOpenIcon className="w-3.5 h-3.5 text-emerald-500" />
                                        المرفقات الملونة (colored)
                                    </span>
                                </button>
                                <button
                                    onClick={() => setCurrentPath('pdf_extracts')}
                                    className={`w-full text-right px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${currentPath === 'pdf_extracts' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                >
                                    <span className="flex items-center gap-2">
                                        <FolderOpenIcon className="w-3.5 h-3.5 text-sky-500" />
                                        مستخرجات الـ PDF
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* File Explorer Main Area */}
                <div className="lg:col-span-3">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-[580px]">
                        {/* Breadcrumbs & Path Navigation Bar */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
                            {/* Breadcrumb Links */}
                            <div className="flex items-center flex-wrap gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                                <button
                                    onClick={() => handleNavigateBreadcrumb(-1, breadcrumbs)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${currentPath === '' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold' : 'hover:bg-slate-200/70 dark:hover:bg-slate-800'}`}
                                    title="الانتقال إلى جذر الحاوية"
                                >
                                    <DatabaseIcon className="w-4 h-4 text-indigo-500" />
                                    <span>attached_files</span>
                                </button>

                                {breadcrumbs.map((segment, idx) => (
                                    <React.Fragment key={idx}>
                                        <span className="text-slate-400">/</span>
                                        <button
                                            onClick={() => handleNavigateBreadcrumb(idx, breadcrumbs)}
                                            className={`px-2 py-1 rounded-lg transition-colors ${idx === breadcrumbs.length - 1 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold' : 'hover:bg-slate-200/70 dark:hover:bg-slate-800'}`}
                                        >
                                            {segment}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* Sort Controls & Stats */}
                            <div className="flex items-center gap-3">
                                {/* Sort Order Selector */}
                                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                                    <span className="text-slate-400 font-semibold">ترتيب التاريخ:</span>
                                    <button
                                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                        className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                                        title={sortOrder === 'desc' ? 'من الأحدث إلى الأقدم (انقر للتبديل)' : 'من الأقدم إلى الأحدث (انقر للتبديل)'}
                                    >
                                        <span>{sortOrder === 'desc' ? 'الأحدث أولاً ⬇' : 'الأقدم أولاً ⬆'}</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold border-r border-slate-200 dark:border-slate-700 pr-3">
                                    <span>{displayedFolders.length} مجلد</span>
                                    <span>•</span>
                                    <span>{displayedFiles.length} ملف</span>
                                    <span>•</span>
                                    <span>{formatBytes(totalFilesSize)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Content Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                            {isFetching ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-indigo-500 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-10">
                                    <RefreshCwIcon className="w-10 h-10 animate-spin mb-3 text-indigo-500" />
                                    <h4 className="font-bold text-slate-700 dark:text-slate-300">جاري قراءة الملفات والمجلدات...</h4>
                                    <p className="text-xs text-slate-400 mt-1">يتم فحص محتويات {currentPath || 'الجذر'}</p>
                                </div>
                            ) : null}

                            {filteredAndSortedItems.length === 0 && !isFetching ? (
                                <div className="p-16 flex flex-col items-center justify-center text-center text-slate-400">
                                    <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
                                        <FolderOpenIcon className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                                    </div>
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300 text-lg mb-1">المجلد فارغ</h3>
                                    <p className="text-sm max-w-sm">لا توجد ملفات أو مجلدات تطابق معايير البحث الحالية في هذا المسار.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {/* Folders Section */}
                                    {displayedFolders.length > 0 && (
                                        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">المجلدات</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                {displayedFolders.map(folder => (
                                                    <div
                                                        key={folder.name}
                                                        onClick={() => handleOpenFolder(folder.name)}
                                                        className="group flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 cursor-pointer transition-all shadow-sm"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                                <FolderOpenIcon className="w-5 h-5" />
                                                            </div>
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate" title={folder.name}>
                                                                {folder.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-slate-400 group-hover:text-indigo-600">
                                                            <Icon name="chevron-left" className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Files Table / Accordion Section */}
                                    {displayedFiles.length > 0 && (
                                        <div>
                                            {/* Sub-bar for Grouping Controls and Selection */}
                                            <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFileNames.length === displayedFiles.length && displayedFiles.length > 0}
                                                        onChange={toggleSelectAll}
                                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800"
                                                    />
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                        تحديد الكل ({selectedFileNames.length} من {displayedFiles.length})
                                                    </span>
                                                </div>

                                                {/* Date Basis Toggle: Request Date vs Upload Date */}
                                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                                                    <span className="text-[11px] text-slate-400 px-2">الاعتماد على:</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDateBasis('request_date')}
                                                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${dateBasis === 'request_date' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                                        title="تجميع وفرز الملفات بناءً على تاريخ إنشاء الطلب (Req-XXXX)"
                                                    >
                                                        <span>تاريخ الطلب (الافتراضي)</span>
                                                        {isLoadingRequestDates && <RefreshCwIcon className="w-3 h-3 animate-spin text-indigo-500" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDateBasis('upload_date')}
                                                        className={`px-2.5 py-1 rounded-lg transition-all ${dateBasis === 'upload_date' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                                        title="تجميع وفرز الملفات بناءً على تاريخ رفع الملف"
                                                    >
                                                        <span>تاريخ الرفع</span>
                                                    </button>
                                                </div>

                                                {/* Grouping Mode Pill Switcher */}
                                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                                                    <span className="text-[11px] text-slate-400 px-2">تجميع حسب:</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setGroupingMode('none')}
                                                        className={`px-2.5 py-1 rounded-lg transition-all ${groupingMode === 'none' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                                    >
                                                        بدون تجميع
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setGroupingMode('months')}
                                                        className={`px-2.5 py-1 rounded-lg transition-all ${groupingMode === 'months' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                                    >
                                                        بالأشهر
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setGroupingMode('days')}
                                                        className={`px-2.5 py-1 rounded-lg transition-all ${groupingMode === 'days' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                                    >
                                                        بالأيام
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setGroupingMode('hierarchy')}
                                                        className={`px-2.5 py-1 rounded-lg transition-all ${groupingMode === 'hierarchy' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                                    >
                                                        أشهر وأيام معاً
                                                    </button>
                                                </div>

                                                {/* Expand / Collapse All */}
                                                {groupingMode !== 'none' && (
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <button
                                                            type="button"
                                                            onClick={expandAllGroups}
                                                            className="px-2 py-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                                                        >
                                                            توسيع الكل
                                                        </button>
                                                        <span className="text-slate-300 dark:text-slate-700">|</span>
                                                        <button
                                                            type="button"
                                                            onClick={collapseAllGroups}
                                                            className="px-2 py-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                                                        >
                                                            طي الكل
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Render Mode: None (Flat List) */}
                                            {groupingMode === 'none' && (
                                                renderFilesTable(displayedFiles)
                                            )}

                                            {/* Render Mode: Group by Months */}
                                            {groupingMode === 'months' && (
                                                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                                    {monthGroups.map(group => {
                                                        const isExpanded = !!expandedGroups[group.key];
                                                        const groupSelectedCount = group.files.filter(f => selectedFileNames.includes(f.name)).length;
                                                        const allGroupSelected = groupSelectedCount === group.files.length;

                                                        return (
                                                            <div key={group.key} className="transition-colors">
                                                                {/* Accordion Group Header */}
                                                                <div
                                                                    onClick={() => toggleGroupExpand(group.key)}
                                                                    className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/50 dark:border-slate-800 transition-all select-none"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="text-slate-400 transition-transform duration-200">
                                                                            <Icon
                                                                                name={isExpanded ? 'chevron-down' : 'chevron-left'}
                                                                                className="w-4 h-4 text-slate-500"
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                                                                📅 {group.title}
                                                                            </span>
                                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                                                                {group.files.length} ملف
                                                                            </span>
                                                                            <span className="text-xs text-slate-400">
                                                                                ({formatBytes(group.size)})
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => selectGroupFiles(group.files)}
                                                                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${allGroupSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                                                        >
                                                                            {allGroupSelected ? 'إلغاء تحديد المجموعة' : 'تحديد ملفات الشهر'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteGroup(group.title, group.files)}
                                                                            className="text-xs px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 font-medium transition-colors flex items-center gap-1"
                                                                            title="حذف جميع ملفات هذا الشهر"
                                                                        >
                                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                                            حذف الشهر
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Accordion Content */}
                                                                {isExpanded && (
                                                                    <div className="bg-white dark:bg-slate-900/50">
                                                                        {renderFilesTable(group.files)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Render Mode: Group by Days */}
                                            {groupingMode === 'days' && (
                                                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                                    {dayGroups.map(group => {
                                                        const isExpanded = !!expandedGroups[group.key];
                                                        const groupSelectedCount = group.files.filter(f => selectedFileNames.includes(f.name)).length;
                                                        const allGroupSelected = groupSelectedCount === group.files.length;

                                                        return (
                                                            <div key={group.key} className="transition-colors">
                                                                {/* Accordion Group Header */}
                                                                <div
                                                                    onClick={() => toggleGroupExpand(group.key)}
                                                                    className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/50 dark:border-slate-800 transition-all select-none"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="text-slate-400 transition-transform duration-200">
                                                                            <Icon
                                                                                name={isExpanded ? 'chevron-down' : 'chevron-left'}
                                                                                className="w-4 h-4 text-slate-500"
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                                                                🗓️ {group.title}
                                                                            </span>
                                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                                                                {group.files.length} ملف
                                                                            </span>
                                                                            <span className="text-xs text-slate-400">
                                                                                ({formatBytes(group.size)})
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => selectGroupFiles(group.files)}
                                                                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${allGroupSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                                                        >
                                                                            {allGroupSelected ? 'إلغاء تحديد اليوم' : 'تحديد ملفات اليوم'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteGroup(group.title, group.files)}
                                                                            className="text-xs px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 font-medium transition-colors flex items-center gap-1"
                                                                            title="حذف جميع ملفات هذا اليوم"
                                                                        >
                                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                                            حذف اليوم
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Accordion Content */}
                                                                {isExpanded && (
                                                                    <div className="bg-white dark:bg-slate-900/50">
                                                                        {renderFilesTable(group.files)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Render Mode: Hierarchy (Month -> Days -> Files) */}
                                            {groupingMode === 'hierarchy' && (
                                                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                                    {hierarchyGroups.map(monthGroup => {
                                                        const isMonthExpanded = !!expandedGroups[monthGroup.monthKey];
                                                        const monthFiles = monthGroup.days.flatMap(d => d.files);
                                                        const monthSelectedCount = monthFiles.filter(f => selectedFileNames.includes(f.name)).length;
                                                        const allMonthSelected = monthSelectedCount === monthFiles.length;

                                                        return (
                                                            <div key={monthGroup.monthKey} className="bg-white dark:bg-slate-900">
                                                                {/* Month Header */}
                                                                <div
                                                                    onClick={() => toggleGroupExpand(monthGroup.monthKey)}
                                                                    className="px-4 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 cursor-pointer flex flex-wrap items-center justify-between gap-3 select-none transition-colors border-b border-slate-200 dark:border-slate-700"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <Icon
                                                                            name={isMonthExpanded ? 'chevron-down' : 'chevron-left'}
                                                                            className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                                                                        />
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                                                                                📁 {monthGroup.title}
                                                                            </span>
                                                                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                                                                                {monthGroup.days.length} يوم ({monthGroup.totalFiles} ملف)
                                                                            </span>
                                                                            <span className="text-xs text-slate-500 font-semibold">
                                                                                {formatBytes(monthGroup.totalSize)}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => selectGroupFiles(monthFiles)}
                                                                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${allMonthSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50'}`}
                                                                        >
                                                                            {allMonthSelected ? 'إلغاء تحديد الشهر' : 'تحديد كامل الشهر'}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteGroup(monthGroup.title, monthFiles)}
                                                                            className="text-xs px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 font-medium transition-colors flex items-center gap-1"
                                                                            title="حذف جميع ملفات هذا الشهر"
                                                                        >
                                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                                            حذف الشهر بالكامل
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Month Days Sub-accordions */}
                                                                {isMonthExpanded && (
                                                                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60 pr-4">
                                                                        {monthGroup.days.map(dayGroup => {
                                                                            const isDayExpanded = !!expandedGroups[dayGroup.dayKey];
                                                                            const daySelectedCount = dayGroup.files.filter(f => selectedFileNames.includes(f.name)).length;
                                                                            const allDaySelected = daySelectedCount === dayGroup.files.length;

                                                                            return (
                                                                                <div key={dayGroup.dayKey}>
                                                                                    {/* Day Sub-header */}
                                                                                    <div
                                                                                        onClick={() => toggleGroupExpand(dayGroup.dayKey)}
                                                                                        className="px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/30 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer flex flex-wrap items-center justify-between gap-3 select-none transition-colors border-r-2 border-r-indigo-500"
                                                                                    >
                                                                                        <div className="flex items-center gap-2.5">
                                                                                            <Icon
                                                                                                name={isDayExpanded ? 'chevron-down' : 'chevron-left'}
                                                                                                className="w-3.5 h-3.5 text-slate-400"
                                                                                            />
                                                                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">
                                                                                                🗓️ {dayGroup.title}
                                                                                            </span>
                                                                                            <span className="text-[11px] text-slate-500">
                                                                                                ({dayGroup.files.length} ملف • {formatBytes(dayGroup.size)})
                                                                                            </span>
                                                                                        </div>

                                                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => selectGroupFiles(dayGroup.files)}
                                                                                                className={`text-[11px] px-2 py-0.5 rounded border font-medium transition-colors ${allDaySelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30' : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                                                            >
                                                                                                {allDaySelected ? 'إلغاء' : 'تحديد اليوم'}
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => handleDeleteGroup(dayGroup.title, dayGroup.files)}
                                                                                                className="text-[11px] px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors flex items-center gap-1"
                                                                                                title="حذف ملفات هذا اليوم"
                                                                                            >
                                                                                                <TrashIcon className="w-3 h-3" />
                                                                                                حذف
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Day Files Table */}
                                                                                    {isDayExpanded && (
                                                                                        <div className="bg-white dark:bg-slate-900 pr-2">
                                                                                            {renderFilesTable(dayGroup.files)}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Bottom Floating Actions Bar */}
                        {displayedFiles.length > 0 && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs font-bold text-slate-500">
                                    المحدد للحذف: {selectedFileNames.length} ملف ({formatBytes(displayedFiles.filter(f => selectedFileNames.includes(f.name)).reduce((acc, f) => acc + (f.metadata?.size || 0), 0))})
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <Button
                                        variant="danger"
                                        onClick={handleBulkDelete}
                                        disabled={isCleaning || selectedFileNames.length === 0}
                                        className="w-full sm:w-auto shadow-sm shadow-red-500/20"
                                    >
                                        {isCleaning ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <TrashIcon className="w-4 h-4" />}
                                        حذف الملفات المحددة ({selectedFileNames.length})
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-4 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <h4 className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-md">
                                {previewImage.name}
                            </h4>
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <Icon name="close" className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden max-h-[70vh]">
                            <img
                                src={previewImage.url}
                                alt={previewImage.name}
                                className="object-contain max-h-[70vh] w-auto rounded-lg"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="secondary" onClick={() => handleDownload(previewImage.name)}>
                                <DownloadIcon className="w-4 h-4" />
                                تحميل الملف
                            </Button>
                            <Button variant="primary" onClick={() => setPreviewImage(null)}>
                                إغلاق
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StorageManagement;
