#ifndef LFO_H
#define LFO_H

#include <stdint.h>

/* Per-LFO oscillator entry.  Steps through every CC value between min_val and
   max_val (±1 per tick) for smooth interpolated output.  Display maps current
   CC to nearest pad via nearest-neighbour so pad count only affects resolution.
   Rate is read live from cc_state each tick — CC=0=stopped, 1-127=speed,
   0xFF=mid speed. */
typedef struct {
    uint8_t  active;
    uint8_t  channel;        /* MIDI out channel (0-15) */
    uint8_t  cc;             /* MIDI out CC (0-127) */
    uint8_t  pos;            /* current CC value (min_val to max_val) */
    uint8_t  length;         /* number of display pads */
    uint8_t  min_val;        /* CC value at position 0 */
    uint8_t  max_val;        /* CC value at position length-1 */
    uint8_t  direction;      /* 0=ascending, 1=descending */
    uint8_t          rate_channel; /* channel to read rate from cc_state (0-15) */
    uint8_t          rate_cc;      /* CC number to read rate from cc_state */
    const uint16_t  *rate_ticks;   /* 128-entry exponential lookup: ticks = rate_ticks[cc] */
    uint16_t         tick_counter;
} LfoEntry;

#define MAX_LFO_ENTRIES 8

extern LfoEntry g_lfo_queue[MAX_LFO_ENTRIES];

/* Called every 1ms from CFW_AppTick alongside fader_tick(). */
void lfo_tick(void);

/* Register or update an LFO.  If (channel, cc) already exists, position and
   direction are preserved (config updated in place).  If new, pos is
   initialised to the nearest pad to start_val. */
void lfo_register(uint8_t channel, uint8_t cc,
                  uint8_t min_val, uint8_t max_val, uint8_t start_val,
                  uint8_t length,
                  uint8_t rate_channel, uint8_t rate_cc,
                  const uint16_t *rate_ticks);

/* Return the CC value at the current pad position, or 0xFF if not active. */
uint8_t lfo_current(uint8_t channel, uint8_t cc);

#endif