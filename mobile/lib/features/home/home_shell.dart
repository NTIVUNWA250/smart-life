import 'package:flutter/material.dart';

import '../../state/app_state.dart';
import '../approvals/approvals_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../money/money_screen.dart';
import '../screentime/screentime_screen.dart';

/// Signed-in shell: bottom navigation across the four main areas.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.appState});

  final AppState appState;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final api = widget.appState.api;
    final screens = [
      DashboardScreen(appState: widget.appState),
      MoneyScreen(api: api),
      ScreenTimeScreen(api: api),
      ApprovalsScreen(appState: widget.appState),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), label: 'Money'),
          NavigationDestination(icon: Icon(Icons.timer_outlined), label: 'Time'),
          NavigationDestination(icon: Icon(Icons.verified_user_outlined), label: 'Approvals'),
        ],
      ),
    );
  }
}
