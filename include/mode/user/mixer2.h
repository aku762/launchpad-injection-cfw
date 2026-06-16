#ifndef MIXER2_H
#define MIXER2_H

#include <stdint.h>

void mixer2_init();
void mixer2_timer_event();
void mixer2_surface_event(uint8_t type, uint8_t index, uint8_t value);
void mixer2_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void mixer2_aftertouch_event(uint8_t index, uint8_t value);

#endif