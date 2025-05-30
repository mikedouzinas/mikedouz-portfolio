"use client";
import React, { useState, useEffect, useContext, createContext, useCallback, DragEvent } from 'react';
import { usePageTransition } from '@/components/PageTransition';
import PageTransition from '@/components/PageTransition';

// Types
type TileType = {
  letter: string;
  points: number;
  id: string;
  isBlank?: boolean;
};

type CellType = {
  tile?: TileType;
  premium: 'TW' | 'DW' | 'TL' | 'DL' | 'normal';
  premiumUsed: boolean;
};

type GamePhase = 'ready' | 'play' | 'end';
type GameMode = 'slow' | 'medium' | 'fast';

type PlacedTile = {
  row: number;
  col: number;
  tile: TileType;
};

type PlayedWord = {
  word: string;
  score: number;
  timestamp: number;
};

type GameState = {
  phase: GamePhase;
  mode: GameMode;
  score: number;
  strikes: number;
  timeLeft: number;
  board: CellType[][];
  rack: TileType[];
  letterBag: TileType[];
  placedTiles: PlacedTile[];
  isFirstMove: boolean;
  highScores: Record<GameMode, number>;
  playedWords: PlayedWord[];
  blankLetterInput: { row: number; col: number; tile: TileType } | null;
  errorMessage: string | null;
};

// Premium square layout for standard Scrabble board
const PREMIUM_LAYOUT: { [key: string]: 'TW' | 'DW' | 'TL' | 'DL' } = {
  '0,0': 'TW', '0,7': 'TW', '0,14': 'TW',
  '7,0': 'TW', '7,14': 'TW',
  '14,0': 'TW', '14,7': 'TW', '14,14': 'TW',
  '1,1': 'DW', '1,13': 'DW', '2,2': 'DW', '2,12': 'DW',
  '3,3': 'DW', '3,11': 'DW', '4,4': 'DW', '4,10': 'DW',
  '10,4': 'DW', '10,10': 'DW', '11,3': 'DW', '11,11': 'DW',
  '12,2': 'DW', '12,12': 'DW', '13,1': 'DW', '13,13': 'DW',
  '7,7': 'DW', // Center star
  '0,3': 'DL', '0,11': 'DL', '2,6': 'DL', '2,8': 'DL',
  '3,0': 'DL', '3,7': 'DL', '3,14': 'DL', '6,2': 'DL',
  '6,6': 'DL', '6,8': 'DL', '6,12': 'DL', '7,3': 'DL',
  '7,11': 'DL', '8,2': 'DL', '8,6': 'DL', '8,8': 'DL',
  '8,12': 'DL', '11,0': 'DL', '11,7': 'DL', '11,14': 'DL',
  '12,6': 'DL', '12,8': 'DL', '14,3': 'DL', '14,11': 'DL',
  '1,5': 'TL', '1,9': 'TL', '5,1': 'TL', '5,5': 'TL',
  '5,9': 'TL', '5,13': 'TL', '9,1': 'TL', '9,5': 'TL',
  '9,9': 'TL', '9,13': 'TL', '13,5': 'TL', '13,9': 'TL',
};

// Letter distribution and points (standard English Scrabble)
const LETTER_DISTRIBUTION: { [key: string]: { count: number; points: number } } = {
  'A': { count: 9, points: 1 }, 'B': { count: 2, points: 3 },
  'C': { count: 2, points: 3 }, 'D': { count: 4, points: 2 },
  'E': { count: 12, points: 1 }, 'F': { count: 2, points: 4 },
  'G': { count: 3, points: 2 }, 'H': { count: 2, points: 4 },
  'I': { count: 9, points: 1 }, 'J': { count: 1, points: 8 },
  'K': { count: 1, points: 5 }, 'L': { count: 4, points: 1 },
  'M': { count: 2, points: 3 }, 'N': { count: 6, points: 1 },
  'O': { count: 8, points: 1 }, 'P': { count: 2, points: 3 },
  'Q': { count: 1, points: 10 }, 'R': { count: 6, points: 1 },
  'S': { count: 4, points: 1 }, 'T': { count: 6, points: 1 },
  'U': { count: 4, points: 1 }, 'V': { count: 2, points: 4 },
  'W': { count: 2, points: 4 }, 'X': { count: 1, points: 8 },
  'Y': { count: 2, points: 4 }, 'Z': { count: 1, points: 10 },
  '_': { count: 2, points: 0 }, // Blanks
};

// Game configuration
const GAME_CONFIG = {
  slow: { time: 600, target: 300 }, // 10 minutes
  medium: { time: 360, target: 200 }, // 6 minutes
  fast: { time: 180, target: 120 }, // 3 minutes
};

// Trie Node class for dictionary
class TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
  }
}

// Trie class for efficient word lookup
class Trie {
  root: TrieNode;
  
  constructor() {
    this.root = new TrieNode();
  }
  
  insert(word: string): void {
    let current = this.root;
    for (const char of word.toUpperCase()) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }
    current.isEndOfWord = true;
  }
  
  search(word: string): boolean {
    let current = this.root;
    for (const char of word.toUpperCase()) {
      if (!current.children.has(char)) {
        return false;
      }
      current = current.children.get(char)!;
    }
    return current.isEndOfWord;
  }
}

