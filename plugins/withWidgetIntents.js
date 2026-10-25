// The Live Activity button intent in the app's own code. iOS runs a Live Activity button's intent in the app and only
// finds intents declared in the app's own code: expo-widgets' intent (in a library) was refused with "There is no
// metadata for LiveActivityUserInteraction in com.adroapp.app", even when listed through its AppIntentsPackage. So
// native/apple/*.swift (AdroLiveTap) is compiled into the app here, and into the widget extension by
// patches/expo-widgets+57.0.27.patch. AdroIntents still includes expo-widgets' own intents. ExpoWidgets is imported
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

const nativeFiles = (root) => {
  const dir = path.join(root, 'native', 'apple');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.swift')) : [];
};

module.exports = (config) => {
  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const appDir = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName);
      fs.writeFileSync(path.join(appDir, FILE), SOURCE);
      for (const f of nativeFiles(c.modRequest.projectRoot)) fs.copyFileSync(path.join(c.modRequest.projectRoot, 'native', 'apple', f), path.join(appDir, f));
      return c;
    },
  ]);
  return withXcodeProject(config, (c) => {
    const name = c.modRequest.projectName;
    for (const f of [FILE, ...nativeFiles(c.modRequest.projectRoot)]) {
      if (!c.modResults.hasFile(`${name}/${f}`)) IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: `${name}/${f}`, groupName: name, project: c.modResults });
    }
    return c;
  });
};
