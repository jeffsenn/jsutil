import babel from 'rollup-plugin-babel';
export default {
  input: 'index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'umd',
    name: 'jsutil',
    exports: 'named'
  },
  plugins: [
    babel()
  ]
};
