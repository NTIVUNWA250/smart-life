import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../shared/format.dart';
import '../../shared/widgets.dart';
import '../../state/app_state.dart';

/// Analytics overview: spend vs. limit, savings progress, and screen time.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.appState});

  final AppState appState;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<AnalyticsSummary> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.appState.api.analyticsSummary();
  }

  void _reload() {
    setState(() => _future = widget.appState.api.analyticsSummary());
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.appState.user;
    return Scaffold(
      appBar: AppBar(
        title: Text('Hi, ${user?.name.split(' ').first ?? 'there'}'),
        actions: [
          IconButton(
            tooltip: 'Log out',
            onPressed: () => widget.appState.logout(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<AnalyticsSummary>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorRetry(message: snap.error.toString(), onRetry: _reload);
            }
            final s = snap.data!;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _SpendCard(s),
                const SizedBox(height: 12),
                _SavingsCard(s),
                const SizedBox(height: 12),
                _TimeCard(s),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _SpendCard extends StatelessWidget {
  const _SpendCard(this.s);
  final AnalyticsSummary s;

  @override
  Widget build(BuildContext context) {
    final usage = s.limitRwf <= 0 ? 1.0 : (s.spentRwf / s.limitRwf).clamp(0.0, 1.0);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Spending this month'),
                if (s.isBlocked)
                  StatusBadge(label: 'BLOCKED', color: Theme.of(context).colorScheme.error),
              ],
            ),
            const SizedBox(height: 8),
            Text('${Format.rwf(s.spentRwf)} / ${Format.rwf(s.limitRwf)}',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: usage,
              color: s.isBlocked ? Theme.of(context).colorScheme.error : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _SavingsCard extends StatelessWidget {
  const _SavingsCard(this.s);
  final AnalyticsSummary s;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Savings goals'),
            const SizedBox(height: 8),
            Text('${Format.rwf(s.savedRwf)} / ${Format.rwf(s.targetRwf)} (${s.progressPct}%)',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            LinearProgressIndicator(value: (s.progressPct / 100).clamp(0.0, 1.0)),
            const SizedBox(height: 8),
            Text('${s.activeGoals} active · ${s.achievedGoals} achieved'),
          ],
        ),
      ),
    );
  }
}

class _TimeCard extends StatelessWidget {
  const _TimeCard(this.s);
  final AnalyticsSummary s;

  @override
  Widget build(BuildContext context) {
    final usage = s.totalLimitMin <= 0 ? 0.0 : (s.totalUsedMin / s.totalLimitMin).clamp(0.0, 1.0);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Screen time today'),
            const SizedBox(height: 8),
            Text('${Format.minutes(s.totalUsedMin)} / ${Format.minutes(s.totalLimitMin)}',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            LinearProgressIndicator(value: usage),
            if (s.blockedApps.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('Blocked: ${s.blockedApps.join(', ')}'),
            ],
          ],
        ),
      ),
    );
  }
}
