#include "actuators.h"

void initActuators() {
    pinMode(RELAY_PIN, OUTPUT);
    pinMode(RELAY_TANK_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(SECURITY_LED_PIN, OUTPUT);
    pinMode(LUMINARY_LED_PIN, OUTPUT);

    // Inicializar estados (LEDs apagados)
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(RELAY_TANK_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(SECURITY_LED_PIN, LOW);
    digitalWrite(LUMINARY_LED_PIN, LOW);
}

void setPumpState(bool state) {
    digitalWrite(RELAY_PIN, state ? HIGH : LOW);
}

void setTankPumpState(bool state) {
    digitalWrite(RELAY_TANK_PIN, state ? HIGH : LOW);
}

void setBuzzer(bool state) {
    if (state) {
        // Generate 2000Hz alarm tone (typical alarm frequency)
        tone(BUZZER_PIN, 2000);
    } else {
        // Stop the tone
        noTone(BUZZER_PIN);
    }
}

void setBuzzerTone(int frequency, int duration) {
    tone(BUZZER_PIN, frequency, duration);
}

void setSecurityLed(bool state) {
    digitalWrite(SECURITY_LED_PIN, state ? HIGH : LOW);
}

void setLuminaryState(bool state) {
    digitalWrite(LUMINARY_LED_PIN, state ? HIGH : LOW);
}
