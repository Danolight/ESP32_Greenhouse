#include "sensors.h"
#include <algorithm>
#include <vector>

DHT dht(DHT_PIN, DHT11);
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void initSensors() {
    dht.begin();
    
    // DHT11 needs 2 seconds to stabilize after power-on
    delay(2000);
    
    // Perform dummy reads to flush initial garbage data
    dht.readTemperature();
    dht.readHumidity();
    
    sensors.begin();
    pinMode(PIR_PIN, INPUT);
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(SOIL_MOISTURE_PIN, INPUT);
    pinMode(LDR_PIN, INPUT);
    
    // Attach interrupt for PIR sensor
    attachInterrupt(digitalPinToInterrupt(PIR_PIN), []() {
        extern volatile bool motionDetectedFlag;
        motionDetectedFlag = true;
    }, RISING);
}

// Flag to capture motion events from ISR
volatile bool motionDetectedFlag = false;

float readAmbientTemp() {
    const int NUM_SAMPLES = 10;
    const int TRIM_COUNT = 2; // Remove top 2 and bottom 2
    std::vector<float> samples;
    
    // Take 10 samples with small delay
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        float t = dht.readTemperature();
        if (!isnan(t)) {
            samples.push_back(t);
        }
        delay(100); // DHT11 needs time between readings
    }
    
    // Need at least enough samples to trim
    if (samples.size() < (TRIM_COUNT * 2 + 1)) return -999.0;
    
    // Sort samples to identify outliers
    std::sort(samples.begin(), samples.end());
    
    // Calculate Trimmed Mean (average of central values)
    float sum = 0;
    int count = 0;
    
    for (size_t i = TRIM_COUNT; i < samples.size() - TRIM_COUNT; ++i) {
        sum += samples[i];
        count++;
    }
    
    if (count == 0) return -999.0;
    
    float avgTemp = sum / count;
    
    // Round to 1 decimal place
    return round(avgTemp * 10.0) / 10.0;
}

float readAmbientHumidity() {
    const int NUM_SAMPLES = 10;
    const int TRIM_COUNT = 2; // Remove top 2 and bottom 2
    std::vector<float> samples;
    
    // Take 10 samples with small delay
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        float h = dht.readHumidity();
        if (!isnan(h)) {
            samples.push_back(h);
        }
        delay(100); // DHT11 needs time between readings
    }
    
    // Need at least enough samples to trim
    if (samples.size() < (TRIM_COUNT * 2 + 1)) return -999.0;
    
    // Sort samples to identify outliers
    std::sort(samples.begin(), samples.end());
    
    // Calculate Trimmed Mean (average of central values)
    float sum = 0;
    int count = 0;
    
    for (size_t i = TRIM_COUNT; i < samples.size() - TRIM_COUNT; ++i) {
        sum += samples[i];
        count++;
    }
    
    if (count == 0) return -999.0;
    
    float avgHumidity = sum / count;
    
    // Round to 1 decimal place
    return round(avgHumidity * 10.0) / 10.0;
}

float readSoilTemp() {
    sensors.requestTemperatures();
    float t = sensors.getTempCByIndex(0);
    if (t == DEVICE_DISCONNECTED_C) return -999.0;
    return t;
}

int readSoilMoisturePercent() {
    const int NUM_SAMPLES = 10;
    const int TRIM_COUNT = 2; // Remove top 2 and bottom 2
    std::vector<int> samples;
    
    // Take 10 samples with small delay
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        int raw = analogRead(SOIL_MOISTURE_PIN);
        if (raw >= 100) { // Only add valid readings
            samples.push_back(raw);
        }
        delay(2); // Reduced delay to 2ms
    }
    
    // Need at least enough samples to trim
    if (samples.size() < (TRIM_COUNT * 2 + 1)) return -999;
    
    // Sort samples to identify outliers
    std::sort(samples.begin(), samples.end());
    
    // Calculate Trimmed Mean (average of central values)
    int sum = 0;
    int count = 0;
    
    for (size_t i = TRIM_COUNT; i < samples.size() - TRIM_COUNT; ++i) {
        sum += samples[i];
        count++;
    }
    
    if (count == 0) return -999;
    
    int avgRaw = sum / count;
    Serial.println(avgRaw);
    // Map to percentage
    int percent = map(avgRaw, SOIL_DRY, SOIL_WET, 0, 100);
    return constrain(percent, 0, 100);
}

