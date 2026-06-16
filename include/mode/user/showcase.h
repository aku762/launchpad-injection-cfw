#ifndef SHOWCASE_H
#define SHOWCASE_H

#include <stdint.h>

void showcase_init();
void showcase_timer_event();
void showcase_surface_event(uint8_t type, uint8_t index, uint8_t value);
void showcase_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void showcase_aftertouch_event(uint8_t index, uint8_t value);

#endif