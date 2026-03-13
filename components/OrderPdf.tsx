import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image, Svg, Path, Circle, Line } from '@react-pdf/renderer';

// Register Arabic Font
Font.register({
  family: 'Tajawal',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/tajawal/v9/Iura6YBj_oCad4k1nzSBC45I.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/tajawal/v9/IurW6YBj_oCad4k1l_q4DyllvA.ttf', fontWeight: 700 }
  ]
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Tajawal',
    padding: 30,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 15,
    marginBottom: 15,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 32,
    color: '#dc2626',
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  taxInfo: {
    flexDirection: 'row-reverse',
    marginTop: 10,
    gap: 15,
  },
  taxText: {
    fontSize: 10,
    color: '#475569',
  },
  qrCode: {
    width: 80,
    height: 80,
  },
  logo: {
    width: 120,
    height: 70,
    objectFit: 'contain',
  },
  box: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 12,
    marginBottom: 15,
  },
  boxHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
    marginBottom: 10,
    gap: 6,
  },
  boxTitle: {
    fontSize: 12,
    color: '#0d9488',
    fontWeight: 700,
  },
  customerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    gap: 60,
  },
  infoItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontSize: 10,
    color: '#64748b',
  },
  value: {
    fontSize: 10,
    color: '#0f172a',
    fontWeight: 700,
  },
  splitRow: {
    flexDirection: 'row-reverse',
    gap: 15,
    marginBottom: 15,
  },
  carBox: {
    flex: 2,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 12,
  },
  orderBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 12,
  },
  carContent: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  carDetails: {
    alignItems: 'flex-end',
  },
  carNameEn: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
  },
  carNameAr: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  yearPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  yearText: {
    fontSize: 10,
    color: '#334155',
  },
  carLogo: {
    width: 60,
    height: 60,
    objectFit: 'contain',
  },
  plateContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
  },
  plateLetters: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  plateNumbers: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  plateTextAr: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0f172a',
  },
  plateTextEn: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  orderContent: {
    flexDirection: 'column',
    gap: 10,
  },
  orderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsHeader: {
    backgroundColor: '#ccfbf1',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  resultsTitle: {
    fontSize: 14,
    color: '#0f766e',
    fontWeight: 700,
  },
  sectionBar: {
    backgroundColor: '#0f766e',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionBarText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 700,
  },
  findingGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  findingItem: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  findingName: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 4,
    textAlign: 'center',
  },
  findingValue: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: 700,
    textAlign: 'center',
  },
  noteItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  noteText: {
    fontSize: 10,
    color: '#991b1b',
    flex: 1,
    textAlign: 'right',
  },
  noteImage: {
    width: 60,
    height: 60,
    borderRadius: 4,
    objectFit: 'cover',
  }
});

const UserIcon = () => (
  <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </Svg>
);

const FileIcon = () => (
  <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Path d="M14 2v6h6" />
    <Line x1="16" y1="13" x2="8" y2="13" />
    <Line x1="16" y1="17" x2="8" y2="17" />
    <Line x1="10" y1="9" x2="8" y2="9" />
  </Svg>
);

const CarIcon = () => (
  <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <Circle cx="7" cy="17" r="2" />
    <Path d="M9 17h6" />
    <Circle cx="17" cy="17" r="2" />
  </Svg>
);

export interface OrderPdfProps {
  customer: {
    name: string;
    mobile: string;
  };
  car: {
    modelEn: string;
    modelAr: string;
    year: string;
    plateLettersAr: string;
    plateLettersEn: string;
    plateNumbersAr: string;
    plateNumbersEn: string;
    logoUrl?: string;
  };
  order: {
    reportNumber: string;
    date: string;
    time: string;
    type: string;
  };
  settings?: {
    logoUrl?: string;
    companyName?: string;
    taxNumber?: string;
    commercialRecord?: string;
  };
  findings?: {
    categoryId: string;
    categoryName: string;
    items: {
      name: string;
      value: string;
    }[];
    notes: {
      text: string;
      image?: string;
    }[];
  }[];
}

