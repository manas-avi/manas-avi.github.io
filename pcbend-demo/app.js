import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader }     from 'three/addons/loaders/OBJLoader.js';
import { STLLoader }     from 'three/addons/loaders/STLLoader.js';
import { PLYLoader }     from 'three/addons/loaders/PLYLoader.js';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const dropzone      = document.getElementById('dropzone');
const viewer        = document.getElementById('viewer');
const canvas        = document.getElementById('canvas');
const fileInput     = document.getElementById('file-input');
const browseBtn     = document.getElementById('browse-btn');
const closeBtn      = document.getElementById('close-btn');
const wireframeBtn  = document.getElementById('wireframe-btn');
const resetCamBtn   = document.getElementById('reset-camera-btn');
const fileNameEl    = document.getElementById('file-name');
const formatBadge   = document.getElementById('format-badge');
const meshStats     = document.getElementById('mesh-stats');
const loadingEl     = document.getElementById('loading');
const errorToast    = document.getElementById('error-toast');

// ── Three.js setup ────────────────────────────────────────────────────────────
const scene    = new THREE.Scene();
scene.background = new THREE.Color(0x0f0f1a);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.001, 10000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance   = 0.01;
controls.maxDistance   = 5000;

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(1, 2, 2);
scene.add(dirLight);

const backLight = new THREE.DirectionalLight(0x8888ff, 0.3);
backLight.position.set(-1, -1, -1);
scene.add(backLight);

// Animation loop
(function animate() {
  requestAnimationFrame(animate);
  // #viewer is hidden whenever the dropzone or the fold viewer is up, and drawing a
  // hidden canvas still costs a full frame. The fold viewer's lamp scene carries a
  // room, an IBL and a per-LED light loop, so it wants every millisecond.
  if (viewer.classList.contains('hidden')) return;
  controls.update();
  renderer.render(scene, camera);
})();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── State ─────────────────────────────────────────────────────────────────────
let currentObject    = null;
let wireframeOn      = false;
let savedCameraPos   = null;
let savedTarget      = null;
let errorTimer       = null;

// ── Camera fit ────────────────────────────────────────────────────────────────
function fitCameraToObject(object) {
  const box    = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());

  object.position.sub(center); // center at origin

  const dist = sphere.radius * 2.5;
  camera.position.set(0, 0, dist);
  camera.near = dist / 100;
  camera.far  = dist * 100;
  camera.updateProjectionMatrix();

  controls.target.set(0, 0, 0);
  controls.update();

  savedCameraPos = camera.position.clone();
  savedTarget    = controls.target.clone();
}

// ── Mesh stats ────────────────────────────────────────────────────────────────
function countGeometry(object) {
  let vertices = 0, faces = 0;
  object.traverse(child => {
    if (child.isMesh && child.geometry) {
      const geo = child.geometry;
      if (geo.attributes.position) {
        vertices += geo.attributes.position.count;
      }
      if (geo.index) {
        faces += geo.index.count / 3;
      } else if (geo.attributes.position) {
        faces += geo.attributes.position.count / 3;
      }
    }
  });
  return { vertices: Math.round(vertices), faces: Math.round(faces) };
}

// ── Default material ──────────────────────────────────────────────────────────
function applyDefaultMaterial(object) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8899cc,
    roughness: 0.55,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  object.traverse(child => {
    if (child.isMesh) {
      // Only replace if no real material is present
      if (!child.material || child.material.type === 'MeshBasicMaterial') {
        child.material = mat;
      }
    }
  });
}

// ── Show/hide UI ──────────────────────────────────────────────────────────────
function showViewer() {
  dropzone.classList.add('hidden');
  viewer.classList.remove('hidden');
}

function showDropzone() {
  viewer.classList.add('hidden');
  dropzone.classList.remove('hidden');
}

function showLoading(v) {
  loadingEl.classList.toggle('hidden', !v);
}

function showError(msg) {
  if (errorTimer) clearTimeout(errorTimer);
  errorToast.textContent = msg;
  errorToast.classList.remove('hidden');
  errorTimer = setTimeout(() => errorToast.classList.add('hidden'), 4000);
}

// ── Object management ─────────────────────────────────────────────────────────
function clearScene() {
  if (currentObject) {
    scene.remove(currentObject);
    currentObject.traverse(child => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    currentObject = null;
  }
  wireframeOn = false;
  wireframeBtn.textContent = 'Wireframe: Off';
  wireframeBtn.classList.remove('active');
}

function addToScene(object, fileName, ext) {
  clearScene();
  applyDefaultMaterial(object);
  fitCameraToObject(object);
  scene.add(object);
  currentObject = object;

  fileNameEl.textContent = fileName;
  formatBadge.textContent = ext.toUpperCase();
  const { vertices, faces } = countGeometry(object);
  meshStats.innerHTML =
    `Vertices: ${vertices.toLocaleString()}<br>Faces: ${faces.toLocaleString()}`;
}

// ── Loaders ───────────────────────────────────────────────────────────────────
const LOADERS = {
  obj:  () => new OBJLoader(),
  stl:  () => new STLLoader(),
  ply:  () => new PLYLoader(),
  gltf: () => new GLTFLoader(),
  glb:  () => new GLTFLoader(),
  // .off is the pipeline's own mesh format, so it is droppable too — reusing
  // parseOFF() from the fold viewer rather than a second parser.
  off:  () => new OFFLoader(),
};

// Bare-BufferGeometry loaders: handed to a Mesh with a default material below.
const GEOMETRY_LOADERS = new Set(['stl', 'ply', 'off']);

function loadMesh(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!LOADERS[ext]) {
    showError(`Unsupported format: .${ext}`);
    return;
  }

  showLoading(true);
  showViewer();

  const url    = URL.createObjectURL(file);
  const loader = LOADERS[ext]();

  const onLoad = (result) => {
    URL.revokeObjectURL(url);
    showLoading(false);

    let object;
    if (GEOMETRY_LOADERS.has(ext)) {
      // Raw BufferGeometry — wrap in a Mesh
      const geo = result;
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: 0x8899cc,
        roughness: 0.55,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
      object = new THREE.Mesh(geo, mat);
    } else if (ext === 'gltf' || ext === 'glb') {
      object = result.scene;
    } else {
      // OBJ — returns a Group
      object = result;
    }

    addToScene(object, file.name, ext);
  };

  const onError = (err) => {
    URL.revokeObjectURL(url);
    showLoading(false);
    console.error(err);
    showError(`Failed to load ${file.name}: ${err.message ?? err}`);
    if (!currentObject) showDropzone();
  };

  loader.load(url, onLoad, undefined, onError);

  // Ask the backend for this mesh's PCB assets, if a backend is there at all.
  // Deliberately not awaited: the preview above must never wait on a pipeline
  // run. See the PCBend section at the bottom of this file.
  requestGeneration(file);
}

// ── Drag & drop ───────────────────────────────────────────────────────────────
dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', e => {
  if (!dropzone.contains(e.relatedTarget)) {
    dropzone.classList.remove('drag-over');
  }
});

dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadMesh(file);
});

// Also allow dropping onto the viewer (to swap meshes)
viewer.addEventListener('dragover', e => e.preventDefault());
viewer.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) loadMesh(file);
});

// ── Click-to-browse ───────────────────────────────────────────────────────────
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadMesh(fileInput.files[0]);
  fileInput.value = '';
});

// ── Panel controls ────────────────────────────────────────────────────────────
closeBtn.addEventListener('click', () => {
  clearScene();
  showDropzone();
});

wireframeBtn.addEventListener('click', () => {
  wireframeOn = !wireframeOn;
  wireframeBtn.textContent = `Wireframe: ${wireframeOn ? 'On' : 'Off'}`;
  wireframeBtn.classList.toggle('active', wireframeOn);

  if (currentObject) {
    currentObject.traverse(child => {
      if (child.isMesh) child.material.wireframe = wireframeOn;
    });
  }
});

resetCamBtn.addEventListener('click', () => {
  if (savedCameraPos) {
    camera.position.copy(savedCameraPos);
    controls.target.copy(savedTarget);
    controls.update();
  }
});

// ── Fold Animation Viewer (PCBend sheet + LEDs) ───────────────────────────────
//
// Folds a PCBend unfolding back onto its source mesh, carrying the generated
// LEDs along with the faces.
//
// Inputs, all produced by pcbend-plus/generate.sh:
//   <name>.off    source mesh (3D, millimetres)
//   <name>.sheet  flat PCB layout: triangles, hinge quads, edge adjacency
//   <name>.led    LED centres + oriented half-extents, in mesh space / 100
//   <name>.map    addressable chain order -> index into the .led vertex list
//
// Geometry model (validated against the icosa-020 output):
//   * sheet face i corresponds to mesh face i, vertex order i <-> i
//   * a flat triangle is its mesh triangle inset per-edge by the hinge offsets.
//     Insetting keeps edge directions, so the flat triangle is *similar* to the
//     mesh triangle (angles match to <0.001 deg) at a per-face scale < 1.
//   * therefore a scale-1 rigid frame map seats each PCB face concentrically
//     inside its mesh triangle, which is what keeps the physical hinge gaps.
//
// The fold itself walks the hinge spanning tree and screw-interpolates each
// hinge, so t=0 is exactly the fabricated flat sheet and t=1 is exactly the
// folded mesh, with faces staying joined at their hinges throughout.

const foldFolderInput  = document.getElementById('fold-folder-input');
const foldFolderSelect = document.getElementById('fold-folder-select');
const foldLoadBtn      = document.getElementById('fold-load-btn');
const foldViewerEl     = document.getElementById('fold-viewer');
const foldCanvas       = document.getElementById('fold-canvas');
const foldCloseBtn     = document.getElementById('fold-close-btn');
const foldWireframeBtn = document.getElementById('fold-wireframe-btn');
const foldFolderNameEl = document.getElementById('fold-folder-name');
const foldStatsEl      = document.getElementById('fold-stats');
const foldLoadingEl    = document.getElementById('fold-loading');
const foldPlayBtn      = document.getElementById('fold-play-btn');
const foldSlider       = document.getElementById('fold-slider');
const foldPercentEl    = document.getElementById('fold-percent');
const foldLedsBtn      = document.getElementById('fold-leds-btn');
const foldHingesBtn    = document.getElementById('fold-hinges-btn');
const foldChainBtn     = document.getElementById('fold-chain-btn');
const foldEffectSel    = document.getElementById('fold-effect');
const foldDomainBtn    = document.getElementById('fold-domain-btn');
const foldBrightness   = document.getElementById('fold-brightness');
const foldSpeed        = document.getElementById('fold-speed');
const foldEnvSel       = document.getElementById('fold-env');
const foldExposure     = document.getElementById('fold-exposure');
const foldLampGain     = document.getElementById('fold-lamp-gain');
const foldRigBtn       = document.getElementById('fold-rig-btn');
const foldBoardEnvBtn  = document.getElementById('fold-boardenv-btn');
const foldDiffuserBtn  = document.getElementById('fold-diffuser-btn');
const foldDiffStandoff = document.getElementById('fold-diff-standoff');
const foldDiffGlow     = document.getElementById('fold-diff-glow');
const foldSpinBtn      = document.getElementById('fold-spin-btn');
const foldOrientX      = document.getElementById('fold-orient-x');
const foldOrientY      = document.getElementById('fold-orient-y');
const foldOrientZ      = document.getElementById('fold-orient-z');
const foldOrientReset  = document.getElementById('fold-orient-reset');
const foldBeam         = document.getElementById('fold-beam');

// The ledifier writes LED coordinates in mesh-space/100 (mesh_scale in
// pipeline/placer/src/visualize_layout.cpp), so scale them back up to mm.
const LED_MESH_SCALE = 100;
const LED_LIFT       = 0.25;   // mm above the board, avoids z-fighting
const LED_DOT_LIFT   = 0.35;   // mm, the emitter disc sits just above its package
const CHAIN_LIFT     = 0.55;   // mm, chain rides above the LEDs
// The diffuser cell: a translucent panel standing off the board with a skirt sealing it
// down, so each face is its own little lampshade with its LEDs inside.
const DIFFUSER_BASE  = 0.7;    // mm, skirt foot — clear of the chain at 0.55
const DIFFUSER_LIFT  = 3.0;    // mm, panel height above the board
const DIFFUSER_INSET = 0.8;    // mm, shrink so neighbouring cells never intersect
const HINGE_SPANS    = 4;      // strips across a hinge gap; more = smoother bend

// A module's whole footprint is the package; only a small disc in the middle of it
// emits. Per-LED vertex layout is the package quad first (corners 0,1,2,0,2,3), then
// the emitter disc as a fan — so the debug helpers can keep reading corners off the
// front of the run, and uploadStrip() only ever writes the tail.
const LED_DOT_SEGS   = 12;     // triangles in the emitter disc
const LED_DOT_SPAN   = 0.5;    // disc radius, as a fraction of the shorter half-side
const LED_BODY_VERTS = 6;
const LED_VERTS      = LED_BODY_VERTS + LED_DOT_SEGS * 3;
const LED_BODY_RGB   = [0.11, 0.12, 0.14];   // unlit package, dark against the board

// ── OFF parser ────────────────────────────────────────────────────────────────
function parseOFF(text) {
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));
  let idx = 0;
  if (lines[idx].toUpperCase() === 'OFF') idx++;
  const [nV, nF] = lines[idx++].split(/\s+/).map(Number);
  const vertices = new Float32Array(nV * 3);
  for (let i = 0; i < nV; i++) {
    const parts = lines[idx++].split(/\s+/);
    vertices[i * 3]     = parseFloat(parts[0]);
    vertices[i * 3 + 1] = parseFloat(parts[1]);
    vertices[i * 3 + 2] = parseFloat(parts[2]);
  }
  const faces = [];
  for (let i = 0; i < nF; i++) {
    const parts = lines[idx++].split(/\s+/).map(Number);
    const n = parts[0];
    // fan-triangulate: (v0, v1, v2), (v0, v2, v3), ... Polygon vertices start at
    // parts[1], so triangle j spans parts[1], parts[j+1], parts[j+2].
    for (let j = 1; j <= n - 2; j++) {
      faces.push(parts[1], parts[j + 1], parts[j + 2]);
    }
  }
  return { vertices, faces: new Uint32Array(faces) };
}

// Adapter so the mesh viewer can open a .off through the same LOADERS table as
// the three.js loaders: same load(url, onLoad, onProgress, onError) contract,
// returning a bare BufferGeometry like STLLoader and PLYLoader do.
class OFFLoader {
  load(url, onLoad, _onProgress, onError) {
    fetch(url)
      .then(r => r.text())
      .then(text => {
        const { vertices, faces } = parseOFF(text);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.setIndex(new THREE.BufferAttribute(faces, 1));
        geo.computeVertexNormals();
        onLoad(geo);
      })
      .catch(onError);
  }
}

// ── .sheet parser ─────────────────────────────────────────────────────────────
// Record layout is documented in pipeline/helpers/src/Sheet.cpp and written by
// saveSheet() in pipeline/unfolder/src/mesh.cpp.
function parseSheet(text) {
  const verts = [];        // flat vertices, z is always 0
  const faces = [];        // [v0,v1,v2] per sheet face id (== mesh face id)
  const hinges = [];       // [h0,h1,h2,h3]; h0->h1 is parallel to the face edge
  const edges = [];        // adjacency, indexed by edge id
  const faceEdges = [];    // fid -> [e0,e1,e2], edge i lies between vert i,i+1
  let counts = null;
  let margin = 0;          // extra inset the unfolder trims off cut edges

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const p = line.split(/\s+/);
    switch (p[0]) {
      case 'si':
        counts = { verts: +p[1], faces: +p[2], hinges: +p[3] };
        break;
      case 'v':
        verts.push([+p[1], +p[2], +p[3]]);
        break;
      case 'f':
        faces.push([+p[1], +p[2], +p[3]]);
        break;
      case 'h':
        hinges.push([+p[1], +p[2], +p[3], +p[4]]);
        break;
      case 'e':
        edges.push({
          hid: +p[1], f0: +p[2], f1: +p[3], offset: +p[4],
          isHinge: p[5] === '1', isHalfHinge: p[6] === '1', isBoundary: p[7] === '1',
        });
        break;
      case 'fe':
        faceEdges[+p[1]] = [+p[2], +p[3], +p[4]];
        break;
      case 'up':
        // drill bit radius, user fabrication margin. The margin is the extra inset
        // trimPerimeterEdges() shaves off *cut* edges on top of edge.offset, so it
        // is needed to undo the inset and recover the source mesh triangle.
        margin = +p[2];
        break;
      default:
        break;   // hp carries hinge track dimensions we do not need here
    }
  }
  if (!counts) throw new Error('.sheet has no "si" header — not a PCBend sheet file');
  return { counts, verts, faces, hinges, edges, faceEdges, margin };
}

// ── .led parser ───────────────────────────────────────────────────────────────
// saveLedInfo() in pipeline/placer/src/visualize_layout.cpp writes
//   v x y z <faceId> <half-extent 0> <half-extent 1>
//   e i j          (data-chain edges)
function parseLed(text) {
  const leds = [], chain = [];
  const s = LED_MESH_SCALE;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const p = line.split(/\s+/);
    if (p[0] === 'v') {
      leds.push({
        pos: new THREE.Vector3(+p[1] * s, +p[2] * s, +p[3] * s),
        fid: +p[4],
        hv:  new THREE.Vector3(+p[5] * s, +p[6] * s, +p[7] * s),
        vv:  new THREE.Vector3(+p[8] * s, +p[9] * s, +p[10] * s),
      });
    } else if (p[0] === 'e') {
      chain.push([+p[1], +p[2]]);
    }
  }
  return { leds, chain };
}

// ── .map parser ───────────────────────────────────────────────────────────────
// "physical_index led_index" from pipeline/orderer/src/ordering_leds.cpp. A -1
// led_index marks a slot with no LED (e.g. the connector), so drop those.
function parseMap(text) {
  const rows = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const p = line.split(/\s+/);
    if (p.length < 2) continue;
    const physical = +p[0], led = +p[1];
    if (Number.isFinite(physical) && Number.isFinite(led) && led >= 0) {
      rows.push({ physical, led });
    }
  }
  rows.sort((a, b) => a.physical - b.physical);
  return rows.map(r => r.led);
}

// ── Directory discovery ───────────────────────────────────────────────────────
// Two ways to learn a fold's four file names. assets/manifest.json is the one
// that works anywhere, and is written by `server.py --write-manifest` (and after
// every run). Scraping the directory listing is the original way and stays as a
// fallback: it is what covers a bare `python3 -m http.server` and a folder
// dropped into assets/ by hand, neither of which has re-run the manifest. A
// static host such as GitHub Pages serves no listing at all, so there the
// manifest is the only path.

let assetManifest;             // undefined = not fetched yet, null = none here
let manifestPending = null;    // in-flight fetch, so two callers share one request
let manifestEpoch   = 0;       // bumped on invalidation, so a fetch already in
                               // flight cannot write its stale result back

async function loadManifest() {
  if (assetManifest !== undefined) return assetManifest;
  if (!manifestPending) {
    const epoch = manifestEpoch;
    manifestPending = (async () => {
      let value = null;
      try {
        const res = await fetch('assets/manifest.json', { cache: 'no-store' });
        if (res.ok) value = await res.json();
      } catch { /* none here; the listing scrape below is the fallback */ }
      if (epoch === manifestEpoch) {
        assetManifest = value;
        manifestPending = null;
      }
      return value;
    })();
  }
  return manifestPending;
}

// A newly generated fold is not in the copy fetched at page load, and server.py
// has just rewritten the file, so drop it and let the next read pick it up.
function invalidateManifest() {
  assetManifest  = undefined;
  manifestPending = null;
  manifestEpoch++;
}

function manifestFolders() {
  return assetManifest?.folders ?? [];
}

async function discoverFoldFiles(folderName) {
  const dirUrl = `assets/${folderName}/`;
  const manifest = await loadManifest();

  const entry = manifest?.folders?.find(f => f.folder === folderName);
  if (entry) {
    const files = entry.files || {};
    if (!files.off || !files.sheet) {
      throw new Error(`Incomplete manifest entry for "${folderName}"`);
    }
    return {
      offUrl:   dirUrl + files.off,
      sheetUrl: dirUrl + files.sheet,
      ledUrl:   files.led ? dirUrl + files.led : null,
      mapUrl:   files.map ? dirUrl + files.map : null,
    };
  }

  // Not in the manifest (or there is none): fall back to the listing scrape.
  // When a manifest did load, name what it does hold -- on a static host that
  // list is exhaustive, so "not found" is the whole story.
  const known = manifestFolders().map(f => f.folder);
  const notFound = () => new Error(
    known.length ? `Folder not found: "${folderName}". Available: ${known.join(', ')}`
                 : `Folder not found: "${folderName}"`);

  let res;
  try {
    res = await fetch(dirUrl);
  } catch {
    throw notFound();
  }
  if (!res.ok) throw notFound();
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const hrefs = [...doc.querySelectorAll('a')].map(a => a.getAttribute('href'));
  const pick = ext => hrefs.find(h => h && h.toLowerCase().endsWith(ext));
  const offFile   = pick('.off');
  const sheetFile = pick('.sheet');
  if (!offFile)   throw new Error(`No .off file found in assets/${folderName}/`);
  if (!sheetFile) throw new Error(`No .sheet file found in assets/${folderName}/`);
  const ledFile = pick('.led'), mapFile = pick('.map');   // both optional
  return {
    offUrl:   dirUrl + offFile,
    sheetUrl: dirUrl + sheetFile,
    ledUrl:   ledFile ? dirUrl + ledFile : null,
    mapUrl:   mapFile ? dirUrl + mapFile : null,
  };
}

// ── Fold Three.js scene (lazy-initialised) ────────────────────────────────────
let foldScene, foldCamera, foldRenderer, foldControls;
let foldGroup = null;
let foldModel = null;          // everything buildFoldModel() produced
let foldPcbMesh = null, foldLedMesh = null, foldChainLines = null;
let foldDiffuserMesh = null;
let foldShowDiffuser = false;   // off by default: it is a look, not a diagnostic
let foldWireframeOn = false;
let foldAnimating   = false;
let foldT           = 0;
let foldRafId       = null;
let foldShowLeds   = true;
let foldShowHinges = true;
let foldShowChain  = false;
let foldLastTime   = 0;

