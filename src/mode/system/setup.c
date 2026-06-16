#include "mode/system/setup.h"
#include "mode/mode.h"
#include "driver/driver.h"
#include "led/led.h"
#include "flash/settings.h"
#include "flash/flash.h"

__attribute__((section(".cfw_injection_misc_1")))
static const uint32_t headline_leds[22][2] = {
    { 81, 0x2020ff }, { 71, 0x2020ff }, { 61, 0x2020ff }, { 51, 0x2020ff }, { 52, 0x2020ff }, { 83, 0xccccff }, { 84, 0xccccff }, { 85, 0xccccff }, { 73, 0xccccff }, { 74, 0xccccff }, { 63, 0xccccff }, { 53, 0xccccff }, { 54, 0xccccff }, { 55, 0xccccff }, { 86, 0x2020ff }, { 87, 0x2020ff }, { 76, 0x2020ff }, { 78, 0x2020ff }, { 66, 0x2020ff }, { 68, 0x2020ff }, { 56, 0x2020ff }, { 57, 0x2020ff },
};

void setup_init() {
    for (uint8_t i = 0; i < 22; ++i) {
        set_led(headline_leds[i][0], headline_leds[i][1]);
    }

    uint8_t brightness = driver_get_brightness();

    for (uint8_t i = 0; i < 8; ++i) {
        set_led(31 + i, 0x101010);
    }

    set_led(31 + brightness, 0xccccff);
}

void setup_timer_event() { }

void setup_surface_event(uint8_t type, uint8_t index, uint8_t value) {
    if (type != 1) return;

    if (index == 19 || (index == 0 && value != 0)) {
        mode_switch(mode);
        flash_write();
        return;
    }

    if (index >= 31 && index <= 38) {
        uint8_t new_brightness = index - 31;
        driver_set_brightness(new_brightness);
        settings_brightness = new_brightness;

        setup_init();
    }
}

void setup_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2) { }

void setup_aftertouch_event(uint8_t index, uint8_t value) { }
