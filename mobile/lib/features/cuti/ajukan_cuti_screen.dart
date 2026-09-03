import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../data/mock_data.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';

/// Leave request form. The impact line under the dates is the point of the
/// screen: how many days it costs and which shifts it collides with.
class AjukanCutiScreen extends StatefulWidget {
  const AjukanCutiScreen({super.key});

  @override
  State<AjukanCutiScreen> createState() => _AjukanCutiScreenState();
}

class _AjukanCutiScreenState extends State<AjukanCutiScreen> {
  static const _kinds = ['Tahunan', 'Sakit', 'Izin', 'Melahirkan', 'Penting'];

  int _kind = 0;
  DateTime _start = DateTime(2026, 9, 15);
  DateTime _end = DateTime(2026, 9, 17);
  final _reason = TextEditingController(text: 'Acara keluarga di Bandung');

  int get _days => _end.difference(_start).inDays + 1;

  int get _remainingAfter =>
      Mock.leaveBalances.first.remaining - (_kind == 0 ? _days : 0);

  /// Annual leave is the only balance this form can overdraw.
  bool get _exceedsBalance => _kind == 0 && _remainingAfter < 0;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final annual = Mock.leaveBalances.first;
    final colors = context.colors;
    final status = context.status;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Kembali',
          icon: const Icon(LucideIcons.arrowLeft),
        ),
        title: const Text('Ajukan Cuti'),
      ),
      body: ListView(
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
                      '${annual.remaining}',
                      style: context.texts.headlineLarge?.copyWith(
                        fontSize: 32,
                        height: 1,
                        color: colors.onPrimaryContainer,
                        fontFeatures: Fmt.tabular,
                      ),
                    ),
                    Text(
                      'dari ${annual.total} hari · berlaku s/d '
                      '${Mock.annualLeaveExpiry}',
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
          Padding(
            padding: Insets.page,
            child: Wrap(
              spacing: 8,
              children: [
                for (var i = 0; i < _kinds.length; i++)
                  ToneChip(
                    label: _kinds[i],
                    selected: _kind == i,
                    onTap: () => setState(() => _kind = i),
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
            icon: _exceedsBalance ? LucideIcons.circleAlert : LucideIcons.info,
            background: _exceedsBalance
                ? status.dangerContainer
                : status.infoContainer,
            foreground: _exceedsBalance
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
                  TextSpan(text: ' · ${_impact()}'),
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
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border(top: BorderSide(color: colors.outlineVariant)),
        ),
        child: SafeArea(
          top: false,
          child: FilledButton(
            onPressed: _exceedsBalance ? null : _submit,
            child: const Text('Kirim Pengajuan'),
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

  String _impact() {
    if (_exceedsBalance) {
      return 'melebihi sisa cuti tahunan (${Mock.leaveBalances.first.remaining} hari). '
          'Kurangi durasi atau pilih jenis cuti lain.';
    }
    final month = Fmt.monthNames[_start.month - 1].substring(0, 3);
    return 'sisa jadi $_remainingAfter hari. Bentrok dengan Shift Pagi '
        '${_start.day}–${_end.day} $month.';
  }

  void _submit() {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Pengajuan cuti terkirim')));
    Navigator.of(context).pop();
  }

  Future<void> _pick({required bool isStart}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _start : _end,
      firstDate: DateTime(2026),
      lastDate: DateTime(2027, 12, 31),
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
