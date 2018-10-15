const path = require('path')
const webpack = require('webpack')

const isProd = process.env.NODE_ENV === 'production'

module.exports = {
  mode: isProd ? 'production' : 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, './lib'),
    filename: 'webwire.js',
    library: 'webwire-js',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  externals: {
    http: 'http'
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
                "targets": {
                  "browsers": ["> 1%", "last 2 versions", "not ie <= 11"]
                }
              }]
            ],
            plugins: [
              ["@babel/plugin-transform-runtime", {
                "helpers": false,
                "regenerator": true,
              }]
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