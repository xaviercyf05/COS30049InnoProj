import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const initialHistoryData = [
  { id: 101, name: 'Bako National Park', location: 'Kuching Division', status: 'Motion sensor triggered', timestamp: '2026-04-29 09:12', resolved: false },
  { id: 102, name: 'Similajau National Park', location: 'Bintulu Division', status: 'Perimeter vibration alert', timestamp: '2026-04-28 16:44', resolved: true },
  { id: 103, name: 'Kubah National Park', location: 'Kuching Division', status: 'Thermal anomaly detected', timestamp: '2026-04-27 07:20', resolved: true },
  { id: 104, name: 'Gunung Mulu National Park', location: 'Miri Division', status: 'After-hours movement at cave entrance', timestamp: '2026-04-26 23:05', resolved: false },
  { id: 105, name: 'Maludam National Park', location: 'Betong Division', status: 'Water-level warning triggered', timestamp: '2026-04-25 11:36', resolved: true }
];

export default function AlertHistory({ navigation }) {
  const [alerts, setAlerts] = useState(initialHistoryData);

  const totalAlerts = alerts.length;
  const solvedAlerts = alerts.filter((item) => item.resolved).length;
  const unsolvedAlerts = totalAlerts - solvedAlerts;

  const toggleSolved = (id) => {
    setAlerts((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, resolved: !item.resolved } : item
      )
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Alert Overview</Text>
        <Text style={styles.subtitle}>Recorded alerts with solved and unsolved status</Text>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Alerts</Text>
          <Text style={styles.summaryValue}>{totalAlerts}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Solved Alerts</Text>
          <Text style={[styles.summaryValue, styles.summarySolved]}>{solvedAlerts}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Unsolved Alerts</Text>
          <Text style={[styles.summaryValue, styles.summaryUnsolved]}>{unsolvedAlerts}</Text>
        </View>
      </View>

      {alerts.map(item => (
        <View key={item.id} style={styles.row}>
          <View style={styles.body}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.timestamp} · {item.location}</Text>
            <Text style={styles.status}>{item.status}</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.detailButton}
                onPress={() => navigation.navigate('AlertDetail', { alert: item })}
              >
                <Text style={styles.detailButtonText}>View Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleButton, item.resolved ? styles.toggleButtonUnsolve : styles.toggleButtonSolve]}
                onPress={() => toggleSolved(item.id)}
              >
                <Text style={styles.toggleButtonText}>
                  {item.resolved ? 'Mark as Unsolved' : 'Mark as Solved'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.badge, item.resolved ? styles.badgeSolved : styles.badgeUnsolved]}>
            <Text style={[styles.badgeText, item.resolved ? styles.badgeTextSolved : styles.badgeTextUnsolved]}>
              {item.resolved ? 'Solved' : 'Unsolved'}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#243424' },
  subtitle: { marginTop: 6, color: '#6C7566' },
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
  toggleButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1
  },
  toggleButtonSolve: {
    backgroundColor: '#EAF4EC',
    borderColor: '#D1E6D7'
  },
  toggleButtonUnsolve: {
    backgroundColor: '#FDF0F0',
    borderColor: '#F2DCDC'
  },
  toggleButtonText: {
    color: '#344734',
    fontWeight: '700',
    fontSize: 12
  },
  badge: {
    marginLeft: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1
  },
  badgeSolved: {
    backgroundColor: '#EEF8F1',
    borderColor: '#D8EEDB'
  },
  badgeUnsolved: {
    backgroundColor: '#FDF0F0',
    borderColor: '#F2DCDC'
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800'
  },
  badgeTextSolved: {
    color: '#2F7D4A'
  },
  badgeTextUnsolved: {
    color: '#B04343'
  }
});
