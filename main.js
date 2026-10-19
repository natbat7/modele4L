/*====================================================
 CONFIGURATEUR RENAULT 4L — VERSION PRO BLINDÉE
 Association C'est Beau 2 Rêver · N&C 2028
====================================================*/

const container = document.getElementById("canvas-container");
const loadingOverlay = document.getElementById("loading-overlay");
const loaderBarFill = document.getElementById("loader-bar-fill");
const loaderText = document.getElementById("loader-text");
const hintPill = document.getElementById("hint-pill");

// 1. SCÈNE & CAMÉRA
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
  0.1,
  1000
);
camera.position.set(3.5, 2.0, 4.0);

// 2. RENDERER
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

// 3. CONTRÔLES CAMÉRA
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 1.6;
controls.maxDistance = 8.5;
controls.target.set(0, 0.55, 0);

// 4. LUMIÈRES
const ambient = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambient);

const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.5);
sunLight.position.set(8, 12, 6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xc9a063, 0.4);
fillLight.position.set(-6, 4, -5);
scene.add(fillLight);

// 5. POINTEUR LASER 3D (Cible visuelle sur la carrosserie)
const cursorRingGeo = new THREE.RingGeometry(0.06, 0.085, 32);
const cursorRingMat = new THREE.MeshBasicMaterial({
  color: 0xc8402e,
  side: THREE.DoubleSide,
  depthTest: false,
  transparent: true,
  opacity: 0.9
});
const laserCursor = new THREE.Mesh(cursorRingGeo, cursorRingMat);
laserCursor.visible = false;
laserCursor.renderOrder = 999;
scene.add(laserCursor);

// 6. IMAGE DE FOND POUR LA CAPTURE PHOTO & SOL EN SABLE
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin("anonymous");

const bgImage = new Image();
bgImage.crossOrigin = "anonymous";
bgImage.src = "desert.jpg";
bgImage.onerror = () => {
  bgImage.src = "https://raw.githubusercontent.com/natbat7/modele4L/main/desert.jpg";
};

function createSandFloor(tex) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.encoding = THREE.sRGBEncoding;

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3.8, 64),
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.95,
      metalness: 0
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);
}

texLoader.load(
  "sable.jpg",
  createSandFloor,
  undefined,
  () => texLoader.load("https://raw.githubusercontent.com/natbat7/modele4L/main/sable.jpg", createSandFloor)
);

// 7. CHARGEMENT DE LA RENAULT 4L & PRÉPARATION GÉOMÉTRIQUE POUR DECALGEOMETRY
let car = null;
let paintMaterials = [];
let carBodyMeshes = [];   // Priorité 1 : Carrosserie peinte ("BASE")
let allValidMeshes = [];  // Priorité 2 : Autres pièces extérieures

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

// Pièces intérieures ou pneus à ignorer pour que le rayon touche toujours la carrosserie externe
const IGNORE_MATS = [
  "pneus", "jantes", "centre_roues", "sieges", "tapis",
  "compteur", "Mat.20", "Mat.21", "Mat.11", "retro_inter__0"
];

function onCarLoaded(gltf) {
  car = gltf.scene;
  car.position.set(0, -0.6, 0);
  car.updateMatrixWorld(true);

  car.traverse(function (obj) {
    if (!obj.isMesh || !obj.geometry) return;

    obj.castShadow = true;
    obj.receiveShadow = true;

    // CORRECTIF CRITIQUE POUR DECALGEOMETRY (Three.js r128) :
    // Supprime les attributs UV secondaires (uv2, uv3) présents sur le hayon qui font planter DecalGeometry
    if (obj.geometry.attributes.uv2) obj.geometry.deleteAttribute("uv2");
    if (obj.geometry.attributes.uv3) obj.geometry.deleteAttribute("uv3");
    if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
    obj.geometry.computeBoundingBox();
    obj.geometry.computeBoundingSphere();

    const matName = obj.material ? obj.material.name : "";
    const meshName = obj.name || "";

    // Ignore le plancher intérieur pour ne pas gêner les clics sur les portières
    if (meshName.includes("plancher") || meshName.includes("Plane_1") || meshName.includes("Plane_2")) {
      return;
    }

    if (matName === "BASE") {
      if (!paintMaterials.includes(obj.material)) {
        paintMaterials.push(obj.material);
      }
      carBodyMeshes.push(obj);
      allValidMeshes.push(obj);
    } else if (!IGNORE_MATS.includes(matName)) {
      allValidMeshes.push(obj);
    }
  });

  scene.add(car);
  car.updateMatrixWorld(true);
  if (loadingOverlay) loadingOverlay.classList.add("hidden");
}

