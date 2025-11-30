#include "logic.h"

bool securityModeEnabled = false;
bool securityAutoEnabled = false;  // Default OFF
bool irrigationAutoEnabled = true; // Default ON
bool tankAutoEnabled = true;       // Default ON
bool luminaryAutoEnabled = true;   // Default ON
bool pumpForced = false;
bool tankForced = false;
bool luminaryForced = false;
unsigned long lastMonitorTime = 0;
unsigned long lastTankMonitorTime = 0;
unsigned long pumpStartTime = 0;
bool isPumpRunning = false;
bool isTankPumpRunning = false;
bool isLuminaryOn = false;        // New
unsigned long currentPumpDuration = PUMP_RUN_TIME_MS; // Default duration
unsigned long lastAlarmToggle = 0;
bool alarmState = false;

// Security Schedule
int securityStartHour = -1;
int securityStartMinute = -1;
int securityEndHour = -1;
int securityEndMinute = -1;

SystemData currentData;
std::vector<SystemData> history;
const size_t MAX_HISTORY = 24; // Store 24 data points (24 hours at 1 hour intervals)

// ==========================================
// Configuration Variables (Defaults)
// ==========================================
int SOIL_DRY = 2500;
int SOIL_WET = 1000;
int SOIL_MOISTURE_THRESHOLD = 40;

float TANK_DEPTH_CM = 15.0;
float TANK_MIN_DISTANCE = 8.6;
int TANK_CRITICAL_LEVEL = 20;

int LIGHT_THRESHOLD_LOW = 40;
int LIGHT_THRESHOLD_HIGH = 70;
int LIGHT_MIN_RAW = 200;   // Default from sensors.cpp
int LIGHT_MAX_RAW = 3500;  // Default from sensors.cpp

unsigned long TANK_MONITORING_ACTIVE_MS = 60000;   // 1 minute when pumps active
unsigned long TANK_MONITORING_IDLE_MS = 600000;    // 10 minutes in idle
unsigned long ENV_MONITORING_ACTIVE_MS = 60000;    // 1 minute when pumps active
unsigned long ENV_MONITORING_IDLE_MS = 600000;     // 10 minutes in idle

int DATA_SEND_INTERVAL_MIN = 10;           // 10 minutes for data/history updates
int SERVER_POLLING_INTERVAL_SEC = 5;       // 5 seconds for sensor data polling
int STATUS_POLLING_INTERVAL_SEC = 30;      // 30 seconds for status polling

void initLogic() {
    // Lectura inicial
    currentData.status = STATUS_NORMAL;
    currentData.pumpActive = false;
    currentData.tankPumpActive = false;
    currentData.luminaryActive = false;
    
    // Initialize sensors to "No Data"
    currentData.ambientTemp = -999;
    currentData.ambientHumidity = -999;
    currentData.soilTemp = -999;
    currentData.soilMoisture = -999;
    currentData.lightLevel = -999;
    currentData.tankLevel = -999; 
    
    currentData.lastMeasurementTime = 0;
    
    // Don't force initial measurement - wait for normal cycle
    // This prevents adding incomplete data to history
}

