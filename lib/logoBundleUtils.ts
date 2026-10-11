import JSZip from 'jszip';
import { CarMake } from '../types';
import { supabase } from './supabaseClient';
import { ensureBucketExists, urlToBase64Safe } from './storageUtils';

export interface LogoBundleProgress {
    current: number;
    total: number;
    percent: number;
    currentStep: string;
    itemTypeLabel?: string;
}

export interface LogoImportResult {
    uploadedCount: number;
    matchedCount: number;
    totalFiles: number;
    unmatchedNames: string[];
}

export interface LogoManifestItem {
    make_id: string;
    name_en: string;
    name_ar: string;
    fileName: string;
    original_url?: string;
}

/**
 * Normalizes and guarantees valid standard image MIME type and file extension.
 * Inspects Magic Bytes first, then SVG XML tags, then extension fallback.
 */
export function detectMimeAndExtFromBuffer(buffer: Uint8Array, fileNameHint: string = ''): { mimeType: string; ext: string } {
    // 1. Magic Bytes inspection
    if (buffer.length >= 8) {
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
            return { mimeType: 'image/png', ext: 'png' };
        }
        // JPEG: FF D8 FF
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            return { mimeType: 'image/jpeg', ext: 'jpg' };
        }
        // GIF: 47 49 46 38 ('GIF8')
        if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
            return { mimeType: 'image/gif', ext: 'gif' };
        }
        // WEBP: 'RIFF'....'WEBP'
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
                return { mimeType: 'image/webp', ext: 'webp' };
            }
        }
    }

    // 2. SVG XML inspection
    try {
        const textSample = new TextDecoder('utf-8').decode(buffer.subarray(0, 512)).trim().toLowerCase();
        if (textSample.includes('<svg') || (textSample.includes('<?xml') && textSample.includes('<svg'))) {
            return { mimeType: 'image/svg+xml', ext: 'svg' };
        }
    } catch {
        // Fall through to extension check
    }

    // 3. Fallback to file extension
    const cleanExt = fileNameHint.toLowerCase().split('?')[0].split('#')[0].split('.').pop() || '';
    switch (cleanExt) {
        case 'jpg':
        case 'jpeg':
            return { mimeType: 'image/jpeg', ext: 'jpg' };
        case 'png':
            return { mimeType: 'image/png', ext: 'png' };
        case 'webp':
            return { mimeType: 'image/webp', ext: 'webp' };
        case 'svg':
        case 'svgz':
            return { mimeType: 'image/svg+xml', ext: 'svg' };
        case 'gif':
            return { mimeType: 'image/gif', ext: 'gif' };
        case 'ico':
            return { mimeType: 'image/x-icon', ext: 'ico' };
        case 'bmp':
            return { mimeType: 'image/bmp', ext: 'bmp' };
        case 'avif':
            return { mimeType: 'image/avif', ext: 'avif' };
        default:
            return { mimeType: 'image/png', ext: 'png' };
    }
}

/**
 * Normalizes an Arabic string by unifying letters and removing diacritics
 */
export function normalizeArabicText(text: string): string {
    if (!text) return '';
    return text
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F]/g, '') // remove harakat/tashkeel
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Normalizes a brand name or file name for fuzzy matching
 */
