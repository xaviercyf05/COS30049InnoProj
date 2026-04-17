import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import withRoleGuard from '../auth/withRoleGuard';

function nowLabel() {
  return new Date().toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AdminAnnouncementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [announcements, setAnnouncements] = useState([
    {
      id: 1,
      title: 'Level 1 Training - Bako National Park',
      teaser: 'Complete Level 1 to become a certified Park Guide for Bako National Park.',
      fullDesc: 'Complete all Level 1 modules before assessment to qualify for certification.',
      posted: nowLabel(),
      avatarLabel: 'L1',
    },
    {
      id: 2,
      title: 'Level 2 Training Open - Similajau and Kubah',
      teaser: 'Level 2 is now available for Similajau and Kubah tracks.',
      fullDesc: 'Level 2 covers advanced field communication and park-specific regulation topics.',
      posted: nowLabel(),
      avatarLabel: 'L2',
    },
  ]);

  const [expandedId, setExpandedId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentEditId, setCurrentEditId] = useState(null);
  const [titleInput, setTitleInput] = useState('');
  const [teaserInput, setTeaserInput] = useState('');
  const [descInput, setDescInput] = useState('');

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Home');
  };

  const openCreateModal = () => {
    setCurrentEditId(null);
    setTitleInput('');
    setTeaserInput('');
    setDescInput('');
    setModalVisible(true);
  };

  const openEditModal = (id) => {
    const announcement = announcements.find((item) => item.id === id);
    if (!announcement) {
      return;
    }

    setCurrentEditId(id);
    setTitleInput(announcement.title);
    setTeaserInput(announcement.teaser);
    setDescInput(announcement.fullDesc);
    setModalVisible(true);
  };

  const confirmAction = (title, message, onConfirm) => {
    if (Platform.OS === 'web' && typeof window?.confirm === 'function') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  };

  const deleteAnnouncement = (id) => {
    confirmAction(
      'Delete Announcement',
      'Are you sure you want to delete this announcement?',
      () => {
        setAnnouncements((previous) => previous.filter((item) => item.id !== id));
        if (expandedId === id) {
          setExpandedId(null);
        }
      }
    );
  };

  const saveAnnouncement = () => {
    if (!titleInput.trim()) {
      Alert.alert('Missing title', 'Please provide an announcement title.');
      return;
    }

    const existingAvatar = currentEditId
      ? announcements.find((item) => item.id === currentEditId)?.avatarLabel || 'GEN'
      : 'NEW';

    const announcementPayload = {
      id: currentEditId || Date.now(),
      title: titleInput.trim(),
      teaser: teaserInput.trim() || 'No teaser provided.',
      fullDesc: descInput.trim() || 'No description provided.',
      posted: nowLabel(),
      avatarLabel: existingAvatar,
    };

    if (currentEditId) {
      setAnnouncements((previous) =>
        previous.map((item) => (item.id === currentEditId ? announcementPayload : item))
      );
    } else {
      setAnnouncements((previous) => [announcementPayload, ...previous]);
    }

    setModalVisible(false);
    setCurrentEditId(null);
    setTitleInput('');
    setTeaserInput('');
    setDescInput('');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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

        <Text style={styles.topTitle}>Admin Announcements</Text>

        <View style={styles.topSpacer} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>Admin publishing board for training updates</Text>

        <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
          <Text style={styles.createButtonText}>+ Create New Announcement</Text>
        </TouchableOpacity>

        {announcements.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.announcementCard, expandedId === item.id && styles.announcementCardExpanded]}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            activeOpacity={0.9}
          >
            <View style={styles.leftSection}>
              <View style={styles.dotIndicator} />
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarText}>{item.avatarLabel}</Text>
              </View>
            </View>

            <View style={styles.announcementContent}>
              <View style={styles.announcementHeader}>
                <Text style={styles.announcementTitle}>{item.title}</Text>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    onPress={(event) => {
                      if (event?.stopPropagation) {
                        event.stopPropagation();
                      }
                      openEditModal(item.id);
                    }}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={(event) => {
                      if (event?.stopPropagation) {
                        event.stopPropagation();
                      }
                      deleteAnnouncement(item.id);
                    }}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.teaser}>{item.teaser}</Text>

              {expandedId === item.id && (
                <View style={styles.expandedArea}>
                  <Text style={styles.fullDescription}>{item.fullDesc}</Text>
                </View>
              )}

              <View style={styles.metaRow}>
                <Text style={styles.postedText}>Posted on: {item.posted}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {currentEditId ? 'Edit Announcement' : 'Create New Announcement'}
            </Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={titleInput}
              onChangeText={setTitleInput}
              placeholder="Announcement title"
            />

            <Text style={styles.label}>Teaser</Text>
            <TextInput
              style={[styles.input, styles.teaserInput]}
              value={teaserInput}
              onChangeText={setTeaserInput}
              placeholder="Short teaser"
              multiline
            />

            <Text style={styles.label}>Full Description</Text>
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              value={descInput}
              onChangeText={setDescInput}
              placeholder="Full description"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveAnnouncement}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    color: '#5D715D',
    fontSize: 14,
    marginBottom: 14,
  },
  createButton: {
    backgroundColor: '#656D4A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
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
  announcementCardExpanded: {
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 12,
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
    gap: 8,
  },
  announcementTitle: {
    flex: 1,
    paddingRight: 8,
    fontSize: 16,
    fontWeight: '800',
    color: '#2F4A3B',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editText: {
    color: '#2E6B4D',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteText: {
    color: '#C73737',
    fontWeight: '700',
    fontSize: 13,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    color: '#2B4334',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'center',
  },
  label: {
    color: '#38513F',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDE4D7',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#2E4334',
    backgroundColor: '#F9FBF7',
  },
  teaserInput: {
    minHeight: 84,
  },
  descriptionInput: {
    minHeight: 180,
  },
  modalButtons: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EEF2EA',
  },
  cancelButtonText: {
    color: '#3F5544',
    fontWeight: '700',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2E6B4D',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default withRoleGuard(AdminAnnouncementScreen, {
  allowedRoles: ['Admin'],
  screenName: 'Admin Announcements',
});
