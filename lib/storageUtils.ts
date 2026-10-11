import { supabase } from './supabaseClient';
import { uuidv4, compressImageFile, base64ToFile } from './utils';

// Cache known created buckets to avoid redundant API calls
const verifiedBuckets = new Set<string>();

/**
 * Ensures a Supabase storage bucket exists. If not, attempts to create it as public.
 */
export async function ensureBucketExists(bucketName: string): Promise<boolean> {
    if (verifiedBuckets.has(bucketName)) return true;

    try {
        const { data: bucket, error: getError } = await supabase.storage.getBucket(bucketName);
        if (bucket && !getError) {
            verifiedBuckets.add(bucketName);
            return true;
        }

        // Bucket doesn't exist, try to create it
        const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 10485760 // 10MB
        });

        if (!createError || createError.message?.toLowerCase().includes('already exists')) {
            verifiedBuckets.add(bucketName);
            return true;
        }

        console.warn(`Could not create bucket "${bucketName}":`, createError?.message);
        // Even if create failed (e.g., standard RLS or already exists), allow upload attempt
        return true;
    } catch (err) {
        console.warn(`Bucket check error for "${bucketName}":`, err);
        return true;
    }
}

/**
 * Safely converts an image URL or Blob to Base64 string.
 * Supports data URLs, direct CORS fetch, and image canvas fallback.
 */
export async function urlToBase64Safe(url: string | null | undefined): Promise<string | null> {
    if (!url || typeof url !== 'string' || !url.trim()) return null;
    if (url.startsWith('data:')) return url;

    // 1. Try direct fetch
    try {
        const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
        if (res.ok) {
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        // Direct fetch failed, fallback to canvas or proxy
    }

    // 2. Try HTML Image + Canvas with crossOrigin
    try {
        const base64FromCanvas = await new Promise<string | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(null);
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });

        if (base64FromCanvas) return base64FromCanvas;
    } catch {
        // Fall through to proxy
    }

    // 3. Fallback to high-speed image CDN proxy (weserv.nl) if external web URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
            const cleanUrl = url.replace(/^https?:\/\//, '');
            const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&output=png`;
            const proxyRes = await fetch(weservUrl);
            if (proxyRes.ok) {
                const blob = await proxyRes.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(blob);
                });
            }
        } catch {}

        // 4. Fallback to corsproxy.io
        try {
            const proxyRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
            if (proxyRes.ok) {
                const blob = await proxyRes.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(blob);
                });
            }
        } catch {}

        // 5. Fallback to allorigins.win
        try {
            const proxyRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
            if (proxyRes.ok) {
                const blob = await proxyRes.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(blob);
                });
            }
        } catch {
            // All proxy attempts failed
        }
    }

    return null;
}

/**
 * Converts a Base64 string or an image URL to a real File object.
 */
export async function convertUrlOrBase64ToFile(
    input: string | null | undefined,
    fallbackFileName: string = `image_${Date.now()}.png`
): Promise<File | null> {
    if (!input || typeof input !== 'string' || !input.trim()) return null;

    // A) If already base64
    if (input.startsWith('data:')) {
        try {
            return base64ToFile(input, fallbackFileName);
        } catch (e) {
            console.error('Failed to parse base64 to file:', e);
            return null;
        }
    }

    // B) If it's a URL, convert to Base64 first or fetch directly
    const b64 = await urlToBase64Safe(input);
    if (b64) {
        try {
            return base64ToFile(b64, fallbackFileName);
        } catch (e) {
            console.error('Failed to convert base64 to file:', e);
            return null;
        }
    }

    return null;
}

/**
 * Uploads an image (File or Base64 or URL) to Supabase Storage,
 * ensuring the destination bucket exists and creating it automatically if missing.
 * Returns the permanent public URL in the new Supabase database.
 */
export async function uploadImageWithAutoBucket(
    imageSource: File | string | null | undefined,
    bucketName: string,
    folder?: string,
    customFileName?: string
): Promise<string | null> {
    if (!imageSource) return null;

    try {
        // Auto-redirect legacy 'car_logos' bucket name to user's 'logos' bucket
        const targetBucket = bucketName === 'car_logos' ? 'logos' : bucketName;

        // 1. Ensure bucket exists
        await ensureBucketExists(targetBucket);

        // 2. Prepare file
        let fileToUpload: File | null = null;
        if (imageSource instanceof File) {
            fileToUpload = imageSource;
        } else if (typeof imageSource === 'string') {
            const defaultName = customFileName || `${uuidv4()}.png`;
            fileToUpload = await convertUrlOrBase64ToFile(imageSource, defaultName);
        }

        if (!fileToUpload) return null;

        // 3. Compress if not WebP and larger than standard
        const isAlreadyWebP = fileToUpload.type === 'image/webp' || fileToUpload.name.endsWith('.webp');
        if (!isAlreadyWebP && fileToUpload.size > 200 * 1024) {
            try {
                fileToUpload = await compressImageFile(fileToUpload, {
                    maxWidth: 1200,
                    maxHeight: 1200,
                    quality: 0.8
                });
            } catch (compErr) {
                console.warn('Image compression fallback:', compErr);
            }
        }

        const ext = isAlreadyWebP ? 'webp' : (fileToUpload.name.split('.').pop() || 'png');
        const finalName = customFileName
            ? (customFileName.endsWith(`.${ext}`) ? customFileName : `${customFileName}.${ext}`)
            : `${uuidv4()}.${ext}`;
        const filePath = folder ? `${folder}/${finalName}` : finalName;

        // Determine strictly valid image MIME type
        let mimeType = fileToUpload.type || '';
        if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
        if (mimeType === 'image/svg') mimeType = 'image/svg+xml';
        if (!mimeType || mimeType === 'application/octet-stream') {
            const cleanExt = (finalName.split('.').pop() || '').toLowerCase();
            if (cleanExt === 'jpg' || cleanExt === 'jpeg') mimeType = 'image/jpeg';
            else if (cleanExt === 'png') mimeType = 'image/png';
            else if (cleanExt === 'webp') mimeType = 'image/webp';
            else if (cleanExt === 'svg' || cleanExt === 'svgz') mimeType = 'image/svg+xml';
            else if (cleanExt === 'gif') mimeType = 'image/gif';
            else mimeType = 'image/png';
        }

        // 4. Upload to Supabase Storage with explicit MIME type & inline display cacheControl
        const { error: uploadError } = await supabase.storage.from(targetBucket).upload(filePath, fileToUpload, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: true
        });

        if (uploadError) {
            console.error(`Upload error to bucket "${targetBucket}":`, uploadError);
            throw uploadError;
        }

        // 5. Retrieve Public URL
        const { data } = supabase.storage.from(targetBucket).getPublicUrl(filePath);
        return data?.publicUrl || null;
    } catch (err) {
        console.error(`uploadImageWithAutoBucket failed for bucket "${bucketName}":`, err);
        return null;
    }
}
