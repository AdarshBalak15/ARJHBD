# MaxMind GeoLite2 Database Directory

Place your `GeoLite2-City.mmdb` file here for offline geolocation fallback.

## Setup Instructions

1. **Create a FREE MaxMind account:**
   https://www.maxmind.com/en/geolite2/signup

2. **Generate a license key:**
   Account → Manage License Keys → Generate New License Key

3. **Download the database:**
   https://dev.maxmind.com/geoip/geolite2-free-geolocation-data

4. **Extract and place:**
   Copy `GeoLite2-City.mmdb` into this directory.

5. **Restart the server:**
   The service auto-detects the file on startup.

> The `.mmdb` file is ~70MB and should NOT be committed to Git.
> It is already excluded via `.gitignore`.