export function normalizeBrandName(name: string): string {
    if (!name) return '';
    return name
        .replace(/\.[^/.]+$/, '') // remove extension
        .replace(/^(make_|logo_|car_|brand_|\d+[-_])/i, '') // remove common prefixes
        .replace(/(_logo|_icon|_badge|_\d{6,}|\blogo\b|\bicon\b)/gi, '') // remove common suffixes/timestamps
        .replace(/[_\-+()\[\]]/g, ' ') // replace symbols with space
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// Comprehensive brand alias dictionary
const BRAND_ALIASES: Record<string, string[]> = {
    'vw': ['volkswagen', 'فولكس واجن', 'فولكسفاغن', 'فولكس'],
    'volkswagen': ['vw', 'فولكس واجن', 'فولكسفاغن', 'فولكس'],
    'chevy': ['chevrolet', 'شفروليه', 'شيفروليه', 'شفر'],
    'chevrolet': ['chevy', 'شفروليه', 'شيفروليه', 'شفر'],
    'merc': ['mercedes', 'mercedes-benz', 'مرسيدس', 'مرسيدس بنز'],
    'benz': ['mercedes', 'mercedes-benz', 'مرسيدس', 'مرسيدس بنز'],
    'mercedes': ['mercedes-benz', 'مرسيدس', 'مرسيدس بنز'],
    'mercedes-benz': ['mercedes', 'مرسيدس', 'مرسيدس بنز'],
    'bimmer': ['bmw', 'بي ام دبليو', 'بي ام'],
    'bmw': ['بي ام دبليو', 'بي ام'],
    'alfa': ['alfa romeo', 'ألفا روميو', 'الفا روميو'],
    'rr': ['rolls royce', 'rolls-royce', 'رولز رويس'],
    'gmc': ['جمس', 'جي ام سي', 'gmc'],
    'toyota': ['تويوتا'],
    'lexus': ['لكزس', 'لكسز'],
    'nissan': ['نيسان'],
    'infiniti': ['انفينيتي', 'إنفينيتي'],
    'hyundai': ['هيونداي', 'هيونداى'],
    'kia': ['كيا'],
    'genesis': ['جينيسيس', 'جينسس'],
    'ford': ['فورد'],
    'lincoln': ['لينكون', 'لينكولن'],
    'mazda': ['مازدا'],
    'honda': ['هوندا'],
    'mitsubishi': ['ميتسوبيشي', 'متسوبيشي'],
    'subaru': ['سوبارو'],
    'suzuki': ['سوزوكي'],
    'isuzu': ['ايسوزو', 'إيسوزو'],
    'jeep': ['جيب'],
    'dodge': ['دودج'],
    'chrysler': ['كرايسلر'],
    'cadillac': ['كاديلاك'],
    'audi': ['اودي', 'أودي'],
    'porsche': ['بورشه', 'بورش'],
    'ferrari': ['فيراري'],
    'lamborghini': ['لامبورغيني', 'لامبورجيني'],
    'maserati': ['مازيراتي', 'مازراتي'],
    'bentley': ['بنتلي'],
    'aston martin': ['استون مارتن', 'أستون مارتن'],
    'land rover': ['لاند روفر', 'لاندروفر'],
    'range rover': ['رينج روفر', 'رنج روفر'],
    'jaguar': ['جاكوار', 'جغوار'],
    'volvo': ['فولفو'],
    'peugeot': ['بيجو'],
    'renault': ['رينو'],
    'citroen': ['ستروين', 'سيتروين'],
    'fiat': ['فيات'],
    'skoda': ['سكودا'],
    'seat': ['سيات'],
    'changan': ['شانجان'],
    'geely': ['جيلي'],
    'mg': ['ام جي', 'إم جي'],
    'haval': ['هافال'],
    'great wall': ['جريت وول', 'جريت ول'],
    'chery': ['شيري'],
    'jac': ['جاك'],
    'byd': ['بي واي دي', 'بي واى دي'],
    'jetour': ['جيتور'],
    'hongqi': ['هونغشي', 'هونشي'],
    'lucid': ['لوسيد'],
    'tesla': ['تسلا'],
    'tank': ['تانك'],
    'exeed': ['اكسيد', 'إكسيد'],
    'baic': ['بايك'],
    'maxus': ['ماكسوس'],
    'gac': ['جي ايه سي', 'جاك موتورز']
};

/**
 * Matches a filename or brand name to existing car make(s)
 */
export function matchLogoToCarMakes(rawName: string, carMakes: CarMake[]): CarMake[] {
    if (!rawName || carMakes.length === 0) return [];

    const clean = normalizeBrandName(rawName);
    const compactClean = clean.replace(/[^a-z0-9]/g, '');
    const cleanAr = normalizeArabicText(clean);
    const compactCleanAr = cleanAr.replace(/\s+/g, '');

    const matched: CarMake[] = [];

    // 1. Exact match on English or Arabic name
    for (const make of carMakes) {
        const en = (make.name_en || '').toLowerCase().trim();
        const ar = (make.name_ar || '').trim();
        const normAr = normalizeArabicText(ar);

        if (en === clean || ar === clean || normAr === cleanAr) {
            if (!matched.some(m => m.id === make.id)) matched.push(make);
        }
    }
    if (matched.length > 0) return matched;

    // 2. Compact match (ignoring spaces & hyphens)
    for (const make of carMakes) {
        const compactEn = (make.name_en || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const compactAr = normalizeArabicText(make.name_ar || '').replace(/\s+/g, '');

        if (compactEn && compactClean && compactEn === compactClean) {
            if (!matched.some(m => m.id === make.id)) matched.push(make);
        }
        if (compactAr && (compactAr === compactCleanAr || compactAr === compactClean)) {
            if (!matched.some(m => m.id === make.id)) matched.push(make);
        }
    }
    if (matched.length > 0) return matched;

    // 3. Known aliases check
    for (const [alias, targets] of Object.entries(BRAND_ALIASES)) {
        if (clean === alias || cleanAr === alias || compactClean === alias.replace(/[^a-z0-9]/g, '')) {
            for (const make of carMakes) {
                const en = (make.name_en || '').toLowerCase();
                const ar = normalizeArabicText(make.name_ar || '');
                const matchesTarget = targets.some(t => 
                    en === t || 
                    en.includes(t) || 
                    ar === normalizeArabicText(t) || 
                    ar.includes(normalizeArabicText(t))
                );
                if (matchesTarget) {
                    if (!matched.some(m => m.id === make.id)) matched.push(make);
                }
            }
            if (matched.length > 0) return matched;
        }
    }

    // 4. Substring inclusion if name is sufficiently distinctive (>= 3 chars)
    if (clean.length >= 3) {
        for (const make of carMakes) {
            const en = (make.name_en || '').toLowerCase().trim();
            const ar = normalizeArabicText(make.name_ar || '').trim();

            if (en.length >= 3 && (clean.includes(en) || en.includes(clean))) {
                if (!matched.some(m => m.id === make.id)) matched.push(make);
            }
            if (ar.length >= 3 && (cleanAr.includes(ar) || ar.includes(cleanAr))) {
                if (!matched.some(m => m.id === make.id)) matched.push(make);
            }
        }
    }

    return matched;
}

/**
 * Legacy single-make matcher for backward compatibility
 */
export function matchLogoToCarMake(rawName: string, carMakes: CarMake[]): CarMake | null {
    const results = matchLogoToCarMakes(rawName, carMakes);
    return results.length > 0 ? results[0] : null;
}

/**
 * Exports all car logos into a packaged ZIP archive with a manifest.json
 */
export async function exportCarLogosBundle(
    carMakes: CarMake[],
    onProgress?: (progress: LogoBundleProgress) => void
): Promise<{ count: number; zipBlob: Blob; fileName: string }> {
    const makesWithLogos = carMakes.filter(m => m.logo_url && m.logo_url.trim() !== '');
    const total = makesWithLogos.length;
    const zip = new JSZip();
    const manifestItems: LogoManifestItem[] = [];

    onProgress?.({
        current: 0,
        total,
        percent: 5,
        currentStep: `بدء تجهيز حزمة الشعارات (${total} شركة تحتوي على شعارات)...`,
        itemTypeLabel: 'شعار',
    });

    let processedCount = 0;

    for (let i = 0; i < total; i++) {
        const make = makesWithLogos[i];
        const makeLabel = make.name_ar || make.name_en || `شركة ${i + 1}`;

        onProgress?.({
            current: i + 1,
            total,
            percent: 5 + Math.round(((i + 1) / total) * 75),
            currentStep: `جاري تحميل وحزم شعار: ${makeLabel}...`,
            itemTypeLabel: 'شعار',
        });

        let fileBuffer: Uint8Array | null = null;
        let mimeType = 'image/png';
        let ext = 'png';

        // 1. Try direct fetch
        try {
            const response = await fetch(make.logo_url!);
            if (response.ok) {
                const ab = await response.arrayBuffer();
                fileBuffer = new Uint8Array(ab);
            }
        } catch {
            // Fall through to safe proxy
        }

        // 2. If direct fetch failed, try safe URL-to-Base64 proxy chain
        if (!fileBuffer) {
            try {
                const b64 = await urlToBase64Safe(make.logo_url!);
                if (b64) {
                    const parts = b64.split(',');
                    const bstr = atob(parts[1] || '');
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    fileBuffer = u8arr;
                }
            } catch (err) {
                console.warn(`Could not fetch logo for ${make.name_en}:`, err);
            }
        }

        if (fileBuffer && fileBuffer.length > 0) {
            // Accurately detect MIME type and clean extension
            const detected = detectMimeAndExtFromBuffer(fileBuffer, make.logo_url || make.name_en || 'logo.png');
            mimeType = detected.mimeType;
            ext = detected.ext;

            const safeNameEn = (make.name_en || `make_${make.id.slice(0, 6)}`)
                .replace(/[^a-zA-Z0-9]/g, '_')
                .toLowerCase();
            const fileName = `${safeNameEn}.${ext}`;

            // Add the binary data directly to the zip with explicit mime
            zip.file(fileName, fileBuffer, { binary: true });

            manifestItems.push({
                make_id: make.id,
                name_en: make.name_en || '',
                name_ar: make.name_ar || '',
                fileName,
                original_url: make.logo_url
            });

            processedCount++;
        }
    }

    // Add manifest.json to the archive
    const manifestData = {
        version: '1.0',
        type: 'car_logos_bundle',
        created_at: new Date().toISOString(),
        total_logos: manifestItems.length,
        items: manifestItems
    };
    zip.file('manifest.json', JSON.stringify(manifestData, null, 2));

    onProgress?.({
        current: total,
        total,
        percent: 85,
        currentStep: 'جاري ضغط وحزم ملف ZIP النهائي...',
        itemTypeLabel: 'شعار',
    });

    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    }, (metadata) => {
        onProgress?.({
            current: total,
            total,
            percent: 85 + Math.round(metadata.percent * 0.14),
            currentStep: `جاري ضغط وتجهيز ملف ZIP (${Math.round(metadata.percent)}%)...`,
            itemTypeLabel: 'شعار',
        });
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `car_logos_bundle_${dateStr}.zip`;

    // Trigger browser download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    onProgress?.({
        current: total,
        total,
        percent: 100,
        currentStep: `تم حزم وتنزيل ${processedCount} شعار بنجاح إلى جهازك!`,
        itemTypeLabel: 'شعار',
    });

    return { count: processedCount, zipBlob, fileName };
}

