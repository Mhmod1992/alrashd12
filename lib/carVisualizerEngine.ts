import { GoogleGenAI } from '@google/genai';
import { InspectionRequest, CustomFindingCategory, PredefinedFinding, Note } from '../types';

export type PanelDamageType = 'repainted' | 'defect' | 'intact';
export type CarSide = 'front' | 'rear' | 'left' | 'right' | 'roof' | 'general';

export interface DamagedPanel {
  id: string;
  nameAr: string;
  nameEn: string;
  type: PanelDamageType;
  descriptionAr: string;
  descriptionEn: string;
  side: CarSide;
  source: 'finding' | 'note';
}

export interface BodyExtractionResult {
  carName: string;
  carModelYear: string;
  damagedPanels: DamagedPanel[];
  intactPanels: DamagedPanel[];
  repaintedCount: number;
  defectCount: number;
  intactCount: number;
  activeSides: CarSide[];
  recommendedViewport: {
    titleAr: string;
    titleEn: string;
    description: string;
  };
  prompt: string;
  rawFindingsCount: number;
  rawNotesCount: number;
}

// Arabic and English dictionaries for body components
const BODY_PART_DICTIONARY: {
  keywords: string[];
  nameAr: string;
  nameEn: string;
  side: CarSide;
}[] = [
  // Front
  { keywords: ['كبوت', 'غطاء المحرك', 'بونت'], nameAr: 'غطاء المحرك (الكبوت)', nameEn: 'Engine Hood', side: 'front' },
  { keywords: ['صدام أمامي', 'الصدام الأمامي', 'دعامية امامية'], nameAr: 'الصدام الأمامي', nameEn: 'Front Bumper', side: 'front' },
  { keywords: ['شبك أمامي', 'الشبك', 'شبك'], nameAr: 'الشبك الأمامي', nameEn: 'Front Grille', side: 'front' },
  { keywords: ['شمعة يمين', 'نور يمين', 'اسطب امامي يمين'], nameAr: 'المصباح الأمامي الأيمن', nameEn: 'Right Headlight', side: 'front' },
  { keywords: ['شمعة يسار', 'نور يسار', 'اسطب امامي يسار'], nameAr: 'المصباح الأمامي الأيسر', nameEn: 'Left Headlight', side: 'front' },
  { keywords: ['واجهة', 'وجهية', 'صدر', 'الواجهة الأمامية', 'الواجها الأمامية'], nameAr: 'واجهة المركبة', nameEn: 'Front Fascia', side: 'front' },

  // Rear
  { keywords: ['شنطة', 'الشنطة', 'دبة', 'باب الشنطة', 'غطاء الشنطة'], nameAr: 'باب الشنطة (الخلفي)', nameEn: 'Trunk Lid / Tailgate', side: 'rear' },
  { keywords: ['صدام خلفي', 'الصدام الخلفي', 'دعامية خلفية'], nameAr: 'الصدام الخلفي', nameEn: 'Rear Bumper', side: 'rear' },
  { keywords: ['اسطب خلفي يمين', 'شمعة خلفية يمين'], nameAr: 'المصباح الخلفي الأيمن', nameEn: 'Right Taillight', side: 'rear' },
  { keywords: ['اسطب خلفي يسار', 'شمعة خلفية يسار'], nameAr: 'المصباح الخلفي الأيسر', nameEn: 'Left Taillight', side: 'rear' },

  // Left Side
  { keywords: ['رفرف امامي يسار', 'رفرف أمامي أيسر', 'رفرف يسار امامي'], nameAr: 'الرفرف الأمامي الأيسر', nameEn: 'Front Left Fender', side: 'left' },
  { keywords: ['رفرف خلفي يسار', 'رفرف خلفي أيسر', 'رفرف يسار خلفي'], nameAr: 'الرفرف الخلفي الأيسر', nameEn: 'Rear Left Quarter Panel', side: 'left' },
  { keywords: ['باب امامي يسار', 'باب السائق', 'باب أمامي أيسر'], nameAr: 'باب السائق (الأمامي الأيسر)', nameEn: 'Front Left Door', side: 'left' },
  { keywords: ['باب خلفي يسار', 'باب خلف السائق', 'باب خلفي أيسر'], nameAr: 'الباب الخلفي الأيسر', nameEn: 'Rear Left Door', side: 'left' },
  { keywords: ['مراية يسار', 'مراة يسار'], nameAr: 'المرآة الجانبية اليسرى', nameEn: 'Left Side Mirror', side: 'left' },
  { keywords: ['عتبة يسار', 'سمكة يسار'], nameAr: 'عتبة الباب اليسرى', nameEn: 'Left Rocker Panel', side: 'left' },
  { keywords: ['قائم فوق الباب يسار', 'قائم يسار', 'تندة يسار', 'قائم أيسر', 'قائم الباب يسار'], nameAr: 'قائم فوق الباب يسار (القائم الأيسر)', nameEn: 'Left Roof Rail / Pillar', side: 'left' },

  // Right Side
  { keywords: ['رفرف امامي يمين', 'رفرف أمامي أيمن', 'رفرف يمين امامي'], nameAr: 'الرفرف الأمامي الأيمن', nameEn: 'Front Right Fender', side: 'right' },
  { keywords: ['رفرف خلفي يمين', 'رفرف خلفي أيمن', 'رفرف يمين خلفي'], nameAr: 'الرفرف الخلفي الأيمن', nameEn: 'Rear Right Quarter Panel', side: 'right' },
  { keywords: ['باب امامي يمين', 'باب الراكب', 'باب أمامي أيمن'], nameAr: 'باب الراكب (الأمامي الأيمن)', nameEn: 'Front Right Door', side: 'right' },
  { keywords: ['باب خلفي يمين', 'باب خلف الراكب', 'باب خلفي أيمن'], nameAr: 'الباب الخلفي الأيمن', nameEn: 'Rear Right Door', side: 'right' },
  { keywords: ['مراية يمين', 'مراة يمين'], nameAr: 'المرآة الجانبية اليمنى', nameEn: 'Right Side Mirror', side: 'right' },
  { keywords: ['عتبة يمين', 'سمكة يمين'], nameAr: 'عتبة الباب اليمنى', nameEn: 'Right Rocker Panel', side: 'right' },
  { keywords: ['قائم فوق الباب يمين', 'قائم يمين', 'قائم أيمن', 'قائم الباب يمين', 'تندة يمين'], nameAr: 'قائم فوق الباب يمين (القائم الأيمن)', nameEn: 'Right Roof Rail / Pillar', side: 'right' },

  // Roof & Glass
  { keywords: ['سقف', 'السقف', 'تندة', 'بانوراما', 'فتحة سقف'], nameAr: 'سقف المركبة', nameEn: 'Roof Panel', side: 'roof' },
  { keywords: ['زجاج أمامي', 'قزاز امامي', 'الزجاج الأمامي'], nameAr: 'الزجاج الأمامي', nameEn: 'Front Windshield', side: 'front' },
  { keywords: ['زجاج خلفي', 'قزاز خلفي', 'الزجاج الخلفي'], nameAr: 'الزجاج الخلفي', nameEn: 'Rear Windshield', side: 'rear' },
  { keywords: ['زجاج جانبي', 'قزاز مثلث', 'زجاج باب', 'قزاز'], nameAr: 'الزجاج الجانبي', nameEn: 'Side Window Glass', side: 'general' },
];

