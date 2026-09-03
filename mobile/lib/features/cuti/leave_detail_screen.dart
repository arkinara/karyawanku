import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_exception.dart';
import '../../core/format.dart';
import '../../data/models.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import 'leave_provider.dart';

/// Deep-link target for `karyawanku://leave/<id>` (ticket #71). Fetches the
/// request by id; the BE's ownership check is the primary gate — a
/// cross-employee id (403/404) renders a not-found state, never the other
/// employee's data (negative AC).
class LeaveDetailScreen extends ConsumerStatefulWidget {
  const LeaveDetailScreen({super.key, required this.requestId});

  final String requestId;

  @override
  ConsumerState<LeaveDetailScreen> createState() => _LeaveDetailScreenState();
}

class _LeaveDetailScreenState extends ConsumerState<LeaveDetailScreen> {
  late Future<LeaveRequest> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(leaveRepositoryProvider).getById(widget.requestId);
  }

  void _retry() {
    setState(() {
      _future = ref.read(leaveRepositoryProvider).getById(widget.requestId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Kembali',
          icon: const Icon(LucideIcons.arrowLeft),
        ),
        title: const Text('Pengajuan Cuti'),
      ),
      body: FutureBuilder<LeaveRequest>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            final err = snapshot.error;
            final notFound =
                err is UnauthorizedException ||
                (err is ApiException &&
                    (err.status == 403 || err.status == 404));
            return _DeepLinkError(notFound: notFound, onRetry: _retry);
          }
          final request = snapshot.data;
          if (request == null) {
            return _DeepLinkError(notFound: true, onRetry: _retry);
          }
          return _RequestDetail(request: request);
        },
      ),
    );
  }
}

/// Owned request detail: kind, status, range, reason and the decision note.
class _RequestDetail extends StatelessWidget {
  const _RequestDetail({required this.request});

  final LeaveRequest request;

  @override
  Widget build(BuildContext context) {
    final range = request.days == 1
        ? '${Fmt.date(request.start)} · 1 hari'
        : '${Fmt.date(request.start)} – ${Fmt.date(request.end)} · '
              '${request.days} hari';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(request.kindLabel, style: context.texts.headlineSmall),
        const SizedBox(height: 6),
        StatusPill(
          label: request.statusLabel,
          background: context.colors.primaryContainer,
          foreground: context.colors.onPrimaryContainer,
        ),
        const SizedBox(height: 16),
        Text(
          range,
          style: context.texts.bodyLarge?.copyWith(
            color: context.colors.onSurfaceVariant,
            fontFeatures: Fmt.tabular,
          ),
        ),
        if (request.reason != null) ...[
          const SizedBox(height: 16),
          Text('Alasan', style: context.texts.titleSmall),
          const SizedBox(height: 4),
          Text(request.reason!, style: context.texts.bodyMedium),
        ],
        if (request.decisionNote != null) ...[
          const SizedBox(height: 16),
          Text('Catatan pengesah', style: context.texts.titleSmall),
          const SizedBox(height: 4),
          Text(request.decisionNote!, style: context.texts.bodyMedium),
        ],
      ],
    );
  }
}

/// Not-found / forbidden state for a deep link that does not resolve to the
/// signed-in employee's request — never another employee's data.
class _DeepLinkError extends StatelessWidget {
  const _DeepLinkError({required this.notFound, required this.onRetry});

  final bool notFound;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              notFound ? LucideIcons.searchX : LucideIcons.circleAlert,
              size: 44,
              color: context.colors.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              notFound ? 'Pengajuan tidak ditemukan' : 'Gagal memuat pengajuan',
              textAlign: TextAlign.center,
              style: context.texts.titleMedium,
            ),
            const SizedBox(height: 6),
            Text(
              notFound
                  ? 'Tautan menuju pengajuan ini tidak tersedia untuk Anda.'
                  : 'Periksa koneksi lalu coba lagi.',
              textAlign: TextAlign.center,
              style: context.texts.bodyMedium?.copyWith(
                color: context.colors.onSurfaceVariant,
              ),
            ),
            if (!notFound) ...[
              const SizedBox(height: 16),
              FilledButton.tonal(
                onPressed: onRetry,
                child: const Text('Coba lagi'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
