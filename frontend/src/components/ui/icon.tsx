import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Download,
  Eye,
  EyeOff,
  File,
  FileText,
  Filter,
  Home,
  Inbox,
  Info,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Play,
  Plus,
  Printer,
  Search,
  Settings,
  Sparkles,
  Sun,
  TrendingUp,
  Undo2,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'

/**
 * Icon wrapper for the ProMax icon set.
 *
 * Each key maps to a Lucide React component with identical geometry to the
 * `kk.js` `ICON` map (lines 11-53), rendered at the same 1.75 stroke width so
 * the whole product keeps one icon rhythm.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  clock: Clock,
  calendar: Calendar,
  wallet: Wallet,
  payslip: FileText,
  home: Home,
  settings: Settings,
  bell: Bell,
  menu: Menu,
  close: X,
  search: Search,
  filter: Filter,
  check: Check,
  checkCircle: CheckCircle2,
  alert: AlertTriangle,
  info: Info,
  x: XCircle,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  arrowUp: ArrowUp,
  arrowLeft: ArrowLeft,
  sun: Sun,
  moon: Moon,
  download: Download,
  printer: Printer,
  logout: LogOut,
  plus: Plus,
  play: Play,
  pin: MapPin,
  building: Building2,
  trend: TrendingUp,
  coffee: Coffee,
  briefcase: Briefcase,
  eye: Eye,
  eyeOff: EyeOff,
  inbox: Inbox,
  undo: Undo2,
  file: File,
  sparkle: Sparkles,
}

export type IconName = keyof typeof ICON_MAP

export interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 20, className }: IconProps) {
  const Cmp = ICON_MAP[name]
  return <Cmp size={size} className={className} strokeWidth={1.75} aria-hidden="true" />
}