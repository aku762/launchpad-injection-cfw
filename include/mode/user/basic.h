#ifndef BASIC_H
#define BASIC_H

#include <stdint.h>

void basic_init();
void basic_timer_event();
void basic_surface_event(uint8_t type, uint8_t index, uint8_t value);
void basic_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void basic_aftertouch_event(uint8_t index, uint8_t value);

#endif