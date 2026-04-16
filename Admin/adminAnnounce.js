import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';

const colors = {
  olive: "#936639",
  brown: "#7f4f24",
  sage: "#a4ac86",
  forest: "#414833",
  deepForest: "#333d29",
};

export default function AdminAnnounceScreen() {
  const [announcements, setAnnouncements] = useState([
    {
      id: 1,
      title: 'Level 1 Training - Bako National Park',
      teaser: 'Complete Level 1 to become a certified Park Guide for Bako National Park.',
      fullDesc: 'Dear Trainees,\n\nTo become a certified Park Guide for Bako National Park, you must successfully complete the entire Level 1 course.',
      posted: new Date().toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      avatarEmoji: "🌲",
    },
    {
      id: 2,
      title: 'Level 2 Training Now Open - Similajau & Kubah National Parks',
      teaser: 'Congratulations! Level 2 is now available for Similajau and Kubah National Parks.',
      fullDesc: 'You may now enrol in Level 2 to become a certified guide for Similajau and Kubah National Parks.',
      posted: new Date().toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      avatarEmoji: "🏞️",
    },
  ]);

  const [expandedId, setExpandedId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentEditId, setCurrentEditId] = useState(null);
  const [titleInput, setTitleInput] = useState('');
  const [teaserInput, setTeaserInput] = useState('');
  const [descInput, setDescInput] = useState('');

  const openCreateModal = () => {
    setCurrentEditId(null);
    setTitleInput('New Announcement');
    setTeaserInput('Tap to expand and edit');
    setDescInput('Write the full description here...');
    setModalVisible(true);
  };

  const openEditModal = (id) => {
    const ann = announcements.find(a => a.id === id);
    if (ann) {
      setCurrentEditId(id);
      setTitleInput(ann.title);
      setTeaserInput(ann.teaser);
      setDescInput(ann.fullDesc);
      setModalVisible(true);
    }
  };

  const confirmAction = (title, message, onConfirm) => {
    if (Platform.OS === 'web' && typeof window?.confirm === 'function') {
      if (window.confirm(`${title}\n\n${message}`)) onConfirm();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  };

  const deleteAnnouncement = (id) => {
    confirmAction('Delete Announcement', 'Are you sure you want to delete this announcement? This action cannot be undone.', () => {
      setAnnouncements(prev => prev.filter(item => item.id !== id));
      if (expandedId === id) setExpandedId(null);
    });
  };

  const saveAnnouncement = () => {
    if (!titleInput.trim()) {
      Alert.alert('Error', 'Title cannot be empty');
      return;
    }

    const newPostedDate = new Date().toLocaleString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const newAnn = {
      id: currentEditId || Date.now(),
      title: titleInput.trim(),
      teaser: teaserInput.trim() || 'No teaser provided',
      fullDesc: descInput.trim() || 'No description provided',
      posted: newPostedDate,                    // ← Now updates on every edit
      avatarEmoji: currentEditId
        ? announcements.find(a => a.id === currentEditId)?.avatarEmoji || "🌲"
        : "📢",
    };

    if (currentEditId === null) {
      setAnnouncements([newAnn, ...announcements]);
    } else {
      setAnnouncements(announcements.map(a => a.id === currentEditId ? newAnn : a));
    }

    setModalVisible(false);
    setTitleInput('');
    setTeaserInput('');
    setDescInput('');
    setCurrentEditId(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.pageTitle}>Announcements</Text>
      <Text style={styles.subtitle}>Admin • Sarawak Forestry Corporation</Text>

      <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
        <Text style={styles.createButtonText}>+ Create New Announcement</Text>
      </TouchableOpacity>

      {announcements.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.announcement, expandedId === item.id && styles.announcementExpanded]}
          onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
          activeOpacity={0.9}
        >
          <View style={styles.leftSection}>
            <View style={styles.bullet} />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.avatarEmoji}</Text>
            </View>
          </View>

          <View style={styles.announcementContent}>
            <View style={styles.announcementHeader}>
              <Text style={styles.announcementTitle}>{item.title}</Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); openEditModal(item.id); }}>
                  <Text style={styles.editIcon}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); deleteAnnouncement(item.id); }}>
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.teaser}>{item.teaser}</Text>

            {expandedId === item.id && (
              <View style={styles.fullDescContainer}>
                <Text style={styles.fullDesc}>{item.fullDesc}</Text>
              </View>
            )}

            <View style={styles.meta}>
              <Text style={styles.posted}>Posted on: {item.posted}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {currentEditId === null ? 'Create New Announcement' : 'Edit Announcement'}
            </Text>

            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={titleInput} onChangeText={setTitleInput} placeholder="Announcement Title" />

            <Text style={styles.label}>Teaser</Text>
            <TextInput style={[styles.input, { height: 80 }]} value={teaserInput} onChangeText={setTeaserInput} placeholder="Short preview" multiline />

            <Text style={styles.label}>Full Description</Text>
            <TextInput style={[styles.input, { height: 180 }]} value={descInput} onChangeText={setDescInput} placeholder="Full description..." multiline textAlignVertical="top" />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveAnnouncement}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  scrollContent: { padding: 16, paddingBottom: 30 },
  pageTitle: { fontSize: 30, fontWeight: "700", color: colors.olive, marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.brown, marginBottom: 24 },

  createButton: {
    backgroundColor: colors.olive,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  announcement: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    elevation: 4,
  },
  announcementExpanded: {
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginRight: 12,
  },
  bullet: {
    width: 9,
    height: 9,
    backgroundColor: "#e74c3c",
    borderRadius: 50,
    marginTop: 10,
    marginRight: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    backgroundColor: "#a68a64",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 24 },

  announcementContent: { flex: 1 },
  announcementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  announcementTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.olive,
    flex: 1,
    paddingRight: 8,
  },
  actionButtons: { flexDirection: 'row', gap: 16 },
  editIcon: { fontSize: 22, color: colors.sage },
  deleteIcon: { fontSize: 22, color: "#e63939" },

  teaser: { fontSize: 15, color: colors.forest, lineHeight: 21 },
  fullDescContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  fullDesc: { fontSize: 15, color: colors.forest, lineHeight: 23 },
  meta: { marginTop: 14, alignItems: "flex-end" },
  posted: { fontSize: 13, color: colors.brown, fontWeight: "500" },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 30 : 0,   // Extra safety for Android status bar
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 500
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.forest, marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 16, fontWeight: '600', color: colors.forest, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#f9f9f7',
    marginBottom: 12
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 24 },
  cancelText: { color: '#666', fontWeight: '600', fontSize: 16 },
  saveButton: { backgroundColor: colors.olive, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
