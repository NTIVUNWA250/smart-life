import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../api/models.dart';
import '../../shared/format.dart';
import '../../shared/widgets.dart';

/// Money area: spending limit + payment check, plus Transactions and Goals tabs.
class MoneyScreen extends StatefulWidget {
  const MoneyScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<MoneyScreen> createState() => _MoneyScreenState();
}

class _MoneyScreenState extends State<MoneyScreen> {
  late Future<_MoneyData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_MoneyData> _load() async {
    final results = await Future.wait([
      widget.api.currentLimit(),
      widget.api.listTransactions(limit: 50),
      widget.api.listGoals(),
    ]);
    return _MoneyData(
      limit: results[0] as SpendingLimit,
      transactions: results[1] as List<Transaction>,
      goals: results[2] as List<Goal>,
    );
  }

  void _reload() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Money'),
          bottom: const TabBar(tabs: [Tab(text: 'Transactions'), Tab(text: 'Goals')]),
        ),
        body: FutureBuilder<_MoneyData>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorRetry(message: snap.error.toString(), onRetry: _reload);
            }
            final data = snap.data!;
            return Column(
              children: [
                _LimitHeader(limit: data.limit, api: widget.api),
                Expanded(
                  child: TabBarView(
                    children: [
                      _TransactionsTab(
                        api: widget.api,
                        transactions: data.transactions,
                        onChanged: _reload,
                      ),
                      _GoalsTab(api: widget.api, goals: data.goals, onChanged: _reload),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _MoneyData {
  _MoneyData({required this.limit, required this.transactions, required this.goals});
  final SpendingLimit limit;
  final List<Transaction> transactions;
  final List<Goal> goals;
}

class _LimitHeader extends StatelessWidget {
  const _LimitHeader({required this.limit, required this.api});
  final SpendingLimit limit;
  final ApiClient api;

  Future<void> _checkPayment(BuildContext context) async {
    final amount = await _promptAmount(context, 'Check a payment (RWF)');
    if (amount == null) return;
    try {
      final result = await api.checkPayment(amount);
      if (!context.mounted) return;
      showSnack(
        context,
        result.allowed
            ? 'Allowed — ${Format.rwf(amount)} is within your limit.'
            : 'Blocked — ${result.reason ?? 'over your limit'}.',
      );
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('This month'),
                if (limit.isBlocked)
                  StatusBadge(label: 'BLOCKED', color: Theme.of(context).colorScheme.error),
              ],
            ),
            const SizedBox(height: 6),
            Text('${Format.rwf(limit.spentRwf)} / ${Format.rwf(limit.limitRwf)}',
                style: Theme.of(context).textTheme.titleLarge),
            Text('${Format.rwf(limit.remainingRwf)} left'),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: limit.usage,
              color: limit.isBlocked ? Theme.of(context).colorScheme.error : null,
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => _checkPayment(context),
              icon: const Icon(Icons.payments_outlined),
              label: const Text('Check a payment'),
            ),
          ],
        ),
      ),
    );
  }
}

class _TransactionsTab extends StatelessWidget {
  const _TransactionsTab({
    required this.api,
    required this.transactions,
    required this.onChanged,
  });

  final ApiClient api;
  final List<Transaction> transactions;
  final VoidCallback onChanged;

