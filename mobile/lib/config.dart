/// Build-time configuration for the SMART LIFE app.
///
/// The API base URL is read from the `API_URL` dart-define so the same build
/// can target a local backend, a staging server, or production:
///
/// ```bash
/// flutter run --dart-define=API_URL=https://api.smartlife.rw/api/v1
/// ```
///
/// The default points at `10.0.2.2`, which is how the Android emulator reaches
/// the host machine's `localhost` (where `backend` runs on port 4000).
class AppConfig {
  const AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );
}