void updateSensors() {
    currentData.ambientTemp = readAmbientTemp();
    currentData.ambientHumidity = readAmbientHumidity();
    currentData.soilTemp = readSoilTemp();
    currentData.soilMoisture = readSoilMoisturePercent();
    currentData.soilRaw = readSoilMoistureRaw(); // New: Capture raw value
    
    // Stabilization delay for power rail before Light Sensor
    delay(200);
    currentData.lightLevel = readLightLevel();
    currentData.lightRaw = readLightRaw(); // New: Capture raw value
    // Stabilization delay for power rail before Ultrasonic Sensor
    delay(200);
    
    currentData.motionDetected = readMotionSensor();
    currentData.pumpActive = isPumpRunning;
    currentData.tankPumpActive = isTankPumpRunning;
    currentData.luminaryActive = isLuminaryOn;
    currentData.lastMeasurementTime = millis();
    currentData.timestamp = millis();
    
    // Tank sampling with temperature and humidity correction
    // Use the just-measured ambient temp and humidity for accurate speed of sound calculation
    Serial.println("[TANK] Measuring level with temp/humidity correction...");
    currentData.tankLevel = readTankLevelPercent(currentData.ambientTemp, currentData.ambientHumidity);
    currentData.tankDistance = readRawUltrasonicDistance(); // New: Capture raw distance
    
    if (currentData.tankLevel != -999) {
        Serial.print("[TANK] Level = ");
        Serial.print(currentData.tankLevel);
        Serial.println("%");
    } else {
        Serial.println("[TANK] ERROR: Measurement failed");
    }
    
    Serial.println("\n=== MEDICION REALIZADA ===");
    Serial.print("Timestamp: "); Serial.println(currentData.timestamp);
    Serial.print("Temp: "); Serial.print(currentData.ambientTemp); Serial.println("°C");
    Serial.print("Humedad: "); Serial.print(currentData.ambientHumidity); Serial.println("%");
    Serial.print("Suelo: "); Serial.print(currentData.soilMoisture); Serial.println("%");
    Serial.print("Tanque: "); Serial.print(currentData.tankLevel); Serial.println("%");
    Serial.print("Luz: "); Serial.print(currentData.lightLevel); Serial.println("%");
}

void addToHistory() {
    if (history.size() >= MAX_HISTORY) {
        history.erase(history.begin());
        Serial.println("[HISTORY] Buffer lleno, eliminando punto mas antiguo");
    }
    history.push_back(currentData);
    Serial.print("[HISTORY] Punto agregado. Total en historial: ");
    Serial.println(history.size());
}

bool checkAndMeasure() {
    unsigned long now = millis();
    bool newData = false;
    
    // Logic for Measurement Intervals
    // Default: ENV_MONITORING_IDLE_MS (10 mins)
    // If Active (Pump or Tank): Tank measures at TANK_MONITORING_ACTIVE_MS (1 min)
    
    // 1. Environmental & General Monitoring (Every 1 minute)
    // Wait 1 minute after boot before first measurement
    // 1. Environmental & General Monitoring
    // Use the configurable interval (converted to milliseconds)
    unsigned long monitoringIntervalMs = DATA_SEND_INTERVAL_MIN * 60 * 1000UL;
    
    // Run if it's time OR if it's the very first run (lastMonitorTime == 0)
    if (lastMonitorTime == 0 || (now - lastMonitorTime > monitoringIntervalMs)) {
        lastMonitorTime = now;
        updateSensors(); // Reads all sensors except tank
        addToHistory();  // Save to history every 1 min
        newData = true;
    }
    
    return newData;
}

void runAutomation() {
    unsigned long now = millis();
    
    // Always check security
    if (securityAutoEnabled) {
        checkSecuritySchedule();
    }

    // Run security checks (Alarm, Motion)
    checkSecurityOnly();
    
    // Check for Sensor Errors
    bool sensorError = (currentData.ambientTemp == -999 || 
                        currentData.ambientHumidity == -999 || 
                        currentData.tankLevel == -999);
    
    if (sensorError) {
        if (currentData.status != STATUS_ALARM) { // Alarm has higher priority
            currentData.status = STATUS_SENSOR_ERROR;
        }
    } else if (currentData.status == STATUS_SENSOR_ERROR) {
        currentData.status = STATUS_NORMAL;
    }
}

