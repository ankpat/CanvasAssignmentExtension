# CanvasAssignmentExtension
Extension for the HCPSS Canvas LMS instance. This extension adds a new section to the sidebar which displays all active assignments which have no submissions. This allows students to easily see which assignments must still be turned in.

In order to do this, the extension uses the Canvas LMS API restricted to the HCPSS instance of the application. This will avoid leaking information across school systems.

The APIs invoked are plaintext and explicitly reference the HCPSS instance of Canvas.

## Change log
Changes in v3:
- Modernized the underlying JavaScript
- Streamlined API calls to avoid hitting throttling limits

Changes in v2:
- Added support for parents with multiple children
- Added due dates to all assignments
- Filter out assignments without due dates

https://chrome.google.com/webstore/detail/hcpss-canvas-assignment-e/baabmfbgjcnooapabhjehpakihoihmin

# Security

## Data Storage
This extension stores no data

## Data Sharing
This extension does not share data with anything or anyone. All communications occur between the Chrome web browser and the HCPSS Canvas LMS instance.
