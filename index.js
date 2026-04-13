import { AppRegistry } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GuideProfileScreen from './GuideProfile';
import EditGuideProfileScreen from './EditGuideProfile';
import AdminProfileScreen from './AdminProfile';
import EditAdminProfileScreen from './EditAdminProfile';
import { name as appName } from './app.json'; // App name from app.json

const Stack = createNativeStackNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator initialRouteName="AdminProfile" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GuideProfile" component={GuideProfileScreen} />
      <Stack.Screen name="EditGuideProfile" component={EditGuideProfileScreen} />
      <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />
      <Stack.Screen name="EditAdminProfile" component={EditAdminProfileScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    input::-ms-reveal,
    input::-ms-clear {
      display: none;
      width: 0;
      height: 0;
    }
  `;
  document.head.appendChild(style);
}

AppRegistry.registerComponent(appName, () => AppNavigator);

AppRegistry.runApplication(appName, {
  rootTag: document.getElementById('root'),
});