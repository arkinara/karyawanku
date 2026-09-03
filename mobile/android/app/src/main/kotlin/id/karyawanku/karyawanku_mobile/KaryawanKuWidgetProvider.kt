package id.karyawanku.karyawanku_mobile

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider
import org.json.JSONObject

/**
 * KaryawanKu home-screen widget (ticket #74).
 *
 * Renders the cached shift + clock snapshot the Flutter side writes under
 * `kk_widget_snapshot` in the app's DEFAULT SharedPreferences (the same file
 * the `shared_preferences` plugin uses), so the widget and the app never
 * drift. The snapshot keys mirror `WidgetSnapshot.toJson()` in
 * `mobile/lib/core/widget/widget_state.dart` — keep them in sync.
 *
 * Taps deep-link into the app through `HomeWidgetLaunchIntent`; the app picks
 * the URI up via `HomeWidget.widgetClicked` / `initiallyLaunchedFromHomeWidget`
 * and runs the action (`clock_in` / `clock_out` / `sign_in`) through the same
 * queue-aware attendance provider as the in-app button.
 */
class KaryawanKuWidgetProvider : HomeWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
    widgetData: SharedPreferences
  ) {
    val prefs = context.getSharedPreferences(
      "${context.packageName}_preferences",
      Context.MODE_PRIVATE
    )
    val snapshot = prefs.getString(SNAPSHOT_KEY, null)?.let { JSONObject(it) }

    appWidgetIds.forEach { widgetId ->
      val info = appWidgetManager.getAppWidgetInfo(widgetId)
      val minWidth = info?.minWidth ?: 110
      val minHeight = info?.minHeight ?: 110
      val medium = minWidth >= 250 || minHeight >= 250
      val layout = if (medium) R.layout.widget_medium else R.layout.widget_small
      val views = RemoteViews(context.packageName, layout)

      render(context, views, snapshot, medium)
      views.setOnClickPendingIntent(R.id.widget_container, openIntent(context))

      appWidgetManager.updateAppWidget(widgetId, views)
    }
  }

  private fun render(
    context: Context,
    views: RemoteViews,
    snapshot: JSONObject?,
    medium: Boolean
  ) {
    val signedOut = snapshot?.optBoolean(KEY_SIGNED_OUT) ?: true

    // Header (medium only): business name, hidden when absent.
    if (medium) {
      val name = snapshot?.optString(KEY_BUSINESS_NAME)?.takeIf { it.isNotBlank() }
      if (name == null) {
        views.setViewVisibility(R.id.widget_header, android.view.View.GONE)
      } else {
        views.setTextViewText(R.id.widget_header, name)
        views.setViewVisibility(R.id.widget_header, android.view.View.VISIBLE)
      }
    }

    val canClockIn = !signedOut && snapshot?.optString(KEY_CLOCKED_IN_AT).isNullOrEmpty()
    val hasClockOut = !snapshot?.optString(KEY_CLOCKED_OUT_AT).isNullOrEmpty()
    val canClockOut = !signedOut && !canClockIn && !hasClockOut
    val pendingSync = snapshot?.optBoolean(KEY_PENDING_SYNC) ?: false
    val failure = snapshot?.optString(KEY_FAILURE_MESSAGE)?.takeIf { it.isNotBlank() }
    val shiftLabel = snapshot?.optString(KEY_SHIFT_LABEL)?.takeIf { it.isNotBlank() }
    val shiftRange = snapshot?.optString(KEY_SHIFT_RANGE)?.takeIf { it.isNotBlank() }
    val geofence = snapshot?.optDouble(KEY_GEOFENCE_DISTANCE_M, Double.NaN) ?: Double.NaN
    val outsideGeofence = !geofence.isNaN() && geofence < 0

    // Big line.
    when {
      signedOut -> views.setTextViewText(R.id.widget_shift, "Masuk KaryawanKu")
      shiftLabel != null -> views.setTextViewText(R.id.widget_shift, shiftLabel)
      else -> views.setTextViewText(R.id.widget_shift, "Belum ada shift")
    }

    // Sub line: BE rejection wins, then the geofence refusal, then the shift
    // range, then the empty state.
    val sub: String
    val subColor: Int
    when {
      failure != null -> {
        sub = failure
        subColor = context.getColor(R.color.kk_danger)
      }
      !signedOut && outsideGeofence && canClockIn && shiftLabel != null -> {
        sub = "Clock-in dibuka di kantor"
        subColor = context.getColor(R.color.kk_on_surface_variant)
      }
      shiftRange != null -> {
        sub = shiftRange
        subColor = context.getColor(R.color.kk_on_surface_variant)
      }
      else -> {
        sub = "Tidak ada shift"
        subColor = context.getColor(R.color.kk_on_surface_variant)
      }
    }
    views.setTextViewText(R.id.widget_sub, sub)
    views.setTextColor(R.id.widget_sub, subColor)

    // Status chip.
    val (chipText, chipBg, chipFg) = when {
      signedOut -> Triple("", 0, Color.TRANSPARENT)
      pendingSync -> Triple(
        "Menunggu kirim",
        R.drawable.widget_chip_warning,
        context.getColor(R.color.kk_on_warning_container)
      )
      canClockIn -> Triple(
        "Belum Clock In",
        R.drawable.widget_chip_neutral,
        context.getColor(R.color.kk_on_surface_variant)
      )
      hasClockOut -> Triple(
        "Selesai",
        R.drawable.widget_chip_neutral,
        context.getColor(R.color.kk_on_surface_variant)
      )
      else -> Triple(
        "On shift",
        R.drawable.widget_chip_success,
        context.getColor(R.color.kk_on_success_container)
      )
    }
    if (signedOut) {
      views.setViewVisibility(R.id.widget_chip, android.view.View.GONE)
    } else {
      views.setTextViewText(R.id.widget_chip, chipText)
      views.setInt(R.id.widget_chip, "setBackgroundResource", chipBg)
      views.setTextColor(R.id.widget_chip, chipFg)
      views.setViewVisibility(R.id.widget_chip, android.view.View.VISIBLE)
    }

    // Action pill.
    val (buttonText, buttonUri) = when {
      signedOut -> "Masuk" to actionUri(ACTION_SIGN_IN)
      canClockIn -> "Clock In" to actionUri(ACTION_CLOCK_IN)
      canClockOut -> "Clock Out" to actionUri(ACTION_CLOCK_OUT)
      else -> null to null
    }
    if (buttonText == null || buttonUri == null) {
      views.setViewVisibility(R.id.widget_button, android.view.View.GONE)
    } else {
      views.setTextViewText(R.id.widget_button, buttonText)
      views.setViewVisibility(R.id.widget_button, android.view.View.VISIBLE)
      views.setOnClickPendingIntent(
        R.id.widget_button,
        launchIntent(context, buttonUri)
      )
    }
  }

  private fun launchIntent(context: Context, uri: Uri) =
    HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, uri)

  private fun openIntent(context: Context): android.app.PendingIntent =
    launchIntent(context, actionUri(ACTION_OPEN))

  companion object {
    private const val SNAPSHOT_KEY = "kk_widget_snapshot"

    private const val KEY_BUSINESS_NAME = "businessName"
    private const val KEY_SHIFT_LABEL = "shiftLabel"
    private const val KEY_SHIFT_RANGE = "shiftRange"
    private const val KEY_CLOCKED_IN_AT = "clockedInAt"
    private const val KEY_CLOCKED_OUT_AT = "clockedOutAt"
    private const val KEY_SIGNED_OUT = "signedOut"
    private const val KEY_GEOFENCE_DISTANCE_M = "geofenceDistanceM"
    private const val KEY_FAILURE_MESSAGE = "failureMessage"
    private const val KEY_PENDING_SYNC = "pendingSync"

    private const val ACTION_OPEN = "open"
    private const val ACTION_CLOCK_IN = "clock_in"
    private const val ACTION_CLOCK_OUT = "clock_out"
    private const val ACTION_SIGN_IN = "sign_in"

    /** `karyawanku://widget[?action=…]` — same shape as `WidgetUris` in Dart. */
    private fun actionUri(action: String): Uri = when (action) {
      ACTION_OPEN -> Uri.parse("karyawanku://widget")
      ACTION_SIGN_IN -> Uri.parse("karyawanku://widget?action=$action&intent=widget")
      else -> Uri.parse("karyawanku://widget?action=$action")
    }
  }
}