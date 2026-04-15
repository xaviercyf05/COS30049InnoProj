import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestProfileApi } from '../Profile/profileApi';

function resolveRole(profile) {
  if (!profile) {
    return '';
  }

  return profile.viewerRole || profile.role || '';
}

export default function withRoleGuard(
  WrappedComponent,
  { allowedRoles = ['User', 'Admin'], screenName = 'this page' } = {}
) {
  return function RoleGuardedScreen(props) {
    const { navigation } = props;
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [currentProfile, setCurrentProfile] = useState(null);

    useEffect(() => {
      let active = true;

      const verifyRole = async () => {
        setLoading(true);

        try {
          const token = await AsyncStorage.getItem('innopapp_auth_token');

          if (!token) {
            if (!active) {
              return;
            }

            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
            return;
          }

          const response = await requestProfileApi('/api/v1/user/profile', token, {
            method: 'GET',
          });

          if (!active) {
            return;
          }

          const profile = response.data;
          const role = resolveRole(profile);

          setCurrentProfile(profile);
          await AsyncStorage.setItem('innopapp_auth_role', role || '');

          if (allowedRoles.includes(role)) {
            setAuthorized(true);
            setErrorMessage('');
            return;
          }

          setAuthorized(false);
          setErrorMessage(`Access denied. ${screenName} is only available to ${allowedRoles.join(' / ')} role(s).`);
        } catch (error) {
          if (!active) {
            return;
          }

          if (error?.status === 401) {
            await AsyncStorage.multiRemove(['innopapp_auth_token', 'innopapp_auth_role']);
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
            return;
          }

          setAuthorized(false);
          setErrorMessage(error?.message || 'Unable to verify access for this page.');
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      verifyRole();

      return () => {
        active = false;
      };
    }, [navigation]);

    if (loading) {
      return (
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Checking access...</Text>
        </SafeAreaView>
      );
    }

    if (!authorized) {
      return (
        <SafeAreaView style={styles.deniedContainer}>
          <View style={styles.deniedCard}>
            <Text style={styles.deniedTitle}>Restricted Page</Text>
            <Text style={styles.deniedMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.deniedButton}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.85}
            >
              <Text style={styles.deniedButtonText}>Back To Dashboard</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return <WrappedComponent {...props} currentProfile={currentProfile} />;
  };
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
  deniedContainer: {
    flex: 1,
    backgroundColor: '#0F1E18',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deniedCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#F4F1E8',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D5DEC8',
  },
  deniedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#20372A',
  },
  deniedMessage: {
    marginTop: 10,
    color: '#435948',
    fontSize: 14,
    lineHeight: 20,
  },
  deniedButton: {
    marginTop: 16,
    backgroundColor: '#2E6B4D',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deniedButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
