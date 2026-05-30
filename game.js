import * as THREE from "three";

const canvas = document.querySelector("#game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x98c4d8, 42, 118);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 260);
const clock = new THREE.Clock();

const state = {
  started: false,
  mobile: false,
  yaw: -0.75,
  pitch: 0.46,
  embers: new Set(),
  berries: 0,
  logsPushed: 0,
  windmillUnfrozen: false,
  beetleLured: false,
  foxesSaved: false,
  forgeLit: false,
  toastTimer: 0,
  prompt: "",
  time: 0,
  pointerDown: false,
  grounded: false,
  onUpdraft: false,
};

const input = {
  keys: new Set(),
  move: new THREE.Vector2(),
  look: new THREE.Vector2(),
  jump: false,
  dash: false,
  heat: false,
};

const ui = {
  start: document.querySelector("#startScreen"),
  hud: document.querySelector("#hud"),
  desktopHelp: document.querySelector("#desktopHelp"),
  mobileControls: document.querySelector("#mobileControls"),
  quest: document.querySelector("#questText"),
  emberDots: document.querySelector("#emberDots"),
  emberCount: document.querySelector("#emberCount"),
  prompt: document.querySelector("#prompt"),
  toast: document.querySelector("#toast"),
  ending: document.querySelector("#ending"),
};

ui.emberDots.innerHTML = "<i></i><i></i><i></i>";

const mats = {
  snow: new THREE.MeshStandardMaterial({ color: 0xdceffa, roughness: 0.85 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x5fbf6d, roughness: 0.9 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x80878b, roughness: 0.8 }),
  darkRock: new THREE.MeshStandardMaterial({ color: 0x45464c, roughness: 0.86 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8b5a35, roughness: 0.8 }),
  ice: new THREE.MeshStandardMaterial({ color: 0xaadcf5, roughness: 0.25, transparent: true, opacity: 0.75 }),
  ember: new THREE.MeshStandardMaterial({ color: 0xff9d23, emissive: 0xff6a00, emissiveIntensity: 1.9 }),
  flick: new THREE.MeshStandardMaterial({ color: 0x191310, emissive: 0xff6e1f, emissiveIntensity: 0.65 }),
  berry: new THREE.MeshStandardMaterial({ color: 0xef3651, roughness: 0.55 }),
  fox: new THREE.MeshStandardMaterial({ color: 0xf4f0df, roughness: 0.65 }),
  golem: new THREE.MeshStandardMaterial({ color: 0x7d746c, roughness: 0.78 }),
};

const world = new THREE.Group();
const interactives = [];
const solids = [];
const updrafts = [];
scene.add(world);

const player = {
  pos: new THREE.Vector3(-26, 3.5, 22),
  vel: new THREE.Vector3(),
  radius: 0.75,
  mesh: new THREE.Group(),
};

function add(mesh, parent = world) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function box(w, h, d, mat, x, y, z) {
  const mesh = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  mesh.position.set(x, y, z);
  solids.push({ mesh, radius: Math.max(w, d) * 0.52, half: new THREE.Vector3(w / 2, h / 2, d / 2) });
  return mesh;
}

function cylinder(r, h, mat, x, y, z, segments = 16) {
  const mesh = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), mat));
  mesh.position.set(x, y, z);
  return mesh;
}

function cone(r, h, mat, x, y, z, segments = 16) {
  const mesh = add(new THREE.Mesh(new THREE.ConeGeometry(r, h, segments), mat));
  mesh.position.set(x, y, z);
  return mesh;
}

