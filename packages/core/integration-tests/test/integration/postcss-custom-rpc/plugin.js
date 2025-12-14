module.exports = (opts = {}) => {
  return {
    postcssPlugin: 'postcss-test-plugin',
    Declaration(decl) {
      if (decl.prop === 'color' && decl.value === 'red') {
        decl.value = 'blue';
      }
    }
  }
}
module.exports.postcss = true
