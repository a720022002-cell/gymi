import AppIntents
import Foundation

/**
 * A button on Adro's workout or cardio Live Activity. This file is compiled into the app and into the widget
 * extension themselves (plugins/withWidgetIntents.js, patches/expo-widgets): iOS only finds an intent's metadata in
 * the target's own code (expo-widgets' intent lives in a static library, which iOS doesn't read). iOS runs it in the
 * app, which hands the tap to the JavaScript like expo-widgets does.
 */
@available(iOS 17.0, *)
public struct AdroLiveTap: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Workout button"
  public static var isDiscoverable: Bool = false

  @Parameter(title: "source")
  public var source: String?

  @Parameter(title: "target")
  public var target: String?

  public init() {}
  public init(source: String?, target: String?) {
    self.source = source
    self.target = target
  }

  public func perform() async throws -> some IntentResult {
    let now = Int(Date().timeIntervalSince1970 * 1000)
    let event: [String: Any] = ["source": source ?? "", "target": target ?? "", "timestamp": now, "type": "ExpoWidgetsUserInteraction"]
    let group = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String
    let defaults = UserDefaults(suiteName: group) ?? .standard
    // The button check on the Widgets page (admins): when it ran, which button, in which process.
    defaults.set(["at": now, "target": target ?? "", "process": Bundle.main.bundleIdentifier ?? ""], forKey: "__adro_last_live_tap")
    // Kept until the app's JavaScript takes it (expo-widgets' takePendingInteractions), so a tap made while the app
    // was asleep isn't lost; the app stays awake until then, plus a moment to update the Live Activity.
    var queue = (defaults.array(forKey: "__adro_pending_live_taps") as? [[String: Any]]) ?? []
    queue = queue.filter { now - (($0["timestamp"] as? Int) ?? 0) < 60_000 }
    queue.append(event)
    defaults.set(queue, forKey: "__adro_pending_live_taps")
    NotificationCenter.default.post(name: Notification.Name("onExpoWidgetsUserInteraction"), object: nil, userInfo: ["eventData": event])
    for _ in 0..<50 {
      if ((defaults.array(forKey: "__adro_pending_live_taps") as? [Any]) ?? []).isEmpty { break }
      try? await Task.sleep(nanoseconds: 100_000_000)
    }
    try? await Task.sleep(nanoseconds: 800_000_000)
    return .result()
  }
}
