import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Platform, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withSidebarChrome } from '../components/AppSidebarChrome.js';
import { VideoView, useVideoPlayer } from 'expo-video';
import { updateEvidenceStatus } from './evidenceApi.js';

function AlertDetail({ route, navigation }) {
  const [token, setToken] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const alertFromRoute = route?.params?.alert || {};
  const [alert, setAlert] = useState(alertFromRoute);
  const canUpdateStatus = alert.canUpdateStatus !== false;
  const videoUrl = alert.videoUrl || '';
  const labelsText = alert.labels ? JSON.stringify(alert.labels, null, 2) : '';
  const [videoLoading, setVideoLoading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const videoRef = useRef(null);
  const [showControls, setShowControls] = useState(true);

  const [solving, setSolving] = useState(false);

  const toggleSolved = async () => {
    if (!canUpdateStatus) {
      return;
    }

    const newResolved = !alert.resolved;
    const id = alert.id || alert.evidenceId || alert.evidenceId;
    if (!id) return;

    // optimistic UI change
    setAlert((prev) => ({ ...prev, resolved: newResolved }));
    setSolving(true);

    try {
      await updateEvidenceStatus(id, newResolved);
      // rely on overview/sensor screens to refresh on focus when user navigates back
    } catch (error) {
      // revert on error
      setAlert((prev) => ({ ...prev, resolved: !newResolved }));
      Alert.alert('Update failed', error?.message || 'Unable to update status.');
    } finally {
      setSolving(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem('auth_token').then(setToken);
  }, []);

  useEffect(() => {
    return () => {};
  }, []);

  const isWeb = Platform.OS === 'web';

  const source = React.useMemo(() => {
    if (!videoUrl || !token) return undefined;

    return {
      uri: videoUrl,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }, [videoUrl, token]);

  const player = useVideoPlayer(!isWeb ? source : undefined);

  const downloadVideo = async () => {
    if (!videoUrl) {
      return;
    }

    setVideoLoading(true);
    setDownloadError('');

    try {
      const token = await AsyncStorage.getItem('auth_token');

      if (!token) {
        throw new Error('Missing authentication token. Please log in again.');
      }

      const response = await fetch(videoUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Unable to download the evidence video.');
      }

      if (Platform.OS === 'web') {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const safeName = String(alert.videoFileName || alert.name || 'evidence-video')
          .trim()
          .replace(/[^a-z0-9-_]+/gi, '_')
          .replace(/^_+|_+$/g, '');
        const fileName = `${safeName || 'evidence-video'}.mp4`;

        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 1000);
      }
    } catch (error) {
      setDownloadError(error?.message || 'Unable to download the evidence video.');
    } finally {
      setVideoLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{alert.name || 'Evidence Detail'}</Text>
          <Text style={styles.meta}>{alert.location || 'Location unavailable'}</Text>
          <Text style={styles.source}>{alert.sourceLabel || 'Alert source unavailable'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Event summary</Text>
          <Text style={styles.sectionText}>{alert.status || 'No event summary available.'}</Text>

          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Date & Time</Text>
          <Text style={styles.sectionText}>{alert.timestamp || 'Timestamp unavailable'}</Text>

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

          {isWeb ? (
            <>
              <View style={styles.buttonRow}>
                {videoUrl ? (
                  <TouchableOpacity
                    style={[styles.download, videoLoading && styles.downloadDisabled]}
                    onPress={downloadVideo}
                    disabled={videoLoading}
                  >
                    <View style={styles.buttonContent}>
                      {videoLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.downloadText} numberOfLines={1}>
                          Download Evidence Video
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ) : null}
                {canUpdateStatus ? (
                  <TouchableOpacity
                    style={[styles.solveButton, alert.resolved && styles.solvedButtonStyle]}
                    onPress={toggleSolved}
                    disabled={solving}
                  >
                    <Text style={[styles.solveButtonText, alert.resolved && styles.solvedButtonText]}>
                      {alert.resolved ? '✓ Solved' : 'Mark Solved'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {!videoUrl && !canUpdateStatus ? (
                <Text style={styles.sectionText}>This alert came from ESP32SensorLogs and is read-only in-app.</Text>
              ) : null}
            </>
          ) : videoUrl && token && player ? (
            <>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setShowControls((prev) => !prev)}
                style={styles.videoWrapper}
              >
                <VideoView
                  key={videoUrl}
                  player={player}
                  style={styles.videoPlayer}
                  fullscreenOptions={{
                    enterFullscreenOnLongPress: true,
                    exitFullscreenOnLongPress: true,
                  }}
                  allowsPictureInPicture
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.solveButton, alert.resolved && styles.solvedButtonStyle]}
                onPress={toggleSolved}
                disabled={solving || !canUpdateStatus}
              >
                <View style={styles.buttonContent}>
                  <Text style={[styles.solveButtonText, alert.resolved && styles.solvedButtonText]} numberOfLines={1}>
                    {canUpdateStatus ? (alert.resolved ? '✓ Solved' : 'Mark Solved') : 'Status managed externally'}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.sectionText}>
              {canUpdateStatus ? 'Loading video...' : 'This alert came from ESP32SensorLogs and is read-only in-app.'}
            </Text>
          )}

          {downloadError ? <Text style={styles.errorText}>{downloadError}</Text> : null}
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
  source: { marginTop: 4, color: '#445244', fontSize: 12, fontWeight: '700' },
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
  download: { 
    flex: 1,
    backgroundColor: '#8B6F47', 
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8, 
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  downloadDisabled: { backgroundColor: '#C9C9C9' },
  downloadText: { color: '#fff', fontWeight: '800', numberOfLines: 1 },
  errorText: { marginTop: 10, color: '#9E3A3A', fontSize: 13, fontWeight: '600' },
  videoPlayer: { width: '100%', height: 220, marginTop: 12, borderRadius: 8, backgroundColor: '#000' },
  videoWrapper: {
    width: '100%',
    height: 220,
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  buttonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  solveButton: {
    flex: 1,
    backgroundColor: '#EDF2E6',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCE7D0',
    height: 44,

    // 👇 platform-specific spacing
    ...Platform.select({
      ios: { marginTop: 16 },
      android: { marginTop: 16 },
      web: { marginTop: 0 }
    })
  },
  solvedButtonStyle: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  solveButtonText: {
    color: '#344734',
    fontWeight: '800',
    numberOfLines: 1,
  },
  solvedButtonText: {
    color: '#2F7D4A',
  },
});

export default withSidebarChrome(AlertDetail, { title: 'Alert Detail' });