// Panels belonging to the entire right side
const ENTIRE_RIGHT_SIDE_PANELS = [
  { nameAr: 'الرفرف الأمامي الأيمن', nameEn: 'Front Right Fender', side: 'right' as CarSide },
  { nameAr: 'باب الراكب (الأمامي الأيمن)', nameEn: 'Front Right Door', side: 'right' as CarSide },
  { nameAr: 'الباب الخلفي الأيمن', nameEn: 'Rear Right Door', side: 'right' as CarSide },
  { nameAr: 'الرفرف الخلفي الأيمن', nameEn: 'Rear Right Quarter Panel', side: 'right' as CarSide },
  { nameAr: 'قائم فوق الباب يمين', nameEn: 'Right Roof Rail / Pillar', side: 'right' as CarSide },
];

// Panels belonging to the entire left side
const ENTIRE_LEFT_SIDE_PANELS = [
  { nameAr: 'الرفرف الأمامي الأيسر', nameEn: 'Front Left Fender', side: 'left' as CarSide },
  { nameAr: 'باب السائق (الأمامي الأيسر)', nameEn: 'Front Left Door', side: 'left' as CarSide },
  { nameAr: 'الباب الخلفي الأيسر', nameEn: 'Rear Left Door', side: 'left' as CarSide },
  { nameAr: 'الرفرف الخلفي الأيسر', nameEn: 'Rear Left Quarter Panel', side: 'left' as CarSide },
  { nameAr: 'قائم فوق الباب يسار', nameEn: 'Left Roof Rail / Pillar', side: 'left' as CarSide },
];

