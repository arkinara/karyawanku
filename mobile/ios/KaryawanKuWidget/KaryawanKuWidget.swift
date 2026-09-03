import AppIntents
import SwiftUI
import WidgetKit

// KaryawanKuWidget — iOS home-screen widget (ticket #74, SKELETON).
//
// Interactive widgets (tapping the action pill) require iOS 17+ and an
// AppIntent. On iOS 16 the widget falls back to `widgetURL` deep-linking into
// the app with `karyawanku://widget?action=clock_in` — the app picks the URI
// up through HomeWidget.initiallyLaunchedFromHomeWidget / widgetClicked and
// runs the action through the same queue-aware provider as the in-app button
// (offline taps are queued, never lost).
//
// Data sharing: the Flutter app publishes the snapshot JSON (`kk_widget_snapshot`)
// into the App Group container via HomeWidget.saveWidgetData. Both the app and
// this extension must have the same App Group entitlement enabled
// (`group.com.karyawanku.mobile`). Without it the widget shows its cached entry
// (or the signed-out state).

/// App Group suite the Flutter side publishes `kk_widget_snapshot` into.
private let appGroupId = "group.com.karyawanku.mobile"
private let snapshotKey = "kk_widget_snapshot"

private struct WidgetSnapshot {
  let businessName: String?
  let shiftLabel: String?
  let shiftRange: String?
  let clockedInAt: String?
  let clockedOutAt: String?
  let signedOut: Bool
  let geofenceDistanceM: Double?
  let failureMessage: String?
  let pendingSync: Bool

  init(json: [String: Any]) {
    businessName = json["businessName"] as? String
    shiftLabel = json["shiftLabel"] as? String
    shiftRange = json["shiftRange"] as? String
    clockedInAt = json["clockedInAt"] as? String
    clockedOutAt = json["clockedOutAt"] as? String
    signedOut = (json["signedOut"] as? Bool) ?? false
    geofenceDistanceM = json["geofenceDistanceM"] as? Double
    failureMessage = json["failureMessage"] as? String
    pendingSync = (json["pendingSync"] as? Bool) ?? false
  }

  static let signedOut = WidgetSnapshot(
    json: [
      "signedOut": true,
      "geofenceDistanceM": NSNull(),
      "pendingSync": false,
    ]
  )

  var hasClockIn: Bool { clockedInAt != nil }
  var hasClockOut: Bool { clockedOutAt != nil }
  var canClockIn: Bool { !signedOut && !hasClockIn }
  var canClockOut: Bool { !signedOut && hasClockIn && !hasClockOut }
}

private func readSnapshot() -> WidgetSnapshot {
  let defaults = UserDefaults(suiteName: appGroupId)
  guard
    let raw = defaults?.string(forKey: snapshotKey),
    let data = raw.data(using: .utf8),
    let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
  else {
    return .signedOut
  }
  return WidgetSnapshot(json: json)
}

private struct Entry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot
}

private struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry {
    Entry(date: Date(), snapshot: .signedOut)
  }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(Entry(date: Date(), snapshot: readSnapshot()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let entry = Entry(date: Date(), snapshot: readSnapshot())
    // Refresh every 30 minutes so the widget reflects server-state changes
    // even when the app has not written a fresh snapshot.
    completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800))))
  }
}

// MARK: - AppIntents (iOS 17+ interactive actions)

struct ClockInIntent: AppIntent {
  static var title: LocalizedStringResource = "Clock In"
  static var description = IntentDescription("Mulai shift dari widget KaryawanKu.")

  @Environment(\.openURL) private var openURL

  func perform() async throws -> some IntentResult {
    try await openURL(URL(string: "karyawanku://widget?action=clock_in")!)
    return .result()
  }
}

struct ClockOutIntent: AppIntent {
  static var title: LocalizedStringResource = "Clock Out"
  static var description = IntentDescription("Akhiri shift dari widget KaryawanKu.")

  @Environment(\.openURL) private var openURL

  func perform() async throws -> some IntentResult {
    try await openURL(URL(string: "karyawanku://widget?action=clock_out")!)
    return .result()
  }
}

struct SignInIntent: AppIntent {
  static var title: LocalizedStringResource = "Masuk KaryawanKu"
  static var description = IntentDescription("Buka aplikasi untuk masuk.")

  @Environment(\.openURL) private var openURL

