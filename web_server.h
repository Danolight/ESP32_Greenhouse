#ifndef WEB_SERVER_H
#define WEB_SERVER_H

#include <Arduino.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include "logic.h"
#include <SPIFFS.h>

void setupWebServer();
void handleClient();
void handleStatus();

#endif // WEB_SERVER_H
