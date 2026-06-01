// Keyboard Layout Mapping & Correction Utility
// Fully local, high-performance offline lookup and heuristics

const enToArMap: Record<string, string> = {
  // Lowercase keys
  'q': 'ض', 'w': 'ص', 'e': 'ث', 'r': 'ق', 't': 'ف', 'y': 'غ', 'u': 'ع', 'i': 'ه', 'o': 'خ', 'p': 'ح', '[': 'ج', ']': 'د',
  'a': 'ش', 's': 'س', 'd': 'ي', 'f': 'ب', 'g': 'ل', 'h': 'ا', 'j': 'ت', 'k': 'ن', 'l': 'م', ';': 'ك', "'": 'ط',
  'z': 'ئ', 'x': 'ء', 'c': 'ؤ', 'v': 'ر', 'b': 'لا', 'n': 'ى', 'm': 'ة', ',': 'و', '.': 'ز', '/': 'ظ',
  '`': 'ذ',

  // Uppercase keys mapped EXACTLY to the same clean Arabic equivalents to avoid layout bugs when CAPSLOCK is on or converted to uppercase
  'Q': 'ض', 'W': 'ص', 'E': 'ث', 'R': 'ق', 'T': 'ف', 'Y': 'غ', 'U': 'ع', 'I': 'ه', 'O': 'خ', 'P': 'ح', '{': 'ج', '}': 'د',
  'A': 'ش', 'S': 'س', 'D': 'ي', 'F': 'ب', 'G': 'ل', 'H': 'ا', 'J': 'ت', 'K': 'ن', 'L': 'م', ':': 'ك', '"': 'ط',
  'Z': 'ئ', 'X': 'ء', 'C': 'ؤ', 'V': 'ر', 'B': 'لا', 'N': 'ى', 'M': 'ة', '<': 'و', '>': 'ز', '?': 'ظ',
  '~': 'ذ'
};

const arToEnMap: Record<string, string> = {
  'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
  'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': "'",
  'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/',
  'ذ': '`',
  'أ': 'h', 'إ': 'y', 'آ': 'n',
  'لا': 'b', 'لآ': 'b', 'لأ': 'b', 'لإ': 'b'
};

// Common exceptions in car inspection apps that shouldn't be touched unless part of a broader layout mess
const englishWhitelist = new Set([
  'abs', 'obd', 'ecu', 'vin', 'ac', 'car', 'v8', 'gt', 'km', 'gmc', 'bmw', 'sms', 'pdf', 'api', 'id', 'vip', 'led', 'usb', 'gps', 'am', 'pm'
]);

// Valid short English words to NOT correct as layout typos
const validEnglishWords = new Set([
  'in', 'on', 'at', 'to', 'by', 'is', 'it', 'or', 'an', 'as', 'of', 'no', 'if', 'up', 'so', 'he', 'we', 'me', 'my', 'go', 'do', 'am', 'us',
  'and', 'the', 'for', 'but', 'not', 'you', 'all', 'any', 'can', 'has', 'had', 'her', 'him', 'his', 'its', 'now', 'out', 'one', 'two', 'see',
  'get', 'use', 'how', 'new', 'our', 'who', 'why', 'run', 'set', 'try', 'yes', 'car', 'oil', 'gas', 'air', 'map', 'key', 'val', 'app', 'web', 'api', 'dev', 'abs', 'obd', 'ecu', 'vin', 'ac', 'v8', 'gt', 'km', 'gmc', 'bmw', 'sms', 'pdf'
]);

