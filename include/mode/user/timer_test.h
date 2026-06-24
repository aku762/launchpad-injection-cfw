#ifndef TIMER_TEST_H
#define TIMER_TEST_H

#include <stdint.h>

void timer_test_init();
void timer_test_timer_event();
void timer_test_surface_event(uint8_t type, uint8_t index, uint8_t value);
void timer_test_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);
void timer_test_aftertouch_event(uint8_t index, uint8_t value);

#endif