function onLoadProgress(xhr) {
  if (xhr.lengthComputable && loaderBarFill && loaderText) {
    const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
    loaderBarFill.style.width = pct + "%";
    loaderText.textContent = "Préparation de la 4L… " + pct + "%";
  }
}

const gltfLoader = new THREE.GLTFLoader();
gltfLoader.setCrossOrigin("anonymous");
gltfLoader.load(
  "renault_4_gtl.glb",
  onCarLoaded,
  onLoadProgress,
  () => {
    gltfLoader.load(
      "https://raw.githubusercontent.com/natbat7/modele4L/main/renault_4_gtl.glb",
      onCarLoaded,
      onLoadProgress
    );
  }
);

// 8. CHANGEMENT DE COULEUR DE LA 4L
window.setCarColor = function (hexColor, btnEl) {
  paintMaterials.forEach((mat) => mat.color.set(hexColor));
  document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
};

// 9. VUES CAMÉRA RAPIDES (ANIMATION FLUIDE)
let camAnim = null;
const CAM_VIEWS = {
  iso:   { pos: [3.5, 2.0, 4.0],  target: [0, 0.55, 0] },
  front: { pos: [0.0, 1.4, 4.0],  target: [0, 0.45, 0] },
  left:  { pos: [4.2, 1.1, 0.0],  target: [0, 0.50, 0] },
  right: { pos: [-4.2, 1.1, 0.0], target: [0, 0.50, 0] },
  back:  { pos: [0.0, 1.5, -4.2], target: [0, 0.55, 0] },
  top:   { pos: [0.0, 4.8, 0.2],  target: [0, 0.50, 0] }
};

window.setCameraView = function (viewKey) {
  const v = CAM_VIEWS[viewKey];
  if (!v) return;
  camAnim = {
    startPos: camera.position.clone(),
    endPos: new THREE.Vector3(...v.pos),
    startTarget: controls.target.clone(),
    endTarget: new THREE.Vector3(...v.target),
    startTime: performance.now(),
    duration: 600
  };
};

// 10. DÉTECTION INTELLIGENTE DE LA CARROSSERIE SOUS LA SOURIS
function getCarHit(ndcX, ndcY) {
  if (!car) return null;
  car.updateMatrixWorld(true);
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

  // 1. On teste d'abord la carrosserie peinte ("BASE") en priorité absolue
  if (carBodyMeshes.length > 0) {
    const bodyHits = raycaster.intersectObjects(carBodyMeshes, true);
    if (bodyHits.length > 0) return bodyHits[0];
  }

  // 2. Sinon on teste le reste des surfaces externes (pare-brise, lunette, pare-chocs)
  const otherHits = raycaster.intersectObjects(allValidMeshes.length ? allValidMeshes : [car], true);
  return otherHits.length > 0 ? otherHits[0] : null;
}

// Calcule la vraie normale orientée vers la caméra (évite les logos collés à l'envers à l'intérieur)
function getOutwardWorldNormal(hit) {
  const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
  normal.transformDirection(hit.object.matrixWorld).normalize();

  const toCamera = new THREE.Vector3().subVectors(camera.position, hit.point).normalize();
  if (normal.dot(toCamera) < 0) {
    normal.negate();
  }
  return normal;
}

// 11. CRÉATION & MISE À JOUR DES LOGOS (AVEC DOUBLE SÉCURITÉ DECAL + PLAN 3D)
const logos = [];
let isDraggingLogo = false;
const currentLogoState = {
  texture: null,
  aspect: 1,
  size: 0.5,
  rotation: 0
};

