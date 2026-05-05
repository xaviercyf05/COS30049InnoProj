import React, { useEffect, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  { value: 'general', label: 'General' },
  { value: 'park-specific', label: 'Total Protected Area (TPA) Modules' },
  { value: 'on-site', label: 'On Site Training Modules' },
];

function normalizeModuleType(value) {
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

function createId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function extractNumericModuleId(moduleIdentifier) {
  if (moduleIdentifier === null || moduleIdentifier === undefined) {
    return null;
  }

  if (typeof moduleIdentifier === 'number') {
    return Number.isFinite(moduleIdentifier) ? moduleIdentifier : null;
  }

  const match = String(moduleIdentifier).match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function makeDefaultSection() {
  return {
    id: createId('section'),
    title: '',
    ordering: null,
    subsections: [
      {
        id: createId('subsection'),
        title: '',
        content: '',
        ordering: null,
      },
    ],
  };
}

function normalizeSection(section) {
  if (!section) {
    return makeDefaultSection();
  }

  const normalizedSubsections = Array.isArray(section.subsections)
    ? section.subsections
        .map((subSection) => {
          const subTitle = String(subSection?.title || '').trim();
          const subContent = String(subSection?.content || '').trim();

          if (!subTitle && !subContent) {
            return null;
          }

          return {
            id: subSection?.id || createId('subsection'),
            title: subTitle,
            content: subContent,
            ordering: typeof subSection?.ordering === 'number' ? subSection.ordering : null,
          };
        })
        .filter(Boolean)
    : [];

  const composedFromSubsections = normalizedSubsections
    .map((subSection) => {
      if (subSection.title && subSection.content) {
        return `<h4>${subSection.title}</h4>${subSection.content}`;
      }

      return subSection.title || subSection.content || '';
    })
    .filter(Boolean)
    .join('<hr />');

  return {
    id: section.id || createId('section'),
    title: section.title || '',
    ordering: typeof section.ordering === 'number' ? section.ordering : null,
    subsections: normalizedSubsections.length
      ? normalizedSubsections
      : [
          {
            id: createId('subsection'),
            title: section.title || '',
            content: section.content || composedFromSubsections,
            ordering: null,
          },
        ],
  };
}

function createEmptyDraft() {
  return {
    id: null,
    title: '',
    moduleType: 'general',
    moduleImageUrl: '',
    moduleLocalImageUri: '',
    moduleLocalImageAsset: null,
    sections: [makeDefaultSection()],
  };
}

function toDraft(moduleEntry) {
  if (!moduleEntry) {
    return createEmptyDraft();
  }

  return {
    id: moduleEntry.id || (moduleEntry.moduleId ? `module-${moduleEntry.moduleId}` : null),
    title: moduleEntry.title || '',
    moduleType: normalizeModuleType(moduleEntry.moduleType || moduleEntry.type || moduleEntry.module_type || moduleEntry.category),
    moduleImageUrl: moduleEntry.moduleImageUrl || moduleEntry.image || '',
    moduleLocalImageUri: '',
    moduleLocalImageAsset: null,
    sections: moduleEntry.sections?.length
      ? moduleEntry.sections.map((section) => normalizeSection(section))
      : [makeDefaultSection()],
  };
}

function AdminModuleManagerScreen({ navigation, route, useSharedChrome = false }) {
  const insets = useSafeAreaInsets();
  const routeFocusedModuleId = extractNumericModuleId(route?.params?.moduleId);

  const [modules, setModules] = useState([]);
  const [draft, setDraft] = useState(createEmptyDraft());
  const [isSaving, setIsSaving] = useState(false);

  const modulePreviewImage =
    draft.moduleLocalImageUri ||
    resolveApiAssetUri(draft.moduleImageUrl.trim()) ||
    draft.moduleImageUrl.trim();

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

  const showSaveSuccessPrompt = (isEditFlow) => {
    const successMessage = isEditFlow
      ? 'Module changes saved successfully.'
      : 'Module created successfully.';

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function'
    ) {
      const goHome = window.confirm(
        `${successMessage}\n\nPress OK to go to Homepage.\nPress Cancel to go back to previous page.`
      );

      if (goHome) {
        navigateToHome();
      } else {
        navigateToPreviousScreen();
      }

      return;
    }

    Alert.alert('Save successful', successMessage, [
      { text: 'Previous Page', onPress: navigateToPreviousScreen },
      { text: 'Homepage', onPress: navigateToHome },
    ]);
  };

  const getAuthToken = async () => {
    const token = await AsyncStorage.getItem('innopapp_auth_token');

    if (!token) {
      throw new Error('Session expired. Please log in again.');
    }

    return token;
  };

  const loadModuleForEdit = async (moduleId, token) => {
    try {
      const response = await requestProfileApi(`/api/v1/admin/modules/${moduleId}`, token, {
        method: 'GET',
      });

      if (response?.data) {
        setDraft(toDraft(response.data));
        return;
      }

      setDraft(createEmptyDraft());
    } catch (error) {
      // If module not found or other error, just use empty draft
      console.warn('Failed to load module for edit:', error?.message);
      setDraft(createEmptyDraft());
    }
  };

  const refreshModules = async (focusedModuleId = null) => {
    try {
      const token = await getAuthToken();
      const listResponse = await requestProfileApi('/api/v1/admin/modules', token, {
        method: 'GET',
      });

      const updatedLibrary = Array.isArray(listResponse.data) ? listResponse.data : [];
      setModules(updatedLibrary);

      if (!updatedLibrary.length) {
        setDraft(createEmptyDraft());
        return;
      }

      const hasFocusedModuleInLibrary =
        focusedModuleId !== null &&
        focusedModuleId !== undefined &&
        updatedLibrary.some((moduleItem) => Number(moduleItem.moduleId) === Number(focusedModuleId));

      const fallbackId =
        (hasFocusedModuleInLibrary ? focusedModuleId : null) ||
        extractNumericModuleId(draft.id) ||
        updatedLibrary[0].moduleId;

      await loadModuleForEdit(fallbackId, token);
    } catch (error) {
      Alert.alert('Unable to load modules', error?.message || 'Please try again shortly.');
      setModules([]);
      setDraft(createEmptyDraft());
    }
  };

  useEffect(() => {
    refreshModules(routeFocusedModuleId);

    const unsubscribe = navigation.addListener('focus', () => {
      refreshModules(routeFocusedModuleId);
    });

    return unsubscribe;
  }, [navigation, routeFocusedModuleId]);

  const openModuleForEdit = async (moduleId) => {
    try {
      const token = await getAuthToken();
      await loadModuleForEdit(moduleId, token);
    } catch (error) {
      Alert.alert('Unable to open module', error?.message || 'Please try again.');
    }
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
      'This module and its sections will be removed from backend storage.',
      async () => {
        try {
          const token = await getAuthToken();
          await requestProfileApi(`/api/v1/admin/modules/${moduleId}`, token, {
            method: 'DELETE',
          });
          
          // Find a module to focus on after deletion (prefer the next one in the list)
          const remainingModules = modules.filter((m) => {
            const mId = m.id || `module-${m.moduleId}`;
            return mId !== `module-${moduleId}`;
          });
          
          const focusModuleId = remainingModules.length > 0 ? remainingModules[0].moduleId : null;
          await refreshModules(focusModuleId);
        } catch (error) {
          Alert.alert('Delete failed', error?.message || 'Unable to delete module right now.');
        }
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

  const updateSectionOrdering = (sectionId, orderingValue) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              ordering: orderingValue,
            }
          : section
      ),
    }));
  };

  const addSubsection = (sectionId) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: [
                ...section.subsections,
                {
                  id: createId('subsection'),
                  title: '',
                  content: '',
                  ordering: null,
                },
              ],
            }
          : section
      ),
    }));
  };

  const deleteSubsection = (sectionId, subsectionId) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: section.subsections.filter((subsection) => subsection.id !== subsectionId),
            }
          : section
      ),
    }));
  };

  const updateSubsectionTitle = (sectionId, subsectionId, titleValue) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: section.subsections.map((subsection) =>
                subsection.id === subsectionId
                  ? {
                      ...subsection,
                      title: titleValue,
                    }
                  : subsection
              ),
            }
          : section
      ),
    }));
  };

  const updateSubsectionContent = (sectionId, subsectionId, contentValue) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: section.subsections.map((subsection) =>
                subsection.id === subsectionId
                  ? {
                      ...subsection,
                      content: contentValue,
                    }
                  : subsection
              ),
            }
          : section
      ),
    }));
  };

  const updateSubsectionOrdering = (sectionId, subsectionId, orderingValue) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              subsections: section.subsections.map((subsection) =>
                subsection.id === subsectionId
                  ? {
                      ...subsection,
                      ordering: orderingValue,
                    }
                  : subsection
              ),
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
      setDraft((previous) => ({
        ...previous,
        moduleLocalImageUri: selectedAsset.uri,
        moduleLocalImageAsset: selectedAsset,
      }));
    }
  };

  const clearLocalImage = () => {
    setDraft((previous) => ({
      ...previous,
      moduleLocalImageUri: '',
      moduleLocalImageAsset: null,
    }));
  };

  const saveDraft = async () => {
    if (isSaving) {
      return;
    }

    if (!draft.title.trim()) {
      showNotice('Missing details', 'Please provide a module title before saving.');
      return;
    }

    const normalizedSections = draft.sections
      .map((section, index) => {
        const normalizedTitle = String(section.title || '').trim();
        const normalizedOrdering =
          section.ordering === null || section.ordering === undefined || section.ordering === ''
            ? null
            : Number.parseFloat(section.ordering);

        const normalizedSubsections = Array.isArray(section.subsections)
          ? section.subsections
              .map((subsection, subsectionIndex) => {
                const normalizedSubTitle = String(subsection.title || '').trim();
                const normalizedSubContent = String(subsection.content || '').trim();
                const normalizedSubOrdering =
                  subsection.ordering === null || subsection.ordering === undefined || subsection.ordering === ''
                    ? null
                    : Number.parseFloat(subsection.ordering);

                if (!normalizedSubTitle && !normalizedSubContent) {
                  return null;
                }

                return {
                  title: normalizedSubTitle || `Subsection ${subsectionIndex + 1}`,
                  content: normalizedSubContent || '<p>No content provided.</p>',
                  ordering: Number.isFinite(normalizedSubOrdering) ? normalizedSubOrdering : null,
                };
              })
              .filter(Boolean)
          : [];

        if (!normalizedTitle && normalizedSubsections.length === 0) {
          return null;
        }

        return {
          title: normalizedTitle || `Section ${index + 1}`,
          ordering: Number.isFinite(normalizedOrdering) ? normalizedOrdering : null,
          subsections: normalizedSubsections.length
            ? normalizedSubsections
            : [
                {
                  title: normalizedTitle || `Subsection ${index + 1}`,
                  content: '<p>No content provided.</p>',
                  ordering: null,
                },
              ],
        };
      })
      .filter(Boolean);

    if (normalizedSections.length === 0) {
      showNotice('Missing details', 'Please add at least one section with content.');
      return;
    }

    const numericModuleId = extractNumericModuleId(draft.id);

    try {
      setIsSaving(true);

      const token = await getAuthToken();
      let normalizedModuleImageUrl = draft.moduleImageUrl.trim();

      if (draft.moduleLocalImageAsset) {
        normalizedModuleImageUrl = await uploadModuleCoverImage(
          token,
          draft.moduleLocalImageAsset
        );
      }

      const normalizedType = normalizeModuleType(draft.moduleType);

      const modulePayload = {
        title: draft.title.trim(),
        moduleType: normalizedType,
        type: normalizedType,
        module_type: normalizedType,
        moduleImageUrl: normalizedModuleImageUrl,
        sections: normalizedSections,
      };

      if (numericModuleId) {
        await requestProfileApi(`/api/v1/admin/modules/${numericModuleId}`, token, {
          method: 'PUT',
          body: modulePayload,
        });

        await refreshModules(numericModuleId);
      } else {
        const createResponse = await requestProfileApi('/api/v1/admin/modules', token, {
          method: 'POST',
          body: modulePayload,
        });

        const createdId = createResponse?.data?.moduleId;
        await refreshModules(createdId || null);
      }

      showSaveSuccessPrompt(Boolean(numericModuleId));
    } catch (error) {
      showNotice('Save failed', error?.message || 'Unable to save module right now.');
    } finally {
      setIsSaving(false);
    }
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
      ) : null}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.libraryHeaderRow}>
          <Text style={styles.libraryTitle}>Saved Modules ({modules.length})</Text>
          <TouchableOpacity style={styles.newDraftButton} onPress={startNewDraft}>
            <Text style={styles.newDraftButtonText}>+ New Module Draft</Text>
          </TouchableOpacity>
        </View>

        {modules.length ? (
          <View style={styles.libraryList}>
            {modules.map((moduleItem) => {
              const moduleIdentifier = moduleItem.id || `module-${moduleItem.moduleId}`;
              const moduleNumericId = moduleItem.moduleId || extractNumericModuleId(moduleIdentifier);
              const isActive = draft.id === moduleIdentifier;

              return (
                <TouchableOpacity
                  key={moduleIdentifier}
                  style={[styles.libraryCard, isActive && styles.libraryCardActive]}
                  onPress={() => openModuleForEdit(moduleNumericId)}
                  activeOpacity={0.85}
                >
                  <View style={styles.libraryMeta}>
                    <Text style={styles.libraryName}>{moduleItem.title}</Text>
                    <Text style={styles.librarySubtext}>
                      {moduleItem.sectionCount || 0} section(s)
                    </Text>
                  </View>

                  <View style={styles.libraryActions}>
                    <TouchableOpacity
                      style={styles.libraryActionButton}
                      onPress={(event) => {
                        if (event?.stopPropagation) {
                          event.stopPropagation();
                        }
                        openModuleForEdit(moduleNumericId);
                      }}
                    >
                      <Text style={styles.libraryActionButtonText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.libraryDeleteButton}
                      onPress={(event) => {
                        if (event?.stopPropagation) {
                          event.stopPropagation();
                        }
                        removeModule(moduleNumericId);
                      }}
                    >
                      <Text style={styles.libraryDeleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
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

          <View style={styles.typeSection}>
            <Text style={styles.typeLabel}>Module Type</Text>
            <View style={styles.typeOptionsRow}>
              {MODULE_TYPE_OPTIONS.map((option) => {
                const isActive = draft.moduleType === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.typeOptionButton, isActive && styles.typeOptionButtonActive]}
                    onPress={() => {
                      setDraft((previous) => ({
                        ...previous,
                        moduleType: option.value,
                      }));
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
                    moduleLocalImageUri: value.trim() ? '' : previous.moduleLocalImageUri,
                    moduleLocalImageAsset: value.trim() ? null : previous.moduleLocalImageAsset,
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

              <View style={styles.orderingRow}>
                <TextInput
                  placeholder="Ordering e.g. 1.0"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={section.ordering === null || section.ordering === undefined ? '' : String(section.ordering)}
                  onChangeText={(value) => updateSectionOrdering(section.id, value)}
                  style={styles.orderingInput}
                  keyboardType={Platform.OS === 'web' ? 'text' : 'decimal-pad'}
                />
              </View>

              <View style={styles.subsectionToolbar}>
                <Text style={styles.subsectionToolbarTitle}>Subsections</Text>
                <TouchableOpacity style={styles.subsectionAddButton} onPress={() => addSubsection(section.id)}>
                  <Text style={styles.subsectionAddButtonText}>+ Add Subsection</Text>
                </TouchableOpacity>
              </View>

              {section.subsections.map((subsection) => (
                <View key={subsection.id} style={styles.subsectionBoxInner}>
                  <View style={styles.subsectionHeaderRow}>
                    <TextInput
                      placeholder="Subsection Title"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={subsection.title}
                      onChangeText={(value) => updateSubsectionTitle(section.id, subsection.id, value)}
                      style={styles.subsectionTitleInput}
                    />

                    <TouchableOpacity
                      style={styles.subsectionDeleteButton}
                      onPress={() => deleteSubsection(section.id, subsection.id)}
                    >
                      <Text style={styles.deleteX}>X</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.subsectionOrderingRow}>
                    <TextInput
                      placeholder="Ordering e.g. 1.1"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={subsection.ordering === null || subsection.ordering === undefined ? '' : String(subsection.ordering)}
                      onChangeText={(value) => updateSubsectionOrdering(section.id, subsection.id, value)}
                      style={styles.orderingInput}
                      keyboardType={Platform.OS === 'web' ? 'text' : 'decimal-pad'}
                    />
                  </View>

                  <View style={styles.editorBox}>
                    <Editor
                      value={subsection.content}
                      onChange={(html) => updateSubsectionContent(section.id, subsection.id, html)}
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={saveDraft}
            disabled={isSaving}
          >
            <Text style={styles.saveText}>
              {isSaving
                ? 'Saving Module...'
                : draft.id
                  ? 'Save Module Changes'
                  : 'Save Module'}
            </Text>
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
  orderingRow: {
    marginBottom: 12,
  },
  subsectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  subsectionToolbarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A5D23',
  },
  subsectionAddButton: {
    backgroundColor: '#EAF2E3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  subsectionAddButtonText: {
    color: '#2E6B4D',
    fontWeight: '700',
    fontSize: 12,
  },
  subsectionBoxInner: {
    backgroundColor: '#FBFCF8',
    borderWidth: 1,
    borderColor: '#EEF2EA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  subsectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  subsectionTitleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9DED2',
    padding: 10,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  subsectionDeleteButton: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  subsectionOrderingRow: {
    marginBottom: 10,
  },
  orderingInput: {
    borderWidth: 1,
    borderColor: '#D9DED2',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
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
    marginBottom: 10,
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

export default withRoleGuard(AdminModuleManagerScreen, {
  allowedRoles: ['Admin'],
  screenName: 'Manage Modules',
});
