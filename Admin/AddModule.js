import React, { useState, useMemo, useCallback, memo } from 'react'; // Added useMemo, memo
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';

// Replace your existing Editor selection with this:
const Editor = Platform.OS === 'web' 
  ? require('./RichEditor.web').default 
  : require('./RichEditor').default;

// If it's still failing, add this check:
const SafeEditor = (props) => {
  if (!Editor) {
    console.error("Editor component is undefined. Check RichEditor.web.js exports.");
    return <View style={{ height: 100, backgroundColor: 'red' }}><Text>Editor Load Error</Text></View>;
  }
  return <Editor {...props} />;
};

// --- NEW COMPONENT ADDED HERE ---
// This memoized component prevents the editor from reloading on every keystroke
const SectionItem = memo(({ section, onUpdate, EditorComponent }) => {
  return (
    <View style={styles.sectionBox}>
      <TextInput
        placeholder="Section Heading"
        style={styles.input}
        value={section.title}
        onChangeText={(val) => onUpdate(section.id, 'title', val)}
      />

      <View style={styles.editorContainer}>
        <EditorComponent 
          value={section.content} 
          onChange={(html) => onUpdate(section.id, 'content', html)} 
        />
      </View>
    </View>
  );
});

export default function AddModuleScreen() {
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState([]);

  // Use useMemo to ensure the editor reference is stable
  const VisualEditor = useMemo(() => Editor, []);

  const addSection = () => {
    setSections([...sections, {
      id: Date.now().toString(),
      title: '',
      content: ''
    }]);
  };

  // Wrapped in useCallback to keep the function reference stable for SectionItem
  const updateSection = useCallback((id, field, value) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }, []);

  const handleSubmit = () => {
    console.log("Payload:", { title, sections });
    Alert.alert("Success", "Check Console");
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Create Module</Text>

        <TextInput
          placeholder="Module Title"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />

        <TouchableOpacity style={styles.addSectionBtn} onPress={addSection}>
          <Text style={styles.addSectionText}>+ Add Section</Text>
        </TouchableOpacity>

        {/* --- CHANGED THIS LOOP --- */}
        {sections.map((section) => (
          <SectionItem 
            key={section.id} 
            section={section} 
            onUpdate={updateSection} 
            EditorComponent={VisualEditor} 
          />
        ))}

        {sections.length > 0 && (
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitText}>Save Module</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#FBFCF8' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 15, backgroundColor: '#fff' },
  addSectionBtn: { backgroundColor: '#4A5D23', padding: 15, borderRadius: 10, marginBottom: 20 },
  addSectionText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  sectionBox: { 
      backgroundColor: '#fff', 
      padding: 20, 
      borderRadius: 15, 
      marginBottom: 25, 
      borderWidth: 1, 
      borderColor: '#eee',
      // Force a height so it doesn't stay blank
      minHeight: 400, 
      display: 'block', // Helps Web rendering
    },
    editorContainer: {
      marginTop: 15,
      // On Web, Quill dropdowns need to stay on top
      zIndex: Platform.OS === 'web' ? 100 : 1,
      minHeight: 320,
      width: '100%',
    },
  submitBtn: { backgroundColor: '#333', padding: 15, borderRadius: 12 },
  submitText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' }
});