void checkSecurityOnly() {
    unsigned long now = millis();
    
    if (securityModeEnabled) {
        // If already in alarm, do nothing (wait for user to clear)
        // effectively "stopping" the motion sensor from triggering new events
        if (currentData.status == STATUS_ALARM) {
            // Pulsing Alarm Logic (Non-blocking)
            if (now - lastAlarmToggle > 500) { // Toggle every 500ms
                lastAlarmToggle = now;
                alarmState = !alarmState;
                
                if (alarmState) {
                    setBuzzer(true);       // "Pi"
                    setSecurityLed(false); // Blink OFF
                } else {
                    setBuzzer(false);      // Silence
                    setSecurityLed(true);  // Blink ON
                }
            }
        } 
        // If not in alarm, check for motion
        else if (readMotionSensor()) {
            currentData.status = STATUS_ALARM;
            // Start alarm sequence
            alarmState = true;
            lastAlarmToggle = now;
            setBuzzer(true);
            setSecurityLed(false); // Start blinking
            Serial.println("[SECURITY] INTRUDER DETECTED! Alarm Active.");
        }
    }

    // Safety Checks & Automation
    
    // CRITICAL: Don't run any automation until we have valid sensor data
    // This prevents pumps from activating based on initial -999 values
    if (currentData.lastMeasurementTime == 0) {
        // System is still initializing, skip all automation logic
        return;
    }
    
    // 1. Tank Safety (Low Level)
    if (currentData.tankLevel < TANK_CRITICAL_LEVEL) {
        if (currentData.status != STATUS_ALARM) {
             currentData.status = STATUS_WARNING;
        }
        
        // Safety: Stop Irrigation if Tank is Low
        if (isPumpRunning) {
            setPumpState(false);
            isPumpRunning = false;
            pumpForced = false; // Cancel manual force
        }
    } else {
        if (currentData.status != STATUS_ALARM && currentData.status != STATUS_WARNING) {
            currentData.status = STATUS_NORMAL;
        } else if (currentData.status == STATUS_WARNING && currentData.tankLevel >= TANK_CRITICAL_LEVEL + 5) {
             // Clear warning with hysteresis
             currentData.status = STATUS_NORMAL;
        }
    }
    
    // 2. Irrigation Logic (Auto)
    if (irrigationAutoEnabled && !pumpForced && !tankForced && !isTankPumpRunning) { // Don't auto-irrigate if filling tank
        // Check for valid sensor readings before automation
        if (currentData.soilMoisture != -999 && currentData.soilMoisture < SOIL_MOISTURE_THRESHOLD && currentData.tankLevel > TANK_CRITICAL_LEVEL) {
            if (!isPumpRunning) {
                setPumpState(true);
                isPumpRunning = true;
                pumpStartTime = now;
                currentPumpDuration = PUMP_RUN_TIME_MS; // Use default for auto
            }
        } else if (currentData.soilMoisture >= 80) {
            if (isPumpRunning) {
                setPumpState(false);
                isPumpRunning = false;
            }
        }
    } else {
        // If auto is disabled and pump is running (not forced manually), turn it off
        if (!irrigationAutoEnabled && isPumpRunning && !pumpForced) {
            setPumpState(false);
            isPumpRunning = false;
        }
    }

    // 3. Pump Safety Timeout
    if (isPumpRunning && (now - pumpStartTime > currentPumpDuration)) {
        setPumpState(false);
        isPumpRunning = false;
        pumpForced = false;
    }

    // 4. Luminary Logic (Auto)
    if (luminaryAutoEnabled && !luminaryForced) {
        if (currentData.lightLevel < LIGHT_THRESHOLD_LOW) {
            if (!isLuminaryOn) {
                setLuminaryState(true);
                isLuminaryOn = true;
            }
        } else if (currentData.lightLevel > LIGHT_THRESHOLD_HIGH) {
            if (isLuminaryOn) {
                setLuminaryState(false);
                isLuminaryOn = false;
            }
        }
    }

    // 5. Tank Logic (Auto)
    if (tankAutoEnabled && !tankForced) {
        // Start filling if level is low (e.g., < 20%)
        // Check for valid sensor reading
        if (currentData.tankLevel != -999) {
            if (currentData.tankLevel < TANK_CRITICAL_LEVEL) {
                if (!isTankPumpRunning) {
                    // Safety: Stop Irrigation Pump first (Mutual Exclusion)
                    if (isPumpRunning) {
                        setPumpState(false);
                        isPumpRunning = false;
                        pumpForced = false;
                    }
                    
                    setTankPumpState(true);
                    isTankPumpRunning = true;
                    Serial.println("[TANK] Auto-Fill STARTED (Level < Critical)");
                }
            } 
            // Stop filling if level is high (e.g., 100%)
            else if (currentData.tankLevel >= TANK_MAX_LEVEL) {
                if (isTankPumpRunning) {
                    setTankPumpState(false);
                    isTankPumpRunning = false;
                    Serial.println("[TANK] Auto-Fill STOPPED (Tank Full)");
                }
            }
        }
    }
}

