import { PlaybackFeature } from "./playback-feature.js";
import { getFitCameraTarget } from "./playback-camera.js";
import {
  formatDateTimeLocal,
  isValidDateInterval,
  parseDateTimeLocal,
  resolveDateBounds,
} from "./date-filter.js";

const DEFAULT_CENTER = [39.5, -98.35];
const DEFAULT_ZOOM = 4;
const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;
const LOAD_CENTER_ZOOM = 4;
const SAMPLE_CENTER_LIMIT = 10000;
const ZOOM_BUTTON_STEP = 0.5;
const WHEEL_ZOOM_SENSITIVITY = 0.003;
const PINCH_MIN_DISTANCE_PX = 24;
const TAP_MAX_DURATION_MS = 280;
const TAP_MAX_DISTANCE_PX = 12;
const DOUBLE_TAP_DELAY_MS = 320;
const DOUBLE_TAP_DISTANCE_PX = 48;
const MAX_LATITUDE = 85.05112878;
const GLOBE_MIN_ZOOM = 2;
const GLOBE_MAX_ZOOM = 7;
const GLOBE_BASE_RADIUS_RATIO = 0.38;
const GLOBE_ZOOM_SCALE = 1.55;
const GLOBE_BASEMAP_SOURCE = "./public/assets/worldHigh.svg";
const GLOBE_SOURCE_TEXTURE_WIDTH = 4096;
const GLOBE_RENDER_PIXEL_RATIO_CAP = 2;
const WORLD_HIGH_VIEWBOX = { x: -2, y: 17.68, width: 964, height: 924.64 };
const WORLD_HIGH_MERCATOR_SIZE = 960;
const WORLD_HIGH_LAT_LIMIT = 84.3718418170537;
const GLOBE_THEME_FALLBACKS = {
  space: "#07111f",
  oceanHighlight: "#f8fafc",
  oceanShallow: "#dbeafe",
  oceanMid: "#7dd3fc",
  oceanDeep: "#0f4c81",
  land: "#c8d1c2",
  border: "rgba(255, 255, 255, 0.78)",
  graticule: "rgba(15, 23, 42, 0.16)",
  outline: "rgba(15, 23, 42, 0.42)",
};
const UPLOAD_BUTTON_LABEL = "Upload";
const UPLOAD_BUTTON_TITLE = "Upload Maps Timeline JSON and manual CSV";
const BASE_COLOR_HUES = [221.21212121212122, 141.21212121212122, 1.21212121212122];
const BASE_COLOR_SATURATION = 0.8319327731092435;
const BASE_COLOR_LIGHTNESS = 0.5333333333333333;
const BASE_LAYER_COLORS = ["#2563eb", "#25eb6b", "#eb2925"];
const SPEED_UNITS = [
  { id: "mph", label: "mph", fieldLabel: "mph", multiplier: 2.2369362920544, step: 0.1 },
  { id: "kmh", label: "km/h", fieldLabel: "km/h", multiplier: 3.6, step: 0.1 },
  { id: "mps", label: "m/s", fieldLabel: "m/s", multiplier: 1, step: 0.1 },
  { id: "knots", label: "knots", fieldLabel: "kts", multiplier: 1.9438444924406, step: 0.1 },
];
const LAYER_SETTINGS_TABS = [
  ["visual", "Visual"],
  ["mechanics", "Mechanics"],
  ["range", "Range"],
  ["exclusions", "Exclusions"],
];
const MAP_STYLES = [
  {
    id: "standard",
    label: "Standard",
    background: "#dbe3ee",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    tileUrl: ({ z, x, y }) => "https://tile.openstreetmap.org/" + z + "/" + x + "/" + y + ".png",
  },
  {
    id: "light",
    label: "Light",
    background: "#f1f5f9",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    tileUrl: ({ z, x, y }) => "https://a.basemaps.cartocdn.com/light_all/" + z + "/" + x + "/" + y + ".png",
  },
  {
    id: "dark",
    label: "Dark",
    background: "#111827",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    tileUrl: ({ z, x, y }) => "https://a.basemaps.cartocdn.com/dark_all/" + z + "/" + x + "/" + y + ".png",
  },
  {
    id: "blank",
    label: "Blank",
    background: "#eef1f5",
    attribution: "",
    tileUrl: null,
  },
];
// Exact paths from @vscode/codicons src/icons/*.svg.
const CODICON_PATHS = {
  clearAll: [
    {
      d: "M13.5004 12.0004C13.7762 12.0006 14.0004 12.2245 14.0004 12.5004C14.0002 12.7761 13.7761 13.0002 13.5004 13.0004H2.50037C2.22449 13.0004 2.00056 12.7762 2.00037 12.5004C2.00037 12.2244 2.22437 12.0004 2.50037 12.0004H13.5004Z",
    },
    {
      d: "M13.5004 9.00037C13.7762 9.00056 14.0004 9.22449 14.0004 9.50037C14.0002 9.77608 13.7761 10.0002 13.5004 10.0004H2.50037C2.22449 10.0004 2.00056 9.7762 2.00037 9.50037C2.00037 9.22437 2.22437 9.00037 2.50037 9.00037H13.5004Z",
    },
    {
      d: "M13.5004 6.00037C13.7762 6.00056 14.0004 6.22449 14.0004 6.50037C14.0002 6.77608 13.7761 7.00017 13.5004 7.00037H7.50037C7.22449 7.00037 7.00056 6.7762 7.00037 6.50037C7.00037 6.22437 7.22437 6.00037 7.50037 6.00037H13.5004Z",
    },
    {
      d: "M5.50037 0.999023C5.63295 0.999115 5.76009 1.05179 5.85388 1.14551C5.94777 1.23939 6.00037 1.36722 6.00037 1.5C6.00027 1.63265 5.94769 1.75971 5.85388 1.85352L3.7074 4L5.85388 6.14551C5.94777 6.23939 6.00037 6.36722 6.00037 6.5C6.00027 6.63265 5.94769 6.75971 5.85388 6.85352C5.76008 6.94732 5.63302 6.99991 5.50037 7C5.36759 7 5.23976 6.9474 5.14587 6.85352L3.00037 4.70703L0.853882 6.85352C0.760077 6.94732 0.633017 6.99991 0.500366 7C0.36759 7 0.239761 6.9474 0.145874 6.85352C0.0521583 6.75972 -0.000519052 6.63258 -0.000610352 6.5C-0.000610354 6.36722 0.0519875 6.23939 0.145874 6.14551L2.29333 4L0.145874 1.85352C0.0521583 1.75972 -0.000519119 1.63258 -0.000610352 1.5C-0.000610351 1.36722 0.0519874 1.23939 0.145874 1.14551C0.239761 1.05162 0.36759 0.999023 0.500366 0.999023C0.63295 0.999115 0.76009 1.05179 0.853882 1.14551L3.00037 3.29297L5.14587 1.14551C5.23976 1.05162 5.36759 0.999023 5.50037 0.999023Z",
    },
    {
      d: "M13.5004 3.00037C13.7762 3.00056 14.0004 3.22449 14.0004 3.50037C14.0002 3.77608 13.7761 4.00017 13.5004 4.00037H7.50037C7.22449 4.00037 7.00056 3.7762 7.00037 3.50037C7.00037 3.22437 7.22437 3.00037 7.50037 3.00037H13.5004Z",
    },
  ],
  close: [
    {
      d: "M8.70701 8.00001L12.353 4.35401C12.548 4.15901 12.548 3.84201 12.353 3.64701C12.158 3.45201 11.841 3.45201 11.646 3.64701L8.00001 7.29301L4.35401 3.64701C4.15901 3.45201 3.84201 3.45201 3.64701 3.64701C3.45201 3.84201 3.45201 4.15901 3.64701 4.35401L7.29301 8.00001L3.64701 11.646C3.45201 11.841 3.45201 12.158 3.64701 12.353C3.74501 12.451 3.87301 12.499 4.00101 12.499C4.12901 12.499 4.25701 12.45 4.35501 12.353L8.00101 8.70701L11.647 12.353C11.745 12.451 11.873 12.499 12.001 12.499C12.129 12.499 12.257 12.45 12.355 12.353C12.55 12.158 12.55 11.841 12.355 11.646L8.70901 8.00001H8.70701Z",
    },
  ],
  add: [
    {
      d: "M8 1.5C8 1.22386 7.77614 1 7.5 1C7.22386 1 7 1.22386 7 1.5V7H1.5C1.22386 7 1 7.22386 1 7.5C1 7.77614 1.22386 8 1.5 8H7V13.5C7 13.7761 7.22386 14 7.5 14C7.77614 14 8 13.7761 8 13.5V8H13.5C13.7761 8 14 7.77614 14 7.5C14 7.22386 13.7761 7 13.5 7H8V1.5Z",
    },
  ],
  remove: [
    {
      d: "M2.5 7C2.22386 7 2 7.22386 2 7.5C2 7.77614 2.22386 8 2.5 8H13.5C13.7761 8 14 7.77614 14 7.5C14 7.22386 13.7761 7 13.5 7H2.5Z",
    },
  ],
  chevronDown: [
    {
      d: "M3.14598 5.85423L7.64598 10.3542C7.84098 10.5492 8.15798 10.5492 8.35298 10.3542L12.853 5.85423C13.048 5.65923 13.048 5.34223 12.853 5.14723C12.658 4.95223 12.341 4.95223 12.146 5.14723L7.99998 9.29323L3.85398 5.14723C3.65898 4.95223 3.34198 4.95223 3.14698 5.14723C2.95198 5.34223 2.95098 5.65923 3.14598 5.85423Z",
    },
  ],
  chevronLeft: [
    {
      d: "M9.14601 3.14623L4.64601 7.64623C4.45101 7.84123 4.45101 8.15823 4.64601 8.35323L9.14601 12.8532C9.34101 13.0482 9.65801 13.0482 9.85301 12.8532C10.048 12.6582 10.048 12.3412 9.85301 12.1462L5.70701 8.00023L9.85301 3.85423C10.048 3.65923 10.048 3.34223 9.85301 3.14723C9.65801 2.95223 9.34101 2.95223 9.14601 3.14723V3.14623Z",
    },
  ],
  chevronUp: [
    {
      d: "M3.14603 9.85423C3.34103 10.0492 3.65803 10.0492 3.85303 9.85423L7.99903 5.70823L12.145 9.85423C12.34 10.0492 12.657 10.0492 12.852 9.85423C13.047 9.65923 13.047 9.34223 12.852 9.14723L8.35203 4.64723C8.15703 4.45223 7.84003 4.45223 7.64503 4.64723L3.14503 9.14723C2.95003 9.34223 2.95103 9.65923 3.14603 9.85423Z",
    },
  ],
  question: [
    {
      d: "M8 11C8.41421 11 8.75 11.3358 8.75 11.75C8.75 12.1642 8.41421 12.5 8 12.5C7.58579 12.5 7.25 12.1642 7.25 11.75C7.25 11.3358 7.58579 11 8 11Z",
    },
    {
      d: "M8 4C9.262 4 10.25 4.988 10.25 6.25C10.25 7.333 9.68352 7.89852 9.22852 8.35352C8.82052 8.76052 8.5 9.082 8.5 9.75C8.5 10.026 8.276 10.25 8 10.25C7.724 10.25 7.5 10.026 7.5 9.75C7.5 8.667 8.06648 8.10148 8.52148 7.64648C8.92948 7.23948 9.25 6.918 9.25 6.25C9.25 5.538 8.712 5 8 5C7.288 5 6.75 5.538 6.75 6.25C6.75 6.526 6.526 6.75 6.25 6.75C5.974 6.75 5.75 6.526 5.75 6.25C5.75 4.988 6.738 4 8 4Z",
    },
    {
      d: "M8 1C11.86 1 15 4.14 15 8C15 11.86 11.86 15 8 15C4.14 15 1 11.86 1 8C1 4.14 4.14 1 8 1ZM8 2C4.691 2 2 4.691 2 8C2 11.309 4.691 14 8 14C11.309 14 14 11.309 14 8C14 4.691 11.309 2 8 2Z",
      fillRule: "evenodd",
      clipRule: "evenodd",
    },
  ],
  refresh: [
    {
      d: "M3 8C3 5.23858 5.23858 3 8 3C9.63527 3 11.0878 3.78495 12.0005 5H10C9.72386 5 9.5 5.22386 9.5 5.5C9.5 5.77614 9.72386 6 10 6H12.8904C12.8973 6.00014 12.9041 6.00014 12.911 6H13C13.2761 6 13.5 5.77614 13.5 5.5V2.5C13.5 2.22386 13.2761 2 13 2C12.7239 2 12.5 2.22386 12.5 2.5V4.03138C11.4009 2.78613 9.79253 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14C11.1301 14 13.6999 11.6035 13.9756 8.54488C14.0003 8.26985 13.7975 8.0268 13.5225 8.00202C13.2474 7.97723 13.0044 8.1801 12.9796 8.45512C12.75 11.003 10.6079 13 8 13C5.23858 13 3 10.7614 3 8Z",
    },
  ],
  layers: [
    {
      d: "M8 8.99993C7.819 8.99993 7.643 8.95093 7.486 8.85793L2.486 5.85693C2.186 5.67793 2 5.34893 2 4.99993C2 4.65093 2.187 4.32093 2.486 4.14193L7.486 1.14293C7.789 0.95693 8.207 0.95493 8.517 1.14493L13.513 4.14293C13.813 4.32293 13.999 4.65093 13.999 4.99993C13.999 5.34893 13.812 5.67893 13.513 5.85793L8.513 8.85693C8.357 8.95093 8.181 8.99993 8 8.99993ZM8 1.99993L3 4.99993L8 7.99993L13 4.99993L8 1.99993Z",
    },
    {
      d: "M2.146 6.9873L8 10.5003L13.854 6.9873C13.946 7.1413 14 7.3173 14 7.5003C14 7.8493 13.814 8.1783 13.514 8.3583L8.514 11.3573C8.357 11.4513 8.181 11.5003 8 11.5003C7.819 11.5003 7.642 11.4513 7.486 11.3583L2.486 8.35731C2.187 8.17931 2 7.8503 2 7.5003C2 7.3163 2.054 7.1403 2.146 6.9873Z",
    },
    {
      d: "M2.146 9.4873L8 13.0003L13.854 9.4873C13.946 9.6413 14 9.8173 14 10.0003C14 10.3493 13.814 10.6783 13.514 10.8583L8.514 13.8573C8.357 13.9513 8.181 14.0003 8 14.0003C7.819 14.0003 7.642 13.9513 7.486 13.8583L2.486 10.8573C2.187 10.6793 2 10.3503 2 10.0003C2 9.8163 2.054 9.6403 2.146 9.4873Z",
    },
  ],
  symbolRuler: [
    {
      d: "M10.9999 3.4997C10.9999 2.67127 10.3284 1.99969 9.49994 1.99969H6.49994C5.67151 1.99969 4.99994 2.67127 4.99994 3.49969V12.5003C4.99994 13.3287 5.67151 14.0003 6.49994 14.0003H9.49994C10.3284 14.0003 10.9999 13.3287 10.9999 12.5003L10.9999 3.4997ZM9.49994 2.99969C9.77608 2.9997 9.99994 3.22355 9.99994 3.4997L9.99994 12.5003C9.99994 12.7764 9.77608 13.0003 9.49994 13.0003H6.49994C6.2238 13.0003 5.99994 12.7764 5.99994 12.5003V11H7.49997C7.77611 11 7.99997 10.7761 7.99997 10.5C7.99997 10.2238 7.77611 9.99997 7.49997 9.99997H5.99997L5.99994 8.49997C5.99993 8.49997 5.99995 8.49997 5.99994 8.49997H7.99997C8.27611 8.49997 8.49997 8.27611 8.49997 7.99997C8.49997 7.72383 8.27611 7.49997 7.99997 7.49997H5.99997C5.99996 7.49997 5.99998 7.49997 5.99997 7.49997L5.99994 5.99997H7.49997C7.77611 5.99997 7.99997 5.77611 7.99997 5.49997C7.99997 5.22383 7.77611 4.99997 7.49997 4.99997H5.99997L5.99994 3.49969C5.99994 3.22355 6.2238 2.99969 6.49994 2.99969L9.49994 2.99969Z",
    },
  ],
  symbolColor: [
    {
      d: "M8.00101 1C4.13401 1 1.00101 3.8 1.00101 7.667C1.00101 8.956 2.04501 10 3.33401 10C4.75101 10 4.72101 9 6.00001 9C6.64401 9 7.00001 9.606 7.00001 10.25V11.5C7.00001 13.433 8.56701 15 10.5 15C13.653 15 14.999 11.215 14.999 8C14.999 4.134 11.866 1 8.00001 1H8.00101ZM10.5 14C9.12201 14 8.00001 12.878 8.00001 11.5V10.25C8.00001 8.967 7.14001 8 6.00001 8C5.04001 8 4.49801 8.412 4.13901 8.685C3.85401 8.902 3.72401 9 3.33401 9C2.59901 9 2.00101 8.402 2.00101 7.667C2.00101 4.436 4.58001 2 8.00101 2C11.309 2 14 4.692 14 8C14 10.412 13.068 14 10.501 14H10.5ZM12 11C12 11.552 11.552 12 11 12C10.448 12 10 11.552 10 11C10 10.448 10.448 10 11 10C11.552 10 12 10.448 12 11ZM13 8C13 8.552 12.552 9 12 9C11.448 9 11 8.552 11 8C11 7.448 11.448 7 12 7C12.552 7 13 7.448 13 8ZM6.00001 5C6.00001 5.552 5.55201 6 5.00001 6C4.44801 6 4.00001 5.552 4.00001 5C4.00001 4.448 4.44801 4 5.00001 4C5.55201 4 6.00001 4.448 6.00001 5ZM10 5C10 4.448 10.448 4 11 4C11.552 4 12 4.448 12 5C12 5.552 11.552 6 11 6C10.448 6 10 5.552 10 5ZM9.00001 4C9.00001 4.552 8.55201 5 8.00001 5C7.44801 5 7.00001 4.552 7.00001 4C7.00001 3.448 7.44801 3 8.00001 3C8.55201 3 9.00001 3.448 9.00001 4Z",
    },
  ],
  debugLineByLine: [
    {
      d: "M3.62204 8.91401C4.49504 9.08801 5.40004 8.99901 6.22204 8.65801C7.04404 8.31701 7.74704 7.74101 8.24204 7.00101C8.73604 6.26101 9.00004 5.39101 9.00004 4.50101C9.00004 3.30801 8.52604 2.16301 7.68204 1.31901C6.83804 0.475007 5.69404 0.00100708 4.50004 0.00100708C3.61004 0.00100708 2.74004 0.265007 2.00004 0.759007C1.26004 1.25301 0.683038 1.95601 0.343038 2.77901C0.00203794 3.60001 -0.0869621 4.50501 0.0860379 5.37801C0.259038 6.25101 0.688038 7.05301 1.31804 7.68201C1.94804 8.31101 2.74904 8.74001 3.62204 8.91401ZM3.00004 2.85001C3.00004 2.76301 3.02304 2.67701 3.06604 2.60201C3.10904 2.52601 3.17104 2.46301 3.24704 2.41901C3.32204 2.37501 3.40704 2.35101 3.49404 2.35001C3.58104 2.34901 3.66704 2.37101 3.74304 2.41301L6.71304 4.06301C6.79104 4.10601 6.85604 4.17001 6.90104 4.24601C6.94604 4.32301 6.97004 4.41001 6.97004 4.50001C6.97004 4.59001 6.94604 4.67701 6.90104 4.75301C6.85604 4.83001 6.79104 4.89301 6.71304 4.93601L3.74304 6.58601C3.66704 6.62801 3.58104 6.65001 3.49404 6.64901C3.40704 6.64801 3.32204 6.62401 3.24704 6.58001C3.17204 6.53601 3.11004 6.47301 3.06604 6.39701C3.02304 6.32101 3.00004 6.23601 3.00004 6.14901V2.85001ZM15 7.50001C15 7.77601 14.776 8.00001 14.5 8.00001H8.74304C8.99704 7.69301 9.21804 7.35801 9.40004 7.00001H14.5C14.776 7.00001 15 7.22401 15 7.50001ZM9.97804 4.00001C9.94704 3.65701 9.88504 3.32201 9.79304 3.00001H14.5C14.776 3.00001 15 3.22401 15 3.50001C15 3.77601 14.776 4.00001 14.5 4.00001H9.97804ZM15 11.5C15 11.776 14.776 12 14.5 12H1.50004C1.22404 12 1.00004 11.776 1.00004 11.5C1.00004 11.224 1.22404 11 1.50004 11H14.5C14.776 11 15 11.224 15 11.5Z",
    },
  ],
  play: [
    {
      d: "M4.74514 3.06414C4.41183 2.87665 4 3.11751 4 3.49993V12.5002C4 12.8826 4.41182 13.1235 4.74512 12.936L12.7454 8.43601C13.0852 8.24486 13.0852 7.75559 12.7454 7.56443L4.74514 3.06414ZM3 3.49993C3 2.35268 4.2355 1.63011 5.23541 2.19257L13.2357 6.69286C14.2551 7.26633 14.2551 8.73415 13.2356 9.30759L5.23537 13.8076C4.23546 14.37 3 13.6474 3 12.5002V3.49993Z",
    },
  ],
  debugPause: [
    {
      d: "M5.5 2.75V13.25C5.5 13.664 5.164 14 4.75 14C4.336 14 4 13.664 4 13.25V2.75C4 2.336 4.336 2 4.75 2C5.164 2 5.5 2.336 5.5 2.75ZM11.25 2C10.836 2 10.5 2.336 10.5 2.75V13.25C10.5 13.664 10.836 14 11.25 14C11.664 14 12 13.664 12 13.25V2.75C12 2.336 11.664 2 11.25 2Z",
    },
  ],
  debugRestart: [
    {
      d: "M14 8C14 8.81 13.842 9.596 13.528 10.336C13.224 11.053 12.791 11.694 12.241 12.243C11.694 12.791 11.053 13.224 10.337 13.528C9.59602 13.841 8.81002 14 8.00002 14C7.19002 14 6.40402 13.842 5.66402 13.528C4.94702 13.224 4.30602 12.791 3.75702 12.242C3.20802 11.693 2.77602 11.053 2.47202 10.337C2.31002 9.956 2.48802 9.516 2.86902 9.354C3.25102 9.19 3.69002 9.37 3.85202 9.751C4.08102 10.288 4.40502 10.77 4.81802 11.181C5.23002 11.595 5.71202 11.919 6.24902 12.148C7.35602 12.615 8.64302 12.615 9.75202 12.148C10.288 11.919 10.77 11.595 11.181 11.183C11.595 10.77 11.919 10.288 12.148 9.751C12.381 9.197 12.501 8.608 12.501 8C12.501 7.392 12.382 6.803 12.148 6.248C11.919 5.712 11.595 5.23 11.182 4.819C10.77 4.405 10.288 4.081 9.75102 3.852C8.64402 3.385 7.35702 3.385 6.24802 3.852C5.71202 4.081 5.23002 4.405 4.81902 4.817C4.60802 5.027 4.42002 5.256 4.25702 5.5H6.24902C6.66302 5.5 6.99902 5.836 6.99902 6.25C6.99902 6.664 6.66302 7 6.24902 7H2.74902C2.33502 7 1.99902 6.664 1.99902 6.25V2.75C1.99902 2.336 2.33502 2 2.74902 2C3.16302 2 3.49902 2.336 3.49902 2.75V4.032C3.58202 3.938 3.66802 3.845 3.75802 3.757C4.30502 3.209 4.94602 2.776 5.66202 2.472C7.14402 1.845 8.85402 1.845 10.335 2.472C11.052 2.776 11.693 3.209 12.242 3.758C12.791 4.307 13.223 4.947 13.527 5.663C13.84 6.404 13.999 7.19 13.999 8H14Z",
    },
  ],
};