// Helper to determine if a string is English characters
function isEnglishWord(word: string): boolean {
  // Can include some common layout symbols like ; , ' [ ] which are Arabic chars on keyboard
  return /^[a-zA-Z;,.'\[\]]+$/.test(word);
}

// Helper to determine if a string is Arabic characters
function isArabicWord(word: string): boolean {
  return /^[\u0600-\u06FF]+$/.test(word);
}

/**
 * Detects if a clean word is likely typed with the wrong keyboard layout.
 */
export function detectWrongLayout(word: string): 'en_to_ar' | 'ar_to_en' | null {
  const clean = word.trim();
  if (clean.length < 2) return null;

  // 1. English to Arabic Layout check
  if (isEnglishWord(clean)) {
    const lower = clean.toLowerCase();
    if (englishWhitelist.has(lower)) return null;
    if (validEnglishWords.has(lower)) return null;

    // Direct layout structural markers (like having semicolon, commas, brackets inside words)
    if (/[;,.'\[\]]/.test(clean)) {
      return 'en_to_ar';
    }

    // Check if starting with "hg" (which maps to "ال" - Al in Arabic)
    const startsWithAl = lower.startsWith('hg');
    if (startsWithAl) {
      return 'en_to_ar';
    }

    // If it's a very short word (2 or 3 characters) and not a valid short English word, it's 95% a layout typo (e.g., "lu", "td", "wt")
    if (clean.length <= 3) {
      return 'en_to_ar';
    }

    // English phonetic check: Standard English words mapped from QWERTY to Arabic layout
    // No vowels at all (a, e, i, o, u, y) is 95% nonsense in English (except abbreviations)
    const hasEnglishVowels = /[aeiouyAEIOUY]/.test(clean);
    if (!hasEnglishVowels) {
      return 'en_to_ar';
    }

    // If there is a vowel but it's a very unlikely cluster (e.g. "ogtd" which has 3 consecutive consonants at the end, or similar)
    const consonantCluster = /[^aeiouyAEIOUY]{3,}/.test(clean);
    if (consonantCluster && clean.length > 3) {
      return 'en_to_ar';
    }
  }

  // 2. Arabic to English Layout check (Disabled to prevent translating correct Arabic words like 'صوفة' or 'خلفي' to other layouts)
  if (isArabicWord(clean)) {
    return null;
  }

  return null;
}

/**
 * Convert a single word based on layout mapping
 */
function convertWord(word: string, direction: 'en_to_ar' | 'ar_to_en'): string {
  let result = '';
  const map = direction === 'en_to_ar' ? enToArMap : arToEnMap;
  
  if (direction === 'en_to_ar') {
    // Check for special multi-character sequences or b representing "لا" or similar
    let i = 0;
    while (i < word.length) {
      const char = word[i];
      if (char === 'b' || char === 'B') {
        result += 'لا';
        i++;
      } else {
        result += map[char] || char;
        i++;
      }
    }
  } else {
    // ar_to_en
    let i = 0;
    while (i < word.length) {
      // Lookahead check for "لا" / "لأ" / "لإ" / "لآ"
      if (word.substring(i, i + 2) === 'لا' || word.substring(i, i + 2) === 'لأ' || word.substring(i, i + 2) === 'لإ' || word.substring(i, i + 2) === 'لآ') {
        result += 'b';
        i += 2;
      } else {
        const char = word[i];
        result += map[char] || char;
        i++;
      }
    }
  }
  
  return result;
}

/**
 * Main bidirectional direct text converter
 */
export function convertText(text: string): string {
  if (!text) return '';
  
  // We want to process it while keeping spacing, newlines and tabs exactly the same
  // Split on whitespace tokens and reconstruct
  const tokens = text.split(/(\s+)/);
  const convertedTokens = tokens.map((token) => {
    if (/^\s+$/.test(token)) {
      return token; // Keep spacing unchanged
    }
    
    // Detect primary direction of the token
    let arCount = 0;
    let enCount = 0;
    for (const char of token) {
      if (enToArMap[char]) enCount++;
      if (arToEnMap[char]) arCount++;
    }
    
    const direction = enCount >= arCount ? 'en_to_ar' : 'ar_to_en';
    return convertWord(token, direction);
  });
  
  return convertedTokens.join('');
}

/**
 * Processes full strings and intelligently corrects ONLY the parts that seem to be typos.
 * Keeping valid language parts (like "abs") intact!
 * E.g., "abs lu hggdhj" -> "abs مع الليات"
 */
export function smartSuggestion(text: string): { original: string; corrected: string; isCorrected: boolean } | null {
  if (!text || text.trim().length < 2) return null;
  
  const tokens = text.split(/(\s+)/);
  let isChanged = false;
  
  const correctedTokens = tokens.map((token) => {
    if (/^\s+$/.test(token)) {
      return token;
    }
    
    // Strip trailing punctuation from token before layout checks to prevent confusion
    const match = token.match(/^([^\w\u0600-\u06FF]*)([\w\u0600-\u06FF;,.'\[\]]+)([^\w\u0600-\u06FF]*)$/);
    if (!match) {
      // Just map characters if it's purely punctuation or mixed
      return token;
    }
    
    const [, lead, core, trail] = match;
    const errorType = detectWrongLayout(core);
    if (errorType) {
      isChanged = true;
      return lead + convertWord(core, errorType) + trail;
    }
    
    return token;
  });
  
  if (!isChanged) return null;
  
  return {
    original: text,
    corrected: correctedTokens.join(''),
    isCorrected: true
  };
}