// The LEDs only run once the shape is fully folded. A half-folded board is a
// fabrication view — the lamp is not a lamp until it is closed — and this is also
// what makes Play a reveal: the room fades in (see envFade) and the strip comes up
// at the end of the sweep. Not a taper: "completely folded" is a state, not a
// degree, so the gate is binary. The epsilon is there because the slider's 100
// steps and the fold integrator both land on 1 exactly, but a hand-set t of 0.9999
// from a debug hook should still count as closed.
const LED_ON_T = 0.999;
const ledsLit = () => foldT >= LED_ON_T;

// The three base lights are module-level rather than locals of initFoldScene because
// an environment preset has to be able to dim them: a "dark room" scene where the
// board is the only light source cannot have a 1.15 key light in it. ENV_BASE records
// today's values so the 'none' preset can restore them exactly.
let foldAmbient = null, foldKeyLight = null, foldFillLight = null, foldHemiLight = null;
const ENV_BASE = {
  ambient: 0.55, ambientColor: 0xffffff,
  key:     1.15, keyColor:     0xffffff,
  fill:    0.35, fillColor:    0x8888ff,
  hemi:    0.0,  hemiSky:      0xffffff, hemiGround: 0x404040,
};

function initFoldScene() {
  if (foldScene) return;

  foldScene = new THREE.Scene();
  foldScene.background = new THREE.Color(0x0f0f1a);

  foldCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.001, 10000);
  foldCamera.position.set(0, 0, 5);

  foldRenderer = new THREE.WebGLRenderer({ canvas: foldCanvas, antialias: true });
  foldRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  foldRenderer.setSize(innerWidth, innerHeight);

  foldControls = new OrbitControls(foldCamera, foldRenderer.domElement);
  foldControls.enableDamping  = true;
  foldControls.dampingFactor  = 0.07;
  foldControls.minDistance    = 0.01;
  foldControls.maxDistance    = 5000;

  // Directional/ambient/hemisphere only: these are the light types whose contribution
  // is scale-invariant, which matters because the environment rig is a unit-sized
  // group scaled to millimetres. A PointLight's decay is evaluated in world space and
  // ignores an ancestor's scale, so one authored in rig units would be wrong by S².
  foldAmbient = new THREE.AmbientLight(ENV_BASE.ambientColor, ENV_BASE.ambient);
  foldKeyLight = new THREE.DirectionalLight(ENV_BASE.keyColor, ENV_BASE.key);
  foldKeyLight.position.set(1, 2, 2);
  foldFillLight = new THREE.DirectionalLight(ENV_BASE.fillColor, ENV_BASE.fill);
  foldFillLight.position.set(-1, -1, -1);
  foldHemiLight = new THREE.HemisphereLight(ENV_BASE.hemiSky, ENV_BASE.hemiGround, ENV_BASE.hemi);
  foldScene.add(foldAmbient, foldKeyLight, foldFillLight, foldHemiLight);

  foldGroup = new THREE.Group();
  foldScene.add(foldGroup);
  // A parked scene is NOT applied here: setEnvironment() bakes and sizes a rig, and at
  // this point in loadFoldViewer the model does not exist yet, so measureFolded() would
  // return null and buildRig() would no-op. It is applied at the end of the load, where
  // the fit is measurable — see the env block there.
}

function startFoldRenderLoop() {
  if (foldRafId) return;
  foldLastTime = performance.now();
  (function loop(now = performance.now()) {
    foldRafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - foldLastTime) / 1000);
    foldLastTime = now;
    if (foldAnimating) advanceFold(dt);
    advanceSpin(dt);
    advanceEffect(dt);
    foldControls.update();
    // Must run after controls (it reads the camera) and before the render. Not hung
    // off uploadStrip(), which is skipped on frames where no effect step fired, nor
    // off setFoldT(), because the view matrix is a per-frame input.
    updateLedLights();
    tickLedQuality(dt);
    foldRenderer.render(foldScene, foldCamera);
  })();
}

// ── Rigid-transform helpers ───────────────────────────────────────────────────

// Port of performTriangleOffset() in pipeline/placer/src/helper.cpp. One call slides
// the edge line v1-v2 toward v0 by `off`, keeping the other two lines where they are:
// v1 and v2 travel along v0v1 and v0v2 so the triangle stays similar to itself.
// Applied to all three edges the result is just the intersection of the three shifted
// lines, so the call order does not matter. Negative offsets push an edge outward.
function offsetEdge(p0, p1, p2, off) {
  const v12n = new THREE.Vector2().subVectors(p2, p1).normalize();
  const v01 = new THREE.Vector2().subVectors(p0, p1);
  const v01n = v01.clone().normalize();
  const v02n = new THREE.Vector2().subVectors(p0, p2).normalize();
  // unit inward normal of edge v1-v2, obtained by projecting v01 off the edge
  const perp = v01.clone().sub(v12n.clone().multiplyScalar(v01.dot(v12n))).normalize();
  p1.add(v01n.multiplyScalar(off / v01n.dot(perp)));
  p2.add(v02n.multiplyScalar(off / v02n.dot(perp)));
}

// Inset (or, with negative offsets, expand) a 2D triangle edge line by edge line.
// PCBend's convention, which the offset triplets follow: o[0] moves edge v1-v2,
// o[1] moves v2-v0, o[2] moves v0-v1.
function offsetTriangle(tri, o) {
  const p = tri.map(v => new THREE.Vector2(v.x, v.y));
  offsetEdge(p[0], p[1], p[2], o[0]);
  offsetEdge(p[1], p[2], p[0], o[1]);
  offsetEdge(p[2], p[0], p[1], o[2]);
  return p.map(v => new THREE.Vector3(v.x, v.y, 0));
}

// The affine map carrying one triangle onto another, corner i onto corner i, with
// the normal direction carried along so it is defined off-plane too. Unlike
// faceFrame this is not scale-1: it reproduces whatever scaling sits between the
// two triangles, which is exactly what undoing the placer's LED mapping needs.
function triangleMap(fromTri, toTri) {
  const basis = t => {
    const e1 = new THREE.Vector3().subVectors(t[1], t[0]);
    const e2 = new THREE.Vector3().subVectors(t[2], t[0]);
    const n = new THREE.Vector3().crossVectors(e1, e2).normalize();
    return new THREE.Matrix4().makeBasis(e1, e2, n);
  };
  const L = new THREE.Matrix4()
    .multiplyMatrices(basis(toTri), basis(fromTri).invert());
  return new THREE.Matrix4()
    .makeTranslation(toTri[0].x, toTri[0].y, toTri[0].z)
    .multiply(L)
    .multiply(new THREE.Matrix4()
      .makeTranslation(-fromTri[0].x, -fromTri[0].y, -fromTri[0].z));
}

// Rigid map taking a flat sheet point to where it sits on the folded mesh face.
// Built from matching orthonormal frames rather than a least-squares fit: the
// flat and mesh triangles are similar with corner correspondence i<->i, so
// centroid + corner-0 direction + face normal pins the placement exactly.
function faceFrame(flatTri, meshTri) {
  const c = new THREE.Vector3()
    .add(flatTri[0]).add(flatTri[1]).add(flatTri[2]).multiplyScalar(1 / 3);
  const C = new THREE.Vector3()
    .add(meshTri[0]).add(meshTri[1]).add(meshTri[2]).multiplyScalar(1 / 3);

  const ez = new THREE.Vector3(0, 0, 1);
  const u1 = new THREE.Vector3().subVectors(flatTri[0], c).normalize();
  const u2 = new THREE.Vector3().crossVectors(ez, u1).normalize();

  const N = new THREE.Vector3().crossVectors(
    new THREE.Vector3().subVectors(meshTri[1], meshTri[0]),
    new THREE.Vector3().subVectors(meshTri[2], meshTri[0]),
  ).normalize();
  const U1 = new THREE.Vector3().subVectors(meshTri[0], C).normalize();
  const U2 = new THREE.Vector3().crossVectors(N, U1).normalize();

  // R maps the flat basis onto the world basis: R = Bworld * Bflat^T
  const Bflat  = new THREE.Matrix4().makeBasis(u1, u2, ez).transpose();
  const Bworld = new THREE.Matrix4().makeBasis(U1, U2, N);
  const R = new THREE.Matrix4().multiplyMatrices(Bworld, Bflat);

  return new THREE.Matrix4()
    .makeTranslation(C.x, C.y, C.z)
    .multiply(R)
    .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
}

// Decompose a rigid transform into a screw (rotation about a line + slide along
// it) so it can be interpolated as a true hinge motion instead of a lerp that
// would let faces drift apart mid-fold.
function screwFromMatrix(L) {
  const q = new THREE.Quaternion();
  const d = new THREE.Vector3();
  const s = new THREE.Vector3();
  L.decompose(d, q, s);

  q.normalize();
  let angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
  if (q.w < 0) angle = -angle;             // keep the short way round
  const sinHalf = Math.sqrt(Math.max(0, 1 - q.w * q.w));

  if (sinHalf < 1e-9 || Math.abs(angle) < 1e-9) {
    return { pure: true, d: d.clone() };   // no rotation: straight translation
  }
  const axis = new THREE.Vector3(q.x, q.y, q.z).divideScalar(sinHalf);
  if (angle < 0) { axis.negate(); angle = -angle; }

  const slide = d.dot(axis);
  const dPerp = d.clone().sub(axis.clone().multiplyScalar(slide));
  // Point on the screw axis: c0 = (dPerp + cot(angle/2) * (axis x dPerp)) / 2
  const cot = 1 / Math.tan(angle / 2);
  const c0 = dPerp.clone()
    .add(new THREE.Vector3().crossVectors(axis, dPerp).multiplyScalar(cot))
    .multiplyScalar(0.5);

  return { pure: false, axis, angle, slide, c0 };
}

// Evaluate a screw at fraction t. t=0 is the identity, t=1 reproduces L.
function screwAt(screw, t, out) {
  if (screw.pure) {
    return out.makeTranslation(screw.d.x * t, screw.d.y * t, screw.d.z * t);
  }
  const { axis, angle, slide, c0 } = screw;
  const R = new THREE.Matrix4().makeRotationAxis(axis, angle * t);
  const shift = c0.clone().add(axis.clone().multiplyScalar(slide * t));
  return out
    .makeTranslation(shift.x, shift.y, shift.z)
    .multiply(R)
    .multiply(new THREE.Matrix4().makeTranslation(-c0.x, -c0.y, -c0.z));
}

// ── Model construction ────────────────────────────────────────────────────────
function buildFoldModel(off, sheet, led, mapOrder) {
  const nFaces = sheet.faces.length;
  const meshTriCount = off.faces.length / 3;
  if (meshTriCount !== nFaces) {
    throw new Error(
      `.off has ${meshTriCount} triangles but .sheet has ${nFaces} faces — ` +
      `they must come from the same mesh`);
  }

  const flatV = sheet.verts.map(v => new THREE.Vector3(v[0], v[1], v[2]));
  const meshV = [];
  for (let i = 0; i < off.vertices.length; i += 3) {
    meshV.push(new THREE.Vector3(off.vertices[i], off.vertices[i + 1], off.vertices[i + 2]));
  }

  // The placer centres the mesh on the origin before it places LEDs, so .led
  // coordinates are relative to the mesh bounding box, not to the .off origin.
  const meshBox = new THREE.Box3().setFromPoints(meshV);
  const meshBoxCentre = meshBox.getCenter(new THREE.Vector3());

  // A sheet face is its mesh triangle with every edge line pushed inward: by the
  // edge's hinge offset, plus the fabrication margin on cut edges. Undoing that
  // recovers the source triangle exactly, and that — not the inset board triangle —
  // is what the board has to be seated against.
  //
  // The placer undoes the same inset to map LEDs onto the mesh, but its parseSheet()
  // (pipeline/placer/src/helper.cpp) keys the offset table by the `e` record's hinge
  // id and then reads it back by *edge index*, so the triangle it actually used is a
  // different one. Rebuild that triangle too: inverting the map the placer really
  // applied is what restores the fabricated LED footprint.
  const offsetByHid = new Map();
  sheet.edges.forEach(e => offsetByHid.set(e.hid, e.offset));

  const unfoldTri = [], ledTri = [];
  // faceEdges is [e0,e1,e2] with e0 between v0 and v1; offsetTriangle wants the
  // offset of the edge *opposite* each vertex, so the triplet rotates by one.
  const OPPOSITE = [1, 2, 0];
  for (let fid = 0; fid < nFaces; fid++) {
    const ft = sheet.faces[fid].map(i => flatV[i]);
    const fe = sheet.faceEdges[fid];
    if (!fe) { unfoldTri[fid] = ft; ledTri[fid] = ft; continue; }
    unfoldTri[fid] = offsetTriangle(ft, OPPOSITE.map(k => {
      const e = sheet.edges[fe[k]];
      return -(e.offset + (e.isHinge ? 0 : sheet.margin));
    }));
    ledTri[fid] = offsetTriangle(ft, OPPOSITE.map(k => -(offsetByHid.get(fe[k]) || 0)));
  }

  // Per-face rigid placement, flat sheet space -> folded world space.
  const A = [], Ainv = [], meshPlanes = [];
  // Mesh space -> flat sheet space for LEDs. These carry the scale between the two
  // triangles, so they are affine remaps rather than the board's scale-1 frame map.
  const ledToFlat = { placer: [], unfolded: [] };
  let worstScale = 0;
  for (let fid = 0; fid < nFaces; fid++) {
    const ut = unfoldTri[fid];
    const mt = [off.faces[fid * 3], off.faces[fid * 3 + 1], off.faces[fid * 3 + 2]]
      .map(i => meshV[i]);
    A[fid] = faceFrame(ut, mt);
    Ainv[fid] = A[fid].clone().invert();
    ledToFlat.placer[fid] = triangleMap(mt, ledTri[fid]);
    ledToFlat.unfolded[fid] = triangleMap(mt, ut);
    meshPlanes[fid] = new THREE.Plane().setFromCoplanarPoints(mt[0], mt[1], mt[2]);

    // The un-offset triangle must come out congruent to the mesh triangle — that
    // is what makes the scale-1 frame map valid. Warn loudly if it does not.
    for (let i = 0; i < 3; i++) {
      const fl = ut[i].distanceTo(ut[(i + 1) % 3]);
      const ml = mt[i].distanceTo(mt[(i + 1) % 3]);
      worstScale = Math.max(worstScale, Math.abs(fl / ml - 1));
    }
  }
  if (worstScale > 1e-3) {
    console.warn(`[fold] un-offset sheet triangles differ from the mesh triangles by ` +
      `up to ${(worstScale * 100).toFixed(2)}% — face placement may be off`);
  }

  // Hinge topology: edge records carry the hinge id and the two faces it joins.
  const hingeOf = new Map();     // hinge id -> { eid, f0, f1 }
  sheet.edges.forEach((e, eid) => {
    if (e.isHinge && e.hid >= 0) hingeOf.set(e.hid, { eid, f0: e.f0, f1: e.f1 });
  });

  // Each hinge quad becomes a strip spanning the gap between the two face
  // edges it joins. (h0,h1) lies on one face's edge and (h3,h2) on the other's;
  // decide which by comparing against that face's edge midpoint from the fe
  // records. Strip vertices blend the two faces' transforms by how far across
  // the gap they sit, so the hinge bends smoothly and stays attached to both
  // faces instead of cracking open at a crease.
  const hingeStrips = [];
  for (let hid = 0; hid < sheet.hinges.length; hid++) {
    const info = hingeOf.get(hid);
    if (!info) continue;
    const [a, b, c, d] = sheet.hinges[hid].map(i => flatV[i]);

    const slot = (sheet.faceEdges[info.f0] || []).indexOf(info.eid);
    let nearFace = info.f0, farFace = info.f1;
    if (slot >= 0) {
      const tri = sheet.faces[info.f0];
      const em = new THREE.Vector3()
        .addVectors(flatV[tri[slot]], flatV[tri[(slot + 1) % 3]]).multiplyScalar(0.5);
      const dAB = em.distanceTo(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5));
      const dCD = em.distanceTo(new THREE.Vector3().addVectors(c, d).multiplyScalar(0.5));
      if (dCD < dAB) { nearFace = info.f1; farFace = info.f0; }
    }
    // across the gap a pairs with d and b with c
    for (let k = 0; k < HINGE_SPANS; k++) {
      const s0 = k / HINGE_SPANS, s1 = (k + 1) / HINGE_SPANS;
      hingeStrips.push({
        quad: [
          a.clone().lerp(d, s0), b.clone().lerp(c, s0),
          b.clone().lerp(c, s1), a.clone().lerp(d, s1),
        ],
        weights: [s0, s0, s1, s1],
        faceA: nearFace, faceB: farFace,
      });
    }
  }

  // Spanning forest over faces through hinges; one tree per patch.
  const adj = Array.from({ length: nFaces }, () => []);
  for (const [hid, info] of hingeOf) {
    if (info.f0 < nFaces && info.f1 < nFaces) {
      adj[info.f0].push({ to: info.f1, hid });
      adj[info.f1].push({ to: info.f0, hid });
    }
  }
  const patchOf = new Int32Array(nFaces).fill(-1);
  const order = [];            // BFS order, parents always before children
  const parent = new Int32Array(nFaces).fill(-1);
  let patchCount = 0;
  for (let root = 0; root < nFaces; root++) {
    if (patchOf[root] !== -1) continue;
    const pid = patchCount++;
    patchOf[root] = pid;
    const queue = [root];
    order.push(root);
    while (queue.length) {
      const f = queue.shift();
      for (const { to } of adj[f]) {
        if (patchOf[to] === -1) {
          patchOf[to] = pid;
          parent[to] = f;
          order.push(to);
          queue.push(to);
        }
      }
    }
  }

  // Screw per face. Roots interpolate from the fabricated flat layout (centred
  // on the origin in the XY plane) to their folded pose; children interpolate
  // relative to their parent, which is what makes hinges stay joined.
  const flatCentre = new THREE.Vector3();
  for (const v of flatV) flatCentre.add(v);
  flatCentre.divideScalar(Math.max(1, flatV.length));
  const M0 = new THREE.Matrix4().makeTranslation(-flatCentre.x, -flatCentre.y, -flatCentre.z);
  const M0inv = M0.clone().invert();

  const screws = [];
  const baseOf = [];           // matrix the screw is applied on top of
  for (const fid of order) {
    if (parent[fid] === -1) {
      screws[fid] = screwFromMatrix(new THREE.Matrix4().multiplyMatrices(M0inv, A[fid]));
      baseOf[fid] = M0;
    } else {
      const p = parent[fid];
      screws[fid] = screwFromMatrix(
        new THREE.Matrix4().multiplyMatrices(Ainv[p], A[fid]));
      baseOf[fid] = null;      // parent's live transform, filled in per frame
    }
  }

  // ---- vertex streams. Each vertex carries its position in flat sheet space
  // plus the face(s) whose transform moves it: a board vertex rides one face,
  // a hinge vertex blends two by how far it sits across the gap.
  const pcbFaceA = [], pcbFaceB = [], pcbWeight = [];
  const pcbLocal = [], pcbColor = [], pcbIsHinge = [];
  const pushTri = (verts, col, isHinge) => {
    for (const { p, fa, fb, w } of verts) {
      pcbFaceA.push(fa);
      pcbFaceB.push(fb);
      pcbWeight.push(w);
      pcbLocal.push(p.x, p.y, p.z);
      pcbColor.push(col.r, col.g, col.b);
      pcbIsHinge.push(isHinge ? 1 : 0);
    }
  };

  const patchHue = pid => (patchCount === 1 ? 0.42 : pid / patchCount);
  const faceColors  = [], hingeColors = [];
  for (let pid = 0; pid < patchCount; pid++) {
    faceColors[pid]  = new THREE.Color().setHSL(patchHue(pid), 0.45, 0.40);
    hingeColors[pid] = new THREE.Color().setHSL(patchHue(pid), 0.50, 0.24);
  }

  for (let fid = 0; fid < nFaces; fid++) {
    const tri = sheet.faces[fid].map(i => ({ p: flatV[i], fa: fid, fb: fid, w: 0 }));
    pushTri(tri, faceColors[patchOf[fid]], false);
  }
  for (const { quad, weights, faceA, faceB } of hingeStrips) {
    const col = hingeColors[patchOf[faceA]] || hingeColors[0];
    const v = quad.map((p, k) => ({ p, fa: faceA, fb: faceB, w: weights[k] }));
    pushTri([v[0], v[1], v[2]], col, true);
    pushTri([v[0], v[2], v[3]], col, true);
  }

  // ---- Diffuser cells: a closed translucent box over each face, LEDs sealed inside
  //
  // One cell per mesh face: a panel standing DIFFUSER_LIFT mm off the board plus a
  // skirt sealing it down to DIFFUSER_BASE, so light cannot leak sideways into a
  // neighbour. Built in the face's flat frame, exactly like the LED stream, because a
  // flat-frame +Z offset stays a rigid outward offset through the whole fold.
  //
  // The triangle is inset so neighbouring cells do not intersect as the shell closes,
  // and so the skirt stays clear of the hinge strips. offsetTriangle already does this
  // (positive offsets shrink) and returns fresh vectors, so flatV is never mutated.
  const diffFace = [], diffLocal = [], diffLift = [];
  let diffSwapped = 0;
  for (let fid = 0; fid < nFaces; fid++) {
    const raw = sheet.faces[fid].map(i => flatV[i]);
    const inner = offsetTriangle(raw, [DIFFUSER_INSET, DIFFUSER_INSET, DIFFUSER_INSET]);

    // faceFrame matches basis to basis, so it does NOT require the flat triangle to be
    // CCW in the xy plane — some faces come through wound the other way. Normalise the
    // winding here so computeVertexNormals() yields an OUTWARD normal for every cell;
    // otherwise the transmission test is inverted on an arbitrary subset of faces.
    const area2 = (inner[1].x - inner[0].x) * (inner[2].y - inner[0].y) -
                  (inner[2].x - inner[0].x) * (inner[1].y - inner[0].y);
    const q = area2 < 0 ? [inner[0], inner[2], inner[1]] : inner;
    if (area2 < 0) diffSwapped++;

    const push = (p, lift) => {
      diffFace.push(fid);
      diffLocal.push(p.x, p.y, DIFFUSER_BASE + lift * (DIFFUSER_LIFT - DIFFUSER_BASE));
      diffLift.push(lift);
    };

    // Panel: one triangle at the top, CCW so its normal is +Z (outward).
    push(q[0], 1); push(q[1], 1); push(q[2], 1);

    // Skirt: three quads from the base ring up to the panel ring. Wound so the outward
    // face points away from the cell interior.
    for (let k = 0; k < 3; k++) {
      const a = q[k], b = q[(k + 1) % 3];
      push(a, 0); push(b, 0); push(b, 1);
      push(a, 0); push(b, 1); push(a, 1);
    }
  }

  // ---- LEDs: express each corner in its face's flat frame so it rides along
  const leds = (led ? led.leds : []).filter(l => l.fid >= 0 && l.fid < nFaces);
  // parseLed has already applied LED_MESH_SCALE. Positions still need the bounding
  // box centre added back; hv/vv are half-extent vectors, so they only need the scale.
  const ledCentreMesh = l => l.pos.clone().add(meshBoxCentre);
  const ledQuad = (l, inv) => [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    .map(([a, b]) => ledCentreMesh(l)
      .add(l.hv.clone().multiplyScalar(a))
      .add(l.vv.clone().multiplyScalar(b))
      .applyMatrix4(inv[l.fid]));

  // Which un-offset triangle the .led file was written against depends on whether
  // the placer's offset lookup has been fixed upstream. The LED footprint is a
  // constant of the fabricated design, so let the data decide: whichever map turns
  // every LED into the same size rectangle is the one that inverts the placer.
  const footprintSpread = inv => {
    if (leds.length < 2) return 0;
    const w = leds.map(l => { const q = ledQuad(l, inv); return q[0].distanceTo(q[1]); })
      .sort((a, b) => a - b);
    const median = w[w.length >> 1];
    return median > 1e-9 ? (w[w.length - 1] - w[0]) / median : Infinity;
  };
  const spread = {
    placer: footprintSpread(ledToFlat.placer),
    unfolded: footprintSpread(ledToFlat.unfolded),
  };
  const ledMap = spread.placer <= spread.unfolded ? 'placer' : 'unfolded';
  const ledInv = ledToFlat[ledMap];
  const ledSpread = spread[ledMap];
  if (ledSpread > 0.01) {
    console.warn(`[fold] LED footprints vary by ${(ledSpread * 100).toFixed(1)}% across ` +
      `the model — .led does not line up with this .sheet`);
  }

  const ledFace = [], ledLocal = [], ledCentreLocal = [], ledFaceOf = [];
  for (const l of leds) {
    const fid = l.fid;
    const corners = ledQuad(l, ledInv).map(p => p.setZ(LED_LIFT));

    // package: two triangles, 6 vertices. Never lit — it is the component body.
    for (const k of [0, 1, 2, 0, 2, 3]) {
      ledFace.push(fid);
      ledLocal.push(corners[k].x, corners[k].y, corners[k].z);
    }

    // emitter: a disc in the middle of the package, and the only part the strip
    // colours. Built from the package's own in-plane axes, so it stays a circle
    // however the footprint is rotated on the sheet. Its own fan, not an index
    // buffer, so the chase can still colour each LED independently.
    const mid = corners[0].clone().add(corners[2]).multiplyScalar(0.5);
    const u = corners[1].clone().sub(corners[0]).multiplyScalar(0.5);
    const v = corners[3].clone().sub(corners[0]).multiplyScalar(0.5);
    const r = LED_DOT_SPAN * Math.min(u.length(), v.length());
    u.normalize().multiplyScalar(r);
    v.normalize().multiplyScalar(r);
    const hub = mid.clone().setZ(LED_DOT_LIFT);
    const rim = k => mid.clone()
      .addScaledVector(u, Math.cos((k / LED_DOT_SEGS) * Math.PI * 2))
      .addScaledVector(v, Math.sin((k / LED_DOT_SEGS) * Math.PI * 2))
      .setZ(LED_DOT_LIFT);
    for (let k = 0; k < LED_DOT_SEGS; k++) {
      for (const p of [hub, rim(k), rim(k + 1)]) {
        ledFace.push(fid);
        ledLocal.push(p.x, p.y, p.z);
      }
    }

    const centre = ledCentreMesh(l).applyMatrix4(ledInv[fid]).setZ(CHAIN_LIFT);
    ledCentreLocal.push(centre);
    ledFaceOf.push(fid);
  }
  const ledCount = ledCentreLocal.length;

  // Addressable order. The .map file is the fabricated wiring order, so prefer
  // it; otherwise fall back to plain index order.
  let chaseOrder = (mapOrder || []).filter(i => i >= 0 && i < ledCount);
  if (!chaseOrder.length) chaseOrder = ledCentreLocal.map((_, i) => i);

  // ---- data chain, LED centre to LED centre.
  // With a .map we draw the real signal path: consecutive addressable LEDs are
  // wired to each other. The .led "e" records are not that path — they are the
  // neighbour graph the orderer solves over (within-triangle plus cross-face
  // edges), so they only stand in when no .map was generated.
  const chainFace = [], chainLocal = [];
  const link = (i, j) => {
    if (i < 0 || j < 0 || i >= ledCount || j >= ledCount) return;
    chainFace.push(ledFaceOf[i], ledFaceOf[j]);
    chainLocal.push(
      ledCentreLocal[i].x, ledCentreLocal[i].y, ledCentreLocal[i].z,
      ledCentreLocal[j].x, ledCentreLocal[j].y, ledCentreLocal[j].z);
  };
  const chainIsWiring = !!(mapOrder && mapOrder.length);
  if (chainIsWiring) {
    for (let k = 0; k + 1 < chaseOrder.length; k++) link(chaseOrder[k], chaseOrder[k + 1]);
  } else {
    for (const [i, j] of (led ? led.chain : [])) link(i, j);
  }

  return {
    nFaces, patchCount, patchOf, order, parent, screws, baseOf, A, M0, meshPlanes,
    hingeCount: hingeStrips.length / HINGE_SPANS,
    pcb: {
      faceA: new Int32Array(pcbFaceA),
      faceB: new Int32Array(pcbFaceB),
      weight: new Float32Array(pcbWeight),
      local: new Float32Array(pcbLocal),
      color: new Float32Array(pcbColor),
      isHinge: new Uint8Array(pcbIsHinge),
    },
    ledGeomData: {
      face: new Int32Array(ledFace),
      local: new Float32Array(ledLocal),
    },
    chainData: {
      face: new Int32Array(chainFace),
      local: new Float32Array(chainLocal),
    },
    // One closed translucent cell per face. `liftFrac` is 0 at the skirt foot and 1 at
    // the panel, which is what lets the standoff slider re-lift the cells with an O(n)
    // rewrite of the z column instead of rebuilding the stream.
    diffuserGeomData: {
      face: new Int32Array(diffFace),
      local: new Float32Array(diffLocal),
      liftFrac: new Float32Array(diffLift),
      swapped: diffSwapped,
    },
    ledCount, chainCount: chainFace.length / 2, chaseOrder, chainIsWiring,
    ledGraphEdges: led ? led.chain.length : 0,
    // Which un-offset triangle the .led file turned out to be written against, and
    // how uniform the recovered footprints are. Read back by foldDebug.ledFit().
    ledMap, ledSpread,
    // LED centres in their face's flat frame, plus the face each rides. Kept so
    // the spatial strip ordering can transform them into world space.
    ledCentreLocal, ledFaceOf,
    // The source mesh's bounding box. At t=1 transforms[root] == A, so the folded
    // object occupies exactly this box — which is how the environment rig knows where
    // to put the floor without perturbing foldT to measure. Note it is NOT centred on
    // the origin: batman-092 spans y -170..59, z 70..191.
    meshBox, meshBoxCentre,
    transforms: Array.from({ length: nFaces }, () => new THREE.Matrix4()),
  };
}