  Future<void> _add(BuildContext context) async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddTransactionSheet(api: api),
    );
    if (added == true) onChanged();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: transactions.isEmpty
          ? const EmptyState(icon: Icons.receipt_long, message: 'No transactions yet.')
          : ListView.separated(
              itemCount: transactions.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final t = transactions[i];
                return ListTile(
                  leading: Icon(
                    t.isIncome ? Icons.arrow_downward : Icons.arrow_upward,
                    color: t.isIncome ? Colors.green : Colors.red,
                  ),
                  title: Text(t.category),
                  subtitle: Text('${t.note ?? ''}${t.note != null ? ' · ' : ''}${Format.date(t.occurredAt)}'),
                  trailing: Text(
                    '${t.isIncome ? '+' : '−'}${Format.rwf(t.amountRwf)}',
                    style: TextStyle(
                      color: t.isIncome ? Colors.green : Colors.red,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _add(context),
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _AddTransactionSheet extends StatefulWidget {
  const _AddTransactionSheet({required this.api});
  final ApiClient api;

  @override
  State<_AddTransactionSheet> createState() => _AddTransactionSheetState();
}

class _AddTransactionSheetState extends State<_AddTransactionSheet> {
  final _amount = TextEditingController();
  final _category = TextEditingController();
  String _type = 'expense';
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    _category.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final amount = int.tryParse(_amount.text);
    if (amount == null || amount <= 0) return;
    setState(() => _busy = true);
    try {
      await widget.api.createTransaction(
        type: _type,
        amountRwf: amount,
        category: _category.text.trim(),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showSnack(context, e.toString());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Add transaction', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'expense', label: Text('Expense')),
              ButtonSegment(value: 'income', label: Text('Income')),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() => _type = s.first),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Amount (RWF)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _category,
            decoration: const InputDecoration(labelText: 'Category (e.g. food)'),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: _busy
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save'),
          ),
        ],
      ),
    );
  }
}

class _GoalsTab extends StatelessWidget {
  const _GoalsTab({required this.api, required this.goals, required this.onChanged});

  final ApiClient api;
  final List<Goal> goals;
  final VoidCallback onChanged;

  Future<void> _addGoal(BuildContext context) async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddGoalSheet(api: api),
    );
    if (added == true) onChanged();
  }

  Future<void> _addSavings(BuildContext context, Goal goal) async {
    final amount = await _promptAmount(context, 'Add savings to "${goal.title}"');
    if (amount == null) return;
    await api.addGoalSavings(goal.id, amount);
    onChanged();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: goals.isEmpty
          ? const EmptyState(icon: Icons.savings_outlined, message: 'No goals yet.')
          : ListView(
              padding: const EdgeInsets.all(12),
              children: goals.map((g) {
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(child: Text(g.title, style: const TextStyle(fontWeight: FontWeight.w600))),
                            StatusBadge(
                              label: g.status,
                              color: g.status == 'achieved' ? Colors.green : Colors.blueGrey,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text('${Format.rwf(g.savedRwf)} / ${Format.rwf(g.targetRwf)} · due ${Format.date(g.deadline)}'),
                        const SizedBox(height: 8),
                        LinearProgressIndicator(value: g.progress),
                        const SizedBox(height: 8),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: g.status == 'achieved' ? null : () => _addSavings(context, g),
                            child: const Text('Add savings'),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _addGoal(context),
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _AddGoalSheet extends StatefulWidget {
  const _AddGoalSheet({required this.api});
  final ApiClient api;

  @override
  State<_AddGoalSheet> createState() => _AddGoalSheetState();
}

class _AddGoalSheetState extends State<_AddGoalSheet> {
  final _title = TextEditingController();
  final _target = TextEditingController();
  DateTime? _deadline;
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _target.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: DateTime(now.year + 5),
      initialDate: now.add(const Duration(days: 30)),
    );
    if (picked != null) setState(() => _deadline = picked);
  }

  Future<void> _save() async {
    final target = int.tryParse(_target.text);
    if (_title.text.trim().isEmpty || target == null || target <= 0 || _deadline == null) {
      showSnack(context, 'Fill in title, target and deadline.');
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.api.createGoal(
        title: _title.text.trim(),
        targetRwf: target,
        deadline: _deadline!,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showSnack(context, e.toString());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('New savings goal', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title')),
          const SizedBox(height: 12),
          TextField(
            controller: _target,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Target (RWF)'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(_deadline == null ? 'No deadline chosen' : 'Due ${Format.date(_deadline!)}'),
              ),
              TextButton(onPressed: _pickDate, child: const Text('Pick date')),
            ],
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: _busy
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Create goal'),
          ),
        ],
      ),
    );
  }
}

/// Shared numeric prompt dialog returning a positive int, or null if cancelled.
Future<int?> _promptAmount(BuildContext context, String title) async {
  final controller = TextEditingController();
  final value = await showDialog<int>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        autofocus: true,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Amount (RWF)'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.pop(context, int.tryParse(controller.text)),
          child: const Text('OK'),
        ),
      ],
    ),
  );
  if (value == null || value <= 0) return null;
  return value;
}
