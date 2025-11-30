#include "web_server.h"
#include "index_html.h"
#include "login_html.h"
#include "style_css.h"
#include "script_js.h"
#include "chart_js.h"
#include "config_html.h"
#include "view_html.h"
#include "view_js.h"

WebServer server(80);

void handleRoot() {
    // Serve login.html at root for initial authentication
    server.sendHeader("Content-Encoding", "gzip");
    server.send_P(200, "text/html", login_html);
}

void handleInit() {
    // Serve index.html 
    server.sendHeader("Content-Encoding", "gzip");
    server.send_P(200, "text/html", index_html);
}

void handleView() {
    // Serve view.html
    server.sendHeader("Content-Encoding", "gzip");
    server.send_P(200, "text/html", view_html);
}

void handleStyle() {
    server.sendHeader("Cache-Control", "public, max-age=31536000");
    server.sendHeader("Content-Encoding", "gzip");
    server.send_P(200, "text/css", style_css);
}

void handleScript() {
    server.sendHeader("Cache-Control", "public, max-age=31536000");
    server.sendHeader("Content-Encoding", "gzip");
    server.send_P(200, "application/javascript", script_js);
}

void handleViewScript() {
    server.sendHeader("Cache-Control", "public, max-age=31536000");
    server.sendHeader("Content-Encoding", "gzip");
    server.send_P(200, "application/javascript", view_js);
}

void handleChartLib() {
    server.sendHeader("Cache-Control", "public, max-age=31536000");
    server.sendHeader("Content-Encoding", "gzip");
    server.send_P(200, "application/javascript", chart_js);
}

void handleConfig() {
    server.sendHeader("Content-Encoding", "gzip");
    server.send_P(200, "text/html", config_html);
}

void handleData() {
    SystemData data = getSystemData();
    DynamicJsonDocument doc(16384); // Increased buffer to 16KB for 100 history records

    // Current Data
    doc["temp"] = data.ambientTemp;
    doc["humidity"] = data.ambientHumidity;
    doc["soilTemp"] = data.soilTemp;
    doc["soilMoisture"] = data.soilMoisture;
    doc["soilRaw"] = data.soilRaw;     // New
    doc["tankLevel"] = data.tankLevel;
    doc["tankDistance"] = data.tankDistance; // New
    doc["light"] = data.lightLevel;
    doc["lightRaw"] = data.lightRaw;   // New
    doc["motion"] = data.motionDetected;
    doc["pump"] = data.pumpActive;
    doc["tankPump"] = data.tankPumpActive;
    doc["status"] = data.status;
    doc["security"] = getSecurityMode();
    doc["securityAuto"] = getSecurityAuto();
    doc["irrigationAuto"] = getIrrigationAuto();
    doc["tankAuto"] = getTankAuto();
    doc["luminaryAuto"] = getLuminaryAuto();
    doc["luminary"] = getLuminaryMode();
    doc["securityStart"] = getSecurityStartTime();
    doc["securityEnd"] = getSecurityEndTime();
    
    // Configuration Data
    JsonObject config = doc.createNestedObject("config");
    config["soilDry"] = SOIL_DRY;
    config["soilWet"] = SOIL_WET;
    config["soilThreshold"] = SOIL_MOISTURE_THRESHOLD;
    config["tankEmpty"] = TANK_DEPTH_CM;
    config["tankFull"] = TANK_MIN_DISTANCE;
    config["tankCritical"] = TANK_CRITICAL_LEVEL;
    config["lightMin"] = LIGHT_MIN_RAW;
    config["lightMax"] = LIGHT_MAX_RAW;
    config["lightLow"] = LIGHT_THRESHOLD_LOW;
    config["lightHigh"] = LIGHT_THRESHOLD_HIGH;
    config["dataSendInterval"] = DATA_SEND_INTERVAL_MIN;
    config["serverPollingInterval"] = SERVER_POLLING_INTERVAL_SEC;
    config["statusPollingInterval"] = STATUS_POLLING_INTERVAL_SEC;
    
    doc["lastMeasurementTime"] = data.lastMeasurementTime; // Timestamp relative to boot

    // History Data
    JsonArray historyArray = doc.createNestedArray("history");
    for (const auto& record : history) {
        JsonObject h = historyArray.createNestedObject();
        h["temp"] = record.ambientTemp;
        h["humidity"] = record.ambientHumidity;
        h["soil"] = record.soilMoisture;
        h["tank"] = record.tankLevel;
        h["light"] = record.lightLevel;
        h["timestamp"] = record.timestamp;
    }

    String json;
    serializeJson(doc, json);
    
    Serial.println("\n=== ENVIANDO DATOS A WEB ===");
    Serial.print("Puntos en historial: "); Serial.println(history.size());
    Serial.print("Tamano JSON: "); Serial.print(json.length()); Serial.println(" bytes");
    Serial.print("lastMeasurementTime: "); Serial.println(data.lastMeasurementTime);
    if (history.size() > 0) {
        Serial.print("Primer punto timestamp: "); Serial.println(history[0].timestamp);
        Serial.print("Ultimo punto timestamp: "); Serial.println(history[history.size()-1].timestamp);
    }
    
    // Log timing for debugging latency
    Serial.print("Tiempo actual (millis): "); Serial.println(millis());
    Serial.print("Diferencia desde medicion: "); Serial.print(millis() - data.lastMeasurementTime); Serial.println(" ms");
    
    server.send(200, "application/json", json);
}

