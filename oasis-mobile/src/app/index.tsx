import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { apiRequest, getDashboardRole, setAuthToken } from '@/lib/api';

type LoginResponse = {
  token: string;
  user: { name: string; email: string; role: string };
};

const benefits = [
  { title: 'Ruang lab', detail: 'Cek jadwal & ajukan', code: '01' },
  { title: 'Peralatan', detail: 'Pinjam dengan aman', code: '02' },
  { title: 'Status', detail: 'Pantau pengajuan', code: '03' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Alamat email wajib diisi.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Masukkan alamat email yang valid.');
      return;
    }
    if (!password) {
      setError('Kata sandi wajib diisi.');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email: normalizedEmail, password },
      });
      setAuthToken(result.token);
      router.replace({
        pathname: '/dashboard',
        params: { role: getDashboardRole(result.user.role), name: result.user.name },
      });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Tidak dapat masuk ke LabSpace.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brandPanel}>
            <View style={styles.decorCircleLarge} />
            <View style={styles.decorCircleSmall} />
            <View style={styles.brandTop}>
              <View style={styles.logoRow}>
                <View style={styles.logoMark}>
                  <Text style={styles.logoText}>L</Text>
                </View>
                <View>
                  <Text style={styles.brandName}>LabSpace</Text>
                  <Text style={styles.brandMeta}>PORTAL LABORATORIUM</Text>
                </View>
              </View>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>SATU PINTU LAYANAN</Text>
              </View>
            </View>

            <View style={styles.brandCopy}>
              <Text style={styles.brandEyebrow}>RUANG. ALAT. PRAKTIKUM.</Text>
              <Text style={styles.brandHeadline}>Urus kebutuhan lab, lebih mudah.</Text>
              <Text style={styles.brandDescription}>
                Ajukan peminjaman ruang dan peralatan laboratorium dalam satu portal untuk mahasiswa dan dosen.
              </Text>
            </View>

            <View style={styles.benefitList}>
              {benefits.map((benefit) => (
                <View key={benefit.code} style={styles.benefitItem}>
                  <View style={styles.benefitCode}>
                    <Text style={styles.benefitCodeText}>{benefit.code}</Text>
                  </View>
                  <View style={styles.benefitCopy}>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitDetail}>{benefit.detail}</Text>
                  </View>
                  <Text style={styles.benefitCheck}>+</Text>
                </View>
              ))}
            </View>

            <Text style={styles.brandFooter}>FILKOM  /  LAYANAN AKADEMIK</Text>
          </View>

          <View style={[styles.loginCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={styles.loginCardTop}>
              <View style={[styles.loginIcon, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.loginIconText, { color: theme.primary }]}>LS</Text>
              </View>
              <Text style={[styles.loginTag, { color: theme.primary }]}>AKUN INSTITUSI</Text>
            </View>
            <Text style={[styles.loginTitle, { color: theme.text }]}>Selamat datang</Text>
            <Text style={[styles.loginDescription, { color: theme.textSecondary }]}>
              Masuk untuk mengajukan atau mengelola peminjaman laboratorium.
            </Text>

            <Text style={[styles.label, { color: theme.text }]}>Email kampus</Text>
            <TextInput
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (error) setError('');
              }}
              placeholder="nama@kampus.ac.id"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
            />

            <View style={styles.passwordLabelRow}>
              <Text style={[styles.label, styles.passwordLabel, { color: theme.text }]}>Kata sandi</Text>
              <Text style={[styles.secureHint, { color: theme.textSecondary }]}>Akses aman</Text>
            </View>
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (error) setError('');
              }}
              placeholder="Masukkan kata sandi"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoComplete="password"
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
            />

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: `${theme.danger}14` }]}>
                <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={loading}
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.loginButton,
                { backgroundColor: theme.primary, opacity: loading || pressed ? 0.75 : 1 },
              ]}>
              <Text style={styles.loginButtonText}>{loading ? 'Memeriksa akun…' : 'Masuk ke LabSpace'}</Text>
              <Text style={styles.loginButtonArrow}>→</Text>
            </Pressable>

            <Text style={[styles.helpText, { color: theme.textSecondary }]}>
              Gunakan akun institusi yang terdaftar pada laboratorium.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  brandPanel: {
    flexGrow: 1,
    flexBasis: 390,
    minHeight: 590,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#12343A',
    padding: 32,
    justifyContent: 'space-between',
  },
  decorCircleLarge: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
    borderWidth: 1,
    borderColor: 'rgba(126, 224, 204, 0.15)',
    top: 125,
    right: -145,
  },
  decorCircleSmall: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(126, 224, 204, 0.12)',
    top: 180,
    right: -90,
  },
  brandTop: { gap: 25 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#A8E8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#12343A', fontSize: 26, fontWeight: '900' },
  brandName: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', letterSpacing: 0.3 },
  brandMeta: { color: '#9CC1BE', fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginTop: 2 },
  livePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A8E8D8' },
  liveText: { color: '#D5EBE5', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  brandCopy: { marginTop: 34, marginBottom: 28, maxWidth: 430 },
  brandEyebrow: { color: '#9ADBCB', fontSize: 11, fontWeight: '900', letterSpacing: 1.7, marginBottom: 12 },
  brandHeadline: { color: '#FFFFFF', fontSize: 36, lineHeight: 43, fontWeight: '900', letterSpacing: -0.5 },
  brandDescription: { color: '#BED3D0', fontSize: 15, lineHeight: 23, marginTop: 14, maxWidth: 400 },
  benefitList: { gap: 9 },
  benefitItem: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(211, 240, 233, 0.13)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  benefitCode: { width: 33, height: 33, borderRadius: 11, backgroundColor: 'rgba(168,232,216,0.16)', alignItems: 'center', justifyContent: 'center' },
  benefitCodeText: { color: '#A8E8D8', fontSize: 10, fontWeight: '900' },
  benefitCopy: { flex: 1 },
  benefitTitle: { color: '#F3FAF8', fontSize: 13, fontWeight: '800' },
  benefitDetail: { color: '#A6C0BD', fontSize: 11, marginTop: 2 },
  benefitCheck: { color: '#A8E8D8', fontSize: 20, fontWeight: '700' },
  brandFooter: { color: '#719490', fontSize: 9, fontWeight: '800', letterSpacing: 1.4, marginTop: 22 },
  loginCard: {
    flexGrow: 1,
    flexBasis: 360,
    maxWidth: 470,
    borderRadius: 30,
    padding: 32,
    borderWidth: 1,
    shadowColor: '#183B3A',
    shadowOpacity: 0.08,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 3,
  },
  loginCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  loginIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  loginIconText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  loginTag: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  loginTitle: { fontSize: 29, lineHeight: 36, fontWeight: '900', letterSpacing: -0.4 },
  loginDescription: { marginTop: 7, marginBottom: 30, fontSize: 14, lineHeight: 21 },
  label: { marginBottom: 9, fontSize: 13, fontWeight: '800' },
  passwordLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passwordLabel: { marginBottom: 9 },
  secureHint: { fontSize: 11, marginBottom: 9 },
  input: { height: 54, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, marginBottom: 21, fontSize: 14 },
  errorBox: { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 14 },
  errorText: { fontSize: 13, lineHeight: 19 },
  loginButton: {
    minHeight: 55,
    borderRadius: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  loginButtonArrow: { color: '#FFFFFF', fontSize: 21, fontWeight: '500' },
  helpText: { textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 18 },
});
