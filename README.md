# Johari Classroom

A lightweight, browser-only classroom activity for exploring the Johari Window. It uses HTML, CSS, vanilla JavaScript, and LocalStorage; there is no account, backend, or external dependency.

## Run

Open `index.html` in a browser, or serve this folder locally:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

Run the automated checks with `npm test` (Node.js required).

## Classroom Flow

1. Enter the subject’s name and an optional assessment title.
2. The subject chooses 5–7 words from the canonical bank.
3. Peers take turns on the same device, choosing 5–7 words each.
4. Review the four quadrants, peer totals, and adjective frequencies.

The vocabulary matches the linked reference project’s 55-word workshop bank, including its original spelling `Lamed`.

## Data and Privacy

Assessments are saved in the current browser’s LocalStorage and do not synchronize across browsers or devices. Each submitted peer turn updates only aggregate adjective counts and totals; individual peer combinations and participant names are not stored. A participant’s temporary selection is held in memory and cleared after submission. Exported JSON contains the self-assessment and aggregate results only. Treat shared-device access and browser storage accordingly; this app does not claim encryption or server-side anonymity.

Imported files are checked for the supported format, exact canonical adjective keys, valid selection counts, and internally consistent peer totals. Print the results view or choose Save as PDF in the browser’s print dialog.

This activity supports discussion and reflection; it is not a diagnostic instrument.
