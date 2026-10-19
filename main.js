// 11. GESTION DU CLIC, DU SURVOL ET DE LA TOUCHE ESPACE (CORRIGÉE & ULTRA-SENSIBLE)
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

  if (!currentLogoState.texture || !car) return;
  const pos = getMousePos(event);
  mouse.set(pos.x, pos.y);
  raycaster.setFromCamera(mouse, camera);

  // Vérifie si on clique sur un logo déjà posé pour le déplacer
  if (logos.length > 0) {
    const lastLogo = logos[logos.length - 1];
    const logoHit = raycaster.intersectObject(lastLogo);
    if (logoHit.length > 0) {
      isDraggingLogo = true;
      controls.enabled = false;
      return;
    }
  }
});

renderer.domElement.addEventListener("pointermove", function (event) {
  const pos = getMousePos(event);
  mouse.set(pos.x, pos.y);

  if (isDraggingLogo && car && logos.length > 0) {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(car, true);

    if (hits.length > 0 && hits[0].face) {
      const lastLogo = logos[logos.length - 1];
      lastLogo.userData.target = hits[0].object;
      lastLogo.userData.position.copy(hits[0].point);
      lastLogo.userData.normal.copy(hits[0].face.normal).transformDirection(hits[0].object.matrixWorld);
      updateLastLogo();
    }
  }
});

// FONCTION UNIFIÉE POUR COLLER LE LOGO (UTILISÉE PAR LE CLIC ET L'ESPACE)
function triggerLogoPlacement() {
  if (!car || !currentLogoState.texture) {
    console.warn("Impossible de coller : la voiture n'est pas chargée ou aucun logo n'est sélectionné.");
    return;
  }

  raycaster.setFromCamera(mouse, camera);
  // On teste l'intersection sur toute la voiture (récursif à true)
  const hits = raycaster.intersectObject(car, true);

  if (hits.length > 0) {
    placeLogo(hits[0]);
    if (hintPill) hintPill.textContent = "✅ Logo collé ! Ajustez sa taille à gauche, ou visez ailleurs et appuyez sur ESPACE.";
  } else {
    // Si on clique à côté de la voiture, on affiche un petit message d'aide
    if (hintPill) hintPill.textContent = "⚠️ Visez bien directement sur la carrosserie de la 4L !";
  }
}

renderer.domElement.addEventListener("pointerup", function (event) {
  if (isDraggingLogo) {
    isDraggingLogo = false;
    controls.enabled = true;
    return;
  }

  const dist = Math.hypot(event.clientX - ptrDown.x, event.clientY - ptrDown.y);
  if (dist > 15) return; // C'était une rotation de caméra

  triggerLogoPlacement();
});

// POSE DU LOGO AVEC LA TOUCHE ESPACE
window.addEventListener("keydown", function (event) {
  if (event.code === "Space" && event.target.tagName !== "INPUT" && event.target.tagName !== "TEXTAREA") {
    event.preventDefault(); // Empêche la page de descendre
    triggerLogoPlacement();
  }
});
