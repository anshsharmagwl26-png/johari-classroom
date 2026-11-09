const { ADJECTIVES, computeQuadrants, normalizeSelection } = require('./script.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const uniqueLabels = ADJECTIVES.map((item) => item.adjective);
assert(uniqueLabels.length === 55, `Expected 55 adjectives, found ${uniqueLabels.length}.`);
assert(new Set(uniqueLabels).size === 55, 'Adjective list must contain exactly 55 unique values.');

const selfSelection = [
  'Able',
  'Calm',
  'Friendly',
  'Kind',
  'Observant',
  'Warm'
];

const participantSelection = [
  'Able',
  'Caring',
  'Friendly',
  'Modest',
  'Patient',
  'Warm',
  'Wise'
];

const quadrants = computeQuadrants(selfSelection, participantSelection);
const open = quadrants.open;
const blind = quadrants.blind;
const hidden = quadrants.hidden;
const unknown = quadrants.unknown;

assert(open.size + blind.size + hidden.size + unknown.size === 55, 'Quadrants must cover all 55 adjectives.');
assert(normalizeSelection(['Able', 'Kind', 'Kind']).length === 2, 'Normalization should remove duplicates while preserving canonical order.');
assert(open.has('Able'), 'Open should include the shared adjective Able.');
assert(blind.has('Caring'), 'Blind should include participant-only selections.');
assert(hidden.has('Calm'), 'Hidden should include self-only selections.');
assert(unknown.has('Liberal'), 'Unknown should include adjectives not selected by either party.');

console.log('Johari Classroom validation passed: 55 canonical adjectives and quadrant math verified.');
