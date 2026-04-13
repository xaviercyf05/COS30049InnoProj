import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SubmittedPage = ({ navigation, route }) => {
  const timeUsed = route?.params?.timeUsed || '00:00:00';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Assessment Submitted</Text>
        <Text style={styles.message}>You have successfully submitted this assessment!</Text>

        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>Total Time Used</Text>
          <Text style={styles.timeValue}>{timeUsed}</Text>
        </View>

        <Text style={styles.notice}>
          Your result needs to be verified by admin. After verification, you can get your badge. Please wait patiently~
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('HomeScreen')}
          activeOpacity={0.9}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8F2',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE6D4',
    padding: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2B331E',
  },
  message: {
    marginTop: 10,
    fontSize: 15,
    color: '#3E4A2D',
    lineHeight: 22,
    fontWeight: '500',
  },
  timeBox: {
    marginTop: 16,
    backgroundColor: '#EFF4E5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  timeLabel: {
    color: '#526342',
    fontSize: 13,
    fontWeight: '700',
  },
  timeValue: {
    marginTop: 4,
    color: '#2E4B1D',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  notice: {
    marginTop: 16,
    fontSize: 14,
    color: '#485A39',
    lineHeight: 21,
    fontWeight: '500',
  },
  button: {
    marginTop: 20,
    alignSelf: 'flex-start',
    backgroundColor: '#5F7446',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#F7FAF3',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default SubmittedPage;
