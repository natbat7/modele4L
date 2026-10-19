/*====================================================
 CONFIGURATEUR RENAULT 4L — VERSION PRO OPTIMISÉE
 Association C'est Beau 2 Rêver · N&C 2028
====================================================*/

const container = document.getElementById("canvas-container");
const loadingOverlay = document.getElementById("loading-overlay");
const loaderBarFill = document.getElementById("loader-bar-fill");
const loaderText = document.getElementById("loader-text");
const hintPill = document.getElementById("hint-pill");

// 1. SCÈNE & CAMÉRA
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(3.5, 2.0, 4.0);

// 2. RENDERER
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

// 3. CONTRÔLES CAMÉRA
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.02; 
controls.minDistance = 1.8;
controls.maxDistance = 8.5;
controls.target.set(0, 0.55, 0);

// 4. LUMIÈRES
const ambient = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambient);

const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.45);
sunLight.position.set(8, 12, 6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xc9a063, 0.35);
fillLight.position.set(-6, 4, -5);
scene.add(fillLight);

// 5. IMAGE DE FOND POUR LA CAPTURE PHOTO & SOL EN SABLE
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

// 6. CHARGEMENT DE LA RENAULT 4L & FILTRAGE DES SURFACES DE CARROSSERIE
let car = null;
let paintMaterials = [];
let paintableMeshes = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Matériaux exclus du collage de logo (pneus, jantes, intérieur, phares)
const EXCLUDED_MATS = ["pneus", "jantes", "centre_roues", "sieges", "tapis", "compteur", "feux_ar", "Mat.8", "Mat.3"];

function onCarLoaded(gltf) {
  car = gltf.scene;
  car.position.set(0, -0.6, 0);

  car.traverse(function (obj) {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    const matName = obj.material ? obj.material.name : "";
    if (matName === "BASE" && !paintMaterials.includes(obj.material)) {
      paintMaterials.push(obj.material);
    }
    if (!EXCLUDED_MATS.includes(matName)) {
      paintableMeshes.push(obj);
    }
  });

  scene.add(car);
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

// 7. CHANGEMENT DE COULEUR DE LA 4L
window.setCarColor = function (hexColor, btnEl) {
  paintMaterials.forEach((mat) => mat.color.set(hexColor));
  document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
};

// 8. VUES CAMÉRA RAPIDES (ANIMATION FLUIDE)
let camAnim = null;
const CAM_VIEWS = {
  iso:   { pos: [3.5, 2.0, 4.0],  target: [0, 0.55, 0] },
  front: { pos: [0.0, 1.5, 4.2],  target: [0, 0.50, 0] },
  left:  { pos: [4.2, 1.2, 0.0],  target: [0, 0.55, 0] },
  right: { pos: [-4.2, 1.2, 0.0], target: [0, 0.55, 0] },
  back:  { pos: [0.0, 1.6, -4.2], target: [0, 0.55, 0] },
  top:   { pos: [0.0, 4.8, 0.3],  target: [0, 0.50, 0] }
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
    duration: 650
  };
};

// 9. LOGIQUE MULTI-LOGOS (Pose et ajustement du dernier posé)
const logos = [];
const currentLogoState = {
  texture: null,
  size: 0.5,
  rotation: 0
};

function placeLogo(hit) {
  if (!currentLogoState.texture) return;

  const position = hit.point;
  // Récupération sécurisée de la normale (inclinaison de la tôle)
  const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, 1);
  normal.transformDirection(hit.object.matrixWorld);

  const helper = new THREE.Object3D();
  helper.position.copy(position);
  helper.lookAt(new THREE.Vector3().addVectors(position, normal));
  helper.rotation.z = currentLogoState.rotation;

  const geometry = new THREE.DecalGeometry(
    hit.object,
    position,
    helper.rotation,
    new THREE.Vector3(currentLogoState.size, currentLogoState.size, currentLogoState.size)
  );

  const material = new THREE.MeshPhongMaterial({
    map: currentLogoState.texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4
  });

  const logoMesh = new THREE.Mesh(geometry, material);
  
  // On sauvegarde les données pour pouvoir modifier le logo juste après l'avoir posé
  logoMesh.userData = {
    target: hit.object,
    position: position.clone(),
    normal: normal.clone()
  };

  scene.add(logoMesh);
  logos.push(logoMesh);
}

function updateLastLogo() {
  if (logos.length === 0) return;
  
  const lastLogo = logos[logos.length - 1];
  const data = lastLogo.userData;

  const helper = new THREE.Object3D();
  helper.position.copy(data.position);
  helper.lookAt(new THREE.Vector3().addVectors(data.position, data.normal));
  helper.rotation.z = currentLogoState.rotation;

  const newGeometry = new THREE.DecalGeometry(
    data.target,
    data.position,
    helper.rotation,
    new THREE.Vector3(currentLogoState.size, currentLogoState.size, currentLogoState.size)
  );

  lastLogo.geometry.dispose();
  lastLogo.geometry = newGeometry;
}

