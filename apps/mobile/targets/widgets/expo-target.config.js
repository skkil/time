module.exports = (config) => ({
  type: 'widget',
  name: 'widgets',
  displayName: 'skkil time',
  bundleIdentifier: '.widgets',
  deploymentTarget: '16.4',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    $widgetBackground: '#0b1220',
    $accent: '#f1f1ee',
  },
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
