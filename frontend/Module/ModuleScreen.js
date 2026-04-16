import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import withRoleGuard from '../auth/withRoleGuard';

function ModuleScreen({ route, currentProfile }) {
  const moduleName = route?.params?.moduleName || route?.params?.grade || 'General';
  const userLabel = currentProfile?.fullName || currentProfile?.username || 'Guide';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{moduleName}</Text>
      <Text>Conservation Basics</Text>
      <Text style={styles.subText}>Signed in as: {userLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subText: {
    marginTop: 10,
    fontSize: 13,
    color: '#4E5D53',
  },
});

export default withRoleGuard(ModuleScreen, {
  allowedRoles: ['User'],
  screenName: 'Module',
});