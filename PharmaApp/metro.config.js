const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    assetExts: [
      'bin', 'txt', 'jpg', 'png', 'json',
      'mp3', 'ttf', 'otf', 'woff', 'woff2',
    ],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  server: {
    // Timeout ayarlarını artır (HeadersTimeoutError için)
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Timeout süresini artır (60 saniye)
        req.setTimeout(60000);
        res.setTimeout(60000);
        return middleware(req, res, next);
      };
    },
    // DevTools bağlantı sorunlarını önlemek için
    // Port forwarding için
    port: 8081,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
