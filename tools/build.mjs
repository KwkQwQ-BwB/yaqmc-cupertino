// Builds the installable plugin: build/ (unpacked, for Developer Mode) and dist/<id>-<version>.yaqmc-plugin.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { Script } from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * YAQMC wraps plugin CSS in `@layer yaqmc-plugin-style.<id>`, while the app's own CSS is unlayered
 * and its theme tokens are inline on <html>. Only `!important` declarations of a layer beat those,
 * so sources stay clean and every declaration is promoted here (keyframes cannot carry it).
 */
export function importantize(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack = []; // true = raw block (@keyframes / @font-face): leave declarations alone
  let out = '';
  let buf = '';
  let depth = 0;
  let quote = '';
  const raw = () => stack.includes(true);
  const flush = () => {
    const text = buf.trim();
    buf = '';
    if (!text) return;
    out += raw() || text.startsWith('@') || /!important$/i.test(text) ? text : `${text} !important`;
    out += ';';
  };
  for (const ch of source) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
    } else if (ch === '(') {
      depth += 1;
      buf += ch;
    } else if (ch === ')') {
      depth -= 1;
      buf += ch;
    } else if (depth > 0) {
      buf += ch;
    } else if (ch === '{') {
      const prelude = buf.trim().replace(/\s+/g, ' ');
      buf = '';
      stack.push(/^@(?:-webkit-)?(?:keyframes|font-face|property)\b/.test(prelude));
      out += `${prelude}{`;
    } else if (ch === '}') {
      flush();
      stack.pop();
      out += '}\n';
    } else if (ch === ';') {
      flush();
    } else {
      buf += ch;
    }
  }
  if (stack.length || depth || quote || buf.trim()) throw new Error('Unbalanced CSS');
  return out;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const crc = crc32(file.bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x21, 12); // 1980-01-01: deterministic archive
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.bytes.length, 18);
    local.writeUInt32LE(file.bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, file.bytes);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.bytes.length, 20);
    central.writeUInt32LE(file.bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + file.bytes.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

export async function build() {
  const text = async (name) => (await readFile(path.join(root, name), 'utf8')).replaceAll('\r\n', '\n');
  const manifest = JSON.parse(await text('manifest.json'));
  const { styles = [], scenes = [], script } = manifest.entrypoints;
  const files = [{ name: 'manifest.json', bytes: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) }];
  for (const name of styles) {
    const css = importantize(await text(name));
    // Mirrors the host scanner (crates/yaqmc-core/src/plugin/scanner.rs): any hit blocks the style.
    if (/@import|url\(\s*["']?(?:https?:|file:)/i.test(css)) throw new Error(`${name}: remote CSS`);
    files.push({ name, bytes: Buffer.from(css) });
  }
  for (const name of scenes) {
    JSON.parse(await text(name));
    files.push({ name, bytes: Buffer.from(await text(name)) });
    const css = name.replace(/\.scene\.json$/, '.css');
    files.push({ name: css, bytes: Buffer.from(await text(css)) });
  }
  const source = await text(script);
  new Script(source, { filename: script });
  files.push({ name: script, bytes: Buffer.from(source) });
  files.push({ name: 'LICENSE', bytes: Buffer.from(await text('LICENSE')) });

  await rm(path.join(root, 'build'), { recursive: true, force: true });
  for (const file of files) {
    const target = path.join(root, 'build', file.name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.bytes);
  }
  const output = path.join(root, 'dist', `${manifest.id}-${manifest.version}.yaqmc-plugin`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, zipStore(files));
  return { output, files };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { output, files } = await build();
  process.stdout.write(`Packed ${files.length} files -> ${path.relative(root, output)}\n`);
}
