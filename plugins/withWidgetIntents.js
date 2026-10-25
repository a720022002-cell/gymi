// The Live Activity button intent in the app's own code. iOS runs a Live Activity button's intent in the app and reads
// its metadata from the app (Metadata.appintents): native/apple/*.swift (AdroLiveTap) is compiled into the app here,
// and into the widget extension by patches/expo-widgets+57.0.27.patch (which also names the extension's module Adro).
// No AppIntentsPackage: expo-widgets is a static library with no framework of its own, so iOS can't find a package
// from it, and then drops the app's whole metadata ("There is no metadata for AdroLiveTap in com.adroapp.app").
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const nativeFiles = (root) => {
  const dir = path.join(root, 'native', 'apple');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.swift')) : [];
};

module.exports = (config) => {
  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const appDir = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName);
      for (const f of nativeFiles(c.modRequest.projectRoot)) fs.copyFileSync(path.join(c.modRequest.projectRoot, 'native', 'apple', f), path.join(appDir, f));
      return c;
    },
  ]);
  return withXcodeProject(config, (c) => {
    const name = c.modRequest.projectName;
    for (const f of nativeFiles(c.modRequest.projectRoot)) {
      if (!c.modResults.hasFile(`${name}/${f}`)) IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: `${name}/${f}`, groupName: name, project: c.modResults });
    }
    return c;
  });
};
