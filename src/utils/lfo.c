#include "utils/lfo.h"
#include "utils/cc_state.h"
#include "driver/driver.h"

__attribute__((section(".cfw_bss")))
LfoEntry g_lfo_queue[MAX_LFO_ENTRIES];

static uint8_t lfos_initialized;

static void send3(uint8_t status, uint8_t d1, uint8_t d2) {
    uint8_t buf[3] = { status, d1, d2 };
    driver_send_midi(1, buf, 3);
}

void lfo_tick(void) {
    if (!lfos_initialized) {
        for (uint8_t i = 0; i < MAX_LFO_ENTRIES; i++) g_lfo_queue[i].active = 0;
        lfos_initialized = 1;
    }

    for (uint8_t i = 0; i < MAX_LFO_ENTRIES; i++) {
        LfoEntry *e = &g_lfo_queue[i];
        if (!e->active) continue;

        uint8_t rate = cc_state_get(e->rate_channel, e->rate_cc);
        if (rate == 0xFF) rate = 64;  /* unset cc_state: run at mid speed */
        if (rate == 0) continue;       /* CC=0: stopped */

        uint16_t ticks = e->rate_ticks[rate];

        e->tick_counter++;
        if (e->tick_counter < ticks) continue;
        e->tick_counter = 0;

        /* Step through CC values (min_val..max_val) one step per tick.
           Dwell one extra tick at each extreme for equal end-point time. */
        if (e->direction == 0 && e->pos >= e->max_val) {
            e->direction = 1;
        } else if (e->direction == 1 && e->pos <= e->min_val) {
            e->direction = 0;
        } else if (e->direction == 0) {
            e->pos++;
        } else {
            e->pos--;
        }

        cc_state_set(e->channel, e->cc, e->pos);
        send3((uint8_t)(0xB0 | e->channel), e->cc, e->pos);
    }
}

void lfo_register(uint8_t channel, uint8_t cc,
                  uint8_t min_val, uint8_t max_val, uint8_t start_val,
                  uint8_t length,
                  uint8_t rate_channel, uint8_t rate_cc,
                  const uint16_t *rate_ticks) {
    int8_t free_slot = -1;

    for (uint8_t i = 0; i < MAX_LFO_ENTRIES; i++) {
        LfoEntry *e = &g_lfo_queue[i];
        if (e->active && e->channel == channel && e->cc == cc) {
            e->length         = length;
            e->min_val        = min_val;
            e->max_val        = max_val;
            e->rate_channel = rate_channel;
            e->rate_cc      = rate_cc;
            e->rate_ticks   = rate_ticks;
            e->tick_counter = 0;
            return;
        }
        if (!e->active && free_slot < 0) free_slot = (int8_t)i;
    }

    if (free_slot < 0) return;

    uint8_t clamped = (start_val < min_val) ? min_val :
                      (start_val > max_val) ? max_val : start_val;

    LfoEntry *e       = &g_lfo_queue[free_slot];
    e->active         = 1;
    e->channel        = channel;
    e->cc             = cc;
    e->pos            = clamped;
    e->length         = length;
    e->min_val        = min_val;
    e->max_val        = max_val;
    e->direction    = 0;
    e->rate_channel = rate_channel;
    e->rate_cc      = rate_cc;
    e->rate_ticks   = rate_ticks;
    e->tick_counter = 0;
}

uint8_t lfo_current(uint8_t channel, uint8_t cc) {
    for (uint8_t i = 0; i < MAX_LFO_ENTRIES; i++) {
        LfoEntry *e = &g_lfo_queue[i];
        if (e->active && e->channel == channel && e->cc == cc)
            return e->pos;
    }
    return 0xFF;
}