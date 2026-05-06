import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import withRoleGuard from '../auth/withRoleGuard.js';
import { requestProfileApi } from '../Profile/profileApi.js';

function EditBadgeScreen({ route, navigation }) {
  const badge = route?.params?.badge;
  const [name, setName] = useState(badge?.name || '');
  const [validityMonths, setValidityMonths] = useState(
    String(badge?.validityMonths || badge?.validity_months || 12)
  );
  const [modules, setModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [selectedModuleIds, setSelectedModuleIds] = useState(() => {
    const rawIds = badge?.linkedModuleIds || badge?.linked_module_ids || badge?.moduleIds || [];
    if (Array.isArray(rawIds) && rawIds.length > 0) {
      return rawIds.map((value) => String(value));
    }

    const legacyId = badge?.linkedModuleId || badge?.moduleId || badge?.linked_module_id || '';
    return legacyId ? [String(legacyId)] : [];
  });

  const selectedModules = useMemo(
    () => modules.filter((module) => selectedModuleIds.includes(String(module.moduleId))),
    [modules, selectedModuleIds]
  );

  useEffect(() => {
    let active = true;

    const loadModules = async () => {
      setLoadingModules(true);

      try {
        const token = await AsyncStorage.getItem('innopapp_auth_token');

        if (!token) {
          if (active) {
            setModules([]);
          }
          return;
        }

        const response = await requestProfileApi('/api/v1/admin/modules', token, {
          method: 'GET',
        });

        if (!active) {
          return;
        }

        const loadedModules = Array.isArray(response.data) ? response.data : [];
        setModules(
          loadedModules.map((moduleItem) => ({
            moduleId: moduleItem.moduleId || moduleItem.id,
            title: moduleItem.title || moduleItem.name || `Module ${moduleItem.moduleId || moduleItem.id}`,
          }))
        );
      } catch (_error) {
        if (active) {
          setModules([]);
        }
      } finally {
        if (active) {
          setLoadingModules(false);
        }
      }
    };

    loadModules();

    return () => {
      active = false;
    };
  }, []);

  const canSave = useMemo(() => name.trim().length > 0, [name]);

  const toggleModuleSelection = (moduleId) => {
    const normalizedModuleId = String(moduleId);

    setSelectedModuleIds((previous) => (
      previous.includes(normalizedModuleId)
        ? previous.filter((item) => item !== normalizedModuleId)
        : [...previous, normalizedModuleId]
    ));
  };

  const handleSave = async () => {
    if (!badge) {
      Alert.alert('Missing badge', 'Badge details were not provided.');
      navigation.goBack();
      return;
    }

    if (!canSave) {
      Alert.alert('Missing details', 'Please enter a badge name.');
      return;
    }

    if (selectedModuleIds.length === 0) {
      Alert.alert('Missing details', 'Please choose at least one module linked to this badge.');
      return;
    }

    const parsedValidityMonths = Number.parseInt(validityMonths, 10);
    if (!Number.isFinite(parsedValidityMonths) || parsedValidityMonths <= 0) {
      Alert.alert('Invalid validity', 'Badge validity must be a positive number of months.');
      return;
    }

    const selectedModuleNumbers = selectedModuleIds
      .map((moduleId) => Number.parseInt(moduleId, 10))
      .filter((moduleId) => Number.isFinite(moduleId));
    const selectedModuleNames = selectedModules.map((module) => module.title);
    const primaryModuleId = selectedModuleNumbers[0] || null;

    try {
      const token = await AsyncStorage.getItem('innopapp_auth_token');

      if (!token) {
        Alert.alert('Session expired', 'Please log in again to continue.');
        return;
      }

      await requestProfileApi(`/api/v1/admin/badges/${badge.id}`, token, {
        method: 'PUT',
        body: {
          name: name.trim(),
          iconUrl: badge.image,
          validityMonths: parsedValidityMonths,
          moduleId: primaryModuleId,
          linkedModuleId: primaryModuleId,
          linkedModuleIds: selectedModuleNumbers,
          linkedModuleName: selectedModuleNames[0] || '',
          linkedModuleNames: selectedModuleNames,
          moduleName: selectedModuleNames[0] || '',
          eligibilityRules: {
            requireGeneralModuleCompleted: true,
            requireAllTPAModulesCompleted: true,
            requireAllAssessmentsPassed: true,
            requireOnSiteTrainingCompletedByAdmin: true,
          },
        },
      });

      navigation.goBack();
    } catch (error) {
      Alert.alert('Update failed', error?.message || 'Unable to update badge right now.');
    }
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Edit Badge</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Badge Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} />

        <Text style={styles.label}>Badge Validity (Months)</Text>
        <TextInput
          value={validityMonths}
          onChangeText={setValidityMonths}
          style={styles.input}
          keyboardType="number-pad"
          placeholder="e.g. 12"
          placeholderTextColor="#A0A9A0"
        />

        <Text style={styles.label}>Linked Module</Text>
        <View style={styles.modulePickerWrap}>
          {loadingModules ? (
            <View style={styles.loadingModulesRow}>
              <ActivityIndicator size="small" color="#2E6B4D" />
              <Text style={styles.loadingModulesText}>Loading modules...</Text>
            </View>
          ) : modules.length === 0 ? (
            <Text style={styles.moduleHintText}>No modules available.</Text>
          ) : (
            modules.map((moduleItem) => {
              const active = selectedModuleIds.includes(String(moduleItem.moduleId));

              return (
                <TouchableOpacity
                  key={moduleItem.moduleId}
                  style={[styles.moduleOption, active && styles.moduleOptionActive]}
                  onPress={() => toggleModuleSelection(moduleItem.moduleId)}
                >
                  <Text style={[styles.moduleOptionText, active && styles.moduleOptionTextActive]}>
                    {moduleItem.title}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.ruleBox}>
          <Text style={styles.ruleTitle}>Eligibility Rules</Text>
          <Text style={styles.ruleItem}>• Must complete General module</Text>
          <Text style={styles.ruleItem}>• Must complete TPA module track</Text>
          <Text style={styles.ruleItem}>• Must pass all linked assessments</Text>
          <Text style={styles.ruleItem}>• On-site training must be marked complete by admin</Text>
          {selectedModules.length > 0 ? (
            <Text style={styles.ruleModuleText} numberOfLines={3}>
              Linked Module{selectedModules.length > 1 ? 's' : ''}: {selectedModules.map((module) => module.title).join(', ')}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
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
    marginBottom: 10,
  },
  modulePickerWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E8DC',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  loadingModulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingModulesText: {
    color: '#4A5A49',
    fontSize: 13,
  },
  moduleHintText: {
    color: '#607260',
    fontSize: 13,
  },
  ruleModuleText: {
    color: '#2B3A2A',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  moduleOption: {
    borderWidth: 1,
    borderColor: '#E3E8DC',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: '#F7F9F4',
  },
  moduleOptionActive: {
    borderColor: '#8EA77F',
    backgroundColor: '#E7F0E1',
  },
  moduleOptionText: {
    color: '#2B3A2A',
    fontSize: 13,
    fontWeight: '600',
  },
  moduleOptionTextActive: {
    color: '#21402D',
    fontWeight: '700',
  },
  ruleBox: {
    backgroundColor: '#F1F5EB',
    borderWidth: 1,
    borderColor: '#D7E2CB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  ruleTitle: {
    color: '#2B4334',
    fontWeight: '800',
    marginBottom: 6,
  },
  ruleItem: {
    color: '#455949',
    fontSize: 12,
    marginBottom: 4,
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
