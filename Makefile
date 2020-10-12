BUILD_DIR=./build
EXT_NAME=CanvasAssignmentExtension

all: $(EXT_NAME).zip

clean:
	@rm -rf $(BUILD_DIR)
	@rm -f $(EXT_NAME).zip
	
build_dir:
	@mkdir -p $(BUILD_DIR)

$(BUILD_DIR)/%: %
	@cp $< $@
	
$(EXT_NAME).zip: build_dir $(BUILD_DIR)/contentScript.js $(BUILD_DIR)/manifest.json
	@zip -r $(EXT_NAME) $(BUILD_DIR)

