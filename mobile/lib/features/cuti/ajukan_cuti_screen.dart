import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import '../jadwal/shift_provider.dart';
import 'leave_provider.dart';

/// Leave request form. The impact line under the dates is the point of the
/// screen: how many days it costs against the real balance and which shifts it
/// collides with. The balance arithmetic and the shift-conflict warning are
/// computed here for a live preview, but the server is the source of truth for
/// the actual decision.
class AjukanCutiScreen extends ConsumerStatefulWidget {
  const AjukanCutiScreen({super.key});

  @override
  ConsumerState<AjukanCutiScreen> createState() => _AjukanCutiScreenState();
}

class _AjukanCutiScreenState extends ConsumerState<AjukanCutiScreen> {
  late DateTime _start;
  late DateTime _end;
  LeaveType? _selectedType;
  final _reason = TextEditingController(text: 'Acara keluarga di Bandung');

  /// Published shifts overlapping `[_start, _end]` — the substitute warning.
  List<ShiftAssignment> _conflicts = const [];
  bool _checkingConflicts = false;

  @override
  void initState() {
    super.initState();
    final base = DateTime.now();
    _start = DateTime(base.year, base.month, base.day + 3);
    _end = DateTime(base.year, base.month, base.day + 5);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshConflicts();
    });
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  int get _days => _end.difference(_start).inDays + 1;

  /// Default to the annual type when the server list arrives, else the first.
  LeaveType? _defaultType(List<LeaveType> types) {
    for (final type in types) {
      if (type.nama.toLowerCase().contains('tahunan')) return type;
    }
    return types.isEmpty ? null : types.first;
  }

  LeaveBalance? _balanceFor(LeaveType? type, List<LeaveBalance> balances) {
    if (type == null) return null;
    final needle = type.nama.toLowerCase();
    for (final balance in balances) {
      final hay = balance.label.toLowerCase();
      if (hay.contains(needle) || needle.contains(hay)) return balance;
    }
    return null;
  }

  LeaveBalance? _annual(List<LeaveBalance> balances) {
    for (final balance in balances) {
      if (balance.label.toLowerCase().contains('tahunan')) return balance;
    }
    return null;
  }

  /// `sisa setelah pengajuan` for the given type; null when the type has no
  /// balance row (e.g. a quota-less custom type), which cannot be overdrawn.
  int? _remainingAfter(LeaveType? type, List<LeaveBalance> balances) {
    final balance = _balanceFor(type, balances);
    if (balance == null) return null;
    return balance.remaining - _days;
  }

  bool _exceeds(LeaveType? type, List<LeaveBalance> balances) {
    final remaining = _remainingAfter(type, balances);
    return remaining != null && remaining < 0;
  }

  @override
  Widget build(BuildContext context) {
    final leave = ref.watch(leaveProvider);
    final colors = context.colors;
    final status = context.status;
    final types = leave.leaveTypes;
    final balances = leave.balances;
    final selected = _selectedType ?? _defaultType(types);
    final annual = _annual(balances);
    final exceeds = _exceeds(selected, balances);
    final submitting = leave.submitting;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Kembali',
          icon: const Icon(LucideIcons.arrowLeft),
        ),
        title: const Text('Ajukan Cuti'),
      ),
      body: IgnorePointer(
        // Freeze the form while the submit is in flight so a double tap
        // cannot edit the dates mid-send.
        ignoring: submitting,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            Container(
              margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colors.primaryContainer,
                borderRadius: Shape.rLg,
                boxShadow: status.elevation(1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Sisa cuti tahunan',
                    style: context.texts.bodySmall?.copyWith(
                      color: colors.onPrimaryContainer,
                    ),
                  ),
                  const SizedBox(height: 4),
                  // Wrap so the qualifier drops to its own line under scaling
                  // instead of squeezing the number.
                  Wrap(
                    spacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.end,
                    children: [
                      Text(
                        '${annual?.remaining ?? 0}',
                        style: context.texts.headlineLarge?.copyWith(
                          fontSize: 32,
                          height: 1,
                          color: colors.onPrimaryContainer,
                          fontFeatures: Fmt.tabular,
                        ),
                      ),
                      Text(
                        annual == null
                            ? 'sedang dimuat'
                            : 'dari ${annual.total} hari · berlaku s/d '
                                  '${Fmt.date(annual.expiry)}',
                        style: context.texts.bodyMedium?.copyWith(
                          color: status.onPrimaryContainerMuted(colors),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SectionLabel('Jenis cuti', top: 24),
            if (types.isEmpty)
              Padding(
                padding: Insets.page,
                child: Text(
                  'Jenis cuti belum dimuat.',
                  style: context.texts.bodyMedium?.copyWith(
                    color: colors.onSurfaceVariant,
                  ),
                ),
              )
            else
              Padding(
                padding: Insets.page,
                child: Wrap(
                  spacing: 8,
                  children: [
                    for (final type in types)
                      ToneChip(
                        label: type.label,
                        selected: selected?.id == type.id,
                        onTap: () => setState(() => _selectedType = type),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: 24),
            Padding(
              padding: Insets.page,
              child: context.isLargeText
                  ? Column(
                      children: [
                        _dateField(isStart: true),
                        const SizedBox(height: 20),
                        _dateField(isStart: false),
                      ],
                    )
                  : Row(
                      children: [
                        Expanded(child: _dateField(isStart: true)),
                        const SizedBox(width: 12),
                        Expanded(child: _dateField(isStart: false)),
                      ],
                    ),
            ),
            const SizedBox(height: 16),
            ToneBanner(
              icon: exceeds ? LucideIcons.circleAlert : LucideIcons.info,
              background: exceeds
                  ? status.dangerContainer
                  : status.infoContainer,
              foreground: exceeds
                  ? status.onDangerContainer
                  : status.onInfoContainer,
              live: true,
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: '$_days hari',
                      style: const TextStyle(fontWeight: FontWeight.w500),
                    ),
                    TextSpan(text: ' · ${_impact(selected, balances)}'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            Padding(
              padding: Insets.page,
              child: TextField(
                controller: _reason,
                minLines: 2,
                maxLines: 4,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Alasan',
                  helperText: 'Jelaskan singkat supaya lebih cepat disetujui',
                ),
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: Insets.page,
              child: _AttachmentSlot(onTap: () {}),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border(top: BorderSide(color: colors.outlineVariant)),
        ),
        child: SafeArea(
          top: false,
          child: FilledButton(
            onPressed: exceeds || submitting ? null : _submit,
            child: submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Kirim Pengajuan'),
          ),
        ),
      ),
    );
  }

  Widget _dateField({required bool isStart}) {
    return DisplayField(
      label: isStart ? 'Mulai' : 'Selesai',
      value: Fmt.date(isStart ? _start : _end),
      onTap: () => _pick(isStart: isStart),
    );
  }

  String _impact(LeaveType? type, List<LeaveBalance> balances) {
    final balance = _balanceFor(type, balances);
    final remaining = _remainingAfter(type, balances);
    if (remaining != null && remaining < 0) {
      return 'melebihi sisa ${balance!.label} (${balance.remaining} hari). '
          'Kurangi durasi atau pilih jenis cuti lain.';
    }
    final parts = <String>[];
    if (remaining != null) parts.add('sisa jadi $remaining hari');
    if (_checkingConflicts) {
      parts.add('menghitung bentrok shift…');
    } else if (_conflicts.isNotEmpty) {
      final names = _conflicts
          .map((c) => c.shift?.label ?? 'Shift')
          .toSet()
          .join(', ');
      final dates = _conflicts
          .map((c) => Fmt.date(c.tanggal))
          .toSet()
          .join(', ');
      parts.add('bentrok dengan $names ($dates) — cari pengganti shift');
    } else {
      parts.add('tidak bentrok dengan shift');
    }
    return parts.join('. ');
  }

  /// Pre-fetch the published roster overlapping the selected range so the
  /// banner can warn about shifts the employee must find a substitute for.
  Future<void> _refreshConflicts() async {
    setState(() => _checkingConflicts = true);
    try {
      final list = await ref
          .read(shiftRepositoryProvider)
          .getAssignments(start: _start, end: _end);
      if (!mounted) return;
      setState(() {
        _conflicts = list;
        _checkingConflicts = false;
      });
    } catch (_) {
      // A roster failure must not block the form — the warning is a preview
      // only; the server decides.
      if (!mounted) return;
      setState(() {
        _conflicts = const [];
        _checkingConflicts = false;
      });
    }
  }

  Future<void> _submit() async {
    final leave = ref.read(leaveProvider);
    final type = _selectedType ?? _defaultType(leave.leaveTypes);
    if (type == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Jenis cuti belum tersedia. Coba lagi.')),
      );
      return;
    }
    // Re-validate against the latest balances before sending — the button is
    // already disabled when negative, but guard against a stale state.
    if (_exceeds(type, leave.balances)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Sisa kuota tidak mencukupi. Kurangi durasi atau pilih jenis cuti lain.',
          ),
        ),
      );
      return;
    }

    await ref
        .read(leaveProvider.notifier)
        .submit(
          leaveTypeId: type.id,
          tanggalMulai: _start,
          tanggalSelesai: _end,
          alasan: _reason.text,
        );

    if (!mounted) return;
    final after = ref.read(leaveProvider);
    final messenger = ScaffoldMessenger.of(context);
    if (after.actionError != null) {
      messenger.showSnackBar(SnackBar(content: Text(after.actionError!)));
      ref.read(leaveProvider.notifier).clearActionError();
    } else {
      messenger.showSnackBar(
        const SnackBar(content: Text('Pengajuan terkirim')),
      );
      Navigator.of(context).pop();
    }
  }

  Future<void> _pick({required bool isStart}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _start : _end,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 2, 12, 31),
      helpText: isStart ? 'Pilih tanggal mulai' : 'Pilih tanggal selesai',
    );
    if (picked == null) return;

    setState(() {
      if (isStart) {
        _start = picked;
        if (_end.isBefore(_start)) _end = _start;
      } else {
        _end = picked.isBefore(_start) ? _start : picked;
      }
    });
    _refreshConflicts();
  }
}

/// Dashed drop zone for a doctor's note or invitation.
class _AttachmentSlot extends StatelessWidget {
  const _AttachmentSlot({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final muted = context.colors.onSurfaceVariant;

    return Semantics(
      button: true,
      label: 'Lampirkan foto. Surat dokter atau undangan, opsional',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: Shape.rMd,
        child: DashedBorder(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(LucideIcons.camera, size: 22, color: muted),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Lampirkan foto',
                        style: context.texts.bodyLarge?.copyWith(fontSize: 15),
                      ),
                      Text(
                        'Surat dokter, undangan — opsional',
                        style: context.texts.bodySmall?.copyWith(color: muted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(LucideIcons.paperclip, size: 18, color: muted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
