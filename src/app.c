#include "app.h"
#include "led/led.h"
#include "mode/mode.h"
#include "flash/flash.h"
#include "utils/sysex.h"
#include "utils/cc_state.h"
#include "driver/driver.h"

uint8_t setup_button_down = 0;
uint16_t setup_button_tick = 0;

void app_init() {
    setup_button_down = 0;
    setup_button_tick = 0;

    cc_state_init();
    flash_read();

    mode_switch(MODE_BOOT);
}

void app_timer_event() {
    if (current_mode != MODE_SETUP) {
        if (setup_button_tick >= 750) {
            modes[current_mode].surface_event(0, 19, 0);
            setup_button_down = 0;
            setup_button_tick = 0;

            mode_switch(MODE_SETUP);
        } else if (setup_button_down) {
            setup_button_tick++;
        }
    }

    modes[current_mode].timer_event();
}

void app_surface_event(uint8_t type, uint8_t index, uint8_t value) {
    if (current_mode != MODE_SETUP && current_mode != MODE_BOOT) {
        if (type && index == 19) {
            setup_button_down = 1;
        } else if (type == 0 && index == 19) {
            setup_button_down = 0;
            setup_button_tick = 0;
        }
    }

    modes[current_mode].surface_event(type, index, value);
}


void app_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2) {
    modes[current_mode].midi_event(port, status, d1, d2);
}


void app_aftertouch_event(uint8_t index, uint8_t value) {
    modes[current_mode].aftertouch_event(index, value);
}

void app_sysex_event(uint8_t port, uint8_t* buf, uint16_t len) {
    handle_sysex(buf, len);
}
