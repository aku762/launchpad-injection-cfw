#ifndef DEMO_H
#define DEMO_H

#include <stdint.h>

void demo_init();
void demo_timer_event();
void demo_surface_event(uint8_t type, uint8_t index, uint8_t value);
void demo_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void demo_aftertouch_event(uint8_t index, uint8_t value);

#endif