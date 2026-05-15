module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@app': './src/app',
            '@config': './src/lib/config',
            '@features': './src/features',
            '@navigation': './src/lib/navigation',
            '@theme': './src/lib/theme',
            '@utils': './src/lib/utils',
          },
        },
      ],
    ],
  };
};
 
