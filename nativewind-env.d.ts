/// <reference types="nativewind/types" />

// TypeScript 6 turned on noUncheckedSideEffectImports by default, which flags
// `import "@/global.css"` in app/_layout.tsx since TS has no built-in
// declaration for CSS side-effect imports.
declare module "*.css";
