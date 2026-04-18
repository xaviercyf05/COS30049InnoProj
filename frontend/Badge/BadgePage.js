import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import withRoleGuard from '../auth/withRoleGuard';
import { pickProfileImagePath, resolveProfileImageUri } from '../Profile/profileApi';
import { requestProfileApi } from '../Profile/profileApi';

function BadgeScreen({ currentProfile }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadBadges = async () => {
      setLoading(true);

      try {
        const token = await AsyncStorage.getItem('innopapp_auth_token');

        if (!token) {
          if (active) {
            setBadges([]);
          }
          return;
        }

        const response = await requestProfileApi('/api/v1/badges', token, {
          method: 'GET',
        });

        if (!active) {
          return;
        }

        const loadedBadges = Array.isArray(response.data) ? response.data : [];
        setBadges(
          loadedBadges.map((badge) => ({
            id: badge.id || badge.badgeId,
            name: badge.name,
            unlocked: Boolean(badge.unlocked),
            image: badge.image,
          }))
        );
      } catch (_error) {
        if (active) {
          setBadges([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadBadges();

    return () => {
      active = false;
    };
  }, []);

  const earnedBadges = badges.filter((badge) => badge.unlocked).length;
  const totalBadges = badges.length;
  const displayName = currentProfile?.fullName || currentProfile?.username || 'User';
  const resolvedProfileImagePath = pickProfileImagePath(currentProfile);
  const avatarSource = resolvedProfileImagePath
    ? { uri: resolveProfileImageUri(resolvedProfileImagePath) }
    : { uri: 'https://i.pinimg.com/736x/cc/f4/05/ccf405a0cd0fa9c574d87d7bc2bcc900.jpg' };

  return (
    <View style={styles.container}>
      <View style={styles.userSection}>
        <Image
          source={avatarSource}
          style={styles.userImage}
        />
        <Text style={styles.username}>{displayName}</Text>
        <Text style={styles.progress}>
          {earnedBadges} / {totalBadges} badges earned
        </Text>
      </View>

      <View style={styles.gridWrapper}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#2E6B4D" />
            <Text style={styles.loadingText}>Loading badges...</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {badges.map((badge) => (
              <TouchableOpacity key={badge.id} style={styles.badgeCard}>
                <Image
                  source={{ uri: badge.image || 'https://cdn-icons-png.flaticon.com/512/16779/16779402.png' }}
                  style={[styles.badgeIcon, { opacity: badge.unlocked ? 1 : 0.3 }]}
                />
                <Text style={styles.badgeText}>{badge.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 10,
  },
  username: {
    fontWeight: 'bold',
  },
  progress: {
    color: '#666',
  },
  gridWrapper: {
    alignItems: 'center',
  },
  loadingWrap: {
    width: '90%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#5C6A60',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '90%',
  },
  badgeCard: {
    width: '30%',
    margin: '1.5%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  badgeIcon: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  badgeText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
    color: '#555',
  },
});

export default withRoleGuard(BadgeScreen, {
  allowedRoles: ['User', 'Admin'],
  screenName: 'Badges',
});