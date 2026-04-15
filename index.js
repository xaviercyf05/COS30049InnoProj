import { registerRootComponent } from 'expo';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GuideProfileScreen from './GuideProfile';
import EditGuideProfileScreen from './EditGuideProfile';
import GuideAssessmentScreen from './GuideAssessment';
import SubmittedPageScreen from './SubmittedPage';
import HomeScreen from './HomeScreen';
import AdminAssessmentScreen from './AdminAssessment';
import AdminProfileScreen from './AdminProfile';
import EditAdminProfileScreen from './EditAdminProfile';

const Stack = createNativeStackNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator initialRouteName="GuideProfile" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GuideAssessment" component={GuideAssessmentScreen} />
      <Stack.Screen name="SubmittedPage" component={SubmittedPageScreen} />
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
      <Stack.Screen name="GuideProfile" component={GuideProfileScreen} />
      <Stack.Screen name="EditGuideProfile" component={EditGuideProfileScreen} />
      <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />
      <Stack.Screen name="AdminAssessment" component={AdminAssessmentScreen} />
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

registerRootComponent(AppNavigator);