int readTankLevelPercent(float temp, float humidity) {
    const int NUM_SAMPLES = 20;
    const int TRIM_COUNT = 7;
    std::vector<float> distances;
    
    // Calculate speed of sound with temperature and humidity correction
    // Formula: v = 331.3 + 0.606*T + 0.0124*H (m/s)
    // where T is temperature in °C and H is relative humidity in %
    float speedOfSound = 331.3 + (0.606 * temp) + (0.0124 * humidity);
    
    // Convert to cm/us: speedOfSound (m/s) * 100 (cm/m) / 1000000 (us/s) = speedOfSound / 10000
    float conversionFactor = speedOfSound / 10000.0; // One-way conversion
    
    // If temp/humidity sensors failed, fall back to standard speed (343 m/s at 20°C)
    if (temp == -999 || humidity == -999) {
        conversionFactor = 0.0343; // Standard: 343 m/s = 0.0343 cm/us
    }
    
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        // Ensure trigger is LOW for at least 5us before pulsing
        digitalWrite(TRIG_PIN, LOW);
        delayMicroseconds(5);
        
        // Send 10us HIGH pulse to trigger
        digitalWrite(TRIG_PIN, HIGH);
        delayMicroseconds(10);
        digitalWrite(TRIG_PIN, LOW);

        // Wait for echo with 35ms timeout (enough for ~6m max distance)
        long duration = pulseIn(ECHO_PIN, HIGH, 35000);
        
        if (duration > 0) {
            // Calculate distance with corrected speed of sound
            float distanceCm = (duration * conversionFactor) / 2.0; // Divide by 2 for one-way distance
            
            // Valid range check (2cm to 400cm for HC-SR04)
            if (distanceCm >= 2.0 && distanceCm <= 400.0) {
                distances.push_back(distanceCm);
                Serial.print("Distancia: ");
                Serial.println(distanceCm);
            }
        }

        // Reduced delay to 30ms (User requested optimization)
        delay(30); 
    }
    
    // Need at least enough samples to trim
    if (distances.size() < (TRIM_COUNT * 2 + 1)) return -999;
    
    // Sort to separate outliers
    std::sort(distances.begin(), distances.end());
    
    // Calculate Trimmed Mean (average of the central values)
    float sum = 0;
    int count = 0;
    // Start after bottom trim, end before top trim
    for (size_t i = TRIM_COUNT; i < distances.size() - TRIM_COUNT; ++i) {
        sum += distances[i];
        count++;
    }
    
    if (count == 0) return -999;
    
    float avgDistance = sum / count;
    
    // No rounding - keep full precision for accurate percentage calculation
    Serial.print("Distancia Promedio (Usada): ");
    Serial.println(avgDistance);
    
    // Constrain to valid range BEFORE calculation
    // If distance >= TANK_DEPTH_CM (15.0), tank is empty (0%)
    if (avgDistance >= TANK_DEPTH_CM) return 0;
    
    // If distance <= TANK_MIN_DISTANCE (8.5), tank is full (100%)
    if (avgDistance <= TANK_MIN_DISTANCE) return 100;

    // Calculate percentage for values in between
    float effectiveDepth = (float)TANK_DEPTH_CM - TANK_MIN_DISTANCE;
    float currentLevel = (float)TANK_DEPTH_CM - avgDistance;
    
    float percent = (currentLevel / effectiveDepth) * 100.0;
    
    return constrain((int)percent, 0, 100);
}

