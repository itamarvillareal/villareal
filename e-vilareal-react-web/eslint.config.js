import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'src/data/coraExtratoMock.js',
    'src/data/sicoobExtratoMock.js',
    'src/data/itauEmpresasExtratoMock.js',
    'src/data/sicoobVrvExtratoMock.js',
    'src/data/btgExtratoMock.js',
    'src/data/btgJaExtratoMock.js',
    'src/data/btgRachelExtratoMock.js',
    'src/data/btgBankingExtratoMock.js',
    'src/data/bbExtratoMock.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Sincronizar estado com location.state / mocks em useEffect é padrão neste app; a regra acusa falsos positivos.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
