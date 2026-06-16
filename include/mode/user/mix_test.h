#ifndef MIX_TEST_H
#define MIX_TEST_H

#include <stdint.h>

void mix_test_init();
void mix_test_timer_event();
void mix_test_surface_event(uint8_t type, uint8_t index, uint8_t value);
void mix_test_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void mix_test_aftertouch_event(uint8_t index, uint8_t value);

#endif