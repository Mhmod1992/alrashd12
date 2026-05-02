import React from 'react';
import { Document, Page, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { ArabicText as Text } from './ArabicText';
import { InspectionRequest, Client, Car, CarMake, CarModel, InspectionType, CustomFindingCategory, PredefinedFinding, Settings, Note, StructuredFinding, ReportSettings } from '../types';

// Register Arabic font
Font.register({
  family: 'Tajawal',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/tajawal/Tajawal-Regular.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/tajawal/Tajawal-Bold.ttf', fontWeight: 700 }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Tajawal',
    direction: 'rtl',
    backgroundColor: '#ffffff'
  },
  attachmentPage: {
    padding: 0,
    backgroundColor: '#ffffff'
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 10,
    marginBottom: 20
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-end'
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1e293b'
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: 'contain'
  },
  section: {
    marginBottom: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
    color: '#3b82f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    textAlign: 'right'
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  label: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: 700
  },
  value: {
    fontSize: 10,
    color: '#1e293b',
    fontWeight: 700
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: 700,
    backgroundColor: '#f1f5f9',
    padding: 6,
    textAlign: 'center',
    marginBottom: 10,
    borderRadius: 4
  },
  findingsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start'
  },
  findingItem: {
    width: '30%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 5,
    alignItems: 'center',
    marginBottom: 10
  },
  findingImage: {
    width: 60,
    height: 60,
    objectFit: 'contain',
    marginBottom: 5
  },
  findingName: {
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 2
  },
  findingValue: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center'
  },
  noteItem: {
    flexDirection: 'row-reverse',
    marginBottom: 4,
    alignItems: 'flex-start'
  },
  noteBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
    marginTop: 4,
    marginLeft: 6
  },
  noteText: {
    fontSize: 10,
    color: '#334155',
    flex: 1,
    textAlign: 'right'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between'
  },
  disclaimer: {
    fontSize: 8,
    color: '#64748b',
    width: '70%',
    textAlign: 'right'
  },
  stampContainer: {
    alignItems: 'center'
  },
  stampText: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 2
  },
  stampImage: {
    width: 50,
    height: 50,
    objectFit: 'contain'
  }
});

interface ReportPdfProps {
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
  attachments?: { data: string, type: string }[];
}