const elements = {
  uploadSection: document.querySelector("#uploadSection"),
  fileInput: document.querySelector("#timelineFile"),
  fileLabel: document.querySelector("#fileLabel"),
  uploadButton: document.querySelector("#uploadButton"),
  helpButton: document.querySelector("#helpButton"),
  speedUnitButton: document.querySelector("#speedUnitButton"),
  speedUnitMenu: document.querySelector("#speedUnitMenu"),
  instructionsModal: document.querySelector("#instructionsModal"),
  closeInstructionsButton: document.querySelector("#closeInstructionsButton"),
  minimizeButton: document.querySelector("#minimizeButton"),
  restoreButton: document.querySelector("#restoreButton"),
  addLayerButton: document.querySelector("#addLayerButton"),
  clearLayersButton: document.querySelector("#clearLayersButton"),
  layerSection: document.querySelector("#layerSection"),
  layerList: document.querySelector("#layerList"),
};

let selectedFiles = [];
let uploadLayers = [];
let processQueue = [];
let activeProcessingLayer = null;
let nextLayerId = 1;
let nextDateExclusionId = 1;
let timelineMap = null;
let playbackFeature = null;
let displaySpeedUnitId = "mph";
let defaultSettings = {
  mode: "points",
  minSpeed: 0.44704,
  maxSpeed: 447.04,
  precision: 4,
  size: 2.5,
};

