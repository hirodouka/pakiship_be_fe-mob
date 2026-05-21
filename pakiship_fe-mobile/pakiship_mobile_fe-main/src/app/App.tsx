import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from '../lib/navigation/RootNavigator';
import { JobsProvider } from '../features/context/JobsContext';
import { AuthSessionProvider } from '../features/context/AuthSessionContext';

type AppProps = {
  onBackToLauncher?: () => void;
};

export default function App({ onBackToLauncher }: AppProps) {
  return (
    <SafeAreaProvider>
      <AuthSessionProvider>
        <JobsProvider>
          <NavigationContainer>
            <RootNavigator onBackToLauncher={onBackToLauncher} />
          </NavigationContainer>
        </JobsProvider>
      </AuthSessionProvider>
    </SafeAreaProvider>
  );
}
