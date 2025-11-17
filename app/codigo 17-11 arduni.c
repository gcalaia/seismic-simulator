/*
 * Mesa Vibratoria Sísmica v4.7 - FACTOR EXTREMO
 * Factor aumentado 10,000x para solucionar micropasos
 */

#include <WiFi.h>
#include <WebServer.h>
#include <Firebase_ESP_Client.h>
#include <Preferences.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// ===================== MECÁNICA =====================
const int CRANK_POSITION = 5;
const float CRANK_RADII[5] = {12.0,20.0,28.0,36.0,44.0};
const float CRANK_RADIUS_MM = CRANK_RADII[CRANK_POSITION-1];
const float MAX_AMPLITUDE_MM = CRANK_RADIUS_MM * 2.0;

// ⭐⭐⭐ FACTOR EXTREMO ⭐⭐⭐
const int MICROSTEP = 8;
const int STEPS_PER_REV = 200;

// ⭐ AUMENTADO 10,000x
const float K_STEPS_PER_MM = 100000.0;

// ⭐ GANANCIA CSV AUMENTADA 10x
// Si los CSV llegan con amplitudes pequeñas (12mm en vez de 120mm)
// Este factor los multiplica automáticamente
const float CSV_GAIN = 10.0;  // ⭐⭐⭐ Multiplicar por 10

// ===================== FIREBASE =====================
#define FIREBASE_HOST "seismic-simulator-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "WtYi1mvWhaxcJyOIpHSYOEqj9T0CoGPAcjMeU0i0"
#define DEVICE_ID "LAB_01"

// ===================== PINES =====================
#define STEP 25
#define DIR  26
#define EN   27
#define WIFI_RESET_BUTTON 0

// ===================== OBJETOS =====================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
Preferences prefs;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 0, 60000);
WebServer server(80);

// 🆕 DECLARACIONES ANTICIPADAS
void publishNetworkInfo();

// ===================== ESTADO =====================
bool motorEnabled=false, isPaused=false, wifiConfigMode=false, firebaseReady=false;
float currentFrequency=2.0, currentAmplitudePct=50.0, duration=30.0;
int waveformType=0;

bool isCSVMode=false;
float csvAmplitudeMM=0.0;
float csvAmplitudeSmoothed=0.0;

float csvMaxAmplitude=0.0;
int csvSampleCount=0;

unsigned long startTime=0, pauseTime=0, lastMotorUpdate=0, lastStepTime=0;
const unsigned long MOTOR_UPDATE_INTERVAL=10;
const unsigned long FIREBASE_READ_INTERVAL=1000;
const unsigned long FIREBASE_WRITE_INTERVAL=2000;
const unsigned long REALTIME_READ_INTERVAL=50;
const unsigned long NETWORK_UPDATE_INTERVAL=30000;
unsigned long lastFirebaseRead=0, lastFirebaseWrite=0, lastRealtimeRead=0;
unsigned long lastNetworkUpdate=0;  


long currentPosition=0, targetPosition=0;  // ⭐ Cambiado a long para soportar números grandes
int stepDelayMicros=200;  // ⭐ Más rápido para manejar más pasos

unsigned long wifiButtonPressTime=0;
bool wifiButtonPressed=false;

// ===================== HELPERS =====================
float smoothAmplitude(float newValue, float oldValue, float alpha=0.3) {
  return alpha * newValue + (1.0 - alpha) * oldValue;
}

int calculateStepDelay(float frequency) {
  int delayUs = (int)(1000000.0 / max(1.0f, frequency) / (STEPS_PER_REV * (float)MICROSTEP) * 2.0);
  return constrain(delayUs, 100, 5000);  // ⭐ Rango ajustado
}

// ===================== WIFI =====================
void checkWiFiResetButton(){
  if(digitalRead(WIFI_RESET_BUTTON)==LOW){
    if(!wifiButtonPressed){ wifiButtonPressTime=millis(); wifiButtonPressed=true; }
    else if(millis()-wifiButtonPressTime>3000){
      prefs.begin("seismic", false); prefs.clear(); prefs.end();
      ESP.restart();
    }
  }else wifiButtonPressed=false;
}

bool connectToWiFi(){
  prefs.begin("seismic",false);
  String ssid=prefs.getString("ssid",""), pass=prefs.getString("pass","");
  prefs.end();
  if(ssid.length()==0) return false;
  WiFi.mode(WIFI_STA); WiFi.begin(ssid.c_str(), pass.c_str());
  for(int i=0;i<40 && WiFi.status()!=WL_CONNECTED;i++){ delay(250); }
  return WiFi.status()==WL_CONNECTED;
}

