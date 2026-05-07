import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import withRoleGuard from '../auth/withRoleGuard.js';
import {
  requestProfileApi,
  resolveApiAssetUri,
  uploadModuleCoverImage,
} from '../Profile/profileApi.js';

const Editor =
  Platform.OS === 'web'
    ? require('./RichEditor.web').default
    : require('./RichEditor').default;

const PLACEHOLDER_COLOR = '#A8ADA3';
const MODULE_TYPE_OPTIONS = [
  { id: 1, value: 'general', label: 'General' },
  { id: 2, value: 'park-specific', label: 'Total Protected Area (TPA) Modules' },
  { id: 3, value: 'on-site', label: 'On Site Training Modules' },
];

function normalizeModuleType(value) {
  if (value === 1 || value === '1') {
    return 'general';
  }

  if (value === 2 || value === '2') {
    return 'park-specific';
  }

  if (value === 3 || value === '3') {
    return 'on-site';
  }

  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'general') {
    return 'general';
  }

  if (
    normalized === 'park-specific' ||
    normalized === 'park_specific' ||
    normalized === 'tpa' ||
    normalized === 'total protected area'
  ) {
    return 'park-specific';
  }

  if (
    normalized === 'on-site' ||
    normalized === 'onsite' ||
    normalized === 'on_site' ||
    normalized === 'on site training'
  ) {
    return 'on-site';
  }

  return 'general';
}