setupPanelIconButton(elements.minimizeButton, "chevronLeft", "Minimize controls");
setupPanelIconButton(elements.helpButton, "question", "Open instructions");
setupPanelIconButton(elements.speedUnitButton, "symbolRuler", "Speed unit: mph");
renderSpeedUnitMenu();
updateSpeedUnitButton();
setupPanelIconButton(elements.closeInstructionsButton, "close", "Close instructions");
setupPanelIconButton(elements.addLayerButton, "add", "Add layer");
setupPanelIconButton(elements.clearLayersButton, "clearAll", "Clear all layers");

elements.uploadButton.addEventListener("click", openUploadDialog);
elements.addLayerButton.addEventListener("click", openUploadDialog);

elements.fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(elements.fileInput.files ?? []);
  updateUploadButtonMeta();
  processSelectedFiles();
});
elements.helpButton.addEventListener("click", () => {
  setSpeedUnitMenuVisible(false);
  setInstructionsVisible(true);
});
elements.speedUnitButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setSpeedUnitMenuVisible(elements.speedUnitMenu.hidden);
});
elements.closeInstructionsButton.addEventListener("click", () => setInstructionsVisible(false));
elements.instructionsModal.addEventListener("click", (event) => {
  if (event.target === elements.instructionsModal) {
    setInstructionsVisible(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (!elements.instructionsModal.hidden) {
    setInstructionsVisible(false);
  }

  if (!elements.speedUnitMenu.hidden) {
    setSpeedUnitMenuVisible(false);
  }
});
elements.minimizeButton.addEventListener("click", () => {
  setSpeedUnitMenuVisible(false);
  setPanelCollapsed(true);
});
elements.restoreButton.addEventListener("click", () => setPanelCollapsed(false));
elements.clearLayersButton.addEventListener("click", clearAllLayers);
document.addEventListener("click", (event) => {
  if (
    !elements.speedUnitMenu.hidden &&
    !elements.speedUnitButton.contains(event.target) &&
    !elements.speedUnitMenu.contains(event.target)
  ) {
    setSpeedUnitMenuVisible(false);
  }
});
window.addEventListener("resize", () => {
  if (!elements.speedUnitMenu.hidden) {
    positionSpeedUnitMenu();
  }
});

renderLayerList();

function openUploadDialog() {
  elements.fileInput.click();
}

function processSelectedFiles() {
  if (!selectedFiles.length) return;

  const newLayers = selectedFiles.map((file) => createUploadLayer(file));
  uploadLayers.push(...newLayers);
  playbackFeature?.invalidateData();
  selectedFiles = [];
  elements.fileInput.value = "";
  updateUploadButtonMeta();

  for (const layer of newLayers) {
    enqueueProcessLayer(layer);
  }

  renderLayerList();
}

function createUploadLayer(file) {
  const id = nextLayerId++;

  return {
    id,
    file,
    fileType: getFileType(file),
    name: file.name,
    mode: defaultSettings.mode,
    minSpeed: defaultSettings.minSpeed,
    maxSpeed: defaultSettings.maxSpeed,
    precision: defaultSettings.precision,
    size: defaultSettings.size,
    color: getLayerCycleColor(id - 1),
    isCollapsed: false,
    activeSettingsTab: "visual",
    availableStartMs: null,
    availableEndMs: null,
    dateRangeStartMs: null,
    dateRangeEndMs: null,
    dateExclusions: [],
    status: "queued",
    progress: 0,
    stats: null,
    cleanedPoints: [],
    displayPoints: [],
    canvasLayer: null,
    worker: null,
    error: "",
  };
}

function enqueueProcessLayer(layer) {
  playbackFeature?.invalidateData();
  cancelLayerWork(layer);
  layer.status = "queued";
  layer.progress = 0;
  layer.error = "";
  layer.stats = null;
  layer.cleanedPoints = [];
  layer.displayPoints = [];
  layer.canvasLayer = null;
  processQueue.push(layer.id);
  processNextLayer();
}

function processNextLayer() {
  if (activeProcessingLayer || processQueue.length === 0) return;

  const layerId = processQueue.shift();
  const layer = uploadLayers.find((candidate) => candidate.id === layerId);

  if (!layer) {
    processNextLayer();
    return;
  }

  activeProcessingLayer = layer;
  layer.status = "processing";
  layer.progress = 0;
  renderLayerList();

  const worker = new Worker(new URL("./timeline-worker.js", import.meta.url), { type: "module" });
  layer.worker = worker;

  worker.addEventListener("message", (event) => {
    const message = event.data;

    if (message.type === "progress") {
      layer.progress = message.percent;
      layer.stats = {
        ...(layer.stats ?? emptyStats()),
        rawCount: message.rawCount,
      };
      layer.keptCount = message.keptCount;
      renderLayerList();
      return;
    }

    if (message.type === "done") {
      layer.status = "ready";
      layer.progress = 100;
      layer.stats = message.stats;
      layer.cleanedPoints = message.points;
      initializeLayerDateBounds(layer, message.stats, message.points);
      layer.worker = null;
      worker.terminate();
      activeProcessingLayer = null;
      rebuildLayer(layer);
      playbackFeature?.invalidateData();
      renderAllMapLayers({ center: processQueue.length === 0 });
      renderLayerList();
      processNextLayer();
      return;
    }

    if (message.type === "error") {
      markLayerError(layer, message.error);
      worker.terminate();
      activeProcessingLayer = null;
      processNextLayer();
    }
  });

  worker.addEventListener("error", (event) => {
    markLayerError(layer, event.message || "Worker failed");
    worker.terminate();
    activeProcessingLayer = null;
    processNextLayer();
  });

  worker.postMessage({
    type: "parse",
    file: layer.file,
    options: {
      fileType: layer.fileType,
      minSpeed: layer.minSpeed,
      maxSpeed: layer.maxSpeed,
      dateRangeStartMs: layer.dateRangeStartMs,
      dateRangeEndMs: layer.dateRangeEndMs,
      dateExclusions: layer.dateExclusions.map(({ startMs, endMs }) => ({ startMs, endMs })),
    },
  });
}

function markLayerError(layer, error) {
  layer.status = "error";
  layer.error = error;
  layer.worker = null;
  renderLayerList();
}

function cancelLayerWork(layer) {
  processQueue = processQueue.filter((id) => id !== layer.id);

  if (layer.worker) {
    layer.worker.terminate();
    layer.worker = null;
  }

  if (activeProcessingLayer?.id === layer.id) {
    activeProcessingLayer = null;
  }
}

function clearAllLayers() {
  for (const layer of uploadLayers) {
    cancelLayerWork(layer);
  }

  uploadLayers = [];
  processQueue = [];
  activeProcessingLayer = null;
  timelineMap.setLayers([]);
  playbackFeature?.invalidateData();
  renderLayerList();
}

function deleteLayer(layer) {
  const wasActive = activeProcessingLayer?.id === layer.id;
  cancelLayerWork(layer);
  uploadLayers = uploadLayers.filter((candidate) => candidate.id !== layer.id);
  playbackFeature?.invalidateData();
  renderAllMapLayers();
  renderLayerList();

  if (wasActive) {
    processNextLayer();
  }
}

function rebuildLayer(layer) {
  if (!layer.cleanedPoints.length || layer.status !== "ready") {
    layer.displayPoints = [];
    layer.canvasLayer = null;
    return;
  }

  layer.displayPoints =
    layer.mode === "points" ? buildRoundedPins(layer.cleanedPoints, layer.precision) : layer.cleanedPoints;
  layer.canvasLayer =
    layer.mode === "points"
      ? new PointCanvasLayer(layer.displayPoints, { color: layer.color, radius: layer.size })
      : new RouteCanvasLayer(layer.displayPoints, { color: layer.color, width: layer.size });
}

function renderAllMapLayers(options = {}) {
  for (const layer of uploadLayers) {
    if (layer.status === "ready" && !layer.canvasLayer) {
      rebuildLayer(layer);
    }
  }

  timelineMap.setLayers(uploadLayers.map((layer) => layer.canvasLayer).filter(Boolean));

  if (options.center) {
    centerOnLayerSampleAverage();
  }

  timelineMap.renderNow();
}

function buildRoundedPins(points, precision) {
  const digits = Math.max(1, Math.min(7, Math.round(precision)));
  const factor = 10 ** digits;
  const seen = new Set();
  const pins = [];

  for (const point of points) {
    const lat = Math.round(point[0] * factor) / factor;
    const lon = Math.round(point[1] * factor) / factor;
    const key = `${lat}:${lon}`;

    if (!seen.has(key)) {
      seen.add(key);
      pins.push([lat, lon, point[2], point[3], point[4], point[5]]);
    }
  }

  return pins;
}

function centerOnLayerSampleAverage() {
  const totalPoints = uploadLayers.reduce(
    (sum, layer) => sum + (layer.status === "ready" ? layer.displayPoints.length : 0),
    0,
  );
  if (!totalPoints) return;

  const step = Math.max(1, Math.floor(totalPoints / SAMPLE_CENTER_LIMIT));
  let seen = 0;
  let count = 0;
  let latTotal = 0;
  let lonTotal = 0;

  for (const layer of uploadLayers) {
    if (layer.status !== "ready") continue;

    for (const point of layer.displayPoints) {
      if (seen % step === 0) {
        latTotal += point[0];
        lonTotal += point[1];
        count += 1;
      }
      seen += 1;
    }
  }

  if (!count) return;

  timelineMap.setView([latTotal / count, lonTotal / count], LOAD_CENTER_ZOOM);
}

function renderLayerList() {
  const hasLayers = uploadLayers.length > 0;
  elements.uploadSection.hidden = hasLayers;
  elements.layerSection.hidden = !hasLayers;
  elements.clearLayersButton.disabled = !hasLayers;

  if (!hasLayers) {
    elements.layerList.replaceChildren();
    playbackFeature?.refreshAvailability();
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const layer of uploadLayers) {
    fragment.append(createLayerCard(layer));
  }

  elements.layerList.replaceChildren(fragment);
  playbackFeature?.refreshAvailability();
}

function updateUploadButtonMeta() {
  elements.fileLabel.textContent = UPLOAD_BUTTON_LABEL;

  const title =
    selectedFiles.length === 0
      ? UPLOAD_BUTTON_TITLE
      : `${formatNumber(selectedFiles.length)} file${selectedFiles.length === 1 ? "" : "s"} selected`;
  elements.uploadButton.title = title;
  elements.uploadButton.setAttribute("aria-label", title);
}

function setInstructionsVisible(isVisible) {
  elements.instructionsModal.hidden = !isVisible;
}

function renderSpeedUnitMenu() {
  const fragment = document.createDocumentFragment();

  for (const unit of SPEED_UNITS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "speed-unit-option";
    button.setAttribute("role", "menuitemradio");
    button.setAttribute("aria-checked", String(unit.id === displaySpeedUnitId));
    button.classList.toggle("is-active", unit.id === displaySpeedUnitId);
    button.textContent = unit.label;
    button.addEventListener("click", () => setDisplaySpeedUnit(unit.id));
    fragment.append(button);
  }

  elements.speedUnitMenu.replaceChildren(fragment);
}

function setDisplaySpeedUnit(unitId) {
  if (!SPEED_UNITS.some((unit) => unit.id === unitId)) return;

  displaySpeedUnitId = unitId;
  renderSpeedUnitMenu();
  updateSpeedUnitButton();
  setSpeedUnitMenuVisible(false);
  renderLayerList();
  playbackFeature?.refreshInfo(true);
}

function setSpeedUnitMenuVisible(isVisible) {
  if (isVisible) {
    positionSpeedUnitMenu();
  }

  elements.speedUnitMenu.hidden = !isVisible;
  elements.speedUnitButton.setAttribute("aria-expanded", String(isVisible));
}

function positionSpeedUnitMenu() {
  const buttonRect = elements.speedUnitButton.getBoundingClientRect();
  const menuWidth = Math.max(elements.speedUnitMenu.offsetWidth, 76);
  const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, buttonRect.left));
  elements.speedUnitMenu.style.left = left + "px";
  elements.speedUnitMenu.style.top = buttonRect.bottom + 6 + "px";
}