SystemData getSystemData() {
    currentData.pumpActive = isPumpRunning;
    currentData.tankPumpActive = isTankPumpRunning;
    currentData.luminaryActive = isLuminaryOn;
    return currentData;
}

void setSecurityMode(bool enabled) {
    securityModeEnabled = enabled;
    setSecurityLed(enabled); // Turn on/off the dedicated Security LED
    
    if (!enabled) {
        setBuzzer(false);
        if (currentData.status == STATUS_ALARM) {
            currentData.status = STATUS_NORMAL;
// Removed indicateStatus call
        }
    }
}

bool getSecurityMode() {
    return securityModeEnabled;
}

void setSecurityAuto(bool enabled) {
    securityAutoEnabled = enabled;
    
    // When disabling Auto, also turn off security mode if it's currently on
    if (!enabled && securityModeEnabled) {
        setSecurityMode(false); // This will turn off LED and buzzer
    }
    
    Serial.print("[SECURITY] Auto mode: ");
    Serial.println(enabled ? "ON" : "OFF");
}

bool getSecurityAuto() {
    return securityAutoEnabled;
}

void setIrrigationAuto(bool enabled) {
    irrigationAutoEnabled = enabled;
    if (enabled) {
        // Reset pump state to ensure clean start for auto logic
        // This prevents "manual button" from appearing active immediately if conditions are met
        // The auto logic will pick it up in the next loop if needed
        if (isPumpRunning && !pumpForced) {
             setPumpState(false);
             isPumpRunning = false;
        }
    } else {
        // When disabling Auto, turn off pump if it was running in auto mode (not manual)
        if (isPumpRunning && !pumpForced) {
            setPumpState(false);
            isPumpRunning = false;
        }
    }
    Serial.print("[IRRIGATION] Auto mode: ");
    Serial.println(enabled ? "ON" : "OFF");
}

bool getIrrigationAuto() {
    return irrigationAutoEnabled;
}

void setTankAuto(bool enabled) {
    tankAutoEnabled = enabled;
    Serial.print("[TANK] Auto mode: ");
    Serial.println(enabled ? "ON" : "OFF");
}

bool getTankAuto() {
    return tankAutoEnabled;
}

void setLuminaryAuto(bool enabled) {
    luminaryAutoEnabled = enabled;
    if (enabled) {
        luminaryForced = false; // Clear manual override
        // Don't evaluate light level here - let the normal automation cycle handle it
    }
    Serial.print("[LUMINARY] Auto mode: ");
    Serial.println(enabled ? "ON" : "OFF");
}

bool getLuminaryAuto() {
    return luminaryAutoEnabled;
}

void forcePump(bool enable, int durationMinutes) {
    pumpForced = enable;
    if (enable) {
        // Set custom duration if provided, otherwise use default
        if (durationMinutes > 0) {
            currentPumpDuration = durationMinutes * 60 * 1000UL;
            Serial.print("[PUMP] Manual Duration: ");
            Serial.print(durationMinutes);
            Serial.println(" min");
        } else {
            currentPumpDuration = PUMP_RUN_TIME_MS;
        }
        // Mutual Exclusion: Stop Tank Pump
        if (isTankPumpRunning) {
            forceTank(false);
        }
        
        // Safety: Check Tank Level
        if (currentData.tankLevel > TANK_CRITICAL_LEVEL) {
            setPumpState(true);
            isPumpRunning = true;
            pumpStartTime = millis();
        }
    } else {
        setPumpState(false);
        isPumpRunning = false;
    }
}