// ── Fold evaluation ───────────────────────────────────────────────────────────
const _step = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _pa = new THREE.Vector3();
const _pb = new THREE.Vector3();

function evaluateTransforms(t) {
  const m = foldModel;
  for (const fid of m.order) {
    screwAt(m.screws[fid], t, _step);
    if (m.parent[fid] === -1) {
      m.transforms[fid].multiplyMatrices(m.baseOf[fid], _step);
    } else {
      m.transforms[fid].multiplyMatrices(m.transforms[m.parent[fid]], _step);
    }
  }
}

// Board vertices ride a single face. Hinge vertices blend the two faces they
// bridge, which keeps the strip attached at both ends while it bends.
function applyTransforms(faceA, local, target, faceB, weight) {
  const T = foldModel.transforms;
  for (let i = 0, n = faceA.length; i < n; i++) {
    _p.set(local[i * 3], local[i * 3 + 1], local[i * 3 + 2]);
    const w = weight ? weight[i] : 0;
    if (w <= 0) {
      _p.applyMatrix4(T[faceA[i]]);
    } else if (w >= 1) {
      _p.applyMatrix4(T[faceB[i]]);
    } else {
      _pa.copy(_p).applyMatrix4(T[faceA[i]]);
      _pb.copy(_p).applyMatrix4(T[faceB[i]]);
      _p.lerpVectors(_pa, _pb, w);
    }
    target[i * 3]     = _p.x;
    target[i * 3 + 1] = _p.y;
    target[i * 3 + 2] = _p.z;
  }
}

function setFoldT(t) {
  const wasLit = ledsLit();
  foldT = Math.max(0, Math.min(1, t));
  foldSlider.value = Math.round(foldT * 100);
  foldPercentEl.textContent = `${Math.round(foldT * 100)}%`;
  if (!foldModel) return;

  evaluateTransforms(foldT);

  const pcbPos = foldPcbMesh.geometry.attributes.position;
  applyTransforms(foldModel.pcb.faceA, foldModel.pcb.local, pcbPos.array,
                  foldModel.pcb.faceB, foldModel.pcb.weight);
  pcbPos.needsUpdate = true;
  foldPcbMesh.geometry.computeVertexNormals();
  foldPcbMesh.geometry.computeBoundingSphere();

  if (foldLedMesh) {
    const p = foldLedMesh.geometry.attributes.position;
    applyTransforms(foldModel.ledGeomData.face, foldModel.ledGeomData.local, p.array);
    p.needsUpdate = true;
    foldLedMesh.geometry.computeBoundingSphere();
  }
  if (foldChainLines) {
    const p = foldChainLines.geometry.attributes.position;
    applyTransforms(foldModel.chainData.face, foldModel.chainData.local, p.array);
    p.needsUpdate = true;
    foldChainLines.geometry.computeBoundingSphere();
  }
  if (foldDiffuserMesh) {
    const p = foldDiffuserMesh.geometry.attributes.position;
    applyTransforms(foldModel.diffuserGeomData.face,
                    foldModel.diffuserGeomData.local, p.array);
    p.needsUpdate = true;
    // The glow is a function of the panel normal, so normals must follow the fold.
    // applyTransforms only rewrites positions.
    foldDiffuserMesh.geometry.computeVertexNormals();
    foldDiffuserMesh.geometry.computeBoundingSphere();
  }
  // The spatial strip order is defined by where the LEDs currently are, so it has
  // to follow the fold. Sorting a few dozen entries per step is negligible.
  if (stripDomain === 'spatial' && stripRGB) {
    rebuildStripOrder();
    uploadStrip();
  }
  // Crossing the on-gate has to rewrite the emitter colours. The cast light and the
  // diffuser glow come for free (updateLedLights runs every frame), but the colour
  // attribute is only written on an effect step, and a static effect — 'off', 'solid',
  // or a paused one — would leave the discs at their pre-gate brightness indefinitely.
  if (ledsLit() !== wasLit) uploadStrip();

  // A handful of scalar writes, negligible against the vertex pass above.
  applyEnvFade();
}

// ── LED strip ─────────────────────────────────────────────────────────────────
//
// The generated LEDs form one addressable chain, so they are driven exactly like
// a NeoPixel strip: `stripRGB` is the pixel buffer and every effect mutates it.
// A buffer (rather than recomputing colours per frame) is required because most
// of the ported patterns are stateful — fire keeps a heat byte per pixel, the
// comet/larson/confetti trails are built by repeatedly fading the previous
// frame, and bouncingBalls integrates physics between steps.
//
// Patterns are ported from neopixel_patterns.txt. That sketch is tuned for a
// 500-pixel strip; this board has ~63 LEDs, so per-pixel spatial frequencies are
// scaled by SPATIAL_REF / n (see stripFreq) or the waves would show well under
// one period across the strip and read as a flat wash.

const SPATIAL_REF = 500;       // strip length the sketch's constants assume
const FIRE_COOLING  = 55;
const FIRE_SPARKING = 120;
const CHASE_WINDOW  = 8;       // LEDs lit in the trailing comet
const MAX_STEPS_PER_FRAME = 4; // keeps a stalled tab from spinning the driver

let stripRGB   = null;         // Uint8Array(n * 3), the pixel buffer
let stripOrder = null;         // Int32Array(n), strip slot -> LED index
let stripFreq  = 1;            // SPATIAL_REF / n
let stripDomain = 'wiring';    // 'wiring' (.map order) or 'spatial' (by height)
let effectId   = 'rainbow';
let effectAcc  = 0;            // ms accumulated toward the next step
let effectState = {};          // per-effect scratch, (re)built by reset()

// ── Ported strip helpers ──────────────────────────────────────────────────────
const qadd8 = (a, b) => (a + b > 255 ? 255 : a + b);
const qsub8 = (a, b) => (a - b < 0 ? 0 : a - b);
const rnd = (a, b) => (b === undefined
  ? Math.floor(Math.random() * a)
  : a + Math.floor(Math.random() * (b - a)));

const stripLen = () => (stripRGB ? stripRGB.length / 3 : 0);

function sSet(k, r, g, b) {
  if (k < 0 || k >= stripLen()) return;
  stripRGB[k * 3] = r; stripRGB[k * 3 + 1] = g; stripRGB[k * 3 + 2] = b;
}
function sClear() { stripRGB.fill(0); }

// Scale every pixel down by scale/256 — the sketch's fadeAll, used for trails.
function sFadeAll(scale) {
  for (let i = 0; i < stripRGB.length; i++) {
    stripRGB[i] = (stripRGB[i] * scale) >> 8;
  }
}

// Fill the strip with one colour scaled by scale/255 — the sketch's fillScaled.
function sFillScaled(rgb, scale) {
  const r = (rgb[0] * scale) / 255, g = (rgb[1] * scale) / 255, b = (rgb[2] * scale) / 255;
  for (let k = 0, n = stripLen(); k < n; k++) sSet(k, r, g, b);
}

// Map heat 0-255 to a black-body flame colour (red -> orange -> white).
function heatColor(temperature) {
  const t192 = Math.round((temperature / 255) * 191);
  const ramp = (t192 & 0x3f) << 2;
  if (t192 > 0x80) return [255, 255, ramp];
  if (t192 > 0x40) return [255, ramp, 0];
  return [ramp, 0, 0];
}

// Adafruit_NeoPixel::gamma8 — a 2.6 gamma ramp. Ported so the colour-wheel
// patterns land on the same tones the hardware shows.
const GAMMA8 = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) t[i] = Math.floor(Math.pow(i / 255, 2.6) * 255 + 0.5);
  return t;
})();

// Adafruit_NeoPixel::ColorHSV. hue is 0-65535, sat/val are 0-255. This is HSV
// with their specific 3-way ramp, not THREE.Color's HSL, so it is ported rather
// than approximated.
function hsv(hue, sat = 255, val = 255, gamma = true) {
  hue = ((hue % 65536) + 65536) % 65536;
  hue = (hue * 1530 + 32768) >> 16;
  let r, g, b;
  if (hue < 510)       { if (hue < 255) { r = 255; g = hue; b = 0; } else { r = 510 - hue; g = 255; b = 0; } }
  else if (hue < 1020) { if (hue < 765) { r = 0; g = 255; b = hue - 510; } else { r = 0; g = 1020 - hue; b = 255; } }
  else if (hue < 1530) { if (hue < 1275) { r = hue - 1020; g = 0; b = 255; } else { r = 255; g = 0; b = 1530 - hue; } }
  else                 { r = 255; g = 0; b = 0; }

  const v1 = 1 + val;
  const s1 = 1 + sat;
  const s2 = 255 - sat;
  r = ((((r * s1) >> 8) + s2) * v1) >> 8;
  g = ((((g * s1) >> 8) + s2) * v1) >> 8;
  b = ((((b * s1) >> 8) + s2) * v1) >> 8;
  return gamma ? [GAMMA8[r], GAMMA8[g], GAMMA8[b]] : [r, g, b];
}

// ── Strip ordering ────────────────────────────────────────────────────────────
// Every pattern is a function of strip index, so swapping this permutation is
// all it takes to make each of them geometry-aware.
const _lc = new THREE.Vector3();

function rebuildStripOrder() {
  if (!foldModel || !foldModel.ledCount) return;
  const n = foldModel.ledCount;
  if (!stripOrder || stripOrder.length !== n) stripOrder = new Int32Array(n);

  if (stripDomain === 'spatial') {
    // Sort by world height (screen up) so slot 0 is the lowest LED: fire then
    // rises up the object, comet/rainbow sweep it, balls bounce vertically.
    //
    // foldGroup's matrix has to be in here. foldModel.transforms is model space and
    // knows nothing about the user's orientation correction, so without it "up" would
    // stay the *unrotated* up — flip the cat 90° about Y and the fire would still
    // climb along what is now a horizontal axis. The turntable spin costs nothing
    // here: a Y-rotation preserves every y, so it cannot reorder this.
    const ys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const c = foldModel.ledCentreLocal[i];
      _lc.copy(c).applyMatrix4(foldModel.transforms[foldModel.ledFaceOf[i]])
        .applyMatrix4(foldGroup.matrixWorld);
      ys[i] = _lc.y;
    }
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => ys[a] - ys[b]);
    stripOrder.set(idx);
  } else {
    // Wiring order from .map: exactly what the physical chain would show.
    const order = foldModel.chaseOrder;
    const seen = new Uint8Array(n);
    let w = 0;
    for (const i of order) {
      if (i >= 0 && i < n && !seen[i]) { seen[i] = 1; stripOrder[w++] = i; }
    }
    // Any LED the .map did not mention still needs a slot, or it could never light.
    for (let i = 0; i < n; i++) if (!seen[i]) stripOrder[w++] = i;
  }
}

// ── Per-LED scene illumination ────────────────────────────────────────────────
//
// Every LED is its own light: its own position, its own colour, its own emission
// direction. There is no PointLight for them — three's forward renderer bakes
// NUM_POINT_LIGHTS into the shader and packs the lights into a uniform array, which
// tops out long before the 309 LEDs on the cat, and a point-light shadow is a cube
// render (309 of those would be 1854 depth passes per frame). Instead the lights live
// in a float texture and an injected loop in each receiver's shader walks it.
//
// Positions and normals are stored in VIEW space and refilled every frame, exactly as
// WebGLLights.setupLightsView() does for three's own lights. `geometryPosition` and
// `geometryNormal` at the injection point are view space, and so is the direction
// RE_Direct expects, so this costs zero matrix work per fragment. The trade is that
// the texture is camera-dependent — which is free, because OrbitControls' damping
// keeps the camera drifting every frame anyway.

const LED_TEX_W    = 512;   // >= any model's ledCount (the cat, at 309, is the max)
const LED_TEX_ROWS = 3;     // 0: view pos + cutoff, 1: colour, 2: view emitter normal
// MAX_LEDS values we are willing to compile. A flat 512 risks drivers fully unrolling
// a ~30-instruction body into 15k instructions — multi-second compiles, or a link
// failure on weaker drivers. Bucketing means at most 5 distinct programs across every
// shipped asset, so the program cache actually hits.
const LED_BUCKETS  = [32, 64, 128, 256, 512];
// Irradiance reference distance, in mm. The world is millimetres and irradiance goes
// as power/d², so at d=100 a naive intensity of 1 lands at 1e-4 — invisible. Rather
// than expose a magic number, the slider means "irradiance this far from the board".
// 140 is calibrated so gain 1.0 reads well against the deliberately dark room
// surfaces: a single LED is a few lumens against a ~0.08 albedo floor, so the honest
// physical answer is dimmer than anyone wants to look at.
const LED_POWER_REF = 140;

let ledLightTex    = null;   // THREE.DataTexture, LED_TEX_W x 3, RGBA32F
let ledLightData   = null;   // Float32Array(LED_TEX_W * LED_TEX_ROWS * 4)
let ledLightMax    = 0;      // the currently compiled MAX_LEDS bucket
let ledLightOn     = true;
let ledLightBudget = 512;    // quality knob: cast light from at most this many LEDs
let ledPerVertex   = false;  // quality knob: evaluate the loop per-vertex instead
const ledReceivers = [];     // every material carrying the injection, for recompiles

// One shared uniform object per name, spliced into every receiver's uniforms by
// applyLedLighting(), so writing .value here updates all of them at once.
const ledLightUniforms = {
  uLedTex:     { value: null },
  uLedCount:   { value: 0 },
  uLedPower:   { value: 0 },
  uLedCutoff:  { value: 0 },     // mm; feeds getDistanceAttenuation's cutoffDistance
  uLedDecay:   { value: 2.0 },   // 2.0 == physical inverse square
  uLedLobe:    { value: 1.0 },   // 0 = omnidirectional, 1 = fully directed
  uLedMinDist: { value: 3.0 },   // mm; treats an LED as an area light, not a point
  // Each LED is a directed emitter: a spot whose source is the LED's position and
  // whose axis is its outward face normal. These are the cone, in the same
  // cos-of-angle form three's own SpotLight uses, plus a Phong-style focus exponent
  // that tightens the beam inside the cone.
  uLedConeCos:     { value: Math.cos(55 * Math.PI / 180) },
  uLedPenumbraCos: { value: Math.cos(22 * Math.PI / 180) },
  uLedFocus:       { value: 1.6 },
};

