/**
 * Ambient declarations for non-code side-effect imports.
 *
 * TypeScript 6 + Next.js 16 stopped emitting an automatic ambient module for
 * `*.css` / `*.scss` imports, so `import "./globals.css"` raises TS2882.
 * We declare them here as empty modules — the bundler handles the actual
 * import at build time, TypeScript just needs to know the path is valid.
 */

declare module "*.css";
declare module "*.scss";
