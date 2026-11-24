import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useHydrated } from '@/hooks/use-hydrated';
import { useTheme } from '@/hooks/use-theme';
import { apiRequest } from '@/lib/api';

type Room = { id: number; name: string; capacity: number | null; active: boolean };
type Equipment = {
  id: number;
  name: string;
  category: 'BIASA' | 'KHUSUS';
  description: string | null;
  total_units: number | string;
  available_units: number | string | null;
};
type Unit = {
  id: number;
  unit_code: string;
  equipment_type_id: number;
  equipment_name: string;
  category: 'BIASA' | 'KHUSUS';
  condition_status: string;
  availability_status: string;
};
type LoanItem = {
  unit_id: number;
  unit_code: string;
  equipment_name: string;
  returned_at: string | null;
  return_condition: string | null;
};
type Loan = {
  id: number;
  purpose: string;
  start_date: string;
  due_date: string;
  status: string;
  loan_type: string;
  borrower_name?: string;
  borrower_email?: string;
  applicant_name?: string;
  applicant_email?: string;
  items: LoanItem[] | string | null;
};
type Booking = {
  id: number;
  room_name: string;
  borrower_name?: string | null;
  borrower_email?: string | null;
  applicant_name?: string | null;
  applicant_email?: string | null;
  start_at: string;
  end_at: string;
  purpose: string;
  status: string;
};
type Report = {
  period: { month: number; year: number };
  room_loans: number;
  equipment_loans: number;
  equipment: { available: number; reserved: number; borrowed: number; damaged: number; lost: number };
};
const statusNames: Record<string, string> = {
  MENUNGGU: 'Menunggu',
  MENUNGGU_DOSEN: 'Menunggu persetujuan dosen',
  MENUNGGU_LABORAN: 'Menunggu laboran',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak',
  SEDANG_DIPINJAM: 'Sedang dipinjam',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
  TERSEDIA: 'Tersedia',
  DIPINJAM: 'Dipinjam',
  DIPESAN: 'Dipesan',
  TIDAK_TERSEDIA: 'Tidak tersedia',
  BAIK: 'Baik',
  RUSAK: 'Rusak',
  HILANG: 'Hilang',
  PERLU_PERBAIKAN: 'Perlu perbaikan',
};

const roleNames: Record<string, string> = {
  kepala_lab: 'Kepala Laboratorium',
  laboran: 'Laboran',
};

