#include "utils/sysex.h"
#include "driver/driver.h"
#include "driver/sysconf.h"
#include "flash/settings.h"
#include "flash/flash.h"
#include "utils/palette.h"
#include "mode/mode.h"
#include "led/led.h"

#define DEVICE_ID 19
#define DEVICE_INQUIRY_RESPONSE { 240, 126, 0, 6, 2, 0, 32, 41, 19, 1, 0, 0, 0, 9, 9, 9, 247 }

#define DEVICE_INQUIRY_LENGTH 17

void handle_sysex(uint8_t* buf, uint16_t len) {
    if (*buf != 0xF0) return;

    // Device Inquiry
    if (len == 6 && buf[1] == 0x7E && buf[2] == 0x7F && buf[3] == 0x06 && buf[4] == 0x01) {;
        uint8_t response[DEVICE_INQUIRY_LENGTH] = DEVICE_INQUIRY_RESPONSE;

        driver_send_midi(1, response, DEVICE_INQUIRY_LENGTH);
    }

    // CFW Version Inquiry:
    // Request:  F0 00 20 29 02 7F 00 F7
    // Response: F0 00 20 29 02 7F 01 <device_type> <major> <minor> <patch> F7
    if (len >= 7 &&
        buf[1] == 0x00 && buf[2] == 0x20 && buf[3] == 0x29 && buf[4] == 0x02 &&
        buf[5] == 0x7F && buf[6] == 0x00) {
        const uint8_t ver[3] = CFW_VERSION; // {major, minor, patch}
        uint8_t resp[12] = {
            0xF0, 0x00, 0x20, 0x29, 0x02, 0x7F, 0x01,
            DEVICE_ID,
            (uint8_t)(ver[0] & 0x7F), (uint8_t)(ver[1] & 0x7F), (uint8_t)(ver[2] & 0x7F),
            0xF7
        };

        driver_send_midi(1, resp, sizeof(resp));
        return;
    }

    if (buf[1] == 0x5F) {// FASTLED by mat1jaczyyy
        for (uint8_t* i = buf + 2; i < buf + (len - 1);) {
            uint8_t r = *i++;
            uint8_t g = *i++;
            uint8_t b = *i++;

            uint8_t n = ((r & 0x40) >> 4) | ((g & 0x40) >> 5) | ((b & 0x40) >> 6);
            if (n == 0) n = *i++;

            r &= 0x3F;
            g &= 0x3F;
            b &= 0x3F;

            r *= 4;
            g *= 4;
            b *= 4;

            for (uint8_t j = 0; j < n; j++) {
                uint8_t x = *i++;

                if (x == 0)
                    for (uint8_t k = 0; k < 99; k++)
                        rgb_led(k, r, g, b);

                else if (x <= 99)
                    rgb_led(x, r, g, b);

                else if (x <= 109) {
                    x = (x - 100) * 10 + 1;

                    for (uint8_t k = x; k < x + 8; k++)
                        rgb_led(k, r, g, b);

                } else if (x <= 119) {
                    x -= 100;

                    for (uint8_t k = x; k < 90; k += 10)
                        rgb_led(k, r, g, b);
                }
            }
        }
    }

    if (buf[1] == 0x52) { // Palette flash
        uint8_t palette_index = buf[2];
        uint8_t write_mode = buf[3];
        uint8_t color_space = buf[4] % 3;

        if (write_mode) { // Write
            for (uint8_t i = 0; i < 128; i++) {
                if (palette_index <= 3) {
                    settings_custom_palette[palette_index][color_space][i] = buf[5 + i];
                } else {
                    temporary_palette[color_space][i] = buf[5 + i];
                }
            }

            flash_write();
        }
    }

    if (len >= 8 &&
        buf[1] == 0x00 && buf[2] == 0x20 && buf[3] == 0x29 && buf[4] == 0x02 &&
        (buf[5] == 0x0C || buf[5] == 0x0D || buf[5] == 0x0E) && buf[6] == 0x03) {

        return; // Programmer-mode LED painting protocol unavailable on Mini (no Performance/Programmer modes)
    }
}