// The diffuser cells get their own light count so EVERY lit LED reaches them, while the
// room's receivers stay clamped to the performance budget. Every other uniform is the
// same OBJECT, shared by reference, so a single write still updates both.
//
// The directed beam is deliberately shared rather than overridden: a panel standing
// directly above an LED is on-axis (dot(ledN, -L) ≈ 1), so the room's cone is exactly
// right here. That is the difference from trying to light the board itself, whose own
// face lies at ~90° off-axis and so cannot be lit by a forward beam at all.
const ledGlowUniforms = { ...ledLightUniforms, uLedCount: { value: 0 } };

// uDiffWrap spreads the transmitted glow sideways across a panel instead of leaving a
// hotspot directly over each LED — 0 is a hard cosine, higher wraps light around the
// terminator.
//
// uDiffPower and uDiffSoft exist because the room's uLedPower cannot be reused here.
// That is calibrated as irradiance at LED_POWER_REF = 140mm; a panel sits ~3mm from its
// LEDs, so the same number arrives (140/3)² ≈ 2000× too hot and every cell saturates to
// white. Both are derived from the standoff in tuneDiffuser(), which is what makes glow
// = 1 look correct at any standoff rather than needing to be re-dialled.
const ledDiffUniforms = {
  uDiffWrap:  { value: 0.5 },
  uDiffPower: { value: 1.0 },
  uDiffSoft:  { value: 4.5 },   // mm; distance clamp, flattens the near-field hotspot
};

// How far beyond the standoff to clamp the distance falloff. Larger flattens the glow
// across a panel; at 1.0 each LED reads as a hard dot on the underside.
const DIFF_SOFT_FACTOR = 1.6;
// Calibration so the glow slider reads 100% at a good-looking default. The clamp
// distance only holds directly under an LED — across the rest of a panel the real
// distance is larger and both the wrap and emission cosines cut in, and the panel is
// then alpha-blended at its opacity. Measured, not derived.
const DIFF_POWER_SCALE = 3.0;

function tuneDiffuser() {
  const standoff = uiDiffStandoff();
  const soft = DIFF_SOFT_FACTOR * standoff;
  const glow = Math.max(0, Number(foldDiffGlow?.value ?? 100) / 100);
  ledDiffUniforms.uDiffSoft.value = soft;
  // Expressed as irradiance at the clamp distance, so glow = 1 means "unit brightness"
  // no matter how far the panel stands off.
  ledDiffUniforms.uDiffPower.value = glow * DIFF_POWER_SCALE * soft * soft;
}

const LED_BEAM_DEFAULT = 55;     // cone half-angle in degrees

// Cone half-angle in degrees -> the two cosines. The penumbra is a fixed fraction of
// the cone so a narrow beam does not end up with a wider soft edge than its own core.
function setLedBeamAngle(deg) {
  const a = Math.max(5, Math.min(90, deg));
  ledLightUniforms.uLedConeCos.value = Math.cos(a * Math.PI / 180);
  ledLightUniforms.uLedPenumbraCos.value = Math.cos(a * 0.4 * Math.PI / 180);
}

function ensureLedLightTex() {
  if (ledLightTex) return;
  ledLightData = new Float32Array(LED_TEX_W * LED_TEX_ROWS * 4);
  ledLightTex = new THREE.DataTexture(
    ledLightData, LED_TEX_W, LED_TEX_ROWS, THREE.RGBAFormat, THREE.FloatType);
  // texelFetch ignores filtering, but a float texture left on LinearFilter is
  // incomplete without OES_texture_float_linear on some drivers and samples black.
  ledLightTex.minFilter = ledLightTex.magFilter = THREE.NearestFilter;
  ledLightTex.generateMipmaps = false;
  ledLightTex.wrapS = ledLightTex.wrapT = THREE.ClampToEdgeWrapping;
  ledLightTex.colorSpace = THREE.NoColorSpace;   // payload is data, never sRGB-decoded
  ledLightTex.needsUpdate = true;
  ledLightUniforms.uLedTex.value = ledLightTex;
}

const ledBucketFor = n =>
  LED_BUCKETS.find(b => b >= n) ?? LED_BUCKETS[LED_BUCKETS.length - 1];

// One gain for the emitter discs and the cast light both, so they can never disagree
// about how bright an LED is. Folds the on-gate in: below it the strip is dark, which
// leaves the board a plain PCB while it folds instead of a lit one lying flat.
const ledGain = () =>
  ledsLit() ? Math.max(0, Number(foldBrightness?.value ?? 100) / 100) : 0;

const uiLampGain = () => Math.max(0, Number(foldLampGain?.value ?? 100) / 100);

function tuneLedLighting() {
  ledLightUniforms.uLedPower.value = uiLampGain() * LED_POWER_REF * LED_POWER_REF;
  // Past ~1.25 diagonals a contribution is invisible anyway, and a tight cutoff is
  // what makes the squared range cull in the shader actually pay.
  const diag = foldModel?.meshBox
    ? foldModel.meshBox.getSize(new THREE.Vector3()).length() : 300;
  ledLightUniforms.uLedCutoff.value = 1.25 * diag;
}

// ── The injected GLSL ─────────────────────────────────────────────────────────

const LED_LIGHT_PARS = /* glsl */`
#ifdef MAX_LEDS
  uniform sampler2D uLedTex;
  uniform int   uLedCount;
  uniform float uLedPower;
  uniform float uLedCutoff;
  uniform float uLedDecay;
  uniform float uLedLobe;
  uniform float uLedMinDist;
  uniform float uLedConeCos;
  uniform float uLedPenumbraCos;
  uniform float uLedFocus;
#endif
`;

// Injected immediately BEFORE <lights_fragment_end>, i.e. after every built-in direct
// light and before the two indirect calls, so scene.environment IBL and the base
// lights all still contribute normally.
//
// In scope here (r165 renamed these from the old geometry.* struct):
//   geometryPosition  view-space fragment position
//   geometryNormal    view-space shading normal
//   geometryViewDir, geometryClearcoatNormal, material, reflectedLight
const LED_LIGHT_BODY = /* glsl */`
#if defined( MAX_LEDS ) && defined( RE_Direct ) && !defined( LED_PER_VERTEX )
{
  IncidentLight ledLight;
  ledLight.visible = true;

  for ( int i = 0; i < MAX_LEDS; i ++ ) {
    // The index and every texel it fetches are identical for every fragment in the
    // draw, so these branches are uniform across the warp: real skips, not masked
    // lanes.
    if ( i >= uLedCount ) break;

    vec4 posCut = texelFetch( uLedTex, ivec2( i, 0 ), 0 );
    vec3 toLight = posCut.xyz - geometryPosition;
    float distSq = dot( toLight, toLight );
    if ( distSq > posCut.w * posCut.w ) continue;

    // An LED sits 0.25mm above its own board face, so with 1/d² an unclamped
    // distance blows out into a white ring around every package.
    float dist = max( sqrt( max( distSq, 1e-8 ) ), uLedMinDist );
    vec3 L = normalize( toLight );

    // Receiver-side cosine. RE_Direct_Physical applies saturate(dot(N,L)) itself, so
    // this is purely a cull — do not multiply it in again.
    if ( dot( geometryNormal, L ) <= 0.0 ) continue;

    // Each LED is a DIRECTED emitter: source at its own position, axis along its
    // outward face normal. The axis term is the cosine of the angle off that axis, so
    // the cone is the same smoothstep three's SpotLight uses, and uLedFocus tightens
    // the beam inside it.
    //
    // Beyond looking right, the directionality is load-bearing: without it a closed
    // shell lights the floor from the LEDs on its far, inward-facing panels and the
    // effect turns to mush. On a convex shell it doubles as an exact occlusion test,
    // because there "the LED faces you" and "the LED can see you" coincide.
    vec3 ledN = texelFetch( uLedTex, ivec2( i, 2 ), 0 ).xyz;
    float axis = dot( ledN, -L );
    if ( axis <= 0.0 && uLedLobe > 0.0 ) continue;
    float beam = smoothstep( uLedConeCos, uLedPenumbraCos, axis ) *
                 pow( max( axis, 0.0 ), uLedFocus );
    float lobe = mix( 1.0, beam, uLedLobe );
    if ( lobe <= 0.0 ) continue;

    float atten = getDistanceAttenuation( dist, posCut.w, uLedDecay );
    ledLight.color = texelFetch( uLedTex, ivec2( i, 1 ), 0 ).rgb *
                     ( uLedPower * lobe * atten );
    ledLight.direction = L;
    RE_Direct( ledLight, geometryPosition, geometryNormal, geometryViewDir,
               geometryClearcoatNormal, material, reflectedLight );
  }
}
#endif
`;

// getDistanceAttenuation is declared by <lights_pars_begin>, which is fragment-only,
// so the vertex variant carries its own copy.
const LED_LIGHT_PARS_VERT = /* glsl */`
#if defined( MAX_LEDS ) && defined( LED_PER_VERTEX )
  uniform sampler2D uLedTex;
  uniform int   uLedCount;
  uniform float uLedPower;
  uniform float uLedCutoff;
  uniform float uLedDecay;
  uniform float uLedLobe;
  uniform float uLedMinDist;
  uniform float uLedConeCos;
  uniform float uLedPenumbraCos;
  uniform float uLedFocus;
  // Must match <lights_pars_begin>'s getDistanceAttenuation exactly, or the two
  // shading rates disagree about brightness and switching between them pops. That is
  // the Frostbite windowed inverse-square — note it already includes the 1/d².
  float ledDistAtten( const in float d, const in float cutoff, const in float decay ) {
    float falloff = 1.0 / max( pow( d, decay ), 0.01 );
    if ( cutoff > 0.0 ) {
      float x = clamp( 1.0 - pow( d / cutoff, 4.0 ), 0.0, 1.0 );
      falloff *= x * x;
    }
    return falloff;
  }
#endif
`;

// The same loop, diffuse only, at vertex rate. mvPosition and transformedNormal are
// the view-space quantities <project_vertex>/<defaultnormal_vertex> already produced,
// so this is identical math on a ~500x smaller domain.
const LED_LIGHT_VERT = /* glsl */`
#if defined( MAX_LEDS ) && defined( LED_PER_VERTEX )
  vLedDiffuse = vec3( 0.0 );
  {
    vec3 P = mvPosition.xyz;
    vec3 N = normalize( transformedNormal );
    for ( int i = 0; i < MAX_LEDS; i ++ ) {
      if ( i >= uLedCount ) break;
      vec4 posCut = texelFetch( uLedTex, ivec2( i, 0 ), 0 );
      vec3 toLight = posCut.xyz - P;
      float distSq = dot( toLight, toLight );
      if ( distSq > posCut.w * posCut.w ) continue;
      float dist = max( sqrt( max( distSq, 1e-8 ) ), uLedMinDist );
      vec3 L = normalize( toLight );
      float nDotL = max( dot( N, L ), 0.0 );
      if ( nDotL <= 0.0 ) continue;
      // Same directed cone as the fragment path; the two must agree or switching
      // shading rate changes the brightness.
      vec3 ledN = texelFetch( uLedTex, ivec2( i, 2 ), 0 ).xyz;
      float axis = dot( ledN, -L );
      if ( axis <= 0.0 && uLedLobe > 0.0 ) continue;
      float beam = smoothstep( uLedConeCos, uLedPenumbraCos, axis ) *
                   pow( max( axis, 0.0 ), uLedFocus );
      float lobe = mix( 1.0, beam, uLedLobe );
      if ( lobe <= 0.0 ) continue;
      vLedDiffuse += texelFetch( uLedTex, ivec2( i, 1 ), 0 ).rgb *
        ( uLedPower * lobe * nDotL * ledDistAtten( dist, posCut.w, uLedDecay ) );
    }
  }
#endif
`;

const LED_LIGHT_BODY_VERT = /* glsl */`
#if defined( MAX_LEDS ) && defined( LED_PER_VERTEX )
  reflectedLight.directDiffuse += vLedDiffuse * BRDF_Lambert( material.diffuseColor );
#endif
`;

// Splice the LED loop into a MeshStandardMaterial. The built-in lights,
// scene.environment IBL and everything else in the standard shader are untouched —
// this only appends direct-light contributions.
//
// Single point of onBeforeCompile ownership for these materials: two assignments
// would silently clobber each other, so any further shader concern belongs here too.
function applyLedLighting(material, maxLeds, uniforms = ledLightUniforms) {
  material.defines = Object.assign(material.defines || {}, { MAX_LEDS: maxLeds });
  if (ledPerVertex) material.defines.LED_PER_VERTEX = '';
  else delete material.defines.LED_PER_VERTEX;
  // material.defines is already part of the program cache key, but spell the intent
  // out so two materials differing only in this injection can never share a program.
  material.customProgramCacheKey = () => `led:${maxLeds}:${ledPerVertex ? 'v' : 'f'}`;
  material.onBeforeCompile = (shader) => {
    // Shares the uniform OBJECTS, not copies, so one write updates every receiver.
    // The diffuser passes ledGlowUniforms, which differs only in uLedCount — that is
    // how the cells see every lit LED while the room stays on the budget.
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
               '#include <common>\nvarying vec3 vLedDiffuse;\n' + LED_LIGHT_PARS_VERT)
      .replace('#include <project_vertex>',
               '#include <project_vertex>\n' + LED_LIGHT_VERT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLedDiffuse;')
      .replace('#include <lights_physical_pars_fragment>',
               '#include <lights_physical_pars_fragment>\n' + LED_LIGHT_PARS)
      .replace('#include <lights_fragment_end>',
               LED_LIGHT_BODY + LED_LIGHT_BODY_VERT + '\n#include <lights_fragment_end>');
  };
  material.needsUpdate = true;
  if (!ledReceivers.includes(material)) ledReceivers.push(material);
  return material;
}

function removeLedLighting(material) {
  const i = ledReceivers.indexOf(material);
  if (i >= 0) ledReceivers.splice(i, 1);
  if (material.defines) {
    delete material.defines.MAX_LEDS;
    delete material.defines.LED_PER_VERTEX;
  }
  material.onBeforeCompile = () => {};
  material.customProgramCacheKey = () => '';
  material.needsUpdate = true;
}

function recompileLedReceivers() {
  for (const m of ledReceivers) {
    m.defines.MAX_LEDS = ledLightMax;
    if (ledPerVertex) m.defines.LED_PER_VERTEX = '';
    else delete m.defines.LED_PER_VERTEX;
    m.customProgramCacheKey = () => `led:${ledLightMax}:${ledPerVertex ? 'v' : 'f'}`;
    m.needsUpdate = true;
  }
  // Diffuser materials take the bucket but NOT the shading-rate flip: their whole point
  // is per-pixel hotspots, and the cells cover little screen area.
  for (const m of ledGlowMaterials) {
    m.defines.MAX_LEDS = ledLightMax;
    m.customProgramCacheKey = () => `leddiff:${ledLightMax}`;
    m.needsUpdate = true;
  }
}

// Called on model load. Everything else — brightness, effect, budget — flows through
// uniforms and must never trigger a recompile.
function setLedLightBucket(n) {
  const bucket = ledBucketFor(n);
  if (bucket === ledLightMax) return;
  ledLightMax = bucket;
  recompileLedReceivers();
}

function setLedShadingRate(perVertex) {
  if (perVertex === ledPerVertex) return;
  ledPerVertex = perVertex;
  recompileLedReceivers();
}

// ── Quality ───────────────────────────────────────────────────────────────────
//
// Honest numbers, which is why this exists rather than being discovered later. The
// loop body is ~60 ops per light per fragment including BRDF_GGX. At 1080p x 2 DPR
// with the room covering ~45% of the frame (~3.7M fragments): 8 lit LEDs is ~1.8
// GFLOP and fine anywhere; 128 is ~28 GFLOP and wants a discrete GPU; 309 is ~68
// GFLOP and is single-digit fps. The culls remove maybe 3-5x of that in practice,
// which still does not save the all-LEDs-lit effects on the cat.
//
// Two orthogonal knobs: how many LEDs cast light, and at what shading rate.

function setLedQualityForModel(n) {
  ledLightBudget = n > 192 ? 128 : (n > 96 ? 192 : 512);
}

// The lit count is a property of the effect, not the model — chase lights 8 of 309,
// rainbow lights all 309 — so the user should not have to find a quality control after
// every effect change. Drop to vertex rate when the frame budget is actually blown.
// Each flip is a shader recompile, hence the EMA plus the cooldown: without hysteresis
// this oscillates.
let ledAutoQuality = true;
let ledFrameMs     = 16;
let ledQualityHold = 0;

function tickLedQuality(dt) {
  if (!ledAutoQuality || !ledReceivers.length) return;
  ledFrameMs = ledFrameMs * 0.9 + dt * 1000 * 0.1;
  if (ledQualityHold > 0) { ledQualityHold -= dt; return; }
  const want = ledPerVertex ? ledFrameMs > 20 : ledFrameMs > 30;
  if (want !== ledPerVertex) {
    setLedShadingRate(want);
    ledQualityHold = 2.5;        // seconds before another flip is allowed
    ledFrameMs = 16;
  }
}

// ── Diffuser glow ─────────────────────────────────────────────────────────────
//
// The diffuser panels are lit by TRANSMISSION, not reflection, and that distinction is
// the whole reason this exists as its own shader path.
//
// The room's injection adds light through RE_Direct, which requires
// dot(geometryNormal, L) > 0 — light arriving on the outward face. But the LEDs sit on
// the INWARD side of a panel, so that test culls exactly the light we want. Trying to
// light a surface from its own LEDs through the reflected path is why the old
// board-self-lighting came out black no matter how it was tuned.
//
// So: flip the normal, and accumulate into totalEmissiveRadiance rather than
// reflectedLight — a diffuser glows on its own and should not depend on the room's
// lighting or on envMapIntensity.

const LED_DIFF_PARS = /* glsl */`
#ifdef MAX_LEDS
  uniform float uDiffWrap;
  uniform float uDiffPower;
  uniform float uDiffSoft;
#endif
`;

const LED_DIFF_BODY = /* glsl */`
#if defined( MAX_LEDS ) && defined( LED_DIFFUSER )
{
  vec3 ledGlow = vec3( 0.0 );
  // The panel's inward face is what the LEDs illuminate.
  vec3 inward = -geometryNormal;

  for ( int i = 0; i < MAX_LEDS; i ++ ) {
    if ( i >= uLedCount ) break;

    vec4 posCut = texelFetch( uLedTex, ivec2( i, 0 ), 0 );
    vec3 toLight = posCut.xyz - geometryPosition;
    float distSq = dot( toLight, toLight );
    if ( distSq > posCut.w * posCut.w ) continue;

    // Clamped well beyond the standoff, which is what flattens the glow into a lit
    // panel instead of a hard dot under every LED.
    float dist = max( sqrt( max( distSq, 1e-8 ) ), uDiffSoft );
    vec3 L = normalize( toLight );

    // Wrapped cosine against the INWARD normal: only LEDs behind the panel contribute,
    // which is also what stops a cell glowing from LEDs on the far side of the shell.
    float nDotL = dot( inward, L );
    float wrapped = ( nDotL + uDiffWrap ) / ( 1.0 + uDiffWrap );
    if ( wrapped <= 0.0 ) continue;

    // Lambertian die emission, NOT the room's cone. The room's beam is a stylised spot
    // whose cone would cull the lateral spread across a panel — a point 5mm to the side
    // of an LED 2.6mm below it sits ~62° off-axis and would vanish, which leaves exactly
    // the tight hotspots this replaced.
    vec3 ledN = texelFetch( uLedTex, ivec2( i, 2 ), 0 ).xyz;
    float emit = max( dot( ledN, -L ), 0.0 );
    if ( emit <= 0.0 ) continue;

    ledGlow += texelFetch( uLedTex, ivec2( i, 1 ), 0 ).rgb *
               ( uDiffPower * emit * wrapped / ( dist * dist ) );
  }
  totalEmissiveRadiance += ledGlow;
}
#endif
`;

// Materials carrying the diffuser injection. Kept separate from ledReceivers because
// they must NOT follow the shading-rate flip: the whole point of a diffuser is per-pixel
// hotspots, and the cells cover little screen area.
const ledGlowMaterials = [];

