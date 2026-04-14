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

export default function AnnounceScreen() {
  const [announcements, setAnnouncements] = useState([
    {
      id: 1,
      title: 'Level 1 Training – Bako National Park',
      teaser: 'Complete Level 1 to become a certified Park Guide for Bako National Park.',
      fullDesc: 'Dear Trainees,\n\nTo become a certified Park Guide for Bako National Park, you must successfully complete the entire Level 1 course.',
      posted: new Date().toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    },
    {
      id: 2,
      title: 'Level 2 Training Now Open – Similajau & Kubah National Parks',
      teaser: 'Congratulations! Level 2 is now available for Similajau and Kubah National Parks.',
      fullDesc: 'You may now enrol in Level 2 to become a certified guide for Similajau and Kubah National Parks.',
      posted: new Date().toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
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
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
      return;
    }

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onConfirm },
      ]
    );
  };

  const deleteAnnouncement = (id) => {
    confirmAction(
      'Delete Announcement',
      'Are you sure you want to delete this announcement? This action cannot be undone.',
      () => {
        setAnnouncements(prev => prev.filter(item => item.id !== id));
        if (expandedId === id) setExpandedId(null);
      }
    );
  };

  const saveAnnouncement = () => {
    if (!titleInput.trim()) {
      Alert.alert('Error', 'Title cannot be empty');
      return;
    }

    const newAnn = {
      id: currentEditId || Date.now(),
      title: titleInput.trim(),
      teaser: teaserInput.trim() || 'No teaser provided',
      fullDesc: descInput.trim() || 'No description provided',
      posted: currentEditId 
        ? announcements.find(a => a.id === currentEditId)?.posted 
        : new Date().toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
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

      <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
        <Text style={styles.createButtonText}>+ Create New Announcement</Text>
      </TouchableOpacity>

      {announcements.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>

              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  onPress={() => openEditModal(item.id)}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <Text style={styles.icon}>✏️</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => deleteAnnouncement(item.id)}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.cardBody}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
              activeOpacity={0.95}
            >
              <Text style={styles.teaser}>{item.teaser}</Text>
              {expandedId === item.id && <Text style={styles.fullDesc}>{item.fullDesc}</Text>}
              <Text style={styles.posted}>Posted on: {item.posted}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
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
  container: { flex: 1, backgroundColor: '#FBFCF8' },
  scrollContent: { padding: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#1A2421', marginBottom: 20 },

  createButton: { backgroundColor: '#936639', padding: 16, borderRadius: 15, alignItems: 'center', marginBottom: 20 },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#3A4D39',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    elevation: 5,
  },
  cardContent: { padding: 18 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#3A4D39', flex: 1 },
  actionButtons: { flexDirection: 'row', gap: 20 },
  icon: { fontSize: 26 },
  deleteIcon: { fontSize: 26, color: '#e63939' },
  cardBody: { paddingTop: 0 },

  teaser: { fontSize: 15, color: '#555', marginBottom: 8 },
  fullDesc: { fontSize: 15, color: '#414833', lineHeight: 24, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  posted: { fontSize: 13, color: '#888', textAlign: 'right', marginTop: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '90%', maxHeight: '88%' },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#3A4D39', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 16, fontWeight: '600', color: '#3A4D39', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#f9f9f7', marginBottom: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 24 },
  cancelText: { color: '#666', fontWeight: '600', fontSize: 16 },
  saveButton: { backgroundColor: '#936639', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
