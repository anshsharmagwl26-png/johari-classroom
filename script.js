const ADJECTIVES = [
  { id: 'able', adjective: 'Able' },
  { id: 'acceptable', adjective: 'Acceptable' },
  { id: 'adaptable', adjective: 'Adaptable' },
  { id: 'bold', adjective: 'Bold' },
  { id: 'brave', adjective: 'Brave' },
  { id: 'calm', adjective: 'Calm' },
  { id: 'caring', adjective: 'Caring' },
  { id: 'cheerful', adjective: 'Cheerful' },
  { id: 'clever', adjective: 'Clever' },
  { id: 'complex', adjective: 'Complex' },
  { id: 'confident', adjective: 'Confident' },
  { id: 'dependable', adjective: 'Dependable' },
  { id: 'dignified', adjective: 'Dignified' },
  { id: 'energetic', adjective: 'Energetic' },
  { id: 'extroverted', adjective: 'Extroverted' },
  { id: 'friendly', adjective: 'Friendly' },
  { id: 'giving', adjective: 'Giving' },
  { id: 'happy', adjective: 'Happy' },
  { id: 'helpful', adjective: 'Helpful' },
  { id: 'idealistic', adjective: 'Idealistic' },
  { id: 'independent', adjective: 'Independent' },
  { id: 'ingenious', adjective: 'Ingenious' },
  { id: 'intelligent', adjective: 'Intelligent' },
  { id: 'introverted', adjective: 'Introverted' },
  { id: 'kind', adjective: 'Kind' },
  { id: 'knowledgeable', adjective: 'Knowledgeable' },
  { id: 'lamed', adjective: 'Lamed' },
  { id: 'liberal', adjective: 'Liberal' },
  { id: 'lively', adjective: 'Lively' },
  { id: 'logical', adjective: 'Logical' },
  { id: 'loving', adjective: 'Loving' },
  { id: 'mature', adjective: 'Mature' },
  { id: 'modest', adjective: 'Modest' },
  { id: 'nervous', adjective: 'Nervous' },
  { id: 'observant', adjective: 'Observant' },
  { id: 'organized', adjective: 'Organized' },
  { id: 'patient', adjective: 'Patient' },
  { id: 'proud', adjective: 'Proud' },
  { id: 'quiet', adjective: 'Quiet' },
  { id: 'reflective', adjective: 'Reflective' },
  { id: 'religious', adjective: 'Religious' },
  { id: 'responsive', adjective: 'Responsive' },
  { id: 'searching', adjective: 'Searching' },
  { id: 'self-assertive', adjective: 'Self-assertive' },
  { id: 'self-conscious', adjective: 'Self-conscious' },
  { id: 'sensible', adjective: 'Sensible' },
  { id: 'sentimental', adjective: 'Sentimental' },
  { id: 'shy', adjective: 'Shy' },
  { id: 'smart', adjective: 'Smart' },
  { id: 'spontaneous', adjective: 'Spontaneous' },
  { id: 'tense', adjective: 'Tense' },
  { id: 'trustworthy', adjective: 'Trustworthy' },
  { id: 'warm', adjective: 'Warm' },
  { id: 'wise', adjective: 'Wise' },
  { id: 'witty', adjective: 'Witty' }
];

const ADJECTIVE_LABELS = ADJECTIVES.map((item) => item.adjective);
const ADJECTIVE_SET = new Set(ADJECTIVE_LABELS.map((label) => label.toLowerCase()));
const ADJECTIVE_ORDER = new Map(ADJECTIVES.map((item, index) => [item.adjective.toLowerCase(), index]));
const STORAGE_KEY = 'johari-classroom-state-v1';

const defaultAppState = {
  selfSelection: [],
  participantSelection: [],
  participantHistory: [],
  latestComparison: null
};

function normalizeSelection(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const set = new Set();
  value.forEach((item) => {
    if (typeof item === 'string' && ADJECTIVE_SET.has(item.trim().toLowerCase())) {
      set.add(item.trim());
    }
  });

  return Array.from(set).sort((a, b) => ADJECTIVE_ORDER.get(a.toLowerCase()) - ADJECTIVE_ORDER.get(b.toLowerCase()));
}

function getStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultAppState };
    }

    const parsed = JSON.parse(raw);
    return {
      selfSelection: normalizeSelection(parsed.selfSelection),
      participantSelection: normalizeSelection(parsed.participantSelection),
      participantHistory: Array.isArray(parsed.participantHistory) ? parsed.participantHistory.map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id : String(Date.now() + Math.random()),
        participant: normalizeSelection(entry.participant),
        submittedAt: typeof entry.submittedAt === 'string' ? entry.submittedAt : new Date().toISOString()
      })) : [],
      latestComparison: parsed.latestComparison && Array.isArray(parsed.latestComparison)
        ? normalizeSelection(parsed.latestComparison)
        : null
    };
  } catch (error) {
    console.warn('Unable to read saved Johari Classroom data.', error);
    return { ...defaultAppState };
  }
}

