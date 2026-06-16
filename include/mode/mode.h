#ifndef MODE_H
#define MODE_H

#include <stdint.h>

extern uint8_t current_mode;
extern uint8_t mode;

#define MODES_COUNT 6

// Slots 0-3 are targetable by in-mode "mode_switch" buttons (see
// editor widgets of type mode_switch / tools/json_to_mode.py). Every
// value a mode_switch button can send MUST have a real entry here —
// mode_switch() has no bounds check, so an out-of-range target reads
// garbage out of modes[] and crashes/bricks the device.

#define MODE_SHOWCASE 0
#include "mode/user/showcase.h"

#define MODE_MEGA_FADERS 1
#include "mode/user/mega_faders.h"

#define MODE_PERFORMANCE 2
#include "mode/user/performance.h"

#define MODE_PROGRAMMER 3
#include "mode/user/programmer.h"

#define MODE_BOOT 4
#include "mode/system/boot.h"

#define MODE_SETUP 5
#include "mode/system/setup.h"

struct Mode {
    char * name;
    uint32_t color;
    uint32_t color_dimmed;
    void (*init)();
    void (*timer_event)();
    void (*surface_event)(uint8_t type, uint8_t index, uint8_t value);
    void (*midi_event)(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
    void (*aftertouch_event)(uint8_t index, uint8_t value);
};

extern const struct Mode modes[MODES_COUNT];

void mode_switch(uint8_t m);
void mode_refresh();

#endif
