
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

export const timeAgo = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 0) return 'الآن'; 

    let interval = seconds / 31536000;
    if (interval > 1) return `منذ ${Math.floor(interval)} سنة`;
    interval = seconds / 2592000;
    if (interval > 1) return `منذ ${Math.floor(interval)} شهر`;
    interval = seconds / 86400;
    if (interval > 1) return `منذ ${Math.floor(interval)} يوم`;
    interval = seconds / 3600;
    if (interval > 1) return `منذ ${Math.floor(interval)} ساعة`;
    interval = seconds / 60;
    if (interval > 1) return `منذ ${Math.floor(interval)} دقيقة`;
    return 'منذ لحظات';
};