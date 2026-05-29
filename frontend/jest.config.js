module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^expo-modules-core/src/Refs$': '<rootDir>/node_modules/expo-modules-core/src/Refs.ts',
  },
  setupFilesAfterEnv: ['./jest.setup.js', '@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native|@react-native-async-storage))'
  ],
  clearMocks: true,
  resetMocks: true,
};