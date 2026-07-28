import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../api/models.dart';
import '../../shared/format.dart';
import '../../shared/widgets.dart';
import 'screentime_native.dart';

/// Screen-time limits: block an app or a website for a daily time budget, and
/// sync usage from the (stubbed) OS provider to the backend.
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

  Future<void> _save(String appOrSite, int min, {required String kind, String? label}) async {
    try {
      await widget.api.upsertPolicy(appOrSite, min, kind: kind, label: label);
      _reload();
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  /// Choose what to block: an installed app, or a website URL.
  Future<void> _addPolicy() async {
    final kind = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.apps),
              title: const Text('Block an app'),
              subtitle: const Text('Choose an app installed on your phone'),
              onTap: () => Navigator.pop(context, 'app'),
            ),
            ListTile(
              leading: const Icon(Icons.language),
              title: const Text('Block a website'),
              subtitle: const Text('Enter a domain or full URL'),
              onTap: () => Navigator.pop(context, 'url'),
            ),
          ],
        ),
      ),
    );
    if (!mounted) return;
    if (kind == 'app') {
      await _addApp();
    } else if (kind == 'url') {
      await _addWebsite();
    }
  }

  Future<void> _addApp() async {
    // Try the native picker first; fall back to a curated list if unavailable.
    var choice = await _native.pickApp();
    if (!mounted) return;
    choice ??= await _pickFromCommonApps();
    if (choice == null || !mounted) return;

    final min = await _askMinutes('Daily limit for ${choice.label}');
    if (min == null) return;
    await _save(choice.id, min, kind: 'app', label: choice.label);
  }

  Future<AppChoice?> _pickFromCommonApps() {
    return showModalBottomSheet<AppChoice>(
      context: context,
      builder: (_) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Choose an app', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            for (final app in ScreenTimeNative.commonApps)
              ListTile(
                leading: const Icon(Icons.apps),
                title: Text(app.label),
                subtitle: Text(app.id),
                onTap: () => Navigator.pop(context, app),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _addWebsite() async {
    final result = await showDialog<({String url, int min})>(
      context: context,
      builder: (_) => const _WebsiteDialog(),
    );
    if (result == null) return;
    // The backend normalises the domain/URL to a host and labels it.
    await _save(result.url, result.min, kind: 'url');
  }

  Future<int?> _askMinutes(String title) {
    return showDialog<int>(
      context: context,
      builder: (_) => _MinutesDialog(title: title),
    );
  }

  /// Pulls today's usage from the OS and reports it to the backend, which applies
  /// the daily limits and may block apps.
  Future<void> _syncUsage(List<ScreenTimePolicy> policies) async {
    final Map<String, int> usage;
    try {
      usage = await _native.usageFor(policies.map((p) => p.appOrSite).toList());
    } on ScreenTimePermissionException {
      if (mounted) await _promptForUsageAccess();
      return;
    }

    final payload = usage.entries
        .map((e) => <String, Object>{'appOrSite': e.key, 'usedMin': e.value})
        .toList();
    // The backend rejects an empty report, and there is nothing to say anyway.
    if (payload.isEmpty) {
      if (mounted) {
        showSnack(context, 'No usage to report yet for these limits.');
      }
      return;
    }

    try {
      await widget.api.reportUsage(payload);
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
      return;
    }
    if (mounted) {
      showSnack(context, 'Usage synced from device.');
      _reload();
    }
  }

  /// Usage access is a Settings toggle, not a runtime permission, so the best we
  /// can do is explain and open the right screen.
  Future<void> _promptForUsageAccess() async {
    final grant = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Allow usage access'),
        content: const Text(
          'To measure how long you spend in each app, SMART LIFE needs usage '
          'access. Find SMART LIFE in the list on the next screen and turn it on.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Not now'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Open settings'),
          ),
        ],
      ),
    );
    if (grant != true) return;

    final opened = await _native.openUsageAccessSettings();
    if (!opened && mounted) {
      showSnack(context, 'This device has no usage-access screen.');
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
              message: 'No screen-time limits yet.\nTap + to block an app or website.',
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
                      leading: Icon(p.isApp ? Icons.apps : Icons.language),
                      title: Text(p.displayName),
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

/// Asks for a website (domain or full URL) and a daily minute budget.
class _WebsiteDialog extends StatefulWidget {
  const _WebsiteDialog();

  @override
  State<_WebsiteDialog> createState() => _WebsiteDialogState();
}

class _WebsiteDialogState extends State<_WebsiteDialog> {
  final _url = TextEditingController();
  final _min = TextEditingController(text: '60');
  String? _error;

  @override
  void dispose() {
    _url.dispose();
    _min.dispose();
    super.dispose();
  }

  void _submit() {
    final url = _url.text.trim();
    final min = int.tryParse(_min.text);
    // Light client-side check; the backend does the authoritative normalisation.
    final looksValid = url.isNotEmpty && url.contains('.') && !url.contains(' ');
    if (!looksValid) {
      setState(() => _error = 'Enter a valid domain or URL (e.g. instagram.com)');
      return;
    }
    if (min == null || min < 0) {
      setState(() => _error = 'Enter a valid number of minutes');
      return;
    }
    Navigator.pop(context, (url: url, min: min));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Block a website'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _url,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'Domain or URL',
              hintText: 'instagram.com',
              errorText: _error,
            ),
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
        FilledButton(onPressed: _submit, child: const Text('Save')),
      ],
    );
  }
}

/// Asks for a daily minute budget (used after an app is chosen).
class _MinutesDialog extends StatefulWidget {
  const _MinutesDialog({required this.title});

  final String title;

  @override
  State<_MinutesDialog> createState() => _MinutesDialogState();
}

class _MinutesDialogState extends State<_MinutesDialog> {
  final _min = TextEditingController(text: '60');

  @override
  void dispose() {
    _min.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _min,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Daily limit (minutes)'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            final min = int.tryParse(_min.text);
            if (min == null || min < 0) return;
            Navigator.pop(context, min);
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}
