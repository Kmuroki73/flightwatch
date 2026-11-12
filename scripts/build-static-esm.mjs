import { createRequire } from 'node:module';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(projectRoot, 'src');
const distRoot = path.join(projectRoot, 'dist');

async function walk(dir) {
  const items = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...await walk(full));
    else if (/\.(tsx?|jsx?)$/.test(item.name) && !item.name.endsWith('.d.ts')) files.push(full);
  }
  return files;
}

function resolveSpecifier(specifier) {
  if (specifier === './index.css' || specifier.endsWith('.css')) return null;
  if (specifier.startsWith('@/')) return `/src/${specifier.slice(2).replace(/\.(tsx?|jsx?)$/, '.js')}${/\.(tsx?|jsx?)$/.test(specifier) ? '' : '.js'}`;
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const extension = path.posix.extname(specifier);
    if (extension === '.tsx' || extension === '.ts' || extension === '.jsx') return specifier.slice(0, -extension.length) + '.js';
    if (!extension) return `${specifier}.js`;
  }
  return specifier;
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });
const files = await walk(srcRoot);
const diagnostics = [];
for (const file of files) {
  const rel = path.relative(srcRoot, file);
  const text = await readFile(file, 'utf8');
  const isTsx = file.endsWith('.tsx');
  const result = ts.transpileModule(text, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      useDefineForClassFields: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      isolatedModules: true,
    },
  });
  for (const d of result.diagnostics ?? []) {
    if (d.category === ts.DiagnosticCategory.Error) diagnostics.push({ file: rel, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') });
  }
  let js = result.outputText;
  // `runtimeConfig.ts` is compatible with Vite and the static runtime config.
  js = js.replace(/import\.meta\.env/g, '({})');
  // Rewrite TypeScript path aliases and extensionless relative imports for native browser ESM.
  js = js.replace(/((?:from\s*|import\s*)["'])([^"']+)(["'])/g, (match, before, spec, after) => {
    const mapped = resolveSpecifier(spec);
    return mapped ? `${before}${mapped}${after}` : match;
  });
  // The main entrypoint loads the root-level stylesheet in index.html.
  js = js.replace(/import\s*["'](?:\.\/index\.css|\/src\/index\.css)["'];?\s*/g, '');
  const output = path.join(distRoot, 'src', rel.replace(/\.(tsx?|jsx?)$/, '.js'));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, js);
}
if (diagnostics.length) {
  console.error('Static transpilation reported errors:');
  for (const d of diagnostics) console.error(`${d.file}: ${d.message}`);
  process.exitCode = 1;
  process.exit();
}

await cp(path.join(projectRoot, 'public'), distRoot, { recursive: true });
let css = await readFile(path.join(srcRoot, 'index.css'), 'utf8');
css = css.replace(/^@tailwind\s+(base|components|utilities);\s*$/gm, '');
await writeFile(path.join(distRoot, 'index.css'), css);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#F47B20" />
    <meta name="description" content="Check live flight status by flight number, monitor important changes and get AI-powered travel assistance. Let Songa watch your journey." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://songa.co.ke/" />
    <meta property="og:title" content="Songa AI | Your Flight, Watched Intelligently" />
    <meta property="og:description" content="Your flight changes. Songa knows and alerts you in real time." />
    <meta property="og:image" content="https://songa.co.ke/songa-logo.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="https://songa.co.ke/" />
    <link rel="icon" type="image/png" sizes="64x64" href="/songa-logo-64.png" />
    <link rel="apple-touch-icon" href="/songa-logo-192.png" />
    <title>Songa AI | Live Flight Tracker & AI Travel Companion</title>
    <link rel="stylesheet" href="/index.css" />
    <script type="importmap">{
      "imports": {
        "react": "https://esm.sh/react@18.3.1",
        "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime?external=react",
        "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?external=react",
        "lucide-react": "https://esm.sh/lucide-react@0.446.0?external=react",
        "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.57.4"
      }
    }</script>
    <script src="/songa-config.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`;
await writeFile(path.join(distRoot, 'index.html'), html);
await writeFile(path.join(distRoot, 'STATIC_BUILD_NOTES.txt'), `Songa AI static ESM fallback build\n\nThis is not a Rollup/Vite bundle. TypeScript and TSX were transpiled to native browser ES modules. React, React DOM, lucide-react and Supabase JS are loaded through the esm.sh import map at runtime, so the deployed site requires access to esm.sh.\n\nBefore deployment, edit songa-config.js with the public Supabase project URL and anon/publishable key. Never add provider, service-role, OpenAI, PayPal or WhatsApp secrets here.\n\nFor the normal production build, install dependencies and run npm run build. That produces the standard Vite-bundled dist.\n`);
console.log(`Static ESM build complete: ${files.length} source modules transpiled to ${distRoot}`);