export const OrderPdf: React.FC<OrderPdfProps> = ({ customer, car, order, settings, findings = [] }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRight}>
            <Text style={styles.title}>{settings?.companyName || 'مركز الراشد'}</Text>
            <Text style={styles.subtitle}>لفحص السيارات فحص احترافي</Text>
            <View style={styles.taxInfo}>
              <Text style={styles.taxText}>السجل التجاري: {settings?.commercialRecord || '1234567890'}</Text>
              <Text style={styles.taxText}>الرقم الضريبي: {settings?.taxNumber || '123456789'}</Text>
            </View>
          </View>
          <Image 
            style={styles.qrCode} 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://example.com/report/${order.reportNumber.replace('#', '')}`} 
          />
          {settings?.logoUrl ? (
            <Image 
              style={styles.logo} 
              src={settings.logoUrl} 
            />
          ) : (
            <View style={styles.logo} />
          )}
        </View>

        {/* Customer Data */}
        <View style={styles.box}>
          <View style={styles.boxHeader}>
            <UserIcon />
            <Text style={styles.boxTitle}>بيانات العميل</Text>
          </View>
          <View style={styles.customerRow}>
            <View style={styles.infoItem}>
              <Text style={styles.label}>الاسم:</Text>
              <Text style={styles.value}>{customer.name}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>الجوال:</Text>
              <Text style={styles.value}>{customer.mobile}</Text>
            </View>
          </View>
        </View>

        {/* Car and Order Data */}
        <View style={styles.splitRow}>
          {/* Car Data */}
          <View style={styles.carBox}>
            <View style={styles.boxHeader}>
              <CarIcon />
              <Text style={styles.boxTitle}>بيانات السيارة</Text>
            </View>
            <View style={styles.carContent}>
              <View style={styles.carDetails}>
                <Text style={styles.carNameEn}>{car.modelEn}</Text>
                <Text style={styles.carNameAr}>{car.modelAr}</Text>
                <View style={styles.yearPill}>
                  <Text style={styles.yearText}>سنة الصنع {car.year}</Text>
                </View>
              </View>
              
              {car.logoUrl ? (
                <Image style={styles.carLogo} src={car.logoUrl} />
              ) : (
                <View style={styles.carLogo} />
              )}

              <View style={styles.plateContainer}>
                <View style={styles.plateLetters}>
                  <Text style={styles.plateTextAr}>{car.plateLettersAr}</Text>
                  <Text style={styles.plateTextEn}>{car.plateLettersEn}</Text>
                </View>
                <View style={styles.plateNumbers}>
                  <Text style={styles.plateTextAr}>{car.plateNumbersAr}</Text>
                  <Text style={styles.plateTextEn}>{car.plateNumbersEn}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Order Data */}
          <View style={styles.orderBox}>
            <View style={styles.boxHeader}>
              <FileIcon />
              <Text style={styles.boxTitle}>بيانات الطلب</Text>
            </View>
            <View style={styles.orderContent}>
              <View style={styles.orderRow}>
                <Text style={styles.label}>رقم التقرير:</Text>
                <Text style={styles.value}>{order.reportNumber}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.label}>التاريخ:</Text>
                <Text style={styles.value}>{order.date}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.label}>الوقت:</Text>
                <Text style={styles.value}>{order.time}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.label}>نوع الفحص:</Text>
                <Text style={styles.value}>{order.type}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Technical Inspection Results */}
        {findings.length > 0 && (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>نتائج الفحص الفني</Text>
            </View>
            
            {findings.map((category, index) => (
              <View key={index} wrap={false}>
                <View style={styles.sectionBar}>
                  <Text style={styles.sectionBarText}>{category.categoryName}</Text>
                </View>
                
                {category.items.length > 0 && (
                  <View style={styles.findingGrid}>
                    {category.items.map((item, i) => (
                      <View key={i} style={styles.findingItem}>
                        <Text style={styles.findingName}>{item.name}</Text>
                        <Text style={styles.findingValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {category.notes.length > 0 && (
                  <View>
                    {category.notes.map((note, i) => (
                      <View key={i} style={styles.noteItem}>
                        <Text style={styles.noteText}>{note.text}</Text>
                        {note.image && (
                          <Image style={styles.noteImage} src={note.image} />
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </>
        )}

      </Page>
    </Document>
  );
};

export default OrderPdf;
