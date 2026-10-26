// Configuración pública de Firebase (las claves web no son secretas; la seguridad la dan las reglas de Firestore).
window.TF_FIREBASE = {
  apiKey: "AIzaSyCOhEniX-DbqqKR50_iJ3erAmipr9GAXTk",
  authDomain: "taskflow-9535e.firebaseapp.com",
  projectId: "taskflow-9535e",
  storageBucket: "taskflow-9535e.firebasestorage.app",
  messagingSenderId: "177460023352",
  appId: "1:177460023352:web:4abb5ff6d51d6adb4496cd"
};

// Conectores en un clic: si pones aquí los Client ID públicos de TU app, los usuarios no tendrán que pegar nada.
// Google no lo necesita si hay cuentas (Firebase): usa el inicio de sesión con Google.
window.TF_CONNECT = {
  google: { clientId: "" },
  microsoft: { clientId: "" },
  spotify: { clientId: "" }
};
