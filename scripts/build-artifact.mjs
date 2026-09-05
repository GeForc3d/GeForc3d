/**
 * Folds the built CSS and JS into one HTML file for the Artifact publisher.
 *
 * The Artifact host supplies its own doctype, html, head and body, so this
 * emits page content only: a title, the app's stylesheet, its mount point and
 * its script.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist-artifact';
const assets = await readdir(join(DIST, 'assets'));

const css = assets.find((f) => f.endsWith('.css'));
const js = assets.find((f) => f.endsWith('.js'));
if (!css || !js) throw new Error('Expected one CSS and one JS asset in the build');

const styles = await readFile(join(DIST, 'assets', css), 'utf8');
const script = await readFile(join(DIST, 'assets', js), 'utf8');

const html = `<title>POSE</title>
<style>
${styles}
</style>
<div id="root"></div>
<script type="module">
${script}
</script>
`;

const out = join(DIST, 'pose.html');
await writeFile(out, html, 'utf8');
const mb = (Buffer.byteLength(html) / 1048576).toFixed(2);
console.log(`${out} — ${mb} MB (Artifact ceiling is 16 MB)`);