// Create expanded dictionary
const createDictionary = (): Trie => {
  const trie = new Trie();
  
  // All valid 2-letter Scrabble words
  const twoLetterWords = ['AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY', 'BA', 'BE', 'BI', 'BO', 'BY', 'DA', 'DE', 'DO', 'ED', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET', 'EW', 'EX', 'FA', 'FE', 'GI', 'GO', 'HA', 'HE', 'HI', 'HM', 'HO', 'ID', 'IF', 'IN', 'IS', 'IT', 'JO', 'KA', 'KI', 'LA', 'LI', 'LO', 'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY', 'NA', 'NE', 'NO', 'NU', 'OD', 'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OP', 'OR', 'OS', 'OW', 'OX', 'OY', 'PA', 'PE', 'PI', 'PO', 'QI', 'RE', 'SH', 'SI', 'SO', 'TA', 'TE', 'TI', 'TO', 'UH', 'UM', 'UN', 'UP', 'US', 'UT', 'WE', 'WO', 'XI', 'XU', 'YA', 'YE', 'YO', 'ZA'];
  
  // Comprehensive word list (expanded significantly)
  const words = [
    // 3-letter words
    'ACE', 'ACT', 'ADD', 'AGE', 'AGO', 'AID', 'AIM', 'AIR', 'ALL', 'AND', 'ANT', 'ANY', 'APE', 'APT', 'ARC', 'ARE', 'ARK', 'ARM', 'ART', 'ASH', 'ASK', 'ATE', 'AWE', 'AXE', 'AYE',
    'BAD', 'BAG', 'BAN', 'BAR', 'BAT', 'BAY', 'BED', 'BEE', 'BET', 'BID', 'BIG', 'BIN', 'BIT', 'BOB', 'BOW', 'BOX', 'BOY', 'BUD', 'BUG', 'BUM', 'BUN', 'BUS', 'BUT', 'BUY', 'BYE',
    'CAB', 'CAD', 'CAM', 'CAN', 'CAP', 'CAR', 'CAT', 'COB', 'COD', 'COG', 'COP', 'COT', 'COW', 'COX', 'COY', 'COZ', 'CRY', 'CUB', 'CUD', 'CUE', 'CUP', 'CUR', 'CUT',
    'DAB', 'DAD', 'DAM', 'DAY', 'DEN', 'DEW', 'DID', 'DIE', 'DIG', 'DIM', 'DIN', 'DIP', 'DOC', 'DOE', 'DOG', 'DOT', 'DRY', 'DUB', 'DUD', 'DUE', 'DUG', 'DUN', 'DUO', 'DYE',
    'EAR', 'EAT', 'EBB', 'EEL', 'EGG', 'EGO', 'ELF', 'ELK', 'ELM', 'EMU', 'END', 'ERA', 'ERR', 'EVE', 'EWE', 'EYE',
    'FAD', 'FAN', 'FAR', 'FAT', 'FAX', 'FED', 'FEE', 'FEW', 'FIB', 'FIG', 'FIN', 'FIR', 'FIT', 'FIX', 'FLU', 'FLY', 'FOB', 'FOE', 'FOG', 'FOP', 'FOR', 'FOX', 'FRY', 'FUN', 'FUR',
    'GAB', 'GAG', 'GAL', 'GAP', 'GAS', 'GAY', 'GEL', 'GEM', 'GET', 'GIG', 'GIN', 'GNU', 'GOD', 'GOT', 'GUM', 'GUN', 'GUT', 'GUY', 'GYM',
    'HAD', 'HAG', 'HAL', 'HAM', 'HAS', 'HAT', 'HAW', 'HAY', 'HEN', 'HEP', 'HER', 'HEW', 'HEX', 'HEY', 'HID', 'HIM', 'HIP', 'HIS', 'HIT', 'HOB', 'HOD', 'HOE', 'HOG', 'HOP', 'HOT', 'HOW', 'HUB', 'HUE', 'HUG', 'HUM', 'HUN', 'HUT',
    'ICE', 'ICY', 'ILL', 'IMP', 'INK', 'INN', 'ION', 'IRE', 'IRK', 'IVY',
    'JAB', 'JAG', 'JAM', 'JAR', 'JAW', 'JAY', 'JET', 'JEW', 'JIG', 'JOB', 'JOG', 'JOT', 'JOY', 'JUG', 'JUT',
    'KEG', 'KEN', 'KEY', 'KID', 'KIN', 'KIT',
    'LAB', 'LAC', 'LAD', 'LAG', 'LAP', 'LAW', 'LAX', 'LAY', 'LEA', 'LED', 'LEG', 'LET', 'LID', 'LIE', 'LIP', 'LIT', 'LOG', 'LOT', 'LOW', 'LUG',
    'MAD', 'MAN', 'MAP', 'MAR', 'MAT', 'MAW', 'MAX', 'MAY', 'MEN', 'MET', 'MID', 'MIX', 'MOB', 'MOD', 'MOM', 'MOP', 'MOW', 'MUD', 'MUG', 'MUM',
    'NAB', 'NAG', 'NAP', 'NAY', 'NET', 'NEW', 'NIB', 'NIG', 'NIT', 'NIX', 'NOB', 'NOD', 'NOR', 'NOT', 'NOW', 'NUB', 'NUN', 'NUT',
    'OAK', 'OAR', 'OAT', 'ODD', 'OFF', 'OFT', 'OIL', 'OLD', 'ONE', 'OPT', 'ORB', 'ORE', 'OUR', 'OUT', 'OWE', 'OWL', 'OWN',
    'PAD', 'PAL', 'PAN', 'PAP', 'PAR', 'PAT', 'PAW', 'PAX', 'PAY', 'PEA', 'PED', 'PEG', 'PEN', 'PEP', 'PER', 'PET', 'PEW', 'PHI', 'PIE', 'PIG', 'PIN', 'PIT', 'PLY', 'POD', 'POP', 'POT', 'POW', 'POX', 'PRO', 'PRY', 'PSI', 'PUB', 'PUD', 'PUG', 'PUN', 'PUP', 'PUS', 'PUT', 'PYX',
    'QUA',
    'RAG', 'RAM', 'RAN', 'RAP', 'RAT', 'RAW', 'RAY', 'RED', 'REM', 'REP', 'REV', 'REX', 'RIB', 'RID', 'RIG', 'RIM', 'RIP', 'ROB', 'ROD', 'ROE', 'ROM', 'ROT', 'ROW', 'RUB', 'RUE', 'RUG', 'RUM', 'RUN', 'RUT', 'RYE',
    'SAC', 'SAD', 'SAG', 'SAP', 'SAT', 'SAW', 'SAX', 'SAY', 'SEA', 'SEE', 'SET', 'SEW', 'SEX', 'SHE', 'SHY', 'SIC', 'SIN', 'SIP', 'SIR', 'SIS', 'SIT', 'SIX', 'SKI', 'SKY', 'SLY', 'SOB', 'SOD', 'SOP', 'SOT', 'SOW', 'SOX', 'SOY', 'SPA', 'SPY', 'STY', 'SUB', 'SUM', 'SUN', 'SUP',
    'TAB', 'TAD', 'TAG', 'TAN', 'TAP', 'TAR', 'TAT', 'TAU', 'TAX', 'TEA', 'TED', 'TEE', 'TEN', 'THE', 'THY', 'TIC', 'TIE', 'TIN', 'TIP', 'TOD', 'TOE', 'TOG', 'TOM', 'TON', 'TOO', 'TOP', 'TOT', 'TOW', 'TOY', 'TRY', 'TUB', 'TUG', 'TUN', 'TUX', 'TWO',
    'URB', 'URN', 'USE',
    'VAN', 'VAT', 'VET', 'VEX', 'VIA', 'VIE', 'VIM', 'VOW',
    'WAD', 'WAG', 'WAN', 'WAR', 'WAS', 'WAX', 'WAY', 'WEB', 'WED', 'WEE', 'WET', 'WHO', 'WHY', 'WIG', 'WIN', 'WIT', 'WOE', 'WOK', 'WON', 'WOO', 'WOW',
    'YAK', 'YAM', 'YAP', 'YAW', 'YEA', 'YEP', 'YES', 'YET', 'YEW', 'YIN', 'YIP', 'YON', 'YOU', 'YOW', 'YUK', 'YUM', 'YUP',
    'ZAG', 'ZAP', 'ZAX', 'ZED', 'ZEE', 'ZEN', 'ZIG', 'ZIP', 'ZIT', 'ZOO',
    
    // 4+ letter words
    'ABLE', 'ABOUT', 'ABOVE', 'ABUSE', 'ACID', 'ACORN', 'ACRE', 'ACTOR', 'ADAPT', 'ADMIT', 'ADOPT', 'ADULT', 'AFTER', 'AGAIN', 'AGENT', 'AGREE', 'AHEAD', 'ALARM', 'ALBUM', 'ALERT', 'ALIEN', 'ALIGN', 'ALIVE', 'ALLOW', 'ALONE', 'ALONG', 'ALTER', 'AMBER', 'AMAZE', 'AMONG', 'AMPLE', 'ANGEL', 'ANGER', 'ANGLE', 'ANGRY', 'ANKLE', 'APART', 'APPLE', 'APPLY', 'APRIL', 'APRON', 'ARENA', 'ARGUE', 'ARISE', 'ARMED', 'ARMOR', 'AROMA', 'ARROW', 'ARTIST', 'ASIDE', 'ASSET', 'ATLAS', 'ATOM', 'AUDIO', 'AVOID', 'AWAKE', 'AWARD', 'AWARE', 'AWFUL',
    'BABY', 'BACK', 'BADGE', 'BADLY', 'BAKER', 'BALANCE', 'BALL', 'BANANA', 'BAND', 'BANK', 'BARELY', 'BARN', 'BARREL', 'BASE', 'BASIC', 'BASKET', 'BATCH', 'BATH', 'BATTLE', 'BEACH', 'BEAM', 'BEAN', 'BEAR', 'BEARD', 'BEAST', 'BEAT', 'BEAUTY', 'BECOME', 'BEEN', 'BEER', 'BEFORE', 'BEGIN', 'BEING', 'BELIEVE', 'BELL', 'BELONG', 'BELOW', 'BELT', 'BENCH', 'BEND', 'BENEATH', 'BENEFIT', 'BERRY', 'BESIDE', 'BEST', 'BETTER', 'BETWEEN', 'BEYOND', 'BICYCLE', 'BILL', 'BIND', 'BIRD', 'BIRTH', 'BLACK', 'BLADE', 'BLAME', 'BLANK', 'BLAST', 'BLAZE', 'BLEED', 'BLEND', 'BLESS', 'BLIND', 'BLOCK', 'BLOOD', 'BLOOM', 'BLOW', 'BLOWN', 'BLUE', 'BOARD', 'BOAT', 'BODY', 'BOIL', 'BOMB', 'BONE', 'BONUS', 'BOOK', 'BOOST', 'BOOTH', 'BORDER', 'BORE', 'BORN', 'BORROW', 'BOSS', 'BOTH', 'BOTTLE', 'BOTTOM', 'BOUND', 'BOWL', 'BRAIN', 'BRANCH', 'BRAND', 'BRASS', 'BRAVE', 'BREAD', 'BREAK', 'BREAST', 'BREATH', 'BREED', 'BREEZE', 'BRICK', 'BRIDE', 'BRIDGE', 'BRIEF', 'BRIGHT', 'BRING', 'BROAD', 'BROKE', 'BROKEN', 'BRONZE', 'BROOM', 'BROTHER', 'BROWN', 'BRUSH', 'BUBBLE', 'BUCKET', 'BUDDY', 'BUDGET', 'BUILD', 'BUILT', 'BULB', 'BULK', 'BULL', 'BULLET', 'BUNDLE', 'BURDEN', 'BURN', 'BURST', 'BURY', 'BUSH', 'BUSINESS', 'BUSY', 'BUTTER', 'BUTTON', 'BUYER', 'BUZZ',
    'CABIN', 'CABLE', 'CACHE', 'CAGE', 'CAKE', 'CALL', 'CALM', 'CAME', 'CAMEL', 'CAMERA', 'CAMP', 'CAMPUS', 'CANAL', 'CANCEL', 'CANCER', 'CANDLE', 'CANDY', 'CANNON', 'CANNOT', 'CANOE', 'CANVAS', 'CANYON', 'CAPABLE', 'CAPACITY', 'CAPITAL', 'CAPTAIN', 'CAPTURE', 'CARBON', 'CARD', 'CARE', 'CAREER', 'CAREFUL', 'CARGO', 'CARPET', 'CARRY', 'CART', 'CARVE', 'CASE', 'CASH', 'CASINO', 'CAST', 'CASTLE', 'CASUAL', 'CATALOG', 'CATCH', 'CATEGORY', 'CATTLE', 'CAUGHT', 'CAUSE', 'CAUTION', 'CAVE', 'CEASE', 'CEILING', 'CELEBRATE', 'CELL', 'CEMENT', 'CENTER', 'CENTRAL', 'CENTURY', 'CEREAL', 'CERTAIN', 'CHAIN', 'CHAIR', 'CHALK', 'CHALLENGE', 'CHAMBER', 'CHAMP', 'CHANCE', 'CHANGE', 'CHANNEL', 'CHANT', 'CHAOS', 'CHAPTER', 'CHARGE', 'CHARITY', 'CHARM', 'CHART', 'CHASE', 'CHEAP', 'CHEAT', 'CHECK', 'CHEER', 'CHEESE', 'CHERRY', 'CHESS', 'CHEST', 'CHEW', 'CHICKEN', 'CHIEF', 'CHILD', 'CHILDREN', 'CHILL', 'CHIMNEY', 'CHINA', 'CHIP', 'CHOICE', 'CHOOSE', 'CHORD', 'CHOSE', 'CHOSEN', 'CHROME', 'CHUNK', 'CHURCH', 'CIRCLE', 'CIRCUS', 'CITIZEN', 'CITY', 'CIVIC', 'CIVIL', 'CLAIM', 'CLAMP', 'CLAP', 'CLARIFY', 'CLASH', 'CLASS', 'CLASSIC', 'CLAW', 'CLAY', 'CLEAN', 'CLEAR', 'CLERK', 'CLEVER', 'CLICK', 'CLIENT', 'CLIFF', 'CLIMB', 'CLINIC', 'CLIP', 'CLOCK', 'CLONE', 'CLOSE', 'CLOSET', 'CLOTH', 'CLOUD', 'CLOWN', 'CLUB', 'CLUE', 'CLUSTER', 'COACH', 'COAL', 'COAST', 'COAT', 'COCONUT', 'CODE', 'COFFEE', 'COIN', 'COLD', 'COLLAPSE', 'COLLAR', 'COLLECT', 'COLLEGE', 'COLON', 'COLOR', 'COLUMN', 'COMBAT', 'COMBINE', 'COME', 'COMEDY', 'COMFORT', 'COMIC', 'COMMAND', 'COMMENT', 'COMMON', 'COMMUNITY', 'COMPANY', 'COMPARE', 'COMPETE', 'COMPILE', 'COMPLEX', 'CONCEPT', 'CONCERN', 'CONCERT', 'CONDUCT', 'CONE', 'CONFIRM', 'CONFLICT', 'CONFUSE', 'CONNECT', 'CONSIDER', 'CONSIST', 'CONSTANT', 'CONSTRUCT', 'CONSULT', 'CONTACT', 'CONTAIN', 'CONTENT', 'CONTEST', 'CONTEXT', 'CONTINUE', 'CONTRACT', 'CONTROL', 'CONVERT', 'CONVINCE', 'COOK', 'COOKIE', 'COOL', 'COPPER', 'COPY', 'CORAL', 'CORE', 'CORN', 'CORNER', 'CORRECT', 'COST', 'COSTUME', 'COTTAGE', 'COTTON', 'COUCH', 'COULD', 'COUNCIL', 'COUNT', 'COUNTRY', 'COUNTY', 'COUPLE', 'COURAGE', 'COURSE', 'COURT', 'COUSIN', 'COVER', 'CRACK', 'CRADLE', 'CRAFT', 'CRANE', 'CRASH', 'CRATER', 'CRAWL', 'CRAZY', 'CREAM', 'CREATE', 'CREDIT', 'CREEK', 'CREW', 'CRICKET', 'CRIME', 'CRISP', 'CRITIC', 'CROP', 'CROSS', 'CROUCH', 'CROWD', 'CROWN', 'CRUCIAL', 'CRUDE', 'CRUISE', 'CRUMB', 'CRUNCH', 'CRUSH', 'CRYSTAL', 'CUBE', 'CULTURE', 'CUPBOARD', 'CURIOUS', 'CURRENT', 'CURTAIN', 'CURVE', 'CUSHION', 'CUSTOM', 'CUSTOMER', 'CYCLE',
    'DAILY', 'DAMAGE', 'DAMP', 'DANCE', 'DANGER', 'DARE', 'DARK', 'DASH', 'DATA', 'DATE', 'DAUGHTER', 'DAWN', 'DEAL', 'DEAR', 'DEATH', 'DEBATE', 'DEBRIS', 'DEBT', 'DECADE', 'DECEMBER', 'DECIDE', 'DECK', 'DECLARE', 'DECLINE', 'DECORATE', 'DECREASE', 'DEEP', 'DEER', 'DEFEAT', 'DEFEND', 'DEFINE', 'DEGREE', 'DELAY', 'DELETE', 'DELIVER', 'DEMAND', 'DEMISE', 'DENIAL', 'DENTIST', 'DENY', 'DEPART', 'DEPEND', 'DEPOSIT', 'DEPTH', 'DEPUTY', 'DERIVE', 'DESCRIBE', 'DESERT', 'DESIGN', 'DESIRE', 'DESK', 'DESPAIR', 'DESTROY', 'DETAIL', 'DETECT', 'DEVELOP', 'DEVICE', 'DEVOTE', 'DIAGRAM', 'DIAL', 'DIAMOND', 'DIARY', 'DICE', 'DIESEL', 'DIET', 'DIFFER', 'DIGITAL', 'DIGNITY', 'DILEMMA', 'DINE', 'DINNER', 'DINOSAUR', 'DIRECT', 'DIRT', 'DISAGREE', 'DISCOVER', 'DISEASE', 'DISH', 'DISMISS', 'DISPLAY', 'DISTANCE', 'DISTRICT', 'DISTURB', 'DITCH', 'DIVE', 'DIVIDE', 'DIVORCE', 'DIZZY', 'DOCTOR', 'DOCUMENT', 'DODGE', 'DOLL', 'DOLPHIN', 'DOMAIN', 'DONATE', 'DONKEY', 'DONOR', 'DOOR', 'DOSE', 'DOUBLE', 'DOUBT', 'DOVE', 'DOWN', 'DOZEN', 'DRAFT', 'DRAGON', 'DRAIN', 'DRAMA', 'DRAPE', 'DRAW', 'DRAWER', 'DREAM', 'DRESS', 'DRIFT', 'DRILL', 'DRINK', 'DRIVE', 'DROP', 'DROWN', 'DRUG', 'DRUM', 'DRUNK', 'DUCK', 'DUMB', 'DUMP', 'DUNE', 'DURING', 'DUST', 'DUTCH', 'DUTY', 'DWARF', 'DYNAMIC',
    'EACH', 'EAGER', 'EAGLE', 'EARLY', 'EARN', 'EARTH', 'EASILY', 'EAST', 'EASY', 'ECHO', 'ECOLOGY', 'ECONOMY', 'EDGE', 'EDIT', 'EDUCATE', 'EFFORT', 'EIGHT', 'EITHER', 'ELBOW', 'ELDER', 'ELECT', 'ELEGANT', 'ELEMENT', 'ELEPHANT', 'ELEVATOR', 'ELITE', 'ELSE', 'EMBARK', 'EMBODY', 'EMBRACE', 'EMERGE', 'EMOTION', 'EMPLOY', 'EMPOWER', 'EMPTY', 'ENABLE', 'ENACT', 'ENDLESS', 'ENDORSE', 'ENEMY', 'ENERGY', 'ENFORCE', 'ENGAGE', 'ENGINE', 'ENHANCE', 'ENJOY', 'ENLIST', 'ENOUGH', 'ENRICH', 'ENROLL', 'ENSURE', 'ENTER', 'ENTIRE', 'ENTRY', 'ENVELOPE', 'EPISODE', 'EQUAL', 'EQUIP', 'ERASE', 'EROSION', 'ERROR', 'ERUPT', 'ESCAPE', 'ESSAY', 'ESSENCE', 'ESTATE', 'ETERNAL', 'ETHICS', 'EVOKE', 'EVOLVE', 'EXACT', 'EXAM', 'EXAMPLE', 'EXCESS', 'EXCHANGE', 'EXCITE', 'EXCLUDE', 'EXCUSE', 'EXECUTE', 'EXERCISE', 'EXHAUST', 'EXHIBIT', 'EXILE', 'EXIST', 'EXIT', 'EXOTIC', 'EXPAND', 'EXPECT', 'EXPENSE', 'EXPERT', 'EXPIRE', 'EXPLAIN', 'EXPOSE', 'EXPRESS', 'EXTEND', 'EXTRA', 'EXTREME', 'EYEBROW',
    'FABRIC', 'FACE', 'FACULTY', 'FADE', 'FAIL', 'FAINT', 'FAIR', 'FAITH', 'FALL', 'FALSE', 'FAME', 'FAMILY', 'FAMOUS', 'FANCY', 'FANTASY', 'FARM', 'FASHION', 'FAST', 'FATAL', 'FATE', 'FATHER', 'FATIGUE', 'FAULT', 'FAVOR', 'FAVORITE', 'FEAR', 'FEAST', 'FEATURE', 'FEDERAL', 'FEED', 'FEEL', 'FEMALE', 'FENCE', 'FESTIVAL', 'FETCH', 'FEVER', 'FIBER', 'FICTION', 'FIELD', 'FIERCE', 'FIFTEEN', 'FIFTY', 'FIGHT', 'FIGURE', 'FILE', 'FILL', 'FILM', 'FILTER', 'FINAL', 'FINANCE', 'FIND', 'FINE', 'FINGER', 'FINISH', 'FIRE', 'FIRM', 'FIRST', 'FISCAL', 'FISH', 'FITNESS', 'FIVE', 'FLAG', 'FLAME', 'FLASH', 'FLAT', 'FLAVOR', 'FLEE', 'FLESH', 'FLIGHT', 'FLOAT', 'FLOCK', 'FLOOD', 'FLOOR', 'FLOUR', 'FLOW', 'FLOWER', 'FLUID', 'FLUSH', 'FOAM', 'FOCUS', 'FOLD', 'FOLLOW', 'FOOD', 'FOOL', 'FOOT', 'FORCE', 'FOREST', 'FOREVER', 'FORGET', 'FORK', 'FORM', 'FORMAL', 'FORMER', 'FORMULA', 'FORTUNE', 'FORWARD', 'FOSSIL', 'FOSTER', 'FOUND', 'FOUR', 'FRAGILE', 'FRAME', 'FREQUENT', 'FRESH', 'FRIEND', 'FRINGE', 'FROG', 'FROM', 'FRONT', 'FROST', 'FROWN', 'FROZEN', 'FRUIT', 'FUEL', 'FULL', 'FUNNY', 'FURNACE', 'FURY', 'FUTURE', 'FUZZY',
    'GADGET', 'GAIN', 'GALAXY', 'GALLERY', 'GAME', 'GAMMA', 'GARAGE', 'GARBAGE', 'GARDEN', 'GARLIC', 'GARMENT', 'GATHER', 'GAUGE', 'GAZE', 'GENERAL', 'GENIUS', 'GENRE', 'GENTLE', 'GENUINE', 'GESTURE', 'GHOST', 'GIANT', 'GIFT', 'GIGGLE', 'GINGER', 'GIRAFFE', 'GIRL', 'GIVE', 'GLAD', 'GLANCE', 'GLARE', 'GLASS', 'GLIDE', 'GLIMPSE', 'GLOBE', 'GLOOM', 'GLORY', 'GLOVE', 'GLOW', 'GLUE', 'GOAL', 'GOAT', 'GODDESS', 'GOLD', 'GOLF', 'GOOD', 'GOOSE', 'GORILLA', 'GOSPEL', 'GOSSIP', 'GOVERN', 'GOWN', 'GRAB', 'GRACE', 'GRAIN', 'GRANT', 'GRAPE', 'GRAPH', 'GRASP', 'GRASS', 'GRAVITY', 'GREAT', 'GREEN', 'GRID', 'GRIEF', 'GRILL', 'GRIM', 'GRIN', 'GRIP', 'GRIT', 'GROCERY', 'GROOM', 'GROSS', 'GROUND', 'GROUP', 'GROW', 'GRUNT', 'GUARD', 'GUESS', 'GUIDE', 'GUILT', 'GUITAR', 'GULF', 'GUMBO',
    'HABIT', 'HAIR', 'HALF', 'HALL', 'HAMMER', 'HAND', 'HANDLE', 'HANG', 'HAPPEN', 'HAPPY', 'HARBOR', 'HARD', 'HARM', 'HARSH', 'HARVEST', 'HATE', 'HAVE', 'HAWK', 'HAZARD', 'HEAD', 'HEALTH', 'HEAP', 'HEAR', 'HEART', 'HEAT', 'HEAVY', 'HEDGE', 'HEIGHT', 'HELLO', 'HELMET', 'HELP', 'HELPFUL', 'HERB', 'HERE', 'HERO', 'HIDDEN', 'HIDE', 'HIGH', 'HIGHWAY', 'HILL', 'HINT', 'HISTORY', 'HOBBY', 'HOCKEY', 'HOLD', 'HOLE', 'HOLIDAY', 'HOLLOW', 'HOLY', 'HOME', 'HONEY', 'HONOR', 'HOOD', 'HOOK', 'HOPE', 'HORN', 'HORROR', 'HORSE', 'HOSPITAL', 'HOST', 'HOTEL', 'HOUR', 'HOUSE', 'HOVER', 'HUGE', 'HUMAN', 'HUMBLE', 'HUMOR', 'HUNDRED', 'HUNGER', 'HUNT', 'HURDLE', 'HURRY', 'HURT', 'HUSBAND', 'HYBRID',
    'ICON', 'IDEA', 'IDEAL', 'IDENTIFY', 'IDLE', 'IDOL', 'IGNORE', 'IMAGE', 'IMITATE', 'IMMENSE', 'IMMUNE', 'IMPACT', 'IMPLY', 'IMPOSE', 'IMPROVE', 'IMPULSE', 'INCH', 'INCLUDE', 'INCOME', 'INCREASE', 'INDEX', 'INDICATE', 'INDOOR', 'INDULGE', 'INDUSTRY', 'INFANT', 'INFECT', 'INFLICT', 'INFORM', 'INHALE', 'INHERIT', 'INITIAL', 'INJECT', 'INJURY', 'INMATE', 'INNER', 'INNOCENT', 'INPUT', 'INQUIRY', 'INSANE', 'INSECT', 'INSERT', 'INSIDE', 'INSPIRE', 'INSTALL', 'INSTANT', 'INSTEAD', 'INTACT', 'INTEREST', 'INTO', 'INVEST', 'INVITE', 'INVOLVE', 'IRON', 'ISLAND', 'ISOLATE', 'ISSUE', 'ITEM', 'IVORY',
    'JACKET', 'JAZZ', 'JEALOUS', 'JEANS', 'JELLY', 'JEWEL', 'JOKE', 'JOURNEY', 'JUDGE', 'JUICE', 'JUMP', 'JUNGLE', 'JUNIOR', 'JUNK', 'JUST', 'JUSTICE',
    'KANGAROO', 'KEEN', 'KEEP', 'KETCHUP', 'KICK', 'KIDNEY', 'KIND', 'KINGDOM', 'KISS', 'KITE', 'KITTEN', 'KNEE', 'KNIFE', 'KNOCK', 'KNOW', 'KNOWLEDGE',
    'LABEL', 'LABOR', 'LADDER', 'LADY', 'LAKE', 'LAMP', 'LAND', 'LANGUAGE', 'LAPTOP', 'LARGE', 'LAST', 'LATE', 'LATER', 'LATIN', 'LAUGH', 'LAUNDRY', 'LAVA', 'LAWN', 'LAWSUIT', 'LAYER', 'LAZY', 'LEADER', 'LEAF', 'LEAGUE', 'LEAN', 'LEARN', 'LEASE', 'LEATHER', 'LEAVE', 'LECTURE', 'LEFT', 'LEGAL', 'LEGEND', 'LEISURE', 'LEMON', 'LEND', 'LENGTH', 'LENS', 'LEOPARD', 'LESS', 'LESSON', 'LETTER', 'LEVEL', 'LEVER', 'LIBERTY', 'LIBRARY', 'LICENSE', 'LICK', 'LIFE', 'LIFT', 'LIGHT', 'LIKE', 'LIMB', 'LIMIT', 'LINE', 'LINEN', 'LINK', 'LION', 'LIQUID', 'LIST', 'LISTEN', 'LITER', 'LITTLE', 'LIVE', 'LIZARD', 'LOAD', 'LOAN', 'LOBSTER', 'LOCAL', 'LOCK', 'LOGIC', 'LONELY', 'LONG', 'LOOK', 'LOOP', 'LOOSE', 'LORD', 'LOSE', 'LOSS', 'LOUD', 'LOUNGE', 'LOVE', 'LOVELY', 'LOWER', 'LOYAL', 'LUCKY', 'LUGGAGE', 'LUMBER', 'LUNCH', 'LUNG', 'LUXURY', 'LYING', 'LYRICS',
    'MACHINE', 'MACRO', 'MADAM', 'MAGAZINE', 'MAGIC', 'MAGNET', 'MAID', 'MAIL', 'MAIN', 'MAJOR', 'MAKE', 'MALE', 'MAMMAL', 'MANAGE', 'MANDATE', 'MANGO', 'MANNER', 'MANSION', 'MANUAL', 'MANY', 'MAPLE', 'MARBLE', 'MARCH', 'MARGIN', 'MARINE', 'MARK', 'MARKET', 'MARRIAGE', 'MARRY', 'MASK', 'MASS', 'MASTER', 'MATCH', 'MATERIAL', 'MATH', 'MATTER', 'MAXIMUM', 'MAYBE', 'MAYOR', 'MEADOW', 'MEAL', 'MEAN', 'MEASURE', 'MEAT', 'MECHANIC', 'MEDAL', 'MEDIA', 'MEDICAL', 'MEDIUM', 'MEET', 'MELODY', 'MELT', 'MEMBER', 'MEMORY', 'MENTAL', 'MENTION', 'MENU', 'MERCY', 'MERGE', 'MERIT', 'MERRY', 'MESH', 'MESSAGE', 'METAL', 'METHOD', 'METRIC', 'METRO', 'MIDDLE', 'MIDNIGHT', 'MIGHT', 'MIGRATE', 'MILD', 'MILK', 'MILL', 'MIMIC', 'MIND', 'MINERAL', 'MINIMUM', 'MINOR', 'MINUTE', 'MIRACLE', 'MIRROR', 'MISERY', 'MISS', 'MISTAKE', 'MITTEN', 'MIXED', 'MIXTURE', 'MOBILE', 'MODEL', 'MODERN', 'MODIFY', 'MOMENT', 'MONDAY', 'MONEY', 'MONITOR', 'MONKEY', 'MONSTER', 'MONTH', 'MOON', 'MORAL', 'MORE', 'MORNING', 'MOSQUITO', 'MOST', 'MOTHER', 'MOTION', 'MOTOR', 'MOUNTAIN', 'MOUSE', 'MOUTH', 'MOVE', 'MOVIE', 'MUCH', 'MUFFIN', 'MULTIPLY', 'MUMBLE', 'MURDER', 'MUSEUM', 'MUSHROOM', 'MUSIC', 'MUST', 'MUTUAL', 'MYSELF', 'MYSTERY', 'MYTH',
    'NAIVE', 'NAME', 'NAPKIN', 'NARROW', 'NASTY', 'NATION', 'NATIVE', 'NATURAL', 'NATURE', 'NAUSEA', 'NAVY', 'NEAR', 'NECK', 'NEED', 'NEGATIVE', 'NEGLECT', 'NEITHER', 'NEPHEW', 'NERVE', 'NEST', 'NETWORK', 'NEUTRAL', 'NEVER', 'NEWS', 'NEXT', 'NICE', 'NICHE', 'NIGHT', 'NINE', 'NOBLE', 'NOBODY', 'NOISE', 'NOMINEE', 'NONE', 'NOON', 'NORMAL', 'NORTH', 'NOSE', 'NOTE', 'NOTHING', 'NOTICE', 'NOTION', 'NOVEL', 'NUCLEAR', 'NUMBER', 'NURSE', 'NURTURE',
    'OBJECT', 'OBLIGE', 'OBSCURE', 'OBSERVE', 'OBTAIN', 'OBVIOUS', 'OCCUR', 'OCEAN', 'OCTOBER', 'ODOR', 'OFFENSE', 'OFFER', 'OFFICE', 'OFTEN', 'OKAY', 'OLIVE', 'OLYMPIC', 'OMIT', 'ONCE', 'ONION', 'ONLINE', 'ONLY', 'OPEN', 'OPERA', 'OPINION', 'OPPOSE', 'OPTION', 'ORANGE', 'ORBIT', 'ORCHARD', 'ORDER', 'ORDINARY', 'ORGAN', 'ORIENT', 'ORIGIN', 'ORPHAN', 'OTHER', 'OTTER', 'OUGHT', 'OUNCE', 'OUTER', 'OUTFIT', 'OUTPUT', 'OUTSIDE', 'OVAL', 'OVEN', 'OVER', 'OVERALL', 'OVERLAP', 'OVERTAKE', 'OWNER', 'OXYGEN', 'OYSTER', 'OZONE',
    'PACE', 'PACK', 'PACKAGE', 'PADDLE', 'PAGE', 'PAINT', 'PAIR', 'PALACE', 'PALM', 'PANDA', 'PANEL', 'PANIC', 'PANTHER', 'PAPER', 'PARADE', 'PARENT', 'PARK', 'PARROT', 'PARTY', 'PASS', 'PATCH', 'PATH', 'PATIENT', 'PATROL', 'PATTERN', 'PAUSE', 'PAVE', 'PAYMENT', 'PEACE', 'PEACH', 'PEAK', 'PEANUT', 'PEAR', 'PEASANT', 'PELICAN', 'PENCIL', 'PENGUIN', 'PEOPLE', 'PEPPER', 'PERFECT', 'PERFORM', 'PERFUME', 'PERHAPS', 'PERIOD', 'PERMIT', 'PERSON', 'PERSUADE', 'PHONE', 'PHOTO', 'PHRASE', 'PHYSICAL', 'PIANO', 'PICK', 'PICNIC', 'PICTURE', 'PIECE', 'PIGEON', 'PILL', 'PILLOW', 'PILOT', 'PINK', 'PIONEER', 'PIPE', 'PISTOL', 'PITCH', 'PIZZA', 'PLACE', 'PLAIN', 'PLAN', 'PLANET', 'PLANK', 'PLANT', 'PLASTIC', 'PLATE', 'PLATFORM', 'PLAY', 'PLAYER', 'PLEASE', 'PLEDGE', 'PLENTY', 'PLOT', 'PLOW', 'PLUCK', 'PLUG', 'PLUMBER', 'PLUNGE', 'PLUS', 'POCKET', 'POEM', 'POET', 'POINT', 'POISON', 'POLAR', 'POLE', 'POLICE', 'POLICY', 'POLISH', 'POLITE', 'POLL', 'POND', 'PONY', 'POOL', 'POOR', 'POPULAR', 'PORCH', 'PORK', 'PORT', 'PORTION', 'PORTRAIT', 'POSITION', 'POSITIVE', 'POSSESS', 'POSSIBLE', 'POST', 'POSTER', 'POTATO', 'POTTERY', 'POUCH', 'POULTRY', 'POUND', 'POUR', 'POVERTY', 'POWDER', 'POWER', 'PRACTICE', 'PRAISE', 'PRAY', 'PREACH', 'PRECEDE', 'PREDICT', 'PREFER', 'PREFIX', 'PREGNANT', 'PREMIER', 'PREPARE', 'PRESENT', 'PRESERVE', 'PRESS', 'PRESSURE', 'PRETEND', 'PRETTY', 'PREVENT', 'PRICE', 'PRIDE', 'PRIMARY', 'PRINCE', 'PRINT', 'PRIOR', 'PRISON', 'PRIVATE', 'PRIZE', 'PROBLEM', 'PROCESS', 'PRODUCE', 'PRODUCT', 'PROFIT', 'PROGRAM', 'PROJECT', 'PROMISE', 'PROMOTE', 'PROMPT', 'PROOF', 'PROPER', 'PROPERTY', 'PROPHET', 'PROPOSE', 'PROSPER', 'PROTECT', 'PROUD', 'PROVE', 'PROVIDE', 'PUBLIC', 'PUBLISH', 'PUDDING', 'PULL', 'PULSE', 'PUMP', 'PUNCH', 'PUPIL', 'PUPPET', 'PUPPY', 'PURCHASE', 'PURE', 'PURPLE', 'PURPOSE', 'PURSE', 'PUSH', 'PUZZLE', 'PYRAMID',
    'QUALIFY', 'QUALITY', 'QUANTUM', 'QUARTER', 'QUEEN', 'QUERY', 'QUEST', 'QUESTION', 'QUICK', 'QUIET', 'QUILT', 'QUIT', 'QUIZ', 'QUOTE',
    'RABBIT', 'RACE', 'RACK', 'RADAR', 'RADIO', 'RAFT', 'RAGE', 'RAID', 'RAIL', 'RAIN', 'RAISE', 'RALLY', 'RANCH', 'RANDOM', 'RANGE', 'RANK', 'RAPID', 'RARE', 'RATE', 'RATHER', 'RATIO', 'RAVEN', 'RAZOR', 'REACH', 'REACT', 'READ', 'READY', 'REAL', 'REALITY', 'REALM', 'REAP', 'REAR', 'REASON', 'REBEL', 'REBUILD', 'RECALL', 'RECEIVE', 'RECENT', 'RECIPE', 'RECKON', 'RECORD', 'RECOVER', 'RECRUIT', 'RECYCLE', 'REDUCE', 'REFER', 'REFLECT', 'REFORM', 'REFRESH', 'REFUSE', 'REGARD', 'REGION', 'REGRET', 'REGULAR', 'REJECT', 'RELATE', 'RELAX', 'RELEASE', 'RELIEF', 'RELY', 'REMAIN', 'REMARK', 'REMEDY', 'REMIND', 'REMOTE', 'REMOVE', 'RENDER', 'RENEW', 'RENT', 'REPAIR', 'REPEAT', 'REPLACE', 'REPLY', 'REPORT', 'REPRESENT', 'REQUEST', 'REQUIRE', 'RESCUE', 'RESEARCH', 'RESEMBLE', 'RESERVE', 'RESIST', 'RESOLVE', 'RESORT', 'RESOURCE', 'RESPECT', 'RESPOND', 'RESPONSE', 'REST', 'RESTORE', 'RESULT', 'RETAIN', 'RETIRE', 'RETREAT', 'RETURN', 'REUNION', 'REVEAL', 'REVIEW', 'REVISE', 'REWARD', 'RHYTHM', 'RIBBON', 'RICE', 'RICH', 'RIDE', 'RIDGE', 'RIFLE', 'RIGHT', 'RIGID', 'RING', 'RIOT', 'RIPPLE', 'RISE', 'RISK', 'RITUAL', 'RIVAL', 'RIVER', 'ROAD', 'ROAR', 'ROAST', 'ROBOT', 'ROBUST', 'ROCK', 'ROCKET', 'ROLE', 'ROLL', 'ROMANCE', 'ROOF', 'ROOM', 'ROOSTER', 'ROOT', 'ROPE', 'ROSE', 'ROTATE', 'ROUGH', 'ROUND', 'ROUTE', 'ROUTINE', 'ROYAL', 'RUBBER', 'RUDE', 'RUGBY', 'RUIN', 'RULE', 'RUMOR', 'RURAL', 'RUSH', 'RUST', 'RUSTIC',
    'SABER', 'SACK', 'SACRED', 'SADDLE', 'SAFE', 'SAFETY', 'SAIL', 'SALAD', 'SALARY', 'SALE', 'SALMON', 'SALON', 'SALT', 'SALUTE', 'SAME', 'SAMPLE', 'SAND', 'SATISFY', 'SATURDAY', 'SAUCE', 'SAUSAGE', 'SAVE', 'SCALE', 'SCAN', 'SCARE', 'SCATTER', 'SCENE', 'SCHEME', 'SCHOOL', 'SCIENCE', 'SCISSORS', 'SCOOP', 'SCOPE', 'SCORE', 'SCOUT', 'SCRAP', 'SCRATCH', 'SCREAM', 'SCREEN', 'SCRIPT', 'SCROLL', 'SCRUB', 'SEARCH', 'SEASON', 'SEAT', 'SECOND', 'SECRET', 'SECTION', 'SECURE', 'SEED', 'SEEK', 'SEEM', 'SEGMENT', 'SELECT', 'SELF', 'SELL', 'SEMINAR', 'SEND', 'SENIOR', 'SENSE', 'SENTENCE', 'SEPARATE', 'SERIES', 'SERIOUS', 'SERVE', 'SERVICE', 'SESSION', 'SETTLE', 'SETUP', 'SEVEN', 'SEVERAL', 'SEVERE', 'SHADOW', 'SHAFT', 'SHAKE', 'SHALL', 'SHALLOW', 'SHAME', 'SHAPE', 'SHARE', 'SHARK', 'SHARP', 'SHATTER', 'SHAVE', 'SHED', 'SHEEP', 'SHEET', 'SHELF', 'SHELL', 'SHELTER', 'SHIELD', 'SHIFT', 'SHINE', 'SHIP', 'SHIRT', 'SHOCK', 'SHOE', 'SHOOT', 'SHOP', 'SHORT', 'SHOULD', 'SHOULDER', 'SHOUT', 'SHOVE', 'SHOW', 'SHOWER', 'SHRIMP', 'SHRINE', 'SHRINK', 'SHRUG', 'SHUFFLE', 'SHUT', 'SIBLING', 'SICK', 'SIDE', 'SIEGE', 'SIGHT', 'SIGN', 'SIGNAL', 'SILENT', 'SILK', 'SILLY', 'SILVER', 'SIMILAR', 'SIMPLE', 'SINCE', 'SING', 'SINGLE', 'SINK', 'SISTER', 'SIZE', 'SKETCH', 'SKILL', 'SKIN', 'SKIP', 'SKIRT', 'SKULL', 'SLAB', 'SLAM', 'SLAP', 'SLATE', 'SLAVE', 'SLED', 'SLEEP', 'SLEEVE', 'SLENDER', 'SLICE', 'SLIDE', 'SLIGHT', 'SLIM', 'SLOGAN', 'SLOPE', 'SLOT', 'SLOW', 'SMALL', 'SMART', 'SMASH', 'SMELL', 'SMILE', 'SMOKE', 'SMOOTH', 'SNACK', 'SNAKE', 'SNAP', 'SNIFF', 'SNOW', 'SOAK', 'SOAP', 'SOCCER', 'SOCIAL', 'SOCK', 'SODA', 'SOFT', 'SOLAR', 'SOLDIER', 'SOLID', 'SOLUTION', 'SOLVE', 'SOMEONE', 'SONG', 'SOON', 'SORROW', 'SORRY', 'SORT', 'SOUL', 'SOUND', 'SOUP', 'SOURCE', 'SOUTH', 'SPACE', 'SPARE', 'SPATIAL', 'SPAWN', 'SPEAK', 'SPEAR', 'SPECIAL', 'SPECIES', 'SPECIFIC', 'SPEECH', 'SPEED', 'SPELL', 'SPEND', 'SPHERE', 'SPICE', 'SPIDER', 'SPIKE', 'SPILL', 'SPIN', 'SPINE', 'SPIRAL', 'SPIRIT', 'SPLIT', 'SPOIL', 'SPONSOR', 'SPOON', 'SPORT', 'SPOT', 'SPRAY', 'SPREAD', 'SPRING', 'SPRINT', 'SQUARE', 'SQUEEZE', 'SQUIRREL', 'STABLE', 'STACK', 'STADIUM', 'STAFF', 'STAGE', 'STAIRS', 'STAKE', 'STAMP', 'STAND', 'STANDARD', 'STAR', 'STARE', 'START', 'STATE', 'STATION', 'STATUE', 'STATUS', 'STAY', 'STEADY', 'STEAK', 'STEAL', 'STEAM', 'STEEL', 'STEEP', 'STEER', 'STEM', 'STEP', 'STEREO', 'STICK', 'STILL', 'STING', 'STIR', 'STOCK', 'STOMACH', 'STONE', 'STOOL', 'STOP', 'STORE', 'STORM', 'STORY', 'STOVE', 'STRAIGHT', 'STRANGE', 'STRAP', 'STRATEGY', 'STRAW', 'STREAM', 'STREET', 'STRESS', 'STRETCH', 'STRIKE', 'STRING', 'STRIP', 'STROKE', 'STRONG', 'STRUGGLE', 'STUDENT', 'STUDIO', 'STUDY', 'STUFF', 'STUMBLE', 'STUMP', 'STYLE', 'SUBJECT', 'SUBMIT', 'SUBWAY', 'SUCCEED', 'SUCCESS', 'SUDDEN', 'SUFFER', 'SUGAR', 'SUGGEST', 'SUIT', 'SUMMER', 'SUMMIT', 'SUNDAY', 'SUNNY', 'SUNSET', 'SUPER', 'SUPPLY', 'SUPPORT', 'SUPREME', 'SURE', 'SURFACE', 'SURGE', 'SURPRISE', 'SURROUND', 'SURVEY', 'SURVIVE', 'SUSPECT', 'SUSTAIN', 'SWALLOW', 'SWAMP', 'SWAP', 'SWARM', 'SWEAR', 'SWEAT', 'SWEET', 'SWELL', 'SWIFT', 'SWIM', 'SWING', 'SWITCH', 'SWORD', 'SYMBOL', 'SYMPTOM', 'SYRUP', 'SYSTEM',
    'TABLE', 'TACKLE', 'TAIL', 'TAILOR', 'TAKE', 'TALENT', 'TALK', 'TALL', 'TAME', 'TANK', 'TAPE', 'TARGET', 'TASK', 'TASTE', 'TATTOO', 'TAXI', 'TEACH', 'TEAM', 'TEAR', 'TEASE', 'TECH', 'TECHNIQUE', 'TEDDY', 'TEETH', 'TELL', 'TEMPER', 'TEMPLE', 'TEMPO', 'TENANT', 'TEND', 'TENDER', 'TENNIS', 'TENT', 'TERM', 'TERRAIN', 'TERRIBLE', 'TERROR', 'TEST', 'TEXT', 'THANK', 'THAT', 'THEATER', 'THEIR', 'THEME', 'THEN', 'THEORY', 'THERE', 'THESE', 'THEY', 'THICK', 'THIEF', 'THING', 'THINK', 'THIRD', 'THIS', 'THORN', 'THOSE', 'THOUGH', 'THOUGHT', 'THOUSAND', 'THREAD', 'THREAT', 'THREE', 'THRILL', 'THRIVE', 'THROAT', 'THRONE', 'THROUGH', 'THROW', 'THUMB', 'THUNDER', 'THURSDAY', 'THUS', 'TICKET', 'TIDE', 'TIDY', 'TIGER', 'TIGHT', 'TILE', 'TILT', 'TIMBER', 'TIME', 'TIMID', 'TINY', 'TIRED', 'TISSUE', 'TITLE', 'TOAST', 'TOBACCO', 'TODAY', 'TODDLER', 'TOGETHER', 'TOILET', 'TOKEN', 'TOLD', 'TOMATO', 'TOMORROW', 'TONE', 'TONGUE', 'TONIGHT', 'TOOL', 'TOOTH', 'TOPIC', 'TORCH', 'TORNADO', 'TORSO', 'TORTOISE', 'TOSS', 'TOTAL', 'TOUCH', 'TOUGH', 'TOUR', 'TOURIST', 'TOWARD', 'TOWEL', 'TOWER', 'TOWN', 'TRACK', 'TRADE', 'TRAFFIC', 'TRAGIC', 'TRAIL', 'TRAIN', 'TRAIT', 'TRANSFER', 'TRAP', 'TRASH', 'TRAVEL', 'TRAY', 'TREAT', 'TREATY', 'TREE', 'TREMBLE', 'TREND', 'TRIAL', 'TRIBE', 'TRICK', 'TRIGGER', 'TRIM', 'TRIP', 'TROPHY', 'TROUBLE', 'TRUCK', 'TRUE', 'TRUMPET', 'TRUNK', 'TRUST', 'TRUTH', 'TUBE', 'TUCK', 'TUESDAY', 'TUITION', 'TUMBLE', 'TUMOR', 'TUNA', 'TUNE', 'TUNNEL', 'TURKEY', 'TURN', 'TURTLE', 'TWELVE', 'TWENTY', 'TWICE', 'TWIN', 'TWIST', 'TYPE', 'TYPICAL', 'TYRE',
    'UGLY', 'ULTIMATE', 'ULTRA', 'UMBRELLA', 'UNABLE', 'UNAWARE', 'UNCLE', 'UNCOVER', 'UNDER', 'UNDO', 'UNFAIR', 'UNFOLD', 'UNHAPPY', 'UNIFORM', 'UNIQUE', 'UNIT', 'UNIVERSE', 'UNKNOWN', 'UNLESS', 'UNLIKE', 'UNLOCK', 'UNTIL', 'UNUSUAL', 'UNVEIL', 'UPDATE', 'UPGRADE', 'UPHOLD', 'UPON', 'UPPER', 'UPSET', 'URBAN', 'URGE', 'USAGE', 'USEFUL', 'USER', 'USUAL', 'UTILITY',
    'VACANT', 'VACATION', 'VACCINE', 'VACUUM', 'VAGUE', 'VALID', 'VALLEY', 'VALUE', 'VALVE', 'VAMPIRE', 'VANISH', 'VAPOR', 'VARIOUS', 'VAST', 'VAULT', 'VECTOR', 'VEHICLE', 'VEIL', 'VELVET', 'VENDOR', 'VENTURE', 'VENUE', 'VERB', 'VERIFY', 'VERSION', 'VERSUS', 'VERY', 'VESSEL', 'VETERAN', 'VIABLE', 'VIBRANT', 'VICIOUS', 'VICTIM', 'VICTORY', 'VIDEO', 'VIEW', 'VILLAGE', 'VINTAGE', 'VIOLIN', 'VIRAL', 'VIRGIN', 'VIRTUAL', 'VIRUS', 'VISA', 'VISIBLE', 'VISION', 'VISIT', 'VISUAL', 'VITAL', 'VIVID', 'VOCAL', 'VOICE', 'VOID', 'VOLCANO', 'VOLUME', 'VOTE', 'VOYAGE', 'VULTURE',
    'WAGE', 'WAGON', 'WAIT', 'WAKE', 'WALK', 'WALL', 'WALNUT', 'WANT', 'WARFARE', 'WARM', 'WARN', 'WARRIOR', 'WASH', 'WASP', 'WASTE', 'WATCH', 'WATER', 'WAVE', 'WEALTH', 'WEAPON', 'WEAR', 'WEASEL', 'WEATHER', 'WEAVE', 'WEDDING', 'WEDGE', 'WEEK', 'WEEKEND', 'WEIGH', 'WEIGHT', 'WEIRD', 'WELCOME', 'WELFARE', 'WELL', 'WEST', 'WHALE', 'WHAT', 'WHEAT', 'WHEEL', 'WHEN', 'WHERE', 'WHETHER', 'WHICH', 'WHILE', 'WHIP', 'WHISPER', 'WHISTLE', 'WHITE', 'WHOLE', 'WIDE', 'WIDOW', 'WIDTH', 'WIFE', 'WILD', 'WILL', 'WILLING', 'WILLOW', 'WIND', 'WINDOW', 'WINE', 'WING', 'WINK', 'WINNER', 'WINTER', 'WIPE', 'WIRE', 'WISDOM', 'WISE', 'WISH', 'WITH', 'WITHDRAW', 'WITNESS', 'WOLF', 'WOMAN', 'WONDER', 'WOOD', 'WOOL', 'WORD', 'WORK', 'WORLD', 'WORRY', 'WORSHIP', 'WORTH', 'WOULD', 'WRAP', 'WRECK', 'WRESTLE', 'WRIST', 'WRITE', 'WRONG',
    'XRAY',
    'YACHT', 'YARD', 'YEAR', 'YEAST', 'YELLOW', 'YIELD', 'YOGA', 'YOUNG', 'YOUTH',
    'ZEBRA', 'ZERO', 'ZIGZAG', 'ZINC', 'ZONE', 'ZOOM'
  ];
  
  // Insert all words into trie
  twoLetterWords.forEach(word => trie.insert(word));
  words.forEach(word => trie.insert(word));
  
  return trie;
};

// Global dictionary instance
const dictionary = createDictionary();

// Context
const GameContext = createContext<{
  state: GameState;
  startGame: (mode: GameMode) => void;
  placeWord: (tiles: PlacedTile[]) => void;
  submitWord: () => void;
  shuffleRack: () => void;
  exchangeTiles: (indices: number[]) => void;
  resetGame: () => void;
  removePlacedTile: (row: number, col: number) => void;
  clearPlacedTiles: () => void;
  setBlankLetter: (input: { row: number; col: number; tile: TileType } | string) => void;
  cancelBlankLetter: () => void;
} | null>(null);

// Create initial board
const createEmptyBoard = (): CellType[][] => {
  const board: CellType[][] = [];
  for (let row = 0; row < 15; row++) {
    board[row] = [];
    for (let col = 0; col < 15; col++) {
      const key = `${row},${col}`;
      board[row][col] = {
        premium: PREMIUM_LAYOUT[key] || 'normal',
        premiumUsed: false,
      };
    }
  }
  return board;
};

// Create letter bag
const createLetterBag = (): TileType[] => {
  const bag: TileType[] = [];
  let id = 0;
  
  Object.entries(LETTER_DISTRIBUTION).forEach(([letter, info]) => {
    for (let i = 0; i < info.count; i++) {
      bag.push({
        letter,
        points: info.points,
        id: `tile-${id++}`,
        isBlank: letter === '_',
      });
    }
  });
  
  // Shuffle bag
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  
  return bag;
};

// Game Provider Component
const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>({
    phase: 'ready',
    mode: 'medium',
    score: 0,
    strikes: 0,
    timeLeft: 360,
    board: createEmptyBoard(),
    rack: [],
    letterBag: createLetterBag(),
    placedTiles: [],
    isFirstMove: true,
    highScores: {
      slow: 0,
      medium: 0,
      fast: 0,
    },
    playedWords: [],
    blankLetterInput: null,
    errorMessage: null,
  });

  // Initialize high scores from localStorage after component mounts
  useEffect(() => {
    const loadHighScores = () => {
      setState(prev => ({
        ...prev,
        highScores: {
          slow: parseInt(localStorage.getItem('rackrush-high-slow') || '0'),
          medium: parseInt(localStorage.getItem('rackrush-high-medium') || '0'),
          fast: parseInt(localStorage.getItem('rackrush-high-fast') || '0'),
        }
      }));
    };

    loadHighScores();
  }, []);

  // Timer effect
  useEffect(() => {
    if (state.phase !== 'play' || state.timeLeft <= 0) return;

    const timer = setInterval(() => {
      setState(prev => {
        const newTimeLeft = prev.timeLeft - 1;
        if (newTimeLeft <= 0) {
          return { ...prev, timeLeft: 0, phase: 'end' };
        }
        return { ...prev, timeLeft: newTimeLeft };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.phase, state.timeLeft]);

  const drawTiles = (count: number, currentBag: TileType[]): [TileType[], TileType[]] => {
    const drawn: TileType[] = [];
    const newBag = [...currentBag];
    
    for (let i = 0; i < count && newBag.length > 0; i++) {
      drawn.push(newBag.pop()!);
    }
    
    return [drawn, newBag];
  };

  const startGame = (mode: GameMode) => {
    const newBag = createLetterBag();
    const [initialRack, remainingBag] = drawTiles(7, newBag);
    
    setState({
      ...state,
      phase: 'play',
      mode,
      score: 0,
      strikes: 0,
      timeLeft: GAME_CONFIG[mode].time,
      board: createEmptyBoard(),
      rack: initialRack,
      letterBag: remainingBag,
      placedTiles: [],
      isFirstMove: true,
      playedWords: [],
    });
  };

  const validatePlacement = (tiles: PlacedTile[], board: CellType[][], isFirstMove: boolean): { valid: boolean; error?: string } => {
    if (tiles.length === 0) return { valid: false, error: "No tiles placed" };
    
    // Check first move crosses center
    if (isFirstMove) {
      const centerTile = tiles.find(t => t.row === 7 && t.col === 7);
      if (!centerTile) {
        return { valid: false, error: "First word must cross center star" };
      }
    }
    
    // Check all tiles are in a straight line
    const rows = tiles.map(t => t.row);
    const cols = tiles.map(t => t.col);
    const uniqueRows = new Set(rows);
    const uniqueCols = new Set(cols);
    
    const isHorizontal = uniqueRows.size === 1;
    const isVertical = uniqueCols.size === 1;
    
    if (!isHorizontal && !isVertical) {
      return { valid: false, error: "Tiles must be in a straight line" };
    }
    
    // Sort tiles by position
    const sortedTiles = [...tiles].sort((a, b) => {
      if (isHorizontal) return a.col - b.col;
      return a.row - b.row;
    });
    
    // Check for gaps between placed tiles
    for (let i = 1; i < sortedTiles.length; i++) {
      const prev = sortedTiles[i - 1];
      const curr = sortedTiles[i];
      
      if (isHorizontal) {
        let hasGap = false;
        for (let col = prev.col + 1; col < curr.col; col++) {
          if (!board[prev.row][col].tile) {
            hasGap = true;
            break;
          }
        }
        if (hasGap) {
          return { valid: false, error: "Word cannot have gaps" };
        }
      } else {
        let hasGap = false;
        for (let row = prev.row + 1; row < curr.row; row++) {
          if (!board[row][prev.col].tile) {
            hasGap = true;
            break;
          }
        }
        if (hasGap) {
          return { valid: false, error: "Word cannot have gaps" };
        }
      }
    }
    
    // Check if word connects to existing tiles (except first move)
    if (!isFirstMove) {
      let connectsToExisting = false;
      
      for (const { row, col } of tiles) {
        // Check adjacent cells
        const adjacentCells = [
          { r: row - 1, c: col },
          { r: row + 1, c: col },
          { r: row, c: col - 1 },
          { r: row, c: col + 1 },
        ];
        
        for (const { r, c } of adjacentCells) {
          if (r >= 0 && r < 15 && c >= 0 && c < 15) {
            if (board[r][c].tile && !tiles.some(t => t.row === r && t.col === c)) {
              connectsToExisting = true;
              break;
            }
          }
        }
        
        if (connectsToExisting) break;
      }
      
      if (!connectsToExisting) {
        return { valid: false, error: "Word must connect to existing tiles" };
      }
    }
    
    return { valid: true };
  };

  const getFormedWords = (placedTiles: PlacedTile[], board: CellType[][]): { word: string; tiles: PlacedTile[] }[] => {
    const words: { word: string; tiles: PlacedTile[] }[] = [];
    const processedPositions = new Set<string>();
    
    // Create temporary board with placed tiles
    const tempBoard = board.map(row => row.map(cell => ({ ...cell })));
    placedTiles.forEach(({ row, col, tile }) => {
      tempBoard[row][col] = { ...tempBoard[row][col], tile };
    });
    
    // Get main word
    const rows = placedTiles.map(t => t.row);
    const cols = placedTiles.map(t => t.col);
    const isHorizontal = new Set(rows).size === 1;
    const isVertical = new Set(cols).size === 1;
    
    if (isHorizontal) {
      const row = rows[0];
      let startCol = Math.min(...cols);
      let endCol = Math.max(...cols);
      
      // Extend to include existing tiles
      while (startCol > 0 && tempBoard[row][startCol - 1].tile) startCol--;
      while (endCol < 14 && tempBoard[row][endCol + 1].tile) endCol++;
      
      let word = '';
      const wordTiles: PlacedTile[] = [];
      
      for (let col = startCol; col <= endCol; col++) {
        const tile = tempBoard[row][col].tile;
        if (tile) {
          word += tile.letter;
          const placedTile = placedTiles.find(t => t.row === row && t.col === col);
          if (placedTile) {
            wordTiles.push(placedTile);
          }
          processedPositions.add(`${row},${col}`);
        }
      }
      
      if (word.length > 1) {
        words.push({ word, tiles: wordTiles });
      }
    } else if (isVertical) {
      const col = cols[0];
      let startRow = Math.min(...rows);
      let endRow = Math.max(...rows);
      
      while (startRow > 0 && tempBoard[startRow - 1][col].tile) startRow--;
      while (endRow < 14 && tempBoard[endRow + 1][col].tile) endRow++;
      
      let word = '';
      const wordTiles: PlacedTile[] = [];
      
      for (let row = startRow; row <= endRow; row++) {
        const tile = tempBoard[row][col].tile;
        if (tile) {
          word += tile.letter;
          const placedTile = placedTiles.find(t => t.row === row && t.col === col);
          if (placedTile) {
            wordTiles.push(placedTile);
          }
          processedPositions.add(`${row},${col}`);
        }
      }
      
      if (word.length > 1) {
        words.push({ word, tiles: wordTiles });
      }
    }
    
    // Check perpendicular words formed by each placed tile
    placedTiles.forEach(({ row, col }) => {
      if (isHorizontal) {
        // Check vertical word
        let startRow = row;
        let endRow = row;
        
        while (startRow > 0 && tempBoard[startRow - 1][col].tile) startRow--;
        while (endRow < 14 && tempBoard[endRow + 1][col].tile) endRow++;
        
        if (startRow < row || endRow > row) {
          let word = '';
          const wordTiles: PlacedTile[] = [];
          
          for (let r = startRow; r <= endRow; r++) {
            const tile = tempBoard[r][col].tile;
            if (tile) {
              word += tile.letter;
              if (r === row) {
                wordTiles.push({ row, col, tile });
              }
            }
          }
          
          if (word.length > 1) {
            words.push({ word, tiles: wordTiles });
          }
        }
      } else {
        // Check horizontal word
        let startCol = col;
        let endCol = col;
        
        while (startCol > 0 && tempBoard[row][startCol - 1].tile) startCol--;
        while (endCol < 14 && tempBoard[row][endCol + 1].tile) endCol++;
        
        if (startCol < col || endCol > col) {
          let word = '';
          const wordTiles: PlacedTile[] = [];
          
          for (let c = startCol; c <= endCol; c++) {
            const tile = tempBoard[row][c].tile;
            if (tile) {
              word += tile.letter;
              if (c === col) {
                wordTiles.push({ row, col, tile });
              }
            }
          }
          
          if (word.length > 1) {
            words.push({ word, tiles: wordTiles });
          }
        }
      }
    });
    
    return words;
  };

  const calculateScore = (wordTiles: PlacedTile[], board: CellType[][]): number => {
    let totalScore = 0;
    let wordMultiplier = 1;
    
    wordTiles.forEach(({ row, col, tile }) => {
      let tileScore = tile.points;
      const cell = board[row][col];
      
      if (!cell.premiumUsed) {
        switch (cell.premium) {
          case 'DL':
            tileScore *= 2;
            break;
          case 'TL':
            tileScore *= 3;
            break;
          case 'DW':
            wordMultiplier *= 2;
            break;
          case 'TW':
            wordMultiplier *= 3;
            break;
        }
      }
      
      totalScore += tileScore;
    });
    
    totalScore *= wordMultiplier;
    
    return totalScore;
  };

  const placeWord = (tiles: PlacedTile[]) => {
    setState(prev => ({ ...prev, placedTiles: tiles }));
  };

  const removePlacedTile = (row: number, col: number) => {
    setState(prev => ({
      ...prev,
      placedTiles: prev.placedTiles.filter(t => !(t.row === row && t.col === col))
    }));
  };

  const submitWord = () => {
    if (state.placedTiles.length === 0) return;
    
    // Validate placement
    const placementResult = validatePlacement(state.placedTiles, state.board, state.isFirstMove);
    if (!placementResult.valid) {
      // Show error message
      setState(prev => ({ 
        ...prev, 
        errorMessage: placementResult.error || "Invalid word placement",
        placedTiles: [] 
      }));
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, errorMessage: null }));
      }, 3000);
      
      return;
    }
    
    // Get all formed words
    const formedWords = getFormedWords(state.placedTiles, state.board);
    
    // Validate all words
    const invalidWords = formedWords.filter(({ word }) => !dictionary.search(word));
    
    if (invalidWords.length > 0) {
      // Invalid word - add strike
      setState(prev => {
        const newStrikes = prev.strikes + 1;
        const newState = { 
          ...prev, 
          strikes: newStrikes, 
          placedTiles: [],
          errorMessage: `"${invalidWords[0].word}" is not a valid word. Strike ${newStrikes}/3`
        };
        
        // Clear error message after 3 seconds
        setTimeout(() => {
          setState(prev => ({ ...prev, errorMessage: null }));
        }, 3000);
        
        if (newStrikes >= 3) {
          return { ...newState, phase: 'end' };
        }
        return newState;
      });
      return;
    }
    
    // Calculate total score and track words
    let moveScore = 0;
    const newPlayedWords: PlayedWord[] = [];
    
    formedWords.forEach(({ word, tiles }) => {
      const wordScore = calculateScore(tiles, state.board);
      moveScore += wordScore;
      newPlayedWords.push({
        word,
        score: wordScore,
        timestamp: Date.now()
      });
    });
    
    // 50 point bonus for using all 7 tiles
    if (state.placedTiles.length === 7) {
      moveScore += 50;
      newPlayedWords.push({
        word: 'BONUS: All 7 tiles!',
        score: 50,
        timestamp: Date.now()
      });
    }
    
    // Update board
    const newBoard = state.board.map(row => row.map(cell => ({ ...cell })));
    state.placedTiles.forEach(({ row, col, tile }) => {
      newBoard[row][col] = {
        ...newBoard[row][col],
        tile,
        premiumUsed: true,
      };
    });
    
    // Remove used tiles from rack
    const usedTileIds = state.placedTiles.map(t => t.tile.id);
    const newRack = state.rack.filter(t => !usedTileIds.includes(t.id));
    
    // Draw new tiles
    const [drawnTiles, newBag] = drawTiles(7 - newRack.length, state.letterBag);
    
    // Check win condition
    const newScore = state.score + moveScore;
    const target = GAME_CONFIG[state.mode].target;
    
    setState(prev => ({
      ...prev,
      board: newBoard,
      rack: [...newRack, ...drawnTiles],
      letterBag: newBag,
      score: newScore,
      placedTiles: [],
      isFirstMove: false,
      playedWords: [...prev.playedWords, ...newPlayedWords],
      phase: newScore >= target ? 'end' : prev.phase,
      errorMessage: null
    }));
  };

  const shuffleRack = () => {
    setState(prev => {
      const shuffled = [...prev.rack];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return { ...prev, rack: shuffled };
    });
  };

  const exchangeTiles = (indices: number[]) => {
    if (state.letterBag.length < indices.length) return;
    
    setState(prev => {
      const tilesToExchange = indices.map(i => prev.rack[i]);
      const keptTiles = prev.rack.filter((_, i) => !indices.includes(i));
      
      const [drawnTiles, newBag] = drawTiles(indices.length, prev.letterBag);
      const finalBag = [...newBag, ...tilesToExchange];
      
      // Shuffle the bag
      for (let i = finalBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalBag[i], finalBag[j]] = [finalBag[j], finalBag[i]];
      }
      
      return {
        ...prev,
        rack: [...keptTiles, ...drawnTiles],
        letterBag: finalBag,
      };
    });
  };

  const resetGame = () => {
    const newBag = createLetterBag();
    setState(prev => ({
      ...prev,
      phase: 'ready',
      score: 0,
      strikes: 0,
      board: createEmptyBoard(),
      rack: [],
      letterBag: newBag,
      placedTiles: [],
      isFirstMove: true,
      playedWords: [],
    }));
  };

  const clearPlacedTiles = () => {
    setState(prev => ({
      ...prev,
      placedTiles: []
    }));
  };

  const setBlankLetter = (input: { row: number; col: number; tile: TileType } | string) => {
    if (typeof input === 'string') {
      if (!state.blankLetterInput) return;
      
      const { row, col, tile } = state.blankLetterInput;
      const newTile = { ...tile, letter: input.toUpperCase() };
      
      setState(prev => ({
        ...prev,
        placedTiles: prev.placedTiles.map(t => 
          t.row === row && t.col === col ? { ...t, tile: newTile } : t
        ),
        blankLetterInput: null
      }));
    } else {
      setState(prev => ({
        ...prev,
        blankLetterInput: input
      }));
    }
  };

  const cancelBlankLetter = () => {
    setState(prev => ({
      ...prev,
      blankLetterInput: null
    }));
  };

  return (
    <GameContext.Provider value={{
      state,
      startGame,
      placeWord,
      submitWord,
      shuffleRack,
      exchangeTiles,
      resetGame,
      removePlacedTile,
      clearPlacedTiles,
      setBlankLetter,
      cancelBlankLetter,
    }}>
      {children}
    </GameContext.Provider>
  );
};