function persistState(state) {
  const payload = {
    selfSelection: state.selfSelection,
    participantSelection: state.participantSelection,
    participantHistory: state.participantHistory,
    latestComparison: state.latestComparison
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function sortSelection(selection) {
  return [...selection].sort((a, b) => ADJECTIVE_ORDER.get(a.toLowerCase()) - ADJECTIVE_ORDER.get(b.toLowerCase()));
}

function buildSelectionSet(selection) {
  return new Set(selection.map((value) => value.trim()));
}

function computeQuadrants(selfSelection, participantSelection) {
  const selfSet = buildSelectionSet(selfSelection);
  const participantSet = buildSelectionSet(participantSelection);
  const allLabels = ADJECTIVE_LABELS;

  const open = new Set(allLabels.filter((label) => selfSet.has(label) && participantSet.has(label)));
  const blind = new Set(allLabels.filter((label) => !selfSet.has(label) && participantSet.has(label)));
  const hidden = new Set(allLabels.filter((label) => selfSet.has(label) && !participantSet.has(label)));
  const unknown = new Set(allLabels.filter((label) => !selfSet.has(label) && !participantSet.has(label)));

  const allQuadrantValues = [...open, ...blind, ...hidden, ...unknown];
  const totalCount = allQuadrantValues.length;

  if (totalCount !== ADJECTIVE_LABELS.length) {
    throw new Error('Quadrant totals do not match the canonical 55 adjectives.');
  }

  return { open, blind, hidden, unknown };
}

function getFrequencyCounts(history) {
  const counts = new Map(ADJECTIVE_LABELS.map((label) => [label, 0]));

  history.forEach((entry) => {
    if (!Array.isArray(entry.participant)) {
      return;
    }

    const uniqueSet = new Set();
    entry.participant.forEach((label) => {
      if (ADJECTIVE_SET.has(label.toLowerCase())) {
        uniqueSet.add(label);
      }
    });

    uniqueSet.forEach((label) => {
      counts.set(label, (counts.get(label) || 0) + 1);
    });
  });

  return counts;
}

function createChipButton(label, isSelected, onToggle) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `adjective-chip${isSelected ? ' selected' : ''}`;
  button.textContent = label;
  button.setAttribute('aria-pressed', String(isSelected));
  button.addEventListener('click', () => onToggle(label));
  return button;
}

function renderSelectionChips(containerId, selection, onToggle) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const currentSet = new Set(selection);
  container.innerHTML = '';

  ADJECTIVE_LABELS.forEach((label) => {
    const chip = createChipButton(label, currentSet.has(label), onToggle);
    container.appendChild(chip);
  });
}

function renderSelectionMeta(elementId, label, selectionCount) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.textContent = `${label} ${selectionCount} of 5–7 adjectives`;
}

function updateSelectionMeta() {
  renderSelectionMeta('selfSelectionMeta', 'Selected', state.selfSelection.length);
  renderSelectionMeta('participantSelectionMeta', 'Selected', state.participantSelection.length);
}

function updateSavedAssessments() {
  const savedList = document.getElementById('savedAssessmentList');
  if (!savedList) {
    return;
  }

  if (!state.participantHistory.length) {
    savedList.innerHTML = '<div class="empty-state">No saved classroom feedback yet.</div>';
    return;
  }

  savedList.innerHTML = '';

  state.participantHistory
    .slice()
    .reverse()
    .forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'saved-card';

      const left = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = 'Participant submission';
      const meta = document.createElement('p');
      meta.textContent = new Date(entry.submittedAt).toLocaleString();

      const badges = document.createElement('div');
      badges.className = 'saved-badges';
      badges.innerHTML = `
        <span>Self: ${entry.self.length}</span>
        <span>Peer: ${entry.participant.length}</span>
      `;

      left.appendChild(title);
      left.appendChild(meta);
      left.appendChild(badges);
      card.appendChild(left);

      const list = document.createElement('div');
      list.className = 'saved-badges';
      const peerValues = entry.participant.length ? entry.participant.join(', ') : 'No adjectives';
      list.innerHTML = `<span>${peerValues}</span>`;
      card.appendChild(list);

      savedList.appendChild(card);
    });
}

