const path = require('path')
const webpack = require('webpack')

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, './lib'),
    filename: 'webwire.js',
    library: 'webwire-js',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        include: path.resolve(__dirname, './src'),
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ["@babel/preset-env", {
                "modules": false,
                "targets": {
                  "browsers": ["> 1%", "last 2 versions", "not ie <= 11"]
                }
              }],
              "@babel/preset-stage-2"
            ],
            ignore: [
              "./examples/**/*.js",
              "./lib"
            ]
          }
        }
      }
    ]
  },
  stats: {
    modules: false
  }
}