// Board Component with Drag and Drop
const Board: React.FC = () => {
  const context = useContext(GameContext);
  const [selectedTile, setSelectedTile] = useState<{ tile: TileType; rackIndex: number } | null>(null);
  const [draggedTile, setDraggedTile] = useState<{ tile: TileType; fromRack: boolean; row?: number; col?: number } | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{ row: number; col: number } | null>(null);
  const [direction, setDirection] = useState<'right' | 'down' | 'none'>('none');
  const [isDraggingToRack, setIsDraggingToRack] = useState(false);

  // Helper function to find the last placed tile in the current sequence
  const findLastPlacedTileInSequence = useCallback((currentPos: { row: number; col: number }, dir: 'right' | 'down' | 'none') => {
    if (!context || dir === 'none' || context.state.placedTiles.length === 0) return null;
    
    // Get all placed tiles that are in line with our current position
    const tilesInSequence = context.state.placedTiles.filter(tile => {
      if (dir === 'right') {
        return tile.row === currentPos.row && tile.col < currentPos.col;
      } else if (dir === 'down') {
        return tile.col === currentPos.col && tile.row < currentPos.row;
      }
      return false;
    });
    
    if (tilesInSequence.length === 0) return null;
    
    // Sort by position and get the last one
    tilesInSequence.sort((a, b) => {
      if (dir === 'right') {
        return b.col - a.col; // Descending order for rightward
      } else {
        return b.row - a.row; // Descending order for downward
      }
    });
    
    return tilesInSequence[0];
  }, [context]);

  const getNextAvailablePosition = useCallback((position: { row: number; col: number }, dir: 'right' | 'down' | 'none', advance: boolean = false) => {
    if (!context || dir === 'none') return position;
    
    let nextRow = position.row;
    let nextCol = position.col;
    
    // If advance is true, start from the next position
    if (advance) {
      if (dir === 'right') {
        nextCol++;
      } else if (dir === 'down') {
        nextRow++;
      }
    }
    
    // Find the next available position
    while (nextRow < 15 && nextCol < 15) {
      // Check if current position is available
      const cellHasTile = context.state.board[nextRow][nextCol].tile;
      const cellHasPlacedTile = context.state.placedTiles.some(t => t.row === nextRow && t.col === nextCol);
      
      if (!cellHasTile && !cellHasPlacedTile) {
        return { row: nextRow, col: nextCol };
      }
      
      // Move to next position based on direction
      if (dir === 'right') {
        nextCol++;
        if (nextCol >= 15) return null; // Out of bounds
      } else if (dir === 'down') {
        nextRow++;
        if (nextRow >= 15) return null; // Out of bounds
      }
    }
    
    return null; // No available position found
  }, [context]);

  // Handle typing from parent component
  const handleTyping = useCallback((letter: string): boolean => {
    if (!context) return false;
    
    const { state, placeWord, removePlacedTile, setBlankLetter } = context;
    
    // Handle backspace/delete
    if (letter === 'BACKSPACE' || letter === 'DELETE') {
      if (!selectedPosition || direction === 'none' || state.placedTiles.length === 0) {
        return false;
      }
      
      // Find the last placed tile that would be in our current word sequence
      const lastPlacedTile = findLastPlacedTileInSequence(selectedPosition, direction);
      
      if (lastPlacedTile) {
        // Remove the tile
        removePlacedTile(lastPlacedTile.row, lastPlacedTile.col);
        // Move selection back to that position
        setSelectedPosition({ row: lastPlacedTile.row, col: lastPlacedTile.col });
        return true;
      }
      
      return false;
    }

    // Only handle letter keys when a position is selected, direction is set, and no blank letter input is active
    if (!selectedPosition || direction === 'none' || state.blankLetterInput) {
      return false; // Return false to indicate we didn't handle it
    }
    
    // Find matching tile in rack (prefer non-blank tiles first)
    const availableRackTiles = state.rack.filter(tile => 
      !state.placedTiles.some(p => p.tile.id === tile.id)
    );
    
    let tileToPlace = availableRackTiles.find(tile => !tile.isBlank && tile.letter === letter);
    
    // If no exact match, use a blank tile
    if (!tileToPlace) {
      tileToPlace = availableRackTiles.find(tile => tile.isBlank);
      if (tileToPlace) {
        // Create a copy with the letter set
        tileToPlace = { ...tileToPlace, letter };
      }
    }
    
    if (!tileToPlace) {
      return false; // No available tile for this letter
    }
    
    // Check if the selected position is available
    const cellHasTile = state.board[selectedPosition.row][selectedPosition.col].tile;
    const cellHasPlacedTile = state.placedTiles.some(t => t.row === selectedPosition.row && t.col === selectedPosition.col);
    
    let targetPosition = selectedPosition;
    
    // If the selected position is occupied, find the next available position
    if (cellHasTile || cellHasPlacedTile) {
      const nextPos = getNextAvailablePosition(selectedPosition, direction, true);
      if (!nextPos) {
        return false;
      }
      targetPosition = nextPos;
    }
    
    // Place the tile
    const newPlacedTiles = [...state.placedTiles, { row: targetPosition.row, col: targetPosition.col, tile: tileToPlace }];
    placeWord(newPlacedTiles);
    
    // Update selected position to next available spot
    const nextPosition = getNextAvailablePosition(targetPosition, direction, true);
    if (nextPosition) {
      setSelectedPosition(nextPosition);
    }
    
    // If it was a blank tile, handle the blank letter input
    if (tileToPlace.isBlank) {
      setBlankLetter({ row: targetPosition.row, col: targetPosition.col, tile: tileToPlace });
    }

    return true; // Return true to indicate we handled it
  }, [selectedPosition, direction, context, findLastPlacedTileInSequence, getNextAvailablePosition]);

  // Expose the handler via imperative handle or callback
  useEffect(() => {
    if (!context) return;
    
    // Store the handler on the window object so GameScreen can call it
    (window as unknown as { boardTypingHandler?: (letter: string) => boolean }).boardTypingHandler = handleTyping;
    return () => {
      delete (window as unknown as { boardTypingHandler?: (letter: string) => boolean }).boardTypingHandler;
    };
  }, [handleTyping, context]);

  // Reset selected position when turn is played or no tiles available
  useEffect(() => {
    if (!context) return;
    
    if (context.state.placedTiles.length === 0) {
      setSelectedPosition(null);
      setDirection('none');
      return;
    }
    
    // Also clear selection if no tiles are available in rack
    const availableRackTiles = context.state.rack.filter(tile => 
      !context.state.placedTiles.some(p => p.tile.id === tile.id)
    );
    
    if (availableRackTiles.length === 0) {
      setSelectedPosition(null);
      setDirection('none');
    }
  }, [context]);

  if (!context) return null;
  
  const { state, placeWord, removePlacedTile } = context;

  const handleCellClick = (row: number, col: number) => {
    // Check if there's already a placed tile here
    const existingPlacedTile = state.placedTiles.find(t => t.row === row && t.col === col);
    
    if (existingPlacedTile) {
      // Remove the placed tile
      removePlacedTile(row, col);
      return;
    }
    
    // Check if cell already has a permanent tile
    if (state.board[row][col].tile) return;
    
    // Check if there are any available tiles in the rack
    const availableRackTiles = state.rack.filter(tile => 
      !state.placedTiles.some(p => p.tile.id === tile.id)
    );
    
    // Don't allow selection if no tiles available (unless we have a selected tile from rack)
    if (availableRackTiles.length === 0 && !selectedTile) {
      return;
    }
    
    // If clicking on the same position, cycle through directions
    if (selectedPosition && selectedPosition.row === row && selectedPosition.col === col) {
      if (direction === 'none') {
        setDirection('right');
      } else if (direction === 'right') {
        setDirection('down');
      } else {
        setDirection('none');
        setSelectedPosition(null);
      }
      return;
    }
    
    // Set new selected position and start with right direction
    setSelectedPosition({ row, col });
    setDirection('right');
    
    // If we have a selected tile from rack, place it immediately
    if (selectedTile) {
      // If it's a blank tile, prompt for letter
      if (selectedTile.tile.isBlank) {
        const newPlacedTiles = [...state.placedTiles, { row, col, tile: selectedTile.tile }];
        placeWord(newPlacedTiles);
        context.setBlankLetter({ row, col, tile: selectedTile.tile });
        setSelectedTile(null);
        return;
      }
      
      // Add new placed tile
      const newPlacedTiles = [...state.placedTiles, { row, col, tile: selectedTile.tile }];
      placeWord(newPlacedTiles);
      
      // Clear selection
      setSelectedTile(null);
      
      // Move to next position
      const nextPosition = getNextAvailablePosition({ row, col }, direction, true);
      if (nextPosition && (nextPosition.row !== row || nextPosition.col !== col)) {
        setSelectedPosition(nextPosition);
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, row: number, col: number) => {
    e.preventDefault();
    
    if (!draggedTile) return;
    
    // Check if there's already a placed tile here
    const existingPlacedTile = state.placedTiles.find(t => t.row === row && t.col === col);
    
    // If dropping on another placed tile, handle swapping
    if (existingPlacedTile) {
      if (draggedTile.fromRack) {
        // Dragging from rack onto board tile - replace board tile and return it to rack
        const newPlacedTiles = state.placedTiles.filter(t => !(t.row === row && t.col === col));
        newPlacedTiles.push({ row, col, tile: draggedTile.tile });
        placeWord(newPlacedTiles);
        
        // If the new tile is a blank, prompt for letter
        if (draggedTile.tile.isBlank) {
          context.setBlankLetter({ row, col, tile: draggedTile.tile });
        }
      } else if (draggedTile.row !== undefined && draggedTile.col !== undefined) {
        // Dragging from board to board - swap positions
        const newPlacedTiles = state.placedTiles.map(t => {
          if (t.row === row && t.col === col) {
            return { ...t, row: draggedTile.row!, col: draggedTile.col! };
          }
          if (t.row === draggedTile.row && t.col === draggedTile.col) {
            return { ...t, row, col };
          }
          return t;
        });
        placeWord(newPlacedTiles);
      }
      setDraggedTile(null);
      return;
    }
    
    // If dropping on an empty cell
    if (!state.board[row][col].tile) {
      // If dragging from another board position, remove from old position
      if (!draggedTile.fromRack && draggedTile.row !== undefined && draggedTile.col !== undefined) {
        removePlacedTile(draggedTile.row, draggedTile.col);
      }
      
      // Add new placed tile
      const newPlacedTiles = [...state.placedTiles.filter(t => !(t.row === draggedTile.row && t.col === draggedTile.col)), { row, col, tile: draggedTile.tile }];
      placeWord(newPlacedTiles);
      
      // If it's a blank tile, prompt for letter
      if (draggedTile.tile.isBlank) {
        context.setBlankLetter({ row, col, tile: draggedTile.tile });
      }
    }
    
    setDraggedTile(null);
    setIsDraggingToRack(false);
  };

  // Add rack drop handling
  const handleRackDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!draggedTile) return;
    
    // If dragging from the board, remove the tile from the board
    if (!draggedTile.fromRack && draggedTile.row !== undefined && draggedTile.col !== undefined) {
      removePlacedTile(draggedTile.row, draggedTile.col);
    }
    
    setDraggedTile(null);
    setIsDraggingToRack(false);
  };

  const handleRackDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedTile && !draggedTile.fromRack) {
      setIsDraggingToRack(true);
    }
  };

  const handleRackDragLeave = () => {
    setIsDraggingToRack(false);
  };

  // Add rack tile drag start handler
  const handleRackTileDragStart = (tile: TileType) => {
    // Check if this tile is already placed on the board
    const placedTile = state.placedTiles.find(p => p.tile.id === tile.id);
    if (placedTile) {
      setDraggedTile({ tile, fromRack: false, row: placedTile.row, col: placedTile.col });
    } else {
      setDraggedTile({ tile, fromRack: true });
    }
  };

  const getCellClass = (cell: CellType, row: number, col: number) => {
    let baseClass = "w-10 h-10 border border-gray-300 flex items-center justify-center text-xs font-bold relative cursor-pointer transition-all select-none ";
    
    const placedTile = state.placedTiles.find(t => t.row === row && t.col === col);
    const isSelected = selectedPosition && selectedPosition.row === row && selectedPosition.col === col;
    
    if (cell.tile || placedTile) {
      baseClass += "bg-amber-300 ";
      if (placedTile) {
        baseClass += "ring-2 ring-blue-500 ";
      }
    } else if (isSelected) {
      baseClass += "bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-400 ";
    } else if (row === 7 && col === 7) {
      baseClass += "bg-pink-200 ";
    } else {
      switch (cell.premium) {
        case 'TW':
          baseClass += "bg-red-500 text-white ";
          break;
        case 'DW':
          baseClass += "bg-pink-400 text-white ";
          break;
        case 'TL':
          baseClass += "bg-blue-500 text-white ";
          break;
        case 'DL':
          baseClass += "bg-blue-300 text-white ";
          break;
        default:
          baseClass += "bg-green-50 ";
      }
    }
    
    return baseClass;
  };

  const renderDirectionArrow = (row: number, col: number) => {
    if (!selectedPosition || selectedPosition.row !== row || selectedPosition.col !== col || direction === 'none') {
      return null;
    }
    
    // Check if there are any available tiles in the rack
    const availableRackTiles = state.rack.filter(tile => 
      !state.placedTiles.some(p => p.tile.id === tile.id)
    );
    
    // Hide arrow if no tiles available
    if (availableRackTiles.length === 0) {
      return null;
    }
    
    return (
      <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 text-white text-[8px] flex items-center justify-center rounded-bl cursor-pointer hover:bg-blue-600 transition-colors z-10">
        {direction === 'right' ? '→' : '↓'}
      </div>
    );
  };

  return (
    <div>
      <div className="inline-block border-2 border-gray-800">
        {state.board.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {row.map((cell, colIndex) => {
              const placedTile = state.placedTiles.find(t => t.row === rowIndex && t.col === colIndex);
              const displayTile = placedTile?.tile || cell.tile;
              
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={getCellClass(cell, rowIndex, colIndex)}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                >
                  {displayTile ? (
                    <div
                      draggable={!!placedTile}
                      onDragStart={() => placedTile && setDraggedTile({ tile: displayTile, fromRack: false, row: rowIndex, col: colIndex })}
                      className="w-full h-full flex items-center justify-center cursor-move select-none"
                    >
                      <span className="text-lg text-gray-800 select-none">{displayTile.letter}</span>
                      <span className="absolute bottom-0 right-1 text-[8px] text-gray-700 select-none">
                        {displayTile.points}
                      </span>
                    </div>
                  ) : (
                    <span className="select-none">
                      {rowIndex === 7 && colIndex === 7 ? '★' : 
                      cell.premium !== 'normal' ? cell.premium : ''}
                    </span>
                  )}
                  {renderDirectionArrow(rowIndex, colIndex)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Rack component with drop handling */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Your Rack:</h3>
        <div 
          className={`flex gap-2 p-4 bg-amber-100 dark:bg-amber-900 rounded-lg transition-colors ${
            isDraggingToRack ? 'bg-amber-200 dark:bg-amber-800' : ''
          }`}
          onDragOver={handleRackDragOver}
          onDragLeave={handleRackDragLeave}
          onDrop={handleRackDrop}
        >
          {state.rack.map((tile, index) => {
            const isUsed = state.placedTiles.some(p => p.tile.id === tile.id);
            if (isUsed) return null;
            
            return (
              <div
                key={tile.id}
                draggable
                onDragStart={() => handleRackTileDragStart(tile)}
                className={`w-12 h-12 bg-amber-300 border-2 border-amber-600 rounded flex items-center justify-center cursor-pointer relative transition-transform hover:scale-110 select-none ${
                  selectedTile?.tile.id === tile.id ? 'ring-2 ring-blue-500 scale-110' : ''
                }`}
                onClick={() => setSelectedTile({ tile, rackIndex: index })}
              >
                <span className="text-xl font-bold text-gray-800 select-none">{tile.letter}</span>
                <span className="absolute bottom-0 right-1 text-[10px] font-semibold text-gray-700 select-none">
                  {tile.points}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Words Played Component
const WordsPlayed: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state } = context;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg max-h-96 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Words Played</h3>
      {state.playedWords.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm italic">No words played yet...</p>
      ) : (
        <div className="space-y-2">
          {state.playedWords.map((wordInfo, index) => (
            <div
              key={`${wordInfo.word}-${index}`}
              className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded transition-all hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {wordInfo.word}
              </span>
              <span className="text-green-600 dark:text-green-400 font-bold">
                +{wordInfo.score}
              </span>
            </div>
          ))}
          <div className="border-t pt-2 mt-2 flex justify-between items-center">
            <span className="font-semibold text-gray-800 dark:text-gray-200">Total:</span>
            <span className="font-bold text-xl text-blue-600 dark:text-blue-400">
              {state.score}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Timer Component
const Timer: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state } = context;
  const minutes = Math.floor(state.timeLeft / 60);
  const seconds = state.timeLeft % 60;
  
  return (
    <div className={`text-3xl font-mono ${state.timeLeft < 60 ? 'text-red-500' : ''}`}>
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
};

// Strike Display Component
const StrikeDisplay: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state } = context;
  
  return (
    <div className="flex gap-2">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
            i < state.strikes
              ? 'bg-red-500 border-red-600 text-white'
              : 'border-gray-300'
          }`}
        >
          {i < state.strikes && '✕'}
        </div>
      ))}
    </div>
  );
};

// How To Play Modal
const HowToPlayModal: React.FC = () => {
  const context = useContext(GameContext);
  const { transitionTo } = usePageTransition();
  
  if (!context) return null;
  
  const { state, startGame } = context;
  
  if (state.phase !== 'ready') return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-2xl mx-4 relative">
        <button
          onClick={() => transitionTo('/')}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          ✕
        </button>
        
        <h1 className="text-4xl font-bold text-center mb-6 text-purple-600 dark:text-purple-400">
          RACK RUSH
        </h1>
        
        <div className="mb-6 space-y-3">
          <h2 className="text-xl font-semibold mb-2">How to Play:</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Form words on the board using your 7-tile rack</li>
            <li>First word must cross the center star</li>
            <li>Click or drag tiles to place them on the board</li>
            <li>Score points based on letter values and premium squares</li>
            <li>Reach the target score before time runs out!</li>
            <li>3 invalid words = Game Over</li>
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Premium Squares:</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500 text-white flex items-center justify-center text-xs font-bold">TW</div>
              <span>Triple Word Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-400 text-white flex items-center justify-center text-xs font-bold">DW</div>
              <span>Double Word Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 text-white flex items-center justify-center text-xs font-bold">TL</div>
              <span>Triple Letter Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-300 text-white flex items-center justify-center text-xs font-bold">DL</div>
              <span>Double Letter Score</span>
            </div>
          </div>
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold mb-2">Choose Difficulty:</h3>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => startGame('slow')}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <div className="font-bold">SLOW</div>
              <div className="text-xs">10 min • 300 pts</div>
            </button>
            <button
              onClick={() => startGame('medium')}
              className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              <div className="font-bold">MEDIUM</div>
              <div className="text-xs">6 min • 200 pts</div>
            </button>
            <button
              onClick={() => startGame('fast')}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <div className="font-bold">FAST</div>
              <div className="text-xs">3 min • 120 pts</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Game Screen Component
const GameScreen: React.FC = () => {
  const context = useContext(GameContext);

  useEffect(() => {
    if (!context) return;
    
    const { state, submitWord, setBlankLetter, cancelBlankLetter } = context;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && state.placedTiles.length > 0) {
        submitWord();
        return;
      }
      
      // Handle letter input for blank tiles only
      if (state.blankLetterInput) {
        if (e.key === 'Escape') {
          cancelBlankLetter();
        } else if (/^[a-zA-Z]$/.test(e.key)) {
          setBlankLetter(e.key);
        }
        return;
      }
      
      // Handle regular letter typing for board placement
      if (/^[a-zA-Z]$/.test(e.key)) {
        const letter = e.key.toUpperCase();
        
        // Call the Board's typing handler
        const boardHandler = (window as unknown as { boardTypingHandler?: (letter: string) => boolean }).boardTypingHandler;
        if (boardHandler && typeof boardHandler === 'function') {
          const handled = boardHandler(letter);
          if (handled) {
            return; // Board handled it, we're done
          }
        }
      }
      
      // Handle backspace/delete for board placement
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Call the Board's typing handler with backspace
        const boardHandler = (window as unknown as { boardTypingHandler?: (letter: string) => boolean }).boardTypingHandler;
        if (boardHandler && typeof boardHandler === 'function') {
          const handled = boardHandler('BACKSPACE');
          if (handled) {
            return; // Board handled it, we're done
          }
        }
      }
      
      // Don't consume other keyboard events - let them bubble to other handlers
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [context]);
  
  if (!context) return null;
  
  const { state, submitWord, shuffleRack, exchangeTiles, clearPlacedTiles } = context;
  
  if (state.phase !== 'play') return null;
  
  return (
    <div className="flex gap-8 p-8 max-w-7xl mx-auto">
      <div className="flex-shrink-0">
        <Board />
      </div>
      
      <div className="flex-1 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-2xl font-bold">Score: {state.score}</div>
            <div className="text-sm text-gray-600">
              Target: {GAME_CONFIG[state.mode].target}
            </div>
          </div>
          <Timer />
          <StrikeDisplay />
        </div>
        
        <WordsPlayed />
        
        <div className="flex gap-4">
          <button
            onClick={shuffleRack}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Shuffle
          </button>
          <button
            onClick={() => exchangeTiles([])}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            disabled={state.letterBag.length === 0}
          >
            Exchange
          </button>
          <button
            onClick={clearPlacedTiles}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            disabled={state.placedTiles.length === 0}
          >
            Clear
          </button>
          <button
            onClick={submitWord}
            className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors font-bold"
            disabled={state.placedTiles.length === 0}
          >
            Submit Word
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          <p>Tiles in bag: {state.letterBag.length}</p>
          {state.placedTiles.length > 0 && (
            <p className="mt-2 text-green-600">
              {state.placedTiles.length} tile{state.placedTiles.length > 1 ? 's' : ''} placed
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// End Screen Component
const EndScreen: React.FC = () => {
  const context = useContext(GameContext);
  const { transitionTo } = usePageTransition();
  
  // Move useEffect to top level and make it conditional inside
  useEffect(() => {
    if (context && context.state.phase === 'end') {
      const state = context.state;
      const isHighScore = state.score > state.highScores[state.mode];
      
      if (isHighScore && state.score > 0) {
        localStorage.setItem(`rackrush-high-${state.mode}`, state.score.toString());
      }
    }
  }, [context]);
  
  if (!context) return null;
  
  const { state, resetGame } = context;
  
  if (state.phase !== 'end') return null;
  
  const won = state.score >= GAME_CONFIG[state.mode].target;
  const isHighScore = state.score > state.highScores[state.mode];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-4 text-center ${
        won ? '' : 'grayscale'
      }`}>
        <h2 className={`text-3xl font-bold mb-4 ${
          won ? 'text-green-500' : 'text-red-500'
        }`}>
          {won ? '🎉 YOU WIN! 🎉' : '😔 GAME OVER'}
        </h2>
        
        <div className="mb-6">
          <p className="text-2xl font-semibold mb-2">Final Score: {state.score}</p>
          {!won && (
            <p className="text-gray-600 dark:text-gray-400">
              {state.strikes >= 3 ? '3 invalid words' : 'Out of time'}
            </p>
          )}
          {isHighScore && state.score > 0 && (
            <p className="text-yellow-500 font-bold mt-2">
              ✨ New Personal Best! ✨
            </p>
          )}
        </div>
        
        <div className="space-y-3">
          <button
            onClick={resetGame}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            Play Again
          </button>
          <button
            className="w-full px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-semibold"
            disabled
          >
            See Leaderboard
          </button>
          <button
            onClick={() => transitionTo('/')}
            className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold"
          >
            Back to Portfolio
          </button>
        </div>
      </div>
    </div>
  );
};

// Blank Letter Modal
const BlankLetterModal: React.FC = () => {
  const context = useContext(GameContext);
  
  useEffect(() => {
    if (!context || !context.state.blankLetterInput) return;
    
    const { setBlankLetter, cancelBlankLetter } = context;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelBlankLetter();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setBlankLetter(e.key);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [context]);
  
  if (!context) return null;
  
  const { state, cancelBlankLetter } = context;
  
  if (!state.blankLetterInput) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Enter Letter for Blank Tile</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Type any letter to use for this blank tile
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={cancelBlankLetter}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Error Message Component
const ErrorMessage: React.FC = () => {
  const context = useContext(GameContext);
  if (!context) return null;
  
  const { state } = context;
  
  if (!state.errorMessage) return null;
  
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-out">
      {state.errorMessage}
    </div>
  );
};

// Main Circuit Page Component
export default function CircuitPage() {
  const { transitionTo } = usePageTransition();

  const handleBack = () => {
    transitionTo('/');
  };

  return (
    <PageTransition>
      <GameProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative">
          <button
            onClick={handleBack}
            className="absolute top-6 left-6 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-400 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300 z-10"
          >
            Back
          </button>
          
          <HowToPlayModal />
          <GameScreen />
          <EndScreen />
          <BlankLetterModal />
          <ErrorMessage />
        </div>
      </GameProvider>
    </PageTransition>
  );
}

// Add this to your global styles or tailwind config
const styles = `
@keyframes fadeInOut {
  0% { opacity: 0; transform: translate(-50%, -20px); }
  10% { opacity: 1; transform: translate(-50%, 0); }
  90% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -20px); }
}

.animate-fade-in-out {
  animation: fadeInOut 3s ease-in-out forwards;
}
`;

// Add the styles to the document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}