void handleStatus() {
    SystemData data = getSystemData();
    DynamicJsonDocument doc(512);
    
    doc["pump"] = data.pumpActive;
    doc["tankPump"] = data.tankPumpActive;
    doc["security"] = getSecurityMode();
    doc["luminary"] = getLuminaryMode();
    doc["irrigationAuto"] = getIrrigationAuto();
    doc["tankAuto"] = getTankAuto();
    doc["securityAuto"] = getSecurityAuto();
    doc["luminaryAuto"] = getLuminaryAuto();
    doc["securityStart"] = getSecurityStartTime();
    doc["securityEnd"] = getSecurityEndTime();
    doc["status"] = data.status;
    
    String json;
    serializeJson(doc, json);
    server.send(200, "application/json", json);
}

void handleAction() {
    if (server.hasArg("plain")) {
        String body = server.arg("plain");
        DynamicJsonDocument doc(1024);
        DeserializationError error = deserializeJson(doc, body);
        
        if (error) {
            server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
            return;
        }
        
        // Handle irrigation actions
        // Handle irrigation actions
        if (doc.containsKey("irrigationAuto")) {
            setIrrigationAuto(doc["irrigationAuto"]);
        }
        if (doc.containsKey("forceIrrigation")) {
            int duration = 0;
            if (doc.containsKey("duration")) {
                duration = doc["duration"];
            }
            setIrrigationManual(doc["forceIrrigation"], duration);
        }
        
        // Handle configuration updates
        if (doc.containsKey("config")) {
            JsonObject config = doc["config"];
            
            if (config.containsKey("soilDry")) SOIL_DRY = config["soilDry"];
            if (config.containsKey("soilWet")) SOIL_WET = config["soilWet"];
            if (config.containsKey("soilThreshold")) SOIL_MOISTURE_THRESHOLD = config["soilThreshold"];
            
            if (config.containsKey("tankEmpty")) TANK_DEPTH_CM = config["tankEmpty"];
            if (config.containsKey("tankFull")) TANK_MIN_DISTANCE = config["tankFull"];
            if (config.containsKey("tankCritical")) TANK_CRITICAL_LEVEL = config["tankCritical"];
            
            if (config.containsKey("lightMin")) LIGHT_MIN_RAW = config["lightMin"];
            if (config.containsKey("lightMax")) LIGHT_MAX_RAW = config["lightMax"];
            if (config.containsKey("lightLow")) LIGHT_THRESHOLD_LOW = config["lightLow"];
            if (config.containsKey("lightHigh")) LIGHT_THRESHOLD_HIGH = config["lightHigh"];
            
            if (config.containsKey("dataSendInterval")) DATA_SEND_INTERVAL_MIN = config["dataSendInterval"];
            if (config.containsKey("serverPollingInterval")) SERVER_POLLING_INTERVAL_SEC = config["serverPollingInterval"];
            if (config.containsKey("statusPollingInterval")) STATUS_POLLING_INTERVAL_SEC = config["statusPollingInterval"];
            
            Serial.println("[CONFIG] Configuration updated from web");
        }
        
        // Handle tank actions
        if (doc.containsKey("tankAuto")) {
            setTankAuto(doc["tankAuto"]);
        }
        if (doc.containsKey("forceTank")) {
            setTankManual(doc["forceTank"]);
        }
        
        // Handle security actions
        if (doc.containsKey("securityAuto")) {
            setSecurityAuto(doc["securityAuto"]);
        }
        if (doc.containsKey("security")) {
            setSecurityManual(doc["security"]);
        }
        if (doc.containsKey("securityStart") && doc.containsKey("securityEnd")) {
            setSecuritySchedule(doc["securityStart"], doc["securityEnd"]);
        }
        if (doc.containsKey("clearAlarm")) {
            clearAlarm();
        }
        
        // Handle luminary actions
        if (doc.containsKey("luminaryAuto")) {
            setLuminaryAuto(doc["luminaryAuto"]);
        }
        if (doc.containsKey("forceLuminary")) {
            setLuminaryManual(doc["forceLuminary"]);
        }
        
        server.send(200, "application/json", "{\"success\":true}");
    } else {
        server.send(400, "application/json", "{\"error\":\"No body\"}");
    }
}

void setupWebServer() {
    Serial.println("Iniciando servidor web...");
    
    server.on("/", HTTP_GET, handleRoot);
    server.on("/login.html", HTTP_GET, handleRoot);
    server.on("/index.html", HTTP_GET, handleInit);
    server.on("/config.html", HTTP_GET, handleConfig);
    server.on("/style.css", HTTP_GET, handleStyle);
    server.on("/script.js", HTTP_GET, handleScript);
    server.on("/view.html", HTTP_GET, handleView);
    server.on("/view.js", HTTP_GET, handleViewScript);
    server.on("/chart.js", HTTP_GET, handleChartLib);
    server.on("/data", HTTP_GET, handleData);
    server.on("/status", HTTP_GET, handleStatus);
    server.on("/action", HTTP_POST, handleAction);

    server.begin();
    Serial.println("HTTP server started");
}

void handleClient() {
    server.handleClient();
}