function makeWorld() {
  const hemi = new THREE.HemisphereLight(0xfff0c6, 0x556a85, 1.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffc56d, 3.1);
  sun.position.set(-22, 44, 28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  scene.add(sun);
  state.sun = sun;

  const island = add(new THREE.Mesh(new THREE.CylinderGeometry(47, 34, 7, 56), mats.snow));
  island.position.y = -2.8;
  island.receiveShadow = true;

  const underside = cone(36, 30, mats.darkRock, 0, -22, 0, 48);
  underside.rotation.y = 0.2;

  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 9 + Math.random() * 38;
    const y = groundHeight(r) - 0.05;
    const p = Math.random();
    if (p < 0.55) {
      const t = cone(0.7 + Math.random() * 0.65, 2.4 + Math.random() * 2.8, mats.ice, Math.cos(a) * r, y + 1.2, Math.sin(a) * r, 6);
      t.rotation.set(Math.random() * 0.18, a, Math.random() * 0.18);
    } else {
      const stone = box(1.2 + Math.random() * 1.8, 0.7 + Math.random() * 1.2, 1.2 + Math.random() * 1.8, mats.rock, Math.cos(a) * r, y + 0.4, Math.sin(a) * r);
      stone.rotation.y = a;
    }
  }

  makeForge();
  makeAshPit();
  makeWindmill();
  makeCave();
  makeRiver();
  makeScaffolds();
  makeCreatures();
  makePlayer();
}

function makeForge() {
  cylinder(8.5, 34, mats.darkRock, 0, 13.5, 0, 28);
  cylinder(5.3, 37, mats.rock, 0, 15, 0, 28);
  const mouth = box(8, 5, 3.2, mats.darkRock, 0, 4.7, 5.7);
  mouth.name = "forge-mouth";
  for (let i = 0; i < 3; i++) {
    const ring = cylinder(9.4 + i * 0.5, 0.8, mats.rock, 0, 1.4 + i * 9, 0, 28);
    ring.scale.y = 0.35;
  }
  const heart = cylinder(2.25, 1.8, mats.ice, 0, 31.8, 0, 18);
  heart.name = "forgeHeart";
  interactives.push({ id: "forge", mesh: heart, radius: 4.5 });

  for (const [x, z] of [[7, -1], [-7, 1], [1, -7], [-1, 7]]) {
    const vent = cylinder(1.4, 0.3, mats.ember, x, groundHeight(Math.hypot(x, z)) + 0.2, z, 16);
    updrafts.push({ x, z, radius: 4.3, strength: 17 });
    vent.scale.y = 0.25;
  }
}

function makeAshPit() {
  cylinder(5.8, 0.25, mats.darkRock, -26, groundHeight(34) + 0.08, 22, 24);
  box(4.2, 2.4, 1.2, mats.ice, -20, groundHeight(30) + 1.2, 20);
}

function makeWindmill() {
  const base = cylinder(2.9, 13, mats.wood, 28, groundHeight(34) + 6.4, -20, 8);
  base.rotation.y = 0.38;
  const hub = cylinder(1.1, 1.1, mats.rock, 28, groundHeight(34) + 13.5, -17.2, 16);
  hub.rotation.x = Math.PI / 2;
  state.windmillHub = hub;
  const bladeGroup = new THREE.Group();
  bladeGroup.position.copy(hub.position);
  bladeGroup.rotation.x = Math.PI / 2;
  world.add(bladeGroup);
  state.blades = bladeGroup;
  for (let i = 0; i < 4; i++) {
    const blade = add(new THREE.Mesh(new THREE.BoxGeometry(1.05, 8.8, 0.42), mats.wood), bladeGroup);
    blade.position.y = 4.4;
    blade.rotation.z = (Math.PI / 2) * i;
    blade.userData.platform = true;
  }
  const gearIce = box(5.5, 4, 2.2, mats.ice, 25.7, groundHeight(32) + 2, -18.2);
  gearIce.name = "windmillIce";
  interactives.push({ id: "windmillIce", mesh: gearIce, radius: 5 });
  const ledges = [
    [31, 3.2, -21],
    [32, 6.1, -17.4],
    [28, 9.1, -14.5],
    [24.5, 12.1, -17.3],
    [26.6, 15.1, -21.5],
  ];
  for (const [x, y, z] of ledges) {
    const ledge = box(4.1, 0.38, 2.8, mats.wood, x, y, z);
    ledge.rotation.y = Math.random() * 0.8;
  }
  addEmber("zephyr", 28, groundHeight(34) + 17.8, -17, "Zephyr Ember");
}

