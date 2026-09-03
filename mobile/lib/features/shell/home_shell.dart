import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_provider.dart';
import '../../data/mock_data.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import '../absensi/absensi_screen.dart';
import '../beranda/beranda_screen.dart';
import '../cuti/cuti_screen.dart';
import '../profile/profile_screen.dart';
import '../slip/slip_gaji_screen.dart';

/// Four-destination M3 navigation bar (80 dp, pill indicator). Jadwal is a
/// pushed route rather than a fifth tab, matching the design doc.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _index = widget.initialIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          BerandaScreen(onOpenTab: _go),
          const AbsensiScreen(),
          const CutiScreen(),
          const SlipGajiScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _go,
        destinations: [
          const NavigationDestination(
            icon: Icon(LucideIcons.house),
            label: 'Beranda',
          ),
          const NavigationDestination(
            icon: Icon(LucideIcons.clock),
            label: 'Absensi',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: Mock.pendingLeaveCount > 0,
              label: Text('${Mock.pendingLeaveCount}'),
              child: const Icon(LucideIcons.calendar),
            ),
            label: 'Cuti',
          ),
          const NavigationDestination(
            icon: Icon(LucideIcons.fileText),
            label: 'Slip Gaji',
          ),
        ],
      ),
    );
  }

  void _go(int i) => setState(() => _index = i);
}

/// Shared app-bar avatar for the signed-in employee. Reads the real user from
/// the auth session and opens [ProfileScreen] on tap.
class EmployeeAvatar extends ConsumerWidget {
  const EmployeeAvatar({super.key, this.size = 36});

  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final name = user?.nama ?? Mock.employee.name;
    final initials = user?.initials ?? Mock.employee.initials;

    return Semantics(
      label: 'Profil $name',
      button: true,
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const ProfileScreen()),
        ),
        borderRadius: BorderRadius.circular(size / 2),
        child: RoundToken(
          label: initials,
          background: context.colors.primaryContainer,
          foreground: context.colors.onPrimaryContainer,
          size: size,
        ),
      ),
    );
  }
}
