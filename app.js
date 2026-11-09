const ADJECTIVES = [
  'Able', 'Acceptable', 'Adaptable', 'Bold', 'Brave', 'Calm', 'Caring', 'Cheerful', 'Clever',
  'Complex', 'Confident', 'Dependable', 'Dignified', 'Energetic', 'Extroverted', 'Friendly',
  'Giving', 'Happy', 'Helpful', 'Idealistic', 'Independent', 'Ingenious', 'Intelligent',
  'Introverted', 'Kind', 'Knowledgeable', 'Lamed', 'Liberal', 'Lively', 'Logical', 'Loving',
  'Mature', 'Modest', 'Nervous', 'Observant', 'Organized', 'Patient', 'Proud', 'Quiet',
  'Reflective', 'Religious', 'Responsive', 'Searching', 'Self-assertive', 'Self-conscious',
  'Sensible', 'Sentimental', 'Shy', 'Smart', 'Spontaneous', 'Tense', 'Trustworthy', 'Warm',
  'Wise', 'Witty'
];

const ADJECTIVE_SET = new Set(ADJECTIVES);
const STORAGE_KEY = 'johari-classroom-assessments-v2';
const QUADRANTS = ['open', 'blind', 'hidden', 'unknown'];
const QUADRANT_INFO = {
  open: { title: 'Open', note: 'Known to you and recognized by peers.', className: 'open' },
  blind: { title: 'Blind', note: 'Recognized by peers, but not selected by you.', className: 'blind' },
  hidden: { title: 'Hidden', note: 'Selected by you, but not yet recognized by peers.', className: 'hidden' },
  unknown: { title: 'Unknown', note: 'Not selected by you or any peer in this activity.', className: 'unknown' }
};

function normalizeSelection(value) {
  if (!Array.isArray(value)) return [];
  const selected = new Set(value.filter((item) => typeof item === 'string' && ADJECTIVE_SET.has(item)));
  return ADJECTIVES.filter((word) => selected.has(word));
}

function computeQuadrants(selfSelection, peerCounts) {
  const self = new Set(selfSelection);
  const peer = new Set(ADJECTIVES.filter((word) => Number(peerCounts[word]) > 0));
  const open = new Set(ADJECTIVES.filter((word) => self.has(word) && peer.has(word)));
  const blind = new Set(ADJECTIVES.filter((word) => !self.has(word) && peer.has(word)));
  const hidden = new Set(ADJECTIVES.filter((word) => self.has(word) && !peer.has(word)));
  const unknown = new Set(ADJECTIVES.filter((word) => !self.has(word) && !peer.has(word)));
  const all = [...open, ...blind, ...hidden, ...unknown];
  if (all.length !== ADJECTIVES.length || new Set(all).size !== ADJECTIVES.length) {
    throw new Error('Quadrant partition must contain each canonical adjective exactly once.');
  }
  return { open, blind, hidden, unknown };
}

function getEmptyCounts() {
  return Object.fromEntries(ADJECTIVES.map((word) => [word, 0]));
}

function aggregatePeerSelection(assessment, selection) {
  const distinct = normalizeSelection(selection);
  if (distinct.length !== selection.length || distinct.length < 5 || distinct.length > 7) {
    throw new Error('Peer feedback must contain 5 to 7 unique canonical adjectives.');
  }
  distinct.forEach((word) => { assessment.peerCounts[word] += 1; });
  assessment.participantCount += 1;
  assessment.totalPeerSelections += distinct.length;
  assessment.updatedAt = new Date().toISOString();
  return assessment;
}

function submitPeerDraft(assessment, selection) {
  aggregatePeerSelection(assessment, selection);
  return [];
}

function createExportPayload(assessment) {
  return { format: 'johari-classroom', schemaVersion: 1, assessment };
}

function parseImportPayload(payload) {
  if (payload?.format !== 'johari-classroom' || payload?.schemaVersion !== 1) {
    throw new Error('Unsupported Johari Classroom export format.');
  }
  return validateAssessment(payload.assessment);
}

function clearStoredAssessments() {
  localStorage.removeItem(STORAGE_KEY);
}

