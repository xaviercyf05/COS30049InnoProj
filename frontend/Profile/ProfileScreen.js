import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pickProfileImagePath, requestProfileApi, resolveProfileImageUri } from './profileApi';

const defaultAvatar = require('../assets/icon.png');

function toProgressPercent(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (parsed < 0) {
    return 0;
  }

  if (parsed > 100) {
    return 100;
  }

  return Math.round(parsed);
}

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [moduleProgress, setModuleProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const token = await AsyncStorage.getItem('auth_token');

        if (!token) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
          return;
        }

        const [profileResponse, modulesResponse] = await Promise.all([
          requestProfileApi('/api/v1/user/profile', token, {
            method: 'GET',
          }),
          requestProfileApi('/api/v1/modules/dashboard', token, {
            method: 'GET',
          }).catch(() => null),
        ]);

        const response = profileResponse;

        const rawModules = Array.isArray(modulesResponse?.data)
          ? modulesResponse.data
          : [];

        const normalizedModules = rawModules.map((module, index) => ({
          id: String(module.moduleId || module.id || index + 1),
          title: module.title || module.name || `Module ${index + 1}`,
          progressPercent: toProgressPercent(module.progressPercent ?? module.progress ?? 0),
          stage: module.stage || module.moduleType || module.module_type || 'General',
          unlocked: module.unlocked !== false,
          lockReason: module.lockReason || module.progressMessage || '',
        }));

        setModuleProgress(normalizedModules);

        setProfile(response.data);
      } catch (error) {
        const message = error?.message || 'Unable to load profile.';
        Alert.alert('Profile Error', message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigation]
  );

  useEffect(() => {
    loadProfile();

    const unsubscribe = navigation.addListener('focus', () => {
      loadProfile({ silent: true });
    });

    return unsubscribe;
  }, [navigation, loadProfile]);

  const isAdmin = useMemo(() => {
    if (!profile) {
      return false;
    }

    const effectiveRole = profile.viewerRole || profile.role;
    return effectiveRole === 'Admin';
  }, [profile]);

  const accentColor = isAdmin ? '#2E6B4D' : '#656D4A';
  const progressPercent = toProgressPercent(profile?.progress);
  const stationLabel = isAdmin ? 'Office' : 'Station';
  const statusText = profile?.status || 'Unknown';

  const resolvedProfileImagePath = pickProfileImagePath(profile);
  const avatarSource = resolvedProfileImagePath
    ? { uri: resolveProfileImageUri(resolvedProfileImagePath) }
    : { uri: 'https://static.vecteezy.com/system/resources/previews/036/280/651/original/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-illustration-vector.jpg' };

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProfile({ silent: true });
            }}
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextBlock}>
              <Text style={[styles.kicker, { color: isAdmin ? '#A7CFA8' : '#CCD5AE' }]}>
                {isAdmin ? 'National Park Admin' : 'National Park Guide'}
              </Text>
              <Text style={styles.header}>{isAdmin ? 'Admin Profile' : 'Guide Profile'}</Text>
              <Text style={styles.subtitle}>
                {isAdmin
                  ? 'Manage operations and keep your admin profile details accurate.'
                  : 'Track your guide details and progress for training completion.'}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: isAdmin ? 'rgba(243,247,239,0.12)' : 'rgba(194,197,170,0.28)' }]}>
              <Text style={styles.badgeText}>{profile?.role || 'User'}</Text>
            </View>
          </View>

          <View style={styles.imageRow}>
            <View style={styles.imageContainer}>
              <Image source={avatarSource} style={styles.image} />
            </View>

            <View style={styles.profileMeta}>
              <Text style={styles.profileName}>{profile?.fullName || '-'}</Text>
              <Text style={[styles.profileLabel, { color: isAdmin ? '#A7CFA8' : '#E7EFC7' }]}>
                {profile?.role || 'Role not available'}
              </Text>
              <Text style={styles.profileSubLabel}>User ID: {profile?.userId || '-'}</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{stationLabel}: {profile?.station || 'Not assigned'}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={[styles.heroButton, { backgroundColor: accentColor }]}
              onPress={() => navigation.navigate('EditProfile', { profile })}
              activeOpacity={0.9}
            >
              <Text style={styles.heroButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroButton, styles.securityButton, { backgroundColor: '#355C4B' }]}
              onPress={() => navigation.navigate('Security')}
              activeOpacity={0.9}
            >
              <Text style={styles.heroButtonText}>Security</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <Text style={styles.fieldValue}>{profile?.fullName || '-'}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{profile?.email || '-'}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Username</Text>
            <Text style={styles.fieldValue}>{profile?.username || '-'}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Status</Text>
            <Text style={styles.fieldValue}>{statusText}</Text>
          </View>

          <View style={styles.fieldRowLast}>
            <Text style={styles.fieldLabel}>{stationLabel}</Text>
            <Text style={styles.fieldValue}>{profile?.station || 'Not assigned'}</Text>
          </View>
        </View>

        {!isAdmin ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Module Progress</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Overall Progress</Text>
              <Text style={styles.fieldValue}>{progressPercent}%</Text>
            </View>

            <View style={styles.moduleListHeader}>
              <Text style={styles.moduleListHeaderText}>Enrolled modules</Text>
              <Text style={styles.moduleListHeaderCount}>{moduleProgress.length} total</Text>
            </View>

            {moduleProgress.length > 0 ? (
              <View style={styles.moduleList}>
                {moduleProgress.map((module) => (
                  <View key={module.id} style={styles.moduleCard}>
                    <View style={styles.moduleCardTopRow}>
                      <View style={styles.moduleCardTitleBlock}>
                        <Text style={styles.moduleCardTitle} numberOfLines={2}>
                          {module.title}
                        </Text>
                        <Text style={styles.moduleCardMeta}>
                          {module.stage || 'General'}
                        </Text>
                      </View>
                      <Text style={styles.moduleCardPercent}>{module.progressPercent}%</Text>
                    </View>

                    <View style={styles.moduleProgressBar}>
                      <View
                        style={[
                          styles.moduleProgressFill,
                          { width: `${module.progressPercent}%` },
                        ]}
                      />
                    </View>

                    {/* status text intentionally removed per UX request */}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyModuleState}>
                <Text style={styles.emptyModuleStateText}>
                  No enrolled modules were returned yet.
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#173427',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#1E3327',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTextBlock: {
    flex: 1,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  header: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F3F7EF',
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: 'rgba(243,247,239,0.8)',
    lineHeight: 20,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    color: '#F3F7EF',
    fontWeight: '700',
    fontSize: 12,
  },
  imageRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  imageContainer: {
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    color: '#F6FAF1',
    fontSize: 22,
    fontWeight: '800',
  },
  profileLabel: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
  },
  profileSubLabel: {
    marginTop: 6,
    color: 'rgba(231, 240, 226, 0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: '#E7F0E2',
    fontSize: 12,
    fontWeight: '600',
  },
  heroActionRow: {
    marginTop: 14,
    alignItems: 'flex-end',
  },
  heroButton: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#F4F1E8',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D5DEC8',
  },
  sectionTitle: {
    color: '#233A2E',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  fieldRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3D2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  fieldRowLast: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3D2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldLabel: {
    color: '#556B5B',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldValue: {
    color: '#1B3225',
    fontSize: 15,
    fontWeight: '600',
  },
  statusPanel: {
    borderWidth: 1,
    borderColor: '#DCE3D2',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0E7',
    paddingVertical: 8,
  },
  statusRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusText: {
    color: '#435948',
    fontSize: 14,
    fontWeight: '600',
  },
  statusValue: {
    color: '#1F3F2A',
    fontSize: 13,
    fontWeight: '700',
  },
  moduleListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  moduleListHeaderText: {
    color: '#556B5B',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  moduleListHeaderCount: {
    color: '#6B7F70',
    fontSize: 12,
    fontWeight: '700',
  },
  moduleList: {
    gap: 10,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3D2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  moduleCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  moduleCardTitleBlock: {
    flex: 1,
  },
  moduleCardTitle: {
    color: '#1B3225',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  moduleCardMeta: {
    color: '#5B705F',
    fontSize: 12,
    fontWeight: '600',
  },
  moduleCardPercent: {
    color: '#1F3F2A',
    fontSize: 18,
    fontWeight: '800',
  },
  moduleProgressBar: {
    height: 8,
    backgroundColor: '#E5ECE0',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
  },
  moduleProgressFill: {
    height: '100%',
    backgroundColor: '#2E6B4D',
    borderRadius: 999,
  },
  moduleCardStatus: {
    marginTop: 8,
    color: '#5A6B5B',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyModuleState: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3D2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  emptyModuleStateText: {
    color: '#5A6B5B',
    fontSize: 13,
    lineHeight: 19,
  },
});
