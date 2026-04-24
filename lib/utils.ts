import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// A simple UUID generator for the browser environment
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