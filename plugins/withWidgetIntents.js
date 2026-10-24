// Lists expo-widgets' App Intents in the app's own metadata. iOS runs a Live Activity button's intent
// (LiveActivityUserInteraction) in the app, and refused every tap with "There is no metadata for
// LiveActivityUserInteraction in com.adroapp.app": an intent from a static library only counts when the app includes
// its AppIntentsPackage (ExpoWidgetsIntents, added by patches/expo-widgets+57.0.27.patch). ExpoWidgets is imported
// "internal" like everywhere else in the app target (Xcode refuses mixed import levels).
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FILE = 'AdroIntents.swift';
const SOURCE = `import AppIntents
internal import ExpoWidgets

@available(iOS 17.0, *)
struct AdroIntents: AppIntentsPackage {
  static var includedPackages: [any AppIntentsPackage.Type] { [ExpoWidgetsIntents.self] }
}
`;

module.exports = (config) => {
  config = withDangerousMod(config, [
    'ios',
    (c) => {
      fs.writeFileSync(path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName, FILE), SOURCE);
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