  func perform() async throws -> some IntentResult {
    try await openURL(URL(string: "karyawanku://widget?action=sign_in&intent=widget")!)
    return .result()
  }
}

// MARK: - View

private struct KaryawanKuWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: Entry

  private var snapshot: WidgetSnapshot { entry.snapshot }

  private var actionURL: URL? {
    if snapshot.signedOut { return URL(string: "karyawanku://widget?action=sign_in&intent=widget") }
    if snapshot.canClockIn { return URL(string: "karyawanku://widget?action=clock_in") }
    if snapshot.canClockOut { return URL(string: "karyawanku://widget?action=clock_out") }
    return URL(string: "karyawanku://widget")
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if family == .systemMedium,
        let name = snapshot.businessName, !name.isEmpty {
        Text(name)
          .font(.system(size: 12))
          .foregroundColor(.secondary)
          .lineLimit(1)
      }

      Group {
        if snapshot.signedOut { Text("Masuk KaryawanKu") }
        else if let label = snapshot.shiftLabel { Text(label) }
        else { Text("Belum ada shift") }
      }
      .font(.system(size: family == .systemSmall ? 14 : 18, weight: .bold))
      .lineLimit(2)
      .minimumScaleFactor(0.7)

      Group {
        if let failure = snapshot.failureMessage, !failure.isEmpty {
          Text(failure)
        } else if !snapshot.signedOut,
          let g = snapshot.geofenceDistanceM, g < 0,
          snapshot.canClockIn, snapshot.shiftLabel != nil {
          Text("Clock-in dibuka di kantor")
        } else if let range = snapshot.shiftRange {
          Text(range)
        } else {
          Text("Tidak ada shift")
        }
      }
      .font(.system(size: family == .systemSmall ? 11 : 12))
      .foregroundColor(.secondary)
      .lineLimit(2)
      .minimumScaleFactor(0.7)

      Spacer(minLength: 0)

      HStack {
        if !snapshot.signedOut { chip }
        Spacer()
        actionButton
      }
    }
    .padding(12)
    .widgetURL(actionURL)
  }

  private var chip: some View {
    let (text, tint): (String, Color) = {
      if snapshot.pendingSync { return ("Menunggu kirim", .orange) }
      if snapshot.canClockIn { return ("Belum Clock In", .secondary) }
      if snapshot.hasClockOut { return ("Selesai", .secondary) }
      return ("On shift", .green)
    }()
    return Text(text)
      .font(.system(size: 10))
      .padding(.horizontal, 8)
      .padding(.vertical, 4)
      .background(Capsule().fill(tint.opacity(0.15)))
  }

  @ViewBuilder
  private var actionButton: some View {
    let text: String? = {
      if snapshot.signedOut { return "Masuk" }
      if snapshot.canClockIn { return "Clock In" }
      if snapshot.canClockOut { return "Clock Out" }
      return nil
    }()
    if let text = text {
      if #available(iOSApplicationExtension 17.0, *) {
        Button(intent: intent(for: text)) {
          buttonLabel(text)
        }
        .buttonStyle(.plain)
      } else {
        buttonLabel(text) // tap handled by widgetURL
      }
    }
  }

  private func buttonLabel(_ text: String) -> some View {
    Text(text)
      .font(.system(size: 11, weight: .bold))
      .foregroundColor(.white)
      .padding(.horizontal, 12)
      .padding(.vertical, 6)
      .background(
        Capsule().fill(Color(red: 0.058, green: 0.459, blue: 0.427))
      )
  }

  private func intent(for text: String) -> any AppIntent {
    switch text {
    case "Clock In": return ClockInIntent()
    case "Clock Out": return ClockOutIntent()
    default: return SignInIntent()
    }
  }
}

// MARK: - Widget

struct KaryawanKuWidget: Widget {
  let kind: String = "KaryawanKuWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      KaryawanKuWidgetView(entry: entry)
        .containerBackground(for: .widget) { Color(red: 0.988, green: 0.992, blue: 0.992) }
    }
    .configurationDisplayName("KaryawanKu")
    .description("Status shift dan clock in/out.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

// Widget bundle entry point. When adding the widget extension target in Xcode,
// set this type as the extension's @main entry and mark the file as the target
// member (only one @main per extension).
@main
struct KaryawanKuWidgetBundle: WidgetBundle {
  var body: some Widget {
    KaryawanKuWidget()
  }
}