function buildLogoGeometry(targetMesh, position, normal, size, rotation, aspect) {
  const helper = new THREE.Object3D();
  helper.position.copy(position);
  helper.lookAt(new THREE.Vector3().addVectors(position, normal));
  helper.rotation.z = rotation;

  const w = size;
  const h = size / (aspect || 1);
  // Profondeur de projection généreuse (size * 1.5) pour bien épouser les courbes de la 4L
  const decalSize = new THREE.Vector3(w, h, Math.max(size * 1.5, 0.6));

  try {
    const geom = new THREE.DecalGeometry(targetMesh, position, helper.rotation, decalSize);
    if (geom.attributes.position && geom.attributes.position.count > 0) {
      return { geometry: geom, isFallbackPlane: false, helperRotation: helper.rotation.clone() };
    }
    geom.dispose();
  } catch (err) {
    console.warn("Repli sur sticker 3D tangent :", err);
  }

  // SÉCURITÉ : Si DecalGeometry renvoie 0 sommet, on crée une plaque 3D tangente ultra-fine
  const planeGeo = new THREE.PlaneGeometry(w, h, 4, 4);
  return { geometry: planeGeo, isFallbackPlane: true, helperRotation: helper.rotation.clone() };
}

function placeLogo(hit) {
  if (!currentLogoState.texture || !hit) return;

  const position = hit.point.clone();
  const normal = getOutwardWorldNormal(hit);

  const built = buildLogoGeometry(
    hit.object,
    position,
    normal,
    currentLogoState.size,
    currentLogoState.rotation,
    currentLogoState.aspect
  );

  const material = new THREE.MeshPhongMaterial({
    map: currentLogoState.texture,
    transparent: true,
    alphaTest: 0.03,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -4,
    shininess: 30
  });

  const logoMesh = new THREE.Mesh(built.geometry, material);
  if (built.isFallbackPlane) {
    logoMesh.position.copy(position).addScaledVector(normal, 0.004);
    logoMesh.rotation.copy(built.helperRotation);
  }
  logoMesh.renderOrder = 10 + logos.length;

  logoMesh.userData = {
    target: hit.object,
    position: position.clone(),
    normal: normal.clone(),
    aspect: currentLogoState.aspect
  };

  scene.add(logoMesh);
  logos.push(logoMesh);
}

function updateLastLogo() {
  if (logos.length === 0) return;

  const lastLogo = logos[logos.length - 1];
  const data = lastLogo.userData;

  const built = buildLogoGeometry(
    data.target,
    data.position,
    data.normal,
    currentLogoState.size,
    currentLogoState.rotation,
    data.aspect
  );

  lastLogo.geometry.dispose();
  lastLogo.geometry = built.geometry;

  if (built.isFallbackPlane) {
    lastLogo.position.copy(data.position).addScaledVector(data.normal, 0.004);
    lastLogo.rotation.copy(built.helperRotation);
  } else {
    lastLogo.position.set(0, 0, 0);
    lastLogo.rotation.set(0, 0, 0);
  }
}

// 12. IMPORTATION & RECADRAGE (CROPPER.JS) + POSE AUTOMATIQUE DE TEST
let cropper = null;
const cropModal = document.getElementById("cropModal");
const imageToCrop = document.getElementById("imageToCrop");

document.getElementById("logoInput").addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    imageToCrop.src = e.target.result;
    cropModal.style.display = "flex";
    if (cropper) cropper.destroy();
    cropper = new Cropper(imageToCrop, {
      viewMode: 1,
      autoCropArea: 0.9,
      background: false
    });
  };
  reader.readAsDataURL(file);
  event.target.value = "";
});

document.getElementById("cancelCropBtn").addEventListener("click", function () {
  cropModal.style.display = "none";
  if (cropper) cropper.destroy();
});

document.getElementById("applyCropBtn").addEventListener("click", function () {
  if (!cropper) return;
  const croppedCanvas = cropper.getCroppedCanvas();
  const croppedDataUrl = croppedCanvas.toDataURL("image/png");

  currentLogoState.aspect = croppedCanvas.width / (croppedCanvas.height || 1);

  const loadedTex = new THREE.Texture(croppedCanvas);
  loadedTex.encoding = THREE.sRGBEncoding;
  loadedTex.needsUpdate = true;
  currentLogoState.texture = loadedTex;

  document.getElementById("uploadLabel").innerText = "✅ Logo actif (Cliquez sur la 4L)";
  if (hintPill) {
    hintPill.textContent = "🎯 Anneau rouge = cible · Cliquez sur la 4L ou appuyez sur ESPACE pour coller le logo !";
  }
  cropModal.style.display = "none";
  cropper.destroy();
  window.focus();

  // Pose immédiatement un premier aperçu au centre de la vue actuelle pour confirmer que le logo marche !
  if (logos.length === 0 && car) {
    const centerHit = getCarHit(0, 0);
    if (centerHit) {
      placeLogo(centerHit);
      if (hintPill) {
        hintPill.textContent = "✅ Logo posé ! Cliquez ailleurs sur la 4L (ou appuyez sur ESPACE) pour le placer où vous voulez.";
      }
    }
  }
});