function updateSpeedUnitButton() {
  const unit = getDisplaySpeedUnit();
  const label = "Speed unit: " + unit.label;
  elements.speedUnitButton.title = label;
  elements.speedUnitButton.setAttribute("aria-label", label);
  elements.speedUnitButton.setAttribute("aria-haspopup", "menu");
  elements.speedUnitButton.setAttribute("aria-controls", "speedUnitMenu");
  elements.speedUnitButton.setAttribute("aria-expanded", String(!elements.speedUnitMenu.hidden));
}

function getDisplaySpeedUnit() {
  return SPEED_UNITS.find((unit) => unit.id === displaySpeedUnitId) ?? SPEED_UNITS.find((unit) => unit.id === "mps");
}

function renderSettingsControls(container, { modeName, values, onChange }) {
  container.replaceChildren(
    createSegmentedControl(modeName, "Mode", values.mode, [
      ["points", "Points"],
      ["route", "Route"],
    ], (value) => onChange("mode", value)),
    createColorControl("Color", values.color, (value) => onChange("color", value), "layer-span-3"),
    createNumberControl("Weight", values.size, 1, 12, 0.5, (value) => onChange("size", value), "layer-span-3"),
  );
}

function createLayerCard(layer) {
  const card = document.createElement("div");
  card.className = "layer-card";
  card.classList.toggle("is-collapsed", Boolean(layer.isCollapsed));

  const header = document.createElement("div");
  header.className = "layer-card-header";

  const textWrap = document.createElement("div");
  textWrap.style.minWidth = "0";

  const name = document.createElement("div");
  name.className = "layer-name";
  name.textContent = layer.name;

  const meta = document.createElement("div");
  meta.className = "layer-meta";
  meta.textContent = getLayerMeta(layer);

  textWrap.append(name, meta);

  const actionGroup = document.createElement("div");
  actionGroup.className = "layer-actions";

  const collapseButton = createIconButton(
    layer.isCollapsed ? "chevronDown" : "chevronUp",
    layer.isCollapsed ? "Expand layer" : "Collapse layer",
  );
  collapseButton.setAttribute("aria-expanded", String(!layer.isCollapsed));
  collapseButton.addEventListener("click", () => {
    layer.isCollapsed = !layer.isCollapsed;
    renderLayerList();
  });

  const reprocessButton = createIconButton("refresh", "Reprocess layer");
  reprocessButton.disabled = layer.status === "processing";
  reprocessButton.addEventListener("click", () => {
    enqueueProcessLayer(layer);
    renderLayerList();
    renderAllMapLayers();
  });

  const deleteButton = createIconButton("close", "Delete layer");
  deleteButton.addEventListener("click", () => {
    deleteLayer(layer);
  });

  actionGroup.append(collapseButton, reprocessButton, deleteButton);
  header.append(textWrap, actionGroup);
  card.append(header);

  if (layer.isCollapsed) {
    return card;
  }

  card.append(createLayerSettingsTabs(layer));
  return card;
}

function createLayerSettingsTabs(layer) {
  if (!LAYER_SETTINGS_TABS.some(([id]) => id === layer.activeSettingsTab)) {
    layer.activeSettingsTab = "visual";
  }

  const settings = document.createElement("div");
  settings.className = "layer-settings";
  const tabList = document.createElement("div");
  tabList.className = "layer-settings-tabs";
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", `${layer.name} settings`);
  const panelId = `layer-settings-panel-${layer.id}`;

  for (const [tabId, label] of LAYER_SETTINGS_TABS) {
    const isActive = tabId === layer.activeSettingsTab;
    const button = document.createElement("button");
    button.type = "button";
    button.id = `layer-settings-tab-${layer.id}-${tabId}`;
    button.className = "layer-settings-tab";
    button.dataset.layerSettingsTab = tabId;
    button.textContent = label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("aria-controls", panelId);
    button.tabIndex = isActive ? 0 : -1;
    button.addEventListener("click", () => activateLayerSettingsTab(layer, tabId));
    button.addEventListener("keydown", (event) => handleLayerSettingsTabKeydown(event, layer, tabId));
    tabList.append(button);
  }

  const panel = document.createElement("div");
  panel.id = panelId;
  panel.className = "layer-settings-panel";
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", `layer-settings-tab-${layer.id}-${layer.activeSettingsTab}`);
  panel.append(createLayerSettingsContent(layer));
  settings.append(tabList, panel);
  return settings;
}

function activateLayerSettingsTab(layer, tabId) {
  if (!LAYER_SETTINGS_TABS.some(([id]) => id === tabId)) return;
  layer.activeSettingsTab = tabId;
  renderLayerList();
  document.querySelector(`#layer-settings-tab-${layer.id}-${tabId}`)?.focus();
}

function handleLayerSettingsTabKeydown(event, layer, currentTabId) {
  const currentIndex = LAYER_SETTINGS_TABS.findIndex(([id]) => id === currentTabId);
  let nextIndex = null;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % LAYER_SETTINGS_TABS.length;
  if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + LAYER_SETTINGS_TABS.length) % LAYER_SETTINGS_TABS.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = LAYER_SETTINGS_TABS.length - 1;
  if (nextIndex === null) return;
  event.preventDefault();
  activateLayerSettingsTab(layer, LAYER_SETTINGS_TABS[nextIndex][0]);
}

function createLayerSettingsContent(layer) {
  if (layer.activeSettingsTab === "mechanics") return createMechanicsSettings(layer);
  if (layer.activeSettingsTab === "range") return createDateRangeSettings(layer);
  if (layer.activeSettingsTab === "exclusions") return createDateExclusionsSettings(layer);
  return createVisualSettings(layer);
}

function createVisualSettings(layer) {
  const controls = document.createElement("div");
  controls.className = "layer-controls layer-settings-grid";
  renderSettingsControls(controls, {
    modeName: `layer-mode-${layer.id}`,
    values: layer,
    onChange: (field, value) => {
      if (field === "mode") {
        layer.mode = value;
        rebuildLayer(layer);
        renderAllMapLayers();
        renderLayerList();
        return;
      }

      if (field === "color") {
        layer.color = value;
        playbackFeature?.invalidateData();
        rebuildLayer(layer);
        renderAllMapLayers();
        return;
      }

      if (field === "size") {
        layer.size = value;
        playbackFeature?.invalidateData();
        rebuildLayer(layer);
        renderAllMapLayers();
        return;
      }
    },
  });
  return controls;
}

function createMechanicsSettings(layer) {
  const controls = document.createElement("div");
  controls.className = "layer-controls layer-settings-grid";
  controls.append(
    createNumberControl("Precision", layer.precision, 1, 7, 1, (value) => {
      layer.precision = Math.round(value);
      rebuildLayer(layer);
      renderAllMapLayers();
      renderLayerList();
    }, "layer-span-4"),
    createSpeedControl("Min Speed", layer.minSpeed, 0, 1000, (value) => {
      layer.minSpeed = value;
    }, "layer-span-4", "min"),
    createSpeedControl("Max Speed", layer.maxSpeed, 1, 5000, (value) => {
      layer.maxSpeed = value;
    }, "layer-span-4", "max"),
  );
  return controls;
}

function createDateRangeSettings(layer) {
  const content = document.createElement("div");
  content.className = "layer-controls layer-settings-grid layer-date-range-controls";

  if (!hasLayerDateBounds(layer)) {
    content.append(createLayerSettingsMessage("Date bounds will be available after processing."));
  } else {
    content.append(
      createDateTimeControl(
        "Starting datetime",
        layer.dateRangeStartMs,
        layer.availableStartMs,
        layer.dateRangeEndMs,
        (value) => updateLayerDateRange(layer, "dateRangeStartMs", value),
        "layer-span-6",
      ),
      createDateTimeControl(
        "Ending datetime",
        layer.dateRangeEndMs,
        layer.dateRangeStartMs,
        layer.availableEndMs,
        (value) => updateLayerDateRange(layer, "dateRangeEndMs", value),
        "layer-span-6",
      ),
    );
  }
  return content;
}

function createDateExclusionsSettings(layer) {
  const content = document.createElement("div");
  content.className = "layer-exclusions-settings";

  const toolbar = document.createElement("div");
  toolbar.className = "date-exclusion-toolbar";
  const addButton = createIconButton("add", "Add date exclusion");
  addButton.classList.add("date-exclusion-add");
  const addLabel = document.createElement("span");
  addLabel.textContent = "Add exclusion";
  addButton.append(addLabel);
  addButton.disabled = !hasLayerDateBounds(layer);
  addButton.addEventListener("click", () => addDateExclusion(layer));
  toolbar.append(addButton);
  content.append(toolbar);

  if (!hasLayerDateBounds(layer)) {
    content.append(createLayerSettingsMessage("Date bounds will be available after processing."));
  } else if (!layer.dateExclusions.length) {
    content.append(createLayerSettingsMessage("No excluded time periods."));
  } else {
    const list = document.createElement("div");
    list.className = "date-exclusion-list";

    for (const [index, exclusion] of layer.dateExclusions.entries()) {
      const row = document.createElement("div");
      row.className = "date-exclusion-row";
      row.append(
        createDateTimeControl(
          "Start",
          exclusion.startMs,
          layer.availableStartMs,
          exclusion.endMs,
          (value) => updateDateExclusion(layer, exclusion.id, "startMs", value),
          "",
          { hideLabel: index > 0 },
        ),
        createDateTimeControl(
          "End",
          exclusion.endMs,
          exclusion.startMs,
          layer.availableEndMs,
          (value) => updateDateExclusion(layer, exclusion.id, "endMs", value),
          "",
          { hideLabel: index > 0 },
        ),
      );

      const removeButton = createIconButton("remove", "Remove date exclusion");
      removeButton.classList.add("date-exclusion-remove");
      removeButton.addEventListener("click", () => removeDateExclusion(layer, exclusion.id));
      row.append(removeButton);
      list.append(row);
    }

    content.append(list);
  }
  return content;
}

function createLayerSettingsMessage(message) {
  const text = document.createElement("p");
  text.className = "layer-settings-message";
  text.textContent = message;
  return text;
}

function createDateTimeControl(label, valueMs, minMs, maxMs, onChange, className = "", options = {}) {
  const wrapper = document.createElement("label");
  wrapper.className = ["date-time-control", className].filter(Boolean).join(" ");
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("input");
  input.type = "datetime-local";
  input.step = "0.001";
  input.value = formatDateTimeLocal(valueMs);
  input.min = formatDateTimeLocal(minMs);
  input.max = formatDateTimeLocal(maxMs);
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => {
    const next = parseDateTimeLocal(input.value);
    if (Number.isFinite(next) && onChange(next)) return;
    input.value = formatDateTimeLocal(valueMs);
    input.setCustomValidity("Choose an ordered datetime within the available dataset range.");
    input.reportValidity();
    input.setCustomValidity("");
  });
  if (!options.hideLabel) wrapper.append(text);
  wrapper.append(input);
  return wrapper;
}

function initializeLayerDateBounds(layer, stats, points) {
  const bounds = resolveDateBounds(stats, points);
  if (!bounds) {
    layer.availableStartMs = null;
    layer.availableEndMs = null;
    layer.dateRangeStartMs = null;
    layer.dateRangeEndMs = null;
    layer.dateExclusions = [];
    return;
  }

  const minimum = bounds.startMs;
  const maximum = bounds.endMs;
  layer.availableStartMs = minimum;
  layer.availableEndMs = maximum;
  if (!isValidDateInterval(layer.dateRangeStartMs, layer.dateRangeEndMs, minimum, maximum)) {
    layer.dateRangeStartMs = minimum;
    layer.dateRangeEndMs = maximum;
  }
  layer.dateExclusions = layer.dateExclusions.filter((interval) =>
    isValidDateInterval(interval.startMs, interval.endMs, minimum, maximum));
}

function hasLayerDateBounds(layer) {
  return isValidDateInterval(
    layer.dateRangeStartMs,
    layer.dateRangeEndMs,
    layer.availableStartMs,
    layer.availableEndMs,
  );
}