void startConfigPortal(){
  wifiConfigMode=true;
  WiFi.mode(WIFI_AP);
  WiFi.softAP("Simulador_Config","12345678");
  server.on("/", HTTP_GET, [](){
    String html="<!doctype html><html><meta charset='utf-8'><title>Config WiFi</title>"
      "<body style='font-family:Arial'><h2>Config WiFi</h2>"
      "<form method='POST' action='/save'>SSID:<br><input name='ssid'><br>PASS:<br><input name='pass'>"
      "<br><button>Guardar</button></form></body></html>";
    server.send(200,"text/html",html);
  });
  server.on("/save", HTTP_POST, [](){
    String ssid=server.arg("ssid"), pass=server.arg("pass");
    prefs.begin("seismic",false); prefs.putString("ssid",ssid); prefs.putString("pass",pass); prefs.end();
    server.send(200,"text/plain","OK, reiniciando...");
    delay(500); ESP.restart();
  });
  server.begin();
}

// ===================== FIREBASE =====================
void registerDevice(){
  String p="/devices/"+String(DEVICE_ID);
  FirebaseJson j;
  j.set("name","Mesa Vibratoria Lab 01");
  j.set("firmware","v4.7-EXTREMO");
  j.set("ip", WiFi.localIP().toString());
  j.set("stepsPerMM", K_STEPS_PER_MM);
  j.set("lastSeen", (int)timeClient.getEpochTime());
  Firebase.RTDB.setJSON(&fbdo, p.c_str(), &j);

  FirebaseJson s; 
  s.set("online", true); 
  s.set("isRunning", false);
  Firebase.RTDB.setJSON(&fbdo,(p+"/status").c_str(), &s);
  
  // 🆕 PUBLICAR INFO DE RED AL REGISTRARSE
  publishNetworkInfo();
}

void initFirebase(){
  timeClient.begin(); timeClient.update();
  config.host=FIREBASE_HOST;
  config.signer.tokens.legacy_token=FIREBASE_AUTH;
  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config,&auth); Firebase.reconnectWiFi(true);
  firebaseReady=Firebase.ready();
  if(firebaseReady) registerDevice();
}

void updateFirebaseStatus(){
  String sp="/devices/"+String(DEVICE_ID)+"/status";
  float progress=0;
  if(motorEnabled && duration>0){
    float elapsed=(millis()-startTime)/1000.0;
    progress=min((elapsed/duration)*100.0f,100.0f);
  }
  FirebaseJson j;
  j.set("online", true);
  j.set("isRunning", motorEnabled);
  j.set("paused", isPaused);
  j.set("progress", progress);
  j.set("lastSeen", (int)timeClient.getEpochTime());
  
  if(isCSVMode){
    j.set("csvMaxAmplitude", csvMaxAmplitude);
    j.set("csvSamples", csvSampleCount);
  }
  
  Firebase.RTDB.setJSON(&fbdo, sp.c_str(), &j);
}

// ===================== NETWORK INFO =====================
void publishNetworkInfo(){
  if(WiFi.status() != WL_CONNECTED) return;
  
  String p = "/devices/" + String(DEVICE_ID) + "/network";
  FirebaseJson j;
  
  j.set("ip", WiFi.localIP().toString());
  j.set("rssi", WiFi.RSSI());
  j.set("ssid", WiFi.SSID());
  j.set("lastSeen", (int)timeClient.getEpochTime());
  j.set("uptime", (int)(millis() / 1000));
  
  if(Firebase.RTDB.setJSON(&fbdo, p.c_str(), &j)){
    static unsigned long lastLog = 0;
    if(millis() - lastLog > 30000){ // Log cada 30s
      lastLog = millis();
      Serial.println(F("📡 Info de red actualizada"));
    }
  }
}

// ===================== CONTROL =====================
void startSimulation(){
  motorEnabled=true; isPaused=false; startTime=millis();
  currentPosition=0; targetPosition=0; lastMotorUpdate=0;
  csvAmplitudeSmoothed=0;
  csvMaxAmplitude=0;
  csvSampleCount=0;
  digitalWrite(EN, LOW);
  
  Serial.println(F("\n🟢 MOTOR HABILITADO"));
  Serial.print(F("   Factor pasos/mm: "));
  Serial.println(K_STEPS_PER_MM, 0);
  Serial.println();
}

void pauseSimulation(){ 
  isPaused=true; 
  pauseTime=millis(); 
  digitalWrite(EN,HIGH);
}

