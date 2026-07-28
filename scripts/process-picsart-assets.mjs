/**
 * Turn the reviewed Picsart illustrations into production-ready game assets.
 *
 * The generated source art uses a lightly textured cream paper. A global
 * chroma key would also erase pale vegetables and snow, so this script only
 * removes paper pixels that are connected to the outside border. The result is
 * then trimmed, centred and encoded at the exact canvas size used by the game.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const jobs = [
  ['potatoes-seedream.jpeg', 'harvest-potatoes.webp', 300, 300, 18],
  ['roots-seedream.jpeg', 'harvest-roots.webp', 300, 300, 18],
  ['leafy-seedream.jpeg', 'harvest-leafy.webp', 300, 300, 18],
  ['cabbage-seedream.jpeg', 'harvest-cabbage.webp', 300, 300, 18],
  ['herbs-seedream.jpeg', 'harvest-herbs.webp', 300, 300, 18],
  ['apples-seedream.jpeg', 'harvest-apples.webp', 300, 300, 18],
  ['winter-gate-seedream-v2.jpeg', 'gate2-winter.webp', 564, 528, 8],
];

const median = values => {
  const sorted = values.sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const smoothstep = value => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};

function borderKey(data, width, height, channels) {
  const band = Math.max(3, Math.min(8, Math.floor(Math.min(width, height) / 120)));
  const r = [];
  const g = [];
  const b = [];
  const add = (x, y) => {
    const offset = (y * width + x) * channels;
    r.push(data[offset]);
    g.push(data[offset + 1]);
    b.push(data[offset + 2]);
  };
  for (let x = 0; x < width; x += 2) {
    for (let y = 0; y < band; y++) {
      add(x, y);
      add(x, height - 1 - y);
    }
  }
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < band; x++) {
      add(x, y);
      add(width - 1 - x, y);
    }
  }
  return [median(r), median(g), median(b)];
}

function removeConnectedPaper(data, width, height, channels, key) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  // Keep traversal deliberately conservative. Pale roots and winter snow can
  // be close to the paper colour, but their ink outline is darker than this
  // threshold and therefore remains a closed, opaque foreground shape.
  const clearDistance = 18;
  const traversalDistance = 46;

  const distanceAt = index => {
    const offset = index * channels;
    return Math.max(
      Math.abs(data[offset] - key[0]),
      Math.abs(data[offset + 1] - key[1]),
      Math.abs(data[offset + 2] - key[2]),
    );
  };
  const visit = index => {
    if (visited[index] || distanceAt(index) > traversalDistance) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) visit(index - 1);
    if (x + 1 < width) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y + 1 < height) visit(index + width);
  }

  const rgba = Buffer.alloc(total * 4);

  for (let index = 0; index < total; index++) {
    const source = index * channels;
    const target = index * 4;
    rgba[target] = data[source];
    rgba[target + 1] = data[source + 1];
    rgba[target + 2] = data[source + 2];

    let alpha = 255;
    if (visited[index]) {
      const distance = distanceAt(index);
      const ratio = (distance - clearDistance) /
        (traversalDistance - clearDistance);
      alpha = Math.round(255 * smoothstep(ratio));
      if (alpha < 10) alpha = 0;
    }
    rgba[target + 3] = alpha;
  }

  // JPEG paper texture can leave a handful of isolated opaque specks. All
  // selected illustrations are a single connected botanical/gate motif, so
  // retain its largest alpha component and discard those production artefacts.
  const component = new Int32Array(total);
  component.fill(-1);
  let largestId = -1;
  let largestSize = 0;
  let componentId = 0;
  for (let start = 0; start < total; start++) {
    if (component[start] !== -1 || rgba[start * 4 + 3] < 20) continue;
    head = 0;
    tail = 0;
    queue[tail++] = start;
    component[start] = componentId;
    let size = 0;
    while (head < tail) {
      const index = queue[head++];
      size++;
      const x = index % width;
      const y = Math.floor(index / width);
      const neighbours = [];
      if (x > 0) neighbours.push(index - 1);
      if (x + 1 < width) neighbours.push(index + 1);
      if (y > 0) neighbours.push(index - width);
      if (y + 1 < height) neighbours.push(index + width);
      for (const next of neighbours) {
        if (component[next] === -1 && rgba[next * 4 + 3] >= 20) {
          component[next] = componentId;
          queue[tail++] = next;
        }
      }
    }
    if (size > largestSize) {
      largestSize = size;
      largestId = componentId;
    }
    componentId++;
  }

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let index = 0; index < total; index++) {
    const alphaOffset = index * 4 + 3;
    if (component[index] !== largestId) rgba[alphaOffset] = 0;
    if (rgba[alphaOffset] >= 32) {
      const x = index % width;
      const y = Math.floor(index / width);
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < left || bottom < top) {
    throw new Error('No foreground remained after paper removal.');
  }
  const sourcePadding = Math.max(3, Math.round(Math.min(width, height) * 0.006));
  left = Math.max(0, left - sourcePadding);
  top = Math.max(0, top - sourcePadding);
  right = Math.min(width - 1, right + sourcePadding);
  bottom = Math.min(height - 1, bottom + sourcePadding);
  return {
    rgba,
    box: {
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1,
    },
  };
}

async function processJob([sourceName, outputName, width, height, margin]) {
  const input = path.join(root, 'art-candidates', sourceName);
  const output = path.join(root, 'assets', outputName);
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const key = borderKey(data, info.width, info.height, info.channels);
  const { rgba, box } = removeConnectedPaper(
    data,
    info.width,
    info.height,
    info.channels,
    key,
  );
  const innerWidth = width - margin * 2;
  const innerHeight = height - margin * 2;

  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(box)
    .resize(innerWidth, innerHeight, {
      fit: 'contain',
      position: 'centre',
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: margin,
      bottom: margin,
      left: margin,
      right: margin,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({
      quality: 86,
      alphaQuality: 96,
      effort: 6,
      smartSubsample: true,
    })
    .toFile(output);

  console.log(
    `${outputName}: key #${key.map(value => value.toString(16).padStart(2, '0')).join('')}` +
    ` · source box ${box.width}×${box.height}+${box.left}+${box.top}` +
    ` · canvas ${width}×${height}`,
  );
}

for (const job of jobs) {
  await processJob(job);
}
