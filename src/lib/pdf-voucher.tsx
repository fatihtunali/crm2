/**
 * PDF Voucher Generation
 * Uses @react-pdf/renderer to create booking vouchers
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import QRCode from 'qrcode';

// Register fonts if needed (optional)
// Font.register({ family: 'Roboto', src: 'path/to/Roboto-Regular.ttf' });

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #333',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    borderBottom: '1 solid #ddd',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '35%',
    fontWeight: 'bold',
    color: '#555',
  },
  value: {
    width: '65%',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 8,
    fontWeight: 'bold',
    borderBottom: '1 solid #333',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1 solid #eee',
  },
  tableCol: {
    flex: 1,
  },
  tableColNarrow: {
    width: '10%',
  },
  tableColWide: {
    width: '40%',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTop: '1 solid #ddd',
    paddingTop: 10,
  },
  qrCode: {
    width: 100,
    height: 100,
    marginTop: 10,
  },
  important: {
    backgroundColor: '#fff3cd',
    padding: 10,
    marginTop: 10,
    border: '1 solid #ffc107',
  },
  importantText: {
    fontSize: 9,
    color: '#856404',
  },
});

interface VoucherData {
  booking_number: string;
  quote_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  destination: string;
  start_date: string;
  end_date: string;
  adults: number;
  children: number;
  total_price: number;
  currency: string;
  status: string;
  created_at: string;
  days: Array<{
    day_number: number;
    date: string;
    expenses: Array<{
      expense_type: string;
      description: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }>;
  }>;
  qr_code_data_url?: string; // Base64 data URL for QR code
}

/**
 * Generate a QR code data URL
 */
export async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format currency
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(amount);
}

/**
 * Voucher Document Component
 */
export const VoucherDocument: React.FC<{ data: VoucherData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>TRAVEL VOUCHER</Text>
        <Text style={styles.subtitle}>Booking Confirmation</Text>
      </View>

      {/* Booking Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Booking Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Booking Number:</Text>
          <Text style={styles.value}>{data.booking_number}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Quote Reference:</Text>
          <Text style={styles.value}>{data.quote_number}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status:</Text>
          <Text style={styles.value}>{data.status.toUpperCase()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Issue Date:</Text>
          <Text style={styles.value}>{formatDate(data.created_at)}</Text>
        </View>
      </View>

      {/* Customer Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>{data.customer_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{data.customer_email}</Text>
        </View>
        {data.customer_phone && (
          <View style={styles.row}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.value}>{data.customer_phone}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Passengers:</Text>
          <Text style={styles.value}>
            {data.adults} Adult(s), {data.children} Child(ren)
          </Text>
        </View>
      </View>

      {/* Travel Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Travel Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Destination:</Text>
          <Text style={styles.value}>{data.destination}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Travel Dates:</Text>
          <Text style={styles.value}>
            {formatDate(data.start_date)} - {formatDate(data.end_date)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Duration:</Text>
          <Text style={styles.value}>{data.days.length} Days</Text>
        </View>
      </View>

      {/* Itinerary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Itinerary</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableColNarrow}>Day</Text>
            <Text style={styles.tableColNarrow}>Date</Text>
            <Text style={styles.tableColWide}>Services</Text>
          </View>
          {data.days.map((day) => (
            <View key={day.day_number} style={styles.tableRow}>
              <Text style={styles.tableColNarrow}>{day.day_number}</Text>
              <Text style={styles.tableColNarrow}>{formatDate(day.date)}</Text>
              <View style={styles.tableColWide}>
                {day.expenses.map((expense, idx) => (
                  <Text key={idx} style={{ marginBottom: 3 }}>
                    • {expense.description}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Pricing Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pricing Summary</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Amount:</Text>
          <Text style={[styles.value, { fontWeight: 'bold', fontSize: 12 }]}>
            {formatCurrency(data.total_price, data.currency)}
          </Text>
        </View>
      </View>

      {/* QR Code */}
      {data.qr_code_data_url && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Reference</Text>
          <Image src={data.qr_code_data_url} style={styles.qrCode} />
          <Text style={{ fontSize: 8, color: '#666', marginTop: 5 }}>
            Scan to view booking details
          </Text>
        </View>
      )}

      {/* Important Notice */}
      <View style={styles.important}>
        <Text style={styles.importantText}>
          <Text style={{ fontWeight: 'bold' }}>IMPORTANT:</Text> Please present this voucher to service providers.
          Keep a copy for your records. For any changes or cancellations, contact us at least 7 days before travel.
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text>Generated on {new Date().toLocaleString()}</Text>
        <Text>This is an official travel voucher. Terms and conditions apply.</Text>
      </View>
    </Page>
  </Document>
);

/**
 * Prepare voucher data from database records
 */
export function prepareVoucherData(
  booking: any,
  quote: any,
  days: any[]
): Omit<VoucherData, 'qr_code_data_url'> {
  return {
    booking_number: booking.booking_number,
    quote_number: quote.quote_number,
    customer_name: quote.customer_name,
    customer_email: quote.customer_email,
    customer_phone: quote.customer_phone,
    destination: quote.destination,
    start_date: quote.start_date,
    end_date: quote.end_date,
    adults: quote.adults || 0,
    children: quote.children || 0,
    total_price: parseFloat(quote.total_price || '0'),
    currency: booking.currency || quote.currency || 'EUR',
    status: booking.status,
    created_at: booking.created_at,
    days: days.map((day) => ({
      day_number: day.day_number,
      date: day.date,
      expenses: day.expenses || [],
    })),
  };
}
