#ifndef MIXER_H
#define MIXER_H

#include <stdint.h>

void mixer_init();
void mixer_timer_event();
void mixer_surface_event(uint8_t type, uint8_t index, uint8_t value);
void mixer_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void mixer_aftertouch_event(uint8_t index, uint8_t value);

#endif