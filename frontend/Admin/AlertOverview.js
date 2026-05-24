import React, { useEffect, useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { fetchAdminEvidenceAlerts, updateAlertStatus } from './evidenceApi.js';

export default function AlertHistory({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'solved', 'unsolved'
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all', 'esp32', 'bodyworn'
  const [updatingAlertId, setUpdatingAlertId] = useState(null);

  const toggleSolved = async (targetAlert) => {
    const id = targetAlert?.id || targetAlert?.evidenceId;
    if (!id) {
      Alert.alert('Update failed', 'This alert is missing an id.');
      return;
    }

    const newResolved = !targetAlert.resolved;
    setUpdatingAlertId(id);
    setAlerts((prevAlerts) =>
      prevAlerts.map((alert) =>
        alert.id === id ? { ...alert, resolved: newResolved } : alert
      )
    );

    try {
      await updateAlertStatus(targetAlert, newResolved);
    } catch (updateError) {
      setAlerts((prevAlerts) =>
        prevAlerts.map((alert) =>
          alert.id === id ? { ...alert, resolved: !newResolved } : alert
        )
      );
      Alert.alert('Update failed', updateError?.message || 'Unable to update status.');
    } finally {
      setUpdatingAlertId(null);
    }
  };

  const baseAlerts = alerts.filter((alert) => {
    if (sourceFilter === 'esp32') return alert.sourceType === 'esp32-sensor-log';
    if (sourceFilter === 'bodyworn') return alert.sourceType === 'body-worn-camera';
    return true;
  });

  const filteredAlerts = baseAlerts.filter((alert) => {
    if (filter === 'solved') return alert.resolved;
    if (filter === 'unsolved') return !alert.resolved;
    return true;
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      const response = await fetchAdminEvidenceAlerts();
      if (!active) return;
      setAlerts(response.alerts);
      setError(response.error || '');
      setLoading(false);
    };

    load();

    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Alert Overview</Text>
        <Text style={styles.subtitle}>Live evidence records pulled from the database and ESP32 sensor logs</Text>
      </View>

      <View style={styles.sourceTabs}>
        <TouchableOpacity
          style={[styles.tab, sourceFilter === 'all' && styles.tabActive]}
          onPress={() => setSourceFilter('all')}
        >
          <Text style={[styles.tabText, sourceFilter === 'all' && styles.tabTextActive]}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, sourceFilter === 'esp32' && styles.tabActive]}
          onPress={() => setSourceFilter('esp32')}
        >
          <Text style={[styles.tabText, sourceFilter === 'esp32' && styles.tabTextActive]}>ESP32</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, sourceFilter === 'bodyworn' && styles.tabActive]}
          onPress={() => setSourceFilter('bodyworn')}
        >
          <Text style={[styles.tabText, sourceFilter === 'bodyworn' && styles.tabTextActive]}>Body-worn</Text>
        </TouchableOpacity>
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
        <TouchableOpacity 
          style={[styles.summaryCard, filter === 'all' && styles.summaryCardActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={styles.summaryLabel}>Total Alerts</Text>
          <Text style={[styles.summaryValue, filter === 'all' && styles.summaryValueActive]}>{baseAlerts.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.summaryCard, filter === 'solved' && styles.summaryCardActive]}
          onPress={() => setFilter('solved')}
        >
          <Text style={styles.summaryLabel}>Solved</Text>
          <Text style={[styles.summaryValue, styles.summarySolved, filter === 'solved' && styles.summaryValueActive]}>{baseAlerts.filter((item) => item.resolved).length}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.summaryCard, filter === 'unsolved' && styles.summaryCardActive]}
          onPress={() => setFilter('unsolved')}
        >
          <Text style={styles.summaryLabel}>Unsolved</Text>
          <Text style={[styles.summaryValue, styles.summaryUnsolved, filter === 'unsolved' && styles.summaryValueActive]}>{baseAlerts.filter((item) => !item.resolved).length}</Text>
        </TouchableOpacity>
      </View>

      {filteredAlerts.map((item) => (
        <View key={item.alertKey || item.id} style={styles.row}>
          <View style={styles.body}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.timestamp}</Text>
            <Text style={styles.source}>{item.sourceLabel || 'Alert source unavailable'}</Text>
            <Text style={styles.status}>{item.status}</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.detailButton}
                onPress={() => navigation.navigate('AlertDetail', { alert: item })}
              >
                <Text style={styles.detailButtonText}>View Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.detailButton, item.resolved && styles.solvedButton]}
                onPress={() => toggleSolved(item)}
                disabled={updatingAlertId === (item.id || item.evidenceId)}
              >
                <Text style={[styles.detailButtonText, item.resolved && styles.solvedButtonText]}>
                  {item.resolved ? 'Cancel Solved' : 'Mark Solved'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.badge, item.resolved ? styles.badgeSolved : styles.badgeUnsolved]}>
            <Text style={[styles.badgeText, item.resolved && styles.badgeSolvedText]}>
              {item.resolved ? '✓ Solved' : 'Unsolved'}
            </Text>
          </View>
        </View>
      ))}

      {!loading && filteredAlerts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No alert records found</Text>
          <Text style={styles.emptyText}>The backend returned an empty alert list.</Text>
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
  sourceTabs: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F4F7F1',
    borderWidth: 1,
    borderColor: '#E8EDE6',
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: '#EDF7EE',
    borderColor: '#2F7D4A',
  },
  tabText: {
    color: '#445244',
    fontWeight: '700',
    fontSize: 12,
  },
  tabTextActive: {
    color: '#2F7D4A'
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
  summaryCardActive: {
    backgroundColor: '#F0F7F0',
    borderWidth: 2,
    borderColor: '#2F7D4A',
  },
  summaryValueActive: {
    color: '#2F7D4A',
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
  source: { marginTop: 4, color: '#445244', fontSize: 12, fontWeight: '700' },
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
  solvedButton: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9'
  },
  solvedButtonText: {
    color: '#2F7D4A'
  },
  badgeSolved: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9'
  },
  badgeUnsolved: {
    backgroundColor: '#FCE5E5',
    borderColor: '#F4D8D8'
  },
  badgeSolvedText: {
    color: '#2F7D4A'
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
