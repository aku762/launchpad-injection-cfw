#include "utils/automations.h"
#include "utils/cc_state.h"
#include "driver/driver.h"

__attribute__((section(".cfw_bss")))
AutoEntry g_auto_queue[MAX_AUTO_ENTRIES];

/* Plain .bss — zeroed once by cfw_runtime_init_once() before our first tick. */
static uint8_t autos_initialized;

static void send3(uint8_t status, uint8_t d1, uint8_t d2) {
    uint8_t buf[3] = { status, d1, d2 };
    driver_send_midi(1, buf, 3);
}

void automations_tick(void) {
    if (!autos_initialized) {
        for (uint8_t i = 0; i < MAX_AUTO_ENTRIES; i++) g_auto_queue[i].active = 0;
        autos_initialized = 1;
    }

    for (uint8_t i = 0; i < MAX_AUTO_ENTRIES; i++) {
        AutoEntry *e = &g_auto_queue[i];
        if (!e->active) continue;
        if (e->current == e->target) { e->active = 0; continue; }

        e->tick_counter++;
        if (e->tick_counter < e->ticks_per_step) continue;
        e->tick_counter = 0;

        if (e->current < e->target) e->current++;
        else                        e->current--;

        cc_state_set(e->channel, e->cc, e->current);
        send3((uint8_t)(0xB0 | e->channel), e->cc, e->current);
    }
}

void automations_fade(uint8_t channel, uint8_t cc,
                      uint8_t target, uint16_t ticks_per_step) {
    int8_t free_slot = -1;

    for (uint8_t i = 0; i < MAX_AUTO_ENTRIES; i++) {
        AutoEntry *e = &g_auto_queue[i];
        if (e->active && e->channel == channel && e->cc == cc) {
            /* Update existing entry — keep current position, lock new rate */
            e->target         = target;
            e->ticks_per_step = ticks_per_step;
            e->tick_counter   = 0;
            return;
        }
        if (!e->active && free_slot < 0) free_slot = (int8_t)i;
    }

    if (free_slot < 0) return;  /* queue full */

    AutoEntry *e = &g_auto_queue[free_slot];
    uint8_t gv   = cc_state_get(channel, cc);

    e->active         = 1;
    e->channel        = channel;
    e->cc             = cc;
    e->current        = (gv != 0xFF) ? gv : 0;
    e->target         = target;
    e->ticks_per_step = ticks_per_step;
    e->tick_counter   = 0;
}

void automations_cancel(uint8_t channel, uint8_t cc) {
    for (uint8_t i = 0; i < MAX_AUTO_ENTRIES; i++) {
        AutoEntry *e = &g_auto_queue[i];
        if (e->active && e->channel == channel && e->cc == cc) {
            e->active = 0;
            return;
        }
    }
}

uint8_t automations_current(uint8_t channel, uint8_t cc) {
    for (uint8_t i = 0; i < MAX_AUTO_ENTRIES; i++) {
        AutoEntry *e = &g_auto_queue[i];
        if (e->active && e->channel == channel && e->cc == cc)
            return e->current;
    }
    return 0xFF;
}