const ReportPdf: React.FC<ReportPdfProps> = ({
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
  attachments = []
}) => {
  const { appName, reportSettings } = settings;
  const isLtr = reportDirection === 'ltr';

  const carDetails = {
    makeNameEn: request.car_snapshot?.make_en || carMake?.name_en || 'Unknown',
    modelNameEn: request.car_snapshot?.model_en || carModel?.name_en || 'Unknown',
    makeNameAr: request.car_snapshot?.make_ar || carMake?.name_ar || 'غير معروف',
    modelNameAr: request.car_snapshot?.model_ar || carModel?.name_ar || 'غير معروف',
    year: request.car_snapshot?.year || car.year,
  };

  const visibleCategoryIds = inspectionType.finding_category_ids;

  return (
    <Document>
      <Page size="A4" style={[styles.page, { direction: isLtr ? 'ltr' : 'rtl' }]}>
        {/* Header */}
        <View style={[styles.header, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
          <View style={[styles.headerLeft, { alignItems: isLtr ? 'flex-start' : 'flex-end' }]}>
            <Text style={[styles.title, { color: reportSettings.appNameColor }]}>{appName}</Text>
            <Text style={styles.subtitle}>{reportSettings.headerSubtitleText}</Text>
          </View>
          {reportSettings.reportLogoUrl && (
            <Image src={reportSettings.reportLogoUrl} style={styles.logo} />
          )}
        </View>

        {/* Client & Car Info */}
        <View style={[styles.row, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
          <View style={[styles.section, { width: '48%' }]}>
            <Text style={[styles.sectionTitle, { textAlign: isLtr ? 'left' : 'right', color: reportSettings.primaryColor }]}>
              {isLtr ? 'Client Details' : 'بيانات العميل'}
            </Text>
            <View style={[styles.row, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
              <Text style={styles.label}>{isLtr ? 'Name:' : 'الاسم:'}</Text>
              <Text style={styles.value}>{client.name}</Text>
            </View>
            <View style={[styles.row, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
              <Text style={styles.label}>{isLtr ? 'Phone:' : 'الجوال:'}</Text>
              <Text style={styles.value}>{client.phone}</Text>
            </View>
            {reportSettings.showPriceOnReport && (
              <View style={[styles.row, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
                <Text style={styles.label}>{isLtr ? 'Total:' : 'المبلغ:'}</Text>
                <Text style={styles.value}>{request.price} {isLtr ? 'SAR' : 'ريال'}</Text>
              </View>
            )}
          </View>

          <View style={[styles.section, { width: '48%' }]}>
            <Text style={[styles.sectionTitle, { textAlign: isLtr ? 'left' : 'right', color: reportSettings.primaryColor }]}>
              {isLtr ? 'Vehicle Details' : 'بيانات السيارة'}
            </Text>
            <View style={[styles.row, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
              <Text style={styles.label}>{isLtr ? 'Car:' : 'السيارة:'}</Text>
              <Text style={styles.value}>{isLtr ? `${carDetails.makeNameEn} ${carDetails.modelNameEn}` : `${carDetails.makeNameAr} ${carDetails.modelNameAr}`}</Text>
            </View>
            <View style={[styles.row, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
              <Text style={styles.label}>{isLtr ? 'Year:' : 'سنة الصنع:'}</Text>
              <Text style={styles.value}>{carDetails.year}</Text>
            </View>
            <View style={[styles.row, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
              <Text style={styles.label}>{isLtr ? 'VIN/Plate:' : 'الشاصي/اللوحة:'}</Text>
              <Text style={styles.value}>{car.vin || car.plate_number || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Findings */}
        {visibleCategoryIds.map(catId => {
          const category = customFindingCategories.find(c => c.id === catId);
          if (!category) return null;
          
          const findings = (request.structured_findings || []).filter(f => f.categoryId === catId);
          const notes = ((request.category_notes?.[catId] as Note[]) || []).filter(n => !n.image);
          
          if (findings.length === 0 && notes.length === 0) return null;

          return (
            <View key={catId} style={styles.section} wrap={false}>
              <Text style={[styles.categoryTitle, { backgroundColor: reportSettings.findingsHeaderBackgroundColor, color: reportSettings.findingsHeaderFontColor }]}>
                {category.name}
              </Text>
              
              {findings.length > 0 && (
                <View style={[styles.findingsGrid, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
                  {findings.map(finding => {
                    const predefined = predefinedFindings.find(pf => pf.id === finding.findingId);
                    return (
                      <View key={finding.findingId} style={styles.findingItem}>
                        {predefined?.reference_image && (
                          <Image src={predefined.reference_image} style={styles.findingImage} />
                        )}
                        <Text style={styles.findingName}>{finding.findingName}</Text>
                        {finding.value && <Text style={styles.findingValue}>{finding.value}</Text>}
                      </View>
                    );
                  })}
                </View>
              )}

              {notes.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={[styles.label, { marginBottom: 4, textAlign: isLtr ? 'left' : 'right' }]}>
                    {isLtr ? 'Notes:' : 'ملاحظات:'}
                  </Text>
                  {notes.map(note => (
                    <View key={note.id} style={[styles.noteItem, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
                      <View style={[styles.noteBullet, { marginLeft: isLtr ? 0 : 6, marginRight: isLtr ? 6 : 0 }]} />
                      <Text style={[styles.noteText, { textAlign: isLtr ? 'left' : 'right' }]}>{note.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* General Notes */}
        {((request.general_notes as Note[]) || []).filter(n => !n.image).length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={[styles.categoryTitle, { backgroundColor: reportSettings.findingsHeaderBackgroundColor, color: reportSettings.findingsHeaderFontColor }]}>
              {isLtr ? 'General Notes' : 'ملاحظات عامة'}
            </Text>
            {((request.general_notes as Note[]) || []).filter(n => !n.image).map(note => (
              <View key={note.id} style={[styles.noteItem, { flexDirection: isLtr ? 'row' : 'row-reverse' }]}>
                <View style={[styles.noteBullet, { marginLeft: isLtr ? 0 : 6, marginRight: isLtr ? 6 : 0 }]} />
                <Text style={[styles.noteText, { textAlign: isLtr ? 'left' : 'right' }]}>{note.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={[styles.footer, { flexDirection: isLtr ? 'row' : 'row-reverse' }]} fixed>
          <Text style={[styles.disclaimer, { textAlign: isLtr ? 'left' : 'right' }]}>
            {isLtr ? 'Disclaimer: ' : 'إخلاء مسؤولية: '}
            {reportSettings.disclaimerText}
          </Text>
          <View style={styles.stampContainer}>
            <Text style={styles.stampText}>{isLtr ? 'Stamp' : 'الختم'}</Text>
            {reportSettings.workshopStampUrl && (
              <Image src={reportSettings.workshopStampUrl} style={styles.stampImage} />
            )}
          </View>
        </View>
      </Page>

      {/* Attachments */}
      {attachments.filter(a => a.type !== 'internal_draft').map((attachment, index) => (
        <Page key={index} size="A4" style={styles.attachmentPage}>
          <Image src={attachment.data} style={styles.attachmentImage} />
        </Page>
      ))}
    </Document>
  );
};

export default ReportPdf;
