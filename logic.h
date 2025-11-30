#ifndef LOGIC_H
#define LOGIC_H

#include <Arduino.h>
#include "time.h"
#include "config.h"
#include "sensors.h"
#include "actuators.h"

enum SystemStatus {
    STATUS_NORMAL = 0,
    STATUS_WARNING = 1,
    STATUS_ALARM = 2,
    STATUS_SENSOR_ERROR = 3
};

struct SystemData {
    float ambientTemp;
    float ambientHumidity;
    float soilTemp;
    int soilMoisture;
    int soilRaw;       // New: Raw ADC value
    int tankLevel;
    float tankDistance; // New: Raw distance in cm
    int lightLevel;
    int lightRaw;      // New: Raw ADC value
    bool motionDetected;
    bool pumpActive;
    bool tankPumpActive;
    bool luminaryActive; // New field
    SystemStatus status;
    unsigned long lastMeasurementTime; // Global last update time
    unsigned long timestamp;           // Time of this specific record
};

void initLogic();
void updateSensors();
void addToHistory();
bool checkAndMeasure();
void runAutomation();
SystemData getSystemData();
void setSecurityMode(bool enabled);
bool getSecurityMode();
void setSecurityAuto(bool enabled);
bool getSecurityAuto();
void setIrrigationAuto(bool enabled);
bool getIrrigationAuto();
void setIrrigationManual(bool enable, int durationMinutes = 0);
void setTankAuto(bool enabled);
bool getTankAuto();
void setTankManual(bool enable);
void setLuminaryAuto(bool enabled); // New
bool getLuminaryAuto();             // New
bool getLuminaryMode();             // Get current luminary state
void setLuminaryManual(bool enable);
void setSecurityManual(bool enable);
void forcePump(bool enable, int durationMinutes = 0);
void forceTank(bool enable);
void forceLuminary(bool enable);    // New
void setSecuritySchedule(String start, String end);
String getSecurityStartTime();
String getSecurityEndTime();
void checkSecuritySchedule();
void checkSecurityOnly(); // New function for non-blocking checks
void clearAlarm();

#include <vector>
extern std::vector<SystemData> history;

#endif // LOGIC_H
