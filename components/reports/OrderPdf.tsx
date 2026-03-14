
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font, Svg, Path, Circle } from '@react-pdf/renderer';
import { InspectionRequest, Client, Car, CarMake, CarModel, InspectionType, CustomFindingCategory, PredefinedFinding, Settings, Note, StructuredFinding, ReportSettings, HighlightColor } from '../../types';

// Register Arabic Font (Tajawal)
Font.register({
  family: 'Tajawal',
  fonts: [
    { src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Regular.ttf', fontWeight: 'normal' },
    { src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Bold.ttf', fontWeight: 'bold' },
  ],
});

const highlightBaseColors: Record<HighlightColor, { rgb: string; text: string }> = {
  yellow: { rgb: '250, 204, 21', text: '#422006' },
  red: { rgb: '239, 68, 68', text: '#450a0a' },
  green: { rgb: '34, 197, 94', text: '#052e16' },
  blue: { rgb: '59, 130, 246', text: '#172554' },
};

/**
 * إعدادات التحكم في تصميم وتنسيق الحاويات (Manual Layout Control)
 * تسمح بتعديل الخطوط، الأحجام، والمسافات لكل حاوية من مكان واحد.
 */
const layoutSettings = {
  // 1. حاوية بيانات السيارة (Vehicle Info)
  vehicle: {
    fontSize: {
      title: 10,      // عنوان الحاوية
      contentAr: 11,  // النصوص العربية
      contentEn: 14,  // النصوص الإنجليزية
      badge: 9        // نصوص البطاقات الصغيرة (سنة الصنع)
    },
    container: {
      width: '66%',   // العرض
      height: 'auto', // الارتفاع
      padding: 8      // المسافات الداخلية (Padding)
    },
    spacing: {
      columnGap: 20,  // المسافة بين الأعمدة داخل الحاوية
      headerGap: 4,   // المسافة أسفل العنوان
      dividerMargin: 5 // المسافة حول الخط الفاصل
    },
    elements: {
      iconSize: 14,   // حجم الأيقونات
      logoHeight: 40  // ارتفاع شعار السيارة
    }
  },
  // 2. حاوية بيانات العميل (Customer Info)
  customer: {
    fontSize: {
      title: 10,      // عنوان الحاوية
      content: 8,     // القيم
      label: 8        // التسميات (الاسم، الجوال...)
    },
    container: {
      width: '100%',
      height: 'auto',
      padding: 5
    },
    spacing: {
      gap: 20,        // المسافة بين العناصر (الاسم والجوال)
      headerGap: 3,   // المسافة أسفل العنوان
      dividerMargin: 4 // المسافة حول الخط الفاصل
    },
    elements: {
      iconSize: 14
    }
  },
  // 3. حاوية بيانات الطلب (Order Info)
  order: {
    fontSize: {
      title: 10,      // عنوان الحاوية
      content: 8.0,   // القيم
      label: 7.5      // التسميات
    },
    container: {
      width: '32%',
      height: 'auto',
      padding: 8
    },
    spacing: {
      rowGap: 4,      // المسافة بين أسطر البيانات
      headerGap: 4,   // المسافة أسفل العنوان
      dividerMargin: 7 // المسافة أسفل الخط الفاصل
    },
    elements: {
      iconSize: 14
    }
  },
  // 4. حاويات الأقسام (Section/Category Containers)
  sections: {
    fontSize: {
      mainHeader: 9,  // "نتائج الفحص الفني"
      title: 9,       // عنوان القسم (المجرك، البودي...)
      findingName: 7, // اسم الفحص داخل القسم
      findingValue: 6.5, // حالة الفحص (سليم/تالف)
      technicianNotesHeader: 9, // عنوان "ملاحظات الفني" داخل القسم
      imageNoteCategory: 7 // اسم القسم في كروت الصور المرفقة
    },
    container: {
      marginBottom: 10,
      padding: 8
    }
  },
  // 5. الملاحظات (General Notes)
  notes: {
    fontSize: {
      content: 9,     // نص الملاحظة
      watermark: 22   // حجم العلامة المائية خلف الملاحظات
    },
    container: {
      padding: 10,
      marginHorizontal: 4,
      marginTop: 4
    },
    spacing: {
      rowGap: 4,
      bulletMargin: 8
    }
  },
  // 6. الهيدر والعناصر العامة (Header & General Elements)
  header: {
    elements: {
      qrSize: 80,      // حجم رمز الاستجابة السريعة (QR Code Size)
      logoHeight: 80,  // ارتفاع الشعار (Logo Height)
    }
  }
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 25,
    paddingBottom: 20,
    paddingHorizontal: 20,
    fontFamily: 'Tajawal',
    fontSize: 10,
    color: '#334155',
    backgroundColor: '#ffffff',
    direction: 'rtl',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 10,
    marginBottom: 15,
  },
  headerInfo: {
    flex: 1,
    textAlign: 'right',
  },
  headerCustomFieldsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#c02626',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 5,
  },
  headerCustomField: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 2,
  },
  headerLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    height: layoutSettings.header.elements.logoHeight,
    width: 'auto',
    objectFit: 'contain',
  },
  qrCode: {
    width: layoutSettings.header.elements.qrSize,
    height: layoutSettings.header.elements.qrSize,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 2,
  },
  section: {
    marginBottom: 10,
  },
  clientDataContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: layoutSettings.customer.container.padding,
    marginBottom: 4,
    width: layoutSettings.customer.container.width,
    height: layoutSettings.customer.container.height,
  },
  clientDataHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: layoutSettings.customer.spacing.headerGap,
  },
  clientDataTitle: {
    fontSize: layoutSettings.customer.fontSize.title,
    fontWeight: 'bold',
    marginRight: 4,
  },
  clientDataIcon: {
    width: layoutSettings.customer.elements.iconSize,
    height: layoutSettings.customer.elements.iconSize,
  },
  clientDataDivider: {
    height: 1,
    marginBottom: layoutSettings.customer.spacing.dividerMargin,
    marginTop: 2,
  },
  clientDataBody: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: layoutSettings.customer.spacing.gap,
  },
  clientDataRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  clientDataLabel: {
    fontSize: layoutSettings.customer.fontSize.label,
    color: '#64748b',
    fontWeight: 'bold',
  },
  clientDataValue: {
    fontSize: layoutSettings.customer.fontSize.content,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  carDataContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: layoutSettings.vehicle.container.padding,
    width: layoutSettings.vehicle.container.width,
    height: layoutSettings.vehicle.container.height,
  },
  carDataHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: layoutSettings.vehicle.spacing.headerGap,
  },
  carDataTitle: {
    fontSize: layoutSettings.vehicle.fontSize.title,
    fontWeight: 'bold',
    marginRight: 4,
  },
  carDataIcon: {
    width: layoutSettings.vehicle.elements.iconSize,
    height: layoutSettings.vehicle.elements.iconSize,
  },
  carDataDivider: {
    height: 1,
    marginBottom: layoutSettings.vehicle.spacing.dividerMargin,
    marginTop: 2,
  },
  carDataBody: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: layoutSettings.vehicle.spacing.columnGap,
  },
  carLogoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carInfo: {
    width: '35%',
    textAlign: 'right',
  },
  carNameEn: {
    fontSize: layoutSettings.vehicle.fontSize.contentEn,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  carNameAr: {
    fontSize: layoutSettings.vehicle.fontSize.contentAr,
    color: '#64748b',
    marginTop: 1,
  },
  carYearBadge: {
    backgroundColor: '#f1f5f9',
    padding: '1 4',
    borderRadius: 3,
    fontSize: layoutSettings.vehicle.fontSize.badge,
    fontWeight: 'bold',
    marginTop: 3,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  carLogo: {
    height: layoutSettings.vehicle.elements.logoHeight,
    width: 'auto',
  },
  plateContainer: {
    width: '35%',
    borderRightWidth: 1,
    paddingRight: 7,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateBox: {
    flexDirection: 'row-reverse',
    gap: 5,
  },
  plateChar: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  plateCharAr: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  plateCharEn: {
    fontSize: 8,
    color: '#64748b',
  },
  plateDivider: {
    width: '100%',
    height: 1,
    marginVertical: 1,
  },
  sectionHeader: {
    textAlign: 'center',
    padding: 4,
    borderRadius: 3,
    fontSize: layoutSettings.sections.fontSize.mainHeader,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  categorySection: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: layoutSettings.sections.container.marginBottom,
  },
  categoryTitle: {
    padding: 6,
    textAlign: 'center',
    fontSize: layoutSettings.sections.fontSize.title,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  categoryContent: {
    padding: layoutSettings.sections.container.padding,
    position: 'relative',
  },
  orderDataCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: layoutSettings.order.container.padding,
    width: layoutSettings.order.container.width,
    height: layoutSettings.order.container.height,
  },
  orderDataHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: layoutSettings.order.spacing.headerGap,
  },
  orderDataTitle: {
    fontSize: layoutSettings.order.fontSize.title,
    fontWeight: 'bold',
    marginRight: 4,
  },
  orderDataIcon: {
    width: layoutSettings.order.elements.iconSize,
    height: layoutSettings.order.elements.iconSize,
  },
  orderDataDivider: {
    height: 1,
    marginBottom: layoutSettings.order.spacing.dividerMargin,
    marginTop: 3,
  },
  orderDataRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: layoutSettings.order.spacing.rowGap,
    alignItems: 'center',
  },
  orderDataLabel: {
    fontSize: layoutSettings.order.fontSize.label,
    color: '#64748b',
  },
  orderDataValue: {
    fontSize: layoutSettings.order.fontSize.content,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 10,
    gap: 10,
  },
  findingsGrid: {
    padding: 6,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'center',
    marginBottom: 2,
  },
  findingItem: {
    width: '18.5%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    marginBottom: 4,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  findingImage: {
    height: 60,
    width: '100%',
    objectFit: 'contain',
    backgroundColor: '#ffffff',
    padding: 3,
  },
  findingContent: {
    padding: 3,
    backgroundColor: '#f8fafc',
    flexGrow: 1,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  findingName: {
    fontSize: layoutSettings.sections.fontSize.findingName,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1e293b',
  },
  findingValue: {
    fontSize: layoutSettings.sections.fontSize.findingValue,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 1,
  },
  notesSection: {
    marginTop: layoutSettings.notes.container.marginTop,
    padding: layoutSettings.notes.container.padding,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 10,
    backgroundColor: 'transparent',
    position: 'relative',
    marginHorizontal: layoutSettings.notes.container.marginHorizontal,
  },
  noteWatermarkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
    opacity: 0.04,
    zIndex: -1,
  },
  noteWatermarkText: {
    fontSize: layoutSettings.notes.fontSize.watermark,
    fontWeight: 'bold',
    margin: 15,
    transform: 'rotate(-25deg)',
  },
  noteItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: layoutSettings.notes.spacing.rowGap,
  },
  noteBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1e293b',
    marginTop: 5,
    marginLeft: layoutSettings.notes.spacing.bulletMargin,
  },
  noteText: {
    flex: 1,
    fontSize: layoutSettings.notes.fontSize.content,
    lineHeight: 1.4,
    textAlign: 'right',
  },
  highlightedText: {
    paddingHorizontal: 2,
    borderRadius: 2,
    fontWeight: 'bold',
  },
  imageNotesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    padding: 4,
  },
  imageNoteCard: {
    width: '32%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  noteImage: {
    width: '100%',
    height: 90,
    objectFit: 'cover',
  },
  imageNoteContent: {
    padding: 4,
  },
  imageNoteCategory: {
    fontSize: layoutSettings.sections.fontSize.imageNoteCategory,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 1,
    textAlign: 'right',
  },
  footer: {
    marginTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  disclaimer: {
    flex: 1,
    fontSize: 7,
    color: '#64748b',
    lineHeight: 1.4,
    textAlign: 'right',
  },
  stampContainer: {
    width: 80,
    textAlign: 'center',
  },
  stampLabel: {
    fontSize: 7,
    color: '#64748b',
    marginBottom: 2,
  },
  stampImage: {
    width: 60,
    height: 60,
    objectFit: 'contain',
    alignSelf: 'center',
  },
  attachmentPage: {
    padding: 0,
    backgroundColor: '#ffffff',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#94a3b8',
    fontFamily: 'Tajawal',
  },
});