/**
 * Imports car logos from a ZIP file or multiple image files directly from user device,
 * uploads them into Supabase Storage 'logos' bucket with valid image MIME headers
 * (so links display inline and never trigger file download), and forcefully updates
 * the car_makes table's logo_url column with the new Supabase Storage URL.
 */
export async function importCarLogosBundle(
    files: FileList | File[],
    carMakes: CarMake[],
    onProgress?: (progress: LogoBundleProgress) => void
): Promise<LogoImportResult> {
    const fileList = Array.from(files);
    if (fileList.length === 0) {
        throw new Error('لم يتم تحديد أي ملفات للاستيراد.');
    }

    onProgress?.({
        current: 0,
        total: 100,
        percent: 5,
        currentStep: 'جاري تهيئة حاوية logos في مساحة التخزين...',
        itemTypeLabel: 'ملف',
    });

    // 1. Ensure bucket 'logos' exists and is ready
    await ensureBucketExists('logos');

    // 2. Fetch fresh car_makes list from database to ensure no make is missed
    let allDbMakes = [...carMakes];
    try {
        const { data: dbData } = await supabase.from('car_makes').select('*');
        if (dbData && dbData.length > 0) {
            allDbMakes = dbData as CarMake[];
        }
    } catch (e) {
        console.warn('Could not refresh car_makes list from DB:', e);
    }

    let filesToProcess: {
        name: string;
        buffer: Uint8Array;
        manifestItem?: LogoManifestItem;
    }[] = [];

    // Check if user uploaded a ZIP file
    const zipFile = fileList.find(f => f.name.toLowerCase().endsWith('.zip') || f.type.includes('zip'));

    if (zipFile) {
        onProgress?.({
            current: 0,
            total: 100,
            percent: 10,
            currentStep: 'جاري قراءة وفك ضغط ملف ZIP محلياً...',
            itemTypeLabel: 'ملف',
        });

        const zip = await JSZip.loadAsync(zipFile);

        // Check for manifest.json
        let manifestMap: Record<string, LogoManifestItem> = {};
        const manifestEntry = zip.file('manifest.json');
        if (manifestEntry) {
            try {
                const manifestText = await manifestEntry.async('text');
                const parsedManifest = JSON.parse(manifestText);
                if (Array.isArray(parsedManifest.items)) {
                    parsedManifest.items.forEach((item: LogoManifestItem) => {
                        manifestMap[item.fileName.toLowerCase()] = item;
                        if (item.make_id) manifestMap[item.make_id.toLowerCase()] = item;
                        if (item.name_en) manifestMap[item.name_en.toLowerCase()] = item;
                    });
                }
            } catch (e) {
                console.warn('Could not parse manifest.json from zip:', e);
            }
        }

        const validImageEntries: { name: string; entry: JSZip.JSZipObject }[] = [];
        zip.forEach((relativePath, entry) => {
            if (!entry.dir && !relativePath.startsWith('__MACOSX') && !relativePath.includes('/.')) {
                if (/\.(png|jpe?g|webp|svg|gif|ico|bmp|avif)$/i.test(relativePath)) {
                    validImageEntries.push({ name: relativePath.split('/').pop() || relativePath, entry });
                }
            }
        });

        for (const item of validImageEntries) {
            const arrayBuffer = await item.entry.async('arraybuffer');
            const buffer = new Uint8Array(arrayBuffer);
            const manifestMatch = manifestMap[item.name.toLowerCase()] || 
                                  manifestMap[item.name.replace(/\.[^/.]+$/, '').toLowerCase()];
            filesToProcess.push({
                name: item.name,
                buffer,
                manifestItem: manifestMatch
            });
        }
    } else {
        // Direct image files uploaded
        for (const f of fileList) {
            if (f.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif|ico|bmp|avif)$/i.test(f.name)) {
                const arrayBuffer = await f.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);
                filesToProcess.push({
                    name: f.name,
                    buffer
                });
            }
        }
    }

    const totalFiles = filesToProcess.length;
    if (totalFiles === 0) {
        throw new Error('لم يتم العثور على أي ملفات صور صالحة داخل الملف المحدد.');
    }

    let uploadedCount = 0;
    let matchedCount = 0;
    const unmatchedNames: string[] = [];

    for (let i = 0; i < totalFiles; i++) {
        const item = filesToProcess[i];
        const stepPercent = 15 + Math.round(((i + 1) / totalFiles) * 80);

        onProgress?.({
            current: i + 1,
            total: totalFiles,
            percent: stepPercent,
            currentStep: `جاري رفع وتخزين الشعار في حاوية logos: ${item.name}...`,
            itemTypeLabel: 'شعار',
        });

        // 1. Detect exact MIME type and extension using magic bytes & format inspection
        const { mimeType, ext } = detectMimeAndExtFromBuffer(item.buffer, item.name);

        // 2. Identify matching car make(s)
        let matchingMakes: CarMake[] = [];

        // Check manifest make_id first
        if (item.manifestItem?.make_id) {
            const foundById = allDbMakes.find(m => m.id === item.manifestItem!.make_id);
            if (foundById) matchingMakes.push(foundById);
        }

        // Check manifest name_en or name_ar
        if (matchingMakes.length === 0 && item.manifestItem) {
            if (item.manifestItem.name_en) {
                matchingMakes = matchLogoToCarMakes(item.manifestItem.name_en, allDbMakes);
            }
            if (matchingMakes.length === 0 && item.manifestItem.name_ar) {
                matchingMakes = matchLogoToCarMakes(item.manifestItem.name_ar, allDbMakes);
            }
        }

        // Check file name matching
        if (matchingMakes.length === 0) {
            matchingMakes = matchLogoToCarMakes(item.name, allDbMakes);
        }

        const matchedPrimary = matchingMakes[0] || null;
        const brandSlug = matchedPrimary?.name_en
            ? matchedPrimary.name_en.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
            : normalizeBrandName(item.name).replace(/[^a-zA-Z0-9]/g, '_');

        const safeFileName = `make_${brandSlug || 'logo'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const filePath = safeFileName;

        try {
            // Construct a real File instance with the exact, valid image MIME type
            const uploadFile = new File([item.buffer], safeFileName, { type: mimeType });

            // Upload directly to Supabase storage 'logos' bucket with explicit contentType and cacheControl
            const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, uploadFile, {
                contentType: mimeType,
                cacheControl: '3600',
                upsert: true
            });

            if (uploadError) {
                console.error(`Storage upload error for ${item.name} to bucket 'logos':`, uploadError);
                continue;
            }

            // Retrieve the public URL
            const { data: urlData } = supabase.storage.from('logos').getPublicUrl(filePath);
            const publicUrl = urlData?.publicUrl;

            if (publicUrl) {
                uploadedCount++;

                if (matchingMakes.length > 0) {
                    matchedCount++;

                    // FORCEFULLY update the car_makes table in the database:
                    // Delete/overwrite the old URL and store the new public URL from the 'logos' bucket
                    for (const makeToUpdate of matchingMakes) {
                        const { error: updateError } = await supabase
                            .from('car_makes')
                            .update({ logo_url: publicUrl })
                            .eq('id', makeToUpdate.id);

                        if (updateError) {
                            console.error(`Failed to update car_make ${makeToUpdate.name_en} (${makeToUpdate.id}) logo_url:`, updateError);
                        } else {
                            // Immediately update in-memory objects
                            makeToUpdate.logo_url = publicUrl;
                            const localRef = carMakes.find(m => m.id === makeToUpdate.id);
                            if (localRef) localRef.logo_url = publicUrl;
                        }
                    }
                } else {
                    unmatchedNames.push(item.name);
                }
            }
        } catch (uploadErr) {
            console.error(`Failed to upload ${item.name}:`, uploadErr);
        }
    }

    onProgress?.({
        current: totalFiles,
        total: totalFiles,
        percent: 100,
        currentStep: `اكتملت العملية: تم رفع ${uploadedCount} شعار لحاوية logos وتحديث جدول الشركات بالرابط الجديد لـ ${matchedCount} شركة بنجاح!`,
        itemTypeLabel: 'شعار',
    });

    return {
        uploadedCount,
        matchedCount,
        totalFiles,
        unmatchedNames
    };
}
