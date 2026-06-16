#include <led/led.h>
#include <driver/driver.h>
#include <flash/settings.h>
#include <utils/palette.h>

#define NOVATION_RGB_PAL_ADDR   0x801895Cu
#define NOVATION_RGB_PAL_U32    ((const uint32_t* const)(NOVATION_RGB_PAL_ADDR))

static inline uint8_t scale6to8(uint8_t v) {
    // Map 0..63 -> 0..255 with rounding
    return (uint8_t)(((uint32_t)v * 255u + 31u) / 63u);
}

static uint8_t rg_calc(uint8_t v, uint8_t i) {
    if (i == 0) return v % 4 * 21;
    if (i == 1) return (v / 16) % 4 * 21;
}

void set_led(uint8_t led, uint32_t color) {
    driver_set_led(led, color);
}

void rgb_led(uint8_t led, uint8_t r, uint8_t g, uint8_t b) {
    driver_set_led(led, (uint32_t)((r << 16) | (g << 8) | b));
}

void novation_led(uint8_t led, uint8_t velocity) {
    driver_set_led(led, NOVATION_RGB_PAL_U32[velocity]);
}

void palette_led(uint8_t led, uint8_t velocity) {
    if (settings_palette == 6) {
        uint8_t r = scale6to8(temporary_palette[0][velocity]);
        uint8_t g = scale6to8(temporary_palette[1][velocity]);
        uint8_t b = scale6to8(temporary_palette[2][velocity]);

        driver_set_led(led, (uint32_t)((r << 16) | (g << 8) | b));
        return;
    } else if (settings_palette >= 4) {
        // Custom palette
        uint8_t r = scale6to8(settings_custom_palette[settings_palette - 4][0][velocity]);
        uint8_t g = scale6to8(settings_custom_palette[settings_palette - 4][1][velocity]);
        uint8_t b = scale6to8(settings_custom_palette[settings_palette - 4][2][velocity]);

        driver_set_led(led, (uint32_t)((r << 16) | (g << 8) | b));
        return;
    } else if (settings_palette == 3) {
        // RG Palette
        rgb_led(led, rg_calc(velocity, 0) * 2, rg_calc(velocity, 1) * 2, 0);
        return;
    } else if (settings_palette <= 2) {
        uint8_t r = scale6to8(native_palettes[settings_palette][0][velocity]);
        uint8_t g = scale6to8(native_palettes[settings_palette][1][velocity]);
        uint8_t b = scale6to8(native_palettes[settings_palette][2][velocity]);

        driver_set_led(led, (uint32_t)((r << 16) | (g << 8) | b));
        return;
    }
}

void clear_led() {
    for (int i = 0; i < 100; i++) {
        set_led(i, 0);
    }
}