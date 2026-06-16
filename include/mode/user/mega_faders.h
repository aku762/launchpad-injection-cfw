#ifndef MEGA_FADERS_H
#define MEGA_FADERS_H

#include <stdint.h>

void mega_faders_init();
void mega_faders_timer_event();
void mega_faders_surface_event(uint8_t type, uint8_t index, uint8_t value);
void mega_faders_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void mega_faders_aftertouch_event(uint8_t index, uint8_t value);

#endif