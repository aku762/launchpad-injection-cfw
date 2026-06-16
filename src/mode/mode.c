#include "mode/mode.h"
#include "led/led.h"

uint8_t current_mode = 0;
uint8_t mode = 0;

const struct Mode modes[MODES_COUNT] = {
    {
        .name = "Showcase",
        .color = 0x22eeff,
        .color_dimmed = 0x0a2233,
        .init = showcase_init,
        .timer_event = showcase_timer_event,
        .surface_event = showcase_surface_event,
        .midi_event = showcase_midi_event,
        .aftertouch_event = showcase_aftertouch_event
    },
    {
        .name = "Mega Faders",
        .color = 0x00ff88,
        .color_dimmed = 0x003322,
        .init = mega_faders_init,
        .timer_event = mega_faders_timer_event,
        .surface_event = mega_faders_surface_event,
        .midi_event = mega_faders_midi_event,
        .aftertouch_event = mega_faders_aftertouch_event
    },
    {
        .name = "Performance",
        .color = 0x4000ff,
        .color_dimmed = 0x100040,
        .init = performance_init,
        .timer_event = performance_timer_event,
        .surface_event = performance_surface_event,
        .midi_event = performance_midi_event,
        .aftertouch_event = performance_aftertouch_event
    },
    {
        .name = "Programmer",
        .color = 0xff4000,
        .color_dimmed = 0x401000,
        .init = programmer_init,
        .timer_event = programmer_timer_event,
        .surface_event = programmer_surface_event,
        .midi_event = programmer_midi_event,
        .aftertouch_event = programmer_aftertouch_event
    },
    {
        .name = "Boot",
        .color = 0x000000,
        .color_dimmed = 0x000000,
        .init = boot_init,
        .timer_event = boot_timer_event,
        .surface_event = boot_surface_event,
        .midi_event = boot_midi_event,
        .aftertouch_event = boot_aftertouch_event
    },
    {
        .name = "Setup",
        .color = 0x000000,
        .color_dimmed = 0x000000,
        .init = setup_init,
        .timer_event = setup_timer_event,
        .surface_event = setup_surface_event,
        .midi_event = setup_midi_event,
        .aftertouch_event = setup_aftertouch_event
    }
};

void mode_switch(uint8_t m) {
    uint8_t prev = current_mode;
    current_mode = m;
    
    if (m != MODE_SETUP) {
        mode = m;
    }

    mode_refresh();
}

void mode_refresh() {
    clear_led();
    
    modes[current_mode].init();
}
