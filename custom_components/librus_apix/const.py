"""Constants for the Librus APIX integration."""

from datetime import timedelta

DOMAIN = "librus_apix"
DEFAULT_NAME = "Librus"

# Configuration keys
CONF_USERNAME = "username"
CONF_PASSWORD = "password"

# Update intervals
SCAN_INTERVAL = timedelta(hours=2)
# Odpytywanie Librusa (minuty), regulowane w opcjach integracji
CONF_SCAN_INTERVAL_SCHOOL = "scan_interval_school_minutes"
CONF_SCAN_INTERVAL_OTHER = "scan_interval_minutes"
DEFAULT_SCAN_INTERVAL_SCHOOL = 15   # dni robocze 7:00-16:00
DEFAULT_SCAN_INTERVAL_OTHER = 120   # pozostale godziny i weekendy

# Default values
DEFAULT_MESSAGES_COUNT = 10