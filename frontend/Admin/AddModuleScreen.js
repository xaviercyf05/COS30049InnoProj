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

function createId() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function AddModuleScreen({ navigation }) {
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleImageUrl, setModuleImageUrl] = useState('');
  const [moduleLocalImageUri, setModuleLocalImageUri] = useState('');
  const [moduleLocalImageAsset, setModuleLocalImageAsset] = useState(null);
  const [savedCount, setSavedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [sections, setSections] = useState([
    {
      id: createId(),
      title: '',
      content: '',
    },
  ]);

  const modulePreviewImage =
    moduleLocalImageUri ||
    resolveApiAssetUri(moduleImageUrl.trim()) ||
    moduleImageUrl.trim();

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

        setSavedCount(Array.isArray(response.data) ? response.data.length : 0);
      } catch (_error) {
        if (active) {
          setSavedCount(0);
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
      { id: createId(), title: '', content: '' },
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

  const updateSectionContent = (sectionId, value) => {
    setSections((previous) =>
      previous.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              content: value,
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

    const token = await AsyncStorage.getItem('innopapp_auth_token');

    if (!token) {
      showNotice('Session expired', 'Please log in again to continue.');
      return;
    }

    const normalizedSections = sections
      .map((section, index) => {
        const normalizedTitle = String(section.title || '').trim();
        const normalizedContent = String(section.content || '').trim();

        if (!normalizedTitle && !normalizedContent) {
          return null;
        }

        return {
          title: normalizedTitle || `Section ${index + 1}`,
          content: normalizedContent || '<p>No content provided.</p>',
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

      await requestProfileApi('/api/v1/admin/modules', token, {
        method: 'POST',
        body: {
          title: moduleTitle.trim(),
          moduleImageUrl: normalizedModuleImageUrl,
          sections: normalizedSections,
        },
      });

      const moduleListResponse = await requestProfileApi('/api/v1/admin/modules', token, {
        method: 'GET',
      });

      setSavedCount(Array.isArray(moduleListResponse.data) ? moduleListResponse.data.length : 0);
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

            <View style={styles.editorBox}>
              <Editor
                value={section.content}
                onChange={(html) => updateSectionContent(section.id, html)}
              />
            </View>
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