void resumeSimulation(){ 
  isPaused=false; 
  startTime += millis()-pauseTime; 
  digitalWrite(EN,LOW);
}

void stopSimulation(){
  motorEnabled=false; isPaused=false; digitalWrite(EN,HIGH);
  currentPosition=0; targetPosition=0; 
  isCSVMode=false; csvAmplitudeMM=0; csvAmplitudeSmoothed=0;
  
  Serial.println(F("\n🛑 MOTOR DETENIDO"));
  if(csvMaxAmplitude > 0){
    Serial.print(F("   Max amplitud: "));
    Serial.print(csvMaxAmplitude, 2);
    Serial.println(F("mm"));
  }
  Serial.println();
}

// ===================== CSV =====================
void readRealtimeData(){
  String p="/devices/"+String(DEVICE_ID)+"/realtime";
  if(!Firebase.RTDB.getJSON(&fbdo, p.c_str())) return;
  
  FirebaseJson &json=fbdo.jsonObject(); 
  FirebaseJsonData d;

  json.get(d,"amplitude");
  if(d.success){
    csvAmplitudeMM = d.floatValue * CSV_GAIN;
    csvAmplitudeSmoothed = smoothAmplitude(csvAmplitudeMM, csvAmplitudeSmoothed, 0.4);
    csvAmplitudeSmoothed = constrain(csvAmplitudeSmoothed, -MAX_AMPLITUDE_MM/2, MAX_AMPLITUDE_MM/2);
    csvMaxAmplitude = max(csvMaxAmplitude, abs(csvAmplitudeSmoothed));
    csvSampleCount++;
    
    static unsigned long lastLog=0;
    if(millis()-lastLog > 500){
      lastLog=millis();
      
      json.get(d,"time");
      float csvTime = d.success ? d.floatValue : 0;
      
      Serial.print(F("📊 t="));
      Serial.print(csvTime, 1);
      Serial.print(F("s | Amp="));
      Serial.print(csvAmplitudeSmoothed, 2);
      Serial.println(F("mm"));
    }
  }
}

// ===================== COMANDOS =====================
void readFirebaseCommands(){
  String p="/devices/"+String(DEVICE_ID)+"/commands";
  if(!Firebase.RTDB.getJSON(&fbdo, p.c_str())) return;

  FirebaseJson &json=fbdo.jsonObject(); FirebaseJsonData d;
  json.get(d,"action"); String action=d.stringValue;
  if(action.length()==0 || action=="READY") return;

  Serial.print(F("\n📥 "));
  Serial.println(action);

  if(action=="START" && !motorEnabled){
    isCSVMode=false;
    json.get(d,"waveformType"); 
    if(d.success && d.intValue==99) isCSVMode=true;
    json.get(d,"csvMode"); 
    if(d.success && d.boolValue) isCSVMode=true;

    if(isCSVMode){
      Serial.println(F("📊 MODO CSV"));
      startSimulation();
    }else{
      Serial.println(F("⚙️  MODO LOCAL"));
      json.get(d,"frequency"); 
      if(d.success) currentFrequency=d.floatValue;
      json.get(d,"amplitude"); 
      if(d.success) currentAmplitudePct = constrain(d.floatValue,0,100);
      json.get(d,"duration");  
      if(d.success) duration=d.floatValue;
      stepDelayMicros = calculateStepDelay(currentFrequency);
      startSimulation();
    }
    
    FirebaseJson j; 
    j.set("action","RUNNING");
    Firebase.RTDB.setJSON(&fbdo, p.c_str(), &j);
  }
    else if(action=="STOP" && motorEnabled){
    stopSimulation();
    FirebaseJson j; j.set("action","STOPPED"); 
    Firebase.RTDB.setJSON(&fbdo, p.c_str(), &j);
  }
  // 🆕 COMANDO RECONNECT_WIFI
  else if(action=="RECONNECT_WIFI"){
    Serial.println(F("🔄 Reconectando WiFi..."));
    WiFi.disconnect();
    delay(1000);
    WiFi.reconnect();
    
    FirebaseJson j; j.set("action","WIFI_RECONNECTING"); 
    Firebase.RTDB.setJSON(&fbdo, p.c_str(), &j);
  }
  // 🆕 COMANDO RESTART
  else if(action=="RESTART"){
    Serial.println(F("🔄 Reiniciando ESP32 en 3 segundos..."));
    
    FirebaseJson j; j.set("action","RESTARTING"); 
    Firebase.RTDB.setJSON(&fbdo, p.c_str(), &j);
    
    delay(3000);
    ESP.restart();
  }
}

