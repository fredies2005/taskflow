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
// App Check (reCAPTCHA Enterprise): clave de sitio pública; la protección se activa al registrarla en Firebase.
window.TF_APPCHECK_KEY = "6LeEkQMuAAAAAA_SA4OE6OEiIDfOocjjZ3y28KYn";

window.TF_CONNECT = {
  google: { clientId: "" },
  microsoft: { clientId: "" },
  spotify: { clientId: "8d2da8e3efa34e88a8234228af4661a7" }
};

