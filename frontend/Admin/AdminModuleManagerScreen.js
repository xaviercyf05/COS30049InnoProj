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

  if (normalized === 'general modules' || normalized === 'general') {
    return 'general';
  }

  if (
    normalized === 'park-specific' ||
    normalized === 'park_specific' ||
    normalized === 'tpa' ||
    normalized === 'total protected area' ||
    normalized === 'total protected area modules'
  ) {
    return 'park-specific';
  }

  if (
    normalized === 'on-site' ||
    normalized === 'onsite' ||
    normalized === 'on_site' ||
    normalized === 'on site training' ||
    normalized === 'on-site training modules'
  ) {
    return 'on-site';
  }

  return 'general';
}

function moduleTypeStringToId(normalizedTypeString) {
  switch (normalizedTypeString) {
    case 'general':
      return 1;
    case 'park-specific':
      return 2;
    case 'on-site':
      return 3;
    default:
      return 1; // Default to General Modules
  }
}

function moduleTypeIdToString(moduleTypeId) {
  switch (Number(moduleTypeId)) {
    case 2:
      return 'park-specific';
    case 3:
      return 'on-site';
    case 1:
    default:
      return 'general';
  }
}

function normalizeOrderingValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value).trim();
}

function parseOrderingValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortByOrdering(items) {
  return [...items]
    .map((item, index) => ({
      item,
      index,
      ordering: parseOrderingValue(item?.ordering),
    }))
    .sort((left, right) => {
      const leftHasOrdering = Number.isFinite(left.ordering);
      const rightHasOrdering = Number.isFinite(right.ordering);

      if (leftHasOrdering && rightHasOrdering && left.ordering !== right.ordering) {
        return left.ordering - right.ordering;
      }

      if (leftHasOrdering !== rightHasOrdering) {
        return leftHasOrdering ? -1 : 1;
      }

      if (leftHasOrdering && rightHasOrdering) {
        return left.index - right.index;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function renumberSections(sections) {
  return sections.map((section, sectionIndex) => ({
    ...section,
    ordering: sectionIndex + 1,
    subsections: Array.isArray(section.subsections)
      ? section.subsections.map((subsection, subsectionIndex) => ({
          ...subsection,
          ordering: subsectionIndex + 1,
        }))
      : [],
  }));
}

function moveArrayItem(items, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return items;
  }

  if (fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
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
    description: '',
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

  const sectionDescription = String(section.description || section.summary || '').trim();
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
            ordering: normalizeOrderingValue(subSection?.ordering),
          };
        })
        .filter(Boolean)
    : [];

  const sortedSubsections = sortByOrdering(normalizedSubsections);

  const composedFromSubsections = sortedSubsections
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
    description: sectionDescription,
    ordering: normalizeOrderingValue(section.ordering),
    subsections: sortedSubsections.length
      ? sortedSubsections
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
    summary: '',
    moduleType: 'general',
    moduleTypeId: 1,
    linkedTpaModuleId: null,
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

  const moduleTypeFromId = moduleEntry.moduleTypeId ?? moduleEntry.ModuleTypeID;
  const normalizedModuleType = Number.isFinite(Number(moduleTypeFromId))
    ? moduleTypeIdToString(moduleTypeFromId)
    : normalizeModuleType(
        moduleEntry.moduleType ||
          moduleEntry.type ||
          moduleEntry.module_type ||
          moduleEntry.category
      );

  return {
    id: moduleEntry.id || (moduleEntry.moduleId ? `module-${moduleEntry.moduleId}` : null),
    title: moduleEntry.title || '',
    summary: moduleEntry.summary || moduleEntry.Summary || '',
    moduleType: normalizedModuleType,
    moduleTypeId: Number(moduleEntry.moduleTypeId || moduleEntry.module_type_id || moduleEntry.typeId || 0) || 1,
    linkedTpaModuleId: Number(
      moduleEntry.linkedTpaModuleId ||
      moduleEntry.linked_tpa_module_id ||
      moduleEntry.parentModuleId ||
      moduleEntry.parent_module_id ||
      moduleEntry.prerequisiteModuleId ||
      moduleEntry.prerequisite_module_id ||
      0
    ) || null,
    moduleImageUrl: moduleEntry.moduleImageUrl || moduleEntry.image || '',
    summary: moduleEntry.summary || moduleEntry.Summary || '',
    moduleLocalImageUri: '',
    moduleLocalImageAsset: null,
    sections: moduleEntry.sections?.length
      ? sortByOrdering(moduleEntry.sections.map((section) => normalizeSection(section)))
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
  const parkSpecificModules = modules.filter((module) => {
    const typeCandidate = module._typeCandidate ?? (module.moduleType || module.module_type || module.type || module.category || module.moduleTypeId || module.module_type_id || module.typeId);

    if (Number(typeCandidate) === 2) return true;
    if (normalizeModuleType(typeCandidate) === 'park-specific') return true;

    const title = String(module.title || module.name || '').toLowerCase();
    if (title.includes('tpa') || title.includes('total protected area') || title.includes('park-specific')) return true;

    return false;
  });

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
    Alert.alert(title, message);
  };

  const showSaveSuccessPrompt = (isEditFlow) => {
    const successMessage = isEditFlow
      ? 'Module changes saved successfully.'
      : 'Module created successfully.';
    Alert.alert('Save successful', successMessage, [
      { text: 'Previous Page', onPress: navigateToPreviousScreen },
      { text: 'Homepage', onPress: navigateToHome },
    ]);
  };

  const getAuthToken = async () => {
    const token = await AsyncStorage.getItem('auth_token');

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

      // Normalize modules so downstream filters and id lookups are reliable
      const normalizedModules = updatedLibrary.map((m) => {
        const rawId = m.moduleId ?? m.id ?? m.ModuleID ?? null;
        const moduleId = extractNumericModuleId(rawId) || rawId || null;
        const title = m.title || m.name || m.moduleName || m.moduleTitle || `Module ${moduleId}`;
        const typeCandidate = m.moduleType || m.module_type || m.type || m.category || m.moduleTypeId || m.module_type_id || m.typeId || m.ModuleTypeID;

        return {
          ...m,
          moduleId,
          title,
          _typeCandidate: typeCandidate,
        };
      });

      setModules(normalizedModules);

      if (!updatedLibrary.length) {
        setDraft(createEmptyDraft());
        return;
      }

      const hasFocusedModuleInLibrary =
        focusedModuleId !== null &&
        focusedModuleId !== undefined &&
        normalizedModules.some((moduleItem) => Number(moduleItem.moduleId) === Number(focusedModuleId));

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
      sections: renumberSections([...previous.sections, makeDefaultSection()]),
    }));
  };

  const moveSection = (sectionId, direction) => {
    setDraft((previous) => {
      const currentIndex = previous.sections.findIndex((section) => section.id === sectionId);

      if (currentIndex < 0) {
        return previous;
      }

      const nextIndex = currentIndex + direction;
      return {
        ...previous,
        sections: renumberSections(moveArrayItem(previous.sections, currentIndex, nextIndex)),
      };
    });
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

  const updateSectionDescription = (sectionId, descriptionValue) => {
    setDraft((previous) => ({
      ...previous,
      sections: previous.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              description: descriptionValue,
            }
          : section
      ),
    }));
  };

  const addSubsection = (sectionId) => {
    setDraft((previous) => ({
      ...previous,
      sections: renumberSections(previous.sections.map((section) =>
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
      )),
    }));
  };

  const moveSubsection = (sectionId, subsectionId, direction) => {
    setDraft((previous) => ({
      ...previous,
      sections: renumberSections(
        previous.sections.map((section) => {
          if (section.id !== sectionId) {
            return section;
          }

          const currentIndex = section.subsections.findIndex((subsection) => subsection.id === subsectionId);

          if (currentIndex < 0) {
            return section;
          }

          const nextIndex = currentIndex + direction;

          return {
            ...section,
            subsections: moveArrayItem(section.subsections, currentIndex, nextIndex),
          };
        })
      ),
    }));
  };

  const deleteSubsection = (sectionId, subsectionId) => {
    setDraft((previous) => ({
      ...previous,
      sections: renumberSections(
        previous.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                subsections: section.subsections.filter((subsection) => subsection.id !== subsectionId),
              }
            : section
        )
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

  const deleteSection = (sectionId) => {
    setDraft((previous) => ({
      ...previous,
      sections: renumberSections(previous.sections.filter((section) => section.id !== sectionId)),
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

    if (normalizeModuleType(draft.moduleType) === 'on-site' && !draft.linkedTpaModuleId) {
      showNotice('Missing details', 'Please choose a linked TPA module for this On Site Training Module.');
      return;
    }

    const normalizedSections = renumberSections(draft.sections)
      .map((section, index) => {
        const normalizedTitle = String(section.title || '').trim();
        const normalizedDescription = String(section.description || '').trim();

        const normalizedSubsections = Array.isArray(section.subsections)
          ? section.subsections
              .map((subsection, subsectionIndex) => {
                const normalizedSubTitle = String(subsection.title || '').trim();
                const normalizedSubContent = String(subsection.content || '').trim();

                if (!normalizedSubTitle && !normalizedSubContent) {
                  return null;
                }

                return {
                  title: normalizedSubTitle || `Subsection ${subsectionIndex + 1}`,
                  content: normalizedSubContent || '<p>No content provided.</p>',
                  ordering: subsectionIndex + 1,
                };
              })
              .filter(Boolean)
          : [];

        if (!normalizedTitle && !normalizedDescription && normalizedSubsections.length === 0) {
          return null;
        }

        return {
          title: normalizedTitle || `Section ${index + 1}`,
          description: normalizedDescription || '',
          ordering: index + 1,
          subsections: normalizedSubsections.length
            ? normalizedSubsections
            : [
                {
                  title: normalizedTitle || `Subsection ${index + 1}`,
                  content: '<p>No content provided.</p>',
                  ordering: 1,
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
      const moduleTypeId = moduleTypeStringToId(normalizedType);
    
      const modulePayload = {
        title: draft.title.trim(),
        summary: draft.summary ? String(draft.summary).trim() : '',
        moduleType: normalizedType,
        moduleTypeId: moduleTypeId,
        type: normalizedType,
        typeId: moduleTypeId,
        module_type: normalizedType,
        module_type_id: moduleTypeId,
        linkedTpaModuleId: normalizedType === 'on-site' ? Number(draft.linkedTpaModuleId) : null,
        linked_tpa_module_id: normalizedType === 'on-site' ? Number(draft.linkedTpaModuleId) : null,
        prerequisiteModuleId: normalizedType === 'on-site' ? Number(draft.linkedTpaModuleId) : null,
        parentModuleId: normalizedType === 'on-site' ? Number(draft.linkedTpaModuleId) : null,
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

  const orderedSections = renumberSections(draft.sections);

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
              
              // Find linked module names for display
              let linkedModuleDisplay = '';
              const normalizedType = moduleTypeIdToString(moduleItem.moduleTypeId);
              
              if (normalizedType === 'on-site' && moduleItem.linkedTpaModuleId) {
                const linkedModule = modules.find(m => m.moduleId === moduleItem.linkedTpaModuleId);
                if (linkedModule) {
                  linkedModuleDisplay = ` (linked to: ${linkedModule.title})`;
                }
              } else if (normalizedType === 'park-specific' && moduleItem.linkedOnsiteModuleId) {
                const linkedOnSiteModule = modules.find(m => m.moduleId === moduleItem.linkedOnsiteModuleId);
                if (linkedOnSiteModule) {
                  linkedModuleDisplay = ` (has on-site: ${linkedOnSiteModule.title})`;
                }
              }

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
                      Type: {moduleItem.moduleType || 'Unknown'} • {moduleItem.sectionCount || 0} section(s){linkedModuleDisplay}
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

          <TextInput
            placeholder="Module Summary (short description)"
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={draft.summary}
            onChangeText={(value) => {
              setDraft((previous) => ({
                ...previous,
                summary: value,
              }));
            }}
            style={[styles.moduleInput, { marginBottom: 12 }]}
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
                        moduleTypeId: option.id,
                        linkedTpaModuleId:
                          option.value === 'on-site' ? previous.linkedTpaModuleId : null,
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

          {draft.moduleType === 'on-site' ? (
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
                    const isActive = Number(draft.linkedTpaModuleId) === moduleId;

                    return (
                      <TouchableOpacity
                        key={`manage-tpa-${moduleId}`}
                        style={[styles.typeOptionButton, isActive && styles.typeOptionButtonActive]}
                        onPress={() => {
                          setDraft((previous) => ({
                            ...previous,
                            linkedTpaModuleId: moduleId,
                          }));
                        }}
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

          {orderedSections.map((section, sectionIndex) => (
            <View key={section.id} style={styles.sectionBox}>
              <View style={styles.sectionOrderRow}>
                <Text style={styles.sectionOrderBadge}>Section {sectionIndex + 1}</Text>
                <View style={styles.reorderControls}>
                  <TouchableOpacity
                    style={[styles.reorderButton, sectionIndex === 0 && styles.reorderButtonDisabled]}
                    onPress={() => moveSection(section.id, -1)}
                    disabled={sectionIndex === 0}
                  >
                    <Text
                      style={[
                        styles.reorderButtonText,
                        sectionIndex === 0 && styles.reorderButtonTextDisabled,
                      ]}
                    >
                      Move Section Up
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reorderButton,
                      sectionIndex === orderedSections.length - 1 && styles.reorderButtonDisabled,
                    ]}
                    onPress={() => moveSection(section.id, 1)}
                    disabled={sectionIndex === orderedSections.length - 1}
                  >
                    <Text
                      style={[
                        styles.reorderButtonText,
                        sectionIndex === orderedSections.length - 1 && styles.reorderButtonTextDisabled,
                      ]}
                    >
                      Move Section Down
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

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

              <TextInput
                placeholder="Section Description (plain text)"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={section.description || ''}
                onChangeText={(value) => updateSectionDescription(section.id, value)}
                style={styles.sectionDescriptionInput}
              />

              <View style={styles.subsectionToolbar}>
                <Text style={styles.subsectionToolbarTitle}>Subsections</Text>
                <TouchableOpacity style={styles.subsectionAddButton} onPress={() => addSubsection(section.id)}>
                  <Text style={styles.subsectionAddButtonText}>+ Add Subsection</Text>
                </TouchableOpacity>
              </View>

              {section.subsections.map((subsection, subsectionIndex) => (
                <View key={subsection.id} style={styles.subsectionBoxInner}>
                  <View style={styles.subsectionOrderRow}>
                    <Text style={styles.subsectionOrderBadge}>
                      Subsection {sectionIndex + 1}.{subsectionIndex + 1}
                    </Text>
                    <View style={styles.reorderControls}>
                      <TouchableOpacity
                        style={[
                          styles.reorderButton,
                          subsectionIndex === 0 && styles.reorderButtonDisabled,
                        ]}
                        onPress={() => moveSubsection(section.id, subsection.id, -1)}
                        disabled={subsectionIndex === 0}
                      >
                        <Text
                          style={[
                            styles.reorderButtonText,
                            subsectionIndex === 0 && styles.reorderButtonTextDisabled,
                          ]}
                        >
                          Move Subsection Up
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.reorderButton,
                          subsectionIndex === section.subsections.length - 1 && styles.reorderButtonDisabled,
                        ]}
                        onPress={() => moveSubsection(section.id, subsection.id, 1)}
                        disabled={subsectionIndex === section.subsections.length - 1}
                      >
                        <Text
                          style={[
                            styles.reorderButtonText,
                            subsectionIndex === section.subsections.length - 1 && styles.reorderButtonTextDisabled,
                          ]}
                        >
                          Move Subsection Down
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

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
  sectionDescriptionInput: {
    borderWidth: 1,
    borderColor: '#D9DED2',
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    color: '#223327',
  },
  sectionOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  sectionOrderBadge: {
    backgroundColor: '#EEF3E7',
    color: '#35513F',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
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
  subsectionOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  subsectionOrderBadge: {
    backgroundColor: '#F4F6EE',
    color: '#4A5D23',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  reorderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reorderButton: {
    backgroundColor: '#F1F5EA',
    borderWidth: 1,
    borderColor: '#DDE6D4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 54,
    alignItems: 'center',
  },
  reorderButtonDisabled: {
    opacity: 0.45,
  },
  reorderButtonText: {
    color: '#35513F',
    fontSize: 12,
    fontWeight: '700',
  },
  reorderButtonTextDisabled: {
    color: '#6F7B6A',
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
