import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format.dart';
import '../../core/location/location_service.dart';
import '../../core/selfie/selfie_consent_store.dart';
import '../../data/local/offline_queue.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import 'attendance_provider.dart';
import 'geofence_provider.dart';
import 'offline_queue_manager.dart';
import 'selfie_provider.dart';

/// Attendance — clock-in direction A ("geofence card") from the design doc:
/// wall clock, status, elapsed hero, one primary pill button, today's
/// timeline and the month's totals.
///
/// Everything here is driven by [attendanceProvider] (the BE), except the wall
/// clock which ticks from the device clock. The elapsed figure derives from
/// the server's `clock_in_at`, never the device clock.
class AbsensiScreen extends ConsumerStatefulWidget {
  const AbsensiScreen({super.key});

  @override
  ConsumerState<AbsensiScreen> createState() => _AbsensiScreenState();
}

class _AbsensiScreenState extends ConsumerState<AbsensiScreen>
    with WidgetsBindingObserver {
  late DateTime _now = DateTime.now();
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _now = DateTime.now());
    });
    // Load on mount — deferred a frame so the provider can be written to
    // (Riverpod forbids writes during build/initState). Same load runs again
    // on resume below.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(attendanceProvider.notifier).refresh();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Returning to the foreground: reconcile today's record + month totals
    // with the server (e.g. the day rolled over while the app was away) and
    // flush any queued offline attendance (#70).
    if (state == AppLifecycleState.resumed) {
      ref.read(attendanceProvider.notifier).refresh();
      ref.read(offlineQueueManagerProvider.notifier).flush();
    }
  }

  @override
  Widget build(BuildContext context) {
    final attendance = ref.watch(attendanceProvider);

    // Surface clock-action failures as a snackbar; the load failure renders
    // inline as the error state below.
    ref.listen(attendanceProvider, (previous, next) {
      if (next.actionError != null && previous?.actionError == null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(next.actionError!)));
          ref.read(attendanceProvider.notifier).clearActionError();
        });
      }
    });

    // Geofence failure modes need a settings detour, not a fruitless re-prompt:
    // a permanently denied permission opens app settings, a disabled location
    // service opens the device's location settings. One-shot per [GeofenceNotice].
    ref.listen(geofenceProvider, (previous, next) {
      final notice = next.notice;
      if (notice != null && previous?.notice != notice) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _showGeofenceSnackbar(notice);
          ref.read(geofenceProvider.notifier).clearNotice();
        });
      }
    });

    final loading = attendance.today == null && attendance.loading;
    final failed =
        attendance.today == null && attendance.error != null && !loading;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () {},
          tooltip: 'Menu',
          icon: const Icon(LucideIcons.menu),
        ),
        title: const Text('Absensi'),
      ),
      body: RefreshIndicator(
        onRefresh: _onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            const _OfflineQueueBanner(),
            if (loading) ...[
              const _ClockSkeleton(key: ValueKey('attendance-loading')),
              const _TimelineSkeleton(),
              const _TilesSkeleton(),
            ] else if (failed)
              _ErrorCard(
                message: attendance.error!,
                onRetry: () =>
                    ref.read(attendanceProvider.notifier).loadToday(),
              )
            else ...[
              _ClockCard(
                now: _now,
                today: attendance.today,
                submitting: attendance.submitting,
                onClockIn: _handleClockIn,
                onClockOut: () =>
                    ref.read(attendanceProvider.notifier).clockOut(),
                onSelfieTap: _onSelfieTap,
              ),
              _TodayTimeline(today: attendance.today),
              _MonthTotals(aggregate: attendance.aggregate),
            ],
          ],
        ),
      ),
    );
  }

  /// Pull-to-refresh: reconcile today's record + monthly totals and flush any
  /// queued offline attendance (#70).
  Future<void> _onRefresh() async {
    await Future.wait([
      ref.read(attendanceProvider.notifier).refresh(),
      ref.read(offlineQueueManagerProvider.notifier).flush(),
    ]);
  }

  /// Clock-in that also flushes a captured selfie once the record exists:
  /// the selfie slot can be filled before the first clock-in, and the photo is
  /// then attached as a follow-up upload to the just-created record. A failed
  /// clock-in never attempts the upload (the capture is preserved for retry).
  void _handleClockIn() {
    final attendance = ref.read(attendanceProvider.notifier);
    attendance.clockIn().then((_) {
      if (!mounted) return;
      final recordId = ref.read(attendanceProvider).today?.record?.id;
      final selfie = ref.read(selfieProvider);
      // An optimistic local record (`local-…`, still awaiting offline sync)
      // has no server id yet — the selfie is kept and flushes with a later
      // clock-in, never uploaded against a phantom record.
      final isLocal = recordId != null && recordId.startsWith('local-');
      if (recordId != null &&
          !isLocal &&
          selfie.hasCapture &&
          !selfie.uploading) {
        ref.read(selfieProvider.notifier).upload(recordId);
      }
    });
  }

  /// Selfie slot tap: consent (once) → camera permission → capture. A denied
  /// camera permission is the designed fallback — "Selfie dilewati" — and
  /// never blocks clock-in (the selfie is optional, but encouraged).
  Future<void> _onSelfieTap() async {
    final consent = ref.read(selfieConsentStoreProvider);
    final notifier = ref.read(selfieProvider.notifier);

    if (!await consent.hasConsent()) {
      final agreed = await _showSelfieConsentDialog();
      if (agreed != true || !mounted) return;
      await consent.grant();
      notifier.acknowledgeConsent();
    }

    final captured = await notifier.capture();
    if (captured == null && mounted) {
      final permission = ref.read(selfieProvider).permission;
      if (!permission.canUse) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Kamera tidak diizinkan. Selfie dilewati — Anda tetap bisa Clock In.',
            ),
          ),
        );
      }
    }
  }

  /// Privacy + consent dialog shown once, before the first capture. States
  /// what is stored, who can see it, and how long — per UU PDP.
  Future<bool?> _showSelfieConsentDialog() {
    return showDialog<bool>(
      context: context,
      builder: (context) {
        final colors = context.colors;
        final status = context.status;
        return AlertDialog(
          title: const Text('Selfie verifikasi kehadiran'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Sebelum mengambil foto, ini yang perlu Anda tahu:',
                style: context.texts.bodyMedium,
              ),
              const SizedBox(height: 12),
              _ConsentRow(
                icon: LucideIcons.clock,
                background: status.infoContainer,
                foreground: status.onInfoContainer,
                text: 'Selfie disimpan 90 hari',
              ),
              const SizedBox(height: 8),
              _ConsentRow(
                icon: LucideIcons.userCheck,
                background: status.successContainer,
                foreground: status.onSuccessContainer,
                text: 'Hanya Anda + owner yang bisa melihatnya',
              ),
              const SizedBox(height: 8),
              _ConsentRow(
                icon: LucideIcons.trash,
                background: status.dangerContainer,
                foreground: status.onDangerContainer,
                text: 'Bisa dihapus',
              ),
              const SizedBox(height: 16),
              Text(
                'Foto dipakai untuk verifikasi kehadiran oleh tim Anda. '
                'Tidak ada pengenalan wajah otomatis.',
                style: context.texts.bodySmall?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Nanti'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Saya Mengerti'),
            ),
          ],
        );
      },
    );
  }

  /// Failure modes need a way out, not a dead end:
  /// permanently-denied → app settings; disabled service → location settings.
  void _showGeofenceSnackbar(GeofenceNotice notice) {
    final messenger = ScaffoldMessenger.of(context);
    switch (notice) {
      case GeofenceNotice.permanentlyDenied:
        messenger.showSnackBar(
          SnackBar(
            content: const Text(
              'Lokasi tidak diizinkan. Aktifkan di Pengaturan.',
            ),
            action: SnackBarAction(
              label: 'Pengaturan',
              onPressed: () =>
                  ref.read(locationServiceProvider).openAppSettings(),
            ),
          ),
        );
      case GeofenceNotice.serviceDisabled:
        messenger.showSnackBar(
          SnackBar(
            content: const Text(
              'Aktifkan layanan lokasi di pengaturan perangkat',
            ),
            action: SnackBarAction(
              label: 'Buka',
              onPressed: () =>
                  ref.read(locationServiceProvider).openLocationSettings(),
            ),
          ),
        );
    }
  }
}

