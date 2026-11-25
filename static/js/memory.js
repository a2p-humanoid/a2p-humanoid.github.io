// Interactive viewer for the real-robot 3D scene memory (points accumulated frame by frame, with camera frusta).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('pc-canvas');
const host = document.getElementById('viewer');
const slider = document.getElementById('pc-slider');
const label = document.getElementById('pc-label');
const playBtn = document.getElementById('pc-play');
const homeBtn = document.getElementById('pc-home');
const orbitBtn = document.getElementById('pc-orbit');
const loading = document.getElementById('pc-loading');

let started = false;
new IntersectionObserver((es, o) => es.forEach((e) => {
  if (e.isIntersecting && !started) { started = true; o.disconnect(); init(); }
}), { rootMargin: '300px' }).observe(host);

async function init() {
  THREE.ColorManagement.enabled = false;                    // keep hex frustum colors and point colors exactly as given
  const [meta, buf] = await Promise.all([
    fetch('static/pointcloud/memory.json').then((r) => r.json()),
    fetch('static/pointcloud/memory.bin').then((r) => r.arrayBuffer()),
  ]);
  const n = meta.n, lo = meta.lo, hi = meta.hi;
  const q = new Uint16Array(buf, 0, n * 3), col = new Uint8Array(buf, n * 6, n * 3);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) { const k = i % 3; pos[i] = lo[k] + (q[i] / 65535) * (hi[k] - lo[k]); }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // point colors are camera sRGB already: pass them through untouched
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 50);
  camera.up.set(0, 0, 1);                                  // memory frame is z-up

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Array.from(col, (c) => c / 255)), 3));
  const mat = new THREE.PointsMaterial({ size: 0.0055, vertexColors: true, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // frusta: apex + 4 corners per camera
  const frusta = meta.cams.map((c) => {
    const p = c.p.map((v) => new THREE.Vector3(...v));
    const segs = [0, 1, 0, 2, 0, 3, 0, 4, 1, 2, 2, 3, 3, 4, 4, 1];
    const g = new THREE.BufferGeometry().setFromPoints(segs.map((i) => p[i]));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x5ad2ff, transparent: true, opacity: 0.9 }));
    scene.add(l); return l;
  });
  frusta[0].material.color.set(0xff5a5a);

  // view setup: target = robust center of the table points
  const center = new THREE.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
  const home = meta.cams[0].p.map((v) => new THREE.Vector3(...v));
  const homeApex = home[0], homeLook = home.slice(1).reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(0.25);
  const lookDir = homeLook.clone().sub(homeApex).normalize();
  const target = homeApex.clone().add(lookDir.clone().multiplyScalar(0.75));
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.target.copy(target);
  controls.minDistance = 0.2; controls.maxDistance = 4;

  const orbitPose = () => {
    // behind and above the head camera, looking over it at the table, slightly off-axis
    const fwd = new THREE.Vector3(lookDir.x, lookDir.y, 0).normalize();
    const side = new THREE.Vector3(-fwd.y, fwd.x, 0);
    camera.position.copy(homeApex).add(fwd.clone().multiplyScalar(-0.45)).add(side.multiplyScalar(0.28)).add(new THREE.Vector3(0, 0, 0.32));
    controls.target.copy(target); controls.update();
  };
  const homePose = () => {
    camera.position.copy(homeApex).add(lookDir.clone().multiplyScalar(-0.02));
    controls.target.copy(homeLook.clone().add(lookDir.clone().multiplyScalar(0.6))); controls.update();
  };
  orbitPose();

  let k = meta.cams.length, auto = true, playing = false, lastStep = 0, swing0 = null, homeMode = false;
  slider.max = meta.cams.length;
  const setK = (v) => {
    k = v; slider.value = v;
    geo.setDrawRange(0, meta.cams[v - 1].n);
    frusta.forEach((f, i) => {
      f.visible = !homeMode && i < v;
      if (i > 0) f.material.color.set(i === v - 1 ? 0xffd24a : 0x5ad2ff);
    });
    label.textContent = `${v} / ${meta.cams.length} frames · ${(meta.cams[v - 1].n / 1000).toFixed(0)}k pts`;
  };
  setK(k);
  slider.addEventListener('input', () => { playing = false; playBtn.innerHTML = '&#9654;'; setK(+slider.value); });
  playBtn.addEventListener('click', () => {
    playing = !playing; playBtn.innerHTML = playing ? '&#10073;&#10073;' : '&#9654;';
    if (playing && k >= meta.cams.length) setK(1);
  });
  homeBtn.addEventListener('click', () => {
    auto = false; homeMode = true; homePose(); setK(k);
    homeBtn.classList.add('on'); orbitBtn.classList.remove('on');
  });
  orbitBtn.addEventListener('click', () => {
    auto = true; swing0 = null; homeMode = false; orbitPose(); setK(k);
    orbitBtn.classList.add('on'); homeBtn.classList.remove('on');
  });
  orbitBtn.classList.add('on');
  controls.addEventListener('start', () => { auto = false; });

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host); resize();

  let visible = true;
  new IntersectionObserver((es) => es.forEach((e) => (visible = e.isIntersecting))).observe(host);
  loading.classList.add('done');

  // start with an accumulation animation once
  setK(1); playing = true; playBtn.innerHTML = '&#10073;&#10073;';

  const tick = (t) => {
    requestAnimationFrame(tick);
    if (!visible) return;
    if (playing && t - lastStep > 420) {
      lastStep = t;
      if (k < meta.cams.length) setK(k + 1); else { playing = false; playBtn.innerHTML = '&#9654;'; }
    }
    if (auto) {                                             // gentle side-to-side swing around the over-the-shoulder view
      if (!swing0) swing0 = { off: camera.position.clone().sub(controls.target), t: t };
      const a = 0.55 * Math.sin((t - swing0.t) * 0.00028);
      camera.position.copy(controls.target).add(swing0.off.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), a));
    } else swing0 = null;
    controls.update();
    renderer.render(scene, camera);
  };
  requestAnimationFrame(tick);
}
