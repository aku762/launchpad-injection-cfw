#include "mode/system/boot.h"
#include "led/led.h"
#include "mode/mode.h"

// Boot animation tables removed (2026-06-16) — they cost ~2.5s of dead time
// where the device looked alive (LED animation) but ignored all input,
// confusing testing of the mode it boots into. Mini now hands off instantly.
void boot_init() {
    mode_switch(MODE_DEFAULT);
}

void boot_timer_event() { }
void boot_surface_event(uint8_t type, uint8_t index, uint8_t value) { (void)type; (void)index; (void)value; }
void boot_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2) { (void)port; (void)status; (void)d1; (void)d2; }
void boot_aftertouch_event(uint8_t index, uint8_t value) { (void)index; (void)value; }