// 10. IMPORTATION & RECADRAGE (CROPPER.JS)
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
      autoCropArea: 0.85,
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

  const loadedTex = texLoader.load(croppedDataUrl);
  loadedTex.encoding = THREE.sRGBEncoding;
  currentLogoState.texture = loadedTex;

  document.getElementById("uploadLabel").innerText = "✅ Logo prêt (Cliquez sur la 4L)";
  if (hintPill) hintPill.textContent = "👆 Cliquez maintenant n'importe où sur la carrosserie pour poser votre logo !";
  cropModal.style.display = "none";
  cropper.destroy();
});

// 11. GESTION DU CLIC, DU SURVOL ET DE LA TOUCHE ESPACE
function getMousePos(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 - 1
  };
}

let ptrDown = { x: 0, y: 0 };

renderer.domElement.addEventListener("pointerdown", function (event) {
  ptrDown = { x: event.clientX, y: event.clientY };

  if (!currentLogoState.texture) return;
  const pos = getMousePos(event);
  mouse.set(pos.x, pos.y);
  raycaster.setFromCamera(mouse, camera);

  // Vérifie si on clique sur un logo existant pour le déplacer
  for (let i = logos.length - 1; i >= 0; i--) {
    const logoHit = raycaster.intersectObject(logos[i]);
    if (logoHit.length) {
      decal.dragging = true;
      controls.enabled = false;
      return;
    }
  }
});

// Suivi permanent de la souris (indispensable pour la touche Espace)
renderer.domElement.addEventListener("pointermove", function (event) {
  // On met à jour la position de la souris en continu
  const pos = getMousePos(event);
  mouse.set(pos.x, pos.y);

  // Si on est en train de faire glisser un logo
  if (decal.dragging && car) {
    raycaster.setFromCamera(mouse, camera);
    const targets = paintableMeshes.length ? paintableMeshes : [car];
    const hits = raycaster.intersectObjects(targets, true);
    
    if (hits.length > 0) {
      // Met à jour la position du dernier logo manipulé
      if (logos.length > 0) {
        const lastLogo = logos[logos.length - 1];
        lastLogo.userData.target = hits[0].object;
        lastLogo.userData.position.copy(hits[0].point);
        lastLogo.userData.normal.copy(hits[0].face.normal).transformDirection(hits[0].object.matrixWorld);
        updateLastLogo();
      }
    }
  }
});

renderer.domElement.addEventListener("pointerup", function (event) {
  if (decal.dragging) {
    decal.dragging = false;
    controls.enabled = true;
    return;
  }

  // Comportement Tactile / Clic : Pose le logo si on n'a pas bougé la caméra
  const dist = Math.hypot(event.clientX - ptrDown.x, event.clientY - ptrDown.y);
  if (dist > 15 || !car || !currentLogoState.texture) return;

  raycaster.setFromCamera(mouse, camera);
  const targets = paintableMeshes.length ? paintableMeshes : [car];
  const hits = raycaster.intersectObjects(targets, true);
  
  if (hits.length > 0) {
    placeLogo(hits[0]);
    if (hintPill) hintPill.textContent = "✅ Logo collé ! Ajustez sa taille, ou visez ailleurs et appuyez sur ESPACE.";
  }
});

// --- NOUVEAUTÉ : POSE DU LOGO AVEC LA TOUCHE ESPACE ---
window.addEventListener("keydown", function (event) {
  // Si la touche appuyée est "Espace" (code 32)
  if (event.code === "Space") {
    event.preventDefault(); // Empêche la page de défiler vers le bas

    if (!car || !currentLogoState.texture) return;

    // Utilise la dernière position connue de la souris (mise à jour via pointermove)
    raycaster.setFromCamera(mouse, camera);
    const targets = paintableMeshes.length ? paintableMeshes : [car];
    const hits = raycaster.intersectObjects(targets, true);
    
    if (hits.length > 0) {
      placeLogo(hits[0]);
      if (hintPill) hintPill.textContent = "✅ Logo collé ! Ajustez sa taille, ou visez ailleurs et appuyez sur ESPACE.";
    }
  }
});

// 12. SLIDERS & RÉINITIALISATION
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
  // Supprime tous les logos présents sur la voiture
  logos.forEach(l => {
    l.geometry.dispose();
    l.material.dispose();
    scene.remove(l);
  });
  logos.length = 0;
  currentLogoState.texture = null;

  document.getElementById("uploadLabel").innerText = "📷 1. Importer votre logo";
  if (hintPill) hintPill.textContent = "🖱️ Faites glisser pour tourner autour · Cliquez sur la 4L après import du logo";
});

// 13. CAPTURE D'ÉCRAN HAUTE QUALITÉ (AVEC LE FOND SAHARA INCLUS)
document.getElementById("screenshotBtn").addEventListener("click", function () {
  renderer.render(scene, camera);
  try {
    const glCanvas = renderer.domElement;
    const outCanvas = document.createElement("canvas");
    outCanvas.width = glCanvas.width;
    outCanvas.height = glCanvas.height;
    const ctx = outCanvas.getContext("2d");

    // Dessine le désert en fond
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

    // Superpose le rendu 3D
    ctx.drawImage(glCanvas, 0, 0);

    // Ajoute un filigrane de l'association
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
  }
});

// 14. BOUCLE D'ANIMATION & REDIMENSIONNEMENT
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
