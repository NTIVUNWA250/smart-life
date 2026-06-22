package rw.smartlife.smartlife

import android.app.AlertDialog
import android.content.Intent
import android.content.pm.ResolveInfo
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Native bridge for SMART LIFE screen-time (FR5).
 *
 * Implements the `pickApp` method of the `smartlife/screentime` MethodChannel:
 * it lists the launchable apps installed on the device and lets the user pick
 * one to block, returning `{ id: <package>, label: <app name> }` (or null if the
 * user cancels). Dart's [ScreenTimeNative.pickApp] consumes this.
 *
 * Package visibility: on Android 11+ (API 30) querying other apps requires a
 * `<queries>` declaration (added in AndroidManifest.xml) — or the sensitive
 * `QUERY_ALL_PACKAGES` permission for a full list. A launcher-intent query needs
 * only the `<queries>` entry, which is what the picker below uses.
 *
 * NOTE: this scaffolds *selection* only. Actually enforcing a block still needs a
 * UsageStats + Accessibility/overlay foreground service, added separately.
 */
class MainActivity : FlutterActivity() {
    private val channelName = "smartlife/screentime"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "pickApp" -> showAppPicker(result)
                    else -> result.notImplemented()
                }
            }
    }

    /** Lists launchable apps and shows a picker; replies once with the choice or null. */
    private fun showAppPicker(result: MethodChannel.Result) {
        val apps = launchableApps()
        if (apps.isEmpty()) {
            result.success(null)
            return
        }

        val labels = apps.map { it.label }.toTypedArray()
        var replied = false
        fun reply(value: Any?) {
            if (!replied) {
                replied = true
                result.success(value)
            }
        }

        AlertDialog.Builder(this)
            .setTitle("Choose an app to block")
            .setItems(labels) { _, which ->
                val app = apps[which]
                reply(mapOf("id" to app.packageName, "label" to app.label))
            }
            .setOnCancelListener { reply(null) }
            .show()
    }

    private data class AppInfo(val packageName: String, val label: String)

    private fun launchableApps(): List<AppInfo> {
        val pm = packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)

        @Suppress("DEPRECATION")
        val resolved: List<ResolveInfo> = pm.queryIntentActivities(intent, 0)

        return resolved
            .mapNotNull { info ->
                val pkg = info.activityInfo?.packageName ?: return@mapNotNull null
                if (pkg == packageName) null // skip our own app
                else AppInfo(pkg, info.loadLabel(pm).toString())
            }
            .distinctBy { it.packageName }
            .sortedBy { it.label.lowercase() }
    }
}
