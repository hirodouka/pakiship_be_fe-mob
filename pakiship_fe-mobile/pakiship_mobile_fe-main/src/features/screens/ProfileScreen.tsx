import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@navigation/types';

type ProfileTab = 'profile' | 'vehicle' | 'preferences';

const palette = {
  appBg: '#EDF6F5',
  shell: '#F7FBFB',
  card: '#FFFFFF',
  cardBorder: '#D8F0EE',
  primary: '#42BDB4',
  primaryDark: '#163733',
  primarySoft: '#E7F8F6',
  text: '#08211E',
  subtext: '#7F91A6',
  success: '#19C566',
  warningBg: '#FFF8E7',
  warningBorder: '#F4C95A',
  warningText: '#9F5900',
};

type Nav = NativeStackNavigationProp<RootStackParamList, 'DriverProfile'>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<ProfileTab>('profile');
  const [twoFactor, setTwoFactor] = useState(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [emailSummaries, setEmailSummaries] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);

  const handleTwoFactorToggle = (nextValue: boolean) => {
    if (nextValue) {
      setShowTwoFactorModal(true);
      return;
    }

    setTwoFactor(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        {showTwoFactorModal ? (
          <TwoFactorModal
            onCancel={() => setShowTwoFactorModal(false)}
            onEnable={() => {
              setTwoFactor(true);
              setShowTwoFactorModal(false);
            }}
          />
        ) : null}

        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={palette.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarBox}>
                <Text style={styles.avatarInitial}>U</Text>
              </View>
              <View style={styles.cameraBadge}>
                <MaterialCommunityIcons name="camera-outline" size={14} color={palette.card} />
              </View>
            </View>

            <View style={styles.profileMeta}>
              <Text style={styles.profileName}>User</Text>
              <View style={styles.activeRow}>
                <Text style={styles.activeText}>ACTIVE PARTNER</Text>
                <MaterialCommunityIcons name="check-circle-outline" size={14} color={palette.primary} />
              </View>
            </View>
          </View>

          <View style={styles.tabBar}>
            <ProfileTabButton label="Profile" active={tab === 'profile'} onPress={() => setTab('profile')} />
            <ProfileTabButton label="Vehicle" active={tab === 'vehicle'} onPress={() => setTab('vehicle')} />
            <ProfileTabButton label="Preferences" active={tab === 'preferences'} onPress={() => setTab('preferences')} />
          </View>

          {tab === 'profile' ? <ProfilePanel /> : null}
          {tab === 'vehicle' ? <VehiclePanel /> : null}
          {tab === 'preferences' ? (
            <PreferencesPanel
              smsAlerts={smsAlerts}
              emailSummaries={emailSummaries}
              autoAccept={autoAccept}
              onToggleSms={() => setSmsAlerts((current) => !current)}
              onToggleEmail={() => setEmailSummaries((current) => !current)}
              onToggleAutoAccept={() => setAutoAccept((current) => !current)}
            />
          ) : null}
        </ScrollView>

        <View style={styles.bottomActions}>
          <View style={styles.securityRow}>
            <View style={styles.securityLabelRow}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color={palette.primary} />
              <Text style={styles.securityLabel}>2FA Security</Text>
            </View>
            <Switch
              value={twoFactor}
              onValueChange={handleTwoFactorToggle}
              trackColor={{ false: '#E5E8EE', true: '#9BE2DB' }}
              thumbColor={palette.card}
            />
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.passwordButton}>
              <MaterialCommunityIcons name="lock-outline" size={18} color={palette.primary} />
              <Text style={styles.passwordButtonText}>Password</Text>
            </Pressable>
            <Pressable style={styles.saveButton}>
              <MaterialCommunityIcons name="content-save-outline" size={18} color={palette.card} />
              <Text style={styles.saveButtonText}>SAVE ALL</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function TwoFactorModal({
  onCancel,
  onEnable,
}: {
  onCancel: () => void;
  onEnable: () => void;
}) {
  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel} />
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Enable 2FA</Text>
          <Pressable onPress={onCancel} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={20} color="#B8C0CC" />
          </Pressable>
        </View>
        <Text style={styles.modalBody}>
          Two-factor authentication adds an extra layer of security to your account.
        </Text>
        <View style={styles.modalActions}>
          <Pressable style={styles.modalCancelButton} onPress={onCancel}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.modalEnableButton} onPress={onEnable}>
            <Text style={styles.modalEnableText}>Enable</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ProfileTabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active ? styles.tabButtonActive : null]}>
      <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function ProfilePanel() {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Personal Details</Text>
      <View style={styles.fieldGroup}>
        <Field label="FULL NAME" icon="account-outline" value="User" />
        <Field label="EMAIL ADDRESS" icon="email-outline" value="" placeholder="Enter email" />
        <Field label="PHONE NUMBER" icon="phone-outline" value="" placeholder="Enter phone number" />
        <Field label="PRIMARY ADDRESS" icon="map-marker-outline" value="" placeholder="Enter address" />
      </View>
    </View>
  );
}

