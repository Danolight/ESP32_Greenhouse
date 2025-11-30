#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include "time.h"
#include "config.h"
#include "sensors.h"
#include "actuators.h"
#include "logic.h"
#include "web_server.h"
#include <esp_sleep.h>


const char* WIFI_SSID = "moto g51";
const char* WIFI_PASSWORD = "pedropedro2";


unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 60000;

void connectWiFi() {
    Serial.print("Conectando a ");
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);


    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.println("WiFi conectado.");
        Serial.print("Dirección IP: ");
        Serial.println(WiFi.localIP());
        
        // Start mDNS service
        if (MDNS.begin("invernadero")) {
            Serial.println("mDNS iniciado!");
            Serial.println("Accede via: http://invernadero.local");
            MDNS.addService("http", "tcp", 80);
        } else {
            Serial.println("Error iniciando mDNS");
        }
    } else {
        Serial.println();
        Serial.println("No se pudo conectar a WiFi. Reintentando en 1 minuto...");
    }
}

void checkWiFiConnection() {
    unsigned long now = millis();
    if (now - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
        lastWiFiCheck = now;
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("\n[WiFi] Desconectado. Intentando reconectar...");
            connectWiFi();
        }
    }
}

void setup() {
    Serial.begin(115200);

    // Reduce CPU frequency for energy saving
    setCpuFrequencyMhz(240);

    // Initialize modules
    initActuators();
    initSensors();
    initLogic();

    // Connect to Wi‑Fi
    connectWiFi();
    
    // Init NTP
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);

    // Setup web server
    setupWebServer();

    // Enable light‑sleep while Wi‑Fi stays connected
    WiFi.setSleep(true);
}

void loop() {
    // Keep Wi‑Fi alive
    checkWiFiConnection();

    // Serve web requests if connected
    if (WiFi.status() == WL_CONNECTED) {
        handleClient();
    }

    // Run automation logic
    // Split into Measurement -> Wait/Serve -> Execution
    if (checkAndMeasure()) {
        // New data available.
        // Wait to let web client poll (2.5 seconds)
        // During this wait, keep handling web client!
        unsigned long waitStart = millis();
        while (millis() - waitStart < 2500) {
            if (WiFi.status() == WL_CONNECTED) {
                handleClient();
            }
            // Continuous security check during wait
            checkSecurityOnly();
            delay(10);
        }
        runAutomation();
    } else {
        // Normal loop
        runAutomation(); // Run continuous checks (like security timeouts)
    }

    // Light‑sleep disabled for responsiveness; can be re‑enabled later if needed
    // esp_sleep_enable_timer_wakeup(5ULL * 1000000ULL);
    // esp_light_sleep_start();

    // Small delay for OS yielding (optional)
    delay(10);
}