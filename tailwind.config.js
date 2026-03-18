module.exports = {
  prefix: "ud-",
  content: [
    "./src/content/**/*.js",
    "./src/options/**/*.html",
    "./src/options/**/*.js"
  ],
  theme: {
    extend: {
      backdropBlur: {
        '3xl': '64px',
        '4xl': '80px'
      }
    }
  },
  corePlugins: {
    preflight: false
  }
};
