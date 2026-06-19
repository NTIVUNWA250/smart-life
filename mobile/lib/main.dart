import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_shell.dart';
import 'shared/theme.dart';
import 'state/app_state.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final appState = AppState(ApiClient());
  await appState.bootstrap();
  runApp(SmartLifeApp(appState: appState));
}

class SmartLifeApp extends StatelessWidget {
  const SmartLifeApp({super.key, required this.appState});

  final AppState appState;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SMART LIFE',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: AuthGate(appState: appState),
    );
  }
}

/// Shows the login screen when signed out and the app shell when signed in.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key, required this.appState});

  final AppState appState;

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
        return HomeShell(appState: appState);
      },
    );
  }
}
