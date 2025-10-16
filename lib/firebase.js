import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// TU configuración de Firebase (pega aquí el código que copiaste)
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
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