interface OrderPdfProps {
  request: InspectionRequest;
  client: Client;
  car: Car;
  carMake?: CarMake;
  carModel?: CarModel;
  inspectionType: InspectionType;
  customFindingCategories: CustomFindingCategory[];
  predefinedFindings: PredefinedFinding[];
  settings: Settings;
  reportDirection?: 'rtl' | 'ltr';
  qrCodeBase64?: string;
  attachments?: { data: string; type: string; name: string }[];
}

const FormattedPlate = ({ plateNumber, plateCharacters, borderColor }: { plateNumber: string; plateCharacters?: any[]; borderColor: string }) => {
  const parts = plateNumber.split(' ').filter(Boolean);
  const arabicLettersRaw = parts.filter(p => !/^\d+$/.test(p)).join('');
  const numbersRaw = parts.find(p => /^\d+$/.test(p)) || '';

  const arToEnMap = new Map<string, string>();
  if (plateCharacters) {
    plateCharacters.forEach(pc => {
      arToEnMap.set(pc.ar.replace('ـ', ''), pc.en);
    });
  }

  const arabicChars = arabicLettersRaw.split('');
  const numberChars = numbersRaw.split('');

  return (
    <View style={styles.plateBox}>
      {/* Arabic Letters */}
      <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
        {arabicChars.map((char, i) => (
          <View key={i} style={styles.plateChar}>
            <Text style={styles.plateCharAr}>{char}</Text>
            <View style={[styles.plateDivider, { backgroundColor: borderColor }]} />
            <Text style={styles.plateCharEn}>{arToEnMap.get(char) || char}</Text>
          </View>
        ))}
      </View>

      {/* Numbers */}
      <View style={[styles.plateBox, { borderRightWidth: 1, borderRightColor: borderColor, paddingRight: 8, marginRight: 8 }]}>
        {numberChars.map((num, i) => (
          <View key={i} style={styles.plateChar}>
            <Text style={styles.plateCharAr}>{num}</Text>
            <View style={[styles.plateDivider, { backgroundColor: borderColor }]} />
            <Text style={styles.plateCharEn}>{num}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const OrderPdf: React.FC<OrderPdfProps> = ({
  request,
  client,
  car,
  carMake,
  carModel,
  inspectionType,
  customFindingCategories,
  predefinedFindings,
  settings,
  reportDirection = 'rtl',
  qrCodeBase64,
  attachments = []
}) => {
  const { appName, reportSettings } = settings;

  const carDetails = {
    makeNameEn: request.car_snapshot?.make_en || carMake?.name_en || 'Unknown',
    modelNameEn: request.car_snapshot?.model_en || carModel?.name_en || 'Unknown',
    makeNameAr: request.car_snapshot?.make_ar || carMake?.name_ar || 'غير معروف',
    modelNameAr: request.car_snapshot?.model_ar || carModel?.name_ar || 'غير معروف',
    year: request.car_snapshot?.year || car.year,
  };

  const visibleCategoryIds = inspectionType.finding_category_ids;

  const allImageNotes: { note: Note; categoryName: string }[] = [];
  visibleCategoryIds.forEach(catId => {
    const category = customFindingCategories.find(c => c.id === catId);
    if (category) {
      const imageNotes = ((request.category_notes?.[catId] as Note[]) || []).filter(note => !!note.image);
      imageNotes.forEach(note => allImageNotes.push({ note, categoryName: category.name }));
    }
  });
  ((request.general_notes as Note[]) || []).filter(note => !!note.image).forEach(note =>
    allImageNotes.push({ note, categoryName: reportDirection === 'ltr' ? 'General Notes' : 'ملاحظات عامة' })
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLogos}>
            {reportSettings.reportLogoUrl && <Image src={reportSettings.reportLogoUrl} style={styles.logo} />}
            {qrCodeBase64 && <Image src={qrCodeBase64} style={styles.qrCode} />}
          </View>

          <View style={styles.headerInfo}>
            <Text style={[styles.appName, { color: reportSettings.appNameColor || '#2563eb' }]}>{appName}</Text>
            <Text style={styles.headerSubtitle}>{reportSettings.headerSubtitleText}</Text>

            <View style={styles.headerCustomFieldsRow}>
              {reportSettings.headerCustomFields?.map(field => (
                <Text key={field.id} style={styles.headerCustomField}>
                  {field.label}: {field.value}
                </Text>
              ))}
            </View>

            {reportSettings.headerAdditionalTexts?.map(textItem => (
              <Text key={textItem.id} style={[styles.headerCustomField, { fontWeight: textItem.bold ? 'bold' : 'normal' }]}>
                {textItem.text}
              </Text>
            ))}
          </View>
        </View>

        {/* Client Details */}
        <View style={styles.clientDataContainer} wrap={false}>
          <View style={styles.clientDataHeader}>
            <Svg viewBox="0 0 24 24" style={styles.clientDataIcon}>
              <Path
                d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                fill="none"
                stroke={reportSettings.primaryColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle cx="12" cy="7" r="4" fill="none" stroke={reportSettings.primaryColor} strokeWidth="2" />
            </Svg>
            <Text style={[styles.clientDataTitle, { color: reportSettings.primaryColor }]}>{reportDirection === 'ltr' ? "Client Data" : "بيانات العميل"}</Text>
          </View>

          <View style={[styles.clientDataDivider, { backgroundColor: reportSettings.borderColor }]} />

          <View style={styles.clientDataBody}>
            <View style={styles.clientDataRow}>
              <Text style={styles.clientDataLabel}>{reportDirection === 'ltr' ? 'Name:' : 'الاسم:'}</Text>
              <Text style={styles.clientDataValue}>{client.name}</Text>
            </View>
            <View style={styles.clientDataRow}>
              <Text style={styles.clientDataLabel}>{reportDirection === 'ltr' ? 'Phone:' : 'الجوال:'}</Text>
              <Text style={styles.clientDataValue}>{client.phone}</Text>
            </View>
            {reportSettings.showPriceOnReport && (
              <View style={styles.clientDataRow}>
                <Text style={styles.clientDataLabel}>{reportDirection === 'ltr' ? 'Total:' : 'المبلغ:'}</Text>
                <Text style={styles.clientDataValue}>{request.price} {reportDirection === 'ltr' ? 'SAR' : 'ريال'}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Summary Row: Vehicle & Order Data */}
        <View style={styles.summaryRow}>
          {/* Vehicle Details Container */}
          <View style={[styles.carDataContainer, { borderColor: reportSettings.borderColor }]} wrap={false}>
            <View style={styles.carDataHeader}>
              <Svg viewBox="0 0 24 24" style={styles.carDataIcon}>
                <Path
                  d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
                  fill="none"
                  stroke={reportSettings.primaryColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path d="M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="none" stroke={reportSettings.primaryColor} strokeWidth="2" />
                <Path d="M17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="none" stroke={reportSettings.primaryColor} strokeWidth="2" />
                <Path d="M9 17h6" fill="none" stroke={reportSettings.primaryColor} strokeWidth="2" />
              </Svg>
              <Text style={[styles.carDataTitle, { color: reportSettings.primaryColor }]}>{reportDirection === 'ltr' ? "Vehicle Data" : "بيانات السيارة"}</Text>
            </View>

            <View style={[styles.carDataDivider, { backgroundColor: reportSettings.borderColor }]} />

            <View style={styles.carDataBody}>
              <View style={styles.carInfo}>
                <Text style={styles.carNameEn}>{`${carDetails.makeNameEn} ${carDetails.modelNameEn}`}</Text>
                <Text style={styles.carNameAr}>{`${carDetails.makeNameAr} ${carDetails.modelNameAr}`}</Text>
                <View style={styles.carYearBadge}>
                  <Text>{reportDirection === 'ltr' ? 'Year' : 'سنة الصنع'} {carDetails.year}</Text>
                </View>
              </View>

              <View style={styles.carLogoContainer}>
                {carMake?.logo_url && (
                  <Image src={carMake.logo_url} style={styles.carLogo} />
                )}
              </View>

              <View style={[styles.plateContainer, { borderRightColor: reportSettings.borderColor }]}>
                {car.vin || (car.plate_number && car.plate_number.startsWith('شاصي')) ? (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 7, color: '#64748b', marginBottom: 2 }}>VIN</Text>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: 4, borderRadius: 2 }}>
                      {car.vin || car.plate_number?.replace('شاصي ', '')}
                    </Text>
                  </View>
                ) : car.plate_number ? (
                  <FormattedPlate plateNumber={car.plate_number} plateCharacters={settings.plateCharacters} borderColor={reportSettings.borderColor} />
                ) : null}
              </View>
            </View>
          </View>

          {/* Request Info Card */}
          <View style={[styles.orderDataCard, { borderColor: reportSettings.borderColor }]} wrap={false}>
            <View style={styles.orderDataHeader}>
              <Svg viewBox="0 0 24 24" style={styles.orderDataIcon}>
                <Path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                  fill="none"
                  stroke={reportSettings.primaryColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path d="M14 2v6h6" fill="none" stroke={reportSettings.primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M16 13H8" fill="none" stroke={reportSettings.primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M16 17H8" fill="none" stroke={reportSettings.primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M10 9H8" fill="none" stroke={reportSettings.primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.orderDataTitle, { color: reportSettings.primaryColor }]}>{reportDirection === 'ltr' ? "Order Data" : "بيانات الطلب"}</Text>
            </View>

            <View style={[styles.orderDataDivider, { backgroundColor: reportSettings.borderColor }]} />

            <View style={styles.orderDataRow}>
              <Text style={styles.orderDataLabel}>{reportDirection === 'ltr' ? "Report No.:" : "رقم التقرير:"}</Text>
              <Text style={styles.orderDataValue}>#{request.request_number}</Text>
            </View>

            <View style={styles.orderDataRow}>
              <Text style={styles.orderDataLabel}>{reportDirection === 'ltr' ? "Date:" : "التاريخ:"}</Text>
              <Text style={styles.orderDataValue}>{new Date(request.created_at).toLocaleDateString('en-GB')}</Text>
            </View>

            <View style={styles.orderDataRow}>
              <Text style={styles.orderDataLabel}>{reportDirection === 'ltr' ? "Time:" : "الوقت:"}</Text>
              <Text style={styles.orderDataValue}>
                {(() => {
                  const date = new Date(request.created_at);
                  const hours = date.getHours();
                  const minutes = date.getMinutes();
                  const ampm = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = hours % 12 || 12;
                  return `${ampm} ${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                })()}
              </Text>
            </View>

            <View style={styles.orderDataRow}>
              <Text style={styles.orderDataLabel}>{reportDirection === 'ltr' ? "Type:" : "نوع الفحص:"}</Text>
              <Text style={styles.orderDataValue}>{inspectionType.name}</Text>
            </View>
          </View>
        </View>

        {/* Section Title */}
        <Text style={[styles.sectionHeader, { backgroundColor: reportSettings.sectionTitleBackgroundColor, color: reportSettings.sectionTitleFontColor }]}>
          {reportDirection === 'ltr' ? 'Technical Inspection Results' : 'نتائج الفحص الفني'}
        </Text>

        {/* Findings Categories */}
        {visibleCategoryIds.map(catId => {
          const category = customFindingCategories.find(c => c.id === catId);
          if (!category) return null;

          const categoryFindings = (request.structured_findings || []).filter(f => f.categoryId === catId);

          const sortedFindings = categoryFindings.map(finding => {
            const predefined = predefinedFindings.find(pf => pf.id === finding.findingId);
            let positionPriority = 2;
            if (predefined?.report_position === 'right') positionPriority = reportDirection === 'ltr' ? 3 : 1;
            else if (predefined?.report_position === 'left') positionPriority = reportDirection === 'ltr' ? 1 : 3;
            else if (predefined?.report_position === 'center') positionPriority = 2;
            return { finding, predefined, positionPriority };
          }).sort((a, b) => {
            if (a.positionPriority !== b.positionPriority) return a.positionPriority - b.positionPriority;
            return (a.predefined?.orderIndex ?? Number.MAX_SAFE_INTEGER) - (b.predefined?.orderIndex ?? Number.MAX_SAFE_INTEGER);
          });

          const textOnlyNotes = ((request.category_notes?.[catId] as Note[]) || []).filter(note => !note.image);

          if (categoryFindings.length === 0 && textOnlyNotes.length === 0) return null;

          return (
            <View key={catId} style={[styles.categorySection, { borderColor: reportSettings.borderColor }]}>
              <Text
                style={[styles.categoryTitle, { backgroundColor: reportSettings.findingsHeaderBackgroundColor, color: reportSettings.findingsHeaderFontColor, borderBottomColor: reportSettings.borderColor }]}
                minPresenceAhead={20}
              >
                {category.name}
              </Text>

              <View style={styles.categoryContent}>
                {/* Watermark Pattern for the whole category content */}
                <View style={styles.noteWatermarkContainer}>
                  {Array(15).fill(0).map((_, i) => (
                    <Text key={i} style={styles.noteWatermarkText}>{category.name}</Text>
                  ))}
                </View>

                {sortedFindings.length > 0 && (
                  <View style={styles.findingsGrid}>
                    {sortedFindings.map(({ finding, predefined }) => {
                      return (
                        <View key={finding.findingId} style={styles.findingItem} wrap={false}>
                          <View style={styles.findingImage}>
                            {predefined?.reference_image && (
                              <Image src={predefined.reference_image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            )}
                          </View>
                          <View style={styles.findingContent}>
                            <Text style={styles.findingName}>{finding.findingName}</Text>
                            {finding.value && <Text style={styles.findingValue}>{finding.value}</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {textOnlyNotes.length > 0 && (
                  <View style={styles.notesSection}>
                    <Text
                      style={{ fontSize: layoutSettings.sections.fontSize.technicianNotesHeader, fontWeight: 'bold', color: reportSettings.primaryColor, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 2, textAlign: 'right' }}
                      minPresenceAhead={20}
                    >
                      {reportDirection === 'ltr' ? 'Technician Notes:' : 'ملاحظات الفني:'}
                    </Text>
                    {textOnlyNotes.map(note => {
                      const displayText = (note.displayTranslation?.isActive && note.translations?.[note.displayTranslation.lang])
                        ? note.translations[note.displayTranslation.lang]
                        : note.text;

                      const highlight = note.highlightColor ? highlightBaseColors[note.highlightColor] : null;

                      return (
                        <View key={note.id} style={styles.noteItem} wrap={false}>
                          <View style={styles.noteBullet} />
                          <Text style={[
                            styles.noteText,
                            highlight ? {
                              backgroundColor: `rgba(${highlight.rgb}, 0.1)`,
                              color: highlight.text,
                              padding: 2,
                              borderRadius: 2,
                              fontWeight: 'bold'
                            } : {}
                          ]}>
                            {displayText}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* General Notes */}
        {((request.general_notes as Note[]) || []).filter(n => !n.image).length > 0 && (
          <View style={[styles.categorySection, { borderColor: reportSettings.borderColor }]}>
            <Text
              style={[styles.categoryTitle, { backgroundColor: reportSettings.findingsHeaderBackgroundColor, color: reportSettings.findingsHeaderFontColor, borderBottomColor: reportSettings.borderColor }]}
              minPresenceAhead={20}
            >
              {reportDirection === 'ltr' ? "General Notes" : "ملاحظات عامة"}
            </Text>
            <View style={styles.categoryContent}>
              {/* Watermark Pattern */}
              <View style={styles.noteWatermarkContainer}>
                {Array(15).fill(0).map((_, i) => (
                  <Text key={i} style={styles.noteWatermarkText}>{reportDirection === 'ltr' ? "General" : "عام"}</Text>
                ))}
              </View>
              <View style={styles.notesSection}>
                {((request.general_notes as Note[]) || []).filter(n => !n.image).map(note => {
                  const displayText = (note.displayTranslation?.isActive && note.translations?.[note.displayTranslation.lang])
                    ? note.translations[note.displayTranslation.lang]
                    : note.text;
                  const highlight = note.highlightColor ? highlightBaseColors[note.highlightColor] : null;

                  return (
                    <View key={note.id} style={styles.noteItem} wrap={false}>
                      <View style={styles.noteBullet} />
                      <Text style={[
                        styles.noteText,
                        highlight ? {
                          backgroundColor: `rgba(${highlight.rgb}, 0.1)`,
                          color: highlight.text,
                          padding: 2,
                          borderRadius: 2,
                          fontWeight: 'bold'
                        } : {}
                      ]}>
                        {displayText}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Image Notes */}
        {allImageNotes.length > 0 && (
          <View style={[styles.categorySection, { borderColor: reportSettings.borderColor }]}>
            <Text style={[styles.categoryTitle, { backgroundColor: reportSettings.findingsHeaderBackgroundColor, color: reportSettings.findingsHeaderFontColor, borderBottomColor: reportSettings.borderColor }]}>{reportDirection === 'ltr' ? "Attachments" : "الصور والملاحظات المرفقة"}</Text>
            <View style={styles.imageNotesGrid}>
              {allImageNotes.map(({ note, categoryName }, idx) => (
                <View key={idx} style={styles.imageNoteCard} wrap={false}>
                  {note.image && <Image src={note.image} style={styles.noteImage} />}
                  <View style={styles.imageNoteContent}>
                    <Text style={styles.imageNoteCategory}>{categoryName}</Text>
                    <Text style={styles.noteText}>{note.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} wrap={false}>
          <View style={styles.stampContainer}>
            <Text style={styles.stampLabel}>{reportDirection === 'ltr' ? 'Stamp' : 'ختم الورشة'}</Text>
            {reportSettings.workshopStampUrl ? (
              <Image src={reportSettings.workshopStampUrl} style={styles.stampImage} />
            ) : (
              <View style={{ width: 60, height: 60, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 6, color: '#94a3b8' }}>{reportDirection === 'ltr' ? 'Stamp Here' : 'مكان الختم'}</Text>
              </View>
            )}
          </View>
          <View style={styles.disclaimer}>
            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>
              {reportDirection === 'ltr' ? 'Disclaimer:' : 'إخلاء مسؤولية:'}
            </Text>
            <Text>{reportSettings.disclaimerText}</Text>
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `${pageNumber} / ${totalPages}`
        )} fixed />
      </Page>

      {/* Attachment Pages */}
      {attachments.map((file, idx) => (
        <Page key={idx} size="A4" style={styles.attachmentPage}>
          <Image src={file.data} style={styles.attachmentImage} />
        </Page>
      ))}
    </Document>
  );
};

export default OrderPdf;
