import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setAuthToken } from '@/lib/api';

const borrowerMenus = [
    'Ketersediaan Ruang',
    'Ketersediaan Alat',
    'Ajukan Peminjaman',
    'Status Pengajuan',
    'Riwayat Peminjaman',
];

const staffMenus = [
    'Permohonan Peminjaman',
    'Persetujuan Khusus',
    'Serah Terima Alat',
    'Pengembalian & Pemeriksaan',
    'Kelola Ruang',
    'Kelola Alat',
    'Laporan Bulanan',
];

export default function DashboardScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ role?: string; name?: string }>();
  const role = params.role || 'MAHASISWA';
  const accountType = ['MAHASISWA', 'DOSEN'].includes(role) ? 'Peminjam' : 'Admin';
  const menuItems = role === 'DOSEN_PENGAMPU'
    ? ['Persetujuan Khusus']
    : role === 'KEPALA_LABORATORIUM'
      ? staffMenus.filter((item) => !['Permohonan Peminjaman', 'Persetujuan Khusus', 'Serah Terima Alat', 'Pengembalian & Pemeriksaan'].includes(item))
      : role === 'LABORAN'
        ? staffMenus.filter((item) => item !== 'Persetujuan Khusus')
        : borrowerMenus;
  const displayName = typeof params.name === 'string' ? params.name : accountType;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>Selamat datang kembali</Text>
            <Text style={[styles.roleName, { color: theme.text }]}>{displayName}</Text>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>{role.replace(/_/g, ' ')}</Text>
          </View>
          <Pressable
            onPress={() => {
              setAuthToken(null);
              router.replace('/');
            }}
            style={[styles.logoutButton, { borderColor: theme.border }]}>
            <Text style={[styles.logoutText, { color: theme.primary }]}>Keluar</Text>
          </Pressable>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.primary }]}>
          <Text style={styles.summaryLabel}>OASIS • FILKOM</Text>
          <Text style={styles.summaryTitle}>Kelola ruang dan inventaris laboratorium dalam satu tempat.</Text>
          <Text style={styles.summaryCaption}>Pilih layanan untuk melihat data terbaru dan melakukan tindakan.</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Menu Utama</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item, index) => (
            <Pressable
              key={item}
              onPress={() =>
                router.push({
                  pathname: '/feature',
                  params: { title: item, accountType, role },
                })
              }
              style={({ pressed }) => [
                styles.menuCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}>
              {({ pressed }) => (
                <>
                  <View style={[styles.menuNumber, { backgroundColor: theme.primarySoft }]}>
                    <Text style={[styles.menuNumberText, { color: theme.primary }]}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    {item}
                  </Text>
                  <Text style={[styles.menuArrow, { color: theme.primary }]}>›</Text>
                </>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  greeting: {
    fontSize: 13,
  },
  roleName: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: '800',
  },
  logoutButton: {
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryCard: {
    borderRadius: 18,
    padding: Spacing.four,
    marginBottom: Spacing.five,
    minHeight: 160,
    justifyContent: 'center',
  },
  summaryLabel: {
    color: '#D9E7FA',
    fontSize: 13,
    marginBottom: Spacing.one,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
  },
  summaryCaption: {
    color: '#D9E7FA',
    fontSize: 13,
    lineHeight: 20,
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: Spacing.three,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  menuCard: {
    minHeight: 68,
    flexGrow: 1,
    flexBasis: 280,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuNumber: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  menuNumberText: {
    fontSize: 14,
    fontWeight: '800',
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  menuArrow: {
    fontSize: 28,
    marginLeft: Spacing.two,
  },
});
