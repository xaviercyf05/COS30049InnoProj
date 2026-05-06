import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { fetchAdminEvidenceAlerts } from './evidenceApi.js';

export default function AlertHistory({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    (async () => {
      const response = await fetchAdminEvidenceAlerts();

      if (!active) {
        return;
      }

      setAlerts(response.alerts);
      setError(response.error || '');
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Alert Overview</Text>
        <Text style={styles.subtitle}>Live evidence records pulled from the database</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>Loading evidence alerts</Text>
          <Text style={styles.loadingText}>Refreshing the admin list from the backend.</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load evidence</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Evidence</Text>
          <Text style={styles.summaryValue}>{alerts.length}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>With Coordinates</Text>
          <Text style={[styles.summaryValue, styles.summarySolved]}>{alerts.filter((item) => item.latitude !== null && item.longitude !== null).length}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>With Video</Text>
          <Text style={[styles.summaryValue, styles.summaryUnsolved]}>{alerts.filter((item) => item.hasVideo).length}</Text>
        </View>
      </View>

      {alerts.map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.body}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.timestamp} · {item.location || 'Location unavailable'}</Text>
            <Text style={styles.status}>{item.status}</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.detailButton}
                onPress={() => navigation.navigate('AlertDetail', { alert: item })}
              >
                <Text style={styles.detailButtonText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.eventType || 'Evidence'}</Text>
          </View>
        </View>
      ))}

      {!loading && alerts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No evidence records found</Text>
          <Text style={styles.emptyText}>The backend returned an empty evidence list.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#243424' },
  subtitle: { marginTop: 6, color: '#6C7566' },
  loadingCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E8EBE1' },
  loadingTitle: { color: '#243424', fontSize: 14, fontWeight: '800' },
  loadingText: { marginTop: 4, color: '#687263', fontSize: 13 },
  errorCard: { backgroundColor: '#FFF2F2', borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#F4D8D8' },
  errorTitle: { color: '#9E3A3A', fontSize: 14, fontWeight: '800' },
  errorText: { marginTop: 4, color: '#9E3A3A', fontSize: 13 },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  summaryCard: {
    width: '31.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#203020',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  summaryLabel: {
    color: '#687263',
    fontSize: 12,
    fontWeight: '700'
  },
  summaryValue: {
    marginTop: 8,
    color: '#243424',
    fontSize: 26,
    fontWeight: '800'
  },
  summarySolved: {
    color: '#2F7D4A'
  },
  summaryUnsolved: {
    color: '#B04343'
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#EDF0E8', backgroundColor: '#FFFFFF', marginBottom: 8, borderRadius: 12 },
  body: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: '#223322' },
  meta: { marginTop: 2, color: '#687263', fontSize: 13 },
  status: { marginTop: 6, color: '#445244', fontSize: 13 },
  actionRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center'
  },
  detailButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDF2E6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 8,
    borderColor: '#DCE7D0'
  },
  detailButtonText: {
    color: '#344734',
    fontWeight: '700',
    fontSize: 12
  },
  badge: {
    marginLeft: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    backgroundColor: '#F4F7F1',
    borderColor: '#DDE5D6'
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#344734'
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E8EBE1'
  },
  emptyTitle: { color: '#243424', fontWeight: '800' },
  emptyText: { marginTop: 4, color: '#687263', fontSize: 13 }
});