import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ORIGIN, getApiBaseUrls, requestProfileApi } from '../Profile/profileApi.js';
import withRoleGuard from '../auth/withRoleGuard';

const COLORS = {
  lightBg: '#FBFCF8',
  white: '#FFFFFF',
  heading: '#20372A',
  subHeading: '#4B6252',
  olive: '#656D4A',
  sageBorder: '#E8EEE3',
  muted: '#6A7A67',
  approve: '#2E7D32',
  reject: '#C73737',
  pending: '#F59E0B',
  pillBg: '#ECF2E5',
  pillText: '#2E6B4D',
};

function AdminRegistrationManagementScreen({ navigation, useSharedChrome = false }) {
  const insets = useSafeAreaInsets();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resendingRegistrationId, setResendingRegistrationId] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const getAuthToken = async () => {
    const token = await AsyncStorage.getItem('innopapp_auth_token');

    if (!token) {
      throw new Error('Session expired. Please log in again.');
    }

    return token;
  };

  const loadApplications = useCallback(async () => {
    setLoading(true);

    try {
      const token = await getAuthToken();
      const response = await requestProfileApi('/api/v1/admin/registrations', token, {
        method: 'GET',
      });

      setApplications(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showModal(
        'Unable to load applications',
        error?.message || 'Please try again in a moment.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();

    const unsubscribe = navigation.addListener('focus', () => {
      loadApplications();
    });

    return unsubscribe;
  }, [loadApplications, navigation]);

  const counts = useMemo(() => {
    const pending = applications.filter((item) => item.status === 'pending').length;
    const approved = applications.filter((item) => item.status === 'approved').length;
    const rejected = applications.filter((item) => item.status === 'rejected').length;

    return {
      pending,
      approved,
      rejected,
      total: applications.length,
    };
  }, [applications]);

  const showModal = (title, message) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const token = await getAuthToken();

      await requestProfileApi(`/api/v1/admin/registrations/${id}/status`, token, {
        method: 'PUT',
        body: {
          status: newStatus,
        },
      });

      await loadApplications();

      const title = newStatus === 'approved' ? 'Application Approved' : 'Application Rejected';
      showModal(title, `The application has been marked as ${newStatus}.`);
    } catch (error) {
      showModal('Update failed', error?.message || 'Unable to update application status.');
    }
  };

  const resendVerificationToken = async (id) => {
    try {
      setResendingRegistrationId(id);

      const token = await getAuthToken();
      await requestProfileApi(`/api/v1/admin/registrations/${id}/resend-token`, token, {
        method: 'POST',
      });

      showModal(
        'Token Resent',
        'A new verification token has been emailed to the applicant. The previous token is no longer valid.'
      );
    } catch (error) {
      showModal('Resend failed', error?.message || 'Unable to resend verification token right now.');
    } finally {
      setResendingRegistrationId(null);
    }
  };

  const openResume = async (item) => {
    try {
      const token = await getAuthToken();
      const baseUrls = Platform.OS === 'web' ? getApiBaseUrls() : [API_ORIGIN];
      let lastError = null;

      for (const baseUrl of baseUrls) {
        try {
          const response = await fetch(
            `${baseUrl}/api/v1/admin/registrations/${item.id}/resume`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!response.ok) {
            const contentType = response.headers.get('content-type') || '';
            const payload = contentType.toLowerCase().includes('application/json')
              ? await response.json()
              : { message: await response.text() };

            throw new Error(payload?.message || `Request failed with status ${response.status}`);
          }

          if (Platform.OS === 'web') {
            const resumeBlob = await response.blob();
            const resumeBlobUrl = URL.createObjectURL(resumeBlob);
            const link = document.createElement('a');
            link.href = resumeBlobUrl;
            link.download = item.resumeName || 'resume.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(resumeBlobUrl), 60000);
          } else {
            showModal(
              'Resume Ready',
              'Resume preview is available in web mode. For native apps, add a dedicated file viewer integration.'
            );
          }

          return;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error('Unable to retrieve resume file.');
    } catch (error) {
      showModal('Resume unavailable', error?.message || 'Unable to open resume right now.');
    }
  };

  const renderStatus = (status) => {
    if (status === 'approved') {
      return styles.statusApproved;
    }

    if (status === 'rejected') {
      return styles.statusRejected;
    }

    return styles.statusPending;
  };

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

          <Text style={styles.topTitle}>Registration Management</Text>
          <View style={styles.topSpacer} />
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{counts.total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.pending }]}>{counts.pending}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.approve }]}>{counts.approved}</Text>
          <Text style={styles.summaryLabel}>Approved</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: COLORS.reject }]}>{counts.rejected}</Text>
          <Text style={styles.summaryLabel}>Rejected</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={COLORS.olive} />
          <Text style={styles.loadingText}>Loading registration applications...</Text>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.fullName}>{item.fullName}</Text>
                <Text style={[styles.statusBadge, renderStatus(item.status)]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.detail}>Username: {item.username}</Text>
              <Text style={styles.detail}>Phone: {item.phoneNumber}</Text>
              <Text style={styles.detail}>Email: {item.email}</Text>
              <Text style={styles.detail}>Resume: {item.resumeName}</Text>

              <TouchableOpacity style={styles.resumeButton} onPress={() => openResume(item)}>
                <Text style={styles.resumeButtonText}>Open Resume</Text>
              </TouchableOpacity>

              {item.status === 'approved' && (
                <TouchableOpacity
                  style={[
                    styles.resendButton,
                    resendingRegistrationId === item.id && styles.resendButtonDisabled,
                  ]}
                  onPress={() => resendVerificationToken(item.id)}
                  disabled={resendingRegistrationId === item.id}
                >
                  <Text style={styles.resendButtonText}>
                    {resendingRegistrationId === item.id ? 'Resending...' : 'Resend Token'}
                  </Text>
                </TouchableOpacity>
              )}

              {item.status === 'pending' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => updateStatus(item.id, 'approved')}
                  >
                    <Text style={styles.actionText}>Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => updateStatus(item.id, 'rejected')}
                  >
                    <Text style={styles.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>

            <Pressable style={styles.modalButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
  },
  topBar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EA',
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navPill: {
    backgroundColor: COLORS.pillBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
    alignItems: 'center',
  },
  navPillText: {
    color: COLORS.pillText,
    fontSize: 12,
    fontWeight: '700',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.heading,
  },
  topSpacer: {
    width: 92,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.sageBorder,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.heading,
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.subHeading,
    fontSize: 14,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 26,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.sageBorder,
    shadowColor: '#1D3828',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  fullName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.heading,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    overflow: 'hidden',
  },
  statusPending: {
    backgroundColor: COLORS.pending,
  },
  statusApproved: {
    backgroundColor: COLORS.approve,
  },
  statusRejected: {
    backgroundColor: COLORS.reject,
  },
  detail: {
    fontSize: 13,
    color: COLORS.subHeading,
    marginBottom: 4,
  },
  resumeButton: {
    marginTop: 10,
    backgroundColor: '#F2F5ED',
    borderWidth: 1,
    borderColor: '#D8E2CF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: COLORS.pillText,
    fontSize: 13,
    fontWeight: '700',
  },
  resendButton: {
    marginTop: 10,
    backgroundColor: '#F8F1E5',
    borderWidth: 1,
    borderColor: '#E5C78F',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resendButtonDisabled: {
    opacity: 0.7,
  },
  resendButtonText: {
    color: '#A86400',
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: COLORS.approve,
  },
  rejectBtn: {
    backgroundColor: COLORS.reject,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.subHeading,
    lineHeight: 21,
    marginBottom: 18,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: COLORS.olive,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 36,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default withRoleGuard(AdminRegistrationManagementScreen, {
  allowedRoles: ['Admin'],
  screenName: 'Registration Management',
});