function makeCave() {
  for (let i = 0; i < 9; i++) {
    const a = -2.4 + i * 0.18;
    box(3, 5 + Math.random() * 3, 2.4, mats.darkRock, Math.cos(a) * 36, groundHeight(36) + 2.4, Math.sin(a) * 36);
  }
  const beetle = new THREE.Group();
  beetle.position.set(-34, groundHeight(39) + 1.2, -18);
  add(new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 10), new THREE.MeshStandardMaterial({ color: 0x263447, roughness: 0.8 })), beetle);
  add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 10), new THREE.MeshStandardMaterial({ color: 0x344a66, roughness: 0.8 })), beetle).position.set(1.9, 0.15, 0);
  world.add(beetle);
  state.beetle = beetle;
  interactives.push({ id: "beetle", mesh: beetle, radius: 4 });
  addEmber("terra", -25, groundHeight(31) + 2.5, -9, "Terra Ember").visible = false;

  for (const [x, z] of [[-8, -28], [-12, -31], [-5, -33], [-16, -25]]) {
    const berry = cylinder(0.45, 0.7, mats.berry, x, groundHeight(Math.hypot(x, z)) + 0.4, z, 10);
    berry.name = "berry";
    interactives.push({ id: "berry", mesh: berry, radius: 2.3 });
  }
}

function makeRiver() {
  const riverMat = new THREE.MeshStandardMaterial({ color: 0x6db9e8, roughness: 0.25, transparent: true, opacity: 0.82 });
  const river = add(new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 32), riverMat));
  river.position.set(18, groundHeight(23) + 0.12, 13);
  river.rotation.y = -0.42;
  const floe = cylinder(3.1, 0.45, mats.ice, 24, groundHeight(29) + 0.4, 24, 12);
  state.floe = floe;
  for (let i = 0; i < 3; i++) {
    const fox = makeFox(23 + i * 1.2, groundHeight(31) + 0.85, 23.2 - i * 0.8, 0.55);
    fox.name = "strandedFox";
  }
  for (const [x, z] of [[13, 5], [16, 6.5], [11, 8.5]]) {
    const log = cylinder(0.55, 4.8, mats.wood, x, groundHeight(Math.hypot(x, z)) + 0.75, z, 10);
    log.rotation.z = Math.PI / 2;
    log.name = "log";
    interactives.push({ id: "log", mesh: log, radius: 2.6 });
  }
  addEmber("aqua", 30, groundHeight(37) + 1.8, 16, "Aqua Ember").visible = false;
}

function makeScaffolds() {
  const steps = [
    [6, 5, 8], [9, 7, 5], [7, 10, 1], [3, 13, -3], [-2, 16, -5], [-5, 19, -2],
    [-3, 22, 4], [2, 25, 5], [0, 29, 2],
  ];
  for (const [x, y, z] of steps) {
    box(4.2, 0.42, 3.2, mats.wood, x, y, z);
  }
  const brittle = box(4.4, 3.5, 1.1, mats.rock, 8, 8.6, 5);
  brittle.name = "brittleWall";
  interactives.push({ id: "brittleWall", mesh: brittle, radius: 4 });
  for (let i = 0; i < 3; i++) {
    const ice = box(3.8, 2.6, 1.1, mats.ice, -2 + i * 1.6, 21.6 + i * 2.6, 5.4);
    ice.name = "ascentIce";
    interactives.push({ id: "ascentIce", mesh: ice, radius: 3.5 });
  }
}

function makeCreatures() {
  const rust = new THREE.Group();
  rust.position.set(-21, groundHeight(31) + 1.5, 16);
  add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.7, 1.4), mats.golem), rust);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.4), mats.golem), rust).position.y = 2.1;
  world.add(rust);
  interactives.push({ id: "rust", mesh: rust, radius: 4 });

  makeFox(31, groundHeight(36) + 0.7, 14, 0.75);
}