// 13. GESTION DU CLIC, DU GLISSER, DU LASER ET DE LA TOUCHE ESPACE
let lastMouseNDC = { x: 0, y: 0 };
let ptrDownClient = { x: 0, y: 0 };

function updateMouseNDC(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  lastMouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  lastMouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  mouse.set(lastMouseNDC.x, lastMouseNDC.y);
}

// Écoute globale sur window pour que la touche Espace connaisse toujours la position de la souris
window.addEventListener("pointermove", function (event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const insideCanvas =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (!insideCanvas) {
    laserCursor.visible = false;
    return;
  }

  updateMouseNDC(event);

  const hit = getCarHit(lastMouseNDC.x, lastMouseNDC.y);
  if (hit && currentLogoState.texture) {
    const n = getOutwardWorldNormal(hit);
    laserCursor.position.copy(hit.point).addScaledVector(n, 0.008);
    laserCursor.lookAt(new THREE.Vector3().addVectors(laserCursor.position, n));
    const s = currentLogoState.size * 0.5;
    laserCursor.scale.set(s, s, s);
    laserCursor.visible = true;
  } else {
    laserCursor.visible = false;
  }

  if (isDraggingLogo && hit && logos.length > 0) {
    const lastLogo = logos[logos.length - 1];
    lastLogo.userData.target = hit.object;
    lastLogo.userData.position.copy(hit.point);
    lastLogo.userData.normal.copy(getOutwardWorldNormal(hit));
    updateLastLogo();
  }
});

renderer.domElement.addEventListener("pointerdown", function (event) {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  ptrDownClient = { x: event.clientX, y: event.clientY };
  updateMouseNDC(event);

  if (!currentLogoState.texture || !car) return;

  // Si on clique sur le dernier logo posé, on active son déplacement
  if (logos.length > 0) {
    raycaster.setFromCamera(mouse, camera);
    const lastLogo = logos[logos.length - 1];
    const logoHit = raycaster.intersectObject(lastLogo);
    if (logoHit.length > 0) {
      isDraggingLogo = true;
      controls.enabled = false;
    }
  }
});

renderer.domElement.addEventListener("pointerup", function (event) {
  if (isDraggingLogo) {
    isDraggingLogo = false;
    controls.enabled = true;
    return;
  }

  const moveDist = Math.hypot(event.clientX - ptrDownClient.x, event.clientY - ptrDownClient.y);
  if (moveDist > 18) return; // L'utilisateur a tourné la caméra

  updateMouseNDC(event);
  if (!currentLogoState.texture) {
    if (hintPill) hintPill.textContent = "⚠️ Importez d'abord un logo avec le bouton rouge en haut à gauche !";
    return;
  }

  const hit = getCarHit(lastMouseNDC.x, lastMouseNDC.y);
  if (hit) {
    // S'il n'y a qu'un seul logo (ex: celui posé par défaut), le clic le déplace à l'endroit cliqué
    if (logos.length === 1) {
      const firstLogo = logos[0];
      firstLogo.userData.target = hit.object;
      firstLogo.userData.position.copy(hit.point);
      firstLogo.userData.normal.copy(getOutwardWorldNormal(hit));
      updateLastLogo();
    } else {
      placeLogo(hit);
    }
    if (hintPill) {
      hintPill.textContent = "✅ Logo placé ! Ajustez sa taille à gauche ou appuyez sur ESPACE pour en ajouter un autre.";
    }
  }
});