function renderFrequencyCounts() {
  const frequencyContainer = document.getElementById('frequencyList');
  if (!frequencyContainer) {
    return;
  }

  const counts = getFrequencyCounts(state.participantHistory);
  const sortedEntries = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return ADJECTIVE_ORDER.get(a[0].toLowerCase()) - ADJECTIVE_ORDER.get(b[0].toLowerCase());
    });

  if (!sortedEntries.length) {
    frequencyContainer.innerHTML = '<div class="empty-state">No participant feedback yet.</div>';
    return;
  }

  frequencyContainer.innerHTML = '';
  sortedEntries.forEach(([label, count]) => {
    const item = document.createElement('div');
    item.className = 'frequency-item';
    item.innerHTML = `<strong>${label}</strong><span>${count}</span>`;
    frequencyContainer.appendChild(item);
  });
}

function renderMostSelected() {
  const target = document.getElementById('topWord');
  if (!target) {
    return;
  }

  const counts = getFrequencyCounts(state.participantHistory);
  const entries = Array.from(counts.entries()).filter(([, count]) => count > 0);

  if (!entries.length) {
    target.textContent = '—';
    return;
  }

  entries.sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return ADJECTIVE_ORDER.get(a[0].toLowerCase()) - ADJECTIVE_ORDER.get(b[0].toLowerCase());
  });

  target.textContent = entries[0][0];
}

function renderQuadrantsFromSelection(selfSelection, participantSelection) {
  if (!selfSelection.length && !participantSelection.length) {
    const emptySet = new Set(ADJECTIVE_LABELS);
    const counts = { open: 0, blind: 0, hidden: 0, unknown: ADJECTIVE_LABELS.length };
    document.getElementById('openCount').textContent = String(counts.open);
    document.getElementById('blindCount').textContent = String(counts.blind);
    document.getElementById('hiddenCount').textContent = String(counts.hidden);
    document.getElementById('unknownCount').textContent = String(counts.unknown);
    document.getElementById('openList').innerHTML = '<li>None</li>';
    document.getElementById('blindList').innerHTML = '<li>None</li>';
    document.getElementById('hiddenList').innerHTML = '<li>None</li>';
    document.getElementById('unknownList').innerHTML = ADJECTIVE_LABELS.map((label) => `<li>${label}</li>`).join('');
    return;
  }

  const quadrants = computeQuadrants(selfSelection, participantSelection);
  const quadrantEntries = [
    ['open', quadrants.open, 'openList', 'openCount'],
    ['blind', quadrants.blind, 'blindList', 'blindCount'],
    ['hidden', quadrants.hidden, 'hiddenList', 'hiddenCount'],
    ['unknown', quadrants.unknown, 'unknownList', 'unknownCount']
  ];

  quadrantEntries.forEach(([key, set, listId, countId]) => {
    const listElement = document.getElementById(listId);
    const countElement = document.getElementById(countId);
    const sortedValues = Array.from(set).sort((a, b) => ADJECTIVE_ORDER.get(a.toLowerCase()) - ADJECTIVE_ORDER.get(b.toLowerCase()));

    countElement.textContent = String(sortedValues.length);
    listElement.innerHTML = sortedValues.length
      ? sortedValues.map((label) => `<li>${label}</li>`).join('')
      : '<li>None</li>';
  });
}

function renderAllResults() {
  const comparison = state.latestComparison || (state.selfSelection.length ? state.selfSelection : []);
  const participantSet = comparison && Array.isArray(comparison) && comparison.length ? comparison : [];
  renderQuadrantsFromSelection(state.selfSelection, participantSet);
  renderFrequencyCounts();
  renderMostSelected();
}

function toggleSelection(target, value) {
  const currentValues = new Set(target);
  if (currentValues.has(value)) {
    currentValues.delete(value);
  } else {
    currentValues.add(value);
  }

  return sortSelection(Array.from(currentValues));
}

function validateSelectionLength(selection, errorMessage) {
  if (selection.length < 5 || selection.length > 7) {
    window.alert(errorMessage);
    return false;
  }

  return true;
}

function saveSelfSelection() {
  if (!validateSelectionLength(state.selfSelection, 'Self-assessment must include between 5 and 7 adjectives.')) {
    return;
  }

  state.selfSelection = sortSelection(state.selfSelection);
  persistState(state);
  renderAllResults();
  window.alert('Self-assessment saved locally in this browser.');
}