function detectSideFromName(name: string): CarSide {
  const n = name.toLowerCase();
  if (n.includes('يسار') || n.includes('أيسر') || n.includes('سائق')) return 'left';
  if (n.includes('يمين') || n.includes('أيمن') || n.includes('راكب')) return 'right';
  if (n.includes('أمام') || n.includes('أمامي') || n.includes('كبوت') || n.includes('واجهة') || n.includes('وجهية')) return 'front';
  if (n.includes('خلف') || n.includes('خلفي') || n.includes('شنطة') || n.includes('دبة')) return 'rear';
  if (n.includes('سقف') || n.includes('تندة') || n.includes('بانوراما')) return 'roof';
  return 'general';
}

/**
 * Extracts and maps body damages STRICTLY from the Body category cards and notes.
 */
export function extractBodyDamageData(
  request: Partial<InspectionRequest>,
  categories: CustomFindingCategory[] = [],
  predefinedFindings: PredefinedFinding[] = [],
  customInputOverride?: { carText?: string; notesText?: string }
): BodyExtractionResult {
  const carName = customInputOverride?.carText || (
    request.car_snapshot
      ? `${request.car_snapshot.make_ar || ''} ${request.car_snapshot.model_ar || ''}`.trim()
      : 'سيارة سيدان حديثة'
  );

  const carModelYear = request.car_snapshot?.year ? String(request.car_snapshot.year) : '';
  const fullCarTitle = `${carName} ${carModelYear}`.trim();

  const damagedPanels: DamagedPanel[] = [];
  const intactPanels: DamagedPanel[] = [];
  const processedKeys = new Set<string>();

  // 1. Find the dedicated BODY category
  const bodyCategory = categories.find(c => {
    const n = (c.name || '').trim().toLowerCase();
    return n === 'البدي' || n === 'البودي' || n === 'البودي الخارجي' || n === 'الهيكل' || n === 'الهيكل الخارجي' || n.includes('بدي') || n.includes('بودي');
  });

  // Filter findings: STRICTLY Body category cards!
  const bodyFindings = (request.structured_findings || []).filter(sf => {
    if (bodyCategory) return sf.categoryId === bodyCategory.id;
    const catName = categories.find(c => c.id === sf.categoryId)?.name || '';
    return catName.includes('بدي') || catName.includes('بودي');
  });

  // Process Body Finding Cards
  bodyFindings.forEach(sf => {
    const prefName = predefinedFindings.find(p => p.id === sf.findingId)?.name || sf.findingName || '';
    const rawVal = (sf.value || '').trim();
    const valNormalized = rawVal.toLowerCase();

    // Check if finding is explicitly marked intact
    const isExplicitlyIntact = (valNormalized.includes('سليم') || valNormalized.includes('وكالة')) &&
      !valNormalized.includes('رش') && !valNormalized.includes('معجون') && !valNormalized.includes('مغير');

    if (isExplicitlyIntact) {
      intactPanels.push({
        id: `finding-${sf.findingId}-${Math.random()}`,
        nameAr: prefName,
        nameEn: prefName,
        type: 'intact',
        descriptionAr: rawVal || 'سليم وكالة',
        descriptionEn: 'Intact / Factory Condition',
        side: detectSideFromName(prefName),
        source: 'finding'
      });
      return;
    }

    // In vehicle inspection reports, ANY card appearing under the "البدي" section
    // is an affected/repainted part (كما في الملاحظة: صور الأجزاء المذكورة أدناه توضح أماكن وجود الرش أو السمكرة في بدي السيارة)
    const cardTitle = prefName || rawVal;
    const titleLower = cardTitle.toLowerCase();

    // Check for "جنب كامل يمين" / "جنب يمين"
    if (titleLower.includes('جنب يمين') || titleLower.includes('الجانب الأيمن') || titleLower.includes('جنب كامل يمين')) {
      ENTIRE_RIGHT_SIDE_PANELS.forEach(p => {
        if (!processedKeys.has(p.nameAr)) {
          processedKeys.add(p.nameAr);
          damagedPanels.push({
            id: `side-right-${p.nameAr}-${Math.random()}`,
            nameAr: p.nameAr,
            nameEn: p.nameEn,
            type: 'repainted',
            descriptionAr: rawVal ? `رش الجانب الأيمن بالكامل: ${rawVal}` : 'رش الجانب الأيمن بالكامل',
            descriptionEn: 'Repainted / Full Right Lateral Profile Resprayed',
            side: 'right',
            source: 'finding'
          });
        }
      });
      return;
    }

    // Check for "جنب كامل يسار" / "جنب يسار"
    if (titleLower.includes('جنب يسار') || titleLower.includes('الجانب الأيسر') || titleLower.includes('جنب كامل يسار')) {
      ENTIRE_LEFT_SIDE_PANELS.forEach(p => {
        if (!processedKeys.has(p.nameAr)) {
          processedKeys.add(p.nameAr);
          damagedPanels.push({
            id: `side-left-${p.nameAr}-${Math.random()}`,
            nameAr: p.nameAr,
            nameEn: p.nameEn,
            type: 'repainted',
            descriptionAr: rawVal ? `رش الجانب الأيسر بالكامل: ${rawVal}` : 'رش الجانب الأيسر بالكامل',
            descriptionEn: 'Repainted / Full Left Lateral Profile Resprayed',
            side: 'left',
            source: 'finding'
          });
        }
      });
      return;
    }

    // Match with dictionary to get standardized names and side
    let matchedPart = BODY_PART_DICTIONARY.find(part =>
      part.keywords.some(k => titleLower.includes(k) || valNormalized.includes(k))
    );

    const partNameAr = matchedPart ? matchedPart.nameAr : cardTitle;
    const partNameEn = matchedPart ? matchedPart.nameEn : cardTitle;
    const partSide = matchedPart ? matchedPart.side : detectSideFromName(cardTitle);

    const conditionText = rawVal || 'رش / سمكرة';
    const key = partNameAr;

    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      damagedPanels.push({
        id: `finding-${sf.findingId}-${Math.random()}`,
        nameAr: partNameAr,
        nameEn: partNameEn,
        type: 'repainted', // All body cards represent repainted/bodywork damages in the report
        descriptionAr: conditionText,
        descriptionEn: 'Repainted / Resprayed Body Panel',
        side: partSide,
        source: 'finding'
      });
    }
  });

  // 2. Process Technician Notes: STRICTLY from the Body section (category_notes[bodyCategoryId])
  const bodyNotes: string[] = [];
  if (customInputOverride?.notesText) {
    bodyNotes.push(customInputOverride.notesText);
  }

  if (request.category_notes) {
    Object.entries(request.category_notes).forEach(([catId, notes]) => {
      const isBody = bodyCategory ? catId === bodyCategory.id : (categories.find(c => c.id === catId)?.name || '').includes('بدي');
      if (isBody && Array.isArray(notes)) {
        notes.forEach((n: any) => {
          const txt = typeof n === 'string' ? n : n?.text;
          if (txt && txt.trim()) bodyNotes.push(txt.trim());
        });
      }
    });
  }

  // Parse body notes
  bodyNotes.forEach(noteText => {
    const noteLower = noteText.toLowerCase();

    // Check if the note specifies a side repaint like "رش جنب يمين"
    if (noteLower.includes('رش جنب يمين') || noteLower.includes('رش الجانب الأيمن')) {
      ENTIRE_RIGHT_SIDE_PANELS.forEach(p => {
        if (!processedKeys.has(p.nameAr)) {
          processedKeys.add(p.nameAr);
          damagedPanels.push({
            id: `note-right-${p.nameAr}-${Math.random()}`,
            nameAr: p.nameAr,
            nameEn: p.nameEn,
            type: 'repainted',
            descriptionAr: noteText,
            descriptionEn: 'Repainted / Full Right Side',
            side: 'right',
            source: 'note'
          });
        }
      });
      return;
    }

    if (noteLower.includes('رش جنب يسار') || noteLower.includes('رش الجانب الأيسر')) {
      ENTIRE_LEFT_SIDE_PANELS.forEach(p => {
        if (!processedKeys.has(p.nameAr)) {
          processedKeys.add(p.nameAr);
          damagedPanels.push({
            id: `note-left-${p.nameAr}-${Math.random()}`,
            nameAr: p.nameAr,
            nameEn: p.nameEn,
            type: 'repainted',
            descriptionAr: noteText,
            descriptionEn: 'Repainted / Full Left Side',
            side: 'left',
            source: 'note'
          });
        }
      });
      return;
    }

    // Check specific components mentioned in notes (e.g., الزجاج الأمامي, الواجهة)
    let matchedInNote = false;
    BODY_PART_DICTIONARY.forEach(part => {
      if (part.keywords.some(k => noteLower.includes(k))) {
        matchedInNote = true;
        const isRepaint = noteLower.includes('رش') || noteLower.includes('معجون') || noteLower.includes('صبغ');
        const key = `${part.nameAr}-${isRepaint ? 'repainted' : 'defect'}`;
        if (!processedKeys.has(key)) {
          processedKeys.add(key);
          damagedPanels.push({
            id: `note-${part.nameAr}-${Math.random()}`,
            nameAr: part.nameAr,
            nameEn: part.nameEn,
            type: isRepaint ? 'repainted' : 'defect',
            descriptionAr: noteText,
            descriptionEn: isRepaint ? 'Repainted Panel' : 'Technical Note / Non-Paint Defect',
            side: part.side,
            source: 'note'
          });
        }
      }
    });

    // If general body note without specific part (e.g. "حكات دقات خفيفة في البدي"):
    if (!matchedInNote) {
      damagedPanels.push({
        id: `note-general-body-${Math.random()}`,
        nameAr: 'ملاحظات عامة على الهيكل',
        nameEn: 'General Exterior Body Condition',
        type: noteLower.includes('رش') ? 'repainted' : 'defect',
        descriptionAr: noteText,
        descriptionEn: 'Minor scratches/dents or cosmetic body note',
        side: 'general',
        source: 'note'
      });
    }
  });

  // Calculate counts
  const repaintedCount = damagedPanels.filter(p => p.type === 'repainted').length;
  const defectCount = damagedPanels.filter(p => p.type === 'defect').length;
  const intactCount = intactPanels.length;

  // Determine affected sides
  const sidesSet = new Set<CarSide>();
  damagedPanels.forEach(p => {
    if (p.side !== 'general') sidesSet.add(p.side);
  });
  const activeSides = Array.from(sidesSet);

  // Dynamic Camera Viewport Selection Logic
  let recommendedViewport = {
    titleAr: 'منظور متكامل ثلاثي الأبعاد للهيكل',
    titleEn: '3D Full Exploded Isometric View',
    description: 'عرض هيكلي متوازن لجميع ألواح السيارة لعدم وجود أضرار مركزة في جهة واحدة.'
  };

  if (activeSides.length === 1) {
    const singleSide = activeSides[0];
    if (singleSide === 'left') {
      recommendedViewport = {
        titleAr: 'منظور جانبي أيسر مخصص (Left Lateral Profile)',
        titleEn: 'Dedicated Left Lateral Profile View',
        description: 'تركيز الكاميرا بالكامل على الجانب الأيسر لإظهار الألواح المتضررة بدقة.'
      };
    } else if (singleSide === 'right') {
      recommendedViewport = {
        titleAr: 'منظور جانبي أيمن مخصص (Right Lateral Profile)',
        titleEn: 'Dedicated Right Lateral Profile View',
        description: 'تركيز الكاميرا بالكامل على الجانب الأيمن لإظهار الألواح المتضررة بدقة.'
      };
    } else if (singleSide === 'front') {
      recommendedViewport = {
        titleAr: 'منظور أمامي مائل مخصص (Front-Quarter Perspective)',
        titleEn: 'Dedicated Front-Quarter / Front Perspective View',
        description: 'توجيه الكاميرا نحو الواجهة والكبوت والصدام الأمامي لعرض تفاصيل الضرر.'
      };
    } else if (singleSide === 'rear') {
      recommendedViewport = {
        titleAr: 'منظور خلفي مائل مخصص (Rear-Quarter Perspective)',
        titleEn: 'Dedicated Rear-Quarter / Rear Perspective View',
        description: 'توجيه الكاميرا نحو الجهة الخلفية والشنطة والصدام لعرض الأجزاء الملاحظ عليها.'
      };
    } else if (singleSide === 'roof') {
      recommendedViewport = {
        titleAr: 'منظور علوي مباشر (Orthographic Roof View)',
        titleEn: 'Dedicated Top-down / High-Angle Orthographic Roof View',
        description: 'زاوية كاميرا رأسية عالية لتوضيح سقف المركبة.'
      };
    }
  } else if (activeSides.length > 1) {
    // If damage spans rear and right (like in the user's report image)
    if (activeSides.includes('rear') && activeSides.includes('right') && !activeSides.includes('left')) {
      recommendedViewport = {
        titleAr: 'منظور خلفي-أيمن مائل مخصص (Rear-Right Perspective View)',
        titleEn: 'Dedicated Rear-Right 3/4 Perspective View',
        description: 'توجيه الكاميرا بدقة نحو الشنطة والرفرف الخلفي الأيمن والقائم الأيمن مع استبعاد الجانب الأيسر السليم.'
      };
    } else {
      recommendedViewport = {
        titleAr: 'شبكة زوايا ديناميكية مجمعة (Cohesive Multi-Angle Layout)',
        titleEn: 'Cohesive Multi-Angle Dynamic Technical Layout',
        description: `عرض الزوايا المتضررة فقط (${activeSides.map(translateSide).join(' و ')}) واستبعاد الزوايا السليمة تماماً.`
      };
    }
  }

  // Build the strict technical prompt
  const prompt = buildTechnicalExplodedPrompt({
    carTitle: fullCarTitle,
    damagedPanels,
    activeSides,
    viewport: recommendedViewport.titleEn,
  });

  return {
    carName,
    carModelYear,
    damagedPanels,
    intactPanels,
    repaintedCount,
    defectCount,
    intactCount,
    activeSides,
    recommendedViewport,
    prompt,
    rawFindingsCount: bodyFindings.length,
    rawNotesCount: bodyNotes.length
  };
}