// TOUCHE ESPACE : Colle un nouveau logo sous le pointeur (ou au centre de la 4L si la souris est sur le menu)
window.addEventListener("keydown", function (event) {
  if (event.code === "Space" && event.target.tagName !== "INPUT" && event.target.tagName !== "TEXTAREA") {
    event.preventDefault();
    if (!car || !currentLogoState.texture) return;

    const hit = getCarHit(lastMouseNDC.x, lastMouseNDC.y) || getCarHit(0, 0);
    if (hit) {
      placeLogo(hit);
      if (hintPill) {
        hintPill.textContent = "✅ Nouveau logo collé (" + logos.length + ") ! Ajustez sa taille avec le curseur.";
      }
    }
  }
});

// 14. SLIDERS & RÉINITIALISATION
document.getElementById("sizeRange").addEventListener("input", function (e) {
  currentLogoState.size = parseFloat(e.target.value);
  document.getElementById("sizeVal").textContent = currentLogoState.size.toFixed(2);
  updateLastLogo();
});

document.getElementById("rotRange").addEventListener("input", function (e) {
  currentLogoState.rotation = parseFloat(e.target.value);
  const deg = Math.round((currentLogoState.rotation * 180) / Math.PI);
  document.getElementById("rotVal").textContent = deg + "°";
  updateLastLogo();
});

document.getElementById("removeBtn").addEventListener("click", function () {
  logos.forEach((l) => {
    l.geometry.dispose();
    l.material.dispose();
    scene.remove(l);
  });
  logos.length = 0;
  currentLogoState.texture = null;
  laserCursor.visible = false;

  document.getElementById("uploadLabel").innerText = "📷 1. Importer votre logo";
  if (hintPill) hintPill.textContent = "🖱️ Faites glisser pour tourner autour · Importez un logo à gauche";
});

// 15. CAPTURE D'ÉCRAN HAUTE QUALITÉ (SANS L'ANNEAU DE VISÉE)
document.getElementById("screenshotBtn").addEventListener("click", function () {
  const wasCursorVisible = laserCursor.visible;
  laserCursor.visible = false;
  renderer.render(scene, camera);

  try {
    const glCanvas = renderer.domElement;
    const outCanvas = document.createElement("canvas");
    outCanvas.width = glCanvas.width;
    outCanvas.height = glCanvas.height;
    const ctx = outCanvas.getContext("2d");

    if (bgImage.complete && bgImage.naturalWidth > 0) {
      const imgRatio = bgImage.naturalWidth / bgImage.naturalHeight;
      const canvasRatio = outCanvas.width / outCanvas.height;
      let drawW, drawH, offsetX, offsetY;
      if (canvasRatio > imgRatio) {
        drawW = outCanvas.width;
        drawH = outCanvas.width / imgRatio;
        offsetX = 0;
        offsetY = (outCanvas.height - drawH) / 2;
      } else {
        drawH = outCanvas.height;
        drawW = outCanvas.height * imgRatio;
        offsetX = (outCanvas.width - drawW) / 2;
        offsetY = 0;
      }
      ctx.drawImage(bgImage, offsetX, offsetY, drawW, drawH);
    } else {
      ctx.fillStyle = "#12151b";
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    }

    ctx.drawImage(glCanvas, 0, 0);

    ctx.font = "bold 16px 'Oswald', sans-serif";
    ctx.fillStyle = "rgba(243, 239, 228, 0.85)";
    ctx.textAlign = "right";
    ctx.fillText("N&C 4L TROPHY 2028 · C'EST BEAU 2 RÊVER", outCanvas.width - 20, outCanvas.height - 18);

    const dataURL = outCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "Ma-4L-Sponsor-2028.png";
    link.href = dataURL;
    link.click();
  } catch (e) {
    console.error("Erreur lors de la capture :", e);
  } finally {
    laserCursor.visible = wasCursorVisible;
  }
});

// 16. BOUCLE D'ANIMATION & REDIMENSIONNEMENT
function animate(now) {
  requestAnimationFrame(animate);

  if (camAnim) {
    const t = Math.min(1, (now - camAnim.startTime) / camAnim.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(camAnim.startPos, camAnim.endPos, ease);
    controls.target.lerpVectors(camAnim.startTarget, camAnim.endTarget, ease);
    if (t >= 1) camAnim = null;
  }

  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

window.addEventListener("resize", function () {
  if (!container) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});
