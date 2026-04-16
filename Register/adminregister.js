import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  darkBrown: '#582f0e',
  brown: '#7f4f24',
  olive: '#936639',
  lightBrown: '#a68a64',
  beige: '#b6ad90',
  lightBeige: '#c2c5aa',
  sage: '#a4ac86',
  forestGreen: '#656d4a',
  darkGreen: '#414833',
  deepestGreen: '#333d29',
  errorRed: '#d32f2f',
  successGreen: '#2e7d32',
};

const AdminScreen = () => {
  const navigation = useNavigation();

  const [applications, setApplications] = useState([
    {
      id: '1',
      username: 'johnparkguide',
      fullName: 'John Tan',
      phoneNumber: '012-3456789',
      email: 'john@gmail.com',
      resumeName: 'John_Tan_Resume.pdf',
      status: 'pending',
    },
    {
      id: '2',
      username: 'sarahforest',
      fullName: 'Sarah Lim',
      phoneNumber: '014-5678901',
      email: 'sarah@gmail.com',
      resumeName: 'Sarah_Lim_CV.pdf',
      status: 'pending',
    },
    {
      id: '3',
      username: 'mikeguide88',
      fullName: 'Michael Wong',
      phoneNumber: '011-2233445',
      email: 'mike@gmail.com',
      resumeName: 'Michael_Wong_Application.pdf',
      status: 'approved',
    },
  ]);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (title, message) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const updateStatus = (id, newStatus) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
    );

    const action = newStatus === 'approved' ? 'Approved ✅' : 'Rejected ❌';
    showModal(action, `Application has been ${newStatus}.`);
  };

  const handleDownloadResume = (item) => {
    showModal(
      'Resume Download',
      `Demo Mode:\n\n"${item.resumeName}" would be downloaded here.\n\nWhen connected to a real backend, the PDF file will be available for download.`
    );
  };

  const handleModalClose = () => {
    setModalVisible(false);
  };

  const renderApplication = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.fullName}>{item.fullName}</Text>
        <Text
          style={[
            styles.statusBadge,
            item.status === 'approved' ? styles.approved :
            item.status === 'rejected' ? styles.rejected : styles.pending,
          ]}
        >
          {item.status.toUpperCase()}
        </Text>
      </View>

      <Text style={styles.detail}>Username: {item.username}</Text>
      <Text style={styles.detail}>Phone: {item.phoneNumber}</Text>
      <Text style={styles.detail}>Email: {item.email}</Text>
      <Text style={styles.detail}>Resume: {item.resumeName}</Text>

      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => handleDownloadResume(item)}
      >
        <Text style={styles.downloadText}>📄 Download / Open Resume</Text>
      </TouchableOpacity>

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
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.deepestGreen} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Park Guide Registration</Text>
        <Text style={styles.headerSubtitle}>Application Management</Text>
      </View>

      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        renderItem={renderApplication}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        statusBarTranslucent={true}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>

            <Pressable style={styles.modalButton} onPress={handleModalClose}>
              <Text style={styles.modalButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.lightBeige },
  header: {
    backgroundColor: COLORS.deepestGreen,
    paddingVertical: 25,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: COLORS.lightBeige },
  headerSubtitle: { fontSize: 16, color: COLORS.sage, marginTop: 4 },

  listContainer: { padding: 20 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: COLORS.darkBrown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  fullName: { fontSize: 20, fontWeight: '700', color: COLORS.deepestGreen },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: '700',
  },
  pending: { backgroundColor: '#ff9800', color: '#fff' },
  approved: { backgroundColor: COLORS.successGreen, color: '#fff' },
  rejected: { backgroundColor: COLORS.errorRed, color: '#fff' },

  detail: { fontSize: 15, color: COLORS.darkGreen, marginBottom: 6 },
  downloadButton: {
    backgroundColor: COLORS.beige,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: COLORS.olive,
    borderStyle: 'dashed',
  },
  downloadText: { color: COLORS.olive, fontWeight: '600', fontSize: 16 },

  actionButtons: { flexDirection: 'row', marginTop: 16, gap: 12 },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  approveBtn: { backgroundColor: COLORS.successGreen },
  rejectBtn: { backgroundColor: COLORS.errorRed },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    width: '88%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.deepestGreen,
    marginBottom: 14,
    textAlign: 'center'
  },
  modalMessage: {
    fontSize: 16,
    color: COLORS.darkGreen,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28
  },
  modalButton: {
    backgroundColor: COLORS.olive,
    paddingVertical: 14,
    paddingHorizontal: 50,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700'
  },
});

export default AdminScreen;