function validateAssessment(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Assessment data must be an object.');
  if (typeof input.subjectName !== 'string' || !input.subjectName.trim() || input.subjectName.trim().length > 80) {
    throw new Error('Subject name must contain 1 to 80 characters.');
  }
  if (typeof input.title !== 'string' || input.title.length > 120) throw new Error('Assessment title must be 120 characters or fewer.');
  if (!Array.isArray(input.selfSelection) || input.selfSelection.some((word) => !ADJECTIVE_SET.has(word))) {
    throw new Error('Self-assessment contains an invalid adjective.');
  }
  const selfSelection = normalizeSelection(input.selfSelection);
  if (selfSelection.length !== input.selfSelection.length || selfSelection.length < 5 || selfSelection.length > 7) {
    throw new Error('Self-assessment must contain 5 to 7 unique canonical adjectives.');
  }
  if (!input.peerCounts || typeof input.peerCounts !== 'object' || Array.isArray(input.peerCounts)) {
    throw new Error('Peer frequency data is missing or malformed.');
  }
  const keys = Object.keys(input.peerCounts);
  if (keys.length !== ADJECTIVES.length || keys.some((word) => !ADJECTIVE_SET.has(word))) {
    throw new Error('Peer frequency data must contain exactly the 55 canonical adjectives.');
  }
  if (!Number.isSafeInteger(input.participantCount) || input.participantCount < 0 ||
      !Number.isSafeInteger(input.totalPeerSelections) || input.totalPeerSelections < 0) {
    throw new Error('Participant and selection totals must be non-negative whole numbers.');
  }
  let frequencyTotal = 0;
  for (const word of ADJECTIVES) {
    const count = input.peerCounts[word];
    if (!Number.isSafeInteger(count) || count < 0 || count > input.participantCount) {
      throw new Error(`Invalid peer frequency for ${word}.`);
    }
    frequencyTotal += count;
  }
  if (frequencyTotal !== input.totalPeerSelections) throw new Error('Peer frequencies do not match the total peer selections.');
  if ((input.participantCount === 0 && frequencyTotal !== 0) ||
      (input.participantCount > 0 && (frequencyTotal < input.participantCount * 5 || frequencyTotal > input.participantCount * 7))) {
    throw new Error('Peer selection total is inconsistent with the participant count.');
  }
  if (typeof input.createdAt !== 'string' || Number.isNaN(Date.parse(input.createdAt))) throw new Error('Assessment creation date is invalid.');
  if (typeof input.updatedAt !== 'string' || Number.isNaN(Date.parse(input.updatedAt))) throw new Error('Assessment update date is invalid.');
  return {
    id: typeof input.id === 'string' && input.id ? input.id : createId(),
    subjectName: input.subjectName.trim(),
    title: input.title.trim(),
    selfSelection,
    peerCounts: Object.fromEntries(ADJECTIVES.map((word) => [word, input.peerCounts[word]])),
    participantCount: input.participantCount,
    totalPeerSelections: input.totalPeerSelections,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `assessment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadAssessments() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.map(validateAssessment);
  } catch (error) {
    console.warn('Saved assessments could not be loaded.', error);
    return [];
  }
}

const appState = {
  assessments: [],
  activeId: null,
  draftAssessment: null,
  selfDraft: [],
  peerDraft: [],
  selfSearch: '',
  peerSearch: ''
};

function getActiveAssessment() {
  return appState.assessments.find((assessment) => assessment.id === appState.activeId) ||
    (appState.draftAssessment?.id === appState.activeId ? appState.draftAssessment : null);
}

function persistAssessments() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.assessments));
}

function announce(message, type = 'info') {
  const status = document.getElementById('statusMessage');
  if (!status) return;
  status.textContent = message;
  status.dataset.type = type;
  status.hidden = !message;
}

function showView(viewId) {
  document.querySelectorAll('[data-view]').forEach((view) => {
    view.hidden = view.id !== viewId;
  });
  document.querySelectorAll('[data-nav-view]').forEach((link) => {
    link.classList.toggle('active', link.dataset.navView === viewId);
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function toggleDraft(which, word) {
  const key = which === 'self' ? 'selfDraft' : 'peerDraft';
  const draft = new Set(appState[key]);
  if (draft.has(word)) draft.delete(word);
  else if (draft.size < 7) draft.add(word);
  else announce('You can select up to 7 adjectives.', 'error');
  appState[key] = ADJECTIVES.filter((item) => draft.has(item));
  renderSelector(which, word);
}

function renderSelector(which, focusWord) {
  const isSelf = which === 'self';
  const list = document.getElementById(isSelf ? 'selfAdjectives' : 'peerAdjectives');
  const draft = isSelf ? appState.selfDraft : appState.peerDraft;
  const search = (isSelf ? appState.selfSearch : appState.peerSearch).trim().toLowerCase();
  const counter = document.getElementById(isSelf ? 'selfCounter' : 'peerCounter');
  const submit = document.getElementById(isSelf ? 'saveSelf' : 'submitPeer');
  if (!list) return;
  list.replaceChildren();
  let focusTarget = null;
  ADJECTIVES.filter((word) => word.toLowerCase().includes(search)).forEach((word) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `word-option${draft.includes(word) ? ' selected' : ''}`;
    button.textContent = word;
    button.dataset.word = word;
    button.setAttribute('aria-pressed', String(draft.includes(word)));
    button.addEventListener('click', () => toggleDraft(which, word));
    list.appendChild(button);
    if (word === focusWord) focusTarget = button;
  });
  document.getElementById(isSelf ? 'selfSearch' : 'peerSearch').value = isSelf ? appState.selfSearch : appState.peerSearch;
  counter.textContent = `${draft.length} selected`;
  counter.dataset.valid = String(draft.length >= 5 && draft.length <= 7);
  submit.disabled = draft.length < 5 || draft.length > 7;
  focusTarget?.focus();
}

function startAssessment(event) {
  event.preventDefault();
  const subjectName = document.getElementById('subjectName').value.trim();
  const title = document.getElementById('assessmentTitle').value.trim();
  if (!subjectName || subjectName.length > 80 || title.length > 120) {
    announce('Enter a subject name (up to 80 characters) and a title up to 120 characters.', 'error');
    return;
  }
  const now = new Date().toISOString();
  const assessment = {
    id: createId(), subjectName, title, selfSelection: [], peerCounts: getEmptyCounts(),
    participantCount: 0, totalPeerSelections: 0, createdAt: now, updatedAt: now
  };
  appState.draftAssessment = assessment;
  appState.activeId = assessment.id;
  appState.selfDraft = [];
  appState.peerDraft = [];
  renderAll();
  announce('Assessment created. The subject can now make a private self-selection.', 'success');
  showView('selfView');
}

function saveSelfAssessment() {
  const assessment = getActiveAssessment();
  if (!assessment || appState.selfDraft.length < 5 || appState.selfDraft.length > 7) return;
  assessment.selfSelection = [...appState.selfDraft];
  assessment.updatedAt = new Date().toISOString();
  if (appState.draftAssessment?.id === assessment.id) {
    appState.assessments.unshift(assessment);
    appState.draftAssessment = null;
  }
  persistAssessments();
  appState.peerDraft = [];
  renderAll();
  showView('peerView');
  announce('Self-assessment saved. Peer selections are not revealed during the activity.', 'success');
}

function submitPeerFeedback() {
  const assessment = getActiveAssessment();
  if (!assessment || appState.peerDraft.length < 5 || appState.peerDraft.length > 7) return;
  appState.peerDraft = submitPeerDraft(assessment, appState.peerDraft);
  appState.peerSearch = '';
  persistAssessments();
  renderAll();
  showView('peerView');
  announce(`Feedback added to aggregate totals for participant ${assessment.participantCount}. The next participant has a blank selection.`, 'success');
}

function renderResults() {
  const assessment = getActiveAssessment();
  if (!assessment) return;
  const quadrants = computeQuadrants(assessment.selfSelection, assessment.peerCounts);
  document.getElementById('resultsSubject').textContent = assessment.subjectName;
  document.getElementById('resultsTitle').textContent = assessment.title || 'Johari Window results';
  document.getElementById('resultsParticipants').textContent = String(assessment.participantCount);
  document.getElementById('resultsSelections').textContent = String(assessment.totalPeerSelections);
  const totalWords = assessment.participantCount * 5;
  document.getElementById('resultsSummary').textContent = assessment.participantCount === 0
    ? 'No peer feedback has been submitted yet. All self-selected words remain in Hidden, and the remaining words are Unknown.'
    : `${assessment.participantCount} participant${assessment.participantCount === 1 ? '' : 's'} contributed ${assessment.totalPeerSelections} selections. Peer frequencies show how many participants selected each word; any positive frequency counts as recognized.`;
  QUADRANTS.forEach((key) => {
    const info = QUADRANT_INFO[key];
    const list = document.getElementById(`${key}Words`);
    list.replaceChildren();
    const words = [...quadrants[key]];
    document.getElementById(`${key}Count`).textContent = String(words.length);
    if (!words.length) {
      const empty = document.createElement('li');
      empty.className = 'word-empty';
      empty.textContent = 'No adjectives in this quadrant yet';
      list.appendChild(empty);
    }
    words.forEach((word) => {
      const item = document.createElement('li');
      item.className = 'result-word';
      const label = document.createElement('span');
      label.textContent = word;
      item.appendChild(label);
      if ((key === 'open' || key === 'blind') && assessment.peerCounts[word] > 0) {
        const frequency = document.createElement('span');
        frequency.className = 'frequency';
        frequency.textContent = `${assessment.peerCounts[word]} peer${assessment.peerCounts[word] === 1 ? '' : 's'}`;
        item.appendChild(frequency);
      }
      list.appendChild(item);
    });
    document.querySelector(`[data-quadrant-note="${key}"]`).textContent = info.note;
  });
  const counts = ADJECTIVES.filter((word) => assessment.peerCounts[word] > 0)
    .sort((a, b) => assessment.peerCounts[b] - assessment.peerCounts[a] || ADJECTIVES.indexOf(a) - ADJECTIVES.indexOf(b));
  const frequencyList = document.getElementById('frequencyList');
  frequencyList.replaceChildren();
  if (!counts.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Frequencies will appear here after the first peer submits.';
    frequencyList.appendChild(empty);
  }
  counts.forEach((word) => {
    const row = document.createElement('div');
    row.className = 'frequency-row';
    const label = document.createElement('span');
    label.textContent = word;
    const amount = document.createElement('strong');
    amount.textContent = `${assessment.peerCounts[word]} / ${assessment.participantCount}`;
    row.append(label, amount);
    frequencyList.appendChild(row);
  });
  document.getElementById('resultInvariant').textContent = `${[...quadrants.open, ...quadrants.blind, ...quadrants.hidden, ...quadrants.unknown].length} of 55 adjectives are classified exactly once.`;
  document.getElementById('peerTotalSummary').textContent = `${totalWords} minimum possible peer selections at this response count.`;
}

function renderSavedList() {
  const list = document.getElementById('savedAssessments');
  list.replaceChildren();
  if (!appState.assessments.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No saved assessments on this device yet.';
    list.appendChild(empty);
    return;
  }
  appState.assessments.forEach((assessment) => {
    const row = document.createElement('article');
    row.className = `saved-assessment${assessment.id === appState.activeId ? ' current' : ''}`;
    const details = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = assessment.title || assessment.subjectName;
    const meta = document.createElement('p');
    meta.textContent = `${assessment.subjectName} · ${assessment.participantCount} peer responses · Updated ${new Date(assessment.updatedAt).toLocaleDateString()}`;
    details.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'saved-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'text-button';
    open.textContent = 'Open';
    open.addEventListener('click', () => {
      appState.activeId = assessment.id;
      appState.peerDraft = [];
      renderAll();
      showView(assessment.selfSelection.length ? 'resultsView' : 'selfView');
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button danger-text';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteAssessment(assessment.id));
    actions.append(open, remove);
    row.append(details, actions);
    list.appendChild(row);
  });
}

function renderAll() {
  const assessment = getActiveAssessment();
  const activeLabel = assessment ? `${assessment.title || assessment.subjectName} · ${assessment.subjectName}` : 'No assessment selected';
  document.querySelectorAll('[data-active-assessment]').forEach((element) => { element.textContent = activeLabel; });
  document.getElementById('peerSubjectName').textContent = assessment?.subjectName || 'the subject';
  document.getElementById('peerParticipantCount').textContent = String(assessment?.participantCount || 0);
  renderSelector('self');
  renderSelector('peer');
  if (assessment?.selfSelection.length) renderResults();
  renderSavedList();
  document.getElementById('exportAssessment').disabled = !assessment;
  document.getElementById('goToResults').disabled = !assessment?.selfSelection.length;
  document.getElementById('goToPeers').disabled = !assessment?.selfSelection.length;
}

function deleteAssessment(id) {
  const target = appState.assessments.find((assessment) => assessment.id === id);
  if (!target || !window.confirm(`Permanently delete the assessment for ${target.subjectName} from this browser?`)) return;
  appState.assessments = appState.assessments.filter((assessment) => assessment.id !== id);
  if (appState.draftAssessment?.id === id) appState.draftAssessment = null;
  if (appState.activeId === id) appState.activeId = appState.assessments[0]?.id || null;
  appState.selfDraft = [];
  appState.peerDraft = [];
  if (appState.assessments.length) persistAssessments();
  else clearStoredAssessments();
  renderAll();
  showView(appState.activeId ? (getActiveAssessment().selfSelection.length ? 'resultsView' : 'setupView') : 'setupView');
  announce('Assessment deleted from this device.', 'success');
}

function clearAssessments() {
  if (!appState.assessments.length) return announce('There are no saved assessments to clear.');
  if (!window.confirm('Delete every saved assessment from this browser? This cannot be undone.')) return;
  appState.assessments = [];
  appState.activeId = null;
  appState.draftAssessment = null;
  appState.selfDraft = [];
  appState.peerDraft = [];
  clearStoredAssessments();
  renderAll();
  showView('setupView');
  announce('All saved assessments have been deleted from this device.', 'success');
}

function exportAssessment() {
  const assessment = getActiveAssessment();
  if (!assessment) return announce('Select an assessment to export.', 'error');
  const payload = createExportPayload(assessment);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `johari-${assessment.subjectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
  announce('Aggregate assessment JSON exported. No individual peer responses are included.', 'success');
}

function importAssessment(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result));
      const assessment = parseImportPayload(payload);
      assessment.id = createId();
      appState.assessments.unshift(assessment);
      appState.activeId = assessment.id;
      appState.draftAssessment = null;
      appState.selfDraft = [];
      appState.peerDraft = [];
      persistAssessments();
      renderAll();
      showView('resultsView');
      announce('Assessment imported and validated. Peer data contains aggregate frequencies only.', 'success');
    } catch (error) {
      announce(`Import failed: ${error.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.onerror = () => announce('Import failed: the selected file could not be read.', 'error');
  reader.readAsText(file);
}

function initApp() {
  appState.assessments = loadAssessments();
  appState.activeId = appState.assessments[0]?.id || null;
  document.getElementById('newAssessmentForm').addEventListener('submit', startAssessment);
  document.getElementById('saveSelf').addEventListener('click', saveSelfAssessment);
  document.getElementById('submitPeer').addEventListener('click', submitPeerFeedback);
  document.getElementById('clearPeerDraft').addEventListener('click', () => {
    appState.peerDraft = [];
    appState.peerSearch = '';
    renderSelector('peer');
    announce('Temporary peer selections cleared.');
  });
  document.getElementById('selfSearch').addEventListener('input', (event) => { appState.selfSearch = event.target.value; renderSelector('self'); });
  document.getElementById('peerSearch').addEventListener('input', (event) => { appState.peerSearch = event.target.value; renderSelector('peer'); });
  document.getElementById('goToResults').addEventListener('click', () => { renderResults(); showView('resultsView'); });
  document.getElementById('goToPeers').addEventListener('click', () => { appState.peerDraft = []; renderSelector('peer'); showView('peerView'); });
  document.getElementById('exportAssessment').addEventListener('click', exportAssessment);
  document.getElementById('importFile').addEventListener('change', importAssessment);
  document.getElementById('clearAllAssessments').addEventListener('click', clearAssessments);
  document.getElementById('printResults').addEventListener('click', () => window.print());
  document.querySelectorAll('[data-nav-view]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    if (link.dataset.navView === 'resultsView' && !getActiveAssessment()?.selfSelection.length) {
      announce('Complete the self-assessment before viewing results.', 'error');
      return;
    }
    if (link.dataset.navView === 'peerView' && !getActiveAssessment()?.selfSelection.length) {
      announce('Complete the self-assessment before collecting peer feedback.', 'error');
      return;
    }
    if (link.dataset.navView === 'selfView') {
      appState.selfDraft = [...(getActiveAssessment()?.selfSelection || [])];
      renderSelector('self');
    }
    showView(link.dataset.navView);
  }));
  document.getElementById('subjectName').addEventListener('input', (event) => {
    document.getElementById('subjectNameCount').textContent = `${event.target.value.length} / 80`;
  });
  renderAll();
  const active = getActiveAssessment();
  showView(active?.selfSelection.length ? 'resultsView' : 'setupView');
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initApp);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ADJECTIVES, STORAGE_KEY, aggregatePeerSelection, appState, clearStoredAssessments,
    computeQuadrants, createExportPayload, getEmptyCounts, loadAssessments,
    normalizeSelection, parseImportPayload, persistAssessments, submitPeerDraft, validateAssessment
  };
}
