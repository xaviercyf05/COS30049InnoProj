import React, { useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import withRoleGuard from '../auth/withRoleGuard.js';

function EditBadgeScreen({ route, navigation }) {
  const badge = route?.params?.badge;
  const [name, setName] = useState(badge?.name || '');

  const canSave = useMemo(() => name.trim().length > 0, [name]);

  const handleSave = () => {
    if (!badge) {
      Alert.alert('Missing badge', 'Badge details were not provided.');
      navigation.goBack();
      return;
    }

    if (!canSave) {
      Alert.alert('Missing details', 'Please enter a badge name.');
      return;
    }

    navigation.navigate('AdminBadges', {
      updatedBadge: {
        ...badge,
        name: name.trim(),
      },
    });
  };

  if (!badge) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Edit Badge</Text>
        <View style={styles.card}>
          <Text style={styles.errorText}>Badge details are unavailable for editing.</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Badge</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Badge Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} />

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
    color: '#3A4D39',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EAEEE2',
    elevation: 3,
  },
  label: {
    marginTop: 10,
    fontWeight: '700',
    color: '#3A4D39',
  },
  input: {
    backgroundColor: '#F2F4EE',
    padding: 10,
    borderRadius: 10,
    marginTop: 5,
  },
  button: {
    backgroundColor: '#656D4A',
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  errorText: {
    color: '#4E5D53',
    fontSize: 14,
    marginBottom: 12,
  },
});

export default withRoleGuard(EditBadgeScreen, {
  allowedRoles: ['Admin'],
  screenName: 'Edit Badge',
});
