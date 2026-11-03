import type React from 'react';
import {
  Activity,
  AlertTriangle,
  Banknote,
  BedDouble,
  Briefcase,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  Coins,
  FileText,
  Gauge,
  HardHat,
  Handshake,
  Megaphone,
  Percent,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

/**
 * Peta nama ikon (string di data widget) → komponen lucide.
 *
 * Disimpan sebagai NAMA, bukan komponen, karena widget diserialisasi ke database.
 * Dipakai kepala kartu kanvas dan kartu KPI berwajah Template Chart.
 */
export const PETA_IKON: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  coins: Coins,
  target: Target,
  gauge: Gauge,
  users: Users,
  'shield-alert': ShieldAlert,
  banknote: Banknote,
  activity: Activity,
  percent: Percent,
  dollar: CircleDollarSign,
  // Template rapat manajemen bagian
  'user-check': UserCheck,
  'user-plus': UserPlus,
  briefcase: Briefcase,
  building: Building2,
  bed: BedDouble,
  calendar: CalendarClock,
  clipboard: ClipboardCheck,
  clock: Clock,
  file: FileText,
  'hard-hat': HardHat,
  handshake: Handshake,
  megaphone: Megaphone,
  receipt: Receipt,
  'shield-check': ShieldCheck,
  cart: ShoppingCart,
  star: Star,
  truck: Truck,
  wrench: Wrench,
  alert: AlertTriangle,
};

/** Komponen ikon untuk nama di data widget; nama tak dikenal = undefined. */
export const ikonWidget = (nama: string | undefined): React.ComponentType<{ className?: string }> | undefined =>
  nama ? PETA_IKON[nama] : undefined;
