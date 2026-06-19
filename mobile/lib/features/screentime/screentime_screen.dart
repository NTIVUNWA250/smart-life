import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../api/models.dart';
import '../../shared/format.dart';
import '../../shared/widgets.dart';
import 'screentime_native.dart';

/// Screen-time limits: list policies, set a daily limit, and sync usage from the
/// (stubbed) OS provider to the backend.
class ScreenTimeScreen extends StatefulWidget {
  const ScreenTimeScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<ScreenTimeScreen> createState() => _ScreenTimeScreenState();
}

class _ScreenTimeScreenState extends State<ScreenTimeScreen> {
  static const _native = ScreenTimeNative();
  late Future<List<ScreenTimePolicy>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.listPolicies();
  }

  void _reload() => setState(() => _future = widget.api.listPolicies());

  Future<void> _addPolicy() async {
    final result = await showDialog<({String app, int min})>(
      context: context,
      builder: (_) => const _AddPolicyDialog(),
    );
    if (result == null) return;
    await widget.api.upsertPolicy(result.app, result.min);
    _reload();
  }

  /// Pulls usage from the OS provider stub and reports it to the backend, which
  /// applies the daily limits and may block apps.
  Future<void> _syncUsage(List<ScreenTimePolicy> policies) async {
    final usage = await _native.usageFor(policies.map((p) => p.appOrSite).toList());
    final payload = usage.entries
        .map((e) => <String, Object>{'appOrSite': e.key, 'usedMin': e.value})
        .toList();
    await widget.api.reportUsage(payload);
    if (mounted) {
      showSnack(context, 'Usage synced from device.');
      _reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Screen time')),
      body: FutureBuilder<List<ScreenTimePolicy>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ErrorRetry(message: snap.error.toString(), onRetry: _reload);
          }
          final policies = snap.data!;
          if (policies.isEmpty) {
            return const EmptyState(
              icon: Icons.timer_outlined,
              message: 'No screen-time limits yet.\nTap + to add one.',
            );
          }
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: OutlinedButton.icon(
                  onPressed: () => _syncUsage(policies),
                  icon: const Icon(Icons.sync),
                  label: const Text('Sync usage from device'),
                ),
              ),
              Expanded(
                child: ListView.separated(
                  itemCount: policies.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final p = policies[i];
                    return ListTile(
                      title: Text(p.appOrSite),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${Format.minutes(p.usedMin)} / ${Format.minutes(p.dailyLimitMin)}'),
                          const SizedBox(height: 4),
                          LinearProgressIndicator(
                            value: p.usage,
                            color: p.isBlocked ? Theme.of(context).colorScheme.error : null,
                          ),
                        ],
                      ),
                      trailing: p.isBlocked
                          ? StatusBadge(label: 'BLOCKED', color: Theme.of(context).colorScheme.error)
                          : null,
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _addPolicy,
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _AddPolicyDialog extends StatefulWidget {
  const _AddPolicyDialog();

  @override
  State<_AddPolicyDialog> createState() => _AddPolicyDialogState();
}

class _AddPolicyDialogState extends State<_AddPolicyDialog> {
  final _app = TextEditingController();
  final _min = TextEditingController(text: '60');

  @override
  void dispose() {
    _app.dispose();
    _min.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Set a daily limit'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _app,
            decoration: const InputDecoration(labelText: 'App or site (e.g. instagram)'),
          ),
          TextField(
            controller: _min,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Daily limit (minutes)'),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            final app = _app.text.trim();
            final min = int.tryParse(_min.text);
            if (app.isEmpty || min == null || min < 0) return;
            Navigator.pop(context, (app: app, min: min));
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}
