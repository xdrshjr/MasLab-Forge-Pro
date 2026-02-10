import { defineConfig } from 'tsup'

export default defineConfig({
  // Entry point
  entry: ['src/index.ts'],

  // Output formats
  format: ['cjs', 'esm'],

  // Generate TypeScript declaration files
  dts: true,

  // Generate sourcemaps for debugging
  sourcemap: true,

  // Clean output directory before build
  clean: true,

  // Split output into chunks for better tree-shaking
  splitting: false,

  // Minify output for production
  minify: false,

  // Target environment
  target: 'node20',

  // External dependencies (not bundled)
  external: ['pino', 'zod'],
})