function VehiclePanel() {
  return (
    <View style={styles.panel}>
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleIconBubble}>
          <MaterialCommunityIcons name="bike-fast" size={22} color={palette.primary} />
        </View>
        <View>
          <Text style={styles.panelTitle}>Registration Info</Text>
          <Text style={styles.vehicleSubtitle}>Official registered vehicle information.</Text>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <LockedField label="PLATE NUMBER" icon="map-marker-outline" value="ABC-1234" />
        <LockedField label="VEHICLE TYPE" icon="bike-fast" value="Motorcycle" />
        <LockedField label="DRIVER'S LICENSE NO." icon="shield-outline" value="N03-12-345678" />
      </View>

      <View style={styles.warningBox}>
        <MaterialCommunityIcons name="alert-circle-outline" size={18} color={palette.warningText} />
        <Text style={styles.warningText}>
          To update vehicle details or license information, please <Text style={styles.warningLink}>Contact Support</Text> for verification.
        </Text>
      </View>

      <View style={styles.documentsSection}>
        <Text style={styles.documentTitle}>Document Verification</Text>
        <UploadCard label="DRIVER'S LICENSE" />
        <UploadCard label="VEHICLE REGISTRATION" />
      </View>
    </View>
  );
}

function PreferencesPanel({
  smsAlerts,
  emailSummaries,
  autoAccept,
  onToggleSms,
  onToggleEmail,
  onToggleAutoAccept,
}: {
  smsAlerts: boolean;
  emailSummaries: boolean;
  autoAccept: boolean;
  onToggleSms: () => void;
  onToggleEmail: () => void;
  onToggleAutoAccept: () => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleIconBubble}>
          <MaterialCommunityIcons name="bell-outline" size={22} color={palette.primary} />
        </View>
        <Text style={styles.panelTitle}>Preferences</Text>
      </View>

      <PreferenceRow
        icon="message-outline"
        title="SMS Dispatch Alerts"
        description="Get instant alerts for new bookings."
        value={smsAlerts}
        onValueChange={onToggleSms}
      />
      <PreferenceRow
        icon="email-outline"
        title="Email Summaries"
        description="Weekly earnings and activity reports."
        value={emailSummaries}
        onValueChange={onToggleEmail}
      />
      <PreferenceRow
        icon="navigation-variant-outline"
        title="Auto-Accept"
        description="Automatically accept nearby bookings."
        value={autoAccept}
        onValueChange={onToggleAutoAccept}
        last
      />
    </View>
  );
}

function Field({
  label,
  icon,
  value,
  placeholder,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: string;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <MaterialCommunityIcons name={icon} size={18} color="#7ACFCC" />
        <TextInput
          defaultValue={value}
          placeholder={placeholder}
          placeholderTextColor="#B7C2D0"
          style={styles.textInput}
        />
      </View>
    </View>
  );
}

