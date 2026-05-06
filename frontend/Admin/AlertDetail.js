import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';

export default function AlertDetail({ route }) {
  const alert = route?.params?.alert || {};
  const videoUrl = alert.videoUrl || '';
  const labelsText = alert.labels ? JSON.stringify(alert.labels, null, 2) : '';

  const openVideo = async () => {
    if (!videoUrl) {
      return;
    }

    await Linking.openURL(videoUrl);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{alert.name || 'Evidence Detail'}</Text>
          <Text style={styles.meta}>{alert.location || 'Location unavailable'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Event summary</Text>
          <Text style={styles.sectionText}>{alert.status || 'No event summary available.'}</Text>

          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Date & Time</Text>
          <Text style={styles.sectionText}>{alert.timestamp || 'Timestamp unavailable'}</Text>

          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Event type</Text>
          <Text style={styles.sectionText}>{alert.eventType || 'abnormal_interaction_detected'}</Text>

          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Coordinates</Text>
          <Text style={styles.sectionText}>
            {alert.latitude !== null && alert.latitude !== undefined && alert.longitude !== null && alert.longitude !== undefined
              ? `${alert.latitude}, ${alert.longitude}`
              : 'Not available in this record'}
          </Text>

          {labelsText ? (
            <>
              <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Labels</Text>
              <Text style={styles.codeBlock}>{labelsText}</Text>
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.download, !videoUrl && styles.downloadDisabled]}
            onPress={openVideo}
            disabled={!videoUrl}
          >
            <Text style={styles.downloadText}>{videoUrl ? 'Open Evidence Video' : 'Video not available'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F4EE' },
  content: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#243424' },
  meta: { marginTop: 6, color: '#6C7566' },
  card: { marginTop: 10, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12 },
  sectionTitle: { fontWeight: '800', color: '#233322' },
  sectionText: { marginTop: 6, color: '#445244' },
  sectionSpacing: { marginTop: 12 },
  codeBlock: {
    marginTop: 6,
    backgroundColor: '#F5F7F2',
    borderRadius: 10,
    padding: 12,
    color: '#3E4A3E',
    fontSize: 12,
    lineHeight: 18,
  },
  download: { marginTop: 16, backgroundColor: '#E04545', padding: 10, borderRadius: 8, alignItems: 'center' },
  downloadDisabled: { backgroundColor: '#C9C9C9' },
  downloadText: { color: '#fff', fontWeight: '800' }
});