function updateLayerDateRange(layer, field, value) {
  const startMs = field === "dateRangeStartMs" ? value : layer.dateRangeStartMs;
  const endMs = field === "dateRangeEndMs" ? value : layer.dateRangeEndMs;
  if (!isValidDateInterval(startMs, endMs, layer.availableStartMs, layer.availableEndMs)) return false;
  layer[field] = value;
  renderLayerList();
  return true;
}

function addDateExclusion(layer) {
  if (!hasLayerDateBounds(layer)) return;
  const previousEndMs = layer.dateExclusions.at(-1)?.endMs;
  const startMs = Number.isFinite(previousEndMs)
    ? Math.min(previousEndMs + 1000, layer.dateRangeEndMs)
    : layer.dateRangeStartMs;
  const endMs = Math.min(startMs + 24 * 60 * 60 * 1000, layer.dateRangeEndMs);
  layer.dateExclusions.push({ id: nextDateExclusionId++, startMs, endMs });
  layer.activeSettingsTab = "exclusions";
  renderLayerList();
}

function updateDateExclusion(layer, id, field, value) {
  const exclusion = layer.dateExclusions.find((candidate) => candidate.id === id);
  if (!exclusion) return false;
  const startMs = field === "startMs" ? value : exclusion.startMs;
  const endMs = field === "endMs" ? value : exclusion.endMs;
  if (!isValidDateInterval(startMs, endMs, layer.availableStartMs, layer.availableEndMs)) return false;
  exclusion[field] = value;
  renderLayerList();
  return true;
}

function removeDateExclusion(layer, id) {
  layer.dateExclusions = layer.dateExclusions.filter((exclusion) => exclusion.id !== id);
  renderLayerList();
}

function createSegmentedControl(name, label, value, options, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "layer-span-6";
  const text = document.createElement("span");
  text.textContent = label;
  const group = document.createElement("div");
  group.className = "segmented-control layer-segmented-control";

  for (const [optionValue, optionLabel] of options) {
    const item = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = optionValue;
    input.checked = optionValue === value;
    input.addEventListener("change", () => {
      if (input.checked) {
        onChange(input.value);
      }
    });

    const labelText = document.createElement("span");
    labelText.textContent = optionLabel;
    item.append(input, labelText);
    group.append(item);
  }

  wrapper.append(text, group);
  return wrapper;
}

function createIconButton(iconName, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "layer-icon-button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(createCodicon(iconName));
  return button;
}

function createCodicon(iconName) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const pathSpec of CODICON_PATHS[iconName]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathSpec.d);
    if (pathSpec.fillRule) {
      path.setAttribute("fill-rule", pathSpec.fillRule);
    }
    if (pathSpec.clipRule) {
      path.setAttribute("clip-rule", pathSpec.clipRule);
    }
    svg.append(path);
  }

  return svg;
}

function setupPanelIconButton(button, iconName, label) {
  button.textContent = "";
  button.classList.add("panel-icon-button");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(createCodicon(iconName));
}

function createColorControl(label, value, onChange, className = "") {
  const wrapper = document.createElement("div");
  wrapper.className = ["color-control", className].filter(Boolean).join(" ");
  const text = document.createElement("span");
  text.textContent = label;
  const row = document.createElement("div");
  row.className = "color-input-row";
  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.className = "color-picker-input";
  input.setAttribute("aria-label", label);
  row.append(createColorSwatchGroup(input, onChange), input);
  wrapper.append(text, row);
  return wrapper;
}

function createColorSwatchGroup(input, onChange = () => {}) {
  if (!input) return document.createElement("div");

  const group = document.createElement("div");
  group.className = "color-presets";
  group.dataset.colorPresets = "";
  group.setAttribute("aria-label", "Layer colors");

  for (const color of BASE_LAYER_COLORS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-preset";
    button.style.backgroundColor = color;
    button.dataset.color = color;
    button.title = color;
    button.setAttribute("aria-label", "Use color " + color);
    button.addEventListener("click", () => {
      setColorInputValue(input, color, onChange);
      syncColorPresetSelection(group, color);
    });
    group.append(button);
  }

  const customButton = document.createElement("button");
  customButton.type = "button";
  customButton.className = "color-preset color-preset-custom";
  customButton.dataset.customColor = "";
  customButton.title = "Custom color";
  customButton.setAttribute("aria-label", "Choose custom color");
  customButton.append(createCodicon("symbolColor"));
  customButton.addEventListener("click", () => openColorPicker(input));
  group.append(customButton);

  input.addEventListener("input", () => {
    onChange(input.value);
    syncColorPresetSelection(group, input.value);
  });
  syncColorPresetSelection(group, input.value);
  return group;
}

function setColorInputValue(input, color, onChange) {
  if (!input) {
    console.warn("setColorInputValue called without input");
    return;
  }

  input.value = color;
  onChange(color);

  const group = input.closest(".color-input-row")?.querySelector("[data-color-presets]");
  if (group) {
    syncColorPresetSelection(group, color);
  }
}

function openColorPicker(input) {
  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }

  input.click();
}

