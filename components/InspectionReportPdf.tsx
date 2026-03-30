
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { InspectionRequest, Client, Car, CarMake, CarModel, InspectionType, CustomFindingCategory, PredefinedFinding, Settings, Note, StructuredFinding, ReportSettings, HighlightColor } from '../types';

// Register Arabic Font
Font.register({
  family: 'Tajawal',
  fonts: [
    { 
      src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Regular.ttf', 
      fontWeight: 'normal',
    },
    { 
      src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Bold.ttf', 
      fontWeight: 'bold',
    },
  ],
});

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Tajawal',
    fontSize: 10,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 10,
  },
  headerLeft: {
    width: '25%',
  },
  headerCenter: {
    width: '20%',
    alignItems: 'center',
  },
  headerRight: {
    width: '50%',
    alignItems: 'flex-end',
  },
  logo: {
    width: 100,
    height: 'auto',
  },
  qrCode: {
    width: 60,
    height: 60,
    border: '1px solid #e2e8f0',
    padding: 2,
  },
  centerName: {
    fontSize: 24,
    color: '#c02626', // Red from image
    fontWeight: 'bold',
    marginBottom: 2,
  },
  centerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 5,
  },
  centerInfo: {
    flexDirection: 'row',
    fontSize: 9,
    color: '#64748b',
    gap: 10,
  },
  
  // Section Styles
  sectionBox: {
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: '5 10',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #f1f5f9',
    gap: 5,
  },
  sectionTitleText: {
    color: '#0d9488', // Teal from image
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionContent: {
    padding: 10,
  },
  
  // Info Grid
  infoRow: {
    flexDirection: 'row-reverse',
    marginBottom: 4,
  },
  infoLabel: {
    width: '30%',
    color: '#64748b',
    fontSize: 9,
    textAlign: 'right',
  },
  infoValue: {
    width: '70%',
    color: '#1e293b',
    fontSize: 10,
    textAlign: 'right',
    fontWeight: 'bold',
  },

  // Results Header
  resultsHeader: {
    backgroundColor: '#e0f2fe', // Light blue background
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  resultsHeaderText: {
    color: '#0d9488',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Category Header
  categoryHeader: {
    backgroundColor: '#0d9488', // Teal background
    padding: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryHeaderText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Findings
  findingCategory: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    marginBottom: 10,
    overflow: 'hidden',
  },
  findingCategoryHeader: {
    backgroundColor: '#0d9488',
    padding: 5,
    textAlign: 'center',
  },
  findingCategoryTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  findingCategoryContent: {
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  findingCard: {
    width: '18%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  findingImageContainer: {
    height: 50,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  findingImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  findingTextContainer: {
    backgroundColor: '#f8fafc',
    padding: 4,
    alignItems: 'center',
  },
  findingTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  findingValue: {
    fontSize: 7,
    color: '#64748b',
    textAlign: 'center',
  },
  noFindings: {
    padding: 20,
    alignItems: 'center',
  },
  noFindingsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  noteSection: {
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
    borderRadius: 6,
  },
  noteTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 2,
    marginBottom: 4,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  bullet: {
    width: 4,
    height: 4,
    backgroundColor: '#94a3b8',
    borderRadius: 2,
    marginTop: 4,
    marginRight: 6,
    marginLeft: 6,
  },
  noteText: {
    fontSize: 9,
    color: '#334155',
    flex: 1,
  },
  imageNoteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  imageNoteCard: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  imageNoteImage: {
    width: '100%',
    height: 80,
    objectFit: 'cover',
  },
  imageNoteContent: {
    padding: 6,
    alignItems: 'center',
  },
  imageNoteCategory: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  imageNoteText: {
    fontSize: 8,
    color: '#334155',
    textAlign: 'center',
  },
  footer: {
    marginTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  disclaimer: {
    flex: 1,
    fontSize: 8,
    color: '#64748b',
    lineHeight: 1.4,
  },
  stampContainer: {
    width: 80,
    alignItems: 'center',
  },
  stampTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 4,
  },
  stampImage: {
    width: 60,
    height: 60,
    objectFit: 'contain',
  },
  stampPlaceholder: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampPlaceholderText: {
    fontSize: 8,
    color: '#94a3b8',
  },
  attachmentPage: {
    padding: 0,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  }
});

interface InspectionReportPdfProps {
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
  qrCodeDataUrl?: string;
}

const InspectionReportPdf: React.FC<InspectionReportPdfProps> = ({
  request, client, car, carMake, carModel, inspectionType,
  customFindingCategories, predefinedFindings, settings, reportDirection = 'rtl',
  qrCodeDataUrl
}) => {
  const { appName, reportSettings } = settings;
  const isRtl = reportDirection === 'rtl';

  const carDetails = {
    makeNameEn: request.car_snapshot?.make_en || carMake?.name_en || 'Unknown',
    modelNameEn: request.car_snapshot?.model_en || carModel?.name_en || 'Unknown',
    makeNameAr: request.car_snapshot?.make_ar || carMake?.name_ar || 'غير معروف',
    modelNameAr: request.car_snapshot?.model_ar || carModel?.name_ar || 'غير معروف',
    year: request.car_snapshot?.year || car.year,
  };

  const visibleCategoryIds = inspectionType.finding_category_ids;

  const allImageNotes = (() => {
    const collectedNotes: { note: Note; categoryName: string }[] = [];
    visibleCategoryIds.forEach(catId => {
      const category = customFindingCategories.find(c => c.id === catId);
      if (category) {
        const imageNotes = ((request.category_notes?.[catId] as Note[]) || []).filter(note => !!note.image);
        imageNotes.forEach(note => collectedNotes.push({ note, categoryName: category.name }));
      }
    });
    ((request.general_notes as Note[]) || []).filter(note => !!note.image).forEach(note => collectedNotes.push({ note, categoryName: isRtl ? 'ملاحظات عامة' : 'General Notes' }));
    return collectedNotes;
  })();

  const generalTextOnlyNotes = ((request.general_notes as Note[]) || []).filter(note => !note.image);

  const validAttachments = (request.attached_files || []).filter(f => f.type !== 'internal_draft');

  return (
    <Document>
      <Page size="A4" style={[styles.page, { direction: reportDirection }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {reportSettings.reportLogoUrl && (
              <Image src={reportSettings.reportLogoUrl} style={styles.logo} />
            )}
          </View>
          <View style={styles.headerCenter}>
            {qrCodeDataUrl && (
              <Image src={qrCodeDataUrl} style={styles.qrCode} />
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.centerName}>{appName}</Text>
            <Text style={styles.centerSubtitle}>{reportSettings.headerSubtitleText}</Text>
            <View style={styles.centerInfo}>
              {reportSettings.headerCustomFields?.map(field => (
                <Text key={field.id}>
                  {field.label}: {field.value}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* Client Info - Full Width */}
        <View style={styles.sectionBox}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitleText}>{isRtl ? 'بيانات العميل' : 'Client Info'}</Text>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{isRtl ? 'الاسم:' : 'Name:'}</Text>
              <Text style={styles.infoValue}>{client.name}</Text>
              <Text style={[styles.infoLabel, { marginLeft: 20 }]}>{isRtl ? 'الجوال:' : 'Phone:'}</Text>
              <Text style={styles.infoValue}>{client.phone}</Text>
            </View>
          </View>
        </View>

        {/* Request & Car Info - Side by Side */}
        <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 10 }}>
          {/* Request Info */}
          <View style={[styles.sectionBox, { flex: 1 }]}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitleText}>{isRtl ? 'بيانات الطلب' : 'Request Info'}</Text>
            </View>
            <View style={styles.sectionContent}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{isRtl ? 'رقم التقرير:' : 'Report No:'}</Text>
                <Text style={styles.infoValue}>#{request.request_number}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{isRtl ? 'التاريخ:' : 'Date:'}</Text>
                <Text style={styles.infoValue}>{new Date(request.created_at).toLocaleDateString('en-GB')}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{isRtl ? 'الوقت:' : 'Time:'}</Text>
                <Text style={styles.infoValue}>{new Date(request.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{isRtl ? 'نوع الفحص:' : 'Type:'}</Text>
                <Text style={styles.infoValue}>{inspectionType.name}</Text>
              </View>
            </View>
          </View>

          {/* Car Info */}
          <View style={[styles.sectionBox, { flex: 2 }]}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitleText}>{isRtl ? 'بيانات السيارة' : 'Car Info'}</Text>
            </View>
            <View style={[styles.sectionContent, { flexDirection: 'row-reverse', justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 }}>
                  {carDetails.makeNameAr} {carDetails.modelNameAr}
                </Text>
                <View style={{ backgroundColor: '#f1f5f9', padding: '4 8', borderRadius: 4, alignSelf: 'flex-end' }}>
                  <Text style={{ fontSize: 10 }}>{isRtl ? 'سنة الصنع' : 'Year'} {carDetails.year}</Text>
                </View>
              </View>
              <View style={{ width: 100, alignItems: 'center', justifyContent: 'center' }}>
                {/* Plate Number Placeholder or Icon */}
                <View style={{ border: '1px solid #cbd5e1', padding: 5, borderRadius: 4, width: '100%', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{car.plate_number || '---'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Technical Inspection Results Header */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsHeaderText}>
            {isRtl ? 'نتائج الفحص الفني' : 'Technical Inspection Results'}
          </Text>
        </View>

        {/* Categories */}
        {visibleCategoryIds.map(catId => {
          const category = customFindingCategories.find(c => c.id === catId);
          if (!category) return null;
          
          const findings = (request.structured_findings || []).filter(f => f.categoryId === catId);
          const textOnlyNotes = ((request.category_notes?.[catId] as Note[]) || []).filter(note => !note.image);

          if (findings.length === 0 && textOnlyNotes.length === 0) {
            return (
              <View key={catId} style={styles.findingCategory}>
                <View style={styles.findingCategoryHeader}>
                  <Text style={styles.findingCategoryTitle}>{category.name}</Text>
                </View>
                <View style={styles.noFindings}>
                  <Text style={styles.noFindingsText}>{isRtl ? 'بدون ملاحظات' : 'No Issues Found'}</Text>
                </View>
              </View>
            );
          }

          return (
            <View key={catId} style={styles.findingCategory} wrap={false}>
              <View style={styles.findingCategoryHeader}>
                <Text style={styles.findingCategoryTitle}>{category.name}</Text>
              </View>
              <View style={styles.findingCategoryContent}>
                {findings.map(finding => {
                  const predefined = predefinedFindings.find(pf => pf.id === finding.findingId);
                  return (
                    <View key={finding.findingId} style={styles.findingCard}>
                      <View style={styles.findingImageContainer}>
                        {predefined?.reference_image ? (
                          <Image src={predefined.reference_image} style={styles.findingImage} />
                        ) : (
                          <Text style={{ fontSize: 6, color: '#cbd5e1' }}>No Img</Text>
                        )}
                      </View>
                      <View style={styles.findingTextContainer}>
                        <Text style={styles.findingTitle}>{finding.findingName}</Text>
                        {finding.value && <Text style={styles.findingValue}>{finding.value}</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
              
              {textOnlyNotes.length > 0 && (
                <View style={styles.noteSection}>
                  <Text style={[styles.noteTitle, { textAlign: isRtl ? 'right' : 'left' }]}>
                    {isRtl ? 'ملاحظات الفني:' : 'Technician Notes:'}
                  </Text>
                  {textOnlyNotes.map(note => (
                    <View key={note.id} style={[styles.noteItem, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                      <View style={styles.bullet} />
                      <Text style={[styles.noteText, { textAlign: isRtl ? 'right' : 'left' }]}>{note.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* General Notes */}
        {generalTextOnlyNotes.length > 0 && (
          <View style={styles.findingCategory} wrap={false}>
            <View style={styles.findingCategoryHeader}>
              <Text style={styles.findingCategoryTitle}>{isRtl ? 'ملاحظات عامة' : 'General Notes'}</Text>
            </View>
            <View style={styles.noteSection}>
              {generalTextOnlyNotes.map(note => (
                <View key={note.id} style={[styles.noteItem, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <View style={styles.bullet} />
                  <Text style={[styles.noteText, { textAlign: isRtl ? 'right' : 'left' }]}>{note.text}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Image Notes */}
        {allImageNotes.length > 0 && (
          <View style={styles.findingCategory} wrap={false}>
            <View style={styles.findingCategoryHeader}>
              <Text style={styles.findingCategoryTitle}>{isRtl ? 'الصور والملاحظات المرفقة' : 'Attachments'}</Text>
            </View>
            <View style={styles.imageNoteGrid}>
              {allImageNotes.map(({ note, categoryName }, idx) => (
                <View key={idx} style={styles.imageNoteCard}>
                  {note.image && <Image src={note.image} style={styles.imageNoteImage} />}
                  <View style={styles.imageNoteContent}>
                    <Text style={styles.imageNoteCategory}>{categoryName}</Text>
                    <Text style={styles.imageNoteText}>{note.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={[styles.footer, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <View style={[styles.disclaimer, { textAlign: isRtl ? 'right' : 'left' }]}>
            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{isRtl ? 'إخلاء مسؤولية:' : 'Disclaimer:'}</Text>
            <Text>{reportSettings.disclaimerText}</Text>
          </View>
          <View style={styles.stampContainer}>
            <Text style={styles.stampTitle}>{isRtl ? 'ختم الورشة' : 'Stamp'}</Text>
            {reportSettings.workshopStampUrl ? (
              <Image src={reportSettings.workshopStampUrl} style={styles.stampImage} />
            ) : (
              <View style={styles.stampPlaceholder}>
                <Text style={styles.stampPlaceholderText}>{isRtl ? 'مكان الختم' : 'Stamp Here'}</Text>
              </View>
            )}
          </View>
        </View>
      </Page>

      {/* Attachment Pages */}
      {validAttachments.map((file, idx) => (
        <Page key={idx} size="A4" style={styles.attachmentPage}>
          <Image src={file.data} style={styles.attachmentImage} />
        </Page>
      ))}
    </Document>
  );
};

export default InspectionReportPdf;
