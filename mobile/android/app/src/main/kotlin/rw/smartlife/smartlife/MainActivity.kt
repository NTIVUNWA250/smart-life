package rw.smartlife.smartlife

import android.app.AlertDialog
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.os.Build
import android.os.Process
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.Calendar
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Native bridge for SMART LIFE screen-time (FR5).
 *
 * Implements the `pickApp` method of the `smartlife/screentime` MethodChannel:
 * it lists the launchable apps installed on the device and lets the user pick
 * one to block, returning `{ id: <package>, label: <app name> }` (or null if the
 * user cancels). Dart's [ScreenTimeNative.pickApp] consumes this.
 *
 * Package visibility: on Android 11+ (API 30) querying other apps requires a
 * `<queries>` declaration (added in AndroidManifest.xml) - or the sensitive
 * `QUERY_ALL_PACKAGES` permission for a full list. A launcher-intent query needs
 * only the `<queries>` entry, which is what the picker below uses.
 *
 * Usage (`usageFor`) reads `UsageStatsManager`. That needs the special
 * PACKAGE_USAGE_STATS access, which cannot be granted by a runtime dialog - the
 * user has to toggle it in Settings, so `hasUsageAccess` / `openUsageAccessSettings`
 * drive that hand-off from Dart.
 *
 * NOTE: this covers *selection* and *measurement* only. Actually enforcing a block
 * still needs an Accessibility/overlay foreground service, added separately.
 */
class MainActivity : FlutterActivity() {
    private val channelName = "smartlife/screentime"

    /**
     * Flutter dispatches MethodChannel calls on the platform (main) thread, and both
     * of the calls below are slow binder IPC - `loadLabel` is one round-trip into the
     * package manager *per installed app*, and `queryAndAggregateUsageStats` walks
     * every usage event since midnight. Doing either inline blocked the UI thread
     * long enough for Android to raise "isn't responding" (observed: 5044ms waiting
     * on a MotionEvent, with the CPU almost idle - blocked, not busy).
     *
     * So the work runs here and only the reply goes back to the main thread, which
     * is where MethodChannel.Result must be invoked.
     */
    private val work: ExecutorService = Executors.newSingleThreadExecutor()

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "pickApp" -> showAppPicker(result)
                    // Cheap app-op lookups; they stay inline.
                    "hasUsageAccess" -> result.success(hasUsageAccess())
                    "openUsageAccessSettings" -> result.success(openUsageAccessSettings())
                    "usageFor" -> usageFor(call.argument<List<String>>("apps"), result)
                    else -> result.notImplemented()
                }
            }
    }

    override fun onDestroy() {
        work.shutdownNow()
        super.onDestroy()
    }

    /**
     * Replies on the main thread, dropping the reply if the activity is already gone -
     * answering a dead engine would either crash or leak.
     */
    private fun replyOnMain(block: () -> Unit) {
        runOnUiThread {
            if (!isFinishing && !isDestroyed) block()
        }
    }

    /** Lists launchable apps and shows a picker; replies once with the choice or null. */
    private fun showAppPicker(result: MethodChannel.Result) {
        work.execute {
            // As in usageFor: a throw on this thread would take the process down
            // rather than reach Dart, so an empty list stands in and the picker
            // falls back to ScreenTimeNative.commonApps.
            val apps = try {
                launchableApps()
            } catch (e: Exception) {
                emptyList()
            }
            replyOnMain { showAppPickerDialog(apps, result) }
        }
    }

    private fun showAppPickerDialog(apps: List<AppInfo>, result: MethodChannel.Result) {
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

    /**
     * True when the user has granted usage access in Settings. This is an app-op,
     * not a runtime permission, so it is checked via [AppOpsManager] rather than
     * `checkSelfPermission` (which always reports denied for PACKAGE_USAGE_STATS).
     */
    private fun hasUsageAccess(): Boolean {
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName,
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName,
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /** Sends the user to the usage-access screen. False if no activity can handle it. */
    private fun openUsageAccessSettings(): Boolean {
        return try {
            startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
            true
        } catch (e: android.content.ActivityNotFoundException) {
            false
        }
    }

    /**
     * Foreground minutes so far today for each requested package, keyed by package
     * name. Ids that are not installed packages (e.g. website targets) are simply
     * absent from the reply rather than reported as zero, so the caller can tell
     * "no usage measured" from "not measurable here".
     *
     * The window starts at local midnight - that is the "today" the user sees on
     * their phone.
     */
    private fun usageFor(apps: List<String>?, result: MethodChannel.Result) {
        val wanted = apps?.filter { it.isNotBlank() }?.toSet().orEmpty()
        if (wanted.isEmpty()) {
            result.success(emptyMap<String, Int>())
            return
        }

        work.execute {
            if (!hasUsageAccess()) {
                replyOnMain {
                    result.error("PERMISSION_DENIED", "Usage access has not been granted.", null)
                }
                return@execute
            }

            val manager = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            if (manager == null) {
                replyOnMain {
                    result.error("UNAVAILABLE", "UsageStatsManager is unavailable.", null)
                }
                return@execute
            }

            val start = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
            val end = System.currentTimeMillis()

            val usage = try {
                val stats = manager.queryAndAggregateUsageStats(start, end)
                HashMap<String, Int>().apply {
                    for (pkg in wanted) {
                        val totalMs = stats[pkg]?.totalTimeInForeground ?: continue
                        put(pkg, TimeUnit.MILLISECONDS.toMinutes(totalMs).toInt())
                    }
                }
            } catch (e: Exception) {
                // Off the main thread an uncaught throw would kill the process rather
                // than surface in Dart, so it is turned into a channel error instead.
                replyOnMain { result.error("UNAVAILABLE", e.message ?: "Usage query failed.", null) }
                return@execute
            }

            replyOnMain { result.success(usage) }
        }
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