function syncColorPresetSelection(group, activeColor) {
  const normalizedActiveColor = activeColor.toLowerCase();
  const customButton = group.querySelector("[data-custom-color]");
  let isBaseColor = false;

  for (const button of group.querySelectorAll("[data-color]")) {
    const isActive = button.dataset.color.toLowerCase() === normalizedActiveColor;
    isBaseColor ||= isActive;
    button.classList.toggle("is-selected", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  if (!customButton) return;

  customButton.classList.toggle("is-selected", !isBaseColor);
  customButton.classList.toggle("has-custom-color", !isBaseColor);
  customButton.setAttribute("aria-pressed", String(!isBaseColor));
  customButton.style.backgroundColor = isBaseColor ? "#fff" : activeColor;
}

function getLayerCycleColor(index) {
  if (index < BASE_LAYER_COLORS.length) {
    return BASE_LAYER_COLORS[index];
  }

  let remaining = index - BASE_LAYER_COLORS.length;
  let depth = 1;
  let colorsPerArc = 1;
  let colorsAtDepth = BASE_COLOR_HUES.length * colorsPerArc;

  while (remaining >= colorsAtDepth) {
    remaining -= colorsAtDepth;
    depth += 1;
    colorsPerArc *= 2;
    colorsAtDepth = BASE_COLOR_HUES.length * colorsPerArc;
  }

  const arcIndex = Math.floor(remaining / colorsPerArc);
  const colorIndex = remaining % colorsPerArc;
  const ratio = (2 * colorIndex + 1) / 2 ** depth;
  const nextArcIndex = (arcIndex + 1) % BASE_COLOR_HUES.length;
  const hue = interpolateHue(BASE_COLOR_HUES[arcIndex], BASE_COLOR_HUES[nextArcIndex], ratio);
  return hslToHex(hue, BASE_COLOR_SATURATION, BASE_COLOR_LIGHTNESS);
}

function interpolateHue(startHue, endHue, ratio) {
  const delta = ((endHue - startHue + 540) % 360) - 180;
  return normalizeHue(startHue + delta * ratio);
}

function hslToHex(hue, saturation, lightness) {
  const normalizedHue = normalizeHue(hue);
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs((normalizedHue / 60) % 2 - 1));
  const match = lightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (normalizedHue < 60) {
    red = chroma;
    green = secondary;
  } else if (normalizedHue < 120) {
    red = secondary;
    green = chroma;
  } else if (normalizedHue < 180) {
    green = chroma;
    blue = secondary;
  } else if (normalizedHue < 240) {
    green = secondary;
    blue = chroma;
  } else if (normalizedHue < 300) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  return [red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0"))
    .join("")
    .padStart(6, "0")
    .replace(/^/, "#");
}

function normalizeHue(hue) {
  return ((hue % 360) + 360) % 360;
}

function createNumberControl(label, value, min, max, step, onChange, className = "") {
  const wrapper = document.createElement("label");
  if (className) {
    wrapper.className = className;
  }
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("change", () => {
    const next = Number(input.value);
    if (Number.isFinite(next)) {
      onChange(Math.max(min, Math.min(max, next)));
    }
  });
  wrapper.append(text, input);
  return wrapper;
}

function createSpeedControl(label, valueMps, minMps, maxMps, onChange, className = "", formatMode = "min") {
  const unit = getDisplaySpeedUnit();
  const wrapper = document.createElement("label");
  wrapper.className = ["speed-control", className].filter(Boolean).join(" ");

  const text = document.createElement("span");
  text.textContent = label + " (" + unit.fieldLabel + ")";

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.value = formatSpeedInput(convertSpeedFromMps(valueMps, unit), formatMode);
  input.addEventListener("change", () => {
    const next = parseSpeedInput(input.value);
    if (!Number.isFinite(next)) {
      input.value = formatSpeedInput(convertSpeedFromMps(valueMps, unit), formatMode);
      return;
    }

    const nextMps = convertSpeedToMps(next, unit);
    const clamped = Math.max(minMps, Math.min(maxMps, nextMps));
    input.value = formatSpeedInput(convertSpeedFromMps(clamped, unit), formatMode);
    onChange(clamped);
  });

  wrapper.append(text, input);
  return wrapper;
}

function convertSpeedFromMps(valueMps, unit = getDisplaySpeedUnit()) {
  return valueMps * unit.multiplier;
}

function convertSpeedToMps(value, unit = getDisplaySpeedUnit()) {
  return value / unit.multiplier;
}

function parseSpeedInput(value) {
  const normalized = String(value).replace(/,/g, "").trim();
  return normalized ? Number(normalized) : NaN;
}

function formatSpeedInput(value, mode = "min") {
  const options =
    mode === "max"
      ? { maximumFractionDigits: 0 }
      : { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  return value.toLocaleString("en-US", options);
}

function getLayerMeta(layer) {
  if (layer.status === "error") {
    return `Error: ${layer.error}`;
  }

  const stats = layer.stats ?? emptyStats();
  const kept = layer.status === "processing" ? layer.keptCount ?? 0 : layer.cleanedPoints.length;
  const displayed = layer.displayPoints.length;
  return `raw ${formatNumber(stats.rawCount)} · kept ${formatNumber(kept)} · display ${formatNumber(displayed)}`;
}

function emptyStats() {
  return {
    rawCount: 0,
    skippedSlow: 0,
    skippedFast: 0,
    skippedDateRange: 0,
    skippedDateExclusion: 0,
    skippedInvalid: 0,
    outOfOrderCount: 0,
    minTimeMs: null,
    maxTimeMs: null,
  };
}

function setPanelCollapsed(isCollapsed) {
  document.body.classList.toggle("is-panel-collapsed", isCollapsed);
  timelineMap.render();
}

function getFileType(file) {
  return file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
}

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function readInteger(input, fallback, min, max) {
  const value = Math.round(readNumber(input, fallback));
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

class GlobeBasemapTexture {
  constructor(source) {
    this.source = source;
    this.status = "idle";
    this.loadPromise = null;
    this.image = null;
    this.sourcePixels = null;
    this.renderCanvas = null;
    this.renderContext = null;
    this.renderImageData = null;
    this.renderWidth = 0;
    this.renderHeight = 0;
  }

  load() {
    if (this.loadPromise) return this.loadPromise;

    this.status = "loading";
    this.loadPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        this.image = image;
        this.buildSourceTexture();
        this.status = "ready";
        resolve(this);
      };
      image.onerror = () => {
        this.status = "error";
        reject(new Error(`Unable to load globe basemap: ${this.source}`));
      };
      image.src = this.source;
    });

    return this.loadPromise;
  }

  buildSourceTexture() {
    const width = GLOBE_SOURCE_TEXTURE_WIDTH;
    const height = Math.round((WORLD_HIGH_VIEWBOX.height / WORLD_HIGH_VIEWBOX.width) * width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.clearRect(0, 0, width, height);
    context.drawImage(this.image, 0, 0, width, height);
    this.sourcePixels = context.getImageData(0, 0, width, height);
  }

  draw(ctx, geometry, theme, viewport) {
    if (this.status === "idle") {
      this.load().catch(() => {});
      return;
    }

    if (this.status !== "ready" || !this.sourcePixels) return;

    const rendered = this.renderToViewportCanvas(geometry, theme, viewport);
    if (!rendered) return;

    const { canvas, bounds } = rendered;
    ctx.drawImage(canvas, bounds.left, bounds.top, bounds.width, bounds.height);
  }

  renderToViewportCanvas(geometry, theme, viewport) {
    const bounds = getGlobeViewportBounds(geometry, viewport);
    if (bounds.width <= 0 || bounds.height <= 0) return null;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, GLOBE_RENDER_PIXEL_RATIO_CAP);
    const width = Math.max(1, Math.ceil(bounds.width * pixelRatio));
    const height = Math.max(1, Math.ceil(bounds.height * pixelRatio));

    if (!this.renderCanvas) {
      this.renderCanvas = document.createElement("canvas");
    }

    if (this.renderWidth !== width || this.renderHeight !== height) {
      this.renderCanvas.width = width;
      this.renderCanvas.height = height;
      this.renderContext = this.renderCanvas.getContext("2d");
      this.renderImageData = this.renderContext.createImageData(width, height);
      this.renderWidth = width;
      this.renderHeight = height;
    }

    const data = this.renderImageData.data;
    data.fill(0);

    const source = this.sourcePixels.data;
    const sourceWidth = this.sourcePixels.width;
    const sourceHeight = this.sourcePixels.height;
    const sinCenterLat = Math.sin(geometry.centerLatRad);
    const cosCenterLat = Math.cos(geometry.centerLatRad);
    const landColor = theme.landColor;
    const borderColor = theme.borderColor;

    for (let y = 0; y < height; y += 1) {
      const cssY = bounds.top + (y + 0.5) / pixelRatio;
      const yNorth = (geometry.cy - cssY) / geometry.radius;

      for (let x = 0; x < width; x += 1) {
        const cssX = bounds.left + (x + 0.5) / pixelRatio;
        const xEast = (cssX - geometry.cx) / geometry.radius;
        const rhoSquared = xEast * xEast + yNorth * yNorth;
        if (rhoSquared > 1) continue;

        const coordinates = inverseOrthographicPoint(
          xEast,
          yNorth,
          rhoSquared,
          geometry.centerLatRad,
          geometry.centerLonRad,
          sinCenterLat,
          cosCenterLat,
        );
        if (!coordinates || Math.abs(coordinates.lat) > WORLD_HIGH_LAT_LIMIT) continue;

        const sample = sampleWorldHighTexture(
          source,
          sourceWidth,
          sourceHeight,
          coordinates.lat,
          coordinates.lon,
        );
        if (!sample) continue;

        const color = sample.isBorder ? borderColor : landColor;
        const alpha = sample.alpha * color.a;
        if (alpha <= 0) continue;

        const outputIndex = (y * width + x) * 4;
        data[outputIndex] = color.r;
        data[outputIndex + 1] = color.g;
        data[outputIndex + 2] = color.b;
        data[outputIndex + 3] = Math.round(alpha * 255);
      }
    }

    this.renderContext.putImageData(this.renderImageData, 0, 0);
    return { canvas: this.renderCanvas, bounds };
  }
}

class TimelineMap {
  constructor(container) {
    this.container = container;
    this.tilePane = document.createElement("div");
    this.tilePane.className = "map-tile-pane";
    this.overlay = document.createElement("canvas");
    this.overlay.className = "timeline-overlay-canvas";
    this.controls = createMapControls();
    this.attribution = createAttribution();
    this.tiles = new Map();
    this.center = { lat: DEFAULT_CENTER[0], lon: DEFAULT_CENTER[1] };
    this.zoom = DEFAULT_ZOOM;
    this.layers = [];
    this.mapStyle = MAP_STYLES[0];
    this.viewMode = "flat";
    this.globeBasemap = new GlobeBasemapTexture(GLOBE_BASEMAP_SOURCE);
    this.frame = null;
    this.drag = null;
    this.pinch = null;
    this.activePointers = new Map();
    this.lastTap = null;
    this.lastTouchDoubleTapTime = 0;

    this.container.append(this.tilePane, this.overlay, this.controls, this.attribution);
    this.bindEvents();
    this.setMapStyle(this.mapStyle.id);
    this.setViewMode(this.viewMode);
    this.globeBasemap.load().then(() => this.render()).catch(() => this.render());
    new ResizeObserver(() => this.render()).observe(this.container);
  }

  setView([lat, lon], zoom = this.zoom) {
    this.center = { lat: clampLatitude(lat), lon: wrapLongitude(lon) };
    this.zoom = clampZoomForView(zoom, this.viewMode);
    this.render();
  }

  getView() {
    return { lat: this.center.lat, lon: this.center.lon, zoom: this.zoom };
  }

  getFitView(bounds, marginPx, startingZoom) {
    return getFitCameraTarget(bounds, {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      marginPx,
      startingZoom,
      viewMode: this.viewMode,
      minZoom: this.viewMode === "globe" ? GLOBE_MIN_ZOOM : MIN_ZOOM,
      maxZoom: this.viewMode === "globe" ? GLOBE_MAX_ZOOM : MAX_ZOOM,
      tileSize: TILE_SIZE,
      globeBaseZoom: LOAD_CENTER_ZOOM,
      globeBaseRadiusRatio: GLOBE_BASE_RADIUS_RATIO,
      globeZoomScale: GLOBE_ZOOM_SCALE,
    });
  }

  setLayers(layers) {
    this.layers = layers;
    this.render();
  }

  setMapStyle(styleId) {
    const nextStyle = MAP_STYLES.find((style) => style.id === styleId) ?? MAP_STYLES[0];
    const changed = nextStyle.id !== this.mapStyle.id;
    this.mapStyle = nextStyle;
    this.container.style.background = this.viewMode === "globe" ? getGlobeTheme().space : nextStyle.background;
    this.attribution.innerHTML = nextStyle.attribution;
    this.attribution.hidden = this.viewMode === "globe" || !nextStyle.attribution;

    if (changed) {
      this.tilePane.replaceChildren();
      this.tiles.clear();
    }

    this.syncMapStyleControls();
    this.render();
  }

  setViewMode(viewMode) {
    const nextMode = viewMode === "globe" ? "globe" : "flat";
    const changed = nextMode !== this.viewMode;
    this.viewMode = nextMode;
    this.container.classList.toggle("is-globe-mode", nextMode === "globe");
    this.zoom = clampZoomForView(this.zoom, nextMode);
    this.container.style.background = nextMode === "globe" ? getGlobeTheme().space : this.mapStyle.background;
    this.attribution.hidden = nextMode === "globe" || !this.mapStyle.attribution;

    if (nextMode === "globe" || changed) {
      this.tilePane.replaceChildren();
      this.tiles.clear();
    }

    this.syncMapViewControls();
    this.render();
  }

  setMapSettingsVisible(isVisible) {
    const button = this.controls.querySelector("[data-map-settings]");
    const panel = this.controls.querySelector("[data-map-settings-panel]");
    panel.hidden = !isVisible;
    button.setAttribute("aria-expanded", String(isVisible));
  }

  syncMapViewControls() {
    for (const button of this.controls.querySelectorAll("[data-map-view]")) {
      const isSelected = button.dataset.mapView === this.viewMode;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    }
  }

  syncMapStyleControls() {
    for (const button of this.controls.querySelectorAll("[data-map-style]")) {
      const isSelected = button.dataset.mapStyle === this.mapStyle.id;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    }
  }

  latLonToContainerPoint(lat, lon) {
    const point = projectLatLon(lat, lon, this.zoom);
    const worldSize = TILE_SIZE * 2 ** this.zoom;
    const center = projectLatLon(this.center.lat, this.center.lon, this.zoom);
    point.x += Math.round((center.x - point.x) / worldSize) * worldSize;
    const topLeft = this.getTopLeft();
    return {
      x: point.x - topLeft.x,
      y: point.y - topLeft.y,
    };
  }

  segmentIntersectsView(startPoint, endPoint, pad = 64) {
    const start = this.latLonToContainerPoint(startPoint[0], startPoint[1]);
    const end = this.latLonToContainerPoint(endPoint[0], endPoint[1]);
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    return {
      end,
      start,
      visible:
        maxX >= -pad &&
        minX <= this.container.clientWidth + pad &&
        maxY >= -pad &&
        minY <= this.container.clientHeight + pad,
    };
  }

  bindEvents() {
    this.controls
      .querySelector("[data-zoom-in]")
      .addEventListener("click", () => this.zoomBy(ZOOM_BUTTON_STEP));
    this.controls
      .querySelector("[data-zoom-out]")
      .addEventListener("click", () => this.zoomBy(-ZOOM_BUTTON_STEP));

    const settingsButton = this.controls.querySelector("[data-map-settings]");
    const settingsPanel = this.controls.querySelector("[data-map-settings-panel]");
    settingsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.setMapSettingsVisible(settingsPanel.hidden);
    });
    settingsPanel.addEventListener("click", (event) => event.stopPropagation());

    for (const button of settingsPanel.querySelectorAll("[data-map-view]")) {
      button.addEventListener("click", () => {
        this.setViewMode(button.dataset.mapView);
        this.setMapSettingsVisible(false);
      });
    }

    for (const button of settingsPanel.querySelectorAll("[data-map-style]")) {
      button.addEventListener("click", () => {
        this.setMapStyle(button.dataset.mapStyle);
        this.setMapSettingsVisible(false);
      });
    }

    document.addEventListener("click", (event) => {
      if (!this.controls.contains(event.target)) {
        this.setMapSettingsVisible(false);
      }
    });

    this.container.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    this.container.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.container.addEventListener("pointerup", (event) => this.handlePointerEnd(event, true));
    this.container.addEventListener("pointercancel", (event) => this.handlePointerEnd(event, false));
    this.container.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const delta = clamp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY, -0.35, 0.35);
        this.zoomAround(event.clientX, event.clientY, delta);
      },
      { passive: false },
    );
    this.container.addEventListener("dblclick", (event) => {
      event.preventDefault();
      if (Date.now() - this.lastTouchDoubleTapTime < 700) return;
      this.zoomAround(event.clientX, event.clientY, 1);
    });
  }

  handlePointerDown(event) {
    if (event.button !== 0 || event.target.closest(".map-controls")) return;
    event.preventDefault();

    try {
      this.container.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail if the browser cancels the touch before this handler runs.
    }

    const pointer = {
      id: event.pointerId,
      pointerType: event.pointerType,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      suppressTap: false,
    };
    this.activePointers.set(event.pointerId, pointer);
    this.container.classList.add("is-dragging");

    if (this.activePointers.size >= 2) {
      for (const activePointer of this.activePointers.values()) {
        activePointer.suppressTap = true;
      }
      this.startPinchGesture();
      return;
    }

    this.startSinglePointerDrag(pointer);
  }

  handlePointerMove(event) {
    const pointer = this.activePointers.get(event.pointerId);
    if (!pointer) return;
    event.preventDefault();

    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (this.activePointers.size >= 2) {
      this.updatePinchGesture();
      return;
    }

    this.updateSinglePointerDrag(pointer);
  }

  handlePointerEnd(event, allowTap) {
    const pointer = this.activePointers.get(event.pointerId);
    const wasPinching = this.pinch !== null || this.activePointers.size > 1;

    if (pointer) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }

    this.activePointers.delete(event.pointerId);

    try {
      this.container.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore release failures for pointer streams that were already canceled.
    }

    if (allowTap && pointer && !wasPinching && this.activePointers.size === 0) {
      this.handleTap(pointer);
    }

    if (this.activePointers.size >= 2) {
      for (const activePointer of this.activePointers.values()) {
        activePointer.suppressTap = true;
      }
      this.startPinchGesture();
      return;
    }

    if (this.activePointers.size === 1) {
      const [remainingPointer] = this.activePointers.values();
      remainingPointer.suppressTap = true;
      this.startSinglePointerDrag(remainingPointer, true);
      return;
    }

    this.drag = null;
    this.pinch = null;
    this.container.classList.remove("is-dragging");
  }

  startSinglePointerDrag(pointer, resetStart = false) {
    if (resetStart) {
      pointer.startX = pointer.x;
      pointer.startY = pointer.y;
      pointer.startTime = performance.now();
    }

    this.pinch = null;

    if (this.viewMode === "globe") {
      const geometry = this.getGlobeGeometry(this.container.clientWidth, this.container.clientHeight);
      this.drag = {
        mode: "globe",
        pointerId: pointer.id,
        x: pointer.x,
        y: pointer.y,
        lat: this.center.lat,
        lon: this.center.lon,
        degreesPerPixel: 180 / Math.PI / geometry.radius,
      };
      return;
    }

    this.drag = {
      mode: "flat",
      pointerId: pointer.id,
      x: pointer.x,
      y: pointer.y,
      center: projectLatLon(this.center.lat, this.center.lon, this.zoom),
    };
  }

  updateSinglePointerDrag(pointer) {
    if (!this.drag || this.drag.pointerId !== pointer.id) return;
    const dx = pointer.x - this.drag.x;
    const dy = pointer.y - this.drag.y;

    if (this.drag.mode === "globe") {
      this.center = {
        lat: clamp(this.drag.lat + dy * this.drag.degreesPerPixel, -89.5, 89.5),
        lon: wrapLongitude(this.drag.lon - dx * this.drag.degreesPerPixel),
      };
      this.render();
      return;
    }

    const nextCenter = {
      x: this.drag.center.x - dx,
      y: this.drag.center.y - dy,
    };
    this.center = unprojectPoint(nextCenter, this.zoom);
    this.render();
  }

  startPinchGesture() {
    const pair = getPointerPair(this.activePointers);
    if (!pair) return;

    const metrics = getPointerPairMetrics(pair[0], pair[1], this.container);
    if (metrics.distance < PINCH_MIN_DISTANCE_PX) return;

    this.drag = null;
    this.lastTap = null;
    this.pinch = {
      startDistance: metrics.distance,
      startZoom: this.zoom,
      startMidClientX: metrics.clientX,
      startMidClientY: metrics.clientY,
      startLat: this.center.lat,
      startLon: this.center.lon,
      anchor: this.viewMode === "flat" ? this.containerPointToLatLon(metrics.localX, metrics.localY) : null,
      degreesPerPixel:
        this.viewMode === "globe"
          ? 180 /
            Math.PI /
            this.getGlobeGeometry(this.container.clientWidth, this.container.clientHeight).radius
          : null,
    };
  }

  updatePinchGesture() {
    if (!this.pinch) {
      this.startPinchGesture();
      return;
    }

    const pair = getPointerPair(this.activePointers);
    if (!pair) return;

    const metrics = getPointerPairMetrics(pair[0], pair[1], this.container);
    if (metrics.distance < PINCH_MIN_DISTANCE_PX) return;

    const nextZoom = clampZoomForView(
      this.pinch.startZoom + Math.log2(metrics.distance / this.pinch.startDistance),
      this.viewMode,
    );

    if (this.viewMode === "globe") {
      const dx = metrics.clientX - this.pinch.startMidClientX;
      const dy = metrics.clientY - this.pinch.startMidClientY;
      this.zoom = nextZoom;
      this.center = {
        lat: clamp(this.pinch.startLat + dy * this.pinch.degreesPerPixel, -89.5, 89.5),
        lon: wrapLongitude(this.pinch.startLon - dx * this.pinch.degreesPerPixel),
      };
      this.render();
      return;
    }

    this.zoom = nextZoom;
    const world = projectLatLon(this.pinch.anchor.lat, this.pinch.anchor.lon, nextZoom);
    const centerWorld = {
      x: world.x - metrics.localX + this.container.clientWidth / 2,
      y: world.y - metrics.localY + this.container.clientHeight / 2,
    };
    this.center = unprojectPoint(centerWorld, nextZoom);
    this.render();
  }

  handleTap(pointer) {
    if (pointer.suppressTap || pointer.pointerType === "mouse") return;

    const now = performance.now();
    const elapsed = now - pointer.startTime;
    const distance = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY);
    if (elapsed > TAP_MAX_DURATION_MS || distance > TAP_MAX_DISTANCE_PX) return;

    if (
      this.lastTap &&
      now - this.lastTap.time <= DOUBLE_TAP_DELAY_MS &&
      Math.hypot(pointer.x - this.lastTap.x, pointer.y - this.lastTap.y) <= DOUBLE_TAP_DISTANCE_PX
    ) {
      this.lastTap = null;
      this.lastTouchDoubleTapTime = Date.now();
      this.zoomAround(pointer.x, pointer.y, ZOOM_BUTTON_STEP * 2);
      return;
    }

    this.lastTap = { x: pointer.x, y: pointer.y, time: now };
  }

  zoomBy(delta) {
    const rect = this.container.getBoundingClientRect();
    this.zoomAround(rect.left + rect.width / 2, rect.top + rect.height / 2, delta);
  }

  zoomAround(clientX, clientY, delta) {
    const nextZoom = clampZoomForView(this.zoom + delta, this.viewMode);
    if (nextZoom === this.zoom) return;

    if (this.viewMode === "globe") {
      this.zoom = nextZoom;
      this.render();
      return;
    }

    const rect = this.container.getBoundingClientRect();
    const offset = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    const before = this.containerPointToLatLon(offset.x, offset.y);
    this.zoom = nextZoom;
    const world = projectLatLon(before.lat, before.lon, nextZoom);
    const centerWorld = {
      x: world.x - offset.x + this.container.clientWidth / 2,
      y: world.y - offset.y + this.container.clientHeight / 2,
    };
    this.center = unprojectPoint(centerWorld, nextZoom);
    this.render();
  }

  containerPointToLatLon(x, y) {
    const topLeft = this.getTopLeft();
    return unprojectPoint({ x: topLeft.x + x, y: topLeft.y + y }, this.zoom);
  }

  getTopLeft() {
    const center = projectLatLon(this.center.lat, this.center.lon, this.zoom);
    return {
      x: center.x - this.container.clientWidth / 2,
      y: center.y - this.container.clientHeight / 2,
    };
  }

  render() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.renderNow();
    });
  }

  renderNow() {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.renderTiles();
    this.renderOverlay();
  }

  renderTiles() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;

    if (this.viewMode === "globe") {
      this.tilePane.replaceChildren();
      this.tiles.clear();
      return;
    }

    const tileZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(this.zoom)));
    const tileScale = 2 ** tileZoom;
    const displayScale = 2 ** (this.zoom - tileZoom);
    const topLeft = this.getTopLeft();
    const tileTopLeft = {
      x: topLeft.x / displayScale,
      y: topLeft.y / displayScale,
    };
    const startX = Math.floor(tileTopLeft.x / TILE_SIZE) - 1;
    const endX = Math.floor((tileTopLeft.x + width / displayScale) / TILE_SIZE) + 1;
    const startY = Math.max(0, Math.floor(tileTopLeft.y / TILE_SIZE) - 1);
    const endY = Math.min(
      tileScale - 1,
      Math.floor((tileTopLeft.y + height / displayScale) / TILE_SIZE) + 1,
    );
    if (!this.mapStyle.tileUrl) {
      this.tilePane.replaceChildren();
      this.tiles.clear();
      return;
    }

    const visible = new Set();

    for (let tileX = startX; tileX <= endX; tileX += 1) {
      const wrappedX = modulo(tileX, tileScale);

      for (let tileY = startY; tileY <= endY; tileY += 1) {
        const key = `${this.mapStyle.id}:${tileZoom}:${tileX}:${tileY}`;
        visible.add(key);

        let tile = this.tiles.get(key);
        if (!tile) {
          tile = document.createElement("img");
          tile.className = "map-tile";
          tile.alt = "";
          tile.decoding = "async";
          tile.draggable = false;
          tile.src = this.mapStyle.tileUrl({ z: tileZoom, x: wrappedX, y: tileY });
          this.tiles.set(key, tile);
          this.tilePane.append(tile);
        }

        tile.style.width = `${TILE_SIZE * displayScale}px`;
        tile.style.height = `${TILE_SIZE * displayScale}px`;
        tile.style.transform = `translate(${Math.round(
          tileX * TILE_SIZE * displayScale - topLeft.x,
        )}px, ${Math.round(tileY * TILE_SIZE * displayScale - topLeft.y)}px)`;
      }
    }

    for (const [key, tile] of this.tiles) {
      if (!visible.has(key)) {
        tile.remove();
        this.tiles.delete(key);
      }
    }
  }

  renderOverlay() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.overlay.width !== pixelWidth || this.overlay.height !== pixelHeight) {
      this.overlay.width = pixelWidth;
      this.overlay.height = pixelHeight;
      this.overlay.style.width = `${width}px`;
      this.overlay.style.height = `${height}px`;
    }

    const ctx = this.overlay.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (this.viewMode === "globe") {
      this.renderGlobe(ctx, width, height);
      return;
    }

    for (const layer of this.layers) {
      layer.draw(ctx, this);
    }
  }

  renderGlobe(ctx, width, height) {
    const geometry = this.getGlobeGeometry(width, height);
    const theme = getGlobeTheme();
    const { cx, cy, radius } = geometry;
    const gradient = ctx.createRadialGradient(
      cx - radius * 0.35,
      cy - radius * 0.45,
      radius * 0.08,
      cx,
      cy,
      radius,
    );
    gradient.addColorStop(0, theme.oceanHighlight);
    gradient.addColorStop(0.38, theme.oceanShallow);
    gradient.addColorStop(0.78, theme.oceanMid);
    gradient.addColorStop(1, theme.oceanDeep);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.clip();
    this.globeBasemap.draw(ctx, geometry, theme, { width, height });
    this.drawGlobeGraticule(ctx, geometry, theme);

    for (const layer of this.layers) {
      layer.drawGlobe(ctx, this, geometry);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = theme.outline;
    ctx.stroke();
  }

  getGlobeGeometry(width, height) {
    const scale = GLOBE_ZOOM_SCALE ** (this.zoom - LOAD_CENTER_ZOOM);
    const radius = Math.max(36, Math.min(width, height) * GLOBE_BASE_RADIUS_RATIO * scale);
    return {
      cx: width / 2,
      cy: height / 2,
      radius,
      centerLatRad: degreesToRadians(this.center.lat),
      centerLonRad: degreesToRadians(this.center.lon),
    };
  }

  drawGlobeGraticule(ctx, geometry, theme) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.graticule;

    for (let lat = -60; lat <= 60; lat += 30) {
      const coordinates = [];
      for (let lon = -180; lon <= 180; lon += 2) {
        coordinates.push([lat, lon]);
      }
      this.drawGlobePolyline(ctx, coordinates, geometry);
    }

    for (let lon = -180; lon < 180; lon += 30) {
      const coordinates = [];
      for (let lat = -90; lat <= 90; lat += 2) {
        coordinates.push([lat, lon]);
      }
      this.drawGlobePolyline(ctx, coordinates, geometry);
    }

    ctx.restore();
  }

  drawGlobePolyline(ctx, coordinates, geometry) {
    let drawing = false;
    ctx.beginPath();

    for (const [lat, lon] of coordinates) {
      const point = this.latLonToGlobePoint(lat, lon, geometry);

      if (!point.visible) {
        drawing = false;
        continue;
      }

      if (!drawing) {
        ctx.moveTo(point.x, point.y);
        drawing = true;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }

    if (drawing) {
      ctx.stroke();
    }
  }

  latLonToGlobePoint(lat, lon, geometry) {
    const phi = degreesToRadians(lat);
    const lambda = degreesToRadians(lon);
    const delta = normalizeRadians(lambda - geometry.centerLonRad);
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const sinPhi0 = Math.sin(geometry.centerLatRad);
    const cosPhi0 = Math.cos(geometry.centerLatRad);
    const cosDelta = Math.cos(delta);
    const cosC = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosDelta;

    return {
      x: geometry.cx + geometry.radius * cosPhi * Math.sin(delta),
      y: geometry.cy - geometry.radius * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosDelta),
      visible: cosC >= -0.002,
    };
  }
}

