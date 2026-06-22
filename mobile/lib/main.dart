import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_shell.dart';
import 'shared/theme.dart';
import 'state/app_state.dart';
import 'state/theme_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final appState = AppState(ApiClient());
  final themeController = ThemeController();
  await Future.wait([appState.bootstrap(), themeController.load()]);
  runApp(SmartLifeApp(appState: appState, themeController: themeController));
}

class SmartLifeApp extends StatelessWidget {
  const SmartLifeApp({
    super.key,
    required this.appState,
    required this.themeController,
  });

  final AppState appState;
  final ThemeController themeController;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: themeController,
      builder: (context, _) {
        return MaterialApp(
          title: 'SMART LIFE',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: themeController.mode,
          home: AuthGate(appState: appState, themeController: themeController),
        );
      },
    );
  }
}

/// Shows the login screen when signed out and the app shell when signed in.
class AuthGate extends StatelessWidget {
  const AuthGate({
    super.key,
    required this.appState,
    required this.themeController,
  });

  final AppState appState;
  final ThemeController themeController;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        if (appState.booting) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        if (!appState.isAuthenticated) {
          return LoginScreen(appState: appState);
        }
        return HomeShell(appState: appState, themeController: themeController);
      },
    );
  }
}
