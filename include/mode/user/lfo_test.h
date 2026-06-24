#ifndef LFO_TEST_H
#define LFO_TEST_H

#include <stdint.h>

void lfo_test_init();
void lfo_test_timer_event();
void lfo_test_surface_event(uint8_t type, uint8_t index, uint8_t value);
void lfo_test_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void lfo_test_aftertouch_event(uint8_t index, uint8_t value);

#endif