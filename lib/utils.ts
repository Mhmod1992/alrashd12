import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// A simple UUID generator for the browser environment
export const formatPendingNumber = (num: number | string): string => {
    if (typeof num === 'string' && num.startsWith('W-')) return num;
    const numeric = typeof num === 'number' ? num : parseInt(String(num).replace(/\D/g, ''), 10) || 1;
    if (numeric >= 100) return `W-${numeric}`;
    return `W-${99 + numeric}`;
};

export const uuidv4 = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const compressImageFile = (file: File, options: { maxWidth: number; maxHeight: number; quality: number; }): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
        return resolve(file); // Return original if not an image
    }
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > options.maxWidth) {
          height = Math.round((height * options.maxWidth) / width);
          width = options.maxWidth;
        }
      } else {
        if (height > options.maxHeight) {
          width = Math.round((width * options.maxHeight) / height);
          height = options.maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(img.src);
        return resolve(file); // Fallback to original
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(img.src);
      
      canvas.toBlob((blob) => {
          if (!blob) {
              return resolve(file); // Fallback
          }
          // Preserve original type to keep transparency for PNGs (like logos)
          const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const ext = outType === 'image/png' ? '.png' : '.jpg';
          
          const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ext, {
              type: outType,
              lastModified: Date.now(),
          });
          resolve(newFile);
      }, file.type === 'image/png' ? 'image/png' : 'image/jpeg', options.quality);
    };
    img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(file); // Fallback to original on error
    }
  });
};

export const processScannerImageFile = (file: File, filterType: 'original' | 'document' | 'bw' | 'magic_color' | 'natural_compressed'): Promise<File> => {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/') || filterType === 'original') {
            return resolve(file);
        }
        
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('No context');

                canvas.width = img.width;
                canvas.height = img.height;
                
                // ضغط ذكي طبيعي: الحفاظ الكامل على الألوان والخلفية والتفاصيل بدون أي تلاعب بالبكسلات
                if (filterType === 'natural_compressed') {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
                    const format = supportsWebP ? 'image/webp' : 'image/jpeg';
                    const quality = supportsWebP ? 0.82 : 0.85;

                    canvas.toBlob((blob) => {
                        URL.revokeObjectURL(img.src);
                        if (blob) {
                            const ext = supportsWebP ? 'webp' : 'jpg';
                            const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + `.${ext}`, { type: format });
                            resolve(newFile);
                        } else {
                            resolve(file);
                        }
                    }, format, quality);
                    return;
                }

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    let v = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    if (filterType === 'magic_color') {
                        if (v > 150) {
                            const blend = Math.min(1, (v - 150) / 40);
                            data[i] = r + (255 - r) * blend;
                            data[i + 1] = g + (255 - g) * blend;
                            data[i + 2] = b + (255 - b) * blend;
                        } else {
                            data[i] = Math.max(0, r * 1.15 - 25);
                            data[i + 1] = Math.max(0, g * 1.15 - 25);
                            data[i + 2] = Math.max(0, b * 1.15 - 25);
                        }
                    } else if (filterType === 'document') {
                        v = 255 * Math.pow(v / 255, 0.7);
                        const contrast = 1.6;
                        const intercept = 128 * (1 - contrast);
                        v = v * contrast + intercept;
                        v = Math.min(255, Math.max(0, v));
                        data[i] = v;
                        data[i + 1] = v;
                        data[i + 2] = v;
                    } else if (filterType === 'bw') {
                        const contrast = 1.3;
                        const intercept = 128 * (1 - contrast);
                        let nv = v * contrast + intercept;
                        if (nv > 220) nv = 255; 
                        if (nv < 40) nv = 0;   
                        nv = Math.min(255, Math.max(0, nv));
                        data[i] = nv;
                        data[i + 1] = nv;
                        data[i + 2] = nv;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
                
                const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
                const format = supportsWebP ? 'image/webp' : 'image/jpeg';
                const quality = supportsWebP ? 0.7 : 0.85;

                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(img.src);
                    if (blob) {
                        const ext = supportsWebP ? 'webp' : 'jpg';
                        const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + `.${ext}`, { type: format });
                        resolve(newFile);
                    } else {
                        resolve(file);
                    }
                }, format, quality);
            } catch (e) {
                console.error('Filter processing failed:', e);
                URL.revokeObjectURL(img.src);
                resolve(file);
            }
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            resolve(file);
        };
    });
};

