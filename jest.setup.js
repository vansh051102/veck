// React's `cache()` only exists in the react-server build that Next.js resolves
// for Server Components. Under Jest's plain node environment the export is
// undefined, so any module importing it (lib/services/rbac.service.ts) throws
// "cache is not a function" on import. Request-level memoization is a no-op in
// tests anyway, so fall back to the identity wrapper.
const React = require('react')

if (typeof React.cache !== 'function') {
  React.cache = (fn) => fn
}