function applyDiffuserLighting(material, maxLeds) {
  material.defines = Object.assign(material.defines || {},
    { MAX_LEDS: maxLeds, LED_DIFFUSER: '' });
  material.customProgramCacheKey = () => `leddiff:${maxLeds}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, ledGlowUniforms, ledDiffUniforms);
    const before = shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_physical_pars_fragment>',
               '#include <lights_physical_pars_fragment>\n' + LED_LIGHT_PARS + LED_DIFF_PARS)
      .replace('#include <aomap_fragment>',
               LED_DIFF_BODY + '\n#include <aomap_fragment>');
    // A missed anchor would silently produce no glow at all rather than an error.
    if (shader.fragmentShader === before) {
      console.warn('[fold] diffuser shader injection found no anchor — glow disabled');
    }
  };
  material.needsUpdate = true;
  if (!ledGlowMaterials.includes(material)) ledGlowMaterials.push(material);
  return material;
}

const uiDiffStandoff = () =>
  Math.max(0.5, Number(foldDiffStandoff?.value ?? DIFFUSER_LIFT * 10) / 10);

// Re-lift the cells. liftFrac is 0 at the skirt foot and 1 at the panel, so this is a
// rewrite of the z column rather than a rebuild of the stream.
function applyDiffuserStandoff() {
  if (!foldModel?.diffuserGeomData) return;
  const { local, liftFrac } = foldModel.diffuserGeomData;
  const top = uiDiffStandoff();
  for (let i = 0; i < liftFrac.length; i++) {
    local[i * 3 + 2] = DIFFUSER_BASE + liftFrac[i] * (top - DIFFUSER_BASE);
  }
  tuneDiffuser();                            // soft-clamp and power follow the standoff
  if (foldDiffuserMesh) setFoldT(foldT);     // re-applies the fold to the new locals
}

function setShowDiffuser(on) {
  foldShowDiffuser = on;
  if (foldDiffuserMesh) foldDiffuserMesh.visible = on;
}

// Patch every receiver the current preset declared. Called after buildRig().
function applyLedLightingToRig() {
  if (!ledLightMax) ledLightMax = ledBucketFor(foldModel?.ledCount || 64);
  ensureLedLightTex();
  for (const mesh of envReceivers) {
    if (mesh?.material?.isMeshStandardMaterial) {
      applyLedLighting(mesh.material, ledLightMax);
    }
  }
  tuneLedLighting();
}

// ── Per-frame light upload ────────────────────────────────────────────────────

const _ledPos  = new THREE.Vector3();
const _ledDir  = new THREE.Vector3();
const _ledView = new THREE.Matrix4();
let _ledRank = [];
let ledLitCount = 0;      // reported by foldDebug.ledLights()

function updateLedLights() {
  // Note ledGlowMaterials as well as ledReceivers: the diffuser works with no
  // environment preset selected, in which case there are no room receivers at all.
  const anyConsumer = ledReceivers.length || (foldShowDiffuser && ledGlowMaterials.length);
  // ledsLit() is checked here rather than left to a zero ledGain() below, because the
  // compaction pass keys off stripRGB and would happily upload a full texture of black
  // lights for every receiver to walk.
  if (!ledLightOn || !ledsLit() || !foldModel || !foldModel.ledCount || !stripRGB ||
      !anyConsumer) {
    ledLightUniforms.uLedCount.value = 0;
    ledGlowUniforms.uLedCount.value = 0;
    ledLitCount = 0;
    return;
  }
  ensureLedLightTex();

  // OrbitControls.update() moves the camera without refreshing matrixWorld, and
  // matrixWorldInverse is only rebuilt inside renderer.render(), so derive the view
  // matrix here rather than trusting either.
  foldCamera.updateMatrixWorld();
  _ledView.copy(foldCamera.matrixWorld).invert();
  // foldModel.transforms is model space and knows nothing about foldGroup, which the
  // turntable spin rotates. Folding the group matrix into the view matrix here keeps
  // both the light positions and their emission directions attached to the mesh, for
  // one matrix multiply rather than any per-LED cost.
  _ledView.multiply(foldGroup.matrixWorld);

  const T = foldModel.transforms;
  const n = foldModel.ledCount;
  // The same gain uploadStrip() uses, so the cast light and the visible emitter disc
  // can never disagree about how bright an LED is.
  const gain = ledGain();
  const cutoff = ledLightUniforms.uLedCutoff.value;

  // Compact. A black LED contributes exactly zero, so it costs a texel and a loop
  // iteration for nothing — this is exact, not an approximation. Most effects light a
  // small fraction of the strip (chase lights 8 of 309), so it is the biggest win
  // available and it comes for free.
  if (_ledRank.length < n) _ledRank = new Array(n);
  let m = 0;
  for (let k = 0; k < n; k++) {
    if ((stripRGB[k * 3] | stripRGB[k * 3 + 1] | stripRGB[k * 3 + 2]) !== 0) {
      _ledRank[m++] = k;                       // strip slot, not LED index
    }
  }

  // Budget. Every lit LED is uploaded — the texture holds all of them — but the room's
  // receivers only walk the first `budget` entries, so sort brightest-first to make
  // that truncation take the ones that matter. The board reads the full count.
  //
  // Note every emitter disc stays lit regardless — uploadStrip() is untouched — so the
  // object always looks right; only how far the *cast* light is truncated changes.
  const total = Math.min(m, LED_TEX_W);
  const budget = Math.min(ledLightBudget, ledLightMax, LED_TEX_W);
  if (m > budget) {
    const head = _ledRank.slice(0, m);
    head.sort((a, b) =>
      (stripRGB[b * 3] + stripRGB[b * 3 + 1] + stripRGB[b * 3 + 2]) -
      (stripRGB[a * 3] + stripRGB[a * 3 + 1] + stripRGB[a * 3 + 2]));
    for (let j = 0; j < total; j++) _ledRank[j] = head[j];
  }
  const count = Math.min(m, budget);

  const d = ledLightData;
  for (let j = 0; j < total; j++) {
    const k   = _ledRank[j];
    const led = stripOrder[k];                 // slot -> LED index, as in uploadStrip
    const T4  = T[foldModel.ledFaceOf[led]];

    _ledPos.copy(foldModel.ledCentreLocal[led]).applyMatrix4(T4).applyMatrix4(_ledView);

    // Every LED sits on the +Z side of its face's flat frame, and faceFrame() maps
    // flat +Z onto the .off triangle's winding normal — so the transform's third
    // column IS the direction this LED faces, pointing out of the shell. Matrix4
    // elements are column-major, so column 2 is [8],[9],[10]. No stored per-LED
    // normal is needed.
    const e = T4.elements;
    _ledDir.set(e[8], e[9], e[10]).transformDirection(_ledView);

    const o0 = j * 4;
    d[o0] = _ledPos.x; d[o0 + 1] = _ledPos.y; d[o0 + 2] = _ledPos.z; d[o0 + 3] = cutoff;

    const o1 = (LED_TEX_W + j) * 4;
    d[o1]     = (stripRGB[k * 3]     / 255) * gain;
    d[o1 + 1] = (stripRGB[k * 3 + 1] / 255) * gain;
    d[o1 + 2] = (stripRGB[k * 3 + 2] / 255) * gain;

    const o2 = (LED_TEX_W * 2 + j) * 4;
    d[o2] = _ledDir.x; d[o2 + 1] = _ledDir.y; d[o2 + 2] = _ledDir.z;
  }

  ledLitCount = total;
  ledLightUniforms.uLedCount.value = count;    // room receivers: capped by the budget
  ledGlowUniforms.uLedCount.value = total;     // diffuser cells: every lit LED
  ledLightTex.needsUpdate = true;              // re-uploads 24KB; negligible
}

// ── Upload ────────────────────────────────────────────────────────────────────
// The only place that writes the LED colour attribute.
function uploadStrip() {
  if (!foldLedMesh || !foldModel || !stripRGB) return;
  const colors = foldLedMesh.geometry.attributes.color;
  const arr = colors.array;
  const gain = ledGain();
  const n = foldModel.ledCount;

  for (let k = 0; k < n; k++) {
    const led = stripOrder[k];
    const r = (stripRGB[k * 3]     / 255) * gain;
    const g = (stripRGB[k * 3 + 1] / 255) * gain;
    const b = (stripRGB[k * 3 + 2] / 255) * gain;
    for (let v = LED_BODY_VERTS; v < LED_VERTS; v++) {
      const o = (led * LED_VERTS + v) * 3;
      arr[o] = r; arr[o + 1] = g; arr[o + 2] = b;
    }
  }
  colors.needsUpdate = true;
}

// ── Effects ───────────────────────────────────────────────────────────────────
// Each entry keeps the sketch's per-step body and is driven at a fixed timestep
// (`interval` ms, from the pattern's own delay()/wait), which is what preserves
// the original feel — a dt-scaled rewrite would change how the fade-based
// effects look. Patterns the sketch runs as a bounded pass loop forever here.

const EFFECTS = [
  {
    id: 'chase', label: 'Chase (wiring comet)', group: 'Motion', interval: 1000 / 14,
    reset() { effectState.head = 0; },
    step(n) {
      sClear();
      const s = effectState;
      for (let k = 0; k < Math.min(CHASE_WINDOW, n); k++) {
        const slot = (s.head - k + n * 2) % n;
        const fall = 1 - k / CHASE_WINDOW;
        const c = hsv(Math.round((0.55 + 0.5 * (slot / n)) * 65535) % 65536, 242,
                      Math.round(60 + 195 * fall));
        sSet(slot, c[0], c[1], c[2]);
      }
      s.head = (s.head + 1) % n;
    },
  },
  {
    id: 'colorWipe', label: 'Color wipe', group: 'Motion', interval: 22,
    reset() { effectState.i = 0; effectState.on = true; },
    step(n) {
      const s = effectState;
      if (s.on) sSet(s.i, 0, 180, 0); else sSet(s.i, 0, 0, 0);
      if (++s.i >= n) { s.i = 0; s.on = !s.on; }   // fill, then wipe off, repeat
    },
  },
  {
    id: 'comet', label: 'Comet / meteor', group: 'Motion', interval: 26,
    reset() { effectState.head = 0; effectState.tail = 0; },
    step(n) {
      const s = effectState;
      sFadeAll(180);
      if (s.head < n) {
        sSet(s.head, 0, 0, 255);
        s.head++;
      } else if (++s.tail > 30) {                  // let the tail burn out, then loop
        s.head = 0; s.tail = 0;
      }
    },
  },
  {
    id: 'larson', label: 'Larson scanner', group: 'Motion', interval: 26,
    reset() { effectState.i = 0; effectState.dir = 1; },
    step(n) {
      const s = effectState;
      sFadeAll(150);
      sSet(s.i, 255, 0, 0);
      s.i += s.dir;
      if (s.i >= n - 1) { s.i = n - 1; s.dir = -1; }
      else if (s.i <= 0) { s.i = 0; s.dir = 1; }
    },
  },
  {
    id: 'theaterChase', label: 'Theater chase', group: 'Motion', interval: 90,
    reset() { effectState.phase = 0; },
    step(n) {
      const s = effectState;
      sClear();
      for (let i = s.phase % 3; i < n; i += 3) sSet(i, 127, 127, 127);
      s.phase++;
    },
  },
  {
    id: 'rainbow', label: 'Rainbow', group: 'Motion', interval: 24,
    reset() { effectState.hue = 0; },
    step(n) {
      const s = effectState;
      for (let i = 0; i < n; i++) {
        const c = hsv(s.hue + Math.round((i * 65536) / n));
        sSet(i, c[0], c[1], c[2]);
      }
      s.hue = (s.hue + 384) % 65536;
    },
  },
  {
    id: 'breathe', label: 'Breathe', group: 'Static', interval: 14,
    reset() { effectState.b = 0; effectState.dir = 2; },
    step() {
      const s = effectState;
      sFillScaled([0, 100, 255], s.b);
      s.b += s.dir;
      if (s.b >= 255) { s.b = 255; s.dir = -2; }
      else if (s.b <= 0) { s.b = 0; s.dir = 2; }
    },
  },
  {
    id: 'confetti', label: 'Confetti', group: 'Simulation', interval: 30,
    reset() {},
    step(n) {
      sFadeAll(220);
      const c = hsv(rnd(0, 65536), 200, 255);
      sSet(rnd(n), c[0], c[1], c[2]);
    },
  },
  {
    id: 'twinkle', label: 'Twinkle', group: 'Simulation', interval: 45,
    reset() {},
    step(n) {
      // The sketch's dim random sparkle, scaled up from its 0-5 per-channel
      // range so it reads on screen without relying on setBrightness(2).
      for (let i = 0; i < n; i++) {
        sSet(i, rnd(0, 5) * 40, rnd(0, 5) * 40, rnd(0, 5) * 40);
      }
    },
  },
  {
    id: 'fire', label: 'Fire', group: 'Simulation', interval: 22,
    reset(n) { effectState.heat = new Uint8Array(n); },
    step(n) {
      const heat = effectState.heat;
      // 1. cool every cell. This bound is FastLED's n-relative convention, so it
      //    stays on n rather than the sketch's 500 or the flame stops cooling.
      const cool = Math.floor((FIRE_COOLING * 10) / n) + 2;
      for (let i = 0; i < n; i++) heat[i] = qsub8(heat[i], rnd(0, cool));
      // 2. heat drifts upward
      for (let k = n - 1; k >= 2; k--) {
        heat[k] = Math.floor((heat[k - 1] + heat[k - 2] + heat[k - 2]) / 3);
      }
      // 3. ignite sparks near the base
      if (rnd(255) < FIRE_SPARKING) {
        const y = rnd(Math.min(7, n));
        heat[y] = qadd8(heat[y], rnd(160, 255));
      }
      // 4. render
      for (let j = 0; j < n; j++) {
        const c = heatColor(heat[j]);
        sSet(j, c[0], c[1], c[2]);
      }
    },
  },
  {
    id: 'plasma', label: 'Plasma', group: 'Simulation', interval: 28,
    reset() { effectState.t = 0; },
    step(n) {
      const s = effectState;
      const f = stripFreq;                       // rescale 500-px tuning onto n
      for (let i = 0; i < n; i++) {
        const v = Math.sin(i * 0.10 * f + s.t) + Math.sin(i * 0.05 * f - s.t * 0.5);
        const c = hsv(Math.round(((v + 2) / 4) * 65535));
        sSet(i, c[0], c[1], c[2]);
      }
      s.t += 0.05;
    },
  },
  {
    id: 'aurora', label: 'Aurora', group: 'Simulation', interval: 32,
    reset() { effectState.t = 0; },
    step(n) {
      const s = effectState;
      const f = stripFreq;
      for (let i = 0; i < n; i++) {
        const wave = Math.sin(i * 0.030 * f + s.t * 0.60)
                   + Math.sin(i * 0.017 * f - s.t * 0.37)
                   + Math.sin(i * 0.061 * f + s.t * 0.21);
        let level = (wave + 3) / 6;
        level = level * level;                   // deepen the gaps between curtains
        const val = 12 + Math.round(level * 243);
        let tint = Math.sin(i * 0.015 * f - s.t * 0.12) * 0.5 + 0.5;
        tint = tint * tint;                      // bias toward green
        const hue = 20000 + Math.round(tint * 30000);
        const c = hsv(hue, 255 - (val >> 2), val);
        sSet(i, c[0], c[1], c[2]);
      }
      s.t += 0.04;
    },
  },
  {
    id: 'bouncingBalls', label: 'Bouncing balls', group: 'Simulation', interval: 16,
    reset() {
      const NUM = 5, gravity = -9.81, startHeight = 1.0;
      const vStart = Math.sqrt(-2 * gravity * startHeight);
      effectState.balls = Array.from({ length: NUM }, (_, i) => ({
        height: startHeight, impactVel: vStart, clock: 0,
        damp: 0.90 - i / (NUM * NUM),
        color: [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255]][i],
      }));
      effectState.gravity = gravity;
      effectState.startHeight = startHeight;
      effectState.vStart = vStart;
    },
    step(n) {
      const s = effectState;
      sClear();
      for (const ball of s.balls) {
        ball.clock += 0.016;                     // fixed timestep stands in for millis()
        const t = ball.clock;
        ball.height = 0.5 * s.gravity * t * t + ball.impactVel * t;
        if (ball.height < 0) {
          ball.height = 0;
          ball.impactVel *= ball.damp;
          ball.clock = 0;
          if (ball.impactVel < 0.01) ball.impactVel = s.vStart;   // re-kick a dead ball
        }
        const pos = Math.round((ball.height * (n - 1)) / s.startHeight);
        sSet(pos, ball.color[0], ball.color[1], ball.color[2]);
      }
    },
  },
  {
    id: 'allon', label: 'All on (chain hue)', group: 'Static', interval: 200,
    reset() {},
    step(n) {
      for (let k = 0; k < n; k++) {
        const c = hsv(Math.round((0.55 + 0.5 * (k / n)) * 65535) % 65536, 230, 210);
        sSet(k, c[0], c[1], c[2]);
      }
    },
  },
  {
    id: 'off', label: 'Off', group: 'Static', interval: 200,
    reset() {}, step() { sClear(); },
  },
];

const effectById = id => EFFECTS.find(e => e.id === id) || EFFECTS[0];

// Build the dropdown from EFFECTS so the registry stays the single source of truth.
function populateEffectSelect() {
  if (!foldEffectSel) return;
  foldEffectSel.textContent = '';
  for (const group of ['Motion', 'Simulation', 'Static']) {
    const members = EFFECTS.filter(e => e.group === group);
    if (!members.length) continue;
    const og = document.createElement('optgroup');
    og.label = group;
    for (const e of members) {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.label;
      og.appendChild(opt);
    }
    foldEffectSel.appendChild(og);
  }
  foldEffectSel.value = effectId;
}
populateEffectSelect();

function resetStrip() {
  if (!foldModel || !foldModel.ledCount) { stripRGB = null; return; }
  const n = foldModel.ledCount;
  stripRGB = new Uint8Array(n * 3);
  stripFreq = SPATIAL_REF / Math.max(1, n);
  effectAcc = 0;
  effectState = {};
  rebuildStripOrder();
  effectById(effectId).reset(n);
  effectById(effectId).step(n);      // paint one frame so nothing starts blank
  uploadStrip();
}

function setEffect(id) {
  effectId = effectById(id).id;
  if (foldEffectSel && foldEffectSel.value !== effectId) foldEffectSel.value = effectId;
  if (!stripRGB || !foldModel) return;
  const n = foldModel.ledCount;
  effectAcc = 0;
  effectState = {};
  sClear();
  effectById(effectId).reset(n);
  effectById(effectId).step(n);
  uploadStrip();
}

function setStripDomain(mode) {
  stripDomain = mode === 'spatial' ? 'spatial' : 'wiring';
  rebuildStripOrder();
  uploadStrip();
  refreshToggles();
}

// Fixed-timestep driver.
function advanceEffect(dt) {
  if (!stripRGB || !foldModel) return;
  const eff = effectById(effectId);
  const n = foldModel.ledCount;
  const speed = Math.max(0.05, Number(foldSpeed?.value ?? 100) / 100);
  const interval = eff.interval / speed;

  effectAcc += dt * 1000;
  let steps = 0;
  while (effectAcc >= interval && steps < MAX_STEPS_PER_FRAME) {
    eff.step(n);
    effectAcc -= interval;
    steps++;
  }
  if (effectAcc > interval * MAX_STEPS_PER_FRAME) effectAcc = 0;   // drop backlog
  if (steps) uploadStrip();
}

// ── Environment scenes ────────────────────────────────────────────────────────
//
// The folded board is a lamp, so it needs a room to light. Every scene here is
// procedural — no .hdr files, no CDN fetches — because a plain HDRI is sampled by
// direction only and therefore cannot *receive* light from the object. Lighting the
// space needs real geometry, and building it in code keeps the repo text-only and
// working offline.
//
// Each preset is built ONCE in a normalised frame (object centred on the origin,
// unit extent, floor at y = -0.5) and then used twice:
//
//   * instantiated into `envRoot`, a container Group scaled to the live model, as
//     the visible room;
//   * instantiated into a throwaway Scene and baked by PMREMGenerator.fromScene
//     into foldScene.environment, so the same room also *lights* the board.
//
// Baking at normalised scale is not a shortcut. An environment map is looked up by
// direction and carries no notion of world size, so the bake's units are private to
// it — which is what decouples all of this from the project's millimetre world.
//
// `receivers` is the contract with the per-LED lighting below: a preset declares
// which of its surfaces may be patched with the LED light loop. Anything it leaves
// out is lit by the IBL and the base lights alone.

const ENV_UNIT = {
  floorY: -0.5,   // the object sits on the floor
  objR:    0.5,   // and its half-extent is 0.5
};

// One shared box and plane for every preset instance, exactly as RoomEnvironment
// shares a single BoxGeometry across its whole room. Posed purely by position /
// rotation / scale. ENV_SHARED keeps disposeEnvTree from freeing them.
// Both are subdivided because the per-vertex LED lighting fallback evaluates the
// light loop at their vertices — an 8-vertex box would give it nothing to work with,
// and the walls would go blotchy the moment the adaptive guard kicked in. At fragment
// rate the subdivision costs nothing but a few thousand vertices.
const ENV_BOX   = new THREE.BoxGeometry(1, 1, 1, 24, 24, 24);
const ENV_PLANE = new THREE.PlaneGeometry(1, 1, 64, 64);
ENV_BOX.deleteAttribute('uv');
ENV_PLANE.deleteAttribute('uv');
const ENV_SHARED = new Set([ENV_BOX, ENV_PLANE]);

const surf = (color, roughness, metalness = 0, side = THREE.FrontSide) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, side });

// RoomEnvironment's trick for area lights: a MeshBasicMaterial whose colour exceeds
// 1. Only ever legible in the half-float PMREM target, so these are bake-only.
const panel = (r, g = r, b = r) => {
  const m = new THREE.MeshBasicMaterial();
  m.color.setRGB(r, g, b);
  return m;
};
const boxAt = (mat, pos, scale, rotY = 0) => {
  const m = new THREE.Mesh(ENV_BOX, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  m.scale.set(scale[0], scale[1], scale[2]);
  m.rotation.y = rotY;
  return m;
};
// The plane is subdivided (64x64) because the per-vertex LED lighting fallback
// evaluates the light loop at its vertices; at fragment rate 1x1 would do.
const floorAt = (mat, y, r) => {
  const m = new THREE.Mesh(ENV_PLANE, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.scale.set(r * 2, r * 2, 1);
  m.receiveShadow = true;
  return m;
};

const ENVIRONMENTS = [
  {
    // The escape hatch, and the default: byte-for-byte today's viewer. No IBL, no
    // geometry, no tone mapping, base lights at their original intensities.
    id: 'none', label: 'None (void)',
    bg: { type: 'color', color: 0x0f0f1a },
    toneMapping: THREE.NoToneMapping,
    exposure: 1.0, envIntensity: 0.0, boardEnv: 0.0, sigma: 0,
    floorLock: false,
    base: { ambient: ENV_BASE.ambient, key: ENV_BASE.key, fill: ENV_BASE.fill },
    build: null, bake: null,
  },
  {
    // The lamp showcase: a near-black shell, so essentially all visible light in
    // the frame comes from the board itself.
    id: 'darkroom', label: 'Dark room',
    bg: { type: 'env', blur: 0.4, intensity: 0.5 },
    toneMapping: THREE.NeutralToneMapping,
    // sigma is capped at ~0.04 by PMREMGenerator's 20-sample blur limit (it warns
    // and clips above that). Softness beyond this comes from bg.blur, which is
    // backgroundBlurriness and has no such ceiling.
    exposure: 1.25, envIntensity: 0.55, boardEnv: 0.20, sigma: 0.04,
    floorLock: true,
    base: { ambient: 0.03, key: 0.0, fill: 0.06 },
    build({ U }) {
      const g = new THREE.Group();
      // The shell's floor must sit BELOW the floor plane, not on it. Coplanar at
      // y = U.floorY the two z-fight into a patchwork that reads as a shading bug.
      const shell = boxAt(surf(0x0a0a0e, 0.92, 0.0, THREE.BackSide),
                          [0, 1.55, 0], [7, 4.3, 7]);
      const floor = floorAt(surf(0x15151c, 0.70, 0.02), U.floorY, 3.5);
      g.add(shell, floor);
      return { group: g, receivers: [shell, floor] };
    },
    bake() {
      // One dim ceiling patch. Without it the IBL is literally zero and the board's
      // own albedo is unreadable whenever every LED happens to be off.
      return [boxAt(panel(0.30, 0.31, 0.36), [0, 3.4, 0], [3, 0.05, 3])];
    },
  },
  {
    // The product shot: neutral grey cyclorama, soft key. The one preset where the
    // board's own colour and geometry read clearly rather than the lamp effect.
    id: 'studio', label: 'Studio cyc',
    bg: { type: 'env', blur: 0.15, intensity: 1.0 },
    toneMapping: THREE.NeutralToneMapping,
    exposure: 1.0, envIntensity: 1.0, boardEnv: 0.35, sigma: 0.03,
    floorLock: true,
    base: { ambient: 0.10, key: 0.40, fill: 0.10 },
    build({ U }) {
      const g = new THREE.Group();
      const floor = floorAt(surf(0xb9b9bf, 0.85), U.floorY, 5);
      // A full cylinder, not an open arc. A cyclorama's whole point is a seamless
      // backdrop, and an arc leaves a gap that shows as a black wedge from whichever
      // angle the user happens to orbit to — the camera position must not be a
      // hidden dependency of the scene geometry.
      const wallGeom = new THREE.CylinderGeometry(1.5, 1.5, 5.2, 64, 12, true);
      const wall = new THREE.Mesh(wallGeom, surf(0xb9b9bf, 0.85, 0, THREE.BackSide));
      wall.position.y = U.floorY + 2.5;
      wall.receiveShadow = true;
      g.add(floor, wall);
      return { group: g, receivers: [floor, wall] };
    },
    bake() {
      return [
        boxAt(panel(7.0),           [-3.4, 2.4,  1.6], [0.1, 2.4, 2.6]),  // key softbox
        boxAt(panel(2.2, 2.3, 2.6), [ 3.6, 1.6, -0.8], [0.1, 2.6, 3.2]),  // cool fill
        boxAt(panel(1.6),           [ 0.0, 4.2,  0.0], [4.0, 0.1, 4.0]),  // ceiling bounce
      ];
    },
  },
  {
    // The best "second lamp": a glossy surface, so the LED reflection doubles every
    // emitter and the object appears to sit in its own light.
    id: 'night-desk', label: 'Night desk',
    bg: { type: 'env', blur: 0.5, intensity: 0.35 },
    toneMapping: THREE.NeutralToneMapping,
    exposure: 1.20, envIntensity: 0.50, boardEnv: 0.28, sigma: 0.04,
    floorLock: true,
    base: { ambient: 0.06, key: 0.18, keyColor: 0xffd6a0,
            fill: 0.04, fillColor: 0x203040 },
    build({ U }) {
      const g = new THREE.Group();
      // roughness .38 with a little metalness is a soft sheen rather than a mirror.
      const desk = floorAt(surf(0x3c2b1d, 0.38, 0.06), U.floorY, 4);
      const dark = boxAt(surf(0x08080c, 0.95, 0, THREE.BackSide), [0, 2.1, 0], [14, 5.4, 14]);
      g.add(desk, dark);
      return { group: g, receivers: [desk, dark] };
    },
    bake() {
      return [boxAt(panel(1.7, 1.15, 0.62), [0.6, 3.2, -0.4], [1.6, 0.06, 1.6])];
    },
  },
  {
    // Brighter and warm, with occluder blocks so the IBL has structure and the
    // board's specular highlights are not a flat wash.
    id: 'showroom', label: 'Showroom',
    bg: { type: 'env', blur: 0.2, intensity: 0.9 },
    toneMapping: THREE.NeutralToneMapping,
    exposure: 0.95, envIntensity: 1.0, boardEnv: 0.40, sigma: 0.03,
    floorLock: true,
    base: { ambient: 0.18, key: 0.55, fill: 0.12 },
    build({ U }) {
      const g = new THREE.Group();
      const shell = boxAt(surf(0x6d6157, 0.88, 0, THREE.BackSide), [0, 2.05, 0], [9, 5.2, 9]);
      const floor = floorAt(surf(0x2b2723, 0.28, 0.12), U.floorY, 4.5);
      g.add(shell, floor);
      return { group: g, receivers: [shell, floor] };
    },
    bake() {
      return [
        boxAt(panel(9.0, 8.6, 7.8), [-1.6, 4.3, 0], [0.5, 0.08, 5.0]),  // ceiling strips
        boxAt(panel(9.0, 8.6, 7.8), [ 1.6, 4.3, 0], [0.5, 0.08, 5.0]),
        boxAt(panel(2.0, 1.8, 1.5), [0, 1.6, -4.3], [5.0, 2.0, 0.08]),  // wall bounce
        // Occluders are bake-only. Their job is to break the IBL up so the board's
        // specular highlights have structure; in the visible rig they only read as
        // unlit black slabs floating behind the object.
        boxAt(surf(0x4a423c, 0.9), [-2.6, 0.1, -1.4], [1.0, 1.2, 1.0], 0.4),
        boxAt(surf(0x4a423c, 0.9), [ 2.9, 0.0, 1.8], [1.4, 0.9, 1.2], -0.3),
      ];
    },
  },
  {
    // A gradient sky as real vertex-coloured geometry rather than a background
    // descriptor, so it survives the PMREM bake and actually lights the board.
    id: 'outdoor-dusk', label: 'Outdoor dusk',
    bg: { type: 'env', blur: 0.0, intensity: 1.0 },
    toneMapping: THREE.NeutralToneMapping,
    exposure: 1.10, envIntensity: 1.0, boardEnv: 0.38, sigma: 0.04,
    floorLock: true,
    base: { ambient: 0.0, key: 0.55, keyColor: 0xffd2a8, fill: 0.0,
            hemi: 0.45, hemiSky: 0x24406b, hemiGround: 0x3a3020 },
    build({ U }) {
      const g = new THREE.Group();
      // A vertex-coloured sphere rather than a ShaderMaterial: no GLSL, and it
      // behaves identically in the bake, which is the point of staying procedural.
      // sigma smooths the banding away.
      const dome = new THREE.SphereGeometry(40, 32, 20);
      const pos = dome.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const top = new THREE.Color(0x101c3a), horizon = new THREE.Color(0xd9793c);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const h = Math.max(0, Math.min(1, pos.getY(i) / 40));
        c.copy(horizon).lerp(top, Math.pow(h, 0.45));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      dome.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const sky = new THREE.Mesh(dome, new THREE.MeshBasicMaterial({
        vertexColors: true, side: THREE.BackSide, toneMapped: false,
      }));
      // Sized to reach the dome (radius 40) rather than stopping short of it, or the
      // ground's own edge reads as a hard black band under the horizon.
      const ground = floorAt(surf(0x2a2a33, 0.95), U.floorY, 40);
      g.add(sky, ground);
      return { group: g, receivers: [ground] };   // the sky receives nothing
    },
    bake() {
      // A low sun just above the horizon; the dome supplies everything else.
      return [boxAt(panel(8.0, 4.0, 1.6), [22, 1.2, -14], [1.6, 1.6, 0.1])];
    },
  },
];

const envById = id => ENVIRONMENTS.find(e => e.id === id) || ENVIRONMENTS[0];
const envCtx = () => ({ THREE, U: ENV_UNIT });

const ENV_DEFAULT_ID = 'studio';

let envId        = ENV_DEFAULT_ID;
let envRoot      = null;      // container Group, sibling of foldGroup
let envFit       = null;      // { center, size, S, floorY } for the current model
let envReceivers = [];        // meshes the LED light loop may patch
let envRigOn     = true;
let envBoardOn   = true;
// A scene picked before initFoldScene() ran. Seeded with the default so the opening
// scene is applied by the same path as a user pick — envId alone only sets the control,
// it does not build the rig or touch the renderer's tone mapping.
let pendingEnvId = ENV_DEFAULT_ID;

// ── Env rig placement ─────────────────────────────────────────────────────────
//
// Rigs are unit-sized and scaled by their container rather than rebuilt per model.
// That keeps the visible geometry identical to the baked geometry by construction,
// makes a model switch two Object3D writes, and means preset code has no access to
// model dimensions and so cannot accidentally depend on them.

const _fitBox = new THREE.Box3();
const _fitMat = new THREE.Matrix4();
const _fitOri = new THREE.Matrix4();
const _fitTmp = new THREE.Matrix4();

function measureFolded() {
  if (!foldModel) return null;
  // At t=1 transforms[root] == A, so the folded object occupies foldModel.meshBox
  // exactly — no need to perturb foldT to measure. The box is NOT centred on the
  // origin (batman-092 spans y -170..59), which is the whole reason this exists.
  _fitBox.copy(foldModel.meshBox);
  const c = foldPivot().clone();

  // The user's orientation correction changes the object's vertical extent, so the
  // floor must be placed from the ROTATED box. Box3.applyMatrix4 re-bounds the eight
  // transformed corners, and because those corners are symmetric about c a rotation
  // about c leaves the AABB centre at c — only the size changes.
  //
  // The turntable spin is deliberately excluded, and that is exact rather than an
  // approximation: a Y-rotation maps every point to one with the same y, so min.y is
  // invariant under it and the floor never needs to move as the object turns.
  orientMatrix(_fitOri);
  _fitMat.makeTranslation(c.x, c.y, c.z)
    .multiply(_fitOri)
    .multiply(_fitTmp.makeTranslation(-c.x, -c.y, -c.z));
  _fitBox.applyMatrix4(_fitMat);

  const center = _fitBox.getCenter(new THREE.Vector3());
  const size   = _fitBox.getSize(new THREE.Vector3());
  // max(size), not size.y: a wide flat fold then gets a rig sized to its width, so
  // the floor is never too small. The rig's vertical origin ends up above the
  // object's centre, which is visually harmless.
  const S = Math.max(size.x, size.y, size.z) || 1;
  return { center, size, S, floorY: _fitBox.min.y };
}

// Orientation moved the object's lowest point, so the room has to be re-fitted around
// it. Cheap: two Object3D writes plus a handful of scalars.
function refitEnvForOrientation() {
  if (!envRoot || !envById(envId).build) return;
  envFit = measureFolded();
  placeEnvRoot();
  applyEnvFade();
}

function placeEnvRoot() {
  if (!envRoot || !envFit) return;
  const { center, S, floorY } = envFit;
  envRoot.scale.setScalar(S);
  // Maps normalised y = -0.5 onto floorY: floorY + 0.5S - 0.5S == floorY, so the
  // floor lands exactly on the folded object's lowest point.
  envRoot.position.set(center.x, floorY + 0.5 * S, center.z);
}

// Directional/ambient/hemisphere only — see the note in initFoldScene about why a
// positional light inside a scaled rig would be wrong by S².
function applyBaseLights(preset) {
  if (!foldAmbient) return;
  const b = preset.base || {};
  foldAmbient.intensity = b.ambient ?? ENV_BASE.ambient;
  foldAmbient.color.set(b.ambientColor ?? ENV_BASE.ambientColor);
  foldKeyLight.intensity = b.key ?? ENV_BASE.key;
  foldKeyLight.color.set(b.keyColor ?? ENV_BASE.keyColor);
  foldFillLight.intensity = b.fill ?? ENV_BASE.fill;
  foldFillLight.color.set(b.fillColor ?? ENV_BASE.fillColor);
  foldHemiLight.intensity = b.hemi ?? ENV_BASE.hemi;
  foldHemiLight.color.set(b.hemiSky ?? ENV_BASE.hemiSky);
  foldHemiLight.groundColor.set(b.hemiGround ?? ENV_BASE.hemiGround);
}

// RoomEnvironment.dispose(), generalised. The Set dedupes the shared box/plane,
// which must survive; the per-preset geometries (cylinders, spheres) are the real
// leak if a rig is rebuilt in a loop.
function disposeEnvTree(root) {
  const res = new Set();
  root.traverse(o => {
    if (o.isMesh) { res.add(o.geometry); res.add(o.material); }
  });
  for (const r of res) if (r && !ENV_SHARED.has(r)) r.dispose();
  root.clear();
}

function buildRig(preset) {
  envFit = measureFolded();
  if (!envFit) return;
  const { group, receivers } = preset.build(envCtx());
  envRoot = new THREE.Group();
  envRoot.name = 'envRoot';
  envRoot.add(group);
  // Added to foldScene, NOT foldGroup: loadFoldViewer pops and disposes every
  // foldGroup child on each load, which would destroy the rig.
  foldScene.add(envRoot);
  envReceivers = receivers ?? [];
  placeEnvRoot();
  applyLedLightingToRig();
  envRoot.visible = envRigOn;
}

function teardownRig() {
  if (!envRoot) return;
  for (const mesh of envReceivers) {
    if (mesh?.material) removeLedLighting(mesh.material);
  }
  foldScene.remove(envRoot);
  disposeEnvTree(envRoot);
  envRoot = null;
  envReceivers = [];
}

// The load-time framing targets the flat sheet at the origin, which is right for a
// fabrication view. A room is only meaningful around the folded object, which sits
// in raw .off coordinates — so reframe when entering a scene, once, rather than
// continuously (which would fight the user's orbit and pan the world during Play).
function frameForEnv() {
  if (!envFit || !foldCamera) return;
  const { center, S } = envFit;
  const dist = S * 1.9;
  foldCamera.position.set(center.x + dist * 0.62,
                          center.y + dist * 0.34,
                          center.z + dist * 0.70);
  foldControls.target.copy(center);
  applyEnvClipping(dist);
  foldControls.update();
}

function applyEnvClipping(dist) {
  if (!foldCamera) return;
  const p = envById(envId);
  const S = envFit?.S ?? 1;
  const d = dist ?? foldCamera.position.distanceTo(foldControls.target);
  // near is tightened from dist/500: a 50000:1 depth range across a large coplanar
  // floor is where z-fighting shows up first. far keys off S rather than dist
  // because a sky dome is tens of rig units across, which dist alone can undershoot.
  foldCamera.near = Math.max(0.01, d / 100);
  foldCamera.far  = d * 8 + (p.build ? 60 * S : 20 * S);
  foldCamera.updateProjectionMatrix();
  // OrbitControls measures the polar angle from `target`, and target.y = center.y is
  // above floorY for any non-degenerate box, so this clamp is exactly sufficient to
  // keep the camera out from under the floor rather than merely approximate.
  foldControls.maxPolarAngle = p.floorLock ? Math.PI / 2 - 0.02 : Math.PI;
  foldControls.maxDistance = Math.max(5000, S * 30);
}

// ── PMREM baking ──────────────────────────────────────────────────────────────
//
// The visible rig and the environment map are two instantiations of the same preset
// builder, so they can never describe different rooms.
//
// Async from day one even though the procedural path resolves immediately: a future
// { hdr: url } preset takes the RGBELoader branch here and no call site changes.
//
// The source scene must NEVER be foldScene. r165's fromScene pins its capture camera
// to the source scene's origin, so baking foldScene would put the camera wherever the
// model happens to sit in raw .off coordinates — inside the board, for batman-092.

let pmrem = null;                  // one generator for the session
const envCache = new Map();        // preset id -> WebGLRenderTarget

async function bakeEnvironment(preset) {
  if (!preset.build && !preset.hdr) return null;      // 'none'
  const hit = envCache.get(preset.id);
  if (hit) return hit.texture;

  if (!pmrem) pmrem = new THREE.PMREMGenerator(foldRenderer);

  const src = new THREE.Scene();
  // Set explicitly: with scene.background == null r165 bakes the renderer's *clear
  // colour*, silently coupling the bake to whatever the last frame cleared to.
  src.background = new THREE.Color(0x000000);
  const { group } = preset.build(envCtx());
  src.add(group);
  for (const o of preset.bake?.(envCtx()) ?? []) src.add(o);

  // near/far are in the source scene's own units, and the bake runs in the
  // normalised frame, so these are fixed and correct for every model.
  const rt = pmrem.fromScene(src, preset.sigma ?? 0, 0.05, 200);
  disposeEnvTree(src);

  rt.texture.name = `env:${preset.id}`;
  // Cached and kept rather than disposed on switch: 6 presets x ~3MB of half-float is
  // cheap next to a 20-40ms re-bake hitch every time the user clicks back to a scene
  // they already looked at, and this UI exists for A/B comparison.
  envCache.set(preset.id, rt);
  return rt.texture;
}

function disposeEnvironments() {
  for (const rt of envCache.values()) rt.dispose();
  envCache.clear();
  pmrem?.dispose();
  pmrem = null;
  if (foldScene) foldScene.environment = null;
}

// ── Fold-aware env fade ───────────────────────────────────────────────────────
//
// The rig is sized for the folded object. At t=0 the flat sheet is dramatically
// wider (cat is 527x423mm against a 311mm folded diagonal) and would clip straight
// through the floor. Rather than oversize the room for a state that is a fabrication
// view — which would leave the folded object looking like a pea on a dinner plate —
// fade the whole environment in as the object folds up. That is also semantically
// right: the flat sheet is how the board comes off the mill, a room is a
// presentation of the finished object. It makes Play a reveal.

const ENV_FADE_LO = 0.55, ENV_FADE_HI = 0.88;
const ENV_VOID_BG = new THREE.Color(0x0f0f1a);
let envFloorLocked = false;

function envFade(t) {
  const x = Math.max(0, Math.min(1, (t - ENV_FADE_LO) / (ENV_FADE_HI - ENV_FADE_LO)));
  return x * x * (3 - 2 * x);      // smoothstep, so no pop at either end
}

// The PCB gets its own, much lower envMapIntensity than the rig. The board is
// side: DoubleSide and r165 flips the normal on backfaces, and IBL has no occlusion,
// so the *interior* of a closed folded shell would otherwise receive full
// environment irradiance and the object would read as hollow — which collapses the
// whole "the board is the light source" premise.
function applyBoardEnv(preset) {
  if (!foldPcbMesh) return;
  const k = envById(envId).build ? envFade(foldT) : 1;
  foldPcbMesh.material.envMapIntensity =
    envBoardOn ? (preset.boardEnv ?? 1) * k : 0;
}

function applyEnvFade() {
  const p = envById(envId);
  if (!foldScene) return;
  if (!p.build) return;            // 'none' owns nothing to fade
  const k = envFade(foldT);

  if (envRoot) envRoot.visible = envRigOn && k > 0.001;
  foldScene.environmentIntensity = (p.envIntensity ?? 1) * k;
  applyBoardEnv(p);

  if (p.bg.type === 'env') {
    if (k < 0.001) {
      // Below the band there is no room to see, so fall back to the void colour
      // rather than showing a half-faded skybox.
      foldScene.background = ENV_VOID_BG;
      foldScene.backgroundIntensity = 1;
    } else {
      foldScene.background = foldScene.environment;
      foldScene.backgroundIntensity = (p.bg.intensity ?? 1) * k;
      foldScene.backgroundBlurriness = p.bg.blur ?? 0;
    }
  }
  // Exposure has to ease in too, or the void reads blown out at t=0.
  foldRenderer.toneMappingExposure = 1 + (uiExposure() - 1) * k;

  // Release the floor clamp while the rig is faded out so under-the-sheet
  // inspection at t=0 still works. Only touched on a change, not every frame.
  const wantLock = !!p.floorLock && k > 0.5;
  if (wantLock !== envFloorLocked) {
    envFloorLocked = wantLock;
    foldControls.maxPolarAngle = wantLock ? Math.PI / 2 - 0.02 : Math.PI;
  }
}

// ── Environment UI ────────────────────────────────────────────────────────────
// Same contract as populateEffectSelect(): the registry is the single source of
// truth for the control, built once at module load.

function populateEnvList() {
  if (!foldEnvSel) return;
  foldEnvSel.textContent = '';
  for (const e of ENVIRONMENTS) {
    const o = document.createElement('option');
    o.value = e.id;
    o.textContent = e.label;
    foldEnvSel.appendChild(o);
  }
  paintEnvList();
}
populateEnvList();

// The selection can change without a change event (a debug hook, a programmatic
// switch), so the control is re-read from state — the same reasoning as
// refreshToggles(), and the same guard populateEffectSelect() uses.
function paintEnvList() {
  if (foldEnvSel && foldEnvSel.value !== envId) foldEnvSel.value = envId;
}

const uiExposure = () => Math.max(0.05, Number(foldExposure?.value ?? 100) / 100);

async function setEnvironment(id) {
  const preset = envById(id);
  const prev = envById(envId);
  envId = preset.id;              // normalise through envById, exactly like setEffect
  paintEnvList();
  if (!foldRenderer) { pendingEnvId = envId; return; }

  // Renderer- and scene-wide settings first: they are cheap, and doing them up front
  // leaves the fallback state correct even if the bake below throws.
  foldRenderer.toneMapping = preset.toneMapping ?? THREE.NeutralToneMapping;
  if (foldExposure) foldExposure.value = Math.round((preset.exposure ?? 1) * 100);
  foldRenderer.toneMappingExposure = uiExposure();
  applyBaseLights(preset);
  applyBoardEnv(preset);

  teardownRig();
  if (!preset.build) {            // 'none'
    foldScene.environment = null;
    foldScene.background = ENV_VOID_BG;
    foldScene.backgroundIntensity = 1;
    foldScene.environmentIntensity = 1;
    applyEnvClipping();
    return;
  }

  const tex = await bakeEnvironment(preset);
  if (envId !== preset.id) return;   // the user clicked again while we awaited
  foldScene.environment = tex;
  buildRig(preset);
  if (!prev.build) frameForEnv();     // first entry into a room
  applyEnvFade();
  applyEnvClipping();
}

// ── Model orientation and turntable spin ──────────────────────────────────────
//
// Two separate rotations, composed into one foldGroup transform:
//
//   * ORIENTATION is a fixed correction the user dials in, because a source mesh's
//     "up" is whatever the modeller chose — the cat, for instance, comes out lying on
//     its side and wants 90 degrees about Y before it reads as a lamp standing on a
//     floor. Generalised as Euler X/Y/Z degrees, so any axis-aligned correction (and
//     via foldDebug, any arbitrary axis) is reachable.
//   * SPIN is an animated turntable about the world vertical, which sweeps the LEDs'
//     light around the room — the clearest demonstration that the illumination really
//     is per-LED and directional.
//
// Total rotation is spin(Y) · orient(XYZ): the correction is applied first, then the
// turntable turns the already-corrected object about the vertical.
//
// Three things make this less trivial than setting rotation.y:
//
//   * The models are not centred, so rotating foldGroup about its own origin would
//     swing the object around the room rather than turn it on the spot. Hence the
//     pivot compensation, position = C - R·C.
//   * foldModel.transforms — where the LED light positions come from — is independent
//     of foldGroup's transform, so updateLedLights() premultiplies foldGroup's matrix
//     or the lights stay behind while the mesh turns.
//   * Orientation changes the object's vertical extent, so the floor has to be placed
//     from the ROTATED bounding box. measureFolded() applies the same rotation.

const SPIN_PERIOD = 14;    // seconds per revolution
let foldSpinning  = false;
let foldSpinAngle = 0;
const foldOrient  = { x: 0, y: 0, z: 0 };   // degrees

// Per-model corrections, keyed by asset family. A family is the folder name with any
// trailing "-<number>" variant suffix stripped, so one entry covers cat-0.2 and cat-0.5.
// Models with no entry orient to zero, which makes every load deterministic instead of
// inheriting whatever the previously loaded model was dialled to.
const MODEL_ORIENT = {
  cat: { x: 270, y: 0, z: 45 },
};

function defaultOrientFor(folderName) {
  const family = String(folderName || '').toLowerCase().replace(/-[\d.]+$/, '');
  return MODEL_ORIENT[family] ?? { x: 0, y: 0, z: 0 };
}

const _pivotVec  = new THREE.Vector3();
const _orientEul = new THREE.Euler();
const _orientMat = new THREE.Matrix4();
const _totalMat  = new THREE.Matrix4();
const _spinMat   = new THREE.Matrix4();
const _pivotMat  = new THREE.Matrix4();

const DEG = Math.PI / 180;

// One pivot for orientation, spin and floor placement alike, so the three can never
// disagree about where the object is. It is the FOLDED centre: at t=1, where a room is
// the only thing that matters, this is exactly the object's middle. The flat sheet at
// t=0 is recentred on the origin and so does swing about this point when rotated —
// invisible in practice, because the room is faded out below t≈0.88.
function foldPivot() {
  return foldModel?.meshBoxCentre
    ? _pivotVec.copy(foldModel.meshBoxCentre)
    : _pivotVec.set(0, 0, 0);
}

// The user's fixed correction, as a rotation matrix. Euler order XYZ.
function orientMatrix(target = _orientMat) {
  _orientEul.set(foldOrient.x * DEG, foldOrient.y * DEG, foldOrient.z * DEG, 'XYZ');
  return target.makeRotationFromEuler(_orientEul);
}

function applyFoldTransform() {
  if (!foldGroup) return;
  const c = foldPivot();
  orientMatrix(_orientMat);
  _spinMat.makeRotationY(foldSpinAngle);
  _totalMat.multiplyMatrices(_spinMat, _orientMat);      // spin ∘ orient

  // Conjugate by the pivot: T(C) · R · T(-C), i.e. rotate about C rather than the
  // origin. Written out rather than composed from three matrices because the result
  // also has to be readable in foldDebug.
  _pivotMat.makeTranslation(c.x, c.y, c.z)
    .multiply(_totalMat)
    .multiply(_pivotMat.clone().makeTranslation(-c.x, -c.y, -c.z));

  foldGroup.matrixAutoUpdate = false;
  foldGroup.matrix.copy(_pivotMat);
  foldGroup.updateMatrixWorld(true);
}

function advanceSpin(dt) {
  if (!foldSpinning) return;
  foldSpinAngle = (foldSpinAngle + (dt / SPIN_PERIOD) * Math.PI * 2) % (Math.PI * 2);
  applyFoldTransform();
}

function setSpinning(on) {
  foldSpinning = on;
  applyFoldTransform();
}

// The generalised entry point. Degrees, Euler XYZ, any combination.
function setOrientation(x, y, z) {
  if (x != null) foldOrient.x = x;
  if (y != null) foldOrient.y = y;
  if (z != null) foldOrient.z = z;
  if (foldOrientX) foldOrientX.value = foldOrient.x;
  if (foldOrientY) foldOrientY.value = foldOrient.y;
  if (foldOrientZ) foldOrientZ.value = foldOrient.z;
  applyFoldTransform();
  // "Up" just moved, so the spatial strip order is stale — the height-sorted effects
  // would keep running along the old axis until the next fold step rebuilt it.
  if (stripDomain === 'spatial' && stripRGB) {
    rebuildStripOrder();
    uploadStrip();
  }
  // The vertical extent just changed, so the room has to be re-fitted around it.
  refitEnvForOrientation();
}

function resetFoldTransform() {
  foldSpinAngle = 0;
  if (foldGroup) {
    foldGroup.matrixAutoUpdate = false;
    foldGroup.matrix.identity();
    foldGroup.updateMatrixWorld(true);
  }
  applyFoldTransform();
}

// ── Fold animation tick ───────────────────────────────────────────────────────
const FOLD_PERIOD = 4.5;   // seconds for one flat -> folded sweep

// One-shot: the sweep runs flat -> folded and stops there. It does not unfold again,
// because the folded state is the one worth looking at — the room fades in for it, and
// a loop that kept flattening the object would throw that away every few seconds.
// Pressing Play at 100% replays from flat.
function advanceFold(dt) {
  foldT += dt / FOLD_PERIOD;
  if (foldT >= 1) {
    foldT = 1;
    foldAnimating = false;
    foldPlayBtn.textContent = '▶ Play';
  }
  setFoldT(foldT);
}

// ── Load fold pair ────────────────────────────────────────────────────────────
async function loadFoldViewer(folderName) {
  foldLoadingEl.classList.remove('hidden');
  dropzone.classList.add('hidden');
  // The mesh viewer may be up when the backend hands a generated fold over, and
  // its controls panel sits at the same corner and z-index as this one.
  viewer.classList.add('hidden');
  foldViewerEl.classList.remove('hidden');
  initFoldScene();

  try {
    const { offUrl, sheetUrl, ledUrl, mapUrl } = await discoverFoldFiles(folderName);
    const grab = async url => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Failed to fetch ${url}`);
      return r.text();
    };
    const [offText, sheetText, ledText, mapText] = await Promise.all([
      grab(offUrl), grab(sheetUrl),
      ledUrl ? grab(ledUrl) : Promise.resolve(null),
      mapUrl ? grab(mapUrl) : Promise.resolve(null),
    ]);

    const off   = parseOFF(offText);
    const sheet = parseSheet(sheetText);
    const led   = ledText ? parseLed(ledText) : null;
    const map   = mapText ? parseMap(mapText) : null;

    foldModel = buildFoldModel(off, sheet, led, map);

    // ---- (re)build renderables
    while (foldGroup.children.length) {
      const c = foldGroup.children.pop();
      c.geometry?.dispose();
      c.material?.dispose();
    }

    const pcbGeom = new THREE.BufferGeometry();
    pcbGeom.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(foldModel.pcb.local.length), 3));
    pcbGeom.setAttribute('color', new THREE.BufferAttribute(foldModel.pcb.color, 3));
    foldPcbMesh = new THREE.Mesh(pcbGeom, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.55, metalness: 0.12, side: THREE.DoubleSide,
      wireframe: foldWireframeOn,
    }));
    foldGroup.add(foldPcbMesh);

    if (foldModel.ledCount) {
      const ledGeom = new THREE.BufferGeometry();
      ledGeom.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(foldModel.ledGeomData.local.length), 3));
      // Package colour is written once here; from now on only the emitter discs
      // change, so an LED that is off still reads as a component on the board.
      const ledColor = new Float32Array(foldModel.ledCount * LED_VERTS * 3);
      for (let i = 0; i < foldModel.ledCount; i++) {
        for (let v = 0; v < LED_BODY_VERTS; v++) {
          const o = (i * LED_VERTS + v) * 3;
          ledColor[o] = LED_BODY_RGB[0];
          ledColor[o + 1] = LED_BODY_RGB[1];
          ledColor[o + 2] = LED_BODY_RGB[2];
        }
      }
      ledGeom.setAttribute('color', new THREE.BufferAttribute(ledColor, 3));
      foldLedMesh = new THREE.Mesh(ledGeom, new THREE.MeshBasicMaterial({
        vertexColors: true, side: THREE.DoubleSide, toneMapped: false,
      }));
      foldLedMesh.visible = foldShowLeds;
      foldGroup.add(foldLedMesh);
    } else {
      foldLedMesh = null;
    }

    if (foldModel.chainCount) {
      const chainGeom = new THREE.BufferGeometry();
      chainGeom.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(foldModel.chainData.local.length), 3));
      foldChainLines = new THREE.LineSegments(chainGeom, new THREE.LineBasicMaterial({
        color: 0x59d0ff, transparent: true, opacity: 0.5,
      }));
      foldChainLines.visible = foldShowChain;
      foldGroup.add(foldChainLines);
    } else {
      foldChainLines = null;
    }

    // ---- diffuser cells: one closed translucent box per face, LEDs inside
    {
      // foldGroup's teardown disposed the previous cell material, so drop the stale
      // entry rather than letting the list grow a dead reference per load.
      ledGlowMaterials.length = 0;
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(foldModel.diffuserGeomData.local.length), 3));
      // depthWrite: false because these are thin transparent shells all over a closed
      // object — with depth writes on, whichever cell happened to draw first would
      // occlude the ones behind it arbitrarily. Nothing else in this scene sets it.
      foldDiffuserMesh = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({
        color: 0xdfe4f0, roughness: 0.9, metalness: 0.0,
        transparent: true, opacity: 0.35, depthWrite: false,
        side: THREE.DoubleSide,
      }));
      foldDiffuserMesh.visible = foldShowDiffuser;
      applyDiffuserLighting(foldDiffuserMesh.material, ledLightMax || 512);
      applyDiffuserStandoff();
      foldGroup.add(foldDiffuserMesh);
    }

    applyHingeVisibility();
    setFoldT(0);
    resetStrip();

    // ---- frame the camera on the flat sheet (its widest state)
    foldPcbMesh.geometry.computeBoundingSphere();
    const radius = foldPcbMesh.geometry.boundingSphere?.radius || 1;
    const dist = radius * 2.6;
    foldCamera.position.set(0, 0, dist);
    foldCamera.near = Math.max(0.01, dist / 500);
    foldCamera.far  = dist * 100;
    foldCamera.updateProjectionMatrix();
    foldControls.target.set(0, 0, 0);
    foldControls.update();

    // ---- UI
    foldFolderNameEl.textContent = folderName;
    foldStatsEl.innerHTML =
      `Faces: ${foldModel.nFaces}<br>` +
      `Hinges: ${foldModel.hingeCount}<br>` +
      `Patches: ${foldModel.patchCount}<br>` +
      `LEDs: ${foldModel.ledCount}${led ? '' : ' (no .led)'}<br>` +
      `Chain: ${foldModel.chainCount} ` +
      `${foldModel.chainIsWiring ? 'wired hops' : 'neighbour edges'}`;

    foldAnimating = false;
    foldPlayBtn.textContent = '▶ Play';
    startFoldRenderLoop();

    // A model with more LEDs may need a bigger shader loop bound. Uniform-driven
    // settings never recompile; this is the one thing that does.
    setLedLightBucket(foldModel.ledCount);
    setLedQualityForModel(foldModel.ledCount);

    // The model's own axes may need a fixed correction to stand up in the room, and
    // foldGroup still carries the pivot compensation for the PREVIOUS model's centre,
    // so it has to be recomputed against the new one or the model lands offset.
    // setOrientation() does both.
    const orientFix = defaultOrientFor(folderName);
    setOrientation(orientFix.x, orientFix.y, orientFix.z);

    // A parked scene (the opening default, or one picked before the renderer existed)
    // gets its full application here rather than in initFoldScene, because a rig can
    // only be sized once there is a model to measure. Awaited, so its bake cannot land
    // in the middle of the per-model refit below and leak a second envRoot.
    const envPreset = envById(envId);
    if (pendingEnvId) {
      pendingEnvId = null;
      await setEnvironment(envPreset.id);
    }

    // The model changed, so the rig has to be re-measured and re-placed. The bake is
    // model-independent (it runs in the normalised frame) and is NOT re-run.
    if (envPreset.build) {
      teardownRig();
      buildRig(envPreset);
      applyBoardEnv(envPreset);
      applyEnvFade();
      frameForEnv();
    }

  } catch (err) {
    console.error(err);
    showError(err.message);
    foldViewerEl.classList.add('hidden');
    dropzone.classList.remove('hidden');
  } finally {
    foldLoadingEl.classList.add('hidden');
  }
}

