import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';

export default function ModuleScreen() {
  const [modules, setModules] = useState([
    {
      id: 1,
      title: '1.1 Conservation',
      subs: [
        { id: 11, title: '1.1.1 Introduction to Conservation', content: 'Conservation is the protection and preservation of natural resources...' },
        { id: 12, title: '1.1.2 Protected Species in Sarawak', content: 'Sarawak is home to many protected species...' },
      ],
    },
    {
      id: 2,
      title: '1.2 Biodiversity',
      subs: [
        { id: 21, title: '1.2.1 Understanding Biodiversity', content: 'Biodiversity refers to the variety of life...' },
      ],
    },
  ]);

  const [expandedMain, setExpandedMain] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('');
  const [currentMainId, setCurrentMainId] = useState(null);
  const [currentSubId, setCurrentSubId] = useState(null);
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');

  const openMainModal = (mainId = null) => {
    setModalMode('main');
    setCurrentMainId(mainId);
    setTitleInput(mainId ? modules.find(m => m.id === mainId)?.title || '' : 'New Main Topic');
    setContentInput('');
    setModalVisible(true);
  };

  const openSubModal = (mainId, subId = null) => {
    setModalMode('sub');
    setCurrentMainId(mainId);
    setCurrentSubId(subId);

    if (subId) {
      const sub = modules.find(m => m.id === mainId)?.subs.find(s => s.id === subId);
      setTitleInput(sub?.title || '');
      setContentInput(sub?.content || '');
    } else {
      setTitleInput('New Sub-topic');
      setContentInput('Write content here...');
    }
    setModalVisible(true);
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

  const deleteMainTopic = (mainId) => {
    confirmAction(
      'Delete Main Topic',
      'This will delete the topic and all its sub-topics. This action cannot be undone.',
      () => {
        setModules(prev => prev.filter(m => m.id !== mainId));
        if (expandedMain === mainId) setExpandedMain(null);
        if (selectedContent && modules.some(m => m.id === mainId && m.subs.some(s => s.id === selectedContent.id))) {
          setSelectedContent(null);
        }
      }
    );
  };

  const deleteSubTopic = (mainId, subId) => {
    confirmAction(
      'Delete Sub-topic',
      'Are you sure you want to delete this sub-topic?',
      () => {
        setModules(prev => prev.map(m => {
          if (m.id === mainId) {
            return { ...m, subs: m.subs.filter(s => s.id !== subId) };
          }
          return m;
        }));
        if (selectedContent && selectedContent.id === subId) {
          setSelectedContent(null);
        }
      }
    );
  };

  const saveModal = () => {
    if (!titleInput.trim()) {
      Alert.alert('Error', 'Title cannot be empty');
      return;
    }

    if (modalMode === 'main') {
      if (currentMainId === null) {
        const newMain = { id: Date.now(), title: titleInput.trim(), subs: [] };
        setModules(prev => [...prev, newMain]);
      } else {
        setModules(prev => prev.map(m => m.id === currentMainId ? { ...m, title: titleInput.trim() } : m));
      }
    } else {
      const newSub = {
        id: currentSubId || Date.now(),
        title: titleInput.trim(),
        content: contentInput.trim() || 'No content provided yet.',
      };

      setModules(prev => prev.map(m => {
        if (m.id === currentMainId) {
          if (currentSubId === null) {
            return { ...m, subs: [...m.subs, newSub] };
          } else {
            return { ...m, subs: m.subs.map(s => s.id === currentSubId ? newSub : s) };
          }
        }
        return m;
      }));
    }

    setModalVisible(false);
    resetModal();
  };

  const resetModal = () => {
    setTitleInput('');
    setContentInput('');
    setCurrentMainId(null);
    setCurrentSubId(null);
    setModalMode('');
  };

  const showSubContent = (sub) => setSelectedContent(sub);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <ImageBackground source={{ uri: 'https://picsum.photos/id/1015/1600/500' }} style={styles.banner} imageStyle={{ opacity: 0.85 }}>
        <View style={styles.bannerOverlay}>
          <Text style={styles.bannerTitle}>Level 1 Modules</Text>
          <Text style={styles.bannerSubtitle}>Conservation • Biodiversity • Eco-tourism • Legislation • Safety</Text>
        </View>
      </ImageBackground>

      <View style={styles.mainArea}>
        <View style={styles.leftNav}>
          <TouchableOpacity style={styles.createMainBtn} onPress={() => openMainModal(null)}>
            <Text style={styles.createMainBtnText}>+ Create New Main Topic</Text>
          </TouchableOpacity>

          {modules.map((mod) => (
            <View key={mod.id}>
              <View style={styles.mainTopic}>
                {/* Clickable area for expand only */}
                <TouchableOpacity 
                  style={styles.mainTopicContent}
                  onPress={() => setExpandedMain(expandedMain === mod.id ? null : mod.id)}
                  activeOpacity={0.95}
                >
                  <Text style={styles.mainTopicText}>{mod.title}</Text>
                </TouchableOpacity>

                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    onPress={() => openMainModal(mod.id)}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <Text style={styles.icon}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => deleteMainTopic(mod.id)}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <Text style={styles.deleteIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {expandedMain === mod.id && (
                <View style={styles.subList}>
                  <TouchableOpacity style={styles.createSubBtn} onPress={() => openSubModal(mod.id, null)}>
                    <Text style={styles.createSubBtnText}>+ New Sub-topic</Text>
                  </TouchableOpacity>

                  {mod.subs.map((sub) => (
                    <View key={sub.id} style={styles.subTopic}>
                      <TouchableOpacity 
                        style={styles.subTopicContent}
                        onPress={() => showSubContent(sub)}
                        activeOpacity={0.95}
                      >
                        <Text style={styles.subTopicText}>{sub.title}</Text>
                      </TouchableOpacity>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity 
                          onPress={() => openSubModal(mod.id, sub.id)}
                          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                          <Text style={styles.icon}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => deleteSubTopic(mod.id, sub.id)}
                          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                          <Text style={styles.deleteIcon}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.rightContent}>
          {selectedContent ? (
            <>
              <Text style={styles.contentTitle}>{selectedContent.title}</Text>
              <Text style={styles.contentText}>{selectedContent.content}</Text>
            </>
          ) : (
            <Text style={styles.placeholderText}>Select a sub-topic from the left</Text>
          )}
        </View>
      </View>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { setModalVisible(false); resetModal(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalMode === 'main' 
                ? (currentMainId === null ? 'New Main Topic' : 'Edit Main Topic')
                : (currentSubId === null ? 'New Sub-topic' : 'Edit Sub-topic')}
            </Text>

            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={titleInput} onChangeText={setTitleInput} placeholder="Enter title" />

            {modalMode === 'sub' && (
              <>
                <Text style={styles.label}>Content</Text>
                <TextInput
                  style={[styles.input, { height: 200 }]}
                  value={contentInput}
                  onChangeText={setContentInput}
                  placeholder="Write full content here..."
                  multiline
                  textAlignVertical="top"
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setModalVisible(false); resetModal(); }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveModal}>
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
  scrollContent: { paddingBottom: 40 },
  banner: { height: 260, justifyContent: 'center' },
  bannerOverlay: { backgroundColor: 'rgba(51,61,41,0.75)', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  bannerTitle: { fontSize: 42, fontWeight: '800', color: '#fff' },
  bannerSubtitle: { fontSize: 18, color: '#fff', marginTop: 8 },

  mainArea: { flexDirection: 'row', padding: 20, gap: 20 },
  leftNav: { width: 340, backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#3A4D39', shadowOpacity: 0.1, elevation: 6 },
  createMainBtn: { backgroundColor: '#936639', padding: 14, borderRadius: 15, alignItems: 'center', marginBottom: 16 },
  createMainBtnText: { color: '#fff', fontWeight: '700' },

  mainTopic: { 
    backgroundColor: '#f8f7f2', 
    borderRadius: 12, 
    marginBottom: 8, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingRight: 12 
  },
  mainTopicContent: { 
    flex: 1, 
    padding: 16 
  },
  mainTopicText: { fontSize: 18, fontWeight: '700', color: '#3A4D39' },

  subList: { paddingLeft: 20 },
  createSubBtn: { backgroundColor: '#a4ac86', padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  createSubBtnText: { color: '#fff', fontWeight: '600' },

  subTopic: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    marginBottom: 6, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingRight: 12 
  },
  subTopicContent: { 
    flex: 1, 
    padding: 14 
  },
  subTopicText: { fontSize: 15.5, color: '#414833' },

  rightContent: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 30, minHeight: 500, shadowColor: '#3A4D39', shadowOpacity: 0.1, elevation: 6 },
  contentTitle: { fontSize: 26, fontWeight: '700', color: '#3A4D39', marginBottom: 20 },
  contentText: { fontSize: 16, lineHeight: 26, color: '#414833' },
  placeholderText: { fontSize: 18, color: '#999', textAlign: 'center', marginTop: 100 },

  actionButtons: { flexDirection: 'row', gap: 20 },
  icon: { fontSize: 26 },
  deleteIcon: { fontSize: 26, color: '#e63939' },

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