function createId() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function AddModuleScreen({ navigation }) {
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleType, setModuleType] = useState('general');
  const [moduleTypeId, setModuleTypeId] = useState(1);
  const [linkedTpaModuleId, setLinkedTpaModuleId] = useState(null);
  const [moduleImageUrl, setModuleImageUrl] = useState('');
  const [moduleLocalImageUri, setModuleLocalImageUri] = useState('');
  const [moduleLocalImageAsset, setModuleLocalImageAsset] = useState(null);
  const [savedCount, setSavedCount] = useState(0);
  const [moduleLibrary, setModuleLibrary] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [sections, setSections] = useState([
    {
      id: createId(),
      title: '',
      ordering: null,
      subsections: [
        { id: createId(), title: '', content: '', ordering: null },
      ],
    },
  ]);

  const modulePreviewImage =
    moduleLocalImageUri ||
    resolveApiAssetUri(moduleImageUrl.trim()) ||
    moduleImageUrl.trim();
  const parkSpecificModules = moduleLibrary.filter((module) => {
    const typeCandidate = module._typeCandidate ?? (module.moduleType || module.module_type || module.type || module.category || module.moduleTypeId || module.module_type_id || module.typeId);

    // Accept explicit numeric type id for TPA (2)
    if (Number(typeCandidate) === 2) return true;

    // Use existing normalizer for textual matches
    if (normalizeModuleType(typeCandidate) === 'park-specific') return true;

    // Fallback: treat modules whose title suggests TPA as park-specific
    const title = String(module.title || module.name || '').toLowerCase();
    if (title.includes('tpa') || title.includes('total protected area') || title.includes('park-specific')) return true;

    return false;
  });

  useEffect(() => {
    if (typeof console !== 'undefined' && console.debug) {
      try {
        console.debug('AddModuleScreen: parkSpecificModules computed:', parkSpecificModules.map((m) => ({ moduleId: m.moduleId, title: m.title, type: m._typeCandidate })), 'selected linkedTpaModuleId:', linkedTpaModuleId);
      } catch (_e) {}
    }
  }, [moduleLibrary, linkedTpaModuleId]);

  const navigateToHome = () => {
    navigation.navigate('Home');
  };

  const navigateToPreviousScreen = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigateToHome();
  };

  const showNotice = (title, message) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const showSaveSuccessPrompt = (message) => {
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function'
    ) {
      const goHome = window.confirm(
        `${message}\n\nPress OK to go to Homepage.\nPress Cancel to go back to previous page.`
      );

      if (goHome) {
        navigateToHome();
      } else {
        navigateToPreviousScreen();
      }

      return;
    }

    Alert.alert('Save successful', message, [
      { text: 'Previous Page', onPress: navigateToPreviousScreen },
      { text: 'Homepage', onPress: navigateToHome },
    ]);
  };

  useEffect(() => {
    let active = true;

    const loadSavedModuleCount = async () => {
      try {
        const token = await AsyncStorage.getItem('innopapp_auth_token');

        if (!token) {
          return;
        }

        const response = await requestProfileApi('/api/v1/admin/modules', token, {
          method: 'GET',
        });

        if (!active) {
          return;
        }

        const loadedModules = Array.isArray(response.data) ? response.data : [];

        // Normalize module entries so downstream filters reliably detect TPA modules
        const normalized = loadedModules.map((m) => {
          const moduleId = m.moduleId || m.id || m.ModuleId || null;
          const title = m.title || m.name || m.moduleTitle || '';
          const typeCandidate =
            m.moduleType || m.module_type || m.type || m.category || m.moduleTypeId || m.module_type_id || m.typeId || m.ModuleTypeID;

          return {
            ...m,
            moduleId,
            title,
            _typeCandidate: typeCandidate,
          };
        });

        if (typeof console !== 'undefined' && console.debug) {
          console.debug('AddModuleScreen: loaded modules (normalized):', normalized.map((m) => ({ moduleId: m.moduleId, title: m.title, type: m._typeCandidate })));
        }

        setModuleLibrary(normalized);
        setSavedCount(normalized.length);
      } catch (_error) {
        if (active) {
          setSavedCount(0);
          setModuleLibrary([]);
        }
      }
    };

    loadSavedModuleCount();

    const unsubscribe = navigation.addListener('focus', () => {
      loadSavedModuleCount();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigation]);

  const addSection = () => {
    setSections((previous) => [
      ...previous,
      { id: createId(), title: '', ordering: null, subsections: [{ id: createId(), title: '', content: '', ordering: null }] },
    ]);
  };

  const deleteSection = (sectionId) => {
    setSections((previous) => previous.filter((section) => section.id !== sectionId));
  };

  const updateSectionTitle = (sectionId, value) => {
    setSections((previous) =>
      previous.map((section) =>
        section.id === sectionId ? { ...section, title: value } : section
      )
    );
  };
  const addSubsection = (sectionId) => {
    setSections((previous) =>
      previous.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: [
                ...section.subsections,
                { id: createId(), title: '', content: '', ordering: null },
              ],
            }
          : section
      )
    );
  };

  const deleteSubsection = (sectionId, subId) => {
    setSections((previous) =>
      previous.map((section) =>
        section.id === sectionId
          ? { ...section, subsections: section.subsections.filter((s) => s.id !== subId) }
          : section
      )
    );
  };

  const updateSubsectionTitle = (sectionId, subId, value) => {
    setSections((previous) =>
      previous.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: section.subsections.map((s) => (s.id === subId ? { ...s, title: value } : s)),
            }
          : section
      )
    );
  };

  const updateSubsectionContent = (sectionId, subId, value) => {
    if (Platform.OS === 'web' && typeof console !== 'undefined') {
      try {
        console.debug('AddModuleScreen.updateSubsectionContent', { sectionId, subId, length: String(value || '').length });
      } catch (_e) {}
    }

    setSections((previous) =>
      previous.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: section.subsections.map((s) => (s.id === subId ? { ...s, content: value } : s)),
            }
          : section
      )
    );
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
      const selectedAsset = result.assets[0];
      setModuleLocalImageUri(selectedAsset.uri);
      setModuleLocalImageAsset(selectedAsset);
    }
  };

  const clearLocalImage = () => {
    setModuleLocalImageUri('');
    setModuleLocalImageAsset(null);
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    if (!moduleTitle.trim()) {
      showNotice('Missing details', 'Please provide a module title before saving.');
      return;
    }

    if (normalizeModuleType(moduleType) === 'on-site' && !linkedTpaModuleId) {
      showNotice('Missing details', 'Please choose a linked TPA module for this On Site Training Module.');
      return;
    }

    const token = await AsyncStorage.getItem('innopapp_auth_token');

    if (!token) {
      showNotice('Session expired', 'Please log in again to continue.');
      return;
    }

    const normalizedSections = sections
      .map((section, index) => {
        const normalizedTitle = String(section.title || '').trim();

        const normalizedSubsections = Array.isArray(section.subsections)
          ? section.subsections
              .map((sub, si) => {
                const stitle = String(sub.title || '').trim();
                const scontent = String(sub.content || '').trim();

                if (!stitle && !scontent) return null;

                return {
                  title: stitle || `Part ${si + 1}`,
                  content: scontent || '<p>No content provided.</p>',
                  ordering: typeof sub.ordering === 'number' ? sub.ordering : null,
                };
              })
              .filter(Boolean)
          : [];

        if (!normalizedTitle && normalizedSubsections.length === 0) return null;

        return {
          title: normalizedTitle || `Section ${index + 1}`,
          ordering: typeof section.ordering === 'number' ? section.ordering : null,
          subsections: normalizedSubsections.length ? normalizedSubsections : [{ title: normalizedTitle || `Section ${index + 1}`, content: '<p>No content provided.</p>', ordering: null }],
        };
      })
      .filter(Boolean);

    if (normalizedSections.length === 0) {
      showNotice('Missing details', 'Please add at least one section with content.');
      return;
    }

    try {
      setIsSaving(true);

      let normalizedModuleImageUrl = moduleImageUrl.trim();

      if (moduleLocalImageAsset) {
        normalizedModuleImageUrl = await uploadModuleCoverImage(token, moduleLocalImageAsset);
      }

      // Debug: log normalized sections before sending to API
      if (Platform.OS === 'web' && typeof console !== 'undefined') {
        console.debug('AddModuleScreen: normalizedSections', normalizedSections);
      }

      const normalizedType = normalizeModuleType(moduleType);
      const normalizedTypeId = MODULE_TYPE_OPTIONS.find((option) => option.value === normalizedType)?.id || 1;

      await requestProfileApi('/api/v1/admin/modules', token, {
        method: 'POST',
        body: {
          title: moduleTitle.trim(),
          moduleType: normalizedType,
          moduleTypeId: normalizedTypeId,
          type: normalizedType,
          typeId: normalizedTypeId,
          module_type: normalizedType,
          module_type_id: normalizedTypeId,
          linkedTpaModuleId: normalizedType === 'on-site' ? Number(linkedTpaModuleId) : null,
          linked_tpa_module_id: normalizedType === 'on-site' ? Number(linkedTpaModuleId) : null,
          prerequisiteModuleId: normalizedType === 'on-site' ? Number(linkedTpaModuleId) : null,
          parentModuleId: normalizedType === 'on-site' ? Number(linkedTpaModuleId) : null,
          moduleImageUrl: normalizedModuleImageUrl,
          sections: normalizedSections,
        },
      });

      const moduleListResponse = await requestProfileApi('/api/v1/admin/modules', token, {
        method: 'GET',
      });

      const refreshed = Array.isArray(moduleListResponse.data) ? moduleListResponse.data : [];
      const normalizedRefreshed = refreshed.map((m) => {
        let moduleId = m.moduleId || m.id || m.ModuleId || null;
        if (typeof moduleId === 'string') {
          const match = moduleId.match(/(\d+)/);
          if (match) moduleId = Number.parseInt(match[1], 10);
        }
        const title = m.title || m.name || m.moduleTitle || '';
        const typeCandidate =
          m.moduleType || m.module_type || m.type || m.category || m.moduleTypeId || m.module_type_id || m.typeId || m.ModuleTypeID;

        return {
          ...m,
          moduleId,
          title,
          _typeCandidate: typeCandidate,
        };
      });

      if (typeof console !== 'undefined' && console.debug) {
        console.debug('AddModuleScreen: refreshed modules (normalized):', normalizedRefreshed.map((m) => ({ moduleId: m.moduleId, title: m.title, type: m._typeCandidate })));
      }

      setSavedCount(normalizedRefreshed.length);
      setModuleLibrary(normalizedRefreshed);
      setModuleImageUrl(normalizedModuleImageUrl);
      setModuleLocalImageUri('');
      setModuleLocalImageAsset(null);

      showSaveSuccessPrompt(
        'Module created successfully. You can edit it later from Manage Modules.'
      );
    } catch (error) {
      showNotice('Save failed', error?.message || 'Unable to save module right now.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>Create Module</Text>

        <View style={styles.headerActionsRow}>
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => navigation.navigate('AdminModules')}
          >
            <Text style={styles.manageBtnText}>Manage Modules ({savedCount})</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          placeholder="Module Title"
          placeholderTextColor={PLACEHOLDER_COLOR}
          value={moduleTitle}
          onChangeText={setModuleTitle}
          style={styles.moduleInput}
        />

        <View style={styles.typeSection}>
          <Text style={styles.typeLabel}>Module Type</Text>
          <View style={styles.typeOptionsRow}>
            {MODULE_TYPE_OPTIONS.map((option) => {
              const isActive = moduleType === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.typeOptionButton, isActive && styles.typeOptionButtonActive]}
                  onPress={() => {
                    setModuleType(option.value);
                    setModuleTypeId(option.id);
                    if (option.value !== 'on-site') {
                      setLinkedTpaModuleId(null);
                    }
                  }}
                >
                  <Text style={[styles.typeOptionText, isActive && styles.typeOptionTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {moduleType === 'on-site' ? (
          <View style={styles.typeSection}>
            <Text style={styles.typeLabel}>Linked TPA Module</Text>
            {parkSpecificModules.length === 0 ? (
              <View style={styles.typeHelperBox}>
                <Text style={styles.typeHelperText}>
                  No TPA modules available. Create a TPA module first before saving an On Site Training Module.
                </Text>
              </View>
            ) : (
              <View style={styles.typeOptionsRow}>
                {parkSpecificModules.map((module) => {
                  const moduleId = Number(module.moduleId || module.id || 0);
                  const isActive = Number(linkedTpaModuleId) === moduleId;

                  return (
                    <TouchableOpacity
                      key={`tpa-${moduleId}`}
                      style={[styles.typeOptionButton, isActive && styles.typeOptionButtonActive]}
                      onPress={() => setLinkedTpaModuleId(moduleId)}
                    >
                      <Text style={[styles.typeOptionText, isActive && styles.typeOptionTextActive]}>
                        {module.title || module.moduleTitle || `TPA Module ${moduleId}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.imageSection}>
          <Text style={styles.imageLabel}>Module Cover Image</Text>

          <View style={styles.imageInputRow}>
            <TextInput
              placeholder="Image URL (optional)"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={moduleImageUrl}
              onChangeText={(value) => {
                setModuleImageUrl(value);
                if (value.trim()) {
                  setModuleLocalImageUri('');
                  setModuleLocalImageAsset(null);
                }
              }}
              style={styles.imageUrlInput}
            />

            <TouchableOpacity style={styles.secondaryBtn} onPress={pickLocalModuleImage}>
              <Text style={styles.secondaryBtnText}>Upload Local Image</Text>
            </TouchableOpacity>
          </View>

          {moduleLocalImageUri ? (
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

        {sections.map((section) => (
          <View key={section.id} style={styles.sectionBox}>
            <View style={styles.sectionHeader}>
              <TextInput
                placeholder="Section Title"
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

            <View style={styles.subsectionsHeaderRow}>
              <Text style={styles.subsectionsLabel}>Subsections</Text>
              <TouchableOpacity style={styles.addSubBtn} onPress={() => addSubsection(section.id)}>
                <Text style={styles.addSubText}>+ Add Subsection</Text>
              </TouchableOpacity>
            </View>

            {section.subsections.map((sub) => (
              <View key={sub.id} style={styles.subsectionBox}>
                <View style={styles.subsectionHeader}>
                  <TextInput
                    placeholder="Subsection Title"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={sub.title}
                    onChangeText={(value) => updateSubsectionTitle(section.id, sub.id, value)}
                    style={styles.subsectionTitleInput}
                  />
                  <TouchableOpacity
                    style={styles.subsectionDeleteBtn}
                    onPress={() => deleteSubsection(section.id, sub.id)}
                  >
                    <Text style={styles.deleteX}>X</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.editorBox}>
                  <Editor
                    value={sub.content}
                    onChange={(html) => updateSubsectionContent(section.id, sub.id, html)}
                  />
                </View>
              </View>
            ))}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveText}>{isSaving ? 'Saving Module...' : 'Save Module'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FBFCF8',
  },
  container: {
    padding: 20,
    backgroundColor: '#FBFCF8',
  },
  header: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
    color: '#3A4D39',
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  manageBtn: {
    backgroundColor: '#ECF2E5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  manageBtnText: {
    color: '#2E6B4D',
    fontWeight: '700',
    fontSize: 13,
  },
  moduleInput: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E6EAE0',
  },
  typeSection: {
    marginBottom: 14,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5D23',
    marginBottom: 8,
  },
  typeOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOptionButton: {
    backgroundColor: '#F3F6EE',
    borderWidth: 1,
    borderColor: '#DDE6D4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeOptionButtonActive: {
    backgroundColor: '#DCE8D2',
    borderColor: '#8BAA77',
  },
  typeOptionText: {
    color: '#35513F',
    fontSize: 12,
    fontWeight: '600',
  },
  typeOptionTextActive: {
    color: '#1F3A2A',
    fontWeight: '700',
  },
  typeHelperBox: {
    backgroundColor: '#F8F0EA',
    borderWidth: 1,
    borderColor: '#F0D6C3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeHelperText: {
    color: '#7A5A45',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
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
  subsectionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subsectionsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5D23',
  },
  addSubBtn: {
    backgroundColor: '#E6EFE0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  addSubText: {
    color: '#2E6B4D',
    fontWeight: '600',
  },
  subsectionBox: {
    backgroundColor: '#FBFFFA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF3EA',
  },
  subsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subsectionTitleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9DED2',
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  subsectionDeleteBtn: {
    width: 22,
    height: 22,
    marginLeft: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteX: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D62828',
    lineHeight: 14,
  },
  editorBox: {
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'visible',
  },
  saveBtn: {
    backgroundColor: '#3A4D39',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
  },
});

export default withRoleGuard(AddModuleScreen, {
  allowedRoles: ['Admin'],
  screenName: 'Add Module',
});
