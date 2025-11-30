#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ==========================================
// Credenciales Wi-Fi
// ==========================================
extern const char* WIFI_SSID;
extern const char* WIFI_PASSWORD;

// ==========================================
// NTP Time Configuration
// ==========================================
extern const char* NTP_SERVER;
const long  GMT_OFFSET_SEC = -18000; // UTC-5 (Cuba)
const int   DAYLIGHT_OFFSET_SEC = 0;

// ==========================================
// Definición de Pines
// ==========================================
// Sensores
#define DHT_PIN 4           // Pin de Datos DHT11
#define ONE_WIRE_BUS 5      // Pin de Datos DS18B20
#define SOIL_MOISTURE_PIN 34 // Entrada Analógica (Sensor Capacitivo)
#define LDR_PIN 35          // Entrada Analógica (Fotorresistencia)
#define PIR_PIN 13          // Entrada Digital (Sensor de Movimiento)
#define TRIG_PIN 14         // Trigger Ultrasónico
#define ECHO_PIN 27         // Echo Ultrasónico

// Actuadores (LEDs simulando relés para prototipo)
#define RELAY_PIN 18        // LED Verde - Simula Relé de Riego
#define RELAY_TANK_PIN 22   // LED Azul - Simula Relé de Llenado de Tanque
#define SECURITY_LED_PIN 19 // LED Rojo - Simula Relé de Seguridad
#define LUMINARY_LED_PIN 21 // LED Amarillo/Blanco - Luminaria
#define BUZZER_PIN 23     // Buzzer Activo - Alarma de Intruso

// Calibración de Sensores
// Calibración de Sensores
extern int SOIL_DRY;
extern int SOIL_WET;
extern int SOIL_MOISTURE_THRESHOLD;

// Tanque (Vaso de agua)
extern float TANK_DEPTH_CM;
extern float TANK_MIN_DISTANCE;
extern int TANK_CRITICAL_LEVEL;

// Luz
extern int LIGHT_THRESHOLD_LOW;
extern int LIGHT_THRESHOLD_HIGH;
extern int LIGHT_MIN_RAW;  // New
extern int LIGHT_MAX_RAW;  // New

// Niveles del Tanque (Porcentaje)
const int TANK_MIN_LEVEL = 20;  // Nivel mínimo para riego
const int TANK_MAX_LEVEL = 100;  // Nivel máximo para detener llenado

// ==========================================
// Temporizadores (Milisegundos)
// ==========================================
// Intervalos de Monitoreo de Control (Tanque y Suelo)
extern unsigned long TANK_MONITORING_ACTIVE_MS;
extern unsigned long TANK_MONITORING_IDLE_MS;

// Intervalos de Mediciones Ambientales (Temperatura, Humedad, Luz)
extern unsigned long ENV_MONITORING_ACTIVE_MS;
extern unsigned long ENV_MONITORING_IDLE_MS;

// Configuración de Tiempos (Variables para Frontend)
extern int DATA_SEND_INTERVAL_MIN;
extern int SERVER_POLLING_INTERVAL_SEC;
extern int STATUS_POLLING_INTERVAL_SEC;

// Otros Temporizadores
const unsigned long STANDARD_MONITORING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos (deprecated, usar ENV_MONITORING_IDLE_MS)
const unsigned long ACTIVE_WATERING_CHECK_MS = 2000;                  // 2 segundos
const unsigned long PUMP_RUN_TIME_MS = 120000;                          // Tiempo máx de bomba por ráfaga (2 min)
const unsigned long INACTIVITY_TIMEOUT_MS = 30000;                    // Tiempo de espera del servidor web

#endif // CONFIG_H
