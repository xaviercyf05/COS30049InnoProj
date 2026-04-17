import React, { useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import withRoleGuard from '../auth/withRoleGuard.js';
import {
  deleteModule,
  getModuleById,
  getModuleLibrary,
  upsertModule,
} from './moduleLibraryStore.js';

const Editor =
  Platform.OS === 'web'
    ? require('./RichEditor.web').default
    : require('./RichEditor').default;

const PLACEHOLDER_COLOR = '#A8ADA3';

function createId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function makeDefaultSection() {
  return {
    id: createId('section'),
    title: '',
    subsections: [],
  };
}

function createEmptyDraft() {
  return {
    id: null,
    title: '',
    moduleImageUrl: '',
    moduleLocalImageUri: '',
    sections: [makeDefaultSection()],
  };
}

function toDraft(moduleEntry) {
  if (!moduleEntry) {
    return createEmptyDraft();
  }

  return {
    id: moduleEntry.id,
    title: moduleEntry.title || '',
    moduleImageUrl: moduleEntry.moduleImageUrl || '',
    moduleLocalImageUri: moduleEntry.moduleLocalImageUri || '',
    sections: moduleEntry.sections?.length ? moduleEntry.sections : [makeDefaultSection()],
  };
}

function AdminModuleManagerScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [modules, setModules] = useState(() => getModuleLibrary());
  const [draft, setDraft] = useState(() => {
    const initialModule = getModuleLibrary()[0];
    return toDraft(initialModule);
  });

  const modulePreviewImage = draft.moduleLocalImageUri || draft.moduleImageUrl.trim();

  const refreshModules = (focusedModuleId = null) => {
    const updatedLibrary = getModuleLibrary();
    setModules(updatedLibrary);

    if (!updatedLibrary.length) {
      setDraft(createEmptyDraft());
      return;
    }

    const fallbackId = focusedModuleId || draft.id || updatedLibrary[0].id;
    const nextModule = getModuleById(fallbackId) || updatedLibrary[0];
    setDraft(toDraft(nextModule));
  };

  const openModuleForEdit = (moduleId) => {
    const moduleEntry = getModuleById(moduleId);
    if (!moduleEntry) {
      return;
    }

    setDraft(toDraft(moduleEntry));
  };

  const startNewDraft = () => {
    setDraft(createEmptyDraft());
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

  const removeModule = (moduleId) => {
    confirmAction(
      'Delete Module',
      'This module and its sections will be removed from the frontend draft library.',
      () => {
        deleteModule(moduleId);
        refreshModules();
      }
    );
  };

  const addSection = () => {
    setDraft((previous) => ({
      ...previous,
      sections: [...previous.sections, makeDefaultSection()],
    }));
  };

  const updateSectionTitle = (sectionId, titleValue) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              title: titleValue,
            }
          : section
      ),
    }));
  };

  const deleteSection = (sectionId) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.filter((section) => section.id !== sectionId),
    }));
  };

  const addSubSection = (sectionId) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: [
                ...(section.subsections || []),
                {
                  id: createId('sub'),
                  title: '',
                  content: '',
                },
              ],
            }
          : section
      ),
    }));
  };

  const updateSubSection = (sectionId, subSectionId, field, value) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: (section.subsections || []).map((subSection) =>
                subSection.id === subSectionId
                  ? {
                      ...subSection,
                      [field]: value,
                    }
                  : subSection
              ),
            }
          : section
      ),
    }));
  };

  const deleteSubSection = (sectionId, subSectionId) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: (section.subsections || []).filter(
                (subSection) => subSection.id !== subSectionId
              ),
            }
          : section
      ),
    }));
  };

  const pickLocalModuleImage = async () => {
    if (Platform.OS !== 'web') {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission needed',
          'Please allow photo library access to pick an image.'
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled && result.assets?.length) {
      setDraft((previous) => ({
        ...previous,
        moduleLocalImageUri: result.assets[0].uri,
      }));
    }
  };

  const clearLocalImage = () => {
    setDraft((previous) => ({
      ...previous,
      moduleLocalImageUri: '',
    }));
  };

  const saveDraft = () => {
    if (!draft.title.trim()) {
      Alert.alert('Missing details', 'Please provide a module title before saving.');
      return;
    }

    const modulePayload = {
      id: draft.id || createId('module'),
      title: draft.title.trim(),
      moduleImageUrl: draft.moduleImageUrl.trim(),
      moduleLocalImageUri: draft.moduleLocalImageUri,
      sections: draft.sections,
    };

    upsertModule(modulePayload);
    refreshModules(modulePayload.id);
    Alert.alert('Saved', 'Module changes have been stored in the frontend library.');
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
        <TouchableOpacity
          style={styles.navPill}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }

            navigation.navigate('Home');
          }}
        >
          <Text style={styles.navPillText}>{'< Back'}</Text>
        </TouchableOpacity>

        <Text style={styles.topTitle}>Manage Modules</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.libraryHeaderRow}>
          <Text style={styles.libraryTitle}>Saved Modules ({modules.length})</Text>
          <TouchableOpacity style={styles.newDraftButton} onPress={startNewDraft}>
            <Text style={styles.newDraftButtonText}>+ New Module Draft</Text>
          </TouchableOpacity>
        </View>

        {modules.length ? (
          <View style={styles.libraryList}>
            {modules.map((moduleItem) => {
              const isActive = draft.id === moduleItem.id;

              return (
                <View key={moduleItem.id} style={[styles.libraryCard, isActive && styles.libraryCardActive]}>
                  <View style={styles.libraryMeta}>
                    <Text style={styles.libraryName}>{moduleItem.title}</Text>
                    <Text style={styles.librarySubtext}>
                      {(moduleItem.sections || []).length} section(s)
                    </Text>
                  </View>

                  <View style={styles.libraryActions}>
                    <TouchableOpacity
                      style={styles.libraryActionButton}
                      onPress={() => openModuleForEdit(moduleItem.id)}
                    >
                      <Text style={styles.libraryActionButtonText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.libraryDeleteButton}
                      onPress={() => removeModule(moduleItem.id)}
                    >
                      <Text style={styles.libraryDeleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyLibraryCard}>
            <Text style={styles.emptyLibraryText}>
              No module drafts yet. Create one from Add Module and manage it here.
            </Text>
          </View>
        )}

        <View style={styles.editorShell}>
          <Text style={styles.header}>{draft.id ? 'Edit Module' : 'Create Module Draft'}</Text>

          <TextInput
            placeholder="Module Title"
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={draft.title}
            onChangeText={(value) => {
              setDraft((previous) => ({
                ...previous,
                title: value,
              }));
            }}
            style={styles.moduleInput}
          />

          <View style={styles.imageSection}>
            <Text style={styles.imageLabel}>Module Cover Image</Text>

            <View style={styles.imageInputRow}>
              <TextInput
                placeholder="Image URL (optional)"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={draft.moduleImageUrl}
                onChangeText={(value) => {
                  setDraft((previous) => ({
                    ...previous,
                    moduleImageUrl: value,
                  }));
                }}
                style={styles.imageUrlInput}
              />

              <TouchableOpacity style={styles.secondaryBtn} onPress={pickLocalModuleImage}>
                <Text style={styles.secondaryBtnText}>Upload Local Image</Text>
              </TouchableOpacity>
            </View>

            {draft.moduleLocalImageUri ? (
              <TouchableOpacity style={styles.clearBtn} onPress={clearLocalImage}>
                <Text style={styles.clearBtnText}>Use URL Instead</Text>
              </TouchableOpacity>
            ) : null}

            {modulePreviewImage ? (
              <Image source={{ uri: modulePreviewImage }} style={styles.moduleImagePreview} />
            ) : null}
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={addSection}>
            <Text style={styles.addText}>+ Add Section</Text>
          </TouchableOpacity>

          {draft.sections.map((section) => (
            <View key={section.id} style={styles.sectionBox}>
              <View style={styles.sectionHeader}>
                <TextInput
                  placeholder="Section Title (e.g. 1.1)"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={section.title}
                  onChangeText={(value) => updateSectionTitle(section.id, value)}
                  style={styles.sectionTitleInput}
                />

                <TouchableOpacity
                  style={styles.sectionDeleteBtn}
                  onPress={() => deleteSection(section.id)}
                >
                  <Text style={styles.deleteX}>X</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => addSubSection(section.id)} style={styles.addSubBtn}>
                <Text style={styles.addSubText}>+ Add Subsection</Text>
              </TouchableOpacity>

              {(section.subsections || []).map((subSection) => (
                <View key={subSection.id} style={styles.subBox}>
                  <View style={styles.subHeader}>
                    <TextInput
                      placeholder="Subsection Title (e.g. 1.1.1)"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={subSection.title}
                      onChangeText={(value) =>
                        updateSubSection(section.id, subSection.id, 'title', value)
                      }
                      style={styles.subTitleInput}
                    />

                    <TouchableOpacity
                      style={styles.subDeleteBtn}
                      onPress={() => deleteSubSection(section.id, subSection.id)}
                    >
                      <Image
                        source={{
                          uri: 'https://images.vexels.com/media/users/3/223479/isolated/preview/8ecc75c9d0cf6d942cce96e196d4953f-trash-bin-icon-flat.png',
                        }}
                        style={styles.deleteIcon}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.editorBox}>
                    <Editor
                      value={subSection.content}
                      onChange={(html) =>
                        updateSubSection(section.id, subSection.id, 'content', html)
                      }
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}

          <TouchableOpacity style={styles.saveBtn} onPress={saveDraft}>
            <Text style={styles.saveText}>{draft.id ? 'Save Module Changes' : 'Save Module'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingBottom: 26,
  },
  libraryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  libraryTitle: {
    color: '#2B4334',
    fontSize: 18,
    fontWeight: '800',
  },
  newDraftButton: {
    backgroundColor: '#EAF2E3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  newDraftButtonText: {
    color: '#2E6B4D',
    fontWeight: '700',
    fontSize: 13,
  },
  libraryList: {
    marginBottom: 16,
  },
  libraryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEE3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  libraryCardActive: {
    borderColor: '#86A071',
    backgroundColor: '#F7FBF2',
  },
  libraryMeta: {
    flex: 1,
  },
  libraryName: {
    color: '#284335',
    fontSize: 15,
    fontWeight: '700',
  },
  librarySubtext: {
    color: '#6A7A67',
    fontSize: 12,
    marginTop: 4,
  },
  libraryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  libraryActionButton: {
    backgroundColor: '#ECF2E5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  libraryActionButtonText: {
    color: '#2E6B4D',
    fontWeight: '700',
    fontSize: 12,
  },
  libraryDeleteButton: {
    backgroundColor: '#FCEAEA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  libraryDeleteButtonText: {
    color: '#C73737',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyLibraryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEE3',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  emptyLibraryText: {
    color: '#5D715D',
    fontSize: 13,
    lineHeight: 20,
  },
  editorShell: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEE3',
    borderRadius: 14,
    padding: 14,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 14,
    color: '#3A4D39',
  },
  moduleInput: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E6EAE0',
  },
  imageSection: {
    marginBottom: 14,
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5D23',
    marginBottom: 8,
  },
  imageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  imageUrlInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6EAE0',
  },
  secondaryBtn: {
    backgroundColor: '#E9EDD9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: '#3A4D39',
    fontWeight: '600',
  },
  clearBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  clearBtnText: {
    color: '#7F8C69',
    fontWeight: '600',
  },
  moduleImagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#EEF2E8',
    marginBottom: 6,
  },
  addBtn: {
    backgroundColor: '#656D4A',
    padding: 14,
    borderRadius: 12,
    marginBottom: 15,
  },
  addText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
  },
  sectionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#EFF2EA',
  },
  sectionDeleteBtn: {
    width: 22,
    height: 22,
    marginLeft: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9DED2',
    padding: 10,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  deleteX: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D62828',
    lineHeight: 14,
  },
  addSubBtn: {
    marginBottom: 10,
  },
  addSubText: {
    color: '#4A5D23',
  },
  subBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 12,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  subTitleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  subDeleteBtn: {
    marginLeft: 10,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  deleteIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  editorBox: {
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
  },
  saveBtn: {
    backgroundColor: '#3A4D39',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  saveText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
  },
});

export default withRoleGuard(AdminModuleManagerScreen, {
  allowedRoles: ['Admin'],
  screenName: 'Manage Modules',
});
