import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHydrated } from '@/hooks/use-hydrated';
import { useTheme } from '@/hooks/use-theme';
import { setAuthToken } from '@/lib/api';

const roleNames: Record<string, string> = {
  mahasiswa: 'Mahasiswa',
  dosen: 'Dosen',
  kepala_lab: 'Kepala Laboratorium',
  laboran: 'Laboran',
};

const menuDetails: Record<string, { code: string; description: string; tint: string }> = {
  'Ketersediaan Ruang': { code: 'RL', description: 'Lihat ruang lab dan jadwal yang tersedia.', tint: '#DDF3EF' },
  'Ketersediaan Alat': { code: 'AL', description: 'Periksa ketersediaan dan detail peralatan.', tint: '#E8EEFF' },
  'Ajukan Peminjaman': { code: '+', description: 'Ajukan peminjaman ruang atau inventaris lab.', tint: '#FFF0D8' },
  'Status Pengajuan': { code: 'ST', description: 'Pantau proses dan keputusan pengajuanmu.', tint: '#E9E5FA' },
  'Riwayat Peminjaman': { code: 'RJ', description: 'Tinjau peminjaman yang pernah dilakukan.', tint: '#E2F0FA' },
  'Permohonan Peminjaman': { code: 'PS', description: 'Tinjau dan proses permintaan peminjaman.', tint: '#FFF0D8' },
  'Persetujuan Khusus': { code: 'PK', description: 'Proses persetujuan untuk peminjaman alat khusus.', tint: '#E9E5FA' },
  'Serah Terima Alat': { code: 'ST', description: 'Catat serah terima alat yang sudah disetujui.', tint: '#E2F0FA' },
  'Pengembalian & Pemeriksaan': { code: 'KB', description: 'Catat pengembalian dan kondisi peralatan.', tint: '#DDF3EF' },
  'Kelola Ruang': { code: 'RG', description: 'Atur data ruang dan jadwal laboratorium.', tint: '#E8EEFF' },
  'Kelola Alat': { code: 'PR', description: 'Kelola inventaris dan kondisi peralatan.', tint: '#E9E5FA' },
  'Laporan Bulanan': { code: 'LP', description: 'Lihat ringkasan aktivitas peminjaman lab.', tint: '#DDF3EF' },
};

