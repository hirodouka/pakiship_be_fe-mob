import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Mail, Lock, Eye, EyeOff, Circle, CheckCircle2, ArrowRight, X, AlertCircle, ChevronLeft } from 'lucide-react-native';
import { RootStackParamList } from '@navigation/types';
import { authApi } from '../services/authApi';
import { normalizeAppRole, useAuthSession } from '../context/AuthSessionContext';
import type { AuthUser } from '../types/authTypes';
import Constants from 'expo-constants';

const COLORS = {
  primary: '#39B5A8',
  primaryLight: '#9EE0D3',
  primaryFaint: '#F1FAF8',
  dark: '#041614',
  background: '#F0F9F8',
  white: '#FFFFFF',
  gray100: '#F3F4F6',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  border: '#E6F5F2',
  inputBg: '#F7FDFB',
  error: '#F73A3A',
  errorBorder: '#F9C7C7',
  errorBg: '#FFF5F5',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^\d{10,15}$/;

type LoginScreenProps = {
  onBackToLauncher?: () => void;
};

export default function LoginScreen({ onBackToLauncher }: LoginScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setCurrentUser } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (loginError) {
      setLoginError('');
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (loginError) {
      setLoginError('');
    }
  };

  const handleContinue = async () => {
    const trimmedEmail = email.trim();

    if (!password.trim()) {
      setLoginError('Please enter your password.');
      return;
    }

    if (!trimmedEmail || (!EMAIL_REGEX.test(trimmedEmail) && !MOBILE_REGEX.test(trimmedEmail))) {
      setLoginError('Invalid email format.');
      return;
    }

    try {
      setIsSubmitting(true);
      setLoginError('');
      const result = await authApi.login({
        emailOrMobile: trimmedEmail,
        password,
      });

      setCurrentUser(result.user);

      const appRole = normalizeAppRole(result.user?.role);

      if (appRole === 'driver') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'DriverHome' }],
        });
        return;
      }

      if (appRole === 'operator') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'OperatorHome' }],
        });
        return;
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : 'Unable to log in right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.topHeader}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => {
              if (onBackToLauncher) {
                onBackToLauncher();
                return;
              }

              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            }}
            style={styles.backButton}
          >
            <ChevronLeft color={COLORS.primary} size={24} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['left', 'right', 'bottom']} testID="login-screen" style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            style={styles.flex}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.heroDark}>Hatid Agad,</Text>
              <Text style={styles.heroPrimary}>Walang Abala.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Log In</Text>
              <Text style={styles.cardSubtitle}>
                Welcome back! Log in to manage your shipments.
              </Text>

              {loginError ? (
                <View style={styles.errorBanner}>
                  <AlertCircle color={COLORS.error} size={14} strokeWidth={2.2} />
                  <Text style={styles.errorText}>{loginError}</Text>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>Email or Mobile Number</Text>
              <View style={styles.inputRow}>
                <Mail color={COLORS.primary} size={20} opacity={0.7} />
                <TextInput
                  style={styles.textInput}
                  placeholder="customer@pakiship.com"
                  placeholderTextColor={COLORS.gray400}
                  value={email}
                  onChangeText={handleEmailChange}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </View>

              <Text style={[styles.inputLabel, styles.passwordLabel]}>Password</Text>
              <View style={styles.inputRow}>
                <Lock color={COLORS.primary} size={20} opacity={0.7} />
                <TextInput
                  style={styles.textInput}
                  placeholder="********"
                  placeholderTextColor={COLORS.gray400}
                  secureTextEntry={secureTextEntry}
                  value={password}
                  onChangeText={handlePasswordChange}
                  textContentType="password"
                  autoComplete="password"
                  autoCorrect={false}
                  spellCheck={false}
                />
                <TouchableOpacity onPress={() => setSecureTextEntry(!secureTextEntry)}>
                  {secureTextEntry ? (
                    <Eye color={COLORS.gray400} size={20} />
                  ) : (
                    <EyeOff color={COLORS.gray400} size={20} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.rememberRow}>
                <TouchableOpacity
                  style={styles.rememberLeft}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  {rememberMe ? (
                    <CheckCircle2 color={COLORS.primary} size={20} />
                  ) : (
                    <Circle color={COLORS.gray300} size={20} />
                  )}
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setResetModalVisible(true)}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.continueBtn, isSubmitting && styles.continueBtnDisabled]}
                onPress={handleContinue}
                disabled={isSubmitting}
              >
                <Text style={styles.continueBtnText}>
                  {isSubmitting ? 'Signing In...' : 'Continue'}
                </Text>
              </TouchableOpacity>

              <View style={styles.createRow}>
                <Text style={styles.createText}>New to PakiSHIP? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('RoleSelection')}>
                  <Text style={styles.createLink}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={resetModalVisible}
        onRequestClose={() => setResetModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={() => setResetModalVisible(false)}
            />
            <View style={styles.modalSheet}>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setResetModalVisible(false)}
              >
                <X color={COLORS.gray300} size={24} strokeWidth={2} />
              </TouchableOpacity>

              <View style={styles.modalIconBox}>
                <Lock color={COLORS.primary} size={26} strokeWidth={2.5} />
              </View>

              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalSubtitle}>
                Enter your details to receive a reset link.
              </Text>

              <View style={styles.modalInput}>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="Email address"
                  placeholderTextColor={COLORS.primaryLight}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  textContentType="emailAddress"
                  autoComplete="email"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={styles.resetBtn}
                onPress={async () => {
                  try {
                    await authApi.forgotPassword({ email: resetEmail.trim() });
                    setResetModalVisible(false);
                    setResetEmail('');
                  } catch (error) {
                    setLoginError(
                      error instanceof Error
                        ? error.message
                        : 'Unable to send reset link.',
                    );
                  }
                }}
              >
                <Text style={styles.resetBtnText}>Send Reset Link</Text>
                <ArrowRight color={COLORS.white} size={18} strokeWidth={3} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerSafeArea: {
    backgroundColor: COLORS.white,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  topHeader: {
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(57, 181, 168, 0.08)',
  },
  backButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  heroDark: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    color: COLORS.dark,
    letterSpacing: -0.5,
  },
  heroPrimary: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },
  cardTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.dark,
    textAlign: 'center',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.gray400,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorBg,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    color: COLORS.error,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginLeft: 4,
    marginBottom: 8,
  },
  passwordLabel: {
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 56,
  },
  textInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.dark,
    fontWeight: '500',
    paddingVertical: 0,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  rememberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rememberText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray500,
    marginLeft: 8,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  continueBtn: {
    backgroundColor: COLORS.dark,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnDisabled: {
    opacity: 0.7,
  },
  continueBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 14,
  },
  createRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
  },
  createText: {
    color: COLORS.gray400,
    fontSize: 14,
    fontWeight: '500',
  },
  createLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(4,22,20,0.6)',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 48,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalClose: {
    position: 'absolute',
    top: 28,
    right: 28,
    zIndex: 10,
    padding: 8,
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.dark,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray400,
    marginBottom: 28,
  },
  modalInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingHorizontal: 20,
    height: 60,
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.dark,
    fontWeight: '500',
    paddingVertical: 0,
  },
  resetBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 30,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 12,
    marginRight: 4,
  },
});
