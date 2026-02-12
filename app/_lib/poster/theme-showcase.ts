import type { PosterRequest } from "@/app/_lib/poster/types";

export type ThemeShowcaseSeed = {
  themeId: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  distance: number;
  note: string;
};

export type ShowcaseManifest = {
  generatedAt: string | null;
  entries: Record<string, string>;
};

export const SHOWCASE_DIMENSIONS = {
  width: 4.5,
  height: 6
} as const;

export const THEME_SHOWCASE_SEEDS: ThemeShowcaseSeed[] = [
  {
    themeId: "arctic_teal",
    city: "Venice",
    country: "Italy",
    latitude: "45.4372",
    longitude: "12.3346",
    distance: 5500,
    note: "Canals and islands for a compact, iconic mini-map."
  },
  {
    themeId: "autumn",
    city: "Vancouver",
    country: "Canada",
    latitude: "49.2827",
    longitude: "-123.1207",
    distance: 10000,
    note: "Peninsula form, inlets, and mountain-edge urban texture."
  },
  {
    themeId: "blueprint",
    city: "New York",
    country: "USA",
    latitude: "40.7831",
    longitude: "-73.9712",
    distance: 7600,
    note: "Manhattan grid and Central Park silhouette."
  },
  {
    themeId: "contrast_zones",
    city: "Istanbul",
    country: "Turkey",
    latitude: "41.0082",
    longitude: "28.9784",
    distance: 12000,
    note: "Bosphorus split-continent geometry."
  },
  {
    themeId: "copper_patina",
    city: "Cairo",
    country: "Egypt",
    latitude: "30.0444",
    longitude: "31.2357",
    distance: 10000,
    note: "Nile ribbon, bridges, and dense urban grain."
  },
  {
    themeId: "desert_night",
    city: "Dubai",
    country: "United Arab Emirates",
    latitude: "25.2048",
    longitude: "55.2708",
    distance: 12000,
    note: "Palm and marina forms with desert-edge coastline."
  },
  {
    themeId: "emerald",
    city: "Stockholm",
    country: "Sweden",
    latitude: "59.3293",
    longitude: "18.0686",
    distance: 9000,
    note: "Island clusters and water corridors."
  },
  {
    themeId: "forest",
    city: "Cape Town",
    country: "South Africa",
    latitude: "-33.9249",
    longitude: "18.4241",
    distance: 11000,
    note: "Table Mountain edge and dramatic coastline."
  },
  {
    themeId: "gradient_roads",
    city: "San Francisco",
    country: "USA",
    latitude: "37.7749",
    longitude: "-122.4194",
    distance: 9000,
    note: "Grid, bay edge, and hilly street character."
  },
  {
    themeId: "japanese_ink",
    city: "Tokyo",
    country: "Japan",
    latitude: "35.6762",
    longitude: "139.6503",
    distance: 11000,
    note: "Rail nodes and dense neighborhood texture."
  },
  {
    themeId: "midnight_blue",
    city: "Sydney",
    country: "Australia",
    latitude: "-33.8688",
    longitude: "151.2093",
    distance: 12000,
    note: "Harbor-led composition with strong water contours."
  },
  {
    themeId: "monochrome_blue",
    city: "Chicago",
    country: "USA",
    latitude: "41.8781",
    longitude: "-87.6298",
    distance: 9200,
    note: "Lakefront edge, river forks, and ordered grid."
  },
  {
    themeId: "neon_cyberpunk",
    city: "Hong Kong",
    country: "China",
    latitude: "22.3193",
    longitude: "114.1694",
    distance: 9500,
    note: "Harbor shape and dense vertical districts."
  },
  {
    themeId: "noir",
    city: "London",
    country: "United Kingdom",
    latitude: "51.5074",
    longitude: "-0.1278",
    distance: 9800,
    note: "Thames bends and historic street mesh."
  },
  {
    themeId: "ocean",
    city: "Amsterdam",
    country: "Netherlands",
    latitude: "52.3676",
    longitude: "4.9041",
    distance: 7000,
    note: "Concentric canals and radial water lines."
  },
  {
    themeId: "pastel_dream",
    city: "Paris",
    country: "France",
    latitude: "48.8566",
    longitude: "2.3522",
    distance: 9000,
    note: "Seine loops and Haussmann boulevards."
  },
  {
    themeId: "sage_minimal",
    city: "Singapore",
    country: "Singapore",
    latitude: "1.3521",
    longitude: "103.8198",
    distance: 8000,
    note: "Marina Bay profile and clean coastal edge."
  },
  {
    themeId: "sunset",
    city: "Rio de Janeiro",
    country: "Brazil",
    latitude: "-22.9068",
    longitude: "-43.1729",
    distance: 12000,
    note: "Beaches, lagoons, and mountain-backed coastline."
  },
  {
    themeId: "terracotta",
    city: "Rome",
    country: "Italy",
    latitude: "41.9028",
    longitude: "12.4964",
    distance: 9000,
    note: "Ancient street geometry and Tiber curves."
  },
  {
    themeId: "warm_beige",
    city: "Barcelona",
    country: "Spain",
    latitude: "41.3851",
    longitude: "2.1734",
    distance: 7600,
    note: "Eixample blocks meeting old-town fabric."
  },
  {
    themeId: "arid_turquoise",
    city: "Santa Fe",
    country: "USA",
    latitude: "35.6870",
    longitude: "-105.9378",
    distance: 9400,
    note: "Adobe-grid texture framed by dry washes and foothills."
  },
  {
    themeId: "aurora_night",
    city: "Reykjavik",
    country: "Iceland",
    latitude: "64.1466",
    longitude: "-21.9426",
    distance: 9000,
    note: "Harbor edge and low-rise street web under polar-night contrast."
  },
  {
    themeId: "citrus_grove",
    city: "Valencia",
    country: "Spain",
    latitude: "39.4699",
    longitude: "-0.3763",
    distance: 8600,
    note: "Old-quarter streets and broad avenues near the Turia corridor."
  },
  {
    themeId: "cobalt_sunrise",
    city: "Athens",
    country: "Greece",
    latitude: "37.9838",
    longitude: "23.7275",
    distance: 9800,
    note: "Dense basin geometry with ring roads and historic core grain."
  },
  {
    themeId: "electric_plum",
    city: "Seoul",
    country: "South Korea",
    latitude: "37.5665",
    longitude: "126.9780",
    distance: 10500,
    note: "River split and layered expressway network for neon-style contrast."
  },
  {
    themeId: "lilac_nocturne",
    city: "Kyoto",
    country: "Japan",
    latitude: "35.0116",
    longitude: "135.7681",
    distance: 8200,
    note: "Ordered ward blocks with river arcs and temple-district texture."
  },
  {
    themeId: "mint_chalk",
    city: "Wellington",
    country: "New Zealand",
    latitude: "-41.2866",
    longitude: "174.7756",
    distance: 9200,
    note: "Harbor bowl and hillside streets with a compact coastal footprint."
  },
  {
    themeId: "moonlit_amber",
    city: "Jaipur",
    country: "India",
    latitude: "26.9124",
    longitude: "75.7873",
    distance: 11000,
    note: "Planned avenue grid and old-city geometry with bright arterial lines."
  },
  {
    themeId: "rose_gold_dust",
    city: "Marrakesh",
    country: "Morocco",
    latitude: "31.6295",
    longitude: "-7.9811",
    distance: 9000,
    note: "Medina density contrasted against newer boulevards and garden districts."
  },
  {
    themeId: "volcanic_ember",
    city: "Naples",
    country: "Italy",
    latitude: "40.8518",
    longitude: "14.2681",
    distance: 9800,
    note: "Bay-edge road weave and volcanic terrain transitions around the city."
  }
];

export function getShowcaseSeed(themeId: string): ThemeShowcaseSeed | undefined {
  return THEME_SHOWCASE_SEEDS.find((seed) => seed.themeId === themeId);
}

export function buildShowcasePosterRequest(seed: ThemeShowcaseSeed): PosterRequest {
  return {
    city: seed.city,
    country: seed.country,
    latitude: seed.latitude,
    longitude: seed.longitude,
    showMarker: false,
    markerColor: "#d62828",
    markerIcon: "dot",
    markerSize: "medium",
    countryLabel: undefined,
    theme: seed.themeId,
    allThemes: false,
    distance: seed.distance,
    width: SHOWCASE_DIMENSIONS.width,
    height: SHOWCASE_DIMENSIONS.height,
    displayCity: seed.city,
    displayCountry: seed.country,
    fontFamily: undefined,
    format: "png"
  };
}