// Hinge strips share the PCB geometry, so hide them by collapsing their
// triangles rather than with a separate draw call.
function applyHingeVisibility() {
  if (!foldPcbMesh || !foldModel) return;
  const { isHinge } = foldModel.pcb;
  // Faces come first in the buffer, hinge halves after, so a draw range is enough.
  let firstHinge = isHinge.indexOf(1);
  if (firstHinge < 0) firstHinge = isHinge.length;
  foldPcbMesh.geometry.setDrawRange(0, foldShowHinges ? isHinge.length : firstHinge);
}

// ── Fold event handlers ───────────────────────────────────────────────────────
// Nobody can guess "icosa", so when a manifest exists the folders become a
// dropdown and the text input is put away. Without one there is nothing to list,
// so the input stays and typing a name is the only way in.
async function refreshFolderPicker() {
  if (!foldFolderSelect || !foldFolderInput) return;   // no dropzone on this page
  await loadManifest();
  const folders = manifestFolders();
  if (!folders.length) {
    foldFolderSelect.classList.add('hidden');
    foldFolderInput.classList.remove('hidden');
    return;
  }

  const previous = foldFolderSelect.value;
  foldFolderSelect.textContent = '';
  for (const entry of folders) {
    const option = document.createElement('option');
    option.value = entry.folder;
    option.textContent = entry.faces
      ? `${entry.folder} — ${entry.faces} faces`
      : entry.folder;
    foldFolderSelect.appendChild(option);
  }
  if (previous && folders.some(f => f.folder === previous)) {
    foldFolderSelect.value = previous;
  }
  foldFolderSelect.classList.remove('hidden');
  foldFolderInput.classList.add('hidden');
}