// Read Light Level (LDR) with robust trimmed mean filter
int readLightLevel() {
    const int NUM_SAMPLES = 10;
    const int TRIM_COUNT = 2;
    std::vector<int> samples;
    
    // Take 10 samples with small delay
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        samples.push_back(analogRead(LDR_PIN));
        delay(2);
    }
    
    // Sort samples
    std::sort(samples.begin(), samples.end());
    
    // Trim outliers (remove top 25% and bottom 25%)
    int trimCount = NUM_SAMPLES / 4; // Remove 5 from each end
    int sum = 0;
    int count = 0;
    
    for (size_t i = trimCount; i < samples.size() - trimCount; ++i) {
        sum += samples[i];
        count++;
    }
    
    if (count == 0) return -999;
    
    int avgValue = sum / count;
    
    // Sensor not connected or reading too low
    if (avgValue < 10) return -999;
    
    // Calibrated range: LIGHT_MIN_RAW -> 0%, LIGHT_MAX_RAW -> 100%
    if (avgValue <= LIGHT_MIN_RAW) return 0;
    if (avgValue >= LIGHT_MAX_RAW) return 100;
    Serial.println(avgValue);
    int percent = map(avgValue, LIGHT_MIN_RAW, LIGHT_MAX_RAW, 0, 100);
    return constrain(percent, 0, 100);
}

bool readMotionSensor() {
    extern volatile bool motionDetectedFlag;
    if (motionDetectedFlag) {
        motionDetectedFlag = false; // Reset flag
        return true;
    }
    return digitalRead(PIR_PIN) == HIGH;
}

// Read raw soil moisture ADC value (0-4095)
int readSoilMoistureRaw() {
    const int NUM_SAMPLES = 10;
    const int TRIM_COUNT = 2;
    std::vector<int> samples;
    
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        int raw = analogRead(SOIL_MOISTURE_PIN);
        if (raw >= 100) {
            samples.push_back(raw);
        }
        delay(2);
    }
    
    if (samples.size() < (TRIM_COUNT * 2 + 1)) return -999;
    
    std::sort(samples.begin(), samples.end());
    
    int sum = 0;
    int count = 0;
    for (size_t i = TRIM_COUNT; i < samples.size() - TRIM_COUNT; ++i) {
        sum += samples[i];
        count++;
    }
    
    if (count == 0) return -999;
    return sum / count;
}

// Read raw light sensor ADC value (0-4095)
int readLightRaw() {
    const int NUM_SAMPLES = 10;
    const int TRIM_COUNT = 2;
    std::vector<int> samples;
    
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        samples.push_back(analogRead(LDR_PIN));
        delay(2);
    }
    
    std::sort(samples.begin(), samples.end());
    
    int trimCount = NUM_SAMPLES / 4;
    int sum = 0;
    int count = 0;
    
    for (size_t i = trimCount; i < samples.size() - trimCount; ++i) {
        sum += samples[i];
        count++;
    }
    
    if (count == 0) return -999;
    
    int avgValue = sum / count;
    if (avgValue < 10) return -999;
    
    return avgValue;
}

// Read raw ultrasonic distance in cm
float readRawUltrasonicDistance() {
    const int NUM_SAMPLES = 5; // Fewer samples for faster reading
    std::vector<float> distances;
    
    // Use default speed of sound (can be improved with temp/humidity)
    float conversionFactor = 0.0343; // 343 m/s = 0.0343 cm/us
    
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        digitalWrite(TRIG_PIN, LOW);
        delayMicroseconds(5);
        
        digitalWrite(TRIG_PIN, HIGH);
        delayMicroseconds(10);
        digitalWrite(TRIG_PIN, LOW);
        
        long duration = pulseIn(ECHO_PIN, HIGH, 35000);
        
        if (duration > 0) {
            float distanceCm = (duration * conversionFactor) / 2.0;
            if (distanceCm >= 2.0 && distanceCm <= 400.0) {
                distances.push_back(distanceCm);
            }
        }
        delay(30);
    }
    
    if (distances.size() == 0) return -999.0;
    
    // Simple average
    float sum = 0;
    for (float d : distances) {
        sum += d;
    }
    
    return sum / distances.size();
}