/// Wall clock, status, elapsed hero, geofence chip, selfie slot and the single
/// primary action.
class _ClockCard extends StatelessWidget {
  const _ClockCard({
    required this.now,
    required this.today,
    required this.submitting,
    required this.onClockIn,
    required this.onClockOut,
    required this.onSelfieTap,
  });

  final DateTime now;
  final TodayAttendance? today;
  final bool submitting;
  final VoidCallback onClockIn;
  final VoidCallback onClockOut;
  final VoidCallback onSelfieTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final status = context.status;
    final record = today?.record;

    final hasClockIn = record?.clockIn != null;
    final hasClockOut = record?.clockOut != null;
    final onShift = hasClockIn && !hasClockOut;

    final primaryLabel = !hasClockIn
        ? 'Clock In'
        : hasClockOut
        ? null
        : 'Clock Out';
    final primaryAction = !hasClockIn ? onClockIn : onClockOut;

    final elapsedMinutes = onShift
        ? now.difference(record!.clockIn!.toLocal()).inMinutes
        : hasClockOut
        ? record!.clockOut!
              .toLocal()
              .difference(record.clockIn!.toLocal())
              .inMinutes
        : 0;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: colors.surfaceContainerLowest,
        borderRadius: Shape.rXl,
        border: Border.all(color: colors.outlineVariant),
        boxShadow: status.elevation(1),
      ),
      child: Column(
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              Fmt.clock(now),
              style: context.texts.displayLarge?.copyWith(
                fontFeatures: Fmt.tabular,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'WIB · ${Fmt.longDate(now)}',
            textAlign: TextAlign.center,
            style: context.texts.bodyMedium?.copyWith(
              color: colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: onShift
                  ? status.successContainer
                  : colors.surfaceContainerHigh,
              borderRadius: Shape.rSm,
            ),
            child: Text(
              onShift
                  ? 'SEDANG BEKERJA'
                  : hasClockOut
                  ? 'SELESAI'
                  : 'BELUM CLOCK IN',
              style: context.texts.labelMedium?.copyWith(
                fontWeight: FontWeight.w500,
                letterSpacing: .4,
                color: onShift
                    ? status.onSuccessContainer
                    : colors.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            onShift
                ? 'Sudah Clock In · ${Fmt.duration(elapsedMinutes)}'
                : hasClockOut
                ? 'Sudah Clock Out · ${Fmt.duration(elapsedMinutes)}'
                : 'Mulai shift untuk mencatat kehadiran',
            textAlign: TextAlign.center,
            style: context.texts.titleMedium?.copyWith(
              fontFeatures: Fmt.tabular,
              color: onShift ? status.onSuccessContainer : colors.onSurface,
            ),
          ),
          if (record != null &&
              (record.lateMinutes > 0 ||
                  record.effectiveOvertimeMinutes > 0)) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                if (record.lateMinutes > 0)
                  StatusPill(
                    label: 'Telat ${record.lateMinutes} mnt',
                    background: status.warningContainer,
                    foreground: status.onWarningContainer,
                  ),
                if (record.effectiveOvertimeMinutes > 0)
                  StatusPill(
                    label:
                        'Lembur ${Fmt.duration(record.effectiveOvertimeMinutes)}',
                    background: status.infoContainer,
                    foreground: status.onInfoContainer,
                  ),
              ],
            ),
          ],
          const SizedBox(height: 20),
          _GeofenceChip(),
          const SizedBox(height: 8),
          _SelfieSlot(attendanceId: record?.id, onTap: onSelfieTap),
          const SizedBox(height: 20),
          if (primaryLabel != null)
            FilledButton.icon(
              onPressed: submitting ? null : primaryAction,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(64),
                textStyle: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                  letterSpacing: .1,
                ),
              ),
              icon: submitting
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : const Icon(LucideIcons.clock, size: 24),
              label: Text(submitting ? 'Memproses…' : primaryLabel),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colors.surfaceContainerHigh,
                borderRadius: Shape.rMd,
              ),
              child: Row(
                children: [
                  Icon(
                    LucideIcons.checkCircle,
                    size: 20,
                    color: status.success,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Absensi hari ini sudah lengkap',
                      style: context.texts.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Lokasi & foto dikirim bersama absensi',
              style: context.texts.labelMedium?.copyWith(
                color: colors.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Geofence chip driven by [geofenceProvider]. Four distinct states, each with
/// icon + label + colour (never colour alone): inside (green), outside (red),
/// unknown (grey, honest "we do not know") and low-accuracy (amber). While a
/// fix is being acquired it shows a progress spinner instead of a stale
/// verdict. Tapping re-runs `ensurePermission` + `refresh` — the point-of-use
/// permission request.
class _GeofenceChip extends ConsumerWidget {
  const _GeofenceChip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(geofenceProvider);
    final colors = context.colors;
    final status = context.status;

    final (icon, foreground, background) = switch (state.status) {
      GeofenceStatus.inside => (
        LucideIcons.mapPinCheck,
        status.onSuccessContainer,
        status.successContainer,
      ),
      GeofenceStatus.outside => (
        LucideIcons.mapPinOff,
        status.onDangerContainer,
        status.dangerContainer,
      ),
      GeofenceStatus.lowAccuracy => (
        LucideIcons.mapPinMinus,
        status.onWarningContainer,
        status.warningContainer,
      ),
      GeofenceStatus.unknown => (
        LucideIcons.mapPinX,
        colors.onSurfaceVariant,
        colors.surfaceContainerHigh,
      ),
    };

    final label = state.acquiring
        ? 'Mencari lokasi…'
        : switch (state.status) {
            GeofenceStatus.inside =>
              'Di dalam area · ${state.distanceMeters ?? 0}m',
            GeofenceStatus.outside =>
              'Di luar area · ${state.distanceMeters ?? 0}m',
            GeofenceStatus.lowAccuracy =>
              'Akurasi rendah · ${state.distanceMeters ?? 0}m',
            GeofenceStatus.unknown => 'Lokasi tidak tersedia',
          };

    return Semantics(
      button: true,
      label: state.acquiring ? 'Mencari lokasi' : 'Geofence · $label',
      child: InkWell(
        onTap: () {
          // Permission is requested here, at the point of use — never on app
          // launch. A permanently denied state routes to settings via the
          // snackbar instead of re-prompting fruitlessly.
          ref.read(geofenceProvider.notifier).ensurePermission();
          ref.read(geofenceProvider.notifier).refresh();
        },
        borderRadius: Shape.rMd,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: background, borderRadius: Shape.rMd),
          child: Row(
            children: [
              SizedBox(
                width: 24,
                height: 24,
                child: state.acquiring
                    ? Padding(
                        padding: const EdgeInsets.all(4),
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: foreground,
                        ),
                      )
                    : Icon(icon, size: 20, color: foreground),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Geofence',
                      style: context.texts.bodySmall?.copyWith(
                        fontWeight: FontWeight.w500,
                        color: foreground,
                      ),
                    ),
                    Text(
                      label,
                      style: context.texts.labelMedium?.copyWith(
                        color: foreground,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(LucideIcons.refreshCcw, size: 16, color: foreground),
            ],
          ),
        ),
      ),
    );
  }
}

/// Dashed slot that holds the verification selfie once taken (ticket #69).
///
/// Four states, each with a distinct visual:
/// - empty: dashed placeholder — tap runs consent + capture;
/// - captured: on-device preview with "Gunakan" / "Batal" (upload fires here
///   when an attendance record exists, else the photo rides along with the
///   next Clock In);
/// - uploading: spinner (the multipart POST is in flight);
/// - uploaded: green check + the server's retention hint.
class _SelfieSlot extends ConsumerWidget {
  const _SelfieSlot({required this.attendanceId, required this.onTap});

  /// Today's record id once clocked in; null before the first clock-in.
  final String? attendanceId;

  /// Empty-state tap → consent + capture flow (owned by the screen).
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final status = context.status;
    final state = ref.watch(selfieProvider);
    final notifier = ref.read(selfieProvider.notifier);

    final Widget content;
    if (state.uploading) {
      content = Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
          const SizedBox(width: 10),
          Text('Mengunggah selfie…', style: context.texts.bodyMedium),
        ],
      );
    } else if (state.uploaded) {
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(LucideIcons.checkCircle, size: 22, color: status.success),
          const SizedBox(height: 4),
          Text(
            'Selfie tersimpan · tersedia selama 90 hari',
            style: context.texts.labelMedium?.copyWith(
              color: colors.onSurfaceVariant,
            ),
          ),
        ],
      );
    } else if (state.hasCapture) {
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          ClipRRect(
            borderRadius: Shape.rMd,
            child: Image.memory(
              state.compressedBytes!,
              height: 96,
              fit: BoxFit.cover,
              gaplessPlayback: true,
            ),
          ),
          if (state.error != null) ...[
            const SizedBox(height: 6),
            Text(
              state.error!,
              textAlign: TextAlign.center,
              style: context.texts.bodySmall?.copyWith(color: status.danger),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(onPressed: notifier.clear, child: const Text('Batal')),
              const SizedBox(width: 12),
              FilledButton(
                // Before the first clock-in there is no record to attach to —
                // confirming just keeps the capture, which the next Clock In
                // flushes automatically. After a failed upload the same button
                // becomes a retry with the capture preserved.
                onPressed: attendanceId == null
                    ? () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Selfie akan dikirim setelah Clock In',
                            ),
                          ),
                        );
                      }
                    : () => notifier.upload(attendanceId!),
                child: Text(
                  state.error != null
                      ? 'Coba lagi'
                      : attendanceId == null
                      ? 'Gunakan'
                      : 'Gunakan & Kirim',
                ),
              ),
            ],
          ),
          if (attendanceId == null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Terkirim setelah Clock In',
                style: context.texts.labelSmall?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
              ),
            ),
        ],
      );
    } else {
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(LucideIcons.camera, size: 20, color: colors.onSurfaceVariant),
          const SizedBox(height: 2),
          Text(
            'Selfie',
            style: context.texts.labelSmall?.copyWith(
              fontSize: 10,
              color: colors.onSurfaceVariant,
            ),
          ),
        ],
      );
    }

    return Semantics(
      button: !state.hasCapture && !state.uploading && !state.uploaded,
      label: _semanticLabel(state),
      excludeSemantics: true,
      child: DashedBorder(
        child: Container(
          constraints: const BoxConstraints(minHeight: 96),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: colors.surfaceContainerHigh,
            borderRadius: Shape.rMd,
          ),
          child: state.hasCapture || state.uploading || state.uploaded
              ? content
              : InkWell(onTap: onTap, borderRadius: Shape.rMd, child: content),
        ),
      ),
    );
  }

  String _semanticLabel(SelfieState state) {
    if (state.uploading) return 'Mengunggah selfie';
    if (state.uploaded) return 'Selfie tersimpan, tersedia 90 hari';
    if (state.hasCapture) return 'Selfie diambil, gunakan atau batal';
    return 'Ambil selfie verifikasi';
  }
}