function pickedFolder() {
  return foldFolderSelect.classList.contains('hidden')
    ? foldFolderInput.value.trim()
    : foldFolderSelect.value;
}

foldLoadBtn.addEventListener('click', () => {
  const name = pickedFolder();
  if (!name) { showError('Enter a folder name'); return; }
  loadFoldViewer(name);
});

foldFolderInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') foldLoadBtn.click();
});

foldCloseBtn.addEventListener('click', () => {
  foldAnimating = false;
  foldPlayBtn.textContent = '▶ Play';
  foldViewerEl.classList.add('hidden');
  dropzone.classList.remove('hidden');
  teardownRig();
  disposeEnvironments();
  // The bake cache and foldScene.environment went with it, so the next load has to
  // re-run the full apply rather than just refitting a rig around a dead texture.
  pendingEnvId = envId;
});

foldSlider.addEventListener('input', () => {
  foldAnimating = false;
  foldPlayBtn.textContent = '▶ Play';
  setFoldT(Number(foldSlider.value) / 100);
});

foldPlayBtn.addEventListener('click', () => {
  foldAnimating = !foldAnimating;
  foldPlayBtn.textContent = foldAnimating ? '⏸ Pause' : '▶ Play';
  // Already folded: rewind, otherwise Play would have nothing left to run.
  if (foldAnimating && foldT >= 1) setFoldT(0);
});

foldWireframeBtn.addEventListener('click', () => {
  foldWireframeOn = !foldWireframeOn;
  foldWireframeBtn.textContent = `Wireframe: ${foldWireframeOn ? 'On' : 'Off'}`;
  foldWireframeBtn.classList.toggle('active', foldWireframeOn);
  if (foldPcbMesh) foldPcbMesh.material.wireframe = foldWireframeOn;
});

// `names` overrides the On/Off wording for toggles that pick between two modes
// rather than enabling something.
const toggleRepainters = [];

function bindToggle(btn, label, get, set, names = ['On', 'Off']) {
  if (!btn) return;
  const paint = () => {
    btn.textContent = `${label}: ${get() ? names[0] : names[1]}`;
    btn.classList.toggle('active', get());
  };
  btn.addEventListener('click', () => { set(!get()); paint(); });
  toggleRepainters.push(paint);
  paint();
}

// State can also change from outside a click (the inspection hook, a reload), so
// labels are re-read from state rather than assumed to follow the last click.
function refreshToggles() {
  for (const paint of toggleRepainters) paint();
}

bindToggle(foldLedsBtn, 'LEDs', () => foldShowLeds, v => {
  foldShowLeds = v;
  if (foldLedMesh) foldLedMesh.visible = v;
});
bindToggle(foldHingesBtn, 'Hinges', () => foldShowHinges, v => {
  foldShowHinges = v;
  applyHingeVisibility();
});
bindToggle(foldChainBtn, 'Chain', () => foldShowChain, v => {
  foldShowChain = v;
  if (foldChainLines) foldChainLines.visible = v;
});
bindToggle(foldDomainBtn, 'Domain', () => stripDomain === 'spatial', v => {
  setStripDomain(v ? 'spatial' : 'wiring');
}, ['Spatial', 'Wiring']);

foldEffectSel?.addEventListener('change', () => setEffect(foldEffectSel.value));
foldEnvSel?.addEventListener('change', () => setEnvironment(foldEnvSel.value));
foldBrightness?.addEventListener('input', () => uploadStrip());

bindToggle(foldRigBtn, 'Room', () => envRigOn, v => {
  envRigOn = v;
  if (envRoot) envRoot.visible = v && envFade(foldT) > 0.001;
});
bindToggle(foldBoardEnvBtn, 'Board env', () => envBoardOn, v => {
  envBoardOn = v;
  applyBoardEnv(envById(envId));
});
bindToggle(foldDiffuserBtn, 'Diffuser', () => foldShowDiffuser, v => setShowDiffuser(v));

foldDiffStandoff?.addEventListener('input', () => applyDiffuserStandoff());
foldDiffGlow?.addEventListener('input', () => tuneDiffuser());
bindToggle(foldSpinBtn, 'Spin', () => foldSpinning, v => setSpinning(v));

const readOrient = () => setOrientation(
  Number(foldOrientX?.value ?? 0) || 0,
  Number(foldOrientY?.value ?? 0) || 0,
  Number(foldOrientZ?.value ?? 0) || 0);
for (const el of [foldOrientX, foldOrientY, foldOrientZ]) {
  el?.addEventListener('input', readOrient);
}
foldOrientReset?.addEventListener('click', () => setOrientation(0, 0, 0));

// Lamp gain is how much the LEDs illuminate the room, distinct from LED brightness
// (which gains the emitter colours). Read from the DOM at use time.
foldLampGain?.addEventListener('input', () => tuneLedLighting());
foldBeam?.addEventListener('input',
  () => setLedBeamAngle(Number(foldBeam.value) || LED_BEAM_DEFAULT));

// Exposure is read from the DOM at use time, like #fold-brightness and #fold-speed.
foldExposure?.addEventListener('input', () => {
  if (envById(envId).build) applyEnvFade();
  else foldRenderer.toneMappingExposure = uiExposure();
});

// Extend existing resize handler to cover fold renderer/camera
window.addEventListener('resize', () => {
  if (!foldCamera) return;
  foldCamera.aspect = innerWidth / innerHeight;
  foldCamera.updateProjectionMatrix();
  foldRenderer.setSize(innerWidth, innerHeight);
});