const featureDescriptions: Record<string, string> = {
  'Ketersediaan Ruang': 'Temukan ruang laboratorium dan lihat jadwal pemakaiannya.',
  'Ketersediaan Alat': 'Periksa inventaris serta jumlah unit yang tersedia.',
  'Ajukan Peminjaman': 'Kirim permohonan ruang atau peralatan untuk kegiatan lab.',
  'Status Pengajuan': 'Pantau perkembangan permohonan peminjamanmu.',
  'Riwayat Peminjaman': 'Lihat kembali pengajuan dan peminjaman sebelumnya.',
  'Permohonan Ruang': 'Catat dan proses permohonan ruang atas nama calon peminjam.',
  'Permohonan Alat': 'Catat dan proses permohonan alat atas nama calon peminjam.',
  'Permohonan Peminjaman': 'Tinjau permohonan ruang dan peralatan dari pengguna.',
  'Persetujuan Khusus': 'Tinjau permohonan peminjaman peralatan khusus.',
  'Serah Terima Alat': 'Catat penyerahan alat yang telah disetujui.',
  'Pengembalian & Pemeriksaan': 'Catat pengembalian dan kondisi peralatan lab.',
  'Kelola Ruang': 'Atur daftar ruang dan status ketersediaan laboratorium.',
  'Kelola Alat': 'Kelola inventaris, unit, dan kondisi peralatan.',
  'Laporan Bulanan': 'Pantau ringkasan aktivitas laboratorium setiap bulan.',
};

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function parseItems(items: Loan['items']): LoanItem[] {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      return JSON.parse(items) as LoanItem[];
    } catch {
      return [];
    }
  }
  return [];
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function FeatureScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ title?: string; role?: string }>();
  const paramsReady = useHydrated();
  const title = paramsReady ? params.title || 'Layanan Laboratorium' : 'Layanan Laboratorium';
  const role = paramsReady ? String(params.role || '') : '';
  const roleLabel = roleNames[role] || role.replace(/_/g, ' ');
  const description = featureDescriptions[title] || 'Kelola layanan peminjaman laboratorium.';
  const [rooms, setRooms] = useState<Room[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [roomFrequency, setRoomFrequency] = useState<{ name: string; usage_count: number }[]>([]);
  const [equipmentFrequency, setEquipmentFrequency] = useState<{ name: string; usage_count: number }[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerEmail, setBorrowerEmail] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');
  const [loanStart, setLoanStart] = useState('');
  const [loanEnd, setLoanEnd] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [equipmentCategory, setEquipmentCategory] = useState<'BIASA' | 'KHUSUS'>('BIASA');
  const [equipmentDescription, setEquipmentDescription] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const needsRooms = [
        'Ketersediaan Ruang',
        'Ajukan Peminjaman',
        'Permohonan Ruang',
        'Permohonan Peminjaman',
        'Status Pengajuan',
        'Riwayat Peminjaman',
        'Kelola Ruang',
      ].includes(title);
      const needsEquipment = [
        'Ketersediaan Alat',
        'Ajukan Peminjaman',
        'Permohonan Alat',
        'Permohonan Peminjaman',
        'Kelola Alat',
      ].includes(title);

      const tasks: Promise<void>[] = [];
      if (needsRooms) {
        tasks.push(
          apiRequest<Room[]>('/rooms').then(setRooms),
          apiRequest<Booking[]>('/rooms/bookings').then(setBookings),
        );
      }
      if (needsEquipment) tasks.push(apiRequest<Equipment[]>('/equipment').then(setEquipment));
      if (['Ajukan Peminjaman', 'Permohonan Alat', 'Permohonan Peminjaman', 'Kelola Alat'].includes(title)) {
        const availableOnly = title !== 'Kelola Alat';
        tasks.push(apiRequest<Unit[]>(`/equipment/units${availableOnly ? '?available=true' : ''}`).then(setUnits));
      }
      if (['Status Pengajuan', 'Riwayat Peminjaman'].includes(title)) {
        tasks.push(apiRequest<Loan[]>('/loans/my').then(setLoans));
      }
      if (['Permohonan Alat', 'Permohonan Peminjaman', 'Persetujuan Khusus', 'Serah Terima Alat', 'Pengembalian & Pemeriksaan'].includes(title)) {
        tasks.push(apiRequest<Loan[]>('/approvals').then(setLoans));
      }
      if (title === 'Laporan Bulanan') {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        tasks.push(
          apiRequest<Report>(`/reports/monthly?month=${month}&year=${year}`).then(setReport),
          apiRequest<{ name: string; usage_count: number }[]>('/reports/room-frequency').then(setRoomFrequency),
          apiRequest<{ name: string; usage_count: number }[]>('/reports/equipment-frequency').then(setEquipmentFrequency),
        );
      }
      await Promise.all(tasks);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Data tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [title]);

  useEffect(() => {
    if (!paramsReady) return;
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData, paramsReady]);

  async function perform(action: () => Promise<unknown>, successMessage: string): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      showMessage('Berhasil', successMessage);
      await loadData();
      return true;
    } catch (actionError) {
      showMessage('Tindakan gagal', actionError instanceof Error ? actionError.message : 'Terjadi kesalahan.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitRoomBooking() {
    if (!borrowerName.trim() || !borrowerEmail.trim() || !selectedRoom || !bookingDate || !startTime || !endTime || !purpose.trim()) {
      showMessage('Form belum lengkap', 'Isi nama dan email peminjam, pilih ruang, lalu lengkapi jadwal dan tujuan.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(borrowerEmail.trim())) {
      showMessage('Email tidak valid', 'Masukkan email calon peminjam yang benar.');
      return;
    }
    const start = new Date(`${bookingDate}T${startTime}:00`);
    const end = new Date(`${bookingDate}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      showMessage('Waktu tidak valid', 'Pastikan tanggal dan rentang waktu yang dimasukkan valid.');
      return;
    }
    const succeeded = await perform(
      () => apiRequest(`/rooms/${selectedRoom}/bookings`, {
        method: 'POST',
        body: {
          borrower_name: borrowerName.trim(),
          borrower_email: borrowerEmail.trim(),
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          purpose: purpose.trim(),
        },
      }),
      'Pengajuan ruang telah dikirim.',
    );
    if (succeeded) {
      setBorrowerName('');
      setBorrowerEmail('');
      setPurpose('');
    }
  }

  async function submitEquipmentLoan() {
    if (!borrowerName.trim() || !borrowerEmail.trim() || !loanStart || !loanEnd || !loanPurpose.trim() || selectedUnits.length === 0) {
      showMessage('Form belum lengkap', 'Isi nama dan email peminjam, pilih minimal satu alat, lalu lengkapi tanggal dan tujuan.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(borrowerEmail.trim())) {
      showMessage('Email tidak valid', 'Masukkan email calon peminjam yang benar.');
      return;
    }
    const succeeded = await perform(
      () => apiRequest('/loans/equipment', {
        method: 'POST',
        body: {
          borrower_name: borrowerName.trim(),
          borrower_email: borrowerEmail.trim(),
          start_date: loanStart,
          due_date: loanEnd,
          purpose: loanPurpose.trim(),
          items: selectedUnits.map((unit_id) => ({ unit_id })),
        },
      }),
      'Pengajuan alat telah dikirim.',
    );
    if (succeeded) {
      setBorrowerName('');
      setBorrowerEmail('');
      setLoanPurpose('');
      setSelectedUnits([]);
    }
  }

  const cardStyle = { backgroundColor: theme.backgroundElement, borderColor: theme.border };
  const buttonStyle = { backgroundColor: theme.primary, opacity: busy ? 0.6 : 1 };

  function field({ label, value, onChange, placeholder, type = 'default' }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    type?: 'default' | 'numeric' | 'date' | 'time';
  }) {
    return (
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType={type === 'numeric' ? 'numeric' : 'default'}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
        />
      </View>
    );
  }

  function button({ label, onPress, secondary = false, disabled = false }: {
    label: string;
    onPress: () => void;
    secondary?: boolean;
    disabled?: boolean;
  }) {
    return (
      <Pressable
        disabled={busy || disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          secondary
            ? { borderWidth: 1, borderColor: theme.primary, backgroundColor: theme.backgroundElement }
            : buttonStyle,
          { opacity: busy || disabled ? 0.55 : pressed ? 0.78 : 1 },
        ]}>
        <Text style={[styles.buttonText, secondary && { color: theme.primary }]}>{label}</Text>
      </Pressable>
    );
  }

  function badge({ value }: { value: string }) {
    const bad = ['DITOLAK', 'RUSAK', 'HILANG', 'TIDAK_TERSEDIA', 'PERLU_PERBAIKAN'].includes(value);
    const good = ['DISETUJUI', 'SELESAI', 'TERSEDIA', 'BAIK'].includes(value);
    const color = bad ? theme.danger : good ? theme.success : '#9A6700';
    return (
      <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
        <Text style={[styles.badgeText, { color }]}>{statusNames[value] || value}</Text>
      </View>
    );
  }

  function empty({ message = 'Belum ada data untuk ditampilkan.' }: { message?: string } = {}) {
    return (
      <View style={[styles.emptyCard, cardStyle]}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{message}</Text>
      </View>
    );
  }

  function roomList({ management = false }: { management?: boolean } = {}) {
    if (!rooms.length) return empty({ message: 'Belum ada ruang aktif. Tambahkan ruang melalui menu Kelola Ruang.' });
    return (
      <View style={styles.stack}>
        {rooms.map((room) => (
          <View key={room.id} style={[styles.card, cardStyle]}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{room.name}</Text>
                <Text style={[styles.secondary, { color: theme.textSecondary }]}>
                  Kapasitas {room.capacity ?? '—'} orang
                </Text>
              </View>
              {badge({ value: room.active ? 'TERSEDIA' : 'TIDAK_TERSEDIA' })}
            </View>
            {management && button({
                secondary: true,
                label: room.active ? 'Nonaktifkan ruang' : 'Aktifkan ruang',
                onPress: () => perform(
                  () => apiRequest(`/rooms/${room.id}/status`, { method: 'PATCH', body: { active: !room.active } }),
                  'Status ruang diperbarui.',
                ),
              })}
          </View>
        ))}
      </View>
    );
  }

  function equipmentList({ management = false }: { management?: boolean } = {}) {
    if (!equipment.length) return empty({ message: 'Belum ada data inventaris alat.' });
    return (
      <View style={styles.stack}>
        {equipment.map((item) => (
          <View key={item.id} style={[styles.card, cardStyle]}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.secondary, { color: theme.textSecondary }]}>
                  {item.category === 'KHUSUS' ? 'Khusus • perlu persetujuan dosen' : 'Alat biasa'}
                </Text>
              </View>
              {badge({ value: Number(item.available_units) > 0 ? 'TERSEDIA' : 'TIDAK_TERSEDIA' })}
            </View>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>
              {Number(item.available_units || 0)} dari {Number(item.total_units || 0)} unit tersedia
            </Text>
            {item.description ? <Text style={[styles.detail, { color: theme.textSecondary }]}>{item.description}</Text> : null}
            {management && units.filter((unit) => unit.equipment_type_id === item.id).map((unit) => (
              <View key={unit.id} style={[styles.unitRow, { borderTopColor: theme.border }]}>
                <Text style={[styles.secondary, { color: theme.text }]}>{unit.unit_code}</Text>
                {badge({ value: unit.condition_status })}
                {badge({ value: unit.availability_status })}
                <Pressable
                  accessibilityRole="button"
                  disabled={['DIPINJAM', 'DIPESAN'].includes(unit.availability_status)}
                  onPress={() => perform(
                    () => apiRequest(`/equipment/units/${unit.id}/status`, {
                      method: 'PATCH',
                      body: unit.condition_status === 'BAIK' && unit.availability_status === 'TERSEDIA'
                        ? { condition_status: 'RUSAK', availability_status: 'TIDAK_TERSEDIA' }
                        : { condition_status: 'BAIK', availability_status: 'TERSEDIA' },
                    }),
                    'Status unit diperbarui.',
                  )}>
                  <Text style={[styles.link, { color: ['DIPINJAM', 'DIPESAN'].includes(unit.availability_status) ? theme.textSecondary : theme.primary }]}>
                    {unit.availability_status === 'DIPINJAM'
                      ? 'Sedang dipinjam'
                      : unit.availability_status === 'DIPESAN'
                        ? 'Dipesan oleh permohonan'
                      : unit.condition_status === 'BAIK' && unit.availability_status === 'TERSEDIA'
                        ? 'Tandai rusak'
                        : 'Pulihkan unit'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  function roomBookingForm() {
    const activeRooms = rooms.filter((room) => room.active);
    return (
      <View style={[styles.formCard, cardStyle]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Catat permohonan ruang</Text>
        <Text style={[styles.secondary, { color: theme.textSecondary }]}>Masukkan identitas calon peminjam.</Text>
        {field({ label: 'Nama calon peminjam', value: borrowerName, onChange: setBorrowerName, placeholder: 'Nama lengkap' })}
        {field({ label: 'Email calon peminjam', value: borrowerEmail, onChange: setBorrowerEmail, placeholder: 'nama@kampus.ac.id' })}
        <View style={styles.chipRow}>
          {activeRooms.map((room) => (
            <Pressable
              key={room.id}
              onPress={() => setSelectedRoom(room.id)}
              style={[styles.chip, { borderColor: selectedRoom === room.id ? theme.primary : theme.border, backgroundColor: selectedRoom === room.id ? theme.primarySoft : theme.background }]}>
              <Text style={{ color: selectedRoom === room.id ? theme.primary : theme.text }}>{room.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.formGrid}>
          {field({ label: 'Tanggal', value: bookingDate, onChange: setBookingDate, placeholder: 'YYYY-MM-DD', type: 'date' })}
          {field({ label: 'Mulai', value: startTime, onChange: setStartTime, placeholder: '13:00', type: 'time' })}
          {field({ label: 'Selesai', value: endTime, onChange: setEndTime, placeholder: '15:00', type: 'time' })}
        </View>
        {field({ label: 'Tujuan peminjaman', value: purpose, onChange: setPurpose, placeholder: 'Contoh: diskusi tugas' })}
        {button({ label: 'Kirim pengajuan ruang', onPress: submitRoomBooking, disabled: !activeRooms.length })}
      </View>
    );
  }

  function equipmentLoanForm() {
    const availableUnits = units.filter((unit) => unit.availability_status === 'TERSEDIA' && unit.condition_status === 'BAIK');
    return (
      <View style={[styles.formCard, cardStyle]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Catat permohonan alat</Text>
        <Text style={[styles.secondary, { color: theme.textSecondary }]}>Masukkan identitas calon peminjam.</Text>
        {field({ label: 'Nama calon peminjam', value: borrowerName, onChange: setBorrowerName, placeholder: 'Nama lengkap' })}
        {field({ label: 'Email calon peminjam', value: borrowerEmail, onChange: setBorrowerEmail, placeholder: 'nama@kampus.ac.id' })}
        <Text style={[styles.secondary, { color: theme.textSecondary }]}>Pilih satu atau beberapa unit yang tersedia.</Text>
        <View style={styles.chipRow}>
          {availableUnits.map((unit) => {
            const selected = selectedUnits.includes(unit.id);
            return (
              <Pressable
                key={unit.id}
                onPress={() => setSelectedUnits((current) => selected ? current.filter((id) => id !== unit.id) : [...current, unit.id])}
                style={[styles.chip, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primarySoft : theme.background }]}>
                <Text style={{ color: selected ? theme.primary : theme.text }}>{unit.equipment_name} · {unit.unit_code}</Text>
              </Pressable>
            );
          })}
        </View>
        {!availableUnits.length && (
          <View>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>
              Belum ada unit tersedia. Tambahkan inventaris dan kode unit melalui menu Kelola Alat.
            </Text>
            {button({
              label: 'Buka Kelola Alat',
              secondary: true,
              onPress: () => router.push({ pathname: '/feature', params: { title: 'Kelola Alat', role } }),
            })}
          </View>
        )}
        <View style={styles.formGrid}>
          {field({ label: 'Tanggal pinjam', value: loanStart, onChange: setLoanStart, placeholder: 'YYYY-MM-DD', type: 'date' })}
          {field({ label: 'Tanggal kembali', value: loanEnd, onChange: setLoanEnd, placeholder: 'YYYY-MM-DD', type: 'date' })}
        </View>
        {field({ label: 'Tujuan peminjaman', value: loanPurpose, onChange: setLoanPurpose, placeholder: 'Contoh: praktikum jaringan' })}
        {button({ label: 'Kirim pengajuan alat', onPress: submitEquipmentLoan, disabled: !availableUnits.length })}
      </View>
    );
  }

  function bookingList({ admin = false }: { admin?: boolean } = {}) {
    const visible = bookings.filter((booking) => !admin || booking.status === 'MENUNGGU');
    if (!visible.length) return empty();
    return (
      <View style={styles.stack}>
        {visible.map((booking) => (
          <View key={booking.id} style={[styles.card, cardStyle]}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{booking.room_name}</Text>
                <Text style={[styles.secondary, { color: theme.textSecondary }]}>
                  {booking.applicant_name || booking.borrower_name || 'Calon peminjam'}
                  {(booking.applicant_email || booking.borrower_email) ? ` · ${booking.applicant_email || booking.borrower_email}` : ''}
                  {' · '}{formatDate(booking.start_at)}
                </Text>
              </View>
              {badge({ value: booking.status })}
            </View>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>{booking.purpose}</Text>
            {admin && (
              <>
                {field({ label: 'Alasan penolakan (jika diperlukan)', value: rejectionNote, onChange: setRejectionNote, placeholder: 'Tuliskan alasan penolakan' })}
                <View style={styles.actionRow}>
                {button({ label: 'Setujui', onPress: () => perform(
                  () => apiRequest(`/approvals/room/${booking.id}`, { method: 'PATCH', body: { decision: 'DISETUJUI' } }),
                  'Pengajuan ruang disetujui.',
                ) })}
                {button({ secondary: true, label: 'Tolak', onPress: () => {
                  if (!rejectionNote.trim()) return showMessage('Alasan diperlukan', 'Tuliskan alasan penolakan terlebih dahulu.');
                  perform(
                    () => apiRequest(`/approvals/room/${booking.id}`, { method: 'PATCH', body: { decision: 'DITOLAK', rejection_reason: rejectionNote.trim() } }),
                    'Pengajuan ruang ditolak.',
                  );
                } })}
                </View>
              </>
            )}
          </View>
        ))}
      </View>
    );
  }

  function loanList({ admin = false, specialOnly = false }: { admin?: boolean; specialOnly?: boolean } = {}) {
    const visible = loans.filter((loan) =>
      (!specialOnly || (loan.loan_type === 'KHUSUS' && loan.status === 'MENUNGGU_DOSEN'))
      && (!admin || ['MENUNGGU_LABORAN', 'MENUNGGU_DOSEN'].includes(loan.status)));
    if (!visible.length) return empty();
    return (
      <View style={styles.stack}>
        {visible.map((loan) => (
          <View key={loan.id} style={[styles.card, cardStyle]}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Peminjaman #{loan.id}</Text>
                <Text style={[styles.secondary, { color: theme.textSecondary }]}>
                  {loan.applicant_name || loan.borrower_name || 'Calon peminjam'}
                  {(loan.applicant_email || loan.borrower_email) ? ` · ${loan.applicant_email || loan.borrower_email}` : ''}
                  {' · '}{loan.start_date} s.d. {loan.due_date}
                </Text>
              </View>
              {badge({ value: loan.status })}
            </View>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>{loan.purpose}</Text>
            {parseItems(loan.items).map((item) => (
              <Text key={item.unit_id} style={[styles.detail, { color: theme.text }]}>
                {item.equipment_name} · {item.unit_code}
                {item.return_condition ? ` · ${statusNames[item.return_condition] || item.return_condition}` : ''}
              </Text>
            ))}
            {admin && (
              <>
                {field({ label: 'Alasan penolakan (jika diperlukan)', value: rejectionNote, onChange: setRejectionNote, placeholder: 'Tuliskan alasan penolakan' })}
                <View style={styles.actionRow}>
                {button({ label: 'Setujui', onPress: () => perform(
                  () => apiRequest(`/approvals/${loan.id}/approve`, { method: 'POST', body: {} }),
                  'Pengajuan alat disetujui.',
                ) })}
                {button({ secondary: true, label: 'Tolak', onPress: () => {
                  if (!rejectionNote.trim()) return showMessage('Alasan diperlukan', 'Tuliskan alasan penolakan terlebih dahulu.');
                  perform(
                    () => apiRequest(`/approvals/${loan.id}/reject`, { method: 'POST', body: { note: rejectionNote.trim() } }),
                    'Pengajuan alat ditolak.',
                  );
                } })}
                </View>
              </>
            )}
          </View>
        ))}
      </View>
    );
  }

  function handoverView() {
    const approvedLoans = loans.filter((loan) => loan.status === 'DISETUJUI');
    if (!approvedLoans.length) return empty({ message: 'Belum ada peminjaman yang siap diserahterimakan.' });
    return (
      <View style={styles.stack}>
        {approvedLoans.map((loan) => (
          <View key={loan.id} style={[styles.card, cardStyle]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Peminjaman #{loan.id}</Text>
            {parseItems(loan.items).map((item) => <Text key={item.unit_id} style={[styles.detail, { color: theme.textSecondary }]}>{item.equipment_name} · {item.unit_code}</Text>)}
            {button({ label: 'Catat serah terima', onPress: () => perform(
              () => apiRequest(`/loans/${loan.id}/handover`, { method: 'POST', body: {} }),
              'Serah terima alat berhasil dicatat.',
            ) })}
          </View>
        ))}
      </View>
    );
  }

  function returnView() {
    const activeLoans = loans.filter((loan) => loan.status === 'SEDANG_DIPINJAM');
    const returnConditions = [
      { key: 'BAIK', label: 'Baik' },
      { key: 'RUSAK', label: 'Rusak' },
      { key: 'HILANG', label: 'Hilang' },
    ];
    if (!activeLoans.length) return empty({ message: 'Belum ada alat yang menunggu pengembalian.' });
    return (
      <View style={styles.stack}>
        {activeLoans.map((loan) => (
          <View key={loan.id} style={[styles.card, cardStyle]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Peminjaman #{loan.id}</Text>
            {parseItems(loan.items).filter((item) => !item.returned_at).map((item) => (
              <View key={item.unit_id} style={[styles.card, { borderColor: theme.border, marginTop: 12 }]}>
                <Text style={[styles.secondary, { color: theme.text }]}>{item.equipment_name} · {item.unit_code}</Text>
                <Text style={[styles.detail, { color: theme.textSecondary }]}>Pilih kondisi saat dikembalikan:</Text>
                <View style={styles.actionRow}>
                  {returnConditions.map((condition) => (
                    <Pressable
                      key={condition.key}
                      disabled={busy}
                      onPress={() => perform(
                        () => apiRequest(`/loans/${loan.id}/return`, {
                          method: 'POST',
                          body: { unit_id: item.unit_id, condition: condition.key },
                        }),
                        'Pengembalian unit berhasil dicatat.',
                      )}
                      style={[styles.conditionButton, { borderColor: theme.border }]}>
                      <Text style={[styles.secondary, { color: theme.primary }]}>{condition.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  function roomManagement() {
    return (
      <View style={styles.stack}>
        <View style={[styles.formCard, cardStyle]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Tambah ruang</Text>
          {field({ label: 'Nama ruang', value: roomName, onChange: setRoomName, placeholder: 'Contoh: Lab Multimedia' })}
          {field({ label: 'Kapasitas', value: roomCapacity, onChange: setRoomCapacity, placeholder: '30', type: 'numeric' })}
          {button({ label: 'Simpan ruang', onPress: async () => {
            if (!roomName.trim()) return showMessage('Nama belum diisi', 'Masukkan nama ruang.');
            const succeeded = await perform(
              () => apiRequest('/rooms', { method: 'POST', body: { name: roomName.trim(), capacity: roomCapacity ? Number(roomCapacity) : null } }),
              'Ruang berhasil ditambahkan.',
            );
            if (succeeded) {
              setRoomName('');
              setRoomCapacity('');
            }
          } })}
        </View>
        {roomList({ management: true })}
      </View>
    );
  }

  function equipmentManagement() {
    return (
      <View style={styles.stack}>
        <View style={[styles.formCard, cardStyle]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Tambah jenis alat</Text>
          {field({ label: 'Nama alat', value: equipmentName, onChange: setEquipmentName, placeholder: 'Contoh: Kamera DSLR' })}
          <View style={styles.chipRow}>
            {(['BIASA', 'KHUSUS'] as const).map((category) => (
              <Pressable key={category} onPress={() => setEquipmentCategory(category)}
                style={[styles.chip, { borderColor: equipmentCategory === category ? theme.primary : theme.border, backgroundColor: equipmentCategory === category ? theme.primarySoft : theme.background }]}>
                <Text style={{ color: equipmentCategory === category ? theme.primary : theme.text }}>{category === 'BIASA' ? 'Biasa' : 'Khusus'}</Text>
              </Pressable>
            ))}
          </View>
          {field({ label: 'Keterangan', value: equipmentDescription, onChange: setEquipmentDescription, placeholder: 'Deskripsi singkat (opsional)' })}
          {button({ label: 'Tambah jenis alat', onPress: async () => {
            if (!equipmentName.trim()) return showMessage('Nama belum diisi', 'Masukkan nama jenis alat.');
            const succeeded = await perform(
              () => apiRequest('/equipment/types', { method: 'POST', body: { name: equipmentName.trim(), category: equipmentCategory, description: equipmentDescription.trim() } }),
              'Jenis alat berhasil ditambahkan.',
            );
            if (succeeded) {
              setEquipmentName('');
              setEquipmentDescription('');
            }
          } })}
        </View>
        <View style={[styles.formCard, cardStyle]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Tambah unit inventaris</Text>
          <View style={styles.chipRow}>
            {equipment.map((item) => (
              <Pressable key={item.id} onPress={() => setSelectedTypeId(item.id)}
                style={[styles.chip, { borderColor: selectedTypeId === item.id ? theme.primary : theme.border, backgroundColor: selectedTypeId === item.id ? theme.primarySoft : theme.background }]}>
                <Text style={{ color: selectedTypeId === item.id ? theme.primary : theme.text }}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
          {field({ label: 'Kode unit', value: unitCode, onChange: setUnitCode, placeholder: 'Contoh: CAM-001' })}
          {button({ label: 'Simpan unit', disabled: !equipment.length, onPress: async () => {
            if (!selectedTypeId || !unitCode.trim()) return showMessage('Data belum lengkap', 'Pilih jenis alat dan masukkan kode unit.');
            const succeeded = await perform(
              () => apiRequest('/equipment/units', { method: 'POST', body: { equipment_type_id: selectedTypeId, unit_code: unitCode.trim() } }),
              'Unit alat berhasil ditambahkan.',
            );
            if (succeeded) setUnitCode('');
          } })}
        </View>
        {equipmentList({ management: true })}
      </View>
    );
  }

  function reportView() {
    if (!report) return empty({ message: 'Laporan belum tersedia.' });
    const stats = [
      ['Peminjaman ruang', report.room_loans],
      ['Peminjaman alat', report.equipment_loans],
      ['Unit tersedia', report.equipment.available || 0],
      ['Dipesan oleh permohonan', report.equipment.reserved || 0],
      ['Sedang dipinjam', report.equipment.borrowed || 0],
      ['Rusak / perbaikan', report.equipment.damaged || 0],
      ['Hilang', report.equipment.lost || 0],
    ];
    const topCount = Math.max(1, ...roomFrequency.map((item) => Number(item.usage_count)), ...equipmentFrequency.map((item) => Number(item.usage_count)));
    return (
      <View style={styles.stack}>
        <Text style={[styles.secondary, { color: theme.textSecondary }]}>
          Ringkasan {report.period.month}/{report.period.year}
        </Text>
        <View style={styles.statsGrid}>
          {stats.map(([label, value]) => (
            <View key={String(label)} style={[styles.statCard, cardStyle]}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{value}</Text>
              <Text style={[styles.secondary, { color: theme.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>
        {[['Frekuensi penggunaan ruang', roomFrequency], ['Frekuensi peminjaman alat', equipmentFrequency]].map(([heading, rows]) => (
          <View key={String(heading)} style={[styles.formCard, cardStyle]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{heading as string}</Text>
            {(rows as { name: string; usage_count: number }[]).map((item) => (
              <View key={item.name} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: theme.text }]}>{item.name}</Text>
                <View style={[styles.barTrack, { backgroundColor: theme.primarySoft }]}>
                  <View style={[styles.barFill, { width: `${Math.min(100, Number(item.usage_count) / topCount * 100)}%`, backgroundColor: theme.primary }]} />
                </View>
                <Text style={[styles.barValue, { color: theme.textSecondary }]}>{item.usage_count}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  function renderContent() {
    if (title === 'Ketersediaan Ruang') return roomList();
    if (title === 'Ketersediaan Alat') return equipmentList();
    if (title === 'Ajukan Peminjaman') {
      return <View style={styles.stack}>{roomBookingForm()}{equipmentLoanForm()}</View>;
    }
    if (title === 'Status Pengajuan' || title === 'Riwayat Peminjaman') {
      return <View style={styles.stack}>{bookingList()}{loanList()}</View>;
    }
    if (title === 'Permohonan Ruang') {
      return <View style={styles.stack}>{roomBookingForm()}{bookingList({ admin: true })}</View>;
    }
    if (title === 'Permohonan Alat') {
      return <View style={styles.stack}>{equipmentLoanForm()}{loanList({ admin: true })}</View>;
    }
    if (title === 'Permohonan Peminjaman') {
      return (
        <View style={styles.stack}>
          {roomBookingForm()}
          {equipmentLoanForm()}
          {bookingList({ admin: true })}
          {loanList({ admin: true })}
        </View>
      );
    }
    if (title === 'Persetujuan Khusus') return loanList({ admin: true, specialOnly: true });
    if (title === 'Serah Terima Alat') return handoverView();
    if (title === 'Pengembalian & Pemeriksaan') return returnView();
    if (title === 'Kelola Ruang') return roomManagement();
    if (title === 'Kelola Alat') return equipmentManagement();
    if (title === 'Laporan Bulanan') return reportView();
    return empty({ message: 'Fitur ini belum tersedia.' });
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { borderColor: theme.border }]}>
            <Text style={[styles.backText, { color: theme.primary }]}>‹  Kembali</Text>
          </Pressable>
          <Pressable onPress={loadData} style={[styles.refreshButton, { backgroundColor: theme.primarySoft }]}>
            <Text style={[styles.refreshText, { color: theme.primary }]}>Muat ulang</Text>
          </Pressable>
        </View>
        <View style={styles.headerCard}>
          <View style={styles.headerCopy}>
            <View style={styles.headerEyebrowRow}>
              <View style={styles.headerDot} />
              <Text style={styles.accountText}>LABSPACE{roleLabel ? `  ·  ${roleLabel}` : ''}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.headerCaption}>{description}</Text>
          </View>
          <View style={styles.headerMark}>
            <Text style={styles.headerMarkLetter}>L</Text>
            <Text style={styles.headerMarkCaption}>RUANG · ALAT</Text>
          </View>
        </View>
        {loading ? (
          <View style={[styles.emptyCard, cardStyle]}><Text style={[styles.emptyText, { color: theme.textSecondary }]}>Memuat data...</Text></View>
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: `${theme.danger}12`, borderColor: theme.danger }]}>
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            {button({ secondary: true, label: 'Coba lagi', onPress: loadData })}
          </View>
        ) : renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: Spacing.three },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { height: 40, borderWidth: 1, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 14 },
  backText: { fontSize: 14, fontWeight: '800' },
  refreshButton: { height: 40, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 14 },
  refreshText: { fontSize: 13, fontWeight: '800' },
  headerCard: {
    minHeight: 174,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#12343A',
    padding: Spacing.four,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  headerCopy: { flexGrow: 1, flexBasis: 280 },
  headerEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A8E8D8' },
  accountText: { color: '#A8E8D8', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 27, lineHeight: 34, fontWeight: '900' },
  headerCaption: { color: '#BED3D0', marginTop: 7, fontSize: 13, lineHeight: 19, maxWidth: 620 },
  headerMark: {
    width: 112,
    height: 112,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMarkLetter: { color: '#A8E8D8', fontSize: 50, lineHeight: 56, fontWeight: '900' },
  headerMarkCaption: { color: '#D5E7E1', fontSize: 7, fontWeight: '900', letterSpacing: 0.9, marginTop: 3 },
  stack: { gap: Spacing.three },
  card: { borderWidth: 1, borderRadius: 18, padding: Spacing.three, shadowColor: '#183B3A', shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  formCard: { borderWidth: 1, borderRadius: 20, padding: Spacing.three, shadowColor: '#183B3A', shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  secondary: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  detail: { fontSize: 13, lineHeight: 19, marginTop: Spacing.two },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  field: { flexGrow: 1, flexBasis: 180, marginTop: Spacing.three },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { height: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  chip: { minHeight: 38, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, justifyContent: 'center' },
  button: { minHeight: 44, flex: 1, borderRadius: 11, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.three },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: Spacing.four, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  errorCard: { borderWidth: 1, borderRadius: 16, padding: Spacing.three },
  errorText: { fontSize: 14, lineHeight: 21 },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTopWidth: 1, paddingTop: 10, marginTop: 12 },
  link: { fontSize: 12, fontWeight: '800', padding: 6 },
  conditionButton: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  statCard: { flexGrow: 1, flexBasis: 145, minHeight: 95, borderWidth: 1, borderRadius: 14, padding: Spacing.three },
  statValue: { fontSize: 25, fontWeight: '800', marginBottom: 3 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.three },
  barLabel: { width: 120, fontSize: 12, fontWeight: '700' },
  barTrack: { flex: 1, height: 8, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  barValue: { width: 28, textAlign: 'right', fontSize: 12 },
});
