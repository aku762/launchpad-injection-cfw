#include "mode/mode.h"
#include "led/led.h"

uint8_t current_mode = 0;
uint8_t mode = 0;

const struct Mode modes[MODES_COUNT] = {
    {
        .name = "Mixer",
        .color = 0x0044ff,
        .color_dimmed = 0x001022,
        .init = mixer_init,
        .timer_event = mixer_timer_event,
        .surface_event = mixer_surface_event,
        .midi_event = mixer_midi_event,
        .aftertouch_event = mixer_aftertouch_event
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
        .name = "Mix Test",
        .color = 0x00ff88,
        .color_dimmed = 0x003322,
        .init = mix_test_init,
        .timer_event = mix_test_timer_event,
        .surface_event = mix_test_surface_event,
        .midi_event = mix_test_midi_event,
        .aftertouch_event = mix_test_aftertouch_event
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
