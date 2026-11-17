import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .service-logs holds the local Python runners' virtualenvs, which ship their own JS.
  // landing/ is a separate Next.js app with its own ESLint config.
  globalIgnores(['dist', '.service-logs', 'coverage', 'landing']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // The two classic hooks rules. eslint-plugin-react-hooks v7's "recommended" preset also turns
      // on the React Compiler rules (set-state-in-effect, refs, purity, ...); this app doesn't use
      // the compiler, and those flagged ~200 existing patterns that work. Revisit if the compiler is adopted.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Hints, not bugs: kept visible as warnings so the existing backlog doesn't fail lint.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-refresh/only-export-components': 'warn',
      // `cond ? a() : b()` as a statement is used deliberately in toggles.
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    // Declaration files declare names for other modules to use.
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
])
