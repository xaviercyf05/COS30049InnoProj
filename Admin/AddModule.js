import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const Editor =
  Platform.OS === 'web'
    ? require('./RichEditor.web').default
    : require('./RichEditor').default;

const PLACEHOLDER_COLOR = '#A8ADA3';

export default function AddModuleScreen() {
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleImageUrl, setModuleImageUrl] = useState('');
  const [moduleLocalImageUri, setModuleLocalImageUri] = useState('');

  const modulePreviewImage =
    moduleLocalImageUri || moduleImageUrl.trim();

  const [sections, setSections] = useState([
    {
      id: Date.now().toString(),
      title: '',
      subsections: []
    }
  ]);

  // ================= SECTION =================
  const addSection = () => {
    setSections(prev => [
      ...prev,
      { id: Date.now().toString(), title: '', subsections: [] }
    ]);
  };

  const deleteSection = (id) => {
    setSections(prev => prev.filter(sec => sec.id !== id));
  };

  const updateSectionTitle = (id, value) => {
    setSections(prev =>
      prev.map(sec =>
        sec.id === id ? { ...sec, title: value } : sec
      )
    );
  };

  // ================= SUBSECTION =================
  const addSubSection = (sectionId) => {
    setSections(prev =>
      prev.map(sec =>
        sec.id === sectionId
          ? {
              ...sec,
              subsections: [
                ...sec.subsections,
                {
                  id: Date.now().toString(),
                  title: '',
                  content: ''
                }
              ]
            }
          : sec
      )
    );
  };

  const updateSubSection = (sectionId, subId, field, value) => {
    setSections(prev =>
      prev.map(sec =>
        sec.id === sectionId
          ? {
              ...sec,
              subsections: sec.subsections.map(sub =>
                sub.id === subId
                  ? { ...sub, [field]: value }
                  : sub
              )
            }
          : sec
      )
    );
  };

  const deleteSubSection = (sectionId, subId) => {
    setSections(prev =>
      prev.map(sec =>
        sec.id === sectionId
          ? {
              ...sec,
              subsections: sec.subsections.filter(
                sub => sub.id !== subId
              )
            }
          : sec
      )
    );
  };

  const pickLocalModuleImage = async () => {
    if (Platform.OS !== 'web') {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

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
      quality: 0.9
    });

    if (!result.canceled && result.assets?.length) {
      setModuleLocalImageUri(result.assets[0].uri);
    }
  };

  const clearLocalImage = () => {
    setModuleLocalImageUri('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>

        <Text style={styles.header}>Create Module</Text>

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

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={pickLocalModuleImage}
            >
              <Text style={styles.secondaryBtnText}>Upload Local Image</Text>
            </TouchableOpacity>
          </View>

          {moduleLocalImageUri ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={clearLocalImage}
            >
              <Text style={styles.clearBtnText}>Use URL Instead</Text>
            </TouchableOpacity>
          ) : null}

          {modulePreviewImage ? (
            <Image
              source={{ uri: modulePreviewImage }}
              style={styles.moduleImagePreview}
            />
          ) : null}
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={addSection}>
          <Text style={styles.addText}>+ Add Section</Text>
        </TouchableOpacity>

        {/* ================= SECTIONS ================= */}
        {sections.map((section, sIndex) => (
          <View key={section.id} style={styles.sectionBox}>

            {/* SECTION HEADER */}
            <View style={styles.sectionHeader}>
              <TextInput
                placeholder="Section Title (e.g. 1.1)"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={section.title}
                onChangeText={(val) =>
                  updateSectionTitle(section.id, val)
                }
                style={styles.sectionTitleInput}
              />

              <TouchableOpacity
                style={styles.sectionDeleteBtn}
                onPress={() => deleteSection(section.id)}
              >
                <Text style={styles.deleteX}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => addSubSection(section.id)}
              style={styles.addSubBtn}
            >
              <Text style={{ color: '#4A5D23' }}>
                + Add Subsection
              </Text>
            </TouchableOpacity>

            {/* ================= SUBSECTIONS ================= */}
            {section.subsections.map((sub, subIndex) => (
              <View key={sub.id} style={styles.subBox}>

                {/* SUB HEADER (DELETE ON TOP RIGHT LIKE MAIN) */}
                <View style={styles.subHeader}>
                  <TextInput
                    placeholder="Subsection Title (e.g. 1.1.1)"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={sub.title}
                    onChangeText={(val) =>
                      updateSubSection(section.id, sub.id, 'title', val)
                    }
                    style={styles.subTitleInput}
                  />

                  <TouchableOpacity
                    style={styles.subDeleteBtn}
                    onPress={() =>
                      deleteSubSection(section.id, sub.id)
                    }
                  >
                    <Image
                      source={{
                        uri: 'https://images.vexels.com/media/users/3/223479/isolated/preview/8ecc75c9d0cf6d942cce96e196d4953f-trash-bin-icon-flat.png'
                      }}
                      style={styles.deleteIcon}
                    />
                  </TouchableOpacity>
                </View>

                {/* EDITOR */}
                <View style={styles.editorBox}>
                  <Editor
                    value={sub.content}
                    onChange={(html) =>
                      updateSubSection(section.id, sub.id, 'content', html)
                    }
                  />
                </View>

              </View>
            ))}

          </View>
        ))}

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => {
            console.log({
              moduleTitle,
              moduleImageUrl,
              moduleLocalImageUri,
              moduleImage: modulePreviewImage,
              sections
            });
            Alert.alert('Success', 'Module saved successfully!');
          }}
        >
          <Text style={styles.saveText}>Save Module</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FBFCF8'
  },

  header: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
    color: '#3A4D39'
  },

  moduleInput: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15
  },

  imageSection: {
    marginBottom: 14
  },

  imageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5d23',
    marginBottom: 8
  },

  imageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },

  imageUrlInput: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginRight: 8
  },

  secondaryBtn: {
    backgroundColor: '#e9edd9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10
  },

  secondaryBtnText: {
    color: '#3a4d39',
    fontWeight: '600'
  },

  clearBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 12
  },

  clearBtnText: {
    color: '#7f8c69',
    fontWeight: '600'
  },

  moduleImagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#eef2e8',
    marginBottom: 6
  },

  addBtn: {
    backgroundColor: '#656d4a',
    padding: 14,
    borderRadius: 12,
    marginBottom: 15
  },

  addText: {
    color: '#fff',
    textAlign: 'center'
  },

  /* SECTION */
  sectionBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 25
  },

  sectionDeleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 0,
    marginLeft: 8,

    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },

  sectionTitleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginRight: 8,
    borderRadius: 8
  },

  deleteX: {
    fontSize: 14,
    fontWeight: '400',
    color: '#d62828',
    lineHeight: 14,
  },

  addSubBtn: {
    marginBottom: 10
  },

  /* SUBSECTION FIX (IMPORTANT PART) */
  subBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 12,

    marginTop: 15,   // ⭐ THIS FIXES "STUCK TOGETHER"
    borderWidth: 1,
    borderColor: '#eee'
  },

  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },

  subTitleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8
  },

  subDeleteBtn: {
    marginLeft: 10,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',

    shadowColor: '#000',
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
    borderColor: '#e6e6e6',
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden'
  },

  saveBtn: {
    backgroundColor: '#3A4D39',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 30
  },

  saveText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600'
  },
});
