// lib/firebase.js
// SOLO PARA CLIENTE (navegador)
'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, update, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCT7Dzogls_yzdyoEBBjrbcwuvTBTaTuAQ",
  authDomain: "seismic-simulator.firebaseapp.com",
  databaseURL: "https://seismic-simulator-default-rtdb.firebaseio.com",
  projectId: "seismic-simulator",
  storageBucket: "seismic-simulator.firebasestorage.app",
  messagingSenderId: "283196505135",
  appId: "1:283196505135:web:2efb6cf1bf170a321edada"
};

// Inicializar Firebase
let app;
if (typeof window !== 'undefined' && !getApps().length) {
  app = initializeApp(firebaseConfig);
} else if (typeof window !== 'undefined') {
  app = getApps()[0];
}

// Exportar solo si estamos en el cliente
export const database = typeof window !== 'undefined' ? getDatabase(app) : null;
export { ref, set, onValue, get, update, remove };

export default app;