/// One icon + line inside the consent dialog (never colour alone).
class _ConsentRow extends StatelessWidget {
  const _ConsentRow({
    required this.icon,
    required this.background,
    required this.foreground,
    required this.text,
  });

  final IconData icon;
  final Color background;
  final Color foreground;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(color: background, borderRadius: Shape.rSm),
          child: Icon(icon, size: 18, color: foreground),
        ),
        const SizedBox(width: 12),
        Expanded(child: Text(text, style: context.texts.bodyMedium)),
      ],
    );
  }
}

/// Today's timeline: Masuk and Pulang from the server record. Late and
/// overtime minutes render verbatim from the BE — never recomputed here.
class _TodayTimeline extends StatelessWidget {
  const _TodayTimeline({required this.today});

  final TodayAttendance? today;

  @override
  Widget build(BuildContext context) {
    final record = today?.record;
    // A `local-…` id means the action is a queued offline soft-commit still
    // awaiting sync — the timeline marks it amber until the server record
    // replaces it after the queue flush.
    final pendingSync = record != null && record.id.startsWith('local-');
    final entries = <AttendanceEntry>[
      AttendanceEntry(
        label: 'Masuk',
        time: record?.clockIn == null
            ? '--:--'
            : Fmt.clock(record!.clockIn!.toLocal()),
        state: record?.clockIn == null
            ? AttendanceEntryState.empty
            : pendingSync
            ? AttendanceEntryState.pendingSync
            : AttendanceEntryState.done,
        note: record != null && record.lateMinutes > 0
            ? 'Telat ${record.lateMinutes} mnt'
            : pendingSync
            ? 'Menunggu kirim'
            : record?.catatan,
      ),
      AttendanceEntry(
        label: 'Pulang',
        time: record?.clockOut == null
            ? '--:--'
            : Fmt.clock(record!.clockOut!.toLocal()),
        state: record?.clockOut == null
            ? AttendanceEntryState.empty
            : pendingSync
            ? AttendanceEntryState.pendingSync
            : AttendanceEntryState.done,
        note: record != null && record.effectiveOvertimeMinutes > 0
            ? 'Lembur ${Fmt.duration(record.effectiveOvertimeMinutes)}'
            : null,
      ),
    ];

    return Column(
      children: [
        const SectionLabel('Hari ini', top: 8),
        ListCard(
          children: [
            for (final entry in entries)
              CardRow(
                minHeight: 64,
                leading: _StateDot(entry.state),
                title: entry.label,
                subtitle: entry.note,
                subtitleColor: entry.state == AttendanceEntryState.empty
                    ? context.colors.onSurfaceVariant
                    : null,
                semanticLabel: _entryLabel(entry),
                trailingWidget: Text(
                  entry.time,
                  textAlign: TextAlign.end,
                  style: context.texts.bodyLarge?.copyWith(
                    color: entry.state == AttendanceEntryState.empty
                        ? context.colors.onSurfaceVariant
                        : context.colors.onSurface,
                    fontFeatures: Fmt.tabular,
                  ),
                ),
              ),
          ],
        ),
        if (record == null)
          Padding(
            padding: Insets.page,
            child: Text(
              'Belum ada absensi hari ini — klik Clock In untuk mulai '
              'mencatat kehadiran.',
              style: context.texts.bodyMedium?.copyWith(
                color: context.colors.onSurfaceVariant,
              ),
            ),
          ),
      ],
    );
  }

