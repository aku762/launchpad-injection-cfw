#include "utils/cc_state.h"
#include <string.h>

__attribute__((section(".cfw_bss")))
static uint8_t g_cc_state[16][128];

void cc_state_init(void) {
    memset(g_cc_state, 0xFF, sizeof(g_cc_state));
}

void cc_state_set(uint8_t channel, uint8_t cc, uint8_t value) {
    if (channel < 16 && cc < 128)
        g_cc_state[channel][cc] = value;
}

uint8_t cc_state_get(uint8_t channel, uint8_t cc) {
    if (channel < 16 && cc < 128)
        return g_cc_state[channel][cc];
    return 0xFF;
}