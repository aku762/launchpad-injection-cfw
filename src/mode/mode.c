#include "mode/mode.h"
#include "led/led.h"

uint8_t current_mode = 0;
uint8_t mode = 0;

// Slot assignment is configured in the editor's Modes panel (editor/modes.json)
// and synced here by tools/sync_modes.py — do not hand-edit between the
// markers below, your changes will be overwritten on the next sync.
const struct Mode modes[MODES_COUNT] = {
    // BEGIN GENERATED MODES
    {
        .name = "Mix 1",
        .color = 0x000000,
        .color_dimmed = 0x000000,
        .init = mixer1_init,
        .timer_event = mixer1_timer_event,
        .surface_event = mixer1_surface_event,
        .midi_event = mixer1_midi_event,
        .aftertouch_event = mixer1_aftertouch_event
    },
    {
        .name = "Mix 2",
        .color = 0x000000,
        .color_dimmed = 0x000000,
        .init = mixer2_init,
        .timer_event = mixer2_timer_event,
        .surface_event = mixer2_surface_event,
        .midi_event = mixer2_midi_event,
        .aftertouch_event = mixer2_aftertouch_event
    },
    {
        .name = "Double Fade",
        .color = 0x000000,
        .color_dimmed = 0x000000,
        .init = d_fade_init,
        .timer_event = d_fade_timer_event,
        .surface_event = d_fade_surface_event,
        .midi_event = d_fade_midi_event,
        .aftertouch_event = d_fade_aftertouch_event
    },
    {
        .name = "Mega Faders",
        .color = 0x000000,
        .color_dimmed = 0x000000,
        .init = mega_faders_init,
        .timer_event = mega_faders_timer_event,
        .surface_event = mega_faders_surface_event,
        .midi_event = mega_faders_midi_event,
        .aftertouch_event = mega_faders_aftertouch_event
    },
    {
        .name = "LFO Test",
        .color = 0x000000,
        .color_dimmed = 0x000000,
        .init = lfo_test_init,
        .timer_event = lfo_test_timer_event,
        .surface_event = lfo_test_surface_event,
        .midi_event = lfo_test_midi_event,
        .aftertouch_event = lfo_test_aftertouch_event
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
    },
    // END GENERATED MODES
};

void mode_switch(uint8_t m) {
    // mode_switch() targets come from generated/hand-written mode_switch()
    // call sites with no compile-time bounds checking — an out-of-range
    // value here would index modes[] out of bounds and jump exec into
    // whatever garbage function pointer that read returns. Clamp to a
    // known-safe mode instead of risking that.
    if (m >= MODES_COUNT) {
        m = MODE_DEFAULT;
    }

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
