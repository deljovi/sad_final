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

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiRequest, setAuthToken } from '@/lib/api';

type LoginResponse = {
  token: string;
  user: { name: string; email: string; role: string };
};

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
        params: { role: result.user.role, name: result.user.name },
      });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Tidak dapat masuk ke OASIS.');
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
            <View style={[styles.logoMark, { backgroundColor: theme.primary }]}>
              <Text style={styles.logoText}>O</Text>
            </View>
            <Text style={[styles.brandName, { color: theme.text }]}>OASIS</Text>
            <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
              Online Academic Space and Inventory System
            </Text>
          </View>

          <View style={[styles.loginCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.loginTitle, { color: theme.text }]}>Masuk ke OASIS</Text>
            <Text style={[styles.loginDescription, { color: theme.textSecondary }]}>
              Masuk dengan akun institusi Anda untuk mengelola ruang dan inventaris laboratorium.
            </Text>

            <Text style={[styles.label, { color: theme.text }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (error) setError('');
              }}
              placeholder="nama@unklab.ac.id"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
            />

            <Text style={[styles.label, { color: theme.text }]}>Kata sandi</Text>
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
              <Text style={styles.loginButtonText}>{loading ? 'Memeriksa akun…' : 'Masuk'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  brandPanel: {
    alignItems: 'center',
    marginBottom: Spacing.five,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
  },
  brandName: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: 2,
  },
  brandSubtitle: {
    marginTop: Spacing.one,
    maxWidth: 330,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  loginCard: {
    width: '100%',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#D8E0EA',
  },
  loginTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  loginDescription: {
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
    fontSize: 14,
  },
  label: {
    marginBottom: Spacing.two,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: Spacing.three,
  },
  errorBox: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.two,
  },
  errorText: {
    fontSize: 13,
  },
  loginButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
