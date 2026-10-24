// Declares the Live Activity button intent in the app itself. iOS runs a LiveActivityIntent in the app's process
// only when the app declares it; the copy inside expo-widgets alone ran in the widget's process, so taps never
// reached the app. Same name and parameters as expo-widgets' LiveActivityUserInteraction (see
// patches/expo-widgets+57.0.27.patch), and it hands the tap over through ExpoWidgetsLiveTaps. ExpoWidgets is imported
// "internal" like everywhere else in the app target (Xcode refuses mixed import levels).
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FILE = 'LiveActivityUserInteraction.swift';
const SOURCE = `import AppIntents
internal import ExpoWidgets

@available(iOS 17.0, *)
struct LiveActivityUserInteraction: LiveActivityIntent {
  static var title: LocalizedStringResource = "User Interaction"
  static var isDiscoverable: Bool = false

  @Parameter(title: "source")
  var source: String?

  @Parameter(title: "target")
  var target: String?

  init() {}
  init(source: String?, target: String?) {
    self.source = source
    self.target = target
  }

  func perform() async throws -> some IntentResult {
    await ExpoWidgetsLiveTaps.receive(source: source, target: target)
    return .result()
  }
}
`;

module.exports = (config) => {
  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName);
      fs.writeFileSync(path.join(dir, FILE), SOURCE);
      return c;
    },
  ]);
  return withXcodeProject(config, (c) => {
    const name = c.modRequest.projectName;
    if (!c.modResults.hasFile(`${name}/${FILE}`)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: `${name}/${FILE}`, groupName: name, project: c.modResults });
    }
    return c;
  });
};
