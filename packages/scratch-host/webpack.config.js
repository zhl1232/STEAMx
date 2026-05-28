const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const scratchGuiRoot = path.join(__dirname, 'node_modules/@scratch/scratch-gui')

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production'

  return {
    entry: path.resolve(__dirname, 'src/index.jsx'),
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? 'host.[contenthash:8].js' : 'host.js',
      publicPath: isProd ? '/scratch/' : '/',
      clean: true,
    },
    externals: {
      react: 'React',
      'react-dom': 'ReactDOM',
      'react-dom/client': 'ReactDOM',
      redux: 'Redux',
      'react-redux': 'ReactRedux',
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                ['@babel/preset-react', { runtime: 'automatic' }],
              ],
            },
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'src/index.html'),
        inject: 'body',
        scriptLoading: 'blocking',
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(scratchGuiRoot, 'dist'),
            to: '.',
            globOptions: { ignore: ['**/types/**'] },
          },
          {
            from: path.join(scratchGuiRoot, 'dist/static'),
            to: 'static',
            noErrorOnMissing: true,
          },
          {
            from: path.resolve(__dirname, 'node_modules/react/umd/react.production.min.js'),
            to: 'vendor/react.production.min.js',
          },
          {
            from: path.resolve(__dirname, 'node_modules/react-dom/umd/react-dom.production.min.js'),
            to: 'vendor/react-dom.production.min.js',
          },
          {
            from: path.resolve(__dirname, 'node_modules/redux/dist/redux.min.js'),
            to: 'vendor/redux.min.js',
          },
          {
            from: path.resolve(__dirname, 'node_modules/react-redux/dist/react-redux.min.js'),
            to: 'vendor/react-redux.min.js',
          },
        ],
      }),
    ],
    devServer: {
      port: 8601,
      hot: false,
      static: [
        { directory: path.join(scratchGuiRoot, 'dist') },
        { directory: path.resolve(__dirname, 'dist') },
        {
          directory: path.resolve(__dirname, '../../public/scratch/assets'),
          publicPath: '/internalapi/asset',
        },
      ],
      historyApiFallback: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
      setupMiddlewares: (middlewares, devServer) => {
        const express = require('express')
        devServer.app.use('/vendor', express.static(path.resolve(__dirname, 'node_modules/react/umd'), { index: false }))
        devServer.app.get('/vendor/react.production.min.js', (req, res) => {
          res.sendFile(path.resolve(__dirname, 'node_modules/react/umd/react.production.min.js'))
        })
        devServer.app.get('/vendor/react-dom.production.min.js', (req, res) => {
          res.sendFile(path.resolve(__dirname, 'node_modules/react-dom/umd/react-dom.production.min.js'))
        })
        devServer.app.get('/vendor/redux.min.js', (req, res) => {
          res.sendFile(path.resolve(__dirname, 'node_modules/redux/dist/redux.min.js'))
        })
        devServer.app.get('/vendor/react-redux.min.js', (req, res) => {
          res.sendFile(path.resolve(__dirname, 'node_modules/react-redux/dist/react-redux.min.js'))
        })
        return middlewares
      },
    },
    performance: { hints: false },
    devtool: isProd ? 'source-map' : 'eval-source-map',
  }
}
