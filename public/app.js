/**
 * Excelficator - Client Application
 * Handles file drag & drop, upload, image cropping, filter configuration, and result display
 */

class Excelficator {
    constructor() {
        this.files = [];
        this.croppedFiles = new Map();
        this.currentCropIndex = -1;
        this.cropSelection = null;
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;

        // Filter state
        this.detectedColumnsData = [];
        this.sampleData = [];
        this.imagePaths = [];
        this.excludeColumns = new Set();
        this.omitRules = [];

        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.filePreview = document.getElementById('filePreview');
        this.fileList = document.getElementById('fileList');
        this.fileCount = document.getElementById('fileCount');
        this.clearFilesBtn = document.getElementById('clearFiles');
        this.processBtn = document.getElementById('processBtn');
        this.progressSection = document.getElementById('progressSection');
        this.progressText = document.getElementById('progressText');
        this.progressPercent = document.getElementById('progressPercent');
        this.progressFill = document.getElementById('progressFill');
        this.resultsSection = document.getElementById('resultsSection');
        this.resultColumns = document.getElementById('resultColumns');
        this.resultRows = document.getElementById('resultRows');
        this.resultAccuracy = document.getElementById('resultAccuracy');
        this.resultErrors = document.getElementById('resultErrors');
        this.detectedColumns = document.getElementById('detectedColumns');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.previewTable = document.getElementById('previewTable');

        // Crop modal elements
        this.cropModal = document.getElementById('cropModal');
        this.cropCanvas = document.getElementById('cropCanvas');
        this.cropCtx = this.cropCanvas.getContext('2d');
        this.cropSelectionEl = document.getElementById('cropSelection');
        this.closeCropModalBtn = document.getElementById('closeCropModal');
        this.resetCropBtn = document.getElementById('resetCrop');
        this.cancelCropBtn = document.getElementById('cancelCrop');
        this.applyCropBtn = document.getElementById('applyCrop');

        // Filter modal elements
        this.filterModal = document.getElementById('filterModal');
        this.closeFilterModalBtn = document.getElementById('closeFilterModal');
        this.cancelFilterBtn = document.getElementById('cancelFilter');
        this.applyFilterBtn = document.getElementById('applyFilter');
        this.columnCheckboxes = document.getElementById('columnCheckboxes');
        this.omitRulesContainer = document.getElementById('omitRules');
        this.addOmitRuleBtn = document.getElementById('addOmitRule');
        this.filterPreviewTable = document.getElementById('filterPreviewTable');
        this.filterImageCount = document.getElementById('filterImageCount');

        // Error report modal elements
        this.errorReportModal = document.getElementById('errorReportModal');
        this.showErrorReportBtn = document.getElementById('showErrorReportBtn');
        this.closeErrorReportBtn = document.getElementById('closeErrorReport');
        this.closeErrorReportActionBtn = document.getElementById('closeErrorReportBtn');
        this.clearListBtn = document.getElementById('clearListBtn');

        // Error report data elements
        this.reportAccuracy = document.getElementById('reportAccuracy');
        this.reportErrors = document.getElementById('reportErrors');
        this.reportImagesProcessed = document.getElementById('reportImagesProcessed');
        this.reportLinesProcessed = document.getElementById('reportLinesProcessed');
        this.reportFilteredRows = document.getElementById('reportFilteredRows');
        this.reportTotalRows = document.getElementById('reportTotalRows');

        // Quality warning element
        this.qualityWarning = document.getElementById('qualityWarning');
        this.qualityWarningText = document.getElementById('qualityWarningText');

        // Store last stats for report
        this.lastStats = null;
        this.lastTotalRows = 0;
    }

