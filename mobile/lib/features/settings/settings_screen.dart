import 'package:flutter/material.dart';

import '../../state/app_state.dart';
import '../../state/theme_controller.dart';

/// Settings: appearance (Light / Dark / System theme buttons) and account.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({
    super.key,
    required this.appState,
    required this.themeController,
  });

  final AppState appState;
  final ThemeController themeController;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Appearance', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          ListenableBuilder(
            listenable: themeController,
            builder: (context, _) {
              return SegmentedButton<ThemeMode>(
                segments: const [
                  ButtonSegment(
                    value: ThemeMode.light,
                    label: Text('Light'),
                    icon: Icon(Icons.light_mode_outlined),
                  ),
                  ButtonSegment(
                    value: ThemeMode.dark,
                    label: Text('Dark'),
                    icon: Icon(Icons.dark_mode_outlined),
                  ),
                  ButtonSegment(
                    value: ThemeMode.system,
                    label: Text('System'),
                    icon: Icon(Icons.brightness_auto_outlined),
                  ),
                ],
                selected: {themeController.mode},
                onSelectionChanged: (s) => themeController.setMode(s.first),
              );
            },
          ),
          const Divider(height: 32),
          Text('Account', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (appState.user != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.person_outline),
              title: Text(appState.user!.name),
              subtitle: Text(appState.user!.email),
            ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => appState.logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Log out'),
          ),
        ],
      ),
    );
  }
}
