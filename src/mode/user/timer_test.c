#include "mode/user/timer_test.h"
#include "mode/mode.h"
#include "led/led.h"
#include "driver/driver.h"

// Sends CC 0 ch1 toggling 0<->127 every TOGGLE_TICKS ticks.
// Time the interval between toggles in a MIDI monitor:
//   tick_period_ms = measured_interval_ms / TOGGLE_TICKS
#define TOGGLE_TICKS 1000

__attribute__((section(".cfw_bss"))) static uint32_t tick_count;
__attribute__((section(".cfw_bss"))) static uint8_t  toggle_val;

static void send_cc(uint8_t ch, uint8_t cc, uint8_t val) {
    uint8_t buf[3] = { (uint8_t)(0xB0 | ch), cc, val };
    driver_send_midi(0, buf, 3);
}

void timer_test_init() {
    tick_count = 0;
    toggle_val = 0;

    // Dim white grid so it's obvious which mode is active
    for (uint8_t row = 1; row <= 8; row++)
        for (uint8_t col = 1; col <= 8; col++)
            set_led(row * 10 + col, 0x111111);
}

void timer_test_timer_event() {
    tick_count++;
    if (tick_count >= TOGGLE_TICKS) {
        tick_count = 0;
        toggle_val = toggle_val ? 0 : 127;
        send_cc(0, 0, toggle_val);
    }
}

void timer_test_surface_event(uint8_t type, uint8_t index, uint8_t value) {
    (void)type; (void)index; (void)value;
}

void timer_test_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2) {
    (void)port; (void)status; (void)d1; (void)d2;
}

void timer_test_aftertouch_event(uint8_t index, uint8_t value) {
    (void)index; (void)value;
}