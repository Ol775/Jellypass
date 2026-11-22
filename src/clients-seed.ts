// Snapshot of jellyfin.org/downloads/clients (official clients) so the Help page works before the first daily refresh.
// Regenerate: bundle scripts from src/jellyfin-clients.ts against fresh clients.ts and platform.ts from the jellyfin/jellyfin.org repo.
import type { ClientsData } from "./jellyfin-clients";
export const CLIENTS_SEED: ClientsData = {
 "updatedAt": "2026-11-15T00:53:27.447Z",
 "source": "https://jellyfin.org/downloads/clients/",
 "clients": [
  {
   "id": "jellyfin-media-player",
   "name": "Jellyfin Media Player",
   "description": "The official Jellyfin desktop client.",
   "beta": false,
   "recommended": true,
   "deviceTypes": [
    "Desktop"
   ],
   "platforms": [
    "Linux",
    "macOS",
    "Windows"
   ],
   "links": [
    {
     "name": "GitHub Downloads",
     "url": "https://github.com/jellyfin/jellyfin-media-player/releases"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-media-player"
    }
   ]
  },
  {
   "id": "jellyfin-mpv-shim",
   "name": "Jellyfin MPV Shim",
   "description": "A cross-platform cast client for Jellyfin.",
   "beta": false,
   "recommended": false,
   "deviceTypes": [
    "Desktop"
   ],
   "platforms": [
    "Linux",
    "macOS",
    "Windows"
   ],
   "links": [
    {
     "name": "Flathub (Linux)",
     "url": "https://flathub.org/apps/details/com.github.iwalton3.jellyfin-mpv-shim"
    },
    {
     "name": "GitHub Downloads",
     "url": "https://github.com/jellyfin/jellyfin-mpv-shim/releases"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-mpv-shim"
    }
   ]
  },
  {
   "id": "jellyfin-vue",
   "name": "Jellyfin Vue",
   "description": "A modern web client for Jellyfin based on Vue",
   "beta": true,
   "recommended": false,
   "deviceTypes": [
    "Mobile",
    "Desktop"
   ],
   "platforms": [
    "Browser"
   ],
   "links": [
    {
     "name": "Open in browser",
     "url": "https://jf-vue.pages.dev/"
    },
    {
     "name": "Docker",
     "url": "https://github.com/jellyfin/jellyfin-vue/pkgs/container/jellyfin-vue"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-vue"
    }
   ]
  },
  {
   "id": "jellycon",
   "name": "JellyCon",
   "description": "A lightweight Kodi add-on that lets you browse and play media files directly from your Jellyfin server within the Kodi interface.",
   "beta": false,
   "recommended": true,
   "deviceTypes": [
    "Desktop",
    "Mobile",
    "TV"
   ],
   "platforms": [
    "Kodi"
   ],
   "links": [
    {
     "name": "Installation Guide",
     "url": "https://github.com/jellyfin/jellycon#installation"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellycon"
    }
   ]
  },
  {
   "id": "jellyfin-kodi",
   "name": "Jellyfin for Kodi",
   "description": "A Kodi add-on that syncs metadata from selected Jellyfin libraries into the local Kodi database.",
   "beta": false,
   "recommended": false,
   "deviceTypes": [
    "Desktop",
    "Mobile",
    "TV"
   ],
   "platforms": [
    "Kodi"
   ],
   "links": [],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-kodi"
    }
   ]
  },
  {
   "id": "jellyfin-android",
   "name": "Jellyfin for Android",
   "description": "The official Jellyfin app for Android devices.",
   "beta": false,
   "recommended": true,
   "deviceTypes": [
    "Mobile"
   ],
   "platforms": [
    "Android"
   ],
   "links": [
    {
     "name": "F-Droid",
     "url": "https://f-droid.org/en/packages/org.jellyfin.mobile/"
    },
    {
     "name": "Amazon Appstore",
     "url": "https://www.amazon.com/gp/aw/d/B081RFTTQ9"
    },
    {
     "name": "Play Store",
     "url": "https://play.google.com/store/apps/details?id=org.jellyfin.mobile"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-android"
    }
   ]
  },
  {
   "id": "jellyfin-ios",
   "name": "Jellyfin for iOS",
   "description": "The official Jellyfin app for iOS and iPadOS devices.",
   "beta": false,
   "recommended": true,
   "deviceTypes": [
    "Mobile"
   ],
   "platforms": [
    "iOS"
   ],
   "links": [
    {
     "name": "App Store",
     "url": "https://apps.apple.com/us/app/jellyfin-mobile/id1480192618?mt=8"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-ios"
    }
   ]
  },
  {
   "id": "swiftfin",
   "name": "Swiftfin",
   "description": "Swiftfin is a modern video client for Jellyfin. Redesigned in Swift to maximize direct play with the power of VLC and look native on all classes of Apple devices.",
   "beta": true,
   "recommended": false,
   "deviceTypes": [
    "Mobile",
    "TV"
   ],
   "platforms": [
    "iOS",
    "tvOS"
   ],
   "links": [
    {
     "name": "App Store",
     "url": "https://apps.apple.com/ca/app/swiftfin/id1604098728"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/swiftfin"
    }
   ]
  },
  {
   "id": "jellyfin-androidtv",
   "name": "Jellyfin for Android TV",
   "description": "The official Jellyfin app for Android TV and Fire TV devices.",
   "beta": false,
   "recommended": true,
   "deviceTypes": [
    "TV"
   ],
   "platforms": [
    "Android TV",
    "Fire TV"
   ],
   "links": [
    {
     "name": "F-Droid",
     "url": "https://f-droid.org/en/packages/org.jellyfin.androidtv/"
    },
    {
     "name": "Amazon Appstore",
     "url": "https://www.amazon.com/gp/aw/d/B07TX7Z725"
    },
    {
     "name": "Play Store",
     "url": "https://play.google.com/store/apps/details?id=org.jellyfin.androidtv"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-androidtv"
    }
   ]
  },
  {
   "id": "jellyfin-roku",
   "name": "Jellyfin for Roku",
   "description": "The official Jellyfin app for Roku devices.",
   "beta": false,
   "recommended": true,
   "deviceTypes": [
    "TV"
   ],
   "platforms": [
    "Roku"
   ],
   "links": [
    {
     "name": "Channel Store",
     "url": "https://channelstore.roku.com/details/592369/jellyfin"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-roku"
    }
   ]
  },
  {
   "id": "jellyfin-webos",
   "name": "Jellyfin for WebOS",
   "description": "The official Jellyfin app for WebOS devices.",
   "beta": false,
   "recommended": true,
   "deviceTypes": [
    "TV"
   ],
   "platforms": [
    "webOS"
   ],
   "links": [
    {
     "name": "Content Store",
     "url": "https://us.lgappstv.com/main/tvapp/detail?appId=1030579"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-webos"
    }
   ]
  },
  {
   "id": "jellyfin-tizen",
   "name": "Jellyfin for Tizen",
   "description": "The official Jellyfin app for Samsung Tizen devices.",
   "beta": false,
   "recommended": true,
   "deviceTypes": [
    "TV"
   ],
   "platforms": [
    "Tizen"
   ],
   "links": [
    {
     "name": "Smart TV App Store",
     "url": "https://www.samsung.com/us/tvs/smart-tv/samsung-tv-apps-detail/?appId=3202007021208"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-tizen"
    }
   ]
  },
  {
   "id": "mopidy",
   "name": "Mopidy-Jellyfin",
   "description": "An official plugin for Mopidy that uses Jellyfin as a backend.",
   "beta": false,
   "recommended": false,
   "deviceTypes": [],
   "platforms": [],
   "links": [],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/mopidy-jellyfin"
    }
   ]
  },
  {
   "id": "jellyfin-xbox",
   "name": "Jellyfin for Xbox",
   "description": "The official Jellyfin app for Xbox consoles.",
   "beta": false,
   "recommended": true,
   "deviceTypes": [
    "TV"
   ],
   "platforms": [
    "Xbox"
   ],
   "links": [
    {
     "name": "Microsoft Store",
     "url": "https://apps.microsoft.com/detail/9P2DRTG62QF8"
    }
   ],
   "moreLinks": [
    {
     "name": "GitHub",
     "url": "https://github.com/jellyfin/jellyfin-xbox"
    }
   ]
  }
 ]
};
