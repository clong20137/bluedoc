module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        harbor: '#0f4c81',
        signal: '#2b8fd7',
        field: '#f4f7fb',
        line: '#d9e2ef',
        slategray: '#5e6f85',
        mint: '#2fa971',
        amber: '#d9822b',
        rose: '#c5485e'
      },
      boxShadow: {
        panel: '0 18px 50px rgba(23, 32, 51, 0.08)'
      }
    }
  },
  plugins: []
};
