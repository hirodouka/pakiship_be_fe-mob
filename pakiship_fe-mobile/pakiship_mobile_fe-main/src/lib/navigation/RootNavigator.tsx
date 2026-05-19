import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';

import LoginScreen from '../../features/screens/LoginScreen';
import RoleSelectionScreen from '../../features/screens/RoleSelectionScreen';
import SignupScreen from '../../features/screens/SignupScreen';
import SignupStep2Screen from '../../features/screens/SignupStep2Screen';
import SignupStep3Screen from '../../features/screens/SignupStep3Screen';
import OperatorReminderScreen from '../../features/screens/OperatorReminderScreen';
import DriverReminderScreen from '../../features/screens/DriverReminderScreen';

// Feature Screens
import DriverHomeScreen from '../../features/screens/DriverHomeScreen';
import JobDetailsScreen from '../../features/screens/JobDetailsScreen';
import UpdateStatusScreen from '../../features/screens/UpdateStatusScreen';
import DriverProfileScreen from '../../features/screens/DriverProfileScreen';
import OperatorHomeScreen from '../../features/operator/screens/OperatorHomeScreenWithTabs';
import OperatorProfileScreen from '../../features/operator/screens/ProfileScreen';
import ReceiveParcelScreen from '../../features/operator/screens/ReceiveParcelScreen';
import ManualEntryScreen from '../../features/operator/screens/ManualEntryScreen';
import QRScannerScreen from '../../features/operator/screens/QRScannerScreen';
import CustomerHomeScreen from '../../features/home/screens/HomeScreen';
import CustomerProfileScreen from '../../features/profile/screens/EditProfileScreen';
import SendParcelScreen from '../../features/parcel/screens/SendParcelScreen';
import TrackPackageScreen from '../../features/parcel/screens/TrackPackageScreen';
import HistoryScreen from '../../features/history/screens/HistoryScreen';
import RateReviewScreen from '../../features/reviews/screens/RateReviewScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

type RootNavigatorProps = {
  onBackToLauncher?: () => void;
};

export default function RootNavigator({ onBackToLauncher }: RootNavigatorProps) {
  return (
    <Stack.Navigator id="RootStack" initialRouteName="Login" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'white' } }}>
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} onBackToLauncher={onBackToLauncher} />}
      </Stack.Screen>
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="SignupStep2" component={SignupStep2Screen} />
      <Stack.Screen name="SignupStep3" component={SignupStep3Screen} />
      <Stack.Screen name="OperatorReminder" component={OperatorReminderScreen} />
      <Stack.Screen name="DriverReminder" component={DriverReminderScreen} />
      
      {/* Driver Features */}
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
      <Stack.Screen name="JobDetails" component={JobDetailsScreen} />
      <Stack.Screen name="UpdateStatus" component={UpdateStatusScreen} />
      <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />

      {/* Sender Features */}
      <Stack.Screen name="Home" component={CustomerHomeScreen} />
      <Stack.Screen name="EditProfile" component={CustomerProfileScreen} />
      <Stack.Screen name="SendParcel" component={SendParcelScreen} />
      <Stack.Screen name="TrackPackage" component={TrackPackageScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="RateReview" component={RateReviewScreen} />

      {/* Operator Features */}
      <Stack.Screen name="OperatorHome" component={OperatorHomeScreen} />
      <Stack.Screen name="OperatorProfile" component={OperatorProfileScreen} />
      <Stack.Screen name="ReceiveParcel" component={ReceiveParcelScreen} />
      <Stack.Screen name="ManualEntry" component={ManualEntryScreen} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} />
    </Stack.Navigator>
  );
}