function makeFox(x, y, z, s) {
  const fox = new THREE.Group();
  fox.position.set(x, y, z);
  fox.scale.setScalar(s);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.75), mats.fox), fox);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.05, 4), mats.fox), fox).position.set(-0.9, 0.12, 0);
  fox.rotation.y = -0.5;
  world.add(fox);
  return fox;
}

function addEmber(id, x, y, z, label) {
  const ember = new THREE.Group();
  const flame = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), mats.ember), ember);
  flame.position.y = 0.5;
  const light = new THREE.PointLight(0xff8a22, 2.2, 9);
  light.position.y = 1.2;
  ember.add(light);
  ember.position.set(x, y, z);
  ember.name = id;
  ember.userData.label = label;
  world.add(ember);
  interactives.push({ id: `ember:${id}`, mesh: ember, radius: 3 });
  return ember;
}

function makePlayer() {
  const body = add(new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 14), mats.flick), player.mesh);
  body.scale.y = 1.18;
  const flame = add(new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.2, 8), mats.ember), player.mesh);
  flame.position.y = 1.05;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff2c2 });
  add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), eyeMat), player.mesh).position.set(0.22, 0.22, -0.58);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), eyeMat), player.mesh).position.set(-0.22, 0.22, -0.58);
  const light = new THREE.PointLight(0xff8122, 3, 12);
  light.position.y = 1.2;
  player.mesh.add(light);
  world.add(player.mesh);
}

function groundHeight(r) {
  return 0.05 + Math.max(0, (24 - r) * 0.09);
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

function start(mobile) {
  state.started = true;
  state.mobile = mobile;
  ui.start.classList.add("hidden");
  ui.hud.classList.remove("hidden");
  ui.mobileControls.classList.toggle("hidden", !mobile);
  ui.desktopHelp.classList.toggle("hidden", mobile);
  toast(mobile ? "Touch controls ready. Guide Flick toward Rust." : "Controls ready. Find Rust by the ash pit.");
}

function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.remove("hidden");
  state.toastTimer = 4;
}

function setPrompt(text) {
  state.prompt = text;
  ui.prompt.textContent = text;
  ui.prompt.classList.toggle("hidden", !text);
}

function has(id) {
  return state.embers.has(id);
}

function updateQuest() {
  let text = "Gather the three Core Embers in any order.";
  if (!state.started) text = "Choose controls to begin.";
  else if (state.embers.size === 0) text = "Rust says the Core Embers are scattered across the island.";
  if (!has("zephyr") && state.windmillUnfrozen) text = "Climb the windmill blades to claim the Zephyr Ember.";
  if (!has("terra") && state.berries > 0 && !state.beetleLured) text = `Carry Sun-Berries to the cave beetle. Berries: ${state.berries}/3`;
  if (!has("aqua") && state.logsPushed > 0 && !state.foxesSaved) text = `Push logs into the frozen river. Logs: ${state.logsPushed}/3`;
  if (state.embers.size === 3) text = "All Embers burn bright. Ascend the Great Forge.";
  if (state.forgeLit) text = "The island is warm again.";
  ui.quest.textContent = text;
  ui.emberCount.textContent = `${state.embers.size}/3`;
  [...ui.emberDots.children].forEach((dot, i) => dot.classList.toggle("on", i < state.embers.size));
}

function nearby() {
  let best = null;
  let bestD = Infinity;
  for (const item of interactives) {
    if (!item.mesh.visible) continue;
    const d = item.mesh.position.distanceTo(player.pos);
    if (d < item.radius && d < bestD) {
      best = item;
      bestD = d;
    }
  }
  return best;
}