function LockedField({
  label,
  icon,
  value,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, styles.lockedFieldLabel]}>{label}</Text>
      <View style={styles.lockedInputWrap}>
        <MaterialCommunityIcons name={icon} size={18} color="#98A8BE" />
        <Text style={styles.lockedInputText}>{value}</Text>
        <MaterialCommunityIcons name="lock-outline" size={16} color="#C9D3E0" />
      </View>
    </View>
  );
}

function UploadCard({ label }: { label: string }) {
  return (
    <View style={styles.uploadWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.uploadCard}>
        <MaterialCommunityIcons name="upload-outline" size={34} color={palette.primary} />
        <Text style={styles.uploadText}>Upload Photo</Text>
      </Pressable>
    </View>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  last,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description: string;
  value: boolean;
  onValueChange: () => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.preferenceRow, last ? styles.preferenceRowLast : null]}>
      <View style={styles.preferenceMeta}>
        <MaterialCommunityIcons name={icon} size={22} color={palette.primary} />
        <View style={styles.preferenceTextWrap}>
          <Text style={styles.preferenceTitle}>{title}</Text>
          <Text style={styles.preferenceDescription}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E5E8EE', true: '#79D7CF' }}
        thumbColor={palette.card}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.appBg,
  },
  screen: {
    flex: 1,
    backgroundColor: palette.shell,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: '#E7F1F0',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 296,
    borderRadius: 26,
    backgroundColor: palette.card,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: '#698380',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    color: '#5F6E82',
    fontSize: 14,
    lineHeight: 26,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E7EE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card,
  },
  modalCancelText: {
    color: '#222',
    fontSize: 14,
    fontWeight: '500',
  },
  modalEnableButton: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  modalEnableText: {
    color: palette.card,
    fontSize: 14,
    fontWeight: '700',
  },
  backButton: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 34,
  },
  content: {
    padding: 14,
    paddingBottom: 180,
    gap: 14,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 14,
    shadowColor: '#91C8C2',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatarBox: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: '#186D69',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: palette.card,
    fontSize: 30,
    fontWeight: '900',
  },
  cameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.card,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 4,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 14,
  },
  tabButtonActive: {
    backgroundColor: '#F7FBFB',
    borderWidth: 1,
    borderColor: '#D8F0EE',
  },
  tabButtonText: {
    color: '#B1B7C7',
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: palette.primary,
  },
  panel: {
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 16,
    shadowColor: '#98CEC9',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  panelTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  fieldGroup: {
    gap: 16,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  inputWrap: {
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F0F9F8',
    borderWidth: 1,
    borderColor: '#E3F1F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  vehicleIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleSubtitle: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: '500',
    marginTop: -8,
  },
  lockedFieldLabel: {
    color: '#96A6BC',
  },
  lockedInputWrap: {
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#EEF3F8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  lockedInputText: {
    flex: 1,
    color: '#7284A0',
    fontSize: 15,
    fontWeight: '700',
  },
  warningBox: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.warningBorder,
    backgroundColor: palette.warningBg,
    padding: 14,
  },
  warningText: {
    flex: 1,
    color: palette.warningText,
    fontSize: 13,
    lineHeight: 22,
    fontWeight: '500',
  },
  warningLink: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  documentsSection: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#EFF3F6',
    gap: 16,
  },
  documentTitle: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  uploadWrap: {
    gap: 8,
  },
  uploadCard: {
    height: 104,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BEE8E4',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FCFFFF',
  },
  uploadText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F5',
  },
  preferenceRowLast: {
    borderBottomWidth: 0,
  },
  preferenceMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    paddingRight: 14,
  },
  preferenceTextWrap: {
    flex: 1,
  },
  preferenceTitle: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  preferenceDescription: {
    color: palette.subtext,
    fontSize: 12,
  },
  bottomActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.card,
    borderTopWidth: 1,
    borderTopColor: '#E6EFEF',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 10,
  },
  securityRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBFEFE',
  },
  securityLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  securityLabel: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  passwordButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.card,
  },
  passwordButtonText: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1.6,
    height: 50,
    borderRadius: 16,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#63C9C0',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  saveButtonText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