export const compressImageToBase64 = (file: File, options: { maxWidth: number; maxHeight: number; quality: number; }): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
        return reject(new Error('File is not an image.'));
    }
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > options.maxWidth) {
          height = Math.round((height * options.maxWidth) / width);
          width = options.maxWidth;
        }
      } else {
        if (height > options.maxHeight) {
          width = Math.round((width * options.maxHeight) / height);
          height = options.maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(img.src);
        return reject(new Error('Could not get canvas context'));
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(img.src);
      
      resolve(canvas.toDataURL('image/jpeg', options.quality));
    };
    img.onerror = (error) => {
        URL.revokeObjectURL(img.src);
        reject(error);
    }
  });
};

// Helper function to clean JSON string from Markdown code blocks
export const cleanJsonString = (str: string): string => {
    if (!str) return '';
    return str.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
};

// Helper function to estimate size
export const estimateObjectSize = (obj: any): number => {
    if (obj === null || obj === undefined) return 0;
    // A rough estimation by stringifying the object.
    // Not perfectly accurate due to JS object overhead, but good enough for this purpose.
    return new Blob([JSON.stringify(obj)]).size;
};

// Helper function to format bytes into a human-readable string
export const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const timeAgo = (dateParam: string | Date | undefined): string => {
    if (!dateParam) return '';
    const date = typeof dateParam === 'string' ? new Date(dateParam) : dateParam;
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 0) return 'الآن'; 
    if (seconds < 60) return 'منذ لحظات';

    const minutes = Math.round(seconds / 60);
    const hours = Math.round(seconds / 3600);
    const days = Math.round(seconds / 86400);
    const months = Math.round(seconds / 2592000);
    const years = Math.round(seconds / 31536000);

    if (minutes < 60) {
        if (minutes === 1) return `منذ دقيقة`;
        if (minutes === 2) return `منذ دقيقتين`;
        if (minutes <= 10) return `منذ ${minutes} دقائق`;
        return `منذ ${minutes} دقيقة`;
    }
    if (hours < 24) {
        if (hours === 1) return `منذ ساعة`;
        if (hours === 2) return `منذ ساعتين`;
        if (hours <= 10) return `منذ ${hours} ساعات`;
        return `منذ ${hours} ساعة`;
    }
    if (days < 30) {
        if (days === 1) return `أمس`;
        if (days === 2) return `منذ يومين`;
        if (days <= 10) return `منذ ${days} أيام`;
        return `منذ ${days} يوماً`;
    }
    if (months < 12) {
        if (months === 1) return `منذ شهر`;
        if (months === 2) return `منذ شهرين`;
        if (months <= 10) return `منذ ${months} أشهر`;
        return `منذ ${months} شهراً`;
    }
    if (years === 1) return `منذ سنة`;
    if (years === 2) return `منذ سنتين`;
    if (years <= 10) return `منذ ${years} سنوات`;
    return `منذ ${years} سنة`;
};

export const urlToBase64 = async (url: string): Promise<string | null> => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    try {
        const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
        if (!response.ok) return null;
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Failed to fetch image for base64 conversion:", e);
        return null;
    }
};

export const base64ToFile = (base64String: string, filename: string): File => {
    const arr = base64String.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
};

export const arabicToEnglishNumerals = (str: string): string => {
    if (!str) return '';
    const arabicNumerals = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    let result = str;
    for (let i = 0; i < 10; i++) {
        result = result.replace(arabicNumerals[i], i.toString());
    }
    return result;
};

export const parseWhatsAppMessage = (rawMessage: string) => {
    if (!rawMessage) return { cleanMessage: '', source: null, replyTo: null };
  
    let cleanMessage = rawMessage;
    let source = null;
    let replyTo = null;
  
    const sourceRegex = /📌\s*\[المصدر:\s*(.*?)\]/;
    const sourceMatch = rawMessage.match(sourceRegex);
    if (sourceMatch) {
      source = sourceMatch[1].trim();
      cleanMessage = cleanMessage.replace(sourceMatch[0], '');
    }
  
    const replyRegex = /💬\s*\[رداً\s*على:\s*(.*?)\]/;
    const replyMatch = rawMessage.match(replyRegex);
    if (replyMatch) {
      replyTo = replyMatch[1].trim();
      cleanMessage = cleanMessage.replace(replyMatch[0], '');
    }
  
    return {
      cleanMessage: cleanMessage.trim(),
      source: source?.replace(/"/g, ''),
      replyTo
    };
};
export const formatPhoneNumberDisplay = (phone: string | undefined): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    let core = '';
    if (cleaned.length === 10 && cleaned.startsWith('05')) {
        core = cleaned.substring(1);
    } else if (cleaned.length === 12 && cleaned.startsWith('9665')) {
        core = cleaned.substring(3);
    } else if (cleaned.length === 9 && cleaned.startsWith('5')) {
        core = cleaned;
    }
    if (core.length === 9) {
        return `0${core.substring(0, 2)}-${core.substring(2, 5)}-${core.substring(5)}`;
    }
    return phone;
};
