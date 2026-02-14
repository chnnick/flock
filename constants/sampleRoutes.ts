export interface RouteSegment {
  type: 'walk' | 'transit';
  coordinates: [number, number][];
  label?: string;
  transitLine?: string;
}

export interface MatchOverlap {
  matchName: string;
  matchAvatar: string;
  coordinates: [number, number][];
  meetPoint: [number, number];
  splitPoint: [number, number];
  meetPointName: string;
  splitPointName: string;
}

export interface CommuteRoute {
  id: string;
  segments: RouteSegment[];
  startName: string;
  endName: string;
  totalDuration: string;
  walkDuration: string;
  transitDuration: string;
  matchOverlaps: MatchOverlap[];
}

export const SAMPLE_ROUTES: Record<string, CommuteRoute> = {
  'walk-downtown': {
    id: 'walk-downtown',
    segments: [
      {
        type: 'walk',
        coordinates: [
          [42.3467, -71.0972],
          [42.3475, -71.0950],
          [42.3488, -71.0920],
          [42.3495, -71.0895],
          [42.3505, -71.0865],
          [42.3510, -71.0840],
          [42.3518, -71.0810],
          [42.3525, -71.0785],
          [42.3530, -71.0760],
          [42.3538, -71.0730],
          [42.3545, -71.0700],
          [42.3550, -71.0675],
          [42.3554, -71.0640],
        ],
        label: 'Walk to Boston Common',
      },
      {
        type: 'walk',
        coordinates: [
          [42.3554, -71.0640],
          [42.3560, -71.0625],
          [42.3568, -71.0610],
          [42.3575, -71.0600],
          [42.3585, -71.0592],
          [42.3595, -71.0588],
          [42.3601, -71.0589],
        ],
        label: 'Walk to Downtown Crossing',
      },
    ],
    startName: 'Brookline Village',
    endName: 'Downtown Crossing',
    totalDuration: '28 min',
    walkDuration: '28 min',
    transitDuration: '0 min',
    matchOverlaps: [
      {
        matchName: 'Alex Chen',
        matchAvatar: '#25A18E',
        coordinates: [
          [42.3510, -71.0840],
          [42.3518, -71.0810],
          [42.3525, -71.0785],
          [42.3530, -71.0760],
          [42.3538, -71.0730],
          [42.3545, -71.0700],
          [42.3550, -71.0675],
          [42.3554, -71.0640],
        ],
        meetPoint: [42.3510, -71.0840],
        splitPoint: [42.3554, -71.0640],
        meetPointName: 'Longwood Ave',
        splitPointName: 'Boston Common',
      },
    ],
  },
  'transit-mit': {
    id: 'transit-mit',
    segments: [
      {
        type: 'walk',
        coordinates: [
          [42.3395, -71.0943],
          [42.3405, -71.0930],
          [42.3415, -71.0918],
          [42.3420, -71.0910],
          [42.3428, -71.0898],
          [42.3432, -71.0888],
        ],
        label: 'Walk to Coolidge Corner Station',
      },
      {
        type: 'transit',
        coordinates: [
          [42.3432, -71.0888],
          [42.3440, -71.0860],
          [42.3452, -71.0825],
          [42.3465, -71.0790],
          [42.3480, -71.0750],
          [42.3495, -71.0715],
          [42.3510, -71.0680],
          [42.3525, -71.0650],
          [42.3540, -71.0625],
          [42.3548, -71.0615],
        ],
        label: 'Green Line C',
        transitLine: 'Green Line C',
      },
      {
        type: 'walk',
        coordinates: [
          [42.3548, -71.0615],
          [42.3555, -71.0608],
          [42.3562, -71.0600],
          [42.3570, -71.0595],
          [42.3580, -71.0590],
          [42.3590, -71.0588],
          [42.3601, -71.0589],
        ],
        label: 'Walk to Downtown Crossing',
      },
    ],
    startName: 'Coolidge Corner',
    endName: 'Downtown Crossing',
    totalDuration: '22 min',
    walkDuration: '10 min',
    transitDuration: '12 min',
    matchOverlaps: [
      {
        matchName: 'Jordan Rivera',
        matchAvatar: '#3B82F6',
        coordinates: [
          [42.3465, -71.0790],
          [42.3480, -71.0750],
          [42.3495, -71.0715],
          [42.3510, -71.0680],
          [42.3525, -71.0650],
          [42.3540, -71.0625],
          [42.3548, -71.0615],
        ],
        meetPoint: [42.3465, -71.0790],
        splitPoint: [42.3548, -71.0615],
        meetPointName: 'Kenmore Station',
        splitPointName: 'Boylston Station',
      },
      {
        matchName: 'Sam Parker',
        matchAvatar: '#F59E0B',
        coordinates: [
          [42.3495, -71.0715],
          [42.3510, -71.0680],
          [42.3525, -71.0650],
        ],
        meetPoint: [42.3495, -71.0715],
        splitPoint: [42.3525, -71.0650],
        meetPointName: 'Hynes Convention Ctr',
        splitPointName: 'Copley Station',
      },
    ],
  },
  'walk-harvard': {
    id: 'walk-harvard',
    segments: [
      {
        type: 'walk',
        coordinates: [
          [42.3736, -71.1190],
          [42.3725, -71.1165],
          [42.3715, -71.1140],
          [42.3705, -71.1115],
          [42.3698, -71.1090],
          [42.3688, -71.1060],
          [42.3678, -71.1030],
          [42.3668, -71.1000],
        ],
        label: 'Walk along Mass Ave',
      },
      {
        type: 'walk',
        coordinates: [
          [42.3668, -71.1000],
          [42.3660, -71.0975],
          [42.3650, -71.0950],
          [42.3642, -71.0920],
          [42.3635, -71.0895],
          [42.3625, -71.0862],
        ],
        label: 'Continue to MIT',
      },
    ],
    startName: 'Harvard Square',
    endName: 'MIT Campus',
    totalDuration: '25 min',
    walkDuration: '25 min',
    transitDuration: '0 min',
    matchOverlaps: [
      {
        matchName: 'Taylor Kim',
        matchAvatar: '#EC4899',
        coordinates: [
          [42.3698, -71.1090],
          [42.3688, -71.1060],
          [42.3678, -71.1030],
          [42.3668, -71.1000],
          [42.3660, -71.0975],
          [42.3650, -71.0950],
        ],
        meetPoint: [42.3698, -71.1090],
        splitPoint: [42.3650, -71.0950],
        meetPointName: 'Central Square',
        splitPointName: 'Kendall Square',
      },
    ],
  },
};

export function getRouteForCommute(startName: string, endName: string, transportMode: string): CommuteRoute {
  if (transportMode === 'transit') {
    return SAMPLE_ROUTES['transit-mit'];
  }

  const startLower = startName.toLowerCase();
  const endLower = endName.toLowerCase();

  if (startLower.includes('harvard') || endLower.includes('mit')) {
    return SAMPLE_ROUTES['walk-harvard'];
  }

  return SAMPLE_ROUTES['walk-downtown'];
}