void forceTank(bool enable) {
    tankForced = enable;
    if (enable) {
        // Mutual Exclusion: Stop Irrigation Pump
        if (isPumpRunning) {
            forcePump(false);
        }
        
        setTankPumpState(true);
        isTankPumpRunning = true;
    } else {
        setTankPumpState(false);
        isTankPumpRunning = false;
    }
}

void forceLuminary(bool enable) {
    // When manual is activated, disable Auto
    if (enable || !enable) { // Any manual interaction
        luminaryAutoEnabled = false; // Disable Auto
        luminaryForced = true;       // Set manual override flag
    }
    
    setLuminaryState(enable);
    isLuminaryOn = enable;
    
    Serial.print("[LUMINARY] Manual override: ");
    Serial.println(enable ? "ON" : "OFF");
}

void setSecuritySchedule(String start, String end) {
    // Format: "HH:MM"
    int sep1 = start.indexOf(':');
    int sep2 = end.indexOf(':');
    
    if (sep1 > 0 && sep2 > 0) {
        securityStartHour = start.substring(0, sep1).toInt();
        securityStartMinute = start.substring(sep1 + 1).toInt();
        
        securityEndHour = end.substring(0, sep2).toInt();
        securityEndMinute = end.substring(sep2 + 1).toInt();
        
        Serial.printf("[SCHEDULE] Set: %02d:%02d to %02d:%02d\n", 
                      securityStartHour, securityStartMinute, 
                      securityEndHour, securityEndMinute);
    }
}

String getSecurityStartTime() {
    if (securityStartHour == -1) return "22:00"; // Default
    char buffer[6];
    sprintf(buffer, "%02d:%02d", securityStartHour, securityStartMinute);
    return String(buffer);
}

String getSecurityEndTime() {
    if (securityEndHour == -1) return "06:00"; // Default
    char buffer[6];
    sprintf(buffer, "%02d:%02d", securityEndHour, securityEndMinute);
    return String(buffer);
}

void checkSecuritySchedule() {
    if (securityStartHour == -1 || securityEndHour == -1) return;
    
    struct tm timeinfo;
    // Add timeout to prevent blocking (100ms max)
    if (!getLocalTime(&timeinfo, 100)) {
        // NTP not synced or timeout - skip this check
        return;
    }
    
    int currentMinutes = timeinfo.tm_hour * 60 + timeinfo.tm_min;
    int startMinutes = securityStartHour * 60 + securityStartMinute;
    int endMinutes = securityEndHour * 60 + securityEndMinute;
    
    bool insideWindow = false;
    
    if (startMinutes < endMinutes) {
        // Normal day schedule (e.g., 08:00 to 20:00)
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            insideWindow = true;
        }
    } else {
        // Overnight schedule (e.g., 22:00 to 06:00)
        if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
            insideWindow = true;
        }
    }
    
    if (insideWindow && !securityModeEnabled) {
        Serial.println("[SCHEDULE] Auto-Arming Security");
        setSecurityMode(true);
    } else if (!insideWindow && securityModeEnabled) {
        Serial.println("[SCHEDULE] Auto-Disarming Security");
        setSecurityMode(false);
    }
}

void setIrrigationManual(bool enable, int durationMinutes) {
    irrigationAutoEnabled = false; // Always disable auto when manual is used
    forcePump(enable, durationMinutes);
}

void setTankManual(bool enable) {
    tankAutoEnabled = false; // Always disable auto when manual is used
    forceTank(enable);
}

void setSecurityManual(bool enable) {
    setSecurityMode(enable);
}

void setLuminaryManual(bool enable) {
    luminaryAutoEnabled = false; // Always disable auto when manual is used
    forceLuminary(enable);
}

bool getLuminaryMode() {
    return isLuminaryOn;
}

void clearAlarm() {
    if (currentData.status == STATUS_ALARM) {
        currentData.status = STATUS_NORMAL;
        setBuzzer(false);
        setSecurityLed(securityModeEnabled); // Restore LED to security mode state
        alarmState = false;
        Serial.println("[SECURITY] Alarm cleared by user");
    }
}