// ===================== MOTOR =====================
void stepOnce(bool dir){
  digitalWrite(DIR, dir?HIGH:LOW);
  digitalWrite(STEP, HIGH);  
  delayMicroseconds(2);
  digitalWrite(STEP, LOW);   
  delayMicroseconds(2);
}

void runMotor(){
  if(!motorEnabled || isPaused) return;

  const unsigned long now=millis();

  if(now - lastMotorUpdate >= MOTOR_UPDATE_INTERVAL){
    lastMotorUpdate = now;

    if(isCSVMode){
      long maxSteps = (long)(csvAmplitudeSmoothed * K_STEPS_PER_MM);
      targetPosition = maxSteps;
      
      static unsigned long lastDebug=0;
      if(now - lastDebug > 1000){
        lastDebug=now;
        Serial.print(F("🔄 Amp="));
        Serial.print(csvAmplitudeSmoothed, 2);
        Serial.print(F("mm → Steps="));
        Serial.print(maxSteps);
        Serial.print(F(" | Diff="));
        Serial.println(abs(targetPosition - currentPosition));
      }
    }else{
      float t = (now - startTime)/1000.0;
      float phase = (currentFrequency * t) * 2.0 * PI;
      float amplitudeMM = (currentAmplitudePct/100.0f) * MAX_AMPLITUDE_MM;
      long maxSteps = (long)(amplitudeMM * K_STEPS_PER_MM);
      targetPosition = (long)(maxSteps * sin(phase));
    }
  }

  // ⭐ Mover múltiples pasos por iteración si es necesario
  int stepsToMove = min(100, (int)abs(targetPosition - currentPosition));
  
  for(int i=0; i<stepsToMove; i++){
    if(currentPosition == targetPosition) break;
    
    unsigned long us = micros();
    if(us - lastStepTime >= (unsigned long)stepDelayMicros){
      lastStepTime = us;
      bool dir = (targetPosition > currentPosition);
      stepOnce(dir);
      currentPosition += dir? 1 : -1;
    }
  }
}

// ===================== SETUP / LOOP =====================
void setup(){
  Serial.begin(115200); delay(500);
  
  Serial.println(F("\n╔═══════════════════════════════╗"));
  Serial.println(F("║  MESA SÍSMICA v4.7 EXTREMO    ║"));
  Serial.println(F("║  Factor: 100,000 pasos/mm     ║"));
  Serial.println(F("╚═══════════════════════════════╝\n"));
  
  pinMode(STEP,OUTPUT); pinMode(DIR,OUTPUT); pinMode(EN,OUTPUT);
  pinMode(WIFI_RESET_BUTTON, INPUT_PULLUP);
  digitalWrite(EN,HIGH); digitalWrite(STEP,LOW); digitalWrite(DIR,LOW);

  Serial.print(F("⚙️  K_STEPS_PER_MM = "));
  Serial.println(K_STEPS_PER_MM, 0);
  Serial.println();

  if(!connectToWiFi()){ 
    startConfigPortal(); 
    return; 
  }
  
  Serial.print(F("✅ WiFi: "));
  Serial.println(WiFi.localIP());
  
  initFirebase();
  
  if(firebaseReady){
    Serial.println(F("✅ Firebase OK\n"));
  }
}

void loop(){
  checkWiFiResetButton();
  if(wifiConfigMode){ server.handleClient(); return; }
  timeClient.update();
  if(!firebaseReady) return;

  if(millis()-lastFirebaseRead>FIREBASE_READ_INTERVAL){ 
    lastFirebaseRead=millis(); 
    readFirebaseCommands(); 
  }
  
  if(isCSVMode && motorEnabled && !isPaused){
    if(millis()-lastRealtimeRead>REALTIME_READ_INTERVAL){ 
      lastRealtimeRead=millis(); 
      readRealtimeData(); 
    }
  }
  
  if(millis()-lastFirebaseWrite>FIREBASE_WRITE_INTERVAL){ 
    lastFirebaseWrite=millis(); 
    updateFirebaseStatus(); 
  }

  // 🆕 PUBLICAR INFO DE RED CADA 30 SEGUNDOS
  if(millis()-lastNetworkUpdate>NETWORK_UPDATE_INTERVAL){ 
    lastNetworkUpdate=millis(); 
    publishNetworkInfo(); 
  }

  runMotor();

  if(motorEnabled && !isPaused && !isCSVMode && duration>0){
    float elapsed=(millis()-startTime)/1000.0;
    if(elapsed>=duration){ stopSimulation(); }
  }
}
