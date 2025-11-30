#ifndef ACTUATORS_H
#define ACTUATORS_H

#include <Arduino.h>
#include "config.h"

void initActuators();
void setPumpState(bool state);
void setTankPumpState(bool state);
void setBuzzer(bool state);
void setBuzzerTone(int frequency, int duration);
void setSecurityLed(bool state);
void setLuminaryState(bool state);

#endif // ACTUATORS_H
