#ifndef LFO_H
#define LFO_H

#include <stdint.h>

/* Per-LFO oscillator entry.  Steps through pad positions (0..length-1) so
   every pad gets equal dwell time.  CC output is interpolated from position.
   Rate is read live from cc_state each tick so a fader or external MIDI
   controls speed in real time.  CC value 0 = stopped; 1-127 = speed
   proportional (127 = rate_min_ticks fastest).  0xFF = treated as mid speed. */
typedef struct {
    uint8_t  active;
    uint8_t  channel;        /* MIDI out channel (0-15) */
    uint8_t  cc;             /* MIDI out CC (0-127) */
    uint8_t  pos;            /* current pad position (0 to length-1) */
    uint8_t  length;         /* number of pads */
    uint8_t  min_val;        /* CC value at position 0 */
    uint8_t  max_val;        /* CC value at position length-1 */
    uint8_t  direction;      /* 0=ascending, 1=descending */
    uint8_t  rate_channel;   /* channel to read rate from cc_state (0-15) */
    uint8_t  rate_cc;        /* CC number to read rate from cc_state */
    uint16_t rate_min_ticks; /* ticks/step at rate_cc=127 (fastest) */
    uint16_t rate_max_ticks; /* ticks/step at rate_cc=1 (slowest) */
    uint16_t tick_counter;
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
                  uint16_t rate_min_ticks, uint16_t rate_max_ticks);

/* Return the CC value at the current pad position, or 0xFF if not active. */
uint8_t lfo_current(uint8_t channel, uint8_t cc);

#endif