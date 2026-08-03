/*====================================================
 CONFIGURATEUR RENAULT 4L - VERSION PRO SÉPARÉE
====================================================*/

const container = document.getElementById("canvas-container");

// SCENE
const scene = new THREE.Scene();

// CAMERA
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(3.5, 2, 4);

// RENDERER (Permet la capture photo sans le menu)
const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    preserveDrawingBuffer: true 
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

// CONTROLS
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0.6, 0);

// LUMIERES
const ambient = new THREE.AmbientLight(0xffffff, 0.8); 
scene.add(ambient);
const light = new THREE.DirectionalLight(0xffffff, 1.5); 
light.position.set(8, 10, 5);
light.castShadow = true;
scene.add(light);

// SOL EN SABLE (SOCLE ROND)
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');
texLoader.load(
    "https://raw.githubusercontent.com/natbat7/modele4L/main/sable.jpg", 
    function(texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 10);
        texture.encoding = THREE.sRGBEncoding;

        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(3.5, 64),
            new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 1,
                metalness: 0
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.1; 
        floor.receiveShadow = true;
        scene.add(floor);
    }
);

// VARIABLES
let car = null;
let texture = null;
let currentLogo = null;

const decal = {
    target: null,
    texture: null,
    position: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    size: 0.5,
    rotation: 0,
    dragging: false
};
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// CHARGEMENT 4L
const loader = new THREE.GLTFLoader();
loader.setCrossOrigin('anonymous');
loader.load(
    "https://raw.githubusercontent.com/natbat7/modele4L/main/renault_4_gtl.glb",
    function(gltf){
        car = gltf.scene;
        car.position.set(0, -0.6, 0);
        
        car.traverse(function(obj){
            if(obj.isMesh){
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });
        scene.add(car);
    }
);

// SUPPRESSION LOGO
function removeLogo(){
    if(currentLogo){
        currentLogo.geometry.dispose();
        currentLogo.material.dispose();
        scene.remove(currentLogo);
        currentLogo = null;
    }
}

// CREATION LOGO
function updateDecal(){
    if(!decal.target || !decal.texture) return;
    removeLogo();

    const position = decal.position;
    const orientation = new THREE.Euler();
    
    const helper = new THREE.Object3D();
    helper.position.copy(position);
    helper.lookAt(new THREE.Vector3().addVectors(position, decal.normal));
    helper.rotation.z = decal.rotation;
    orientation.copy(helper.rotation);

    const geometry = new THREE.DecalGeometry(
        decal.target, decal.position, orientation, new THREE.Vector3(decal.size, decal.size, decal.size)
    );

    const material = new THREE.MeshPhongMaterial({
        map: decal.texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4
    });

    currentLogo = new THREE.Mesh(geometry, material);
    scene.add(currentLogo);
}

/*====================================================
 IMPORT LOGO & RECADRAGE (CROPPER)
====================================================*/
let cropper = null;
const cropModal = document.getElementById('cropModal');
const imageToCrop = document.getElementById('imageToCrop');

document.getElementById("logoInput").addEventListener("change", function(event){
    const file = event.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e){
        imageToCrop.src = e.target.result;
        cropModal.style.display = 'flex';
        
        if(cropper) {
            cropper.destroy();
        }
        cropper = new Cropper(imageToCrop, {
            viewMode: 1,
            autoCropArea: 0.8,
            background: false
        });
    };
    reader.readAsDataURL(file);
    event.target.value = ''; 
});

document.getElementById('cancelCropBtn').addEventListener('click', function() {
    cropModal.style.display = 'none';
    if(cropper) cropper.destroy();
});

document.getElementById('applyCropBtn').addEventListener('click', function() {
    if(!cropper) return;
    
    const croppedCanvas = cropper.getCroppedCanvas();
    const croppedDataUrl = croppedCanvas.toDataURL('image/png');
    
    const loader = new THREE.TextureLoader();
    texture = loader.load(croppedDataUrl);
    texture.encoding = THREE.sRGBEncoding;
    decal.texture = texture;
    
    document.querySelector('.custom-file-upload').innerText = "✅ Logo recadré et chargé";
    cropModal.style.display = 'none';
    cropper.destroy();
});

// CALCUL PRÉCIS DU CLIC DE SOURIS DANS LE CONTENEUR
function getMousePos(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 - 1
    };
}

// GESTION CLICS ET GLISSER
renderer.domElement.addEventListener("pointerdown", function(event){
    const pos = getMousePos(event);
    mouse.x = pos.x;
    mouse.y = pos.y;
    raycaster.setFromCamera(mouse, camera);

    if(currentLogo){
        const logoHit = raycaster.intersectObject(currentLogo);
        if(logoHit.length){
            decal.dragging = true;
            controls.enabled = false;
            return;
        }
    }

    if(!car || !decal.texture) return;
    const hits = raycaster.intersectObject(car, true);
    if(!hits.length) return;

    const hit = hits[0];
    decal.target = hit.object;
    decal.position.copy(hit.point);
    decal.normal.copy(hit.face.normal.clone().transformDirection(hit.object.matrixWorld));
    
    updateDecal();
});

renderer.domElement.addEventListener("pointermove", function(event){
    if(!decal.dragging) return;
    
    const pos = getMousePos(event);
    mouse.x = pos.x;
    mouse.y = pos.y;
    raycaster.setFromCamera(mouse, camera);
    
    const hits = raycaster.intersectObject(car, true);
    if(hits.length){
        decal.position.copy(hits[0].point);
        updateDecal();
    }
});

renderer.domElement.addEventListener("pointerup", function(){
    decal.dragging = false;
    controls.enabled = true;
});

// SLIDERS ET BOUTONS
document.getElementById("sizeRange").addEventListener("input", function(e){
    decal.size = parseFloat(e.target.value);
    updateDecal();
});

document.getElementById("rotRange").addEventListener("input", function(e){
    decal.rotation = parseFloat(e.target.value);
    updateDecal();
});

document.getElementById("removeBtn").onclick = function(){
    removeLogo();
    decal.texture = null;
    texture = null;
    document.querySelector('.custom-file-upload').innerText = "📷 Importer un logo";
    document.getElementById("logoInput").value = ""; 
};

/*====================================================
 CAPTURE D'ÉCRAN (TÉLÉCHARGER LA 4L SANS LE MENU)
====================================================*/
const screenshotBtn = document.getElementById("screenshotBtn");
if (screenshotBtn) {
    screenshotBtn.addEventListener("click", function() {
        renderer.render(scene, camera);
        try {
            const dataURL = renderer.domElement.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = "Projet-4L-Trophy-2028-Sponsoring.png";
            link.href = dataURL;
            link.click();
        } catch (e) {
            alert("Erreur de sécurité du navigateur lors de la capture. Vérifiez vos autorisations CORS.");
            console.error("Erreur de capture :", e);
        }
    });
}

// ANIMATION STATIQUE
function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// REDIMENSIONNEMENT DYNAMIQUE
window.addEventListener("resize", function(){
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});