    bindEvents() {
        // Drop zone events
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));

        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Button events
        this.clearFilesBtn.addEventListener('click', () => this.clearFiles());
        this.processBtn.addEventListener('click', () => this.processFiles());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.clearListBtn?.addEventListener('click', () => this.clearAndRestart());

        // Crop modal events
        this.closeCropModalBtn.addEventListener('click', () => this.closeCropModal());
        this.cancelCropBtn.addEventListener('click', () => this.closeCropModal());
        this.resetCropBtn.addEventListener('click', () => this.resetCrop());
        this.applyCropBtn.addEventListener('click', () => this.applyCrop());

        // Canvas crop events
        this.cropCanvas.addEventListener('mousedown', (e) => this.startCrop(e));
        this.cropCanvas.addEventListener('mousemove', (e) => this.updateCrop(e));
        this.cropCanvas.addEventListener('mouseup', () => this.endCrop());
        this.cropCanvas.addEventListener('mouseleave', () => this.endCrop());

        // Touch events for mobile
        this.cropCanvas.addEventListener('touchstart', (e) => this.startCrop(e));
        this.cropCanvas.addEventListener('touchmove', (e) => this.updateCrop(e));
        this.cropCanvas.addEventListener('touchend', () => this.endCrop());

        // Filter modal events
        this.closeFilterModalBtn?.addEventListener('click', () => this.closeFilterModal());
        this.cancelFilterBtn?.addEventListener('click', () => this.closeFilterModal());
        this.applyFilterBtn?.addEventListener('click', () => this.processWithFilters());
        this.addOmitRuleBtn?.addEventListener('click', () => this.addOmitRule());

        // Error report modal events
        this.showErrorReportBtn?.addEventListener('click', () => this.openErrorReport());
        this.closeErrorReportBtn?.addEventListener('click', () => this.closeErrorReport());
        this.closeErrorReportActionBtn?.addEventListener('click', () => this.closeErrorReport());
        document.querySelector('.error-report-overlay')?.addEventListener('click', () => this.closeErrorReport());

        // Close filter modal on overlay click
        document.querySelector('.filter-modal-overlay')?.addEventListener('click', () => this.closeFilterModal());

        // Prevent default drag behaviors on document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Close modal on overlay click
        document.querySelector('.crop-modal-overlay')?.addEventListener('click', () => this.closeCropModal());

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.cropModal.classList.contains('hidden')) {
                    this.closeCropModal();
                }
                if (!this.filterModal.classList.contains('hidden')) {
                    this.closeFilterModal();
                }
                if (!this.errorReportModal.classList.contains('hidden')) {
                    this.closeErrorReport();
                }
            }
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');

        const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
            file.type.startsWith('image/')
        );

        if (droppedFiles.length > 0) {
            this.addFiles(droppedFiles);
        }
    }

    handleFileSelect(e) {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length > 0) {
            this.addFiles(selectedFiles);
        }
    }

    addFiles(newFiles) {
        this.files = [...this.files, ...newFiles];
        this.updateFilePreview();
        this.updateProcessButton();
    }

    clearFiles() {
        this.files = [];
        this.croppedFiles.clear();
        this.fileInput.value = '';
        this.updateFilePreview();
        this.updateProcessButton();
    }

    updateFilePreview() {
        if (this.files.length === 0) {
            this.filePreview.classList.add('hidden');
            return;
        }

        this.filePreview.classList.remove('hidden');
        this.fileCount.textContent = this.files.length;

        this.fileList.innerHTML = '';

        this.files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.style.position = 'relative';

            if (this.croppedFiles.has(index)) {
                fileItem.classList.add('cropped');
            }

            const imgWrapper = document.createElement('div');
            imgWrapper.style.position = 'relative';
            imgWrapper.style.overflow = 'hidden';

            const img = document.createElement('img');
            if (this.croppedFiles.has(index)) {
                img.src = this.croppedFiles.get(index);
            } else {
                img.src = URL.createObjectURL(file);
            }
            img.alt = file.name;

            const overlay = document.createElement('div');
            overlay.className = 'file-item-overlay';
            overlay.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 2v14a2 2 0 002 2h14"/>
                    <path d="M18 22V8a2 2 0 00-2-2H2"/>
                </svg>
                <span>Recortar</span>
            `;
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openCropModal(index);
            });

            imgWrapper.appendChild(img);
            imgWrapper.appendChild(overlay);

            const info = document.createElement('div');
            info.className = 'file-item-info';

            const name = document.createElement('div');
            name.className = 'file-item-name';
            name.textContent = file.name;
            name.title = file.name;

            const size = document.createElement('div');
            size.className = 'file-item-size';
            size.textContent = this.formatFileSize(file.size);

            info.appendChild(name);
            info.appendChild(size);
            fileItem.appendChild(imgWrapper);
            fileItem.appendChild(info);

            this.fileList.appendChild(fileItem);
        });
    }

    // ==========================================
    // Image Crop Methods
    // ==========================================

    openCropModal(fileIndex) {
        this.currentCropIndex = fileIndex;
        this.cropModal.classList.remove('hidden');
        this.dragMode = null;
        this.isDrawing = false;

        const file = this.files[fileIndex];
        const img = new Image();

        img.onload = () => {
            this.originalImage = img;

            const maxWidth = window.innerWidth * 0.9;
            const maxHeight = window.innerHeight * 0.75;

            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                const widthRatio = maxWidth / width;
                const heightRatio = maxHeight / height;
                const ratio = Math.min(widthRatio, heightRatio);
                const finalRatio = Math.max(ratio, 0.5);
                width = Math.round(img.width * finalRatio);
                height = Math.round(img.height * finalRatio);
            }

            this.cropCanvas.width = width;
            this.cropCanvas.height = height;
            this.scale = img.width / width;

            this.cropCtx.drawImage(img, 0, 0, width, height);

            this.cropSelection = {
                x: 0,
                y: 0,
                width: width,
                height: height
            };
            this.updateSelectionUI();
            this.applyCropBtn.disabled = false;
        };

        if (this.croppedFiles.has(fileIndex)) {
            img.src = this.croppedFiles.get(fileIndex);
        } else {
            img.src = URL.createObjectURL(file);
        }
    }

    closeCropModal() {
        this.cropModal.classList.add('hidden');
        this.currentCropIndex = -1;
        this.cropSelection = null;
        this.cropSelectionEl.classList.add('hidden');
    }

    getMousePos(e) {
        const rect = this.cropCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    getHandleAtPosition(x, y) {
        if (!this.cropSelection) return null;

        const s = this.cropSelection;
        const handleSize = 15;

        if (Math.abs(x - s.x) < handleSize && Math.abs(y - s.y) < handleSize) return 'nw';
        if (Math.abs(x - (s.x + s.width)) < handleSize && Math.abs(y - s.y) < handleSize) return 'ne';
        if (Math.abs(x - s.x) < handleSize && Math.abs(y - (s.y + s.height)) < handleSize) return 'sw';
        if (Math.abs(x - (s.x + s.width)) < handleSize && Math.abs(y - (s.y + s.height)) < handleSize) return 'se';

        if (x > s.x + handleSize && x < s.x + s.width - handleSize && Math.abs(y - s.y) < handleSize) return 'n';
        if (x > s.x + handleSize && x < s.x + s.width - handleSize && Math.abs(y - (s.y + s.height)) < handleSize) return 's';
        if (y > s.y + handleSize && y < s.y + s.height - handleSize && Math.abs(x - s.x) < handleSize) return 'w';
        if (y > s.y + handleSize && y < s.y + s.height - handleSize && Math.abs(x - (s.x + s.width)) < handleSize) return 'e';

        if (x > s.x && x < s.x + s.width && y > s.y && y < s.y + s.height) return 'move';

        return null;
    }

    updateCursor(handle) {
        const cursors = {
            'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize',
            'n': 'n-resize', 's': 's-resize', 'w': 'w-resize', 'e': 'e-resize',
            'move': 'move'
        };
        this.cropCanvas.style.cursor = handle ? cursors[handle] : 'crosshair';
    }

    startCrop(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        const handle = this.getHandleAtPosition(pos.x, pos.y);

        if (handle) {
            this.isDrawing = true;
            this.dragMode = handle;
            this.dragStartX = pos.x;
            this.dragStartY = pos.y;
            this.originalSelection = { ...this.cropSelection };
        }
    }

    updateCrop(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);

        if (!this.isDrawing) {
            const handle = this.getHandleAtPosition(pos.x, pos.y);
            this.updateCursor(handle);
            return;
        }

        const dx = pos.x - this.dragStartX;
        const dy = pos.y - this.dragStartY;
        const orig = this.originalSelection;
        const canvasW = this.cropCanvas.width;
        const canvasH = this.cropCanvas.height;
        const minSize = 20;

        let newX = this.cropSelection.x;
        let newY = this.cropSelection.y;
        let newW = this.cropSelection.width;
        let newH = this.cropSelection.height;

        switch (this.dragMode) {
            case 'move':
                newX = Math.max(0, Math.min(orig.x + dx, canvasW - orig.width));
                newY = Math.max(0, Math.min(orig.y + dy, canvasH - orig.height));
                newW = orig.width;
                newH = orig.height;
                break;
            case 'nw':
                newX = Math.max(0, Math.min(orig.x + dx, orig.x + orig.width - minSize));
                newY = Math.max(0, Math.min(orig.y + dy, orig.y + orig.height - minSize));
                newW = orig.width - (newX - orig.x);
                newH = orig.height - (newY - orig.y);
                break;
            case 'ne':
                newY = Math.max(0, Math.min(orig.y + dy, orig.y + orig.height - minSize));
                newW = Math.max(minSize, Math.min(orig.width + dx, canvasW - orig.x));
                newH = orig.height - (newY - orig.y);
                break;
            case 'sw':
                newX = Math.max(0, Math.min(orig.x + dx, orig.x + orig.width - minSize));
                newW = orig.width - (newX - orig.x);
                newH = Math.max(minSize, Math.min(orig.height + dy, canvasH - orig.y));
                break;
            case 'se':
                newW = Math.max(minSize, Math.min(orig.width + dx, canvasW - orig.x));
                newH = Math.max(minSize, Math.min(orig.height + dy, canvasH - orig.y));
                break;
            case 'n':
                newY = Math.max(0, Math.min(orig.y + dy, orig.y + orig.height - minSize));
                newH = orig.height - (newY - orig.y);
                break;
            case 's':
                newH = Math.max(minSize, Math.min(orig.height + dy, canvasH - orig.y));
                break;
            case 'w':
                newX = Math.max(0, Math.min(orig.x + dx, orig.x + orig.width - minSize));
                newW = orig.width - (newX - orig.x);
                break;
            case 'e':
                newW = Math.max(minSize, Math.min(orig.width + dx, canvasW - orig.x));
                break;
        }

        this.cropSelection = { x: newX, y: newY, width: newW, height: newH };
        this.updateSelectionUI();
    }

    endCrop() {
        this.isDrawing = false;
        this.dragMode = null;
    }

    updateSelectionUI() {
        if (!this.cropSelection) {
            this.cropSelectionEl.classList.add('hidden');
            return;
        }

        const s = this.cropSelection;
        const padding = 20;
        this.cropSelectionEl.classList.remove('hidden');
        this.cropSelectionEl.style.left = (s.x + padding) + 'px';
        this.cropSelectionEl.style.top = (s.y + padding) + 'px';
        this.cropSelectionEl.style.width = s.width + 'px';
        this.cropSelectionEl.style.height = s.height + 'px';

        this.applyCropBtn.disabled = s.width < 10 || s.height < 10;
    }

    resetCrop() {
        if (this.cropCanvas.width > 0 && this.cropCanvas.height > 0) {
            this.cropSelection = {
                x: 0,
                y: 0,
                width: this.cropCanvas.width,
                height: this.cropCanvas.height
            };
            this.updateSelectionUI();
            this.applyCropBtn.disabled = false;
        }

        if (this.originalImage && this.currentCropIndex >= 0) {
            this.cropCtx.clearRect(0, 0, this.cropCanvas.width, this.cropCanvas.height);
            this.cropCtx.drawImage(this.originalImage, 0, 0, this.cropCanvas.width, this.cropCanvas.height);
        }
    }

    applyCrop() {
        if (!this.cropSelection || this.currentCropIndex < 0) return;

        const { x, y, width, height } = this.cropSelection;

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        const actualX = x * this.scale;
        const actualY = y * this.scale;
        const actualWidth = width * this.scale;
        const actualHeight = height * this.scale;

        tempCanvas.width = actualWidth;
        tempCanvas.height = actualHeight;

        tempCtx.drawImage(
            this.originalImage,
            actualX, actualY, actualWidth, actualHeight,
            0, 0, actualWidth, actualHeight
        );

        tempCanvas.toBlob((blob) => {
            const croppedUrl = URL.createObjectURL(blob);
            this.croppedFiles.set(this.currentCropIndex, croppedUrl);

            const fileName = this.files[this.currentCropIndex].name;
            const mimeType = this.files[this.currentCropIndex].type;
            const croppedFile = new File([blob], fileName, { type: mimeType });
            this.files[this.currentCropIndex] = croppedFile;

            this.updateFilePreview();
            this.closeCropModal();
        }, 'image/png');
    }

    // ==========================================
    // Filter Modal Methods
    // ==========================================

    openFilterModal(columns, sampleData, imagePaths, totalImages) {
        this.detectedColumnsData = columns;
        this.sampleData = sampleData;
        this.imagePaths = imagePaths;
        this.excludeColumns = new Set();
        this.omitRules = [];

        this.filterModal.classList.remove('hidden');
        this.filterImageCount.textContent = `${totalImages} imagen(es)`;

        // Render column checkboxes
        this.renderColumnCheckboxes();

        // Render sample data preview
        this.renderFilterPreview();

        // Clear omit rules
        this.omitRulesContainer.innerHTML = '';
    }

    closeFilterModal() {
        this.filterModal.classList.add('hidden');
        this.imagePaths = [];
    }

    renderColumnCheckboxes() {
        this.columnCheckboxes.innerHTML = '';

        this.detectedColumnsData.forEach((col, index) => {
            const label = document.createElement('label');
            label.className = 'column-checkbox';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.dataset.column = col;

            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.excludeColumns.delete(col);
                    label.classList.remove('excluded');
                } else {
                    this.excludeColumns.add(col);
                    label.classList.add('excluded');
                }
                this.updateOmitRuleSelects();
            });

            const span = document.createElement('span');
            span.textContent = col;

            label.appendChild(checkbox);
            label.appendChild(span);
            this.columnCheckboxes.appendChild(label);
        });
    }

    addOmitRule() {
        const ruleId = Date.now();
        this.omitRules.push({ id: ruleId, column: this.detectedColumnsData[0] || '', text: '' });
        this.renderOmitRules();
    }

    removeOmitRule(ruleId) {
        this.omitRules = this.omitRules.filter(r => r.id !== ruleId);
        this.renderOmitRules();
    }

    renderOmitRules() {
        this.omitRulesContainer.innerHTML = '';

        this.omitRules.forEach(rule => {
            const ruleEl = document.createElement('div');
            ruleEl.className = 'omit-rule';

            const select = document.createElement('select');
            this.detectedColumnsData.forEach(col => {
                if (!this.excludeColumns.has(col)) {
                    const option = document.createElement('option');
                    option.value = col;
                    option.textContent = col;
                    option.selected = rule.column === col;
                    select.appendChild(option);
                }
            });
            select.addEventListener('change', (e) => {
                rule.column = e.target.value;
            });

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Texto a omitir...';
            input.value = rule.text;
            input.addEventListener('input', (e) => {
                rule.text = e.target.value;
            });

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-rule-btn';
            removeBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                </svg>
            `;
            removeBtn.addEventListener('click', () => this.removeOmitRule(rule.id));

            ruleEl.appendChild(select);
            ruleEl.appendChild(input);
            ruleEl.appendChild(removeBtn);
            this.omitRulesContainer.appendChild(ruleEl);
        });
    }

    updateOmitRuleSelects() {
        this.renderOmitRules();
    }

    renderFilterPreview() {
        if (!this.sampleData || this.sampleData.length === 0) {
            this.filterPreviewTable.innerHTML = '<tr><td>No hay datos para mostrar</td></tr>';
            return;
        }

        let html = '<thead><tr>';
        this.detectedColumnsData.forEach(col => {
            html += `<th>${this.escapeHtml(col)}</th>`;
        });
        html += '</tr></thead><tbody>';

        this.sampleData.forEach(row => {
            html += '<tr>';
            this.detectedColumnsData.forEach(col => {
                html += `<td>${this.escapeHtml(row[col] || '')}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody>';
        this.filterPreviewTable.innerHTML = html;
    }

    // ==========================================
    // Process and Results Methods
    // ==========================================

    updateProcessButton() {
        if (this.files.length > 0) {
            this.processBtn.classList.remove('hidden');
            this.processBtn.disabled = false;
        } else {
            this.processBtn.classList.add('hidden');
            this.processBtn.disabled = true;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async processFiles() {
        if (this.files.length === 0) return;

        // Show processing state
        this.showProcessingState();
        this.progressText.textContent = 'Detectando columnas...';

        const formData = new FormData();
        this.files.forEach(file => {
            formData.append('images', file);
        });

        try {
            // First, detect columns
            const detectResponse = await fetch('/api/detect', {
                method: 'POST',
                body: formData
            });

            if (!detectResponse.ok) {
                throw new Error('Error detecting columns');
            }

            const detectResult = await detectResponse.json();

            // Hide progress and show filter modal
            this.hideProcessingState();
            this.openFilterModal(
                detectResult.columns,
                detectResult.sampleData,
                detectResult.imagePaths,
                detectResult.totalImages
            );

        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message);
        }
    }

    async processWithFilters() {
        if (this.imagePaths.length === 0) return;

        // Save paths before closing modal (closeFilterModal clears them)
        const pathsToProcess = [...this.imagePaths];

        this.closeFilterModal();
        this.showProcessingState();

        const filters = {
            excludeColumns: Array.from(this.excludeColumns),
            omitText: this.omitRules.filter(r => r.text.trim() !== '').map(r => ({
                column: r.column,
                text: r.text
            }))
        };

        try {
            this.startProgressSimulation();

            const response = await fetch('/api/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imagePaths: pathsToProcess,
                    filters: filters
                })
            });

            this.stopProgressSimulation();

            const responseText = await response.text();

            if (!response.ok) {
                let errorMessage = 'Error processing files';
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.error || errorMessage;
                } catch {
                    errorMessage = responseText || `Server error: ${response.status}`;
                }
                throw new Error(errorMessage);
            }

            let result;
            try {
                result = JSON.parse(responseText);
            } catch {
                throw new Error('Invalid response from server');
            }

            this.showResults(result);

        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message);
        }
    }

    showProcessingState() {
        const btnContent = this.processBtn.querySelector('.btn-content');
        const btnLoading = this.processBtn.querySelector('.btn-loading');

        btnContent.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        this.processBtn.disabled = true;

        this.progressSection.classList.remove('hidden');
        this.resultsSection.classList.add('hidden');
    }

    hideProcessingState() {
        const btnContent = this.processBtn.querySelector('.btn-content');
        const btnLoading = this.processBtn.querySelector('.btn-loading');

        btnContent.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        this.processBtn.disabled = false;

        this.progressSection.classList.add('hidden');
    }

    startProgressSimulation() {
        let progress = 0;
        const steps = [
            { text: 'Procesando imágenes...', target: 15 },
            { text: 'Aplicando filtros...', target: 30 },
            { text: 'Extrayendo texto con OCR...', target: 60 },
            { text: 'Generando Excel...', target: 85 },
            { text: 'Finalizando...', target: 95 }
        ];

        let stepIndex = 0;

        this.progressInterval = setInterval(() => {
            if (stepIndex < steps.length && progress >= steps[stepIndex].target - 5) {
                this.progressText.textContent = steps[stepIndex].text;
                stepIndex++;
            }

            progress = Math.min(progress + Math.random() * 3, 95);
            this.progressFill.style.width = `${progress}%`;
            this.progressPercent.textContent = `${Math.round(progress)}%`;
        }, 300);
    }

    stopProgressSimulation() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        this.progressFill.style.width = '100%';
        this.progressPercent.textContent = '100%';
        this.progressText.textContent = '¡Completado!';
    }

    showResults(result) {
        setTimeout(() => {
            this.progressSection.classList.add('hidden');

            const btnContent = this.processBtn.querySelector('.btn-content');
            const btnLoading = this.processBtn.querySelector('.btn-loading');
            btnContent.classList.remove('hidden');
            btnLoading.classList.add('hidden');

            this.resultsSection.classList.remove('hidden');

            this.resultColumns.textContent = result.columns.length;
            this.resultRows.textContent = result.totalRows || result.preview.length;

            // Save stats for error report
            this.lastStats = result.stats || null;
            this.lastTotalRows = result.totalRows || result.preview.length;

            if (result.stats) {
                this.resultAccuracy.textContent = result.stats.accuracyPercent + '%';
                this.resultErrors.textContent = result.stats.errorPercent + '%';

                // Show quality warning based on accuracy
                this.updateQualityWarning(result.stats.accuracyPercent);
            } else {
                this.resultAccuracy.textContent = 'N/A';
                this.resultErrors.textContent = 'N/A';
                this.qualityWarning.classList.add('hidden');
            }

            this.detectedColumns.innerHTML = result.columns.map(col =>
                `<span class="column-tag">${col}</span>`
            ).join('');

            this.downloadBtn.href = result.downloadUrl;

            this.renderPreviewTable(result.columns, result.preview);

            this.dropZone.classList.add('hidden');
            this.filePreview.classList.add('hidden');
            this.processBtn.classList.add('hidden');

        }, 500);
    }

    renderPreviewTable(columns, data) {
        if (!data || data.length === 0) {
            this.previewTable.innerHTML = '<tr><td>No hay datos para mostrar</td></tr>';
            return;
        }

        let html = '<thead><tr>';
        columns.forEach(col => {
            html += `<th>${this.escapeHtml(col)}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.slice(0, 10).forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
                html += `<td>${this.escapeHtml(row[col] || '')}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody>';
        this.previewTable.innerHTML = html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        this.stopProgressSimulation();

        const btnContent = this.processBtn.querySelector('.btn-content');
        const btnLoading = this.processBtn.querySelector('.btn-loading');
        btnContent.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        this.processBtn.disabled = false;

        this.progressSection.classList.add('hidden');

        alert(`Error: ${message}`);
    }

    reset() {
        this.files = [];
        this.croppedFiles.clear();
        this.fileInput.value = '';
        this.imagePaths = [];
        this.excludeColumns = new Set();
        this.omitRules = [];

        this.dropZone.classList.remove('hidden');
        this.resultsSection.classList.add('hidden');
        this.filePreview.classList.add('hidden');
        this.processBtn.classList.add('hidden');

        this.progressFill.style.width = '0%';
        this.progressPercent.textContent = '0%';
        this.progressText.textContent = 'Iniciando procesamiento...';
    }

    clearAndRestart() {
        this.reset();
        this.lastStats = null;
        this.lastTotalRows = 0;
    }

    // ==========================================
    // Error Report Modal Methods
    // ==========================================

    openErrorReport() {
        if (!this.lastStats) return;

        this.errorReportModal.classList.remove('hidden');

        // Populate report data
        this.reportAccuracy.textContent = this.lastStats.accuracyPercent + '%';
        this.reportErrors.textContent = this.lastStats.errorPercent + '%';
        this.reportImagesProcessed.textContent = this.lastStats.imagesProcessed || 0;
        this.reportLinesProcessed.textContent = this.lastStats.totalLinesProcessed || 0;
        this.reportFilteredRows.textContent = this.lastStats.filteredRows || 0;
        this.reportTotalRows.textContent = this.lastTotalRows || 0;
    }

    closeErrorReport() {
        this.errorReportModal.classList.add('hidden');
    }

    // ==========================================
    // Quality Warning Methods
    // ==========================================

    updateQualityWarning(accuracyPercent) {
        console.log('updateQualityWarning called with:', accuracyPercent);

        // Remove all warning classes
        this.qualityWarning.classList.remove('warning-low', 'warning-high', 'hidden');

        if (accuracyPercent >= 85) {
            // Good quality - hide warning
            console.log('Quality OK, hiding warning');
            this.qualityWarning.classList.add('hidden');
        } else if (accuracyPercent >= 70) {
            // Moderate quality - show yellow warning
            console.log('Moderate quality, showing yellow warning');
            this.qualityWarning.classList.add('warning-low');
            this.qualityWarningText.textContent =
                `La precisión del OCR es del ${accuracyPercent}%. Algunos datos podrían contener errores. Revisa los resultados antes de usarlos.`;
        } else {
            // Low quality - show red warning
            console.log('Low quality, showing red warning');
            this.qualityWarning.classList.add('warning-high');
            this.qualityWarningText.textContent =
                `La precisión del OCR es muy baja (${accuracyPercent}%). Los resultados probablemente contienen múltiples errores. Se recomienda usar imágenes de mayor calidad o resolución.`;
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.excelficator = new Excelficator();
});
