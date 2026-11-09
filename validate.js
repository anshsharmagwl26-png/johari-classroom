const {
  ADJECTIVES,
  STORAGE_KEY,
  appState,
  clearStoredAssessments,
  computeQuadrants,
  createExportPayload,
  getEmptyCounts,
  loadAssessments,
  normalizeSelection,
  parseImportPayload,
  persistAssessments,
  submitPeerDraft,
  validateAssessment
} = require('./app.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectError(callback, message) {
  let failed = false;
  try { callback(); } catch { failed = true; }
  assert(failed, message);
}

const expectedAdjectives = [
  'Able', 'Acceptable', 'Adaptable', 'Bold', 'Brave', 'Calm', 'Caring', 'Cheerful', 'Clever',
  'Complex', 'Confident', 'Dependable', 'Dignified', 'Energetic', 'Extroverted', 'Friendly',
  'Giving', 'Happy', 'Helpful', 'Idealistic', 'Independent', 'Ingenious', 'Intelligent',
  'Introverted', 'Kind', 'Knowledgeable', 'Lamed', 'Liberal', 'Lively', 'Logical', 'Loving',
  'Mature', 'Modest', 'Nervous', 'Observant', 'Organized', 'Patient', 'Proud', 'Quiet',
  'Reflective', 'Religious', 'Responsive', 'Searching', 'Self-assertive', 'Self-conscious',
  'Sensible', 'Sentimental', 'Shy', 'Smart', 'Spontaneous', 'Tense', 'Trustworthy', 'Warm',
  'Wise', 'Witty'
];

assert(ADJECTIVES.length === 55, `Expected exactly 55 adjectives, got ${ADJECTIVES.length}.`);
assert(new Set(ADJECTIVES).size === 55, 'Canonical adjectives must be unique.');
assert(JSON.stringify(ADJECTIVES) === JSON.stringify(expectedAdjectives), 'Canonical list or original spelling/order changed.');
assert(ADJECTIVES.includes('Lamed'), 'The original spelling Lamed must be preserved.');
assert(normalizeSelection(['Kind', 'Able', 'Kind']).join(',') === 'Able,Kind', 'Selection normalization should remove duplicates and retain canonical order.');

const selfSelection = ['Able', 'Calm', 'Friendly', 'Kind', 'Observant'];
const zeroPeer = computeQuadrants(selfSelection, getEmptyCounts());
assert(zeroPeer.open.size === 0 && zeroPeer.blind.size === 0, 'Zero peer responses must produce empty Open and Blind quadrants.');
assert(zeroPeer.hidden.size === 5 && zeroPeer.unknown.size === 50, 'Zero peer response Hidden/Unknown totals are incorrect.');

const assessment = {
  id: 'test-assessment', subjectName: 'Sample Subject', title: 'Class reflection', selfSelection,
  peerCounts: getEmptyCounts(), participantCount: 0, totalPeerSelections: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString()
};
const firstTurn = ['Able', 'Caring', 'Friendly', 'Modest', 'Patient'];
const secondTurn = ['Able', 'Caring', 'Friendly', 'Modest', 'Patient', 'Wise'];
const afterFirstTurn = submitPeerDraft(assessment, firstTurn);
assert(afterFirstTurn.length === 0, 'Temporary peer selection must be cleared after submission.');
assert(!Object.hasOwn(assessment, 'participants') && !Object.hasOwn(assessment, 'responses'), 'No individual peer records may be stored.');
submitPeerDraft(assessment, secondTurn);
assert(assessment.participantCount === 2 && assessment.totalPeerSelections === 11, 'Multiple peer totals are incorrect.');
assert(assessment.peerCounts.Able === 2 && assessment.peerCounts.Wise === 1, 'Frequency must count distinct participant selections.');
assert(!Object.hasOwn(assessment, 'participantNames') && !Object.hasOwn(assessment, 'peerSubmissions'), 'Participant identities or combinations must not be stored.');

const quadrants = computeQuadrants(selfSelection, assessment.peerCounts);
assert(quadrants.open.has('Able') && quadrants.open.has('Friendly'), 'Open must be S intersect P.');
assert(quadrants.blind.has('Caring') && quadrants.blind.has('Wise'), 'Blind must be P minus S.');
assert(quadrants.hidden.has('Calm') && quadrants.hidden.has('Kind'), 'Hidden must be S minus P.');
assert(quadrants.unknown.has('Liberal'), 'Unknown must be U minus (S union P).');
const partition = [...quadrants.open, ...quadrants.blind, ...quadrants.hidden, ...quadrants.unknown];
assert(partition.length === 55 && new Set(partition).size === 55, 'Every adjective must appear in exactly one quadrant.');
assert(quadrants.open.size + quadrants.blind.size + quadrants.hidden.size + quadrants.unknown.size === 55, 'Quadrant counts must total 55.');

const validImported = validateAssessment(assessment);
assert(validImported.selfSelection.length === 5, 'A valid 5-word self-assessment should pass validation.');
expectError(() => validateAssessment({ ...assessment, selfSelection: selfSelection.slice(0, 4) }), 'Four self-selected adjectives must be rejected.');
expectError(() => validateAssessment({ ...assessment, selfSelection: ADJECTIVES.slice(0, 8) }), 'Eight self-selected adjectives must be rejected.');
expectError(() => validateAssessment({ ...assessment, selfSelection: [...selfSelection.slice(0, 4), 'Not canonical'] }), 'Invalid adjective must be rejected.');
expectError(() => submitPeerDraft(assessment, ['Able', 'Caring', 'Friendly', 'Modest']), 'Four peer adjectives must be rejected.');
expectError(() => submitPeerDraft(assessment, ['Able', 'Caring', 'Friendly', 'Modest', 'Not canonical']), 'Invalid peer adjective must be rejected.');
expectError(() => submitPeerDraft(assessment, ['Able', 'Able', 'Caring', 'Friendly', 'Modest']), 'Duplicate peer choices must be rejected.');

const payload = createExportPayload(validImported);
const roundTripped = parseImportPayload(JSON.parse(JSON.stringify(payload)));
assert(roundTripped.peerCounts.Able === 2 && roundTripped.participantCount === 2, 'JSON export/import should preserve aggregate results.');
assert(!JSON.stringify(payload).includes('peerSubmissions'), 'Export must not contain individual peer submissions.');
expectError(() => parseImportPayload({ ...payload, schemaVersion: 999 }), 'Unsupported export version must be rejected.');
expectError(() => parseImportPayload({ ...payload, assessment: { ...payload.assessment, peerCounts: { ...payload.assessment.peerCounts, Able: 3 } } }), 'Inconsistent aggregate counts must be rejected.');

const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key)
};
appState.assessments = [validImported];
persistAssessments();
const persistedJson = storage.get(STORAGE_KEY);
assert(persistedJson.includes('peerCounts') && !persistedJson.includes('peerDraft') && !persistedJson.includes('participantNames'), 'LocalStorage must persist aggregates only.');
assert(loadAssessments()[0].peerCounts.Able === 2, 'Saved assessment should load with its aggregate counts.');
clearStoredAssessments();
assert(!storage.has(STORAGE_KEY), 'Clearing saved assessments must remove LocalStorage data.');

console.log('Johari Classroom tests passed: 55 canonical words, validation, privacy-safe peer aggregation, four quadrants, persistence, import/export, and deletion.');