  String _entryLabel(AttendanceEntry entry) {
    final time = entry.state == AttendanceEntryState.empty
        ? 'belum tercatat'
        : entry.time;
    return [entry.label, entry.note, time].whereType<String>().join(', ');
  }
}

/// Month totals from `GET /attendance/aggregate`. The tiles render once the
/// aggregate arrives; late/overtime totals are shown as a caption.
class _MonthTotals extends StatelessWidget {
  const _MonthTotals({required this.aggregate});

  final AttendanceAggregate? aggregate;

  @override
  Widget build(BuildContext context) {
    final status = context.status;

    return Column(
      children: [
        const SectionLabel('Bulan ini'),
        if (aggregate == null)
          Padding(
            padding: Insets.page,
            child: Text(
              'Rekap bulan ini belum tersedia.',
              style: context.texts.bodyMedium?.copyWith(
                color: context.colors.onSurfaceVariant,
              ),
            ),
          )
        else ...[
          Padding(
            padding: Insets.page,
            child: Row(
              children: [
                Expanded(
                  child: StatTile(
                    value: '${aggregate!.hadir}',
                    label: 'Hadir',
                    background: status.successContainer,
                    foreground: status.onSuccessContainer,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: StatTile(
                    value: '${aggregate!.telat}',
                    label: 'Telat',
                    background: status.warningContainer,
                    foreground: status.onWarningContainer,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: StatTile(
                    value: '${aggregate!.izin}',
                    label: 'Izin',
                    background: status.infoContainer,
                    foreground: status.onInfoContainer,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(
              'Total telat ${aggregate!.totalLateMinutes} mnt · '
              'lembur ${Fmt.duration(aggregate!.totalOvertimeMinutes)}',
              style: context.texts.labelMedium?.copyWith(
                color: context.colors.onSurfaceVariant,
                fontFeatures: Fmt.tabular,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Load-failure card with a retry action — never an empty timeline presented
/// as "no activity".
class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final status = context.status;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: status.dangerContainer,
          borderRadius: Shape.rXl,
        ),
        child: Column(
          children: [
            Icon(LucideIcons.alertTriangle, size: 28, color: status.danger),
            const SizedBox(height: 12),
            Text(
              'Gagal memuat absensi',
              style: context.texts.titleMedium?.copyWith(
                color: status.onDangerContainer,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              message,
              textAlign: TextAlign.center,
              style: context.texts.bodyMedium?.copyWith(
                color: status.onDangerContainer,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(LucideIcons.refreshCcw, size: 20),
              label: const Text('Coba lagi'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Skeleton placeholders — the screen never blocks on a spinner.
class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({
    required this.width,
    required this.height,
    this.radius = Shape.md,
  });

  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

class _ClockSkeleton extends StatelessWidget {
  const _ClockSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerLowest,
        borderRadius: Shape.rXl,
        border: Border.all(color: context.colors.outlineVariant),
      ),
      child: Column(
        children: [
          const _SkeletonBox(width: 180, height: 48),
          const SizedBox(height: 12),
          const _SkeletonBox(width: 160, height: 16),
          const SizedBox(height: 20),
          const _SkeletonBox(width: 120, height: 28),
          const SizedBox(height: 24),
          const _SkeletonBox(width: double.infinity, height: 96),
          const SizedBox(height: 24),
          const _SkeletonBox(
            width: double.infinity,
            height: 64,
            radius: Shape.full,
          ),
        ],
      ),
    );
  }
}

class _TimelineSkeleton extends StatelessWidget {
  const _TimelineSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SectionLabel('Hari ini', top: 8),
        ListCard(
          children: [
            for (var i = 0; i < 2; i++)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 18,
                ),
                child: Row(
                  children: [
                    const _SkeletonBox(
                      width: 10,
                      height: 10,
                      radius: Shape.full,
                    ),
                    const SizedBox(width: 16),
                    const _SkeletonBox(width: 90, height: 16),
                    const Spacer(),
                    const _SkeletonBox(width: 48, height: 16),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _TilesSkeleton extends StatelessWidget {
  const _TilesSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SectionLabel('Bulan ini'),
        Padding(
          padding: Insets.page,
          child: Row(
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                const Expanded(child: _SkeletonBox(width: 96, height: 88)),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Timeline bullet: green for synced, amber for queued, grey for not yet.
/// Decorative — the row's semantic label carries the state in words.
class _StateDot extends StatelessWidget {
  const _StateDot(this.state);

  final AttendanceEntryState state;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: switch (state) {
            AttendanceEntryState.done => context.status.success,
            AttendanceEntryState.pendingSync => context.status.warning,
            AttendanceEntryState.empty => context.colors.outlineVariant,
          },
        ),
      ),
    );
  }
}

/// Live offline banner (ticket #70): reflects real connectivity and a real
/// pending count, and disappears when the queue is empty and the device is
/// online. Tapping opens the queue sheet.
class _OfflineQueueBanner extends ConsumerWidget {
  const _OfflineQueueBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queue = ref.watch(offlineQueueManagerProvider);
    final status = context.status;

    final offline = !queue.online;
    final pending = queue.pendingCount;
    if (!offline && pending == 0) return const SizedBox.shrink();

    final label = offline
        ? pending > 0
              ? 'Offline — $pending entri menunggu kirim'
              : 'Tidak ada sinyal — absensi tetap tercatat tanpa sinyal'
        : '$pending entri menunggu kirim';

    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: () => _showQueueSheet(context),
        borderRadius: Shape.rMd,
        child: ToneBanner(
          live: true,
          margin: Insets.page,
          icon: offline ? LucideIcons.wifiOff : LucideIcons.clock,
          background: status.warningContainer,
          foreground: status.onWarningContainer,
          action: pending > 0 ? 'Lihat' : null,
          onAction: pending > 0 ? () => _showQueueSheet(context) : null,
          child: Text(label),
        ),
      ),
    );
  }
}

void _showQueueSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _QueueSheet(),
  );
}

/// Bottom sheet listing the real queued entries — time, kind, status and a
/// per-entry retry for permanently rejected rows. "Kirim sekarang" flushes.
class _QueueSheet extends ConsumerWidget {
  const _QueueSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queue = ref.watch(offlineQueueManagerProvider);
    final manager = ref.read(offlineQueueManagerProvider.notifier);
    final colors = context.colors;
    final status = context.status;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * .72,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 4, 24, 4),
                child: Row(
                  children: [
                    Icon(
                      LucideIcons.inbox,
                      size: 20,
                      color: colors.onSurfaceVariant,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Antrian offline',
                        style: context.texts.titleLarge,
                      ),
                    ),
                    if (queue.hasPending)
                      Text(
                        '${queue.pendingCount} menunggu',
                        style: context.texts.labelMedium?.copyWith(
                          color: status.warning,
                          fontFeatures: Fmt.tabular,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              if (queue.entries.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    children: [
                      Icon(
                        LucideIcons.checkCircle,
                        size: 32,
                        color: status.success,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Tidak ada entri antrian',
                        style: context.texts.bodyMedium?.copyWith(
                          color: colors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: queue.entries.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final entry = queue.entries[i];
                      return _QueueRow(
                        entry: entry,
                        onRetry:
                            entry.status ==
                                QueuedAttendanceStatus.permanentlyFailed
                            ? () => manager.retry(entry.id)
                            : null,
                      );
                    },
                  ),
                ),
              if (queue.hasPending) ...[
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
                  child: FilledButton.icon(
                    onPressed: queue.flushing ? null : manager.flush,
                    icon: queue.flushing
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(LucideIcons.send, size: 18),
                    label: Text(
                      queue.flushing ? 'Mengirim…' : 'Kirim sekarang',
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// One queue row: action time + kind + status pill, plus a manual retry for
/// permanently failed entries.
class _QueueRow extends StatelessWidget {
  const _QueueRow({required this.entry, this.onRetry});

  final QueuedAttendance entry;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final status = context.status;
    final colors = context.colors;

    final (pillBackground, pillForeground) = switch (entry.status) {
      QueuedAttendanceStatus.sent => (
        status.successContainer,
        status.onSuccessContainer,
      ),
      QueuedAttendanceStatus.permanentlyFailed => (
        status.dangerContainer,
        status.onDangerContainer,
      ),
      QueuedAttendanceStatus.inFlight => (
        status.infoContainer,
        status.onInfoContainer,
      ),
      QueuedAttendanceStatus.pending => (
        status.warningContainer,
        status.onWarningContainer,
      ),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
      child: Row(
        children: [
          RoundToken(
            icon: entry.kind == QueuedAttendanceKind.clockIn
                ? LucideIcons.logIn
                : LucideIcons.logOut,
            background: colors.surfaceContainerHigh,
            foreground: colors.onSurfaceVariant,
            size: 36,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.kindLabel, style: context.texts.bodyLarge),
                Text(
                  '${Fmt.clock(entry.actionAt.toLocal())} · ${entry.statusLabel}',
                  style: context.texts.bodyMedium?.copyWith(
                    color: colors.onSurfaceVariant,
                    fontFeatures: Fmt.tabular,
                  ),
                ),
                if (entry.error != null)
                  Text(
                    entry.error!,
                    style: context.texts.bodySmall?.copyWith(
                      color: status.danger,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (onRetry != null)
            TextButton(onPressed: onRetry, child: const Text('Retry'))
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: pillBackground,
                borderRadius: Shape.rSm,
              ),
              child: Text(
                entry.statusLabel,
                style: context.texts.labelMedium?.copyWith(
                  color: pillForeground,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
