import React, { useState } from 'react';
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
import withRoleGuard from '../auth/withRoleGuard.js';
import { getModuleLibrary, upsertModule } from './moduleLibraryStore.js';

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
  const [savedCount, setSavedCount] = useState(() => getModuleLibrary().length);
  const [sections, setSections] = useState([
    {
      id: createId(),
      title: '',
      content: '',
    },
  ]);

  const modulePreviewImage = moduleLocalImageUri || moduleImageUrl.trim();

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
      setModuleLocalImageUri(result.assets[0].uri);
    }
  };

  const clearLocalImage = () => {
    setModuleLocalImageUri('');
  };

  const handleSave = () => {
    if (!moduleTitle.trim()) {
      Alert.alert('Missing details', 'Please provide a module title before saving.');
      return;
    }

    const moduleDraft = {
      id: `module-${createId()}`,
      title: moduleTitle.trim(),
      moduleImageUrl: moduleImageUrl.trim(),
      moduleLocalImageUri,
      sections,
    };

    upsertModule(moduleDraft);
    setSavedCount(getModuleLibrary().length);

    Alert.alert(
      'Saved',
      'Module draft saved. You can edit it from Manage Modules.'
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.container}>
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
              onChangeText={setModuleImageUrl}
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

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveText}>Save Module</Text>
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
    overflow: 'hidden',
  },
  saveBtn: {
    backgroundColor: '#3A4D39',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 30,
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
