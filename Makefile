CC=arm-none-eabi-gcc
CFLAGS=-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=softfp -Os \
	-ffunction-sections -fdata-sections -fno-builtin -MMD -MP

DEVICE=mini

CFLAGS+=-DLPMINI -fno-common
LDFLAGS=-Wl,--gc-sections -Wl,-Map=build/mini/fw.map -T linker/stm32f401_lpmini.ld
DRIVER_SRC=src/driver/mini/mini_hooks.c \
		  src/driver/mini/mini_boot.c \
		  src/driver/mini/mini_velocity_stubs.c \
		  src/driver/mini/mini_storage.c \
		  src/driver/mini/mini_leds.c \
		  src/driver/mini/sysconf.c
BLOB_SPLIT_DIR=build/mini/blob_split
BLOB_PART1_OBJ=$(BLOB_SPLIT_DIR)/blob_part1.o
BLOB_PART2_OBJ=$(BLOB_SPLIT_DIR)/blob_part2.o
BLOB_OBJ=$(BLOB_PART1_OBJ) $(BLOB_PART2_OBJ)
VERSION=407
SYSEX_TYPE=/minimk3
PATCHES_FILE=patches/lpmini.json
BUILD_METHOD=standard

ORIG_FW_SYX=original/launchpadminimk3-firmware-$(VERSION).syx
ORIG_FW_BIN=original/launchpadminimk3-firmware-$(VERSION).bin
MINI_BASE=0x0800c000
MINI_FREE_START=0x08018ac2
MINI_FREE_END=0x0801a7ef
OFF_FREE_START=$(shell printf %d $$(( $(MINI_FREE_START) - $(MINI_BASE) )))
OFF_AFTER_FREE_END=$(shell printf %d $$(( $(MINI_FREE_END) - $(MINI_BASE) + 1 )))

SRC=$(DRIVER_SRC) \
	src/app.c \
	src/led/led.c \
	src/utils/conversion.c \
	src/utils/palette.c \
	src/utils/sysex.c \
	src/flash/settings.c \
	src/flash/flash.c \
	src/mode/mode.c \
	src/mode/system/setup.c \
	src/mode/user/performance.c \
	src/mode/user/programmer.c \
	src/mode/user/mega_faders.c \
	src/mode/user/showcase.c \
	src/mode/user/mixer.c \
	src/mode/user/mix_test.c \

INCLUDES=-Iinclude

BUILD_DIR=build/$(DEVICE)
SCRIPTS_DIR=tools

OBJS=$(patsubst %.c,$(BUILD_DIR)/%.o,$(SRC)) $(BLOB_OBJ)
DEPS=$(patsubst %.c,$(BUILD_DIR)/%.d,$(SRC))
-include $(DEPS)

LANDFILL_BIN=original/launchpadminimk3-firmware-407-LANDFILL.bin

.PHONY: all mini clean help

all: mini

mini:
	$(MAKE) build/mini/fw.elf build/mini/fw.bin build/mini/fw.patched.bin build/mini/fw.patched.syx build/mini/fw.patched.bin.bipa

$(LANDFILL_BIN): $(PATCHES_FILE) $(SCRIPTS_DIR)/landfill.py
	@echo "Generating landfill binary from $(PATCHES_FILE)..."
	python3 $(SCRIPTS_DIR)/landfill.py $(PATCHES_FILE)

$(BLOB_PART1_OBJ) $(BLOB_PART2_OBJ): $(LANDFILL_BIN)
	@echo "Splitting landfill blob for Mini..."
	@mkdir -p $(BLOB_SPLIT_DIR)
	@echo " - part1: 0..$$(($(OFF_FREE_START)-1)) bytes"
	dd if=$(LANDFILL_BIN) of=$(BLOB_SPLIT_DIR)/blob_part1.bin bs=1 count=$(OFF_FREE_START)
	@echo " - part2: from byte $(OFF_AFTER_FREE_END) to EOF"
	dd if=$(LANDFILL_BIN) of=$(BLOB_SPLIT_DIR)/blob_part2.bin bs=1 skip=$(OFF_AFTER_FREE_END)
	@echo "Creating part1 object"
	arm-none-eabi-objcopy -I binary -O elf32-littlearm -B arm \
		--rename-section .data=.blob_part1 \
		$(BLOB_SPLIT_DIR)/blob_part1.bin $(BLOB_PART1_OBJ)
	@echo "Creating part2 object"
	arm-none-eabi-objcopy -I binary -O elf32-littlearm -B arm \
		--rename-section .data=.blob_part2 \
		$(BLOB_SPLIT_DIR)/blob_part2.bin $(BLOB_PART2_OBJ)
	@echo "Cleaning up temporary landfill binary..."
	# @rm -f $(LANDFILL_BIN)

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(BUILD_DIR)/%.o: %.c | $(BUILD_DIR)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(BUILD_DIR)/fw.elf: $(OBJS) | $(BUILD_DIR)
	$(CC) $(CFLAGS) $(OBJS) -o $@ $(LDFLAGS)

$(BUILD_DIR)/fw.bin: $(BUILD_DIR)/fw.elf
	arm-none-eabi-objcopy -O binary $< $@

$(BUILD_DIR)/fw.patched.bin: $(BUILD_DIR)/fw.elf $(BUILD_DIR)/fw.bin $(SCRIPTS_DIR)/patcher.py $(PATCHES_FILE)
	python3 $(SCRIPTS_DIR)/patcher.py $(PATCHES_FILE) $(BUILD_DIR)/fw.elf $(BUILD_DIR)/fw.bin $@

$(BUILD_DIR)/fw.patched.syx: $(BUILD_DIR)/fw.patched.bin $(SCRIPTS_DIR)/syxtool.py
	@python3 $(SCRIPTS_DIR)/syxtool.py --to-syx $(SYSEX_TYPE) $(VERSION) $(BUILD_DIR)/fw.patched.bin $(BUILD_DIR)/cfw.syx
	@cp $(BUILD_DIR)/cfw.syx build/$(DEVICE)-cfw.syx
	@echo "Created build/$(DEVICE)-cfw.syx"

$(BUILD_DIR)/fw.patched.bin.bipa: $(SCRIPTS_DIR)/bipa.py $(ORIG_FW_BIN) $(BUILD_DIR)/fw.patched.bin
	@echo "Creating BIPA patch for Mini (source=$(ORIG_FW_BIN))"
	python3 $(SCRIPTS_DIR)/bipa.py create --source $(ORIG_FW_BIN) --target $(BUILD_DIR)/fw.patched.bin
	@cp $@ build/$(DEVICE)-cfw.bipa
	@echo "Created build/$(DEVICE)-cfw.bipa"

original/%.bin: original/%.syx $(SCRIPTS_DIR)/syxtool.py
	@echo "Converting $< to $@ via syxtool..."
	python3 $(SCRIPTS_DIR)/syxtool.py --to-bin $< $@

clean:
	rm -rf build/
	rm -f *-LANDFILL.bin

help:
	@echo "Build targets:"
	@echo "  all   Build Mini firmware and syx (default)"
	@echo "  mini  Build Mini firmware and syx"
