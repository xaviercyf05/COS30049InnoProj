import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export default function AlertDetail({ route, navigation }) {
  const alert = route?.params?.alert || {};
  const videoUrl = alert.videoUrl || 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{alert.name || 'Alert Detail'}</Text>
          <Text style={styles.meta}>{alert.location}</Text>
        </View>

        <View style={styles.videoWrap}>
          <div style={{ width: '100%', maxWidth: 900 }}>
            <video controls style={{ width: '100%', borderRadius: 12 }} src={videoUrl} />
          </div>
        </View>

        <View style={styles.info}>
          <Text style={styles.infoTitle}>Date & Time</Text>
          <Text style={styles.infoText}>{alert.timestamp}</Text>

          <Text style={[styles.infoTitle, { marginTop: 12 }]}>Event</Text>
          <Text style={styles.infoText}>{alert.status}</Text>

          <TouchableOpacity style={styles.download} onPress={() => window.open(videoUrl, '_blank')}>
            <Text style={styles.downloadText}>Open / Download Evidence</Text>
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
  videoWrap: { marginTop: 10, alignItems: 'center' },
  info: { marginTop: 18, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12 },
  infoTitle: { fontWeight: '800', color: '#233322' },
  infoText: { marginTop: 6, color: '#445244' },
  download: { marginTop: 16, backgroundColor: '#E04545', padding: 10, borderRadius: 8, alignItems: 'center' },
  downloadText: { color: '#fff', fontWeight: '800' }
});