function interact(item) {
  if (!item) return;
  if (item.id === "rust") {
    toast("Rust: Three Core Embers. Windmill, cave, river. Bring them home before sunset.");
  }
  if (item.id === "windmillIce") {
    item.mesh.visible = false;
    state.windmillUnfrozen = true;
    toast("The frozen gears thaw. The windmill begins to turn.");
  }
  if (item.id === "berry") {
    item.mesh.visible = false;
    state.berries += 1;
    toast(`Sun-Berry collected. ${state.berries}/3`);
  }
  if (item.id === "beetle") {
    if (state.berries >= 3) {
      state.beetleLured = true;
      state.beetle.position.set(-25, groundHeight(27) + 1.2, -9);
      const terra = world.getObjectByName("terra");
      terra.visible = true;
      toast("The beetle sneezes out the Terra Ember.");
    } else {
      toast("The Ice-Beetle sniffs the air. It wants three spicy Sun-Berries.");
    }
  }
  if (item.id === "log") {
    item.mesh.position.x += 3.2;
    item.mesh.position.z += 3.4;
    item.mesh.rotation.y += 0.7;
    item.mesh.visible = false;
    state.logsPushed += 1;
    if (state.logsPushed >= 3) {
      state.foxesSaved = true;
      world.getObjectByName("aqua").visible = true;
      toast("The foxes cross safely. The Aqua Ember warms the shore.");
    } else {
      toast(`Log shoved into place. ${state.logsPushed}/3`);
    }
  }
  if (item.id === "brittleWall") {
    if (has("terra")) {
      item.mesh.visible = false;
      toast("Terra dash shatters the brittle wall.");
    } else {
      toast("This ruined wall needs a stronger dash.");
    }
  }
  if (item.id === "ascentIce") {
    item.mesh.visible = false;
    toast("Heat melts the ice barricade.");
  }
  if (item.id.startsWith("ember:")) {
    const id = item.id.split(":")[1];
    state.embers.add(id);
    item.mesh.visible = false;
    if (id === "zephyr") toast("Zephyr Ember gained. Hold jump while falling to glide.");
    if (id === "terra") toast("Terra Ember gained. Dash can break brittle stone.");
    if (id === "aqua") toast("Aqua Ember gained. Flick burns brighter.");
  }
  if (item.id === "forge") {
    if (state.embers.size === 3) lightForge();
    else toast("The iron heart is too cold. Three Core Embers are needed.");
  }
}

function lightForge() {
  state.forgeLit = true;
  ui.ending.classList.remove("hidden");
  mats.snow.color.set(0x65bd72);
  mats.ember.emissiveIntensity = 3.2;
}

function updateControls(dt) {
  if (!state.mobile) {
    input.move.set(0, 0);
    if (input.keys.has("KeyW")) input.move.y += 1;
    if (input.keys.has("KeyS")) input.move.y -= 1;
    if (input.keys.has("KeyA")) input.move.x -= 1;
    if (input.keys.has("KeyD")) input.move.x += 1;
    input.jump = input.keys.has("Space");
    input.dash = input.keys.has("ShiftLeft") || input.keys.has("ShiftRight");
    input.heat = input.keys.has("KeyE");
  }
  state.yaw -= input.look.x * 0.004;
  state.pitch = THREE.MathUtils.clamp(state.pitch - input.look.y * 0.003, 0.12, 0.95);
  input.look.multiplyScalar(0.72 ** (dt * 60));
}

