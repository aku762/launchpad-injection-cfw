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

/* CC value at pad position t within an LFO's range. */
static uint8_t cc_at_pos(const LfoEntry *e, uint8_t t) {
    if (t == 0)                   return e->min_val;
    if (t >= e->length - 1u)      return e->max_val;
    return (uint8_t)(e->min_val + t * (e->max_val - e->min_val) / (e->length - 1u));
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

        uint16_t ticks;
        if (rate >= 127) {
            ticks = e->rate_min_ticks;
        } else {
            uint32_t range = (uint32_t)(e->rate_max_ticks - e->rate_min_ticks);
            ticks = (uint16_t)(e->rate_max_ticks - (range * (uint32_t)(rate - 1u)) / 126u);
        }

        e->tick_counter++;
        if (e->tick_counter < ticks) continue;
        e->tick_counter = 0;

        /* Step through pad positions. Dwell one extra tick at each extreme so
           the end pads get equal time to middle pads (which appear once going
           up and once going down per cycle). */
        if (e->direction == 0 && e->pos >= e->length - 1u) {
            e->direction = 1;   /* at top: reverse, stay for one more tick */
        } else if (e->direction == 1 && e->pos == 0) {
            e->direction = 0;   /* at bottom: reverse, stay for one more tick */
        } else if (e->direction == 0) {
            e->pos++;
        } else {
            e->pos--;
        }

        uint8_t cc_val = cc_at_pos(e, e->pos);
        cc_state_set(e->channel, e->cc, cc_val);
        send3((uint8_t)(0xB0 | e->channel), e->cc, cc_val);
    }
}

void lfo_register(uint8_t channel, uint8_t cc,
                  uint8_t min_val, uint8_t max_val, uint8_t start_val,
                  uint8_t length,
                  uint8_t rate_channel, uint8_t rate_cc,
                  uint16_t rate_min_ticks, uint16_t rate_max_ticks) {
    int8_t free_slot = -1;

    for (uint8_t i = 0; i < MAX_LFO_ENTRIES; i++) {
        LfoEntry *e = &g_lfo_queue[i];
        if (e->active && e->channel == channel && e->cc == cc) {
            e->length         = length;
            e->min_val        = min_val;
            e->max_val        = max_val;
            e->rate_channel   = rate_channel;
            e->rate_cc        = rate_cc;
            e->rate_min_ticks = rate_min_ticks;
            e->rate_max_ticks = rate_max_ticks;
            e->tick_counter   = 0;
            return;
        }
        if (!e->active && free_slot < 0) free_slot = (int8_t)i;
    }

    if (free_slot < 0) return;

    /* Nearest-neighbour: find which pad position is closest to start_val. */
    uint8_t start_pos = 0;
    if (length > 1 && max_val > min_val) {
        uint8_t best = 0, best_diff = 255;
        for (uint8_t t = 0; t < length; t++) {
            uint8_t cv = (t == 0) ? min_val :
                         (t >= length - 1u) ? max_val :
                         (uint8_t)(min_val + t * (max_val - min_val) / (length - 1u));
            uint8_t diff = (start_val >= cv) ? (start_val - cv) : (cv - start_val);
            if (diff < best_diff) { best_diff = diff; best = t; }
        }
        start_pos = best;
    }

    LfoEntry *e       = &g_lfo_queue[free_slot];
    e->active         = 1;
    e->channel        = channel;
    e->cc             = cc;
    e->pos            = start_pos;
    e->length         = length;
    e->min_val        = min_val;
    e->max_val        = max_val;
    e->direction      = 0;
    e->rate_channel   = rate_channel;
    e->rate_cc        = rate_cc;
    e->rate_min_ticks = rate_min_ticks;
    e->rate_max_ticks = rate_max_ticks;
    e->tick_counter   = 0;
}

uint8_t lfo_current(uint8_t channel, uint8_t cc) {
    for (uint8_t i = 0; i < MAX_LFO_ENTRIES; i++) {
        LfoEntry *e = &g_lfo_queue[i];
        if (e->active && e->channel == channel && e->cc == cc)
            return cc_at_pos(e, e->pos);
    }
    return 0xFF;
}