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
  Dimensions,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const colors = {
  olive: '#936639',
  brown: '#7f4f24',
  sage: '#a4ac86',
  forest: '#414833',
  deepForest: '#333d29',
};

export default function AdminModuleScreen() {
  const [modules, setModules] = useState([
    {
      id: '1.1',
      title: '1.1 Conservation',
      subs: [
        { id: '1.1.1', title: '1.1.1 Introduction to Conservation', content: 'Conservation is the protection and preservation of natural resources, biodiversity, and ecosystems in Sarawak’s national parks. As a park guide, your role is to ensure that visitors understand the importance of conservation and do not harm the environment.\n\nKey objectives include maintaining ecological balance, protecting endangered species, and promoting sustainable tourism.' },
        { id: '1.1.2', title: '1.1.2 Protected Species in Sarawak', content: 'Sarawak is home to many protected species such as the Proboscis Monkey, Bornean Orangutan, and Rafflesia.' },
        { id: '1.1.3', title: '1.1.3 Sustainable Practices', content: 'Learn best practices for waste management, trail maintenance, and low-impact guiding techniques that help preserve the parks for future generations.' },
      ],
    },
    {
      id: '1.2',
      title: '1.2 Biodiversity',
      subs: [
        { id: '1.2.1', title: '1.2.1 Understanding Biodiversity', content: 'Biodiversity refers to the variety of life in Sarawak’s national parks.' },
        { id: '1.2.2', title: '1.2.2 Key Ecosystems in National Parks', content: 'Explore the different ecosystems including mangrove forests, dipterocarp forests, and peat swamps found in Bako, Similajau, and other parks.' },
      ],
    },
    {
      id: '1.3',
      title: '1.3 Eco-tourism',
      subs: [
        { id: '1.3.1', title: '1.3.1 Principles of Eco-tourism', content: 'Responsible travel that conserves the environment and improves the well-being of local people.' },
        { id: '1.3.2', title: '1.3.2 Visitor Engagement Techniques', content: 'Effective ways to interact with visitors while promoting conservation messages.' },
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
      const main = modules.find(m => m.id === mainId);
      const sub = main?.subs.find(s => s.id === subId);
      setTitleInput(sub?.title || '');
      setContentInput(sub?.content || '');
    } else {
      setTitleInput('New Sub-topic');
      setContentInput('Write content here...');
    }
    setModalVisible(true);
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

  const deleteMainTopic = (mainId) => {
    confirmAction('Delete Main Topic', 'This will delete the topic and all its sub-topics. This action cannot be undone.', () => {
      setModules(prev => prev.filter(m => m.id !== mainId));
      if (expandedMain === mainId) setExpandedMain(null);
      if (selectedContent?.id?.startsWith(mainId)) setSelectedContent(null);
    });
  };

  const deleteSubTopic = (mainId, subId) => {
    confirmAction('Delete Sub-topic', 'Are you sure you want to delete this sub-topic?', () => {
      setModules(prev => prev.map(m => {
        if (m.id === mainId) {
          return { ...m, subs: m.subs.filter(s => s.id !== subId) };
        }
        return m;
      }));
      if (selectedContent?.id === subId) setSelectedContent(null);
    });
  };

  const saveModal = () => {
    if (!titleInput.trim()) {
      Alert.alert('Error', 'Title cannot be empty');
      return;
    }

    if (modalMode === 'main') {
      if (currentMainId === null) {
        const newMain = { id: Date.now().toString(), title: titleInput.trim(), subs: [] };
        setModules(prev => [...prev, newMain]);
      } else {
        setModules(prev => prev.map(m =>
          m.id === currentMainId ? { ...m, title: titleInput.trim() } : m
        ));
      }
    } else {
      const newSub = {
        id: currentSubId || Date.now().toString(),
        title: titleInput.trim(),
        content: contentInput.trim() || 'No content provided yet.'
      };

      setModules(prev => prev.map(m => {
        if (m.id === currentMainId) {
          if (currentSubId === null) {
            return { ...m, subs: [...m.subs, newSub] };
          }
          return {
            ...m,
            subs: m.subs.map(s => s.id === currentSubId ? newSub : s)
          };
        }
        return m;
      }));
    }

    setModalVisible(false);
    setTitleInput('');
    setContentInput('');
    setCurrentMainId(null);
    setCurrentSubId(null);
    setModalMode('');
  };

  const toggleMain = (id) => {
    setExpandedMain(expandedMain === id ? null : id);
    if (expandedMain !== id) setSelectedContent(null);
  };

  const showSubContent = (sub) => {
    setSelectedContent(sub);
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <ImageBackground source={{ uri: 'https://picsum.photos/id/1015/1600/500' }} style={styles.banner} imageStyle={{ opacity: 0.85 }}>
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle}>General Module</Text>
            <Text style={styles.bannerSubtitle}>Conservation • Biodiversity • Eco-tourism • Legislation • Safety</Text>
          </View>
        </ImageBackground>

        <View style={[styles.mainArea, !isWeb && styles.mainAreaMobile]}>
          {/* Left Navigation */}
          <View style={[styles.leftNav, !isWeb && styles.leftNavMobile]}>
            <TouchableOpacity style={styles.createMainBtn} onPress={() => openMainModal(null)}>
              <Text style={styles.createMainBtnText}>+ New Main Topic</Text>
            </TouchableOpacity>

            {modules.map((mod) => {
              const isExpanded = expandedMain === mod.id;
              return (
                <View key={mod.id}>
                  <View style={styles.mainTopic}>
                    <TouchableOpacity style={styles.mainTopicContent} onPress={() => toggleMain(mod.id)}>
                      <Text style={styles.mainTopicText}>{mod.title}</Text>
                    </TouchableOpacity>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity onPress={() => openMainModal(mod.id)}>
                        <Text style={styles.icon}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteMainTopic(mod.id)}>
                        <Text style={styles.deleteIcon}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={styles.subList}>
                      <TouchableOpacity style={styles.createSubBtn} onPress={() => openSubModal(mod.id, null)}>
                        <Text style={styles.createSubBtnText}>+ New Sub-topic</Text>
                      </TouchableOpacity>

                      {mod.subs.map((sub) => {
                        const isSelected = selectedContent?.id === sub.id;
                        return (
                          <View key={sub.id}>
                            <View style={styles.subTopic}>
                              <TouchableOpacity style={styles.subTopicContent} onPress={() => showSubContent(sub)}>
                                <Text style={styles.subTopicText}>{sub.title}</Text>
                              </TouchableOpacity>
                              <View style={styles.actionButtons}>
                                <TouchableOpacity onPress={() => openSubModal(mod.id, sub.id)}>
                                  <Text style={styles.icon}>✏️</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => deleteSubTopic(mod.id, sub.id)}>
                                  <Text style={styles.deleteIcon}>🗑️</Text>
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Mobile Content - Shows below the sub-topic */}
                            {!isWeb && isSelected && (
                              <View style={styles.mobileContent}>
                                <Text style={styles.contentTitle}>{sub.title}</Text>
                                <Text style={styles.contentText}>{sub.content}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Web Only - Right Content Panel */}
          {isWeb && (
            <View style={styles.rightContent}>
              {selectedContent ? (
                <>
                  <Text style={styles.contentTitle}>{selectedContent.title}</Text>
                  <Text style={styles.contentText}>{selectedContent.content}</Text>
                </>
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderText}>
                    Select a sub-topic from the left to view / edit content
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

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
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveModal}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f7f2' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 30 },

  banner: { height: 220, justifyContent: 'center' },
  bannerOverlay: { backgroundColor: 'rgba(51, 61, 41, 0.78)', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  bannerTitle: { fontSize: 34, fontWeight: '800', color: 'white', textAlign: 'center' },
  bannerSubtitle: { fontSize: 15.5, color: 'white', marginTop: 8, textAlign: 'center'},

  mainArea: { flexDirection: 'row', padding: 12, gap: 12 },
  mainAreaMobile: { flexDirection: 'column' },

  leftNav: {
    flex: 1.05,
    minWidth: 168,
    maxWidth: 300,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    elevation: 6,
  },
  leftNavMobile: { width: '100%', maxWidth: '100%', marginBottom: 16 },

  createMainBtn: { backgroundColor: colors.olive, padding: 15, borderRadius: 14, alignItems: 'center', marginBottom: 14 },
  createMainBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  mainTopic: {
    backgroundColor: '#f8f7f2',
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  mainTopicContent: { flex: 1, padding: 14 },
  mainTopicText: { fontSize: 16.5, fontWeight: '700', color: colors.olive, flex: 1 },

  subList: { paddingLeft: 12, paddingBottom: 8 },
  createSubBtn: { backgroundColor: colors.sage, padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  createSubBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  subTopic: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 13,
  },
  subTopicContent: { flex: 1, padding: 13 },
  subTopicText: { fontSize: 15, color: colors.forest },

  actionButtons: { flexDirection: 'row', gap: 14 },
  icon: { fontSize: 22, color: colors.sage },
  deleteIcon: { fontSize: 22, color: '#e63939' },

  /* Mobile Content */
  mobileContent: {
    backgroundColor: 'white',
    marginHorizontal: 4,
    marginBottom: 16,
    padding: 18,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    elevation: 4,
  },

  /* Web Right Content */
  rightContent: {
    flex: 1.95,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    minHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    elevation: 6,
  },
  contentTitle: { fontSize: 23, fontWeight: '700', color: colors.olive, marginBottom: 18 },
  contentText: { fontSize: 15.5, lineHeight: 25, color: colors.forest },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 16.5, color: '#888', textAlign: 'center', paddingHorizontal: 20 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 500,
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
    marginBottom: 12,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 24 },
  cancelText: { color: '#666', fontWeight: '600', fontSize: 16 },
  saveButton: { backgroundColor: colors.olive, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
