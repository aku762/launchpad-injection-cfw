#ifndef FADER_H
#define FADER_H

#include <stdint.h>

/* Per-fade animation entry.  ticks_per_step is locked at registration time
   so rate changes on the surface don't affect in-progress fades. */
typedef struct {
    uint8_t  active;
    uint8_t  channel;       /* 0-15 */
    uint8_t  cc;            /* 0-127 */
    uint8_t  current;       /* current stepped value */
    uint8_t  target;        /* destination value */
    uint8_t  _pad;
    uint16_t ticks_per_step;
    uint16_t tick_counter;
} FadeEntry;

#define MAX_FADE_ENTRIES 32

extern FadeEntry g_fade_queue[MAX_FADE_ENTRIES];

/* Called every 1ms from CFW_AppTick — steps all active entries,
   sends MIDI CC, updates cc_state.  Fires regardless of active mode. */
void fader_tick(void);

/* Register or update a fade for (channel, cc).  Captures ticks_per_step
   at call time so later rate changes don't affect this fade.
   If an entry for (channel, cc) already exists, updates target and rate. */
void fader_fade(uint8_t channel, uint8_t cc,
                uint8_t target, uint16_t ticks_per_step);

/* Cancel any active fade for (channel, cc). */
void fader_cancel(uint8_t channel, uint8_t cc);

/* Return the current animated value for (channel, cc), or 0xFF if none. */
uint8_t fader_current(uint8_t channel, uint8_t cc);

#endif