function translateSide(side: CarSide): string {
  switch (side) {
    case 'left': return 'الجانب الأيسر';
    case 'right': return 'الجانب الأيمن';
    case 'front': return 'الواجهة الأمامية';
    case 'rear': return 'الجهة الخلفية';
    case 'roof': return 'السقف';
    default: return 'ألواح الهيكل';
  }
}

/**
 * Builds the exact technical exploded 3D prompt according to the user's specification.
 */
function buildTechnicalExplodedPrompt(params: {
  carTitle: string;
  damagedPanels: DamagedPanel[];
  activeSides: CarSide[];
  viewport: string;
}): string {
  const { carTitle, damagedPanels, viewport } = params;

  // Format list of repainted panels
  const repaintedList = damagedPanels
    .filter(p => p.type === 'repainted')
    .map(p => `- ${p.nameAr} (${p.nameEn}): ${p.descriptionAr}`)
    .join('\n');

  // Format list of defect/mechanical/structural panels
  const defectList = damagedPanels
    .filter(p => p.type === 'defect')
    .map(p => `- ${p.nameAr} (${p.nameEn}): ${p.descriptionAr}`)
    .join('\n');

  return `[Role & Context]
You are a top-tier automotive engineering visualizer and 3D technical illustrator. Your objective is to process vehicle inspection reports and automatically render precise, dynamic 3D exploded technical diagrams (3D Exploded View) of the car's exterior body based strictly on the reported damages and locations.

[Vehicle Specification]
Vehicle: ${carTitle || 'Modern Sedan'}

[Dynamic Camera Angle & Composition Rules - CRITICAL]
- DYNAMIC VIEWPORT SELECTION: ${viewport}.
  * Render ONLY the specific view angle(s) relevant to the damaged sections listed in the input data:
  * If damages are on the RIGHT/REAR side -> Focus strictly on Rear-Right Perspective.
  * Completely avoid showing angles that have zero reported damages.

[Visual Style, Wheels & Realistic Colors]
- Rendering Style: Clean 3D Exploded View / Technical Diagram (ألواح الهيكل التفكيكية العائمة بدقة هندسية).
- Component Isolation: Completely HIDE and omit all internal mechanical components, engine bay internals, suspension, and drivetrain. Render exterior body panels, light assemblies, side mirrors, bumpers, AND fully visible wheel assemblies (tires and alloy rims with realistic textures).
- Realistic Colors & Materials: Use realistic, natural color tones, authentic paint gloss/reflections, and rich material shaders for the vehicle, wheels, and glass, combined with professional studio lighting and soft contact shadows.
- Background: Clean studio white background (#FFFFFF) with neutral, diffused studio lighting.

[Strict Color-Coding Legend]
1. Intact / Undamaged Parts: Realistic factory clean white body color with precise thin charcoal outline contours.
2. Sprayed / Repainted Panels (الرش): Highlighted strictly in vibrant, high-contrast Red (#FF0000) with realistic paint gloss.
3. Non-Paint Defect / Mechanical & Structural Notes (e.g., disassembly, internal adjustment, cracks, dents, loose bolts, sandblast pitting): Highlighted strictly in high-visibility Amber / Bright Orange (#FF8C00) or tagged with an orange outline glow.

[Bilingual Annotation & Labeling System]
- Draw thin, clean technical leader lines pointing directly from the affected body panel to floating annotation callout boxes.
- Labels MUST be bilingual (Arabic & English) stating the exact component name and condition.

[INSPECTION DAMAGE DATA TO RENDER]
${repaintedList ? `* REPAINTED / SPRAYED PANELS (RED #FF0000):\n${repaintedList}` : '* No repainted panels reported.'}

${defectList ? `* NON-PAINT DEFECTS / DENTS / ADJUSTMENTS (AMBER #FF8C00):\n${defectList}` : '* No body dents or mechanical adjustments reported.'}

${damagedPanels.length === 0 ? '* All body panels intact in clean factory white.' : ''}
`;
}

/**
 * Generates the Exploded View image using Gemini Image API
 */
export async function generateCarExplodedImage(
  apiKey: string,
  prompt: string,
  options?: { aspectRatio?: '1:1' | '4:3' | '16:9' }
): Promise<{ imageUrl: string; promptUsed: string }> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('مفتاح API الخاص بمولد الصور مفقود. يرجى إدخاله في الإعدادات > ربط الخدمات (API).');
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const aspectRatio = options?.aspectRatio || '4:3';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio,
        },
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content?.parts) {
      throw new Error('لم يتم استلام محتوى صالح من نموذج التوليد.');
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.data) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        return {
          imageUrl: `data:${mimeType};base64,${part.inlineData.data}`,
          promptUsed: prompt,
        };
      }
    }

    const textPart = candidate.content.parts.find(p => p.text)?.text;
    if (textPart) {
      throw new Error(`أرجع النموذج رداً نصياً بدلاً من الصورة: ${textPart.substring(0, 120)}...`);
    }

    throw new Error('لم تحتوي الاستجابة على جزء صورة (Image InlineData).');
  } catch (error: any) {
    console.error('Error generating car exploded image:', error);
    const msg = error?.message || String(error);
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
      throw new Error('مفتاح API غير صالح. يرجى التحقق من المفتاح في الإعدادات.');
    }
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      throw new Error('تم استنفاد الحصة المخصصة لمفتاح API حالياً. يرجى التحقق من الحساب أو المحاولة لاحقاً.');
    }
    throw new Error(`فشل توليد الصورة: ${msg}`);
  }
}

/**
 * Downloads a base64 or URL image directly to the client's device
 */
export function downloadImageFile(imageUrl: string, filename: string = 'car-body-3d-diagram.png') {
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