function submitParticipantFeedback() {
  if (!validateSelectionLength(state.participantSelection, 'Participant feedback must include between 5 and 7 adjectives.')) {
    return;
  }

  const entry = {
    id: `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    self: sortSelection(state.selfSelection),
    participant: sortSelection(state.participantSelection),
    submittedAt: new Date().toISOString()
  };

  state.participantHistory.push(entry);
  state.latestComparison = entry.participant;
  state.participantSelection = [];
  persistState(state);

  updateSelectionMeta();
  renderSelectionChips('participant-chips', state.participantSelection, handleParticipantChipToggle);
  renderAllResults();
  updateSavedAssessments();
  renderFrequencyCounts();
  renderMostSelected();
}

function handleSelfChipToggle(label) {
  state.selfSelection = toggleSelection(state.selfSelection, label);
  updateSelectionMeta();
  renderSelectionChips('self-chips', state.selfSelection, handleSelfChipToggle);
  persistState(state);
}

function handleParticipantChipToggle(label) {
  state.participantSelection = toggleSelection(state.participantSelection, label);
  updateSelectionMeta();
  renderSelectionChips('participant-chips', state.participantSelection, handleParticipantChipToggle);
  persistState(state);
}

function clearSelfSelection() {
  state.selfSelection = [];
  persistState(state);
  updateSelectionMeta();
  renderSelectionChips('self-chips', state.selfSelection, handleSelfChipToggle);
  renderAllResults();
}

function clearParticipantSelection() {
  state.participantSelection = [];
  persistState(state);
  updateSelectionMeta();
  renderSelectionChips('participant-chips', state.participantSelection, handleParticipantChipToggle);
}

function clearSavedAssessments() {
  const confirmed = window.confirm('Clear all locally saved assessments and participant data from this browser?');
  if (!confirmed) {
    return;
  }

  state.selfSelection = [];
  state.participantSelection = [];
  state.participantHistory = [];
  state.latestComparison = null;
  localStorage.removeItem(STORAGE_KEY);

  updateSelectionMeta();
  renderSelectionChips('self-chips', state.selfSelection, handleSelfChipToggle);
  renderSelectionChips('participant-chips', state.participantSelection, handleParticipantChipToggle);
  renderAllResults();
  updateSavedAssessments();
  renderFrequencyCounts();
  renderMostSelected();
  document.getElementById('participantCount').textContent = '0';
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    selfSelection: state.selfSelection,
    participantHistory: state.participantHistory,
    latestComparison: state.latestComparison
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'johari-classroom-export.json';
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('The uploaded file is not a valid JSON object.');
      }

      state.selfSelection = normalizeSelection(parsed.selfSelection);
      state.participantHistory = Array.isArray(parsed.participantHistory) ? parsed.participantHistory.map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id : String(Date.now() + Math.random()),
        self: normalizeSelection(entry.self),
        participant: normalizeSelection(entry.participant),
        submittedAt: typeof entry.submittedAt === 'string' ? entry.submittedAt : new Date().toISOString()
      })) : [];
      state.latestComparison = Array.isArray(parsed.latestComparison) ? normalizeSelection(parsed.latestComparison) : null;
      state.participantSelection = [];
      persistState(state);
      updateSelectionMeta();
      renderSelectionChips('self-chips', state.selfSelection, handleSelfChipToggle);
      renderSelectionChips('participant-chips', state.participantSelection, handleParticipantChipToggle);
      renderAllResults();
      updateSavedAssessments();
      renderFrequencyCounts();
      renderMostSelected();
      document.getElementById('participantCount').textContent = String(state.participantHistory.length);
      window.alert('Assessment data imported successfully.');
    } catch (error) {
      console.error(error);
      window.alert('Import failed. Please choose a valid Johari Classroom JSON export.');
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsText(file);
}

function handlePrintReport() {
  window.print();
}

function initApp() {
  const savedState = getStoredState();
  Object.assign(state, savedState);

  renderSelectionChips('self-chips', state.selfSelection, handleSelfChipToggle);
  renderSelectionChips('participant-chips', state.participantSelection, handleParticipantChipToggle);
  updateSelectionMeta();
  renderAllResults();
  updateSavedAssessments();
  renderFrequencyCounts();
  renderMostSelected();

  document.getElementById('participantCount').textContent = String(state.participantHistory.length);

  document.getElementById('saveSelfAssessment').addEventListener('click', saveSelfSelection);
  document.getElementById('clearSelfSelection').addEventListener('click', clearSelfSelection);
  document.getElementById('submitParticipant').addEventListener('click', submitParticipantFeedback);
  document.getElementById('clearParticipant').addEventListener('click', clearParticipantSelection);
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importFile').addEventListener('change', importData);
  document.getElementById('clearSavedAssessments').addEventListener('click', clearSavedAssessments);
  document.getElementById('printReport').addEventListener('click', handlePrintReport);
  document.getElementById('scrollToResults').addEventListener('click', () => {
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

const state = { ...defaultAppState };

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initApp);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ADJECTIVES,
    ADJECTIVE_LABELS,
    computeQuadrants,
    getFrequencyCounts,
    normalizeSelection,
    state
  };
}