class PointCanvasLayer {
  constructor(points, options = {}) {
    this.points = points;
    this.pointCount = points.length;
    this.options = options;
  }

  draw(ctx, map) {
    ctx.fillStyle = this.options.color || "#2563eb";
    ctx.globalAlpha = 0.72;
    const radius = this.options.radius || 2;
    const pad = 12;

    for (const point of this.points) {
      const pixel = map.latLonToContainerPoint(point[0], point[1]);
      if (
        pixel.x < -pad ||
        pixel.x > map.container.clientWidth + pad ||
        pixel.y < -pad ||
        pixel.y > map.container.clientHeight + pad
      ) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawGlobe(ctx, map, geometry) {
    ctx.fillStyle = this.options.color || "#2563eb";
    ctx.globalAlpha = 0.78;
    const radius = Math.max(1.6, this.options.radius || 2);
    const width = map.container.clientWidth;
    const height = map.container.clientHeight;
    const pad = radius + 2;

    for (const point of this.points) {
      const pixel = map.latLonToGlobePoint(point[0], point[1], geometry);
      if (!pixel.visible || !globePointIntersectsViewport(pixel, width, height, pad)) continue;
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

class RouteCanvasLayer {
  constructor(points, options = {}) {
    this.points = points;
    this.pointCount = points.length;
    this.options = options;
  }

  draw(ctx, map) {
    ctx.lineWidth = this.options.width || 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = this.options.color || "#dc2626";
    ctx.globalAlpha = 0.84;

    let previous = null;
    let previousYear = null;
    let drawing = false;

    ctx.beginPath();
    for (const point of this.points) {
      const year = point[5];

      if (!previous || year !== previousYear) {
        if (drawing) {
          ctx.stroke();
          ctx.beginPath();
          drawing = false;
        }
        previous = point;
        previousYear = year;
        continue;
      }

      const segment = map.segmentIntersectsView(previous, point);
      if (segment.visible) {
        const { start, end } = segment;
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        drawing = true;
      }

      previous = point;
      previousYear = year;
    }

    if (drawing) {
      ctx.stroke();
    }
  }

  drawGlobe(ctx, map, geometry) {
    const lineWidth = this.options.width || 2;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = this.options.color || "#dc2626";
    ctx.globalAlpha = 0.9;

    const width = map.container.clientWidth;
    const height = map.container.clientHeight;
    const pad = lineWidth + 4;
    let previousProjection = null;
    let previousYear = null;
    let drawing = false;

    ctx.beginPath();
    for (const point of this.points) {
      const year = point[5];
      const projection = map.latLonToGlobePoint(point[0], point[1], geometry);

      if (!previousProjection || year !== previousYear) {
        previousProjection = projection;
        previousYear = year;
        continue;
      }

      if (
        previousProjection.visible &&
        projection.visible &&
        globeSegmentIntersectsViewport(previousProjection, projection, width, height, pad)
      ) {
        ctx.moveTo(previousProjection.x, previousProjection.y);
        ctx.lineTo(projection.x, projection.y);
        drawing = true;
      }

      previousProjection = projection;
      previousYear = year;
    }

    if (drawing) {
      ctx.stroke();
    }
  }
}

function createMapControls() {
  const controls = document.createElement("div");
  controls.className = "map-controls";

  const zoomGroup = document.createElement("div");
  zoomGroup.className = "map-control-group";

  const zoomInButton = document.createElement("button");
  zoomInButton.type = "button";
  zoomInButton.dataset.zoomIn = "";
  zoomInButton.setAttribute("aria-label", "Zoom in");
  zoomInButton.textContent = "+";

  const zoomOutButton = document.createElement("button");
  zoomOutButton.type = "button";
  zoomOutButton.dataset.zoomOut = "";
  zoomOutButton.setAttribute("aria-label", "Zoom out");
  zoomOutButton.textContent = "-";
  zoomGroup.append(zoomInButton, zoomOutButton);

  const settingsWrap = document.createElement("div");
  settingsWrap.className = "map-layer-settings";

  const settingsButton = document.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "map-settings-button";
  settingsButton.dataset.mapSettings = "";
  settingsButton.title = "Map settings";
  settingsButton.setAttribute("aria-label", "Map settings");
  settingsButton.setAttribute("aria-expanded", "false");
  settingsButton.append(createCodicon("layers"));

  const settingsPanel = document.createElement("div");
  settingsPanel.className = "map-settings-popover";
  settingsPanel.dataset.mapSettingsPanel = "";
  settingsPanel.hidden = true;

  const viewTitle = document.createElement("div");
  viewTitle.className = "map-settings-title";
  viewTitle.textContent = "View";
  settingsPanel.append(viewTitle);

  for (const [viewMode, label] of [
    ["flat", "Flat"],
    ["globe", "Globe (pre-Alpha)"],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-settings-option";
    button.dataset.mapView = viewMode;
    button.textContent = label;
    settingsPanel.append(button);
  }

  const title = document.createElement("div");
  title.className = "map-settings-title map-settings-title-secondary";
  title.textContent = "Base map";
  settingsPanel.append(title);

  for (const style of MAP_STYLES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-settings-option";
    button.dataset.mapStyle = style.id;
    button.textContent = style.label;
    settingsPanel.append(button);
  }

  const playbackButton = document.createElement("button");
  playbackButton.type = "button";
  playbackButton.className = "map-settings-button map-playback-button";
  playbackButton.dataset.playback = "";
  playbackButton.title = "Play timeline (load a layer with timestamps first)";
  playbackButton.setAttribute("aria-label", playbackButton.title);
  playbackButton.setAttribute("aria-controls", "playbackModal");
  playbackButton.setAttribute("aria-expanded", "false");
  playbackButton.disabled = true;
  playbackButton.append(createCodicon("debugLineByLine"));

  settingsWrap.append(settingsButton, settingsPanel);
  controls.append(zoomGroup, settingsWrap, playbackButton);
  return controls;
}

function createAttribution() {
  const attribution = document.createElement("div");
  attribution.className = "map-attribution";
  attribution.innerHTML = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  return attribution;
}

function getPointerPair(activePointers) {
  const pair = [];

  for (const pointer of activePointers.values()) {
    pair.push(pointer);
    if (pair.length === 2) break;
  }

  return pair.length === 2 ? pair : null;
}

function getPointerPairMetrics(first, second, container) {
  const rect = container.getBoundingClientRect();
  const clientX = (first.x + second.x) / 2;
  const clientY = (first.y + second.y) / 2;

  return {
    clientX,
    clientY,
    localX: clientX - rect.left,
    localY: clientY - rect.top,
    distance: Math.hypot(first.x - second.x, first.y - second.y),
  };
}

function getGlobeViewportBounds(geometry, viewport) {
  const left = Math.max(0, Math.floor(geometry.cx - geometry.radius));
  const top = Math.max(0, Math.floor(geometry.cy - geometry.radius));
  const right = Math.min(viewport.width, Math.ceil(geometry.cx + geometry.radius));
  const bottom = Math.min(viewport.height, Math.ceil(geometry.cy + geometry.radius));

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function globePointIntersectsViewport(point, width, height, pad = 0) {
  return point.x >= -pad && point.x <= width + pad && point.y >= -pad && point.y <= height + pad;
}

function globeSegmentIntersectsViewport(start, end, width, height, pad = 0) {
  return (
    Math.max(start.x, end.x) >= -pad &&
    Math.min(start.x, end.x) <= width + pad &&
    Math.max(start.y, end.y) >= -pad &&
    Math.min(start.y, end.y) <= height + pad
  );
}

function getGlobeTheme() {
  const landFallback = parseCssColor(GLOBE_THEME_FALLBACKS.land);
  const borderFallback = parseCssColor(GLOBE_THEME_FALLBACKS.border);

  return {
    space: readCssVariable("--globe-space", GLOBE_THEME_FALLBACKS.space),
    oceanHighlight: readCssVariable(
      "--globe-ocean-highlight",
      GLOBE_THEME_FALLBACKS.oceanHighlight,
    ),
    oceanShallow: readCssVariable("--globe-ocean-shallow", GLOBE_THEME_FALLBACKS.oceanShallow),
    oceanMid: readCssVariable("--globe-ocean-mid", GLOBE_THEME_FALLBACKS.oceanMid),
    oceanDeep: readCssVariable("--globe-ocean-deep", GLOBE_THEME_FALLBACKS.oceanDeep),
    landColor: parseCssColor(readCssVariable("--globe-land", GLOBE_THEME_FALLBACKS.land), landFallback),
    borderColor: parseCssColor(
      readCssVariable("--globe-border", GLOBE_THEME_FALLBACKS.border),
      borderFallback,
    ),
    graticule: readCssVariable("--globe-graticule", GLOBE_THEME_FALLBACKS.graticule),
    outline: readCssVariable("--globe-outline", GLOBE_THEME_FALLBACKS.outline),
  };
}

function readCssVariable(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function parseCssColor(value, fallback = { r: 0, g: 0, b: 0, a: 1 }) {
  const trimmed = String(value ?? "").trim();
  const hex = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);

  if (hex) {
    const raw = hex[1];
    const expanded = raw.length <= 4 ? raw.split("").map((character) => character + character).join("") : raw;
    return {
      r: parseInt(expanded.slice(0, 2), 16),
      g: parseInt(expanded.slice(2, 4), 16),
      b: parseInt(expanded.slice(4, 6), 16),
      a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    };
  }

  const rgb = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      return {
        r: clamp(Math.round(Number(parts[0])), 0, 255),
        g: clamp(Math.round(Number(parts[1])), 0, 255),
        b: clamp(Math.round(Number(parts[2])), 0, 255),
        a: parts.length >= 4 ? clamp(Number(parts[3]), 0, 1) : 1,
      };
    }
  }

  return fallback;
}

function inverseOrthographicPoint(
  xEast,
  yNorth,
  rhoSquared,
  centerLatRad,
  centerLonRad,
  sinCenterLat,
  cosCenterLat,
) {
  if (rhoSquared < 1e-12) {
    return {
      lat: centerLatRad * 180 / Math.PI,
      lon: wrapLongitude(centerLonRad * 180 / Math.PI),
    };
  }

  const rho = Math.sqrt(rhoSquared);
  const angularDistance = Math.asin(Math.min(1, rho));
  const sinDistance = Math.sin(angularDistance);
  const cosDistance = Math.cos(angularDistance);
  const latRad = Math.asin(
    cosDistance * sinCenterLat + (yNorth * sinDistance * cosCenterLat) / rho,
  );
  const lonRad = centerLonRad + Math.atan2(
    xEast * sinDistance,
    rho * cosCenterLat * cosDistance - yNorth * sinCenterLat * sinDistance,
  );

  return {
    lat: latRad * 180 / Math.PI,
    lon: wrapLongitude(lonRad * 180 / Math.PI),
  };
}

function sampleWorldHighTexture(source, sourceWidth, sourceHeight, lat, lon) {
  const svgX = ((wrapLongitude(lon) + 180) / 360) * WORLD_HIGH_MERCATOR_SIZE;
  const sinLat = Math.sin(degreesToRadians(clamp(lat, -WORLD_HIGH_LAT_LIMIT, WORLD_HIGH_LAT_LIMIT)));
  const svgY =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
    WORLD_HIGH_MERCATOR_SIZE;
  const textureX = ((svgX - WORLD_HIGH_VIEWBOX.x) / WORLD_HIGH_VIEWBOX.width) * (sourceWidth - 1);
  const textureY = ((svgY - WORLD_HIGH_VIEWBOX.y) / WORLD_HIGH_VIEWBOX.height) * (sourceHeight - 1);

  if (textureY < 0 || textureY >= sourceHeight) return null;

  const x = Math.floor(modulo(textureX, sourceWidth));
  const y = Math.round(clamp(textureY, 0, sourceHeight - 1));
  const index = (y * sourceWidth + x) * 4;
  const alpha = source[index + 3] / 255;
  if (alpha < 0.04) return null;

  const brightness = (source[index] + source[index + 1] + source[index + 2]) / 765;
  return {
    alpha,
    isBorder: brightness > 0.92,
  };
}

function projectLatLon(lat, lon, zoom) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const safeLat = clampLatitude(lat);
  const sinLat = Math.sin((safeLat * Math.PI) / 180);

  return {
    x: ((wrapLongitude(lon) + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize,
  };
}

function unprojectPoint(point, zoom) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const lon = (point.x / worldSize) * 360 - 180;
  const mercator = Math.PI - (2 * Math.PI * point.y) / worldSize;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(mercator));

  return {
    lat: clampLatitude(lat),
    lon: wrapLongitude(lon),
  };
}

function clampLatitude(lat) {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
}

function wrapLongitude(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function clampZoom(zoom) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function clampZoomForView(zoom, viewMode) {
  return viewMode === "globe" ? Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, zoom)) : clampZoom(zoom);
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function normalizeRadians(radians) {
  return ((radians + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

timelineMap = new TimelineMap(document.querySelector("#map"));
timelineMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
playbackFeature = new PlaybackFeature({
  map: timelineMap,
  button: timelineMap.controls.querySelector("[data-playback]"),
  getLayers: () => uploadLayers,
  getSpeedUnitId: () => displaySpeedUnitId,
  getNormalCanvasLayers: () => uploadLayers.map((layer) => layer.canvasLayer).filter(Boolean),
  createIcon: (iconName) => createCodicon(iconName),
});
