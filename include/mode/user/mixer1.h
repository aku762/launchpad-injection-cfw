#ifndef MIXER1_H
#define MIXER1_H

#include <stdint.h>

void mixer1_init();
void mixer1_timer_event();
void mixer1_surface_event(uint8_t type, uint8_t index, uint8_t value);
void mixer1_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void mixer1_aftertouch_event(uint8_t index, uint8_t value);

#endif