import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import withRoleGuard from './auth/withRoleGuard';

function Grade2Screen({ currentProfile }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grade 2</Text>
      <Text>Conservation Basics</Text>
      <Text style={styles.subText}>{currentProfile?.username || 'User'}</Text>
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
    marginTop: 8,
    fontSize: 12,
    color: '#556B5B',
  },
});

export default withRoleGuard(Grade2Screen, {
  allowedRoles: ['User'],
  screenName: 'Grade 2',
});