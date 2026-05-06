import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Platform, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withSidebarChrome } from '../components/AppSidebarChrome.js';
import { VideoView, useVideoPlayer } from 'expo-video';

function AlertDetail({ route }) {
  const [token, setToken] = useState(null);
  const alert = route?.params?.alert || {};
  const videoUrl = alert.videoUrl || '';
  const labelsText = alert.labels ? JSON.stringify(alert.labels, null, 2) : '';
  const [videoLoading, setVideoLoading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const videoRef = useRef(null);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('innopapp_auth_token').then(setToken);
  }, []);

  useEffect(() => {
    return () => {
      try {
        player?.release?.();
      } catch (e) {}
    };
  }, [player]);

  const source = React.useMemo(() => {
    if (!videoUrl || !token) return null;

    return {
      uri: videoUrl,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }, [videoUrl, token]);

  const player = useVideoPlayer(source ?? undefined);

  const downloadVideo = async () => {
    if (!videoUrl) {
      return;
    }

    setVideoLoading(true);
    setDownloadError('');

    try {
      const token = await AsyncStorage.getItem('innopapp_auth_token');

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

          {Platform.OS === 'web' ? (
            <TouchableOpacity
              style={[styles.download, (!videoUrl || videoLoading) && styles.downloadDisabled]}
              onPress={downloadVideo}
              disabled={!videoUrl || videoLoading}
            >
              {videoLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.downloadText}>
                  {videoUrl ? 'Download Evidence Video' : 'Video not available'}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            videoUrl && token && player ? (
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
            ) : (
              <Text style={styles.sectionText}>Loading video...</Text>
            )
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
  download: { marginTop: 16, backgroundColor: '#8B6F47', padding: 10, borderRadius: 8, alignItems: 'center' },
  downloadDisabled: { backgroundColor: '#C9C9C9' },
  downloadText: { color: '#fff', fontWeight: '800' },
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
});

export default withSidebarChrome(AlertDetail, { title: 'Evidence Detail' });
