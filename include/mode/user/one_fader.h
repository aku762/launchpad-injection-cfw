#ifndef ONE_FADER_H
#define ONE_FADER_H

#include <stdint.h>

void one_fader_init();
void one_fader_timer_event();
void one_fader_surface_event(uint8_t type, uint8_t index, uint8_t value);
void one_fader_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void one_fader_aftertouch_event(uint8_t index, uint8_t value);

#endif