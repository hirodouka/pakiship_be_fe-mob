import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

type ExpoExtra = {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabasePublishableKey?: string;
  supabasePasswordResetRedirectUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

const LOCAL_API_PORT = '4000';
const LOCAL_API_PREFIX = '/api';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const extractHost = (value?: string | null) => {
  if (!value) return undefined;

  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;

  const withoutScheme = trimmedValue.replace(/^[a-z][a-z\d+\-.]*:\/\//i, '');
  const hostSegment = withoutScheme.split('/')[0];
  const hostname = hostSegment?.split(':')[0]?.trim();

  return hostname || undefined;
};

const resolveDevHost = () => {
  const candidates = [
    extra.apiBaseUrl,
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    NativeModules.SourceCode?.scriptURL as string | undefined,
  ];

  for (const candidate of candidates) {
    const host = extractHost(candidate);
    if (host) {
      if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
        return '10.0.2.2';
      }

      return host;
    }
  }

  if (Platform.OS === 'android') return '10.0.2.2';
  if (Platform.OS === 'ios') return '127.0.0.1';
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }

  return 'localhost';
};

const getApiBaseUrl = () => {
  if (extra.apiBaseUrl?.trim()) {
    return trimTrailingSlash(extra.apiBaseUrl.trim());
  }

  return `http://${resolveDevHost()}:${LOCAL_API_PORT}${LOCAL_API_PREFIX}`;
};

export const runtimeConfig = {
  apiBaseUrl: getApiBaseUrl(),
  supabaseUrl: extra.supabaseUrl ?? '',
  supabaseAnonKey: extra.supabaseAnonKey ?? extra.supabasePublishableKey ?? '',
  supabasePublishableKey: extra.supabasePublishableKey ?? '',
  supabasePasswordResetRedirectUrl:
    extra.supabasePasswordResetRedirectUrl ?? 'pakiship://reset-password',
};
