(function () {
  // No se guarda la config real de Firebase en el repositorio.
  // Si existe un archivo local no versionado llamado cloud-config.local.js,
  // se usa para habilitar la nube; si no existe, la app sigue funcionando
  // en modo local sin limitar la experiencia del cliente ni al desarrollador.
  window.TF_FIREBASE = window.TF_FIREBASE || {};

  const localScript = document.createElement("script");
  localScript.src = "./cloud-config.local.js";
  localScript.async = false;
  localScript.onload = () => {
    if (!window.TF_FIREBASE || !window.TF_FIREBASE.apiKey || !window.TF_FIREBASE.projectId) {
      window.TF_FIREBASE = {};
    }
  };
  localScript.onerror = () => {
    window.TF_FIREBASE = window.TF_FIREBASE || {};
  };

  document.head.appendChild(localScript);
})();
