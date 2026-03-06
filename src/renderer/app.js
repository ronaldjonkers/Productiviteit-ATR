document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const btnSelectFile = document.getElementById('btn-select-file');
  const uploadStatus = document.getElementById('upload-status');
  const statusMessage = document.getElementById('status-message');
  const statusIcon = document.getElementById('status-icon');
  const yearSelect = document.getElementById('year-select');
  const btnDownload = document.getElementById('btn-download');
  const loadingOverlay = document.getElementById('loading-overlay');
  const statMedewerkers = document.getElementById('stat-medewerkers');
  const statJaren = document.getElementById('stat-jaren');
  const statUploads = document.getElementById('stat-uploads');
  const medewerkersTbody = document.getElementById('medewerkers-tbody');
  const medewerkersSection = document.getElementById('medewerkers-section');
  const historyTbody = document.getElementById('history-tbody');
  const historySection = document.getElementById('history-section');

  // --- Drag and Drop ---
  dropzone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropzone.contains(e.relatedTarget)) {
      dropzone.classList.remove('drag-over');
    }
  });

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        await processFile(file.path);
      } else {
        showStatus('Alleen .xlsx bestanden worden ondersteund.', false);
      }
    }
  });

  // --- File Select Button ---
  btnSelectFile.addEventListener('click', async (e) => {
    e.stopPropagation();
    const filePath = await window.api.selectFile();
    if (filePath) {
      await processFile(filePath);
    }
  });

  // Clicking the dropzone also opens file dialog
  dropzone.addEventListener('click', async (e) => {
    if (e.target === btnSelectFile || btnSelectFile.contains(e.target)) return;
    const filePath = await window.api.selectFile();
    if (filePath) {
      await processFile(filePath);
    }
  });

  // --- Process File ---
  async function processFile(filePath) {
    showLoading(true);
    hideStatus();

    const result = await window.api.uploadRapportage(filePath);

    showLoading(false);

    if (result.success) {
      showStatus(result.message, true);
    } else {
      showStatus(result.error, false);
    }

    await refreshDashboard();
  }

  // --- Download ---
  btnDownload.addEventListener('click', async () => {
    const jaar = parseInt(yearSelect.value, 10);
    if (!jaar) return;

    showLoading(true);
    const result = await window.api.downloadExcel(jaar);
    showLoading(false);

    if (result.success) {
      showStatus(result.message, true);
    } else if (result.error !== 'Opslaan geannuleerd.') {
      showStatus(result.error, false);
    }
  });

  // --- UI Helpers ---
  function showStatus(message, isSuccess) {
    uploadStatus.style.display = 'flex';
    uploadStatus.className = `upload-status ${isSuccess ? 'success' : 'error'}`;
    statusIcon.innerHTML = isSuccess
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    statusMessage.textContent = message;
  }

  function hideStatus() {
    uploadStatus.style.display = 'none';
  }

  function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  // --- Dashboard Refresh ---
  async function refreshDashboard() {
    const status = await window.api.getStatus();
    if (!status.success) return;

    const { medewerkers, years, history } = status;

    // Stats
    statMedewerkers.textContent = medewerkers.length;
    statJaren.textContent = years.length;
    statUploads.textContent = history.length;

    // Year selector
    yearSelect.innerHTML = '';
    if (years.length === 0) {
      yearSelect.innerHTML = '<option value="">Geen data</option>';
      btnDownload.disabled = true;
    } else {
      for (const y of years) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      }
      btnDownload.disabled = false;
    }

    // Medewerkers table with editable contracturen
    if (medewerkers.length > 0) {
      medewerkersSection.style.display = 'block';
      medewerkersTbody.innerHTML = '';
      for (const mw of medewerkers) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${mw.medewerker_id}</td>
          <td>${mw.naam}</td>
          <td>
            <input type="number" class="contract-input" 
              value="${mw.contract_uren}" 
              data-id="${mw.medewerker_id}" 
              min="0" max="60" step="0.5">
          </td>
          <td class="save-indicator" id="save-${mw.medewerker_id}"></td>
        `;
        medewerkersTbody.appendChild(tr);
      }

      // Attach auto-save listeners to all contract inputs
      document.querySelectorAll('.contract-input').forEach(input => {
        let saveTimeout;
        input.addEventListener('input', () => {
          const id = parseInt(input.dataset.id, 10);
          const indicator = document.getElementById(`save-${id}`);
          indicator.textContent = '';
          indicator.className = 'save-indicator';

          clearTimeout(saveTimeout);
          saveTimeout = setTimeout(async () => {
            const value = parseFloat(input.value);
            if (isNaN(value) || value < 0) return;
            const result = await window.api.updateContractUren(id, value);
            if (result.success) {
              indicator.textContent = 'Opgeslagen';
              indicator.className = 'save-indicator saved';
              setTimeout(() => { indicator.textContent = ''; indicator.className = 'save-indicator'; }, 2000);
            }
          }, 400);
        });
      });
    } else {
      medewerkersSection.style.display = 'none';
    }

    // Upload history
    if (history.length > 0) {
      historySection.style.display = 'block';
      historyTbody.innerHTML = '';
      for (const h of history) {
        const tr = document.createElement('tr');
        const typeLabel = h.type === 'rapportage' ? 'Rapportage' : 'Productiviteit';
        tr.innerHTML = `
          <td>${h.upload_datum}</td>
          <td>${h.bestandsnaam}</td>
          <td>${typeLabel}</td>
          <td>${h.aantal_rijen}</td>
        `;
        historyTbody.appendChild(tr);
      }
    } else {
      historySection.style.display = 'none';
    }
  }

  // --- Update Logic ---
  const btnCheckUpdate = document.getElementById('btn-check-update');
  const btnInstallUpdate = document.getElementById('btn-install-update');
  const updateMessage = document.getElementById('update-message');
  const appVersion = document.getElementById('app-version');

  btnCheckUpdate.addEventListener('click', async () => {
    btnCheckUpdate.disabled = true;
    btnCheckUpdate.textContent = 'Controleren...';
    updateMessage.textContent = 'Bezig met controleren...';
    updateMessage.className = 'card-desc update-desc';

    const result = await window.api.checkForUpdates();

    btnCheckUpdate.disabled = false;
    btnCheckUpdate.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Controleer';
    updateMessage.textContent = result.message;

    if (result.success && !result.upToDate) {
      btnInstallUpdate.style.display = 'inline-flex';
      updateMessage.className = 'card-desc update-desc update-available';
    } else {
      btnInstallUpdate.style.display = 'none';
      updateMessage.className = 'card-desc update-desc ' + (result.success ? 'update-ok' : 'update-error');
    }
  });

  btnInstallUpdate.addEventListener('click', async () => {
    btnInstallUpdate.disabled = true;
    btnInstallUpdate.textContent = 'Installeren...';
    updateMessage.textContent = 'Update wordt gedownload en geïnstalleerd. Even geduld...';
    showLoading(true);

    const result = await window.api.installUpdate();

    showLoading(false);
    updateMessage.textContent = result.message;

    if (result.success) {
      updateMessage.className = 'card-desc update-desc update-ok';
      btnInstallUpdate.style.display = 'none';
      // Auto-restart after 2 seconds
      setTimeout(() => window.api.restartApp(), 2000);
    } else {
      updateMessage.className = 'card-desc update-desc update-error';
      btnInstallUpdate.disabled = false;
      btnInstallUpdate.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Update installeren';
    }
  });

  // Load version
  async function loadVersion() {
    const result = await window.api.getAppVersion();
    appVersion.textContent = `v${result.version}`;
  }

  // Initial load
  refreshDashboard();
  loadVersion();
});
