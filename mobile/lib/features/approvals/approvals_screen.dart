import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../shared/format.dart';
import '../../shared/widgets.dart';
import '../../state/app_state.dart';

/// Approvals + peer links. Approvers review override and link requests; students
/// link approvers and request to unblock their spending.
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key, required this.appState});

  final AppState appState;

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  late Future<_ApprovalsData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_ApprovalsData> _load() async {
    final api = widget.appState.api;
    final results = await Future.wait([
      api.listApprovals('approver'),
      api.listPeers(),
    ]);
    return _ApprovalsData(
      incoming: results[0] as List<Approval>,
      peers: results[1] as PeerLinks,
    );
  }

  void _reload() => setState(() => _future = _load());

  Future<void> _linkApprover() async {
    final result = await showDialog<({String email, String rel})>(
      context: context,
      builder: (_) => const _LinkApproverDialog(),
    );
    if (result == null) return;
    try {
      await widget.appState.api.linkApprover(result.email, result.rel);
      if (mounted) showSnack(context, 'Request sent.');
      _reload();
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _requestUnblock(List<PeerLink> approvers) async {
    final accepted = approvers.where((l) => l.status == 'accepted').toList();
    if (accepted.isEmpty) {
      showSnack(context, 'Link an approver first.');
      return;
    }
    final chosen = await showDialog<PeerLink>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Ask who to unblock you?'),
        children: accepted
            .map((l) => SimpleDialogOption(
                  onPressed: () => Navigator.pop(context, l),
                  child: Text('${l.approver?.name ?? l.approver?.email} (${l.relationship})'),
                ))
            .toList(),
      ),
    );
    if (chosen == null) return;
    try {
      await widget.appState.api.requestApproval(
        approverId: chosen.approver!.id,
        kind: 'spending',
        targetId: 'current',
        reason: 'Please unblock my spending for this month.',
      );
      if (mounted) showSnack(context, 'Override request sent.');
      _reload();
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Approvals')),
      body: FutureBuilder<_ApprovalsData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ErrorRetry(message: snap.error.toString(), onRetry: _reload);
          }
          final data = snap.data!;
          final pendingApprovals = data.incoming.where((a) => a.status == 'pending').toList();
          final pendingLinks = data.peers.asApprover.where((l) => l.status == 'pending').toList();

          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: [
                _section('Override requests for you'),
                if (pendingApprovals.isEmpty)
                  const _Muted('No pending override requests.')
                else
                  ...pendingApprovals.map((a) => _ApprovalTile(approval: a, onDecide: _decideApproval)),

                const SizedBox(height: 16),
                _section('People asking you to be their approver'),
                if (pendingLinks.isEmpty)
                  const _Muted('No pending link requests.')
                else
                  ...pendingLinks.map((l) => _LinkTile(link: l, onDecide: _decidePeer)),

                const SizedBox(height: 16),
                _section('Your approvers'),
                ...data.peers.asStudent.map((l) => ListTile(
                      title: Text(l.approver?.name ?? l.approver?.email ?? 'Unknown'),
                      subtitle: Text('${l.approver?.email ?? ''} · ${l.relationship}'),
                      trailing: StatusBadge(
                        label: l.status,
                        color: l.status == 'accepted'
                            ? Colors.green
                            : l.status == 'rejected'
                                ? Theme.of(context).colorScheme.error
                                : Colors.orange,
                      ),
                    )),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _linkApprover,
                      icon: const Icon(Icons.person_add_alt),
                      label: const Text('Link approver'),
                    ),
                    FilledButton.icon(
                      onPressed: () => _requestUnblock(data.peers.asStudent),
                      icon: const Icon(Icons.lock_open),
                      label: const Text('Request unblock'),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _decideApproval(String id, String status) async {
    await widget.appState.api.decideApproval(id, status);
    _reload();
  }

  Future<void> _decidePeer(String id, String status) async {
    await widget.appState.api.decidePeer(id, status);
    _reload();
  }

  Widget _section(String title) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
      );
}

class _ApprovalsData {
  _ApprovalsData({required this.incoming, required this.peers});
  final List<Approval> incoming;
  final PeerLinks peers;
}

class _ApprovalTile extends StatelessWidget {
  const _ApprovalTile({required this.approval, required this.onDecide});

  final Approval approval;
  final Future<void> Function(String id, String status) onDecide;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text('${approval.requester?.name ?? 'Someone'} · ${approval.kind}'),
        subtitle: Text('${approval.reason ?? 'No reason'} · ${Format.date(approval.createdAt)}'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.check_circle, color: Colors.green),
              onPressed: () => onDecide(approval.id, 'approved'),
            ),
            IconButton(
              icon: Icon(Icons.cancel, color: Theme.of(context).colorScheme.error),
              onPressed: () => onDecide(approval.id, 'denied'),
            ),
          ],
        ),
      ),
    );
  }
}

class _LinkTile extends StatelessWidget {
  const _LinkTile({required this.link, required this.onDecide});

  final PeerLink link;
  final Future<void> Function(String id, String status) onDecide;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(link.student?.name ?? 'Someone'),
        subtitle: Text('${link.student?.email ?? ''} · wants you as ${link.relationship}'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.check_circle, color: Colors.green),
              onPressed: () => onDecide(link.id, 'accepted'),
            ),
            IconButton(
              icon: Icon(Icons.cancel, color: Theme.of(context).colorScheme.error),
              onPressed: () => onDecide(link.id, 'rejected'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Muted extends StatelessWidget {
  const _Muted(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(text, style: TextStyle(color: Theme.of(context).colorScheme.outline)),
    );
  }
}

class _LinkApproverDialog extends StatefulWidget {
  const _LinkApproverDialog();

  @override
  State<_LinkApproverDialog> createState() => _LinkApproverDialogState();
}

class _LinkApproverDialogState extends State<_LinkApproverDialog> {
  final _email = TextEditingController();
  String _rel = 'peer';

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Link an approver'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Approver email'),
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'peer', label: Text('Peer')),
              ButtonSegment(value: 'parent', label: Text('Parent')),
            ],
            selected: {_rel},
            onSelectionChanged: (s) => setState(() => _rel = s.first),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            final email = _email.text.trim();
            if (!email.contains('@')) return;
            Navigator.pop(context, (email: email, rel: _rel));
          },
          child: const Text('Send'),
        ),
      ],
    );
  }
}
