import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestProfileApi } from '../Profile/profileApi.js';
import withRoleGuard from '../auth/withRoleGuard';

function AnnouncementCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const isWeb = Platform.OS === 'web';

  return (
    <TouchableOpacity
      style={[
        styles.announcementCard,
        expanded && styles.announcementCardExpanded,
        !isWeb && styles.announcementCardMobile,
      ]}
      onPress={() => setExpanded((previous) => !previous)}
      activeOpacity={0.9}
    >
      <View style={[styles.leftSection, !isWeb && styles.leftSectionMobile]}>
        <View style={styles.dotIndicator} />
        <View style={styles.avatarBadge}>
          <Text style={styles.avatarText}>{item.avatarLabel}</Text>
        </View>
      </View>

      <View style={styles.announcementContent}>
        <View style={styles.announcementHeader}>
          <Text style={styles.announcementTitle}>{item.title}</Text>
          <Text style={[styles.chevron, expanded && styles.chevronRotated]}>{'>'}</Text>
        </View>

        {!expanded && (
          <Text style={styles.teaser}>{item.teaser}</Text>
        )}

        {expanded && (
          <View style={styles.expandedArea}>
            <Text style={styles.fullDescription}>{item.fullDesc}</Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.postedText}>Posted on: {item.posted}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function AnnouncementScreen({ navigation, useSharedChrome = false }) {
  const insets = useSafeAreaInsets();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadAnnouncements = async () => {
      setLoading(true);

      try {
        const token = await AsyncStorage.getItem('auth_token');

        if (!token) {
          return;
        }

        const response = await requestProfileApi('/api/v1/notifications/announcements', token, {
          method: 'GET',
        });

        if (!active) {
          return;
        }

        const loaded = Array.isArray(response.data) ? response.data : [];

        if (loaded.length === 0) {
          setAnnouncements([]);
          return;
        }

        setAnnouncements(
          loaded.map((item) => ({
            id: item.id || item.announcementId,
            title: item.title || 'Announcement',
            teaser: item.teaser || item.content || '',
            fullDesc: item.fullDesc || item.content || item.teaser || '',
            posted: item.posted || item.createdAt || 'Unknown date',
            avatarLabel: item.avatarLabel || 'AN',
          }))
        );
      } catch (_error) {
        if (active) {
          setAnnouncements([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadAnnouncements();

    const unsubscribe = navigation.addListener('focus', () => {
      loadAnnouncements();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigation]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {!useSharedChrome ? (
        <View
          style={[
            styles.topBar,
            {
              paddingTop: Platform.OS === 'web' ? 14 : Math.max(10, insets.top + 4),
            },
          ]}
        >
          <TouchableOpacity style={styles.navPill} onPress={handleBack}>
            <Text style={styles.navPillText}>{'< Back'}</Text>
          </TouchableOpacity>

          <Text style={styles.topTitle}>Announcements</Text>

          <View style={styles.topSpacer} />
        </View>
      ) : null}

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Digital Park Guide Training Platform • Sarawak Forestry Corporation
        </Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#2E6B4D" />
            <Text style={styles.loadingText}>Loading announcements...</Text>
          </View>
        ) : announcements.length > 0 ? (
          announcements.map((item) => <AnnouncementCard key={item.id} item={item} />)
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No announcements available right now.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBFCF8',
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EA',
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navPill: {
    backgroundColor: '#ECF2E5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
    alignItems: 'center',
  },
  navPillText: {
    color: '#2E6B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#20372A',
  },
  topSpacer: {
    width: 92,
  },
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  subtitle: {
    fontSize: 14,
    color: '#5D715D',
    marginBottom: 16,
  },
  loadingWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDE3',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  loadingText: {
    marginTop: 10,
    color: '#4F6354',
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDE3',
    borderRadius: 14,
    padding: 18,
  },
  emptyText: {
    color: '#566A5C',
    fontSize: 14,
  },
  announcementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E8EDE3',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  announcementCardMobile: {
    flexDirection: 'column',
  },
  announcementCardExpanded: {
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  leftSectionMobile: {
    marginRight: 0,
    marginBottom: 8,
  },
  dotIndicator: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#D66B6B',
    marginTop: 11,
    marginRight: 12,
  },
  avatarBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#AFC39D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#264233',
    fontWeight: '800',
    fontSize: 13,
  },
  announcementContent: {
    flex: 1,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  announcementTitle: {
    flex: 1,
    paddingRight: 8,
    fontSize: 16,
    fontWeight: '800',
    color: '#2F4A3B',
  },
  chevron: {
    fontSize: 16,
    color: '#789272',
    fontWeight: '700',
  },
  chevronRotated: {
    transform: [{ rotate: '90deg' }],
  },
  teaser: {
    color: '#445A4D',
    fontSize: 14,
    lineHeight: 20,
  },
  expandedArea: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2EA',
  },
  fullDescription: {
    color: '#355042',
    fontSize: 14,
    lineHeight: 22,
  },
  metaRow: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  postedText: {
    color: '#6A7A67',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default withRoleGuard(AnnouncementScreen, {
  allowedRoles: ['User', 'Admin'],
  screenName: 'Announcements',
});