const path = require("path");
const autoprefixer = require("autoprefixer");
const HtmlWebpackPlugin = require("html-webpack-plugin");

let config = {
  entry: "./src/js/index.ts",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist")
  },
  plugins: [
    new HtmlWebpackPlugin({template: "./src/index.html"})
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: "babel-loader"
      },
      {
        test: /\.(scss)$/,
        use: [
          "style-loader",
          "css-loader",
          {
            loader: "postcss-loader",
            options: {postcssOptions: {plugins: [autoprefixer]}}
          },
          "sass-loader"
        ]
      },
      {
        test: /\.glsl$/,
        exclude: /node_modules/,
        type: "asset/source"
      }
    ]
  }
};

module.exports = (env, argv) => {
  if (argv.mode === "development") {
    config.devtool = "source-map";
  }
  return config;
}