export default function DashboardScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ role?: string; name?: string }>();
  const paramsReady = useHydrated();
  const role = paramsReady ? String(params.role || 'mahasiswa') : 'mahasiswa';
  const displayName = paramsReady
    ? String(params.name || roleNames[role] || 'Pengguna')
    : roleNames.mahasiswa;
  const firstName = displayName.split(' ')[0];
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const menus: string[] =
    role === 'mahasiswa'
      ? ['Ketersediaan Ruang', 'Ketersediaan Alat', 'Ajukan Peminjaman', 'Status Pengajuan', 'Riwayat Peminjaman']
      : role === 'dosen'
        ? ['Ketersediaan Ruang', 'Ketersediaan Alat', 'Ajukan Peminjaman', 'Status Pengajuan', 'Riwayat Peminjaman']
        : role === 'laboran'
          ? ['Permohonan Peminjaman', 'Serah Terima Alat', 'Pengembalian & Pemeriksaan', 'Kelola Ruang', 'Kelola Alat', 'Laporan Bulanan']
          : ['Permohonan Peminjaman', 'Persetujuan Khusus', 'Serah Terima Alat', 'Pengembalian & Pemeriksaan', 'Kelola Ruang', 'Kelola Alat', 'Laporan Bulanan'];

  function openMenu(menu: string) {
    router.push({ pathname: '/feature', params: { title: menu, role } });
  }

  function logout() {
    setAuthToken(null);
    router.replace('/');
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.brandLockup}>
            <View style={[styles.brandMark, { backgroundColor: theme.primary }]}>
              <Text style={styles.brandMarkText}>L</Text>
            </View>
            <View>
              <Text style={[styles.brandName, { color: theme.text }]}>LabSpace</Text>
              <Text style={[styles.brandSub, { color: theme.textSecondary }]}>PORTAL LABORATORIUM</Text>
            </View>
          </View>
          <View style={styles.userActions}>
            <View style={[styles.userChip, { backgroundColor: theme.background }]}>
              <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.avatarText, { color: theme.primary }]}>{initials || 'LS'}</Text>
              </View>
              <View style={styles.userCopy}>
                <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
                <Text style={[styles.userRole, { color: theme.textSecondary }]}>{roleNames[role] || role}</Text>
              </View>
            </View>
            <Pressable
              onPress={logout}
              style={({ pressed }) => [
                styles.logoutButton,
                { borderColor: theme.border, opacity: pressed ? 0.65 : 1 },
              ]}>
              <Text style={[styles.logoutText, { color: theme.text }]}>Keluar</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.mainContent}>
          <View style={styles.heroCard}>
            <View style={styles.heroDecorLarge} />
            <View style={styles.heroDecorSmall} />
            <View style={styles.heroCopy}>
              <View style={styles.heroEyebrowRow}>
                <View style={styles.heroEyebrowDot} />
                <Text style={styles.heroEyebrow}>LAYANAN LAB TERPADU</Text>
              </View>
              <Text style={styles.heroTitle}>Halo, {firstName}.</Text>
              <Text style={styles.heroDescription}>
                Temukan ruang dan peralatan yang kamu butuhkan untuk kegiatan laboratorium.
              </Text>
              <View style={styles.heroTags}>
                <View style={styles.heroTag}><Text style={styles.heroTagText}>RUANG LAB</Text></View>
                <View style={styles.heroTag}><Text style={styles.heroTagText}>INVENTARIS</Text></View>
                <View style={styles.heroTag}><Text style={styles.heroTagText}>PEMINJAMAN</Text></View>
              </View>
            </View>
            <View style={styles.heroVisual}>
              <View style={styles.heroVisualOrbit} />
              <View style={styles.heroVisualCard}>
                <View style={styles.heroVisualTop}>
                  <View style={styles.heroVisualDot} />
                  <Text style={styles.heroVisualLabel}>LABSPACE</Text>
                </View>
                <View style={styles.heroVisualIcon}><Text style={styles.heroVisualIconText}>L</Text></View>
                <Text style={styles.heroVisualCaption}>RUANG & PERALATAN</Text>
                <Text style={styles.heroVisualSubcaption}>Satu portal, semua kebutuhan.</Text>
              </View>
              <View style={styles.heroFloatingCard}>
                <Text style={styles.heroFloatingCheck}>✓</Text>
                <Text style={styles.heroFloatingText}>Mudah diajukan</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: theme.primary }]}>MENU UTAMA</Text>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Apa yang ingin kamu lakukan?</Text>
            </View>
            <Text style={[styles.menuCount, { color: theme.textSecondary }]}>{menus.length} layanan</Text>
          </View>

          <View style={styles.menuGrid}>
            {menus.map((menu) => {
              const details = menuDetails[menu] || { code: 'LB', description: 'Buka layanan laboratorium.', tint: theme.primarySoft };
              return (
                <Pressable
                  key={menu}
                  onPress={() => openMenu(menu)}
                  style={({ pressed }) => [
                    styles.menuCard,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <View style={styles.menuCardTop}>
                    <View style={[styles.menuIcon, { backgroundColor: details.tint }]}>
                      <Text style={[styles.menuIconText, { color: theme.text }]}>{details.code}</Text>
                    </View>
                    <Text style={[styles.menuArrow, { color: theme.primary }]}>↗</Text>
                  </View>
                  <Text style={[styles.menuTitle, { color: theme.text }]}>{menu}</Text>
                  <Text style={[styles.menuDescription, { color: theme.textSecondary }]}>{details.description}</Text>
                  <Text style={[styles.menuAction, { color: theme.primary }]}>BUKA LAYANAN <Text style={styles.menuActionArrow}>→</Text></Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              LabSpace · Portal Peminjaman Laboratorium
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 26 },
  topBar: {
    width: '100%',
    maxWidth: 1120,
    minHeight: 76,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1,
  },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  brandName: { fontSize: 16, fontWeight: '900', letterSpacing: 0.1 },
  brandSub: { fontSize: 8, fontWeight: '800', letterSpacing: 1.1, marginTop: 2 },
  userActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 5, paddingRight: 13, gap: 9, maxWidth: 230 },
  avatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '900' },
  userCopy: { flexShrink: 1 },
  userName: { fontSize: 12, fontWeight: '800' },
  userRole: { fontSize: 10, marginTop: 2 },
  logoutButton: { height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  logoutText: { fontSize: 12, fontWeight: '800' },
  mainContent: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  heroCard: {
    marginTop: 22,
    minHeight: 274,
    borderRadius: 28,
    backgroundColor: '#12343A',
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 30,
    gap: 20,
  },
  heroDecorLarge: { position: 'absolute', width: 360, height: 360, borderRadius: 180, borderWidth: 1, borderColor: 'rgba(168,232,216,0.12)', top: -215, right: -25 },
  heroDecorSmall: { position: 'absolute', width: 250, height: 250, borderRadius: 125, borderWidth: 1, borderColor: 'rgba(168,232,216,0.11)', top: -150, right: 30 },
  heroCopy: { flexGrow: 1, flexBasis: 350, maxWidth: 650 },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroEyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A8E8D8' },
  heroEyebrow: { color: '#A8E8D8', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 34, lineHeight: 41, fontWeight: '900', letterSpacing: -0.5, marginTop: 13 },
  heroDescription: { color: '#BED3D0', fontSize: 14, lineHeight: 22, maxWidth: 500, marginTop: 9 },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 },
  heroTag: { borderWidth: 1, borderColor: 'rgba(211,240,233,0.18)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroTagText: { color: '#D8E9E4', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  heroVisual: { width: 235, height: 205, alignItems: 'center', justifyContent: 'center' },
  heroVisualOrbit: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: 'rgba(168,232,216,0.19)' },
  heroVisualCard: { width: 174, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 15 },
  heroVisualTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroVisualDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A8E8D8' },
  heroVisualLabel: { color: '#C8DCD7', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  heroVisualIcon: { width: 53, height: 53, borderRadius: 17, backgroundColor: '#A8E8D8', alignItems: 'center', justifyContent: 'center', marginTop: 14, marginBottom: 12 },
  heroVisualIconText: { color: '#12343A', fontSize: 29, fontWeight: '900' },
  heroVisualCaption: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  heroVisualSubcaption: { color: '#B6CFCA', fontSize: 9, marginTop: 4 },
  heroFloatingCard: { position: 'absolute', bottom: 4, right: -2, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 3 },
  heroFloatingCheck: { color: '#087F73', fontSize: 13, fontWeight: '900' },
  heroFloatingText: { color: '#18373A', fontSize: 9, fontWeight: '800' },
  sectionHeading: { marginTop: 32, marginBottom: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  sectionEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  sectionTitle: { fontSize: 21, lineHeight: 28, fontWeight: '900', letterSpacing: -0.2 },
  menuCount: { fontSize: 11, fontWeight: '700', marginBottom: 3 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  menuCard: {
    flexGrow: 1,
    flexBasis: 225,
    minHeight: 190,
    borderRadius: 21,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#183B3A',
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  menuCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  menuIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  menuIconText: { fontSize: 12, fontWeight: '900' },
  menuArrow: { fontSize: 18, fontWeight: '500' },
  menuTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  menuDescription: { minHeight: 34, fontSize: 11, lineHeight: 17, marginTop: 6 },
  menuAction: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 15 },
  menuActionArrow: { fontSize: 11 },
  footer: { alignItems: 'center', paddingVertical: 25 },
  footerText: { fontSize: 10, fontWeight: '600' },
});
