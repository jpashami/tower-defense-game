// Lets Node run the game's TypeScript modules directly (for `npm test`): Node strips the
// types itself, but the source uses extensionless imports as Vite expects, so './draw'
// has to be resolved to './draw.ts'.
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(spec, ctx, next) {
        if (/^\\.\\.?\\//.test(spec) && !/\\.[a-z]+$/.test(spec)) return next(spec + '.ts', ctx);
        return next(spec, ctx);
      }`),
);
