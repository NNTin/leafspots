export type Category = 'swimming' | 'hiking' | 'beer garden' | 'cycling' | 'skiing';

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: Category;
  description?: string;
}

export const spots: Spot[] = [
  {
    id: '1',
    name: 'Eibsee',
    lat: 47.458,
    lng: 10.984,
    category: 'swimming',
    description: 'Beautiful lake near Zugspitze with crystal clear water.',
  },
  {
    id: '2',
    name: 'Chiemsee',
    lat: 47.868,
    lng: 12.464,
    category: 'swimming',
    description: 'Bavaria\'s largest lake, also known as the "Bavarian Sea".',
  },
  {
    id: '3',
    name: 'Tegernsee',
    lat: 47.711,
    lng: 11.757,
    category: 'swimming',
    description: 'Popular lake in the Bavarian Alps with scenic mountain backdrop.',
  },
  {
    id: '4',
    name: 'Zugspitze Trail',
    lat: 47.421,
    lng: 10.985,
    category: 'hiking',
    description: 'Summit trail to Germany\'s highest peak at 2,962 m.',
  },
  {
    id: '5',
    name: 'Berchtesgaden National Park',
    lat: 47.605,
    lng: 12.985,
    category: 'hiking',
    description: 'UNESCO biosphere reserve with spectacular Alpine scenery.',
  },
  {
    id: '6',
    name: 'Partnachklamm Gorge',
    lat: 47.475,
    lng: 11.071,
    category: 'hiking',
    description: 'Stunning 700 m long gorge near Garmisch-Partenkirchen.',
  },
  {
    id: '7',
    name: 'Hofbräuhaus München',
    lat: 48.137,
    lng: 11.58,
    category: 'beer garden',
    description: 'World-famous historic beer hall in the heart of Munich.',
  },
  {
    id: '8',
    name: 'Augustiner Keller',
    lat: 48.142,
    lng: 11.553,
    category: 'beer garden',
    description: 'One of Munich\'s oldest beer gardens, established in 1812.',
  },
  {
    id: '9',
    name: 'Englischer Garten Biergarten',
    lat: 48.164,
    lng: 11.605,
    category: 'beer garden',
    description: 'Iconic beer garden in the Englischer Garten park, Munich.',
  },
  {
    id: '10',
    name: 'Altmühltal Cycle Path',
    lat: 48.909,
    lng: 11.188,
    category: 'cycling',
    description: 'Scenic 160 km cycling route through the Altmühl Valley.',
  },
  {
    id: '11',
    name: 'Bodensee Cycle Path',
    lat: 47.658,
    lng: 9.475,
    category: 'cycling',
    description: 'Popular circular cycling route around Lake Constance.',
  },
  {
    id: '12',
    name: 'Garmisch-Classic Ski Resort',
    lat: 47.484,
    lng: 11.095,
    category: 'skiing',
    description: 'Top ski resort near Garmisch-Partenkirchen with runs for all levels.',
  },
  {
    id: '13',
    name: 'Nebelhorn Ski Resort',
    lat: 47.406,
    lng: 10.363,
    category: 'skiing',
    description: 'Family-friendly ski resort in Oberstdorf with spectacular views.',
  },
  {
    id: '14',
    name: 'Starnberger See',
    lat: 47.907,
    lng: 11.31,
    category: 'swimming',
    description: 'Scenic lake south of Munich, popular for swimming and sailing.',
  },
  {
    id: '15',
    name: 'Ammersee',
    lat: 47.996,
    lng: 11.12,
    category: 'swimming',
    description: 'Lovely Bavarian lake with sandy beaches and clear water.',
  },
];

export const categories: Category[] = ['swimming', 'hiking', 'beer garden', 'cycling', 'skiing'];
