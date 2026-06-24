#ifndef D_FADE_H
#define D_FADE_H

#include <stdint.h>

void d_fade_init();
void d_fade_timer_event();
void d_fade_surface_event(uint8_t type, uint8_t index, uint8_t value);
void d_fade_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void d_fade_aftertouch_event(uint8_t index, uint8_t value);

#endif