function updatePlayer(dt) {
  const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw)).normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const wish = new THREE.Vector3();
  if (input.move.lengthSq() > 1) input.move.normalize();
  wish.addScaledVector(forward, input.move.y);
  wish.addScaledVector(right, input.move.x);
  if (wish.lengthSq() > 0.001) wish.normalize();

  const speed = has("aqua") ? 10 : 8;
  player.vel.x = THREE.MathUtils.lerp(player.vel.x, wish.x * speed, 1 - Math.pow(0.001, dt));
  player.vel.z = THREE.MathUtils.lerp(player.vel.z, wish.z * speed, 1 - Math.pow(0.001, dt));

  if (input.dash && has("terra") && wish.lengthSq() > 0.1 && !state.dashLock) {
    player.vel.addScaledVector(wish, 18);
    state.dashLock = 0.42;
  }
  state.dashLock = Math.max(0, (state.dashLock || 0) - dt);

  if (input.jump && state.grounded && !state.jumpLock) {
    player.vel.y = has("zephyr") ? 11.2 : 9.2;
    state.grounded = false;
    state.jumpLock = 0.2;
  }
  state.jumpLock = Math.max(0, (state.jumpLock || 0) - dt);

  let gravity = -24;
  state.onUpdraft = false;
  for (const u of updrafts) {
    const d = Math.hypot(player.pos.x - u.x, player.pos.z - u.z);
    if (d < u.radius && player.pos.y > 2) {
      player.vel.y += u.strength * dt;
      state.onUpdraft = true;
    }
  }
  if (input.jump && has("zephyr") && player.vel.y < -2) gravity = -7;
  player.vel.y += gravity * dt;

  player.pos.addScaledVector(player.vel, dt);
  const r = Math.hypot(player.pos.x, player.pos.z);
  const floor = groundHeight(r) + 0.75;
  if (r > 45) {
    player.pos.multiplyScalar(45 / r);
  }
  if (player.pos.y < floor) {
    player.pos.y = floor;
    player.vel.y = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }

  for (const s of solids) {
    if (!s.mesh.visible) continue;
    const dx = player.pos.x - s.mesh.position.x;
    const dz = player.pos.z - s.mesh.position.z;
    const minX = s.half.x + player.radius;
    const minZ = s.half.z + player.radius;
    if (Math.abs(dx) < minX && Math.abs(dz) < minZ && Math.abs(player.pos.y - s.mesh.position.y) < s.half.y + 1.2) {
      if (Math.abs(dx / minX) > Math.abs(dz / minZ)) player.pos.x = s.mesh.position.x + Math.sign(dx || 1) * minX;
      else player.pos.z = s.mesh.position.z + Math.sign(dz || 1) * minZ;
    }
    const top = s.mesh.position.y + s.half.y + 0.8;
    if (Math.abs(dx) < s.half.x + 0.5 && Math.abs(dz) < s.half.z + 0.5 && player.pos.y > s.mesh.position.y && player.pos.y < top && player.vel.y <= 0) {
      player.pos.y = top;
      player.vel.y = 0;
      state.grounded = true;
    }
  }

  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = state.yaw + Math.PI;
}

function updateScene(dt) {
  state.time += dt;
  const sunset = Math.min(1, state.time / 2400);
  scene.background = new THREE.Color().lerpColors(new THREE.Color(0x99d8ef), new THREE.Color(0x33234e), sunset);
  scene.fog.color.copy(scene.background);
  state.sun.position.set(-22 + sunset * 38, 44 - sunset * 24, 28 - sunset * 10);
  state.sun.color.set(new THREE.Color().lerpColors(new THREE.Color(0xffd49a), new THREE.Color(0xff7b42), sunset));

  if (state.blades && state.windmillUnfrozen) state.blades.rotation.z += dt * 0.85;
  world.traverse((o) => {
    if (o.name && ["zephyr", "terra", "aqua"].includes(o.name)) {
      o.rotation.y += dt * 1.8;
      o.position.y += Math.sin(state.time * 3 + o.position.x) * 0.004;
    }
  });

  const item = nearby();
  if (item) {
    const map = {
      rust: "E: Talk to Rust",
      windmillIce: "E: Heat the frozen gears",
      berry: "E: Pick Sun-Berry",
      beetle: "E: Offer Sun-Berries",
      log: "E: Push log",
      brittleWall: "Shift dash or E: Break brittle wall",
      ascentIce: "E: Melt ice",
      forge: "E: Reignite the Great Forge",
    };
    if (item.id.startsWith("ember:")) setPrompt(`E: Absorb ${item.mesh.userData.label}`);
    else setPrompt(state.mobile ? map[item.id]?.replace("E:", "Heat:") : map[item.id] || "");
    if (input.heat || (item.id === "brittleWall" && input.dash)) {
      interact(item);
      input.heat = false;
    }
  } else {
    setPrompt("");
  }

  state.toastTimer -= dt;
  if (state.toastTimer <= 0) ui.toast.classList.add("hidden");
  updateQuest();
}

function updateCamera(dt) {
  const dist = innerWidth < 700 ? 13.5 : 15.5;
  const height = dist * Math.sin(state.pitch);
  const flat = dist * Math.cos(state.pitch);
  const desired = new THREE.Vector3(
    player.pos.x - Math.sin(state.yaw) * flat,
    player.pos.y + height,
    player.pos.z - Math.cos(state.yaw) * flat
  );
  camera.position.lerp(desired, 1 - Math.pow(0.002, dt));
  camera.lookAt(player.pos.x, player.pos.y + 1.2, player.pos.z);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  if (state.started && !state.forgeLit) {
    updateControls(dt);
    updatePlayer(dt);
    updateScene(dt);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

function setupInput() {
  addEventListener("keydown", (e) => input.keys.add(e.code));
  addEventListener("keyup", (e) => input.keys.delete(e.code));
  addEventListener("pointerdown", (e) => {
    if (e.target.closest("button") || state.mobile) return;
    state.pointerDown = true;
  });
  addEventListener("pointerup", () => (state.pointerDown = false));
  addEventListener("pointermove", (e) => {
    if (!state.pointerDown || state.mobile) return;
    input.look.x += e.movementX;
    input.look.y += e.movementY;
  });

  document.querySelector("#desktopStart").addEventListener("click", () => start(false));
  document.querySelector("#mobileStart").addEventListener("click", () => start(true));
  document.querySelector("#restart").addEventListener("click", () => location.reload());

  setupStick(document.querySelector("#moveStick"), (x, y) => input.move.set(x, y));
  setupLookPad(document.querySelector("#lookPad"));
  bindHold("#mobileJump", (v) => (input.jump = v));
  bindHold("#mobileDash", (v) => (input.dash = v));
  bindTap("#mobileHeat", () => (input.heat = true));
}

function bindHold(sel, cb) {
  const el = document.querySelector(sel);
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    cb(true);
  });
  el.addEventListener("pointerup", () => cb(false));
  el.addEventListener("pointercancel", () => cb(false));
}

function bindTap(sel, cb) {
  const el = document.querySelector(sel);
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    cb();
  });
}

function setupStick(el, cb) {
  const knob = el.firstElementChild;
  let active = false;
  const reset = () => {
    active = false;
    knob.style.transform = "translate(0, 0)";
    cb(0, 0);
  };
  el.addEventListener("pointerdown", (e) => {
    active = true;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!active) return;
    const r = el.getBoundingClientRect();
    const x = THREE.MathUtils.clamp((e.clientX - r.left - r.width / 2) / 48, -1, 1);
    const y = THREE.MathUtils.clamp(-(e.clientY - r.top - r.height / 2) / 48, -1, 1);
    knob.style.transform = `translate(${x * 34}px, ${-y * 34}px)`;
    cb(x, y);
  });
  el.addEventListener("pointerup", reset);
  el.addEventListener("pointercancel", reset);
}

function setupLookPad(el) {
  let last = null;
  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    last = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener("pointermove", (e) => {
    if (!last) return;
    input.look.x += (e.clientX - last.x) * 0.7;
    input.look.y += (e.clientY - last.y) * 0.7;
    last = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener("pointerup", () => (last = null));
  el.addEventListener("pointercancel", () => (last = null));
}

addEventListener("resize", resize);
makeWorld();
setupInput();
resize();
player.mesh.position.copy(player.pos);
updateCamera(1);
animate();
