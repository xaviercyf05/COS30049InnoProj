import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

const BADGE_IMAGE = {
  uri: 'https://cdn-icons-png.flaticon.com/512/16779/16779402.png',
};

function AddBadgeScreen({ navigation }) {
  const [badgeName, setBadgeName] = useState('');
  const [validityMonths, setValidityMonths] = useState('12');
  const [modules, setModules] = useState([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState([]);
  const [loadingModules, setLoadingModules] = useState(true);

  const selectedModules = useMemo(
    () => modules.filter((module) => selectedModuleIds.includes(String(module.moduleId))),
    [modules, selectedModuleIds]
  );

  const toggleModuleSelection = (moduleId) => {
    const normalizedModuleId = String(moduleId);

    setSelectedModuleIds((previous) => (
      previous.includes(normalizedModuleId)
        ? previous.filter((item) => item !== normalizedModuleId)
        : [...previous, normalizedModuleId]
    ));
  };

  useEffect(() => {
    let active = true;

    const loadModules = async () => {
      setLoadingModules(true);

      try {
        const token = await AsyncStorage.getItem('auth_token');

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

        const moduleList = Array.isArray(response.data) ? response.data : [];
        setModules(
          moduleList.map((moduleItem) => ({
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

  const handleAddBadge = async () => {
    if (!badgeName.trim()) {
      Alert.alert('Missing details', 'Please enter a badge name.');
      return;
    }

    if (selectedModuleIds.length === 0) {
      Alert.alert('Missing details', 'Please select at least one module to link this badge with.');
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
      const token = await AsyncStorage.getItem('auth_token');

      if (!token) {
        Alert.alert('Session expired', 'Please log in again to continue.');
        return;
      }

      await requestProfileApi('/api/v1/admin/badges', token, {
        method: 'POST',
        body: {
          name: badgeName.trim(),
          iconUrl: BADGE_IMAGE.uri,
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
      Alert.alert('Create failed', error?.message || 'Unable to create badge right now.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add New Badge</Text>

      <View style={styles.imageBox}>
        <Image source={BADGE_IMAGE} style={styles.image} />
        <Text style={styles.imageLabel}>Default Badge Icon</Text>
      </View>

      <TextInput
        placeholder="Badge Name (e.g. Bako National Park)"
        placeholderTextColor="#9AA299"
        value={badgeName}
        onChangeText={setBadgeName}
        style={styles.input}
      />

      <Text style={styles.label}>Badge Validity (Months)</Text>
      <TextInput
        placeholder="e.g. 12"
        placeholderTextColor="#9AA299"
        value={validityMonths}
        onChangeText={setValidityMonths}
        style={styles.input}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Link Badge To Module</Text>
      <View style={styles.modulePickerWrap}>
        {loadingModules ? (
          <View style={styles.loadingModulesRow}>
            <ActivityIndicator size="small" color="#2E6B4D" />
            <Text style={styles.loadingModulesText}>Loading modules...</Text>
          </View>
        ) : modules.length === 0 ? (
          <Text style={styles.moduleHintText}>No modules found. Create modules first.</Text>
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

      <TouchableOpacity style={styles.addButton} onPress={handleAddBadge}>
        <Text style={styles.addText}>+ Create Badge</Text>
      </TouchableOpacity>
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
    paddingBottom: 36,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
    color: '#3A4D39',
  },
  imageBox: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EBEFE4',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  image: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  imageLabel: {
    fontSize: 12,
    color: '#66705F',
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E6EAE0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontWeight: '700',
    color: '#3A4D39',
    marginBottom: 6,
    marginTop: 4,
  },
  modulePickerWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EAE0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  loadingModulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingModulesText: {
    color: '#4E5D53',
    fontSize: 13,
  },
  moduleHintText: {
    color: '#6A7568',
    fontSize: 13,
  },
  moduleOption: {
    borderWidth: 1,
    borderColor: '#E1E7DB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#F7F9F4',
  },
  moduleOptionActive: {
    backgroundColor: '#E6EFE0',
    borderColor: '#8FA780',
  },
  moduleOptionText: {
    color: '#2F4030',
    fontSize: 13,
    fontWeight: '600',
  },
  moduleOptionTextActive: {
    color: '#23412E',
    fontWeight: '700',
  },
  ruleBox: {
    backgroundColor: '#F1F5EB',
    borderWidth: 1,
    borderColor: '#D7E2CB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  ruleTitle: {
    color: '#2B4334',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  ruleItem: {
    color: '#435948',
    fontSize: 12,
    marginBottom: 4,
  },
  ruleModuleText: {
    marginTop: 6,
    color: '#2F4738',
    fontSize: 12,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#656D4A',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});

export default withRoleGuard(AddBadgeScreen, {
  allowedRoles: ['Admin'],
  screenName: 'Add Badge',
});
