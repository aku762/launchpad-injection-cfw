#ifndef CC_STATE_H
#define CC_STATE_H

#include <stdint.h>

// Global CC value store shared across all modes.
// Allows faders in different modes on the same channel+CC to stay in sync.
// Returns 0xFF from cc_state_get when a slot has never been set.
void    cc_state_init(void);
void    cc_state_set(uint8_t channel, uint8_t cc, uint8_t value);
uint8_t cc_state_get(uint8_t channel, uint8_t cc);

#endif