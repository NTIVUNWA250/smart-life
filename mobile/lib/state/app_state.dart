import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/models.dart';

/// Holds the authenticated user and brokers access to the [ApiClient].
/// A small [ChangeNotifier] keeps state simple — no heavy framework (see README).
class AppState extends ChangeNotifier {
  AppState(this.api);

  final ApiClient api;

  User? _user;
  bool _booting = true;

  User? get user => _user;
  bool get booting => _booting;
  bool get isAuthenticated => _user != null;

  /// Restores any saved session on startup.
  Future<void> bootstrap() async {
    await api.bootstrap();
    if (api.isAuthenticated) {
      try {
        _user = await api.me();
      } catch (_) {
        _user = null;
      }
    }
    _booting = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final result = await api.login(email, password);
    _user = result.user;
    notifyListeners();
  }

  Future<void> signup({
    required String name,
    required String email,
    required String password,
    String role = 'student',
  }) async {
    final result = await api.signup(
      name: name,
      email: email,
      password: password,
      role: role,
    );
    _user = result.user;
    notifyListeners();
  }

  Future<void> logout() async {
    await api.logout();
    _user = null;
    notifyListeners();
  }
}
