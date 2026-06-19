import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';
import 'models.dart';

/// Thrown for any non-2xx backend response. [message] is safe to show to users.
class ApiException implements Exception {
  ApiException(this.statusCode, this.code, this.message);

  final int statusCode;
  final String code;
  final String message;

  @override
  String toString() => message;
}

/// HTTP client for the SMART LIFE backend. Injects the bearer token, persists
/// tokens via shared_preferences, and transparently refreshes on a 401.
class ApiClient {
  ApiClient({http.Client? client}) : _http = client ?? http.Client();

  static const _accessKey = 'smartlife.accessToken';
  static const _refreshKey = 'smartlife.refreshToken';

  final http.Client _http;
  String? _accessToken;
  String? _refreshToken;

  bool get isAuthenticated => _accessToken != null;

  /// Loads any persisted tokens. Call once at startup.
  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString(_accessKey);
    _refreshToken = prefs.getString(_refreshKey);
  }

  Future<void> _saveTokens(String access, String refresh) async {
    _accessToken = access;
    _refreshToken = refresh;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessKey, access);
    await prefs.setString(_refreshKey, refresh);
  }

  Future<void> _clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessKey);
    await prefs.remove(_refreshKey);
  }

  Uri _uri(String path) => Uri.parse('${AppConfig.apiBaseUrl}$path');

  Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
    bool auth = true,
    bool retried = false,
  }) async {
    final headers = <String, String>{};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (auth && _accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }

    final res = await _http.send(
      _buildRequest(method, _uri(path), headers, body),
    );
    final streamed = await http.Response.fromStream(res);

    if (streamed.statusCode == 401 && auth && !retried) {
      if (await _refresh()) {
        return _send(method, path, body: body, auth: auth, retried: true);
      }
      await _clearTokens();
    }

    if (streamed.statusCode == 204 || streamed.body.isEmpty) return null;

    final dynamic data = jsonDecode(streamed.body);
    if (streamed.statusCode >= 200 && streamed.statusCode < 300) return data;

    final err = (data is Map && data['error'] is Map) ? data['error'] as Map : null;
    throw ApiException(
      streamed.statusCode,
      err?['code']?.toString() ?? 'error',
      err?['message']?.toString() ?? 'Request failed (${streamed.statusCode})',
    );
  }

  http.Request _buildRequest(
    String method,
    Uri uri,
    Map<String, String> headers,
    Object? body,
  ) {
    final req = http.Request(method, uri);
    req.headers.addAll(headers);
    if (body != null) req.body = jsonEncode(body);
    return req;
  }

  Future<bool> _refresh() async {
    if (_refreshToken == null) return false;
    try {
      final res = await _http.post(
        _uri('/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': _refreshToken}),
      );
      if (res.statusCode != 200) return false;
      final tokens = (jsonDecode(res.body)['tokens']) as Map<String, dynamic>;
      await _saveTokens(
        tokens['accessToken'] as String,
        tokens['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  // ---- Auth ----------------------------------------------------------------

  Future<AuthResult> login(String email, String password) async {
    final data = await _send('POST', '/auth/login',
        body: {'email': email, 'password': password}, auth: false);
    final result = AuthResult.fromJson(data as Map<String, dynamic>);
    await _saveTokens(result.accessToken, result.refreshToken);
    return result;
  }

  Future<AuthResult> signup({
    required String name,
    required String email,
    required String password,
    String role = 'student',
  }) async {
    final data = await _send('POST', '/auth/signup',
        body: {'name': name, 'email': email, 'password': password, 'role': role},
        auth: false);
    final result = AuthResult.fromJson(data as Map<String, dynamic>);
    await _saveTokens(result.accessToken, result.refreshToken);
    return result;
  }

  Future<User> me() async {
    final data = await _send('GET', '/auth/me');
    return User.fromJson((data as Map<String, dynamic>)['user'] as Map<String, dynamic>);
  }

  Future<void> logout() async {
    if (_refreshToken != null) {
      try {
        await _send('POST', '/auth/logout', body: {'refreshToken': _refreshToken});
      } catch (_) {/* ignore network errors on logout */}
    }
    await _clearTokens();
  }

  // ---- Transactions --------------------------------------------------------

  Future<List<Transaction>> listTransactions({int limit = 50}) async {
    final data = await _send('GET', '/transactions?limit=$limit');
    return ((data as Map<String, dynamic>)['items'] as List)
        .map((e) => Transaction.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> createTransaction({
    required String type,
    required int amountRwf,
    String? category,
    String? note,
  }) async {
    await _send('POST', '/transactions', body: {
      'type': type,
      'amountRwf': amountRwf,
      if (category != null && category.isNotEmpty) 'category': category,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  Future<void> deleteTransaction(String id) =>
      _send('DELETE', '/transactions/$id');

  // ---- Goals ---------------------------------------------------------------

  Future<List<Goal>> listGoals() async {
    final data = await _send('GET', '/goals');
    return ((data as Map<String, dynamic>)['items'] as List)
        .map((e) => Goal.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> createGoal({
    required String title,
    required int targetRwf,
    required DateTime deadline,
  }) async {
    await _send('POST', '/goals', body: {
      'title': title,
      'targetRwf': targetRwf,
      'deadline': deadline.toUtc().toIso8601String(),
    });
  }

  Future<void> addGoalSavings(String id, int addSavedRwf) =>
      _send('PATCH', '/goals/$id', body: {'addSavedRwf': addSavedRwf});

  // ---- Limits --------------------------------------------------------------

  Future<SpendingLimit> currentLimit() async {
    final data = await _send('GET', '/limits/current');
    return SpendingLimit.fromJson(
        (data as Map<String, dynamic>)['limit'] as Map<String, dynamic>);
  }

  Future<PaymentCheck> checkPayment(int amountRwf) async {
    final data = await _send('POST', '/limits/check', body: {'amountRwf': amountRwf});
    return PaymentCheck.fromJson(data as Map<String, dynamic>);
  }

  // ---- Screen time ---------------------------------------------------------

  Future<List<ScreenTimePolicy>> listPolicies() async {
    final data = await _send('GET', '/screentime/policies');
    return ((data as Map<String, dynamic>)['items'] as List)
        .map((e) => ScreenTimePolicy.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> upsertPolicy(String appOrSite, int dailyLimitMin) =>
      _send('POST', '/screentime/policies',
          body: {'appOrSite': appOrSite, 'dailyLimitMin': dailyLimitMin});

  Future<List<ScreenTimePolicy>> reportUsage(
      List<Map<String, Object>> usage) async {
    final data = await _send('POST', '/screentime/usage', body: {'usage': usage});
    return ((data as Map<String, dynamic>)['items'] as List)
        .map((e) => ScreenTimePolicy.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ---- Peers ---------------------------------------------------------------

  Future<PeerLinks> listPeers() async {
    final data = await _send('GET', '/peers');
    return PeerLinks.fromJson(data as Map<String, dynamic>);
  }

  Future<void> linkApprover(String approverEmail, String relationship) =>
      _send('POST', '/peers',
          body: {'approverEmail': approverEmail, 'relationship': relationship});

  Future<void> decidePeer(String id, String status) =>
      _send('PATCH', '/peers/$id', body: {'status': status});

  // ---- Approvals -----------------------------------------------------------

  Future<List<Approval>> listApprovals(String role) async {
    final data = await _send('GET', '/approvals?role=$role');
    return ((data as Map<String, dynamic>)['items'] as List)
        .map((e) => Approval.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> requestApproval({
    required String approverId,
    required String kind,
    required String targetId,
    String? reason,
  }) =>
      _send('POST', '/approvals', body: {
        'approverId': approverId,
        'kind': kind,
        'targetId': targetId,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      });

  Future<void> decideApproval(String id, String status) =>
      _send('PATCH', '/approvals/$id', body: {'status': status});

  // ---- Analytics -----------------------------------------------------------

  Future<AnalyticsSummary> analyticsSummary() async {
    final data = await _send('GET', '/analytics/summary');
    return AnalyticsSummary.fromJson(data as Map<String, dynamic>);
  }
}
