'use strict';

const gulp = require('gulp');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const path = require('path');
const fs = require('fs');
const del = require('del');
const nib = require('nib');
const ReactDOMServer = require('react-dom/server');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const htmlreplace = require('gulp-html-replace');
const rename = require('gulp-rename');
const React = require('react');

const FOLDER_SRC = path.resolve('./src');
const FOLDER_DIST = path.resolve('./dist');
const PATH_ENTRY = path.join(FOLDER_SRC, 'app');
const PATH_LAYOUT = path.join(FOLDER_SRC, 'components/Layout');
const PATH_WEBPACK = path.join(FOLDER_SRC, 'webpack');
const PATH_STATS = path.join(FOLDER_DIST, 'stats.json');

const babelOptions = {
  presets: ['es2015', 'react']
}

gulp.task('default', ['dev']);

function getWebpackOptions(debug) {
  let options = {
    entry: {
      app: [
        PATH_ENTRY
      ]
    },
    output: {
      path: FOLDER_DIST,
      filename: '[name].js'
    },
    module: {
      loaders: [
        {test: /\.js$/, exclude: /node_modules/, loader: 'react-hot'},
        {
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel',
          query: babelOptions
        },
        {test: /\.(png|dca|svg|ogv|mp4|webm|wav)$/, loader: 'file'}
      ]
    },
    stylus: {
      use: [nib()],
      import: ['~nib/lib/nib/index.styl']
    },
    plugins: [
      new webpack.HotModuleReplacementPlugin(),
      new webpack.NoErrorsPlugin()
    ]
  };

  if (debug) {
    options.debug = true;
    options.devtool = 'source-map';
    options.entry.app.unshift('webpack-dev-server/client?http://localhost:8000', PATH_WEBPACK);
    options.module.loaders.push({test: /\.(styl|css)$/, loader: 'style!css!stylus'});
  }
  else {
    options.output.filename = '[hash].js';
    options.plugins.push(new ExtractTextPlugin('[hash].css'));
    options.plugins.push(new webpack.optimize.UglifyJsPlugin());
    options.module.loaders.push({test: /\.styl$/, loader: ExtractTextPlugin.extract('style', 'css!stylus')});
  }

  return options;
}

gulp.task('dev', () => {
  new WebpackDevServer(webpack(getWebpackOptions(true)), {
    contentBase: FOLDER_SRC,
    hot: true,
    inline: true,
    watchOptions: {
      aggregateTimeout: 100,
      poll: 1000
    },
    quiet: false,
    noInfo: false,
    stats: {
      colors: true
    }
  }).listen(8000, 'localhost', (err) => {
    if (err) {
      console.log(err);
    }
    else {
      console.log('server is running at http://localhost:8000');
    }
  });
});

gulp.task('build', ['clean'], (callback) => {
  webpack(getWebpackOptions(false), (err, stats) => {
    if (err) {
      console.log(err)
    }
    else {
      if (!fs.existsSync(FOLDER_DIST)) {
        fs.mkdirSync(FOLDER_DIST);
      }
      fs.writeFile(PATH_STATS, JSON.stringify(stats.toJson(), null, 2), callback);
    }
  });
});

gulp.task('clean', () => {
  return del(FOLDER_DIST);
});

gulp.task('dist', ['build'], () => {
  const stats = JSON.parse(fs.readFileSync(PATH_STATS));
  const index = stats.assetsByChunkName['app'];
  const fbImage = stats.modules.filter(mod => /og-facebook\.png/.test(mod.name))[0].assets;
  const twitterImage = stats.modules.filter(mod => /og-twitter\.png/.test(mod.name))[0].assets;
  const favicon = stats.modules.filter(mod => /favicon\.png/.test(mod.name))[0].assets;
  const findAsset = name => stats.modules.filter(mod => mod.identifier.indexOf(name) !== -1)[0].assets[0];

  require('react');
  require('babel-register')(babelOptions);
  require.extensions['.styl'] = () => {};
  require.extensions['.svg'] = require.extensions['.png'] =
    require.extensions['.mp4'] = require.extensions['.dca'] =
    require.extensions['.wav'] = require.extensions['.ogv'] =
    require.extensions['.webm'] = (module, filename) => {
      module.exports = findAsset(filename);
    };

  createGlobals();

  function render(src, dst, content) {
    return gulp.src(src, { cwd: FOLDER_SRC })
      .pipe(htmlreplace({
        mount: content,
        js: index[0],
        css: index[1],
        ogimage: {
          src: fbImage[0],
          tpl: '<meta property="og:image" content="https://airhorn.solutions/%s" />'
        },
        twitterimage: {
          src: twitterImage[0],
          tpl: '<meta name="twitter:image" content="https://airhorn.solutions/%s" />'
        },
        favicon: {
          src: favicon[0],
          tpl: '<link rel="icon" href="%s" />'
        }
      }))
      .pipe(rename(dst))
      .pipe(gulp.dest(FOLDER_DIST));
  }

  const Layout = require(PATH_LAYOUT).default;
  const content = ReactDOMServer.renderToString(React.createElement(Layout));
  return render('index.html', 'index.html', content);
});

function createGlobals() {
  global.window = {
    matchMedia() {
      return {matches: false};
    },

    addEventListener() {},
    location: {search: ''}
  };

  global.document = {
    addEventListener() {}
  };

  global.navigator = {
    userAgent: {
      match() {}
    }
  };

  global.Parallax = function() {};
  global.EventSource = function() {};
}
