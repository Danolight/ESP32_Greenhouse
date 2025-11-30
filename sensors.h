#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>
#include "config.h"
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>

void initSensors();

float readAmbientTemp();
float readAmbientHumidity();
float readSoilTemp();
int readSoilMoisturePercent();
int readTankLevelPercent(float temp, float humidity);

bool readMotionSensor();
int readLightLevel(); // Returns percentage 0-100
int readSoilMoistureRaw(); // Returns raw ADC value
int readLightRaw(); // Returns raw ADC value
float readRawUltrasonicDistance(); // Returns distance in cm

#endif // SENSORS_H