// Inspection hook: reports what was parsed and the PCB's extent at the current
// fold, so the fold can be checked against the source .sheet / .off numbers.
window.foldDebug = {
  load: loadFoldViewer,
  setT: setFoldT,
  listEnvs: () => ENVIRONMENTS.map(e => ({ id: e.id, label: e.label })),
  setEnv: setEnvironment,
  frameFolded: frameForEnv,
  setLampGain: v => { if (foldLampGain) foldLampGain.value = v * 100; tuneLedLighting(); },
  setSpin: setSpinning,
  // Sets the turntable angle directly, for deterministic screenshots.
  setSpinAngle: rad => { foldSpinAngle = rad; applyFoldTransform(); },
  // Degrees, Euler XYZ. The generalised orientation entry point.
  setOrientation,
  // Any arbitrary axis, not just the three basis axes.
  setOrientAxisAngle: (axis, deg) => {
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(...axis).normalize(), deg * DEG), 'XYZ');
    setOrientation(e.x / DEG, e.y / DEG, e.z / DEG);
  },
  spinState: () => ({
    spinning: foldSpinning,
    angle: +foldSpinAngle.toFixed(4),
    orient: { ...foldOrient },
    pivot: foldPivot().toArray().map(v => +v.toFixed(2)),
    groupMatrix: foldGroup.matrix.elements.map(v => +v.toFixed(3)),
    diffuser: foldShowDiffuser,
  }),
  setDiffuser: setShowDiffuser,
  setDiffStandoff: mm => {
    if (foldDiffStandoff) foldDiffStandoff.value = Math.round(mm * 10);
    applyDiffuserStandoff();
  },
  setDiffGlow: g => { if (foldDiffGlow) foldDiffGlow.value = g * 100; tuneDiffuser(); },
  setDiffWrap: w => { ledDiffUniforms.uDiffWrap.value = w; },
  // How many faces needed their winding flipped so the cell normal points outward. A
  // non-zero count is expected and fine; what matters is that the swap happened, because
  // an unflipped face would have its transmission test inverted and read black.
  diffuserState: () => ({
    on: foldShowDiffuser,
    verts: foldModel ? foldModel.diffuserGeomData.face.length : 0,
    faces: foldModel ? foldModel.nFaces : 0,
    windingSwapped: foldModel ? foldModel.diffuserGeomData.swapped : 0,
    standoff: uiDiffStandoff(),
    power: +ledDiffUniforms.uDiffPower.value.toFixed(2),
    soft: +ledDiffUniforms.uDiffSoft.value.toFixed(2),
    wrap: ledDiffUniforms.uDiffWrap.value,
    glowMaterials: ledGlowMaterials.length,
  }),
  setBeamAngle: deg => { if (foldBeam) foldBeam.value = deg; setLedBeamAngle(deg); },
  setBeamFocus: f => { ledLightUniforms.uLedFocus.value = f; },
  // 0 = omnidirectional point emitters, 1 = fully directed along each face normal.
  setLobe: v => { ledLightUniforms.uLedLobe.value = v; },
  setLedQuality: (budget, perVertex) => {
    ledAutoQuality = false;
    if (budget != null) ledLightBudget = budget;
    if (perVertex != null) setLedShadingRate(!!perVertex);
  },
  // Reports the state of the per-LED light buffer. `lit` is the compacted count after
  // the black-LED cull and the budget clamp, so it is normally well below ledCount.
  // At t=0 every transform is a pure translation, so every emitter normal must read
  // exactly (0,0,1) in world space — a free assertion on the column-2 normal trick.
  ledLights: () => {
    const cols = [];
    if (ledLightData) {
      for (let j = 0; j < Math.min(4, ledLitCount); j++) {
        cols.push({
          viewPos: [0, 1, 2].map(c => +ledLightData[j * 4 + c].toFixed(2)),
          rgb: [0, 1, 2].map(c => +ledLightData[(LED_TEX_W + j) * 4 + c].toFixed(3)),
          viewNormal: [0, 1, 2].map(c => +ledLightData[(LED_TEX_W * 2 + j) * 4 + c].toFixed(3)),
        });
      }
    }
    return {
      on: ledLightOn, lit: ledLitCount, ledCount: foldModel?.ledCount ?? 0,
      // gated is the fold on-gate: false means every count below is zero by design,
      // not because the light path broke.
      gated: ledsLit(), gain: ledGain(),
      maxLeds: ledLightMax, budget: ledLightBudget,
      shadingRate: ledPerVertex ? 'vertex' : 'fragment',
      autoQuality: ledAutoQuality, frameMs: +ledFrameMs.toFixed(1),
      diffuser: foldShowDiffuser, receivers: ledReceivers.length,
      // roomLit is the budget-capped count the room receivers walk; glowLit is the full
      // set the diffuser cells see.
      roomLit: ledLightUniforms.uLedCount.value,
      glowLit: ledGlowUniforms.uLedCount.value,
      beamDeg: +(Math.acos(Math.min(1, ledLightUniforms.uLedConeCos.value)) / DEG).toFixed(1),
      focus: ledLightUniforms.uLedFocus.value,
      power: +ledLightUniforms.uLedPower.value.toFixed(1),
      cutoff: +ledLightUniforms.uLedCutoff.value.toFixed(1),
      lampGain: uiLampGain(), first: cols,
    };
  },
  // World-space emitter normals, for the t=0 assertion above.
  ledNormals: (limit = 6) => {
    if (!foldModel) return [];
    const out = [];
    for (let i = 0; i < Math.min(limit, foldModel.ledCount); i++) {
      const e = foldModel.transforms[foldModel.ledFaceOf[i]].elements;
      out.push([+e[8].toFixed(4), +e[9].toFixed(4), +e[10].toFixed(4)]);
    }
    return out;
  },
  // Reports what the rig was actually sized from, so a mis-scaled or mis-placed room
  // is diagnosable without eyeballing it. `center` being far from the origin is
  // expected, not a bug — the source meshes are not centred.
  envState: () => ({
    env: envId,
    exposure: +uiExposure().toFixed(3),
    fade: +envFade(foldT).toFixed(3),
    fit: envFit && {
      S: +envFit.S.toFixed(2),
      center: envFit.center.toArray().map(v => +v.toFixed(2)),
      floorY: +envFit.floorY.toFixed(2),
    },
    rigVisible: !!envRoot?.visible,
    receivers: envReceivers.length,
    baked: [...envCache.keys()],
    boardEnvIntensity: foldPcbMesh ? +foldPcbMesh.material.envMapIntensity.toFixed(3) : null,
    toneMapping: foldRenderer?.toneMapping,
    near: +foldCamera.near.toFixed(3), far: Math.round(foldCamera.far),
    maxPolarAngle: +foldControls.maxPolarAngle.toFixed(3),
  }),
  listEffects: () => EFFECTS.map(e => ({ id: e.id, label: e.label, group: e.group })),
  setEffect,
  setDomain: setStripDomain,
  stepEffect(steps = 1) {
    const n = foldModel.ledCount;
    const eff = effectById(effectId);
    for (let i = 0; i < steps; i++) eff.step(n);
    uploadStrip();
  },
  // Lit count + checksum, so an effect that never changes (or produces invalid
  // bytes) is detectable without looking at it.
  sampleStrip() {
    if (!stripRGB) return null;
    let lit = 0, sum = 0, min = 255, max = 0, invalid = 0;
    for (let k = 0; k < stripRGB.length; k += 3) {
      const r = stripRGB[k], g = stripRGB[k + 1], b = stripRGB[k + 2];
      if (r + g + b > 0) lit++;
      for (const v of [r, g, b]) {
        if (!Number.isInteger(v) || v < 0 || v > 255) invalid++;
        sum = (sum * 31 + v) % 2147483647;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return { effect: effectId, domain: stripDomain, n: stripRGB.length / 3,
             lit, checksum: sum, min, max, invalid };
  },
  // stripOrder must be a permutation of every LED, or some LED can never light.
  stripOrderInfo() {
    const n = foldModel.ledCount;
    const seen = new Uint8Array(n);
    let dupes = 0, oob = 0;
    for (let k = 0; k < n; k++) {
      const i = stripOrder[k];
      if (i < 0 || i >= n) { oob++; continue; }
      if (seen[i]++) dupes++;
    }
    const missing = Array.from(seen).filter(v => v === 0).length;
    // In spatial mode the slots must ascend in world height. Measured through
    // foldGroup exactly as rebuildStripOrder() sorts, or a model the user has
    // reoriented would report a false inversion for every pair.
    const ys = [];
    for (let k = 0; k < n; k++) {
      const i = stripOrder[k];
      _lc.copy(foldModel.ledCentreLocal[i])
        .applyMatrix4(foldModel.transforms[foldModel.ledFaceOf[i]])
        .applyMatrix4(foldGroup.matrixWorld);
      ys.push(+_lc.y.toFixed(4));
    }
    let inversions = 0;
    for (let k = 1; k < ys.length; k++) if (ys[k] < ys[k - 1]) inversions++;
    return { n, dupes, oob, missing, yInversions: inversions };
  },
  // Every face should carry at least one LED, and every LED should be reachable
  // by the strip (i.e. actually able to light). Reports faces that fail either.
  ledCoverage() {
    const m = foldModel;
    if (!m) return null;
    const perFace = Array.from({ length: m.nFaces }, () => []);
    m.ledFaceOf.forEach((fid, i) => perFace[fid].push(i));
    const colors = foldLedMesh?.geometry.attributes.color.array;
    const litOf = i => {
      if (!colors) return false;
      // only the emitter run counts — the package is a non-zero constant
      for (let v = LED_BODY_VERTS; v < LED_VERTS; v++) {
        const o = (i * LED_VERTS + v) * 3;
        if (colors[o] + colors[o + 1] + colors[o + 2] > 0) return true;
      }
      return false;
    };
    const noLed = [], noLit = [];
    perFace.forEach((idx, fid) => {
      if (!idx.length) noLed.push(fid);
      else if (!idx.some(litOf)) noLit.push({ fid, leds: idx });
    });
    return {
      faces: m.nFaces, leds: m.ledCount, effect: effectId, domain: stripDomain,
      facesWithNoLed: noLed,
      facesWithNoLitLed: noLit,
      ledsPerFace: perFace.map(a => a.length),
    };
  },
  // Are the LED modules the right size, and do they sit inside their board face?
  // Every footprint in the fabricated layout is identical, so a spread here means
  // the .led file is being mapped through the wrong triangle. `clearance` is the
  // smallest gap from any LED corner to a board edge; negative means it pokes out.
  ledFit() {
    const m = foldModel;
    if (!m || !m.ledCount) return null;
    const local = m.ledGeomData.local, board = m.pcb.local;
    const corner = (i, k) => {
      const o = (i * LED_VERTS + k) * 3;
      return [local[o], local[o + 1]];
    };
    // signed distance from p to the edge a->b of the triangle, positive inside
    const inward = (p, a, b, c) => {
      const n = [-(b[1] - a[1]), b[0] - a[0]];
      const s = Math.sign(n[0] * (c[0] - a[0]) + n[1] * (c[1] - a[1]));
      return s * (n[0] * (p[0] - a[0]) + n[1] * (p[1] - a[1])) / Math.hypot(n[0], n[1]);
    };
    const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

    const w = [], h = [], outside = [];
    let clearance = Infinity;
    for (let i = 0; i < m.ledCount; i++) {
      // the package's 6 vertices repeat corners 0,1,2,3 as 0,1,2,0,2,3
      const q = [corner(i, 0), corner(i, 1), corner(i, 2), corner(i, 5)];
      w.push(dist(q[0], q[1]));
      h.push(dist(q[0], q[3]));
      const fid = m.ledFaceOf[i];
      const t = [0, 1, 2].map(v => {
        const o = (fid * 3 + v) * 3;
        return [board[o], board[o + 1]];
      });
      let worst = Infinity;
      for (const p of q) {
        for (let e = 0; e < 3; e++) {
          worst = Math.min(worst, inward(p, t[e], t[(e + 1) % 3], t[(e + 2) % 3]));
        }
      }
      clearance = Math.min(clearance, worst);
      if (worst < 0) outside.push({ led: i, fid, overhang: +(-worst).toFixed(3) });
    }
    const stat = a => {
      const s = [...a].sort((x, y) => x - y);
      return { min: +s[0].toFixed(3), median: +s[s.length >> 1].toFixed(3),
               max: +s[s.length - 1].toFixed(3) };
    };
    return {
      leds: m.ledCount, mappedThrough: m.ledMap,
      footprintSpread: +(m.ledSpread * 100).toFixed(2) + '%',
      width: stat(w), height: stat(h),
      minClearance: +clearance.toFixed(3),
      ledsOutsideBoard: outside.length, outside: outside.slice(0, 12),
    };
  },
  state() {
    if (!foldModel) return { loaded: false };
    const pos = foldPcbMesh.geometry.attributes.position.array;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], pos[i + k]);
        hi[k] = Math.max(hi[k], pos[i + k]);
      }
    }
    return {
      loaded: true, t: foldT,
      faces: foldModel.nFaces, hinges: foldModel.hingeCount,
      patches: foldModel.patchCount, leds: foldModel.ledCount,
      chain: foldModel.chainCount, chaseOrder: foldModel.chaseOrder.length,
      bboxMin: lo.map(v => +v.toFixed(3)), bboxMax: hi.map(v => +v.toFixed(3)),
      extent: hi.map((v, k) => +(v - lo[k]).toFixed(3)),
    };
  },
  // At full fold every board face must lie in its mesh face's plane. This is
  // the strongest single check that the fold reproduces the source geometry.
  planeResidual() {
    const m = foldModel;
    if (!m) return null;
    evaluateTransforms(1);
    const p = new THREE.Vector3();
    let worst = 0;
    for (let fid = 0; fid < m.nFaces; fid++) {
      for (const vi of [0, 1, 2]) {
        const base = (fid * 3 + vi) * 3;
        p.set(m.pcb.local[base], m.pcb.local[base + 1], m.pcb.local[base + 2])
          .applyMatrix4(m.transforms[fid]);
        worst = Math.max(worst, Math.abs(m.meshPlanes[fid].distanceToPoint(p)));
      }
    }
    setFoldT(foldT);
    return +worst.toExponential(3);
  },
  // Hinge strips must stay welded to the faces they bridge. Measures the seam
  // between each strip's end vertices and the board vertices they meet.
  seam() {
    const m = foldModel;
    if (!m) return null;
    const pos = foldPcbMesh.geometry.attributes.position.array;
    const at = (i, o) => o.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    let worst = 0;
    const firstHinge = m.pcb.isHinge.indexOf(1);
    if (firstHinge < 0) return 0;
    // Within one hinge, span k's far edge is span k+1's near edge. Compare only
    // inside a hinge — striding past its last span lands on a different hinge.
    const perSpan = 6, perHinge = perSpan * HINGE_SPANS;
    for (let h = firstHinge; h + perHinge <= m.pcb.isHinge.length; h += perHinge) {
      for (let k = 0; k + 1 < HINGE_SPANS; k++) {
        const cur = h + k * perSpan, next = cur + perSpan;
        at(cur + 2, a); at(next + 1, b);     // p1(s1) of span k vs p1(s0) of k+1
        worst = Math.max(worst, a.distanceTo(b));
        at(cur + 5, a); at(next + 0, b);     // p0(s1) of span k vs p0(s0) of k+1
        worst = Math.max(worst, a.distanceTo(b));
      }
    }
    return +worst.toFixed(6);
  },
};

// ── PCBend generation backend (optional) ──────────────────────────────────────
//
// Served by server.py, which adds /api/* on top of the same static files. With
// a plain `python3 -m http.server` the probe below simply fails and every
// function here turns into a no-op, so the app behaves exactly as it always did.
//
// Flow for a dropped mesh: POST it, and either the assets are already cached
// (open the fold viewer straight away) or a pipeline run is queued and this
// panel tracks it, keeping the local three.js preview on screen meanwhile.

const genPanel     = document.getElementById('gen-panel');
const genTitle     = document.getElementById('gen-title');
const genBadge     = document.getElementById('gen-badge');
const genStage     = document.getElementById('gen-stage');
const genBar       = document.getElementById('gen-bar-fill');
const genLog       = document.getElementById('gen-log');
const genOpenBtn   = document.getElementById('gen-open-btn');
const genCancelBtn = document.getElementById('gen-cancel-btn');
const genCloseBtn  = document.getElementById('gen-close-btn');
const genHint      = document.getElementById('gen-hint');

let backend       = null;    // /api/config payload, or null when served statically
let backendWarned = false;   // a bad config gets one toast per session, not one per drop
let genJobId      = null;    // job the panel is following
let genFolder     = null;    // assets folder that job will publish to
let genDismissed  = false;   // panel closed by hand: never yank the view away later
let genPollTimer  = null;
let genPollFails  = 0;

const TERMINAL = ['done', 'failed', 'cancelled'];

async function probeBackend() {
  try {
    const res = await fetch('api/config', { cache: 'no-store' });
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      backend = await res.json();
    }
  } catch {
    backend = null;          // no backend here; static mode
  }
  paintHint();
  if (backend?.ok) reattachJob();
}

function paintHint() {
  if (!genHint) return;
  genHint.classList.remove('error');
  if (!backend) {
    // Also what a visitor to the hosted copy sees, where there is no backend to
    // bring up: say what this build can do rather than how to fix it.
    genHint.textContent =
      'Viewer only — generating a new fold from a mesh runs the pipeline locally';
  } else if (!backend.ok) {
    genHint.textContent = backend.error?.message || 'Backend unavailable';
    genHint.classList.add('error');
  } else {
    genHint.textContent =
      `Backend ready — drop a mesh to generate with ${backend.config_name}`;
  }
}

// ── Panel ─────────────────────────────────────────────────────────────────────
function setGenState(state) {
  genPanel.classList.remove('state-warn', 'state-error', 'done');
  if (state) genPanel.classList.add(state);
}

function showGenPanel() {
  genDismissed = false;
  genPanel.classList.remove('hidden');
}

function genMessage(title, badge, message, state) {
  showGenPanel();
  setGenState(state);
  genTitle.textContent = title;
  genBadge.textContent = badge;
  genStage.textContent = message;
  genBar.style.width = '0%';
  genLog.textContent = '';
  genOpenBtn.classList.add('hidden');
  genCancelBtn.classList.add('hidden');
}

genCloseBtn.addEventListener('click', () => {
  // The run keeps going server-side; it just stops taking over the screen.
  genPanel.classList.add('hidden');
  genDismissed = true;
});

genOpenBtn.addEventListener('click', () => {
  if (genFolder) {
    genPanel.classList.add('hidden');
    loadFoldViewer(genFolder);
  }
});

genCancelBtn.addEventListener('click', async () => {
  if (!genJobId) return;
  genCancelBtn.disabled = true;
  try {
    await fetch(`api/jobs/${genJobId}/cancel`, { method: 'POST' });
  } catch (err) {
    showError(`Could not cancel: ${err.message ?? err}`);
  }
  genCancelBtn.disabled = false;
});

// ── Submit ────────────────────────────────────────────────────────────────────
// Called from loadMesh() for every dropped/browsed file, and deliberately not
// awaited: the local preview must never wait on the backend.
async function requestGeneration(file) {
  if (!backend) return;
  if (!backend.ok) {
    if (!backendWarned) {
      backendWarned = true;
      showError(backend.error?.message || 'PCBend backend unavailable');
    }
    return;
  }

  let res, data;
  try {
    res = await fetch(`api/jobs?name=${encodeURIComponent(file.name)}`,
                      { method: 'POST', body: file });
    data = await res.json();
  } catch (err) {
    showError(`Backend request failed: ${err.message ?? err}`);
    return;
  }

  if (data.status === 'cached') {
    // Nothing to run — the fold is one fetch away.
    genPanel.classList.add('hidden');
    genJobId = null;
    loadFoldViewer(data.folder);
    return;
  }

  if (res.status === 409) {
    genMessage(data.mesh ? `Busy: ${data.mesh}` : 'Backend busy', 'BUSY',
               data.error?.message || 'a run is already in progress', 'state-warn');
    return;
  }

  if (!res.ok) {
    const message = data.error?.message || `Backend error (${res.status})`;
    showError(message);
    // A toast lasts four seconds; these need reading, so keep them on screen.
    genMessage(file.name, (data.error?.code || 'error').toUpperCase(),
               message, 'state-error');
    return;
  }

  attachJob(data);
}

function attachJob(job) {
  genJobId = job.job_id;
  genFolder = job.folder;
  genPollFails = 0;
  showGenPanel();
  setGenState(null);
  genTitle.textContent = `${job.mesh} · ${backend.config_name}`;
  genBadge.textContent = (job.state || job.status || 'queued').toUpperCase();
  genStage.textContent = job.stage || 'Queued';
  genBar.style.width = '0%';
  genLog.textContent = (job.warnings || []).join('\n');
  genOpenBtn.classList.add('hidden');
  genCancelBtn.classList.remove('hidden');
  schedulePoll(0);
}

async function reattachJob() {
  // A page reload should pick the running job back up rather than lose it.
  try {
    const res = await fetch('api/jobs', { cache: 'no-store' });
    const { current } = await res.json();
    if (current && !TERMINAL.includes(current.state)) attachJob(current);
  } catch {
    /* nothing running, or no backend */
  }
}

// ── Poll ──────────────────────────────────────────────────────────────────────
function schedulePoll(delay = backend?.poll_ms ?? 1500) {
  clearTimeout(genPollTimer);
  genPollTimer = setTimeout(pollJob, delay);
}

async function pollJob() {
  if (!genJobId) return;
  try {
    const res = await fetch(`api/jobs/${genJobId}`, { cache: 'no-store' });
    if (res.status === 404) { genJobId = null; return; }
    const job = await res.json();
    genPollFails = 0;
    renderJob(job);
    if (TERMINAL.includes(job.state)) { genJobId = null; return; }
  } catch (err) {
    if (++genPollFails > 5) {
      genJobId = null;
      showError(`Lost contact with the backend: ${err.message ?? err}`);
      return;
    }
  }
  schedulePoll();
}

function renderJob(job) {
  genFolder = job.folder || genFolder;
  const partial = job.state === 'done' && job.failed > 0;
  genBadge.textContent = partial ? 'PARTIAL' : job.state.toUpperCase();
  genBar.style.width = `${job.percent ?? 0}%`;

  const bits = [job.stage];
  if (job.faces_total && job.state === 'running') {
    bits.push(`${job.faces_done}/${job.faces_total} faces`);
  }
  if (job.elapsed_sec) bits.push(`${Math.round(job.elapsed_sec)}s`);
  genStage.textContent = bits.filter(Boolean).join(' · ');

  // The raw pipeline log is noise while the run is healthy -- the stage line and
  // the face counter already say where it is. Only surface it once there is
  // something to diagnose: a failure, or faces that did not verify.
  const diagnostic = job.state === 'failed' || (job.state === 'done' && job.failed > 0);
  const lines = [...(job.warnings || []), ...(diagnostic ? job.log_tail || [] : [])];
  genLog.textContent = lines.join('\n');
  genLog.scrollTop = genLog.scrollHeight;

  if (!TERMINAL.includes(job.state)) return;

  genCancelBtn.classList.add('hidden');
  if (job.state === 'cancelled') {
    genPanel.classList.add('hidden');
    return;
  }
  if (job.state === 'failed') {
    setGenState('state-error');
    genStage.textContent = job.error?.message || 'Generation failed';
    showGenPanel();
    showError(job.error?.message || 'PCB generation failed');
    return;
  }

  // Done. server.py rewrote assets/manifest.json as it published, so re-read it
  // to get the new folder into the dropdown (and into discoverFoldFiles) without
  // a reload.
  invalidateManifest();
  refreshFolderPicker();

  // A clean run earns the transition; a partial one, or one whose panel the user
  // closed, waits behind a button instead of hijacking the view.
  setGenState(partial ? 'state-warn' : 'done');
  if (partial || genDismissed) {
    genOpenBtn.classList.remove('hidden');
    if (partial) showGenPanel();
  } else {
    genPanel.classList.add('hidden');
    loadFoldViewer(job.folder);
  }
}

probeBackend();
refreshFolderPicker();
