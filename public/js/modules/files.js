import { state } from './state.js';
import { escapeHtml, formatFileSize, formatTime } from './utils.js';

function createFilesModule({
  uploadForm,
  uploadInput,
  uploadDropzone,
  fileList,
  uploadProgress,
  uploadProgressBar,
  uploadProgressText,
  onUploadFile,
  onDownloadFile,
}) {
  function renderFile(file) {
    const downloadState = state.downloads.get(file.storedName);
    const progressMarkup = downloadState
      ? `<div class="progress-track mt-2.5"><div class="progress-fill ${downloadState.indeterminate ? 'animate-pulse' : ''}" style="width:${downloadState.indeterminate ? 100 : downloadState.progress}%"></div></div><p class="mt-1.5 text-2xs text-[var(--fg-muted)]">${escapeHtml(downloadState.label)}</p>`
      : '';
    const buttonLabel = downloadState ? '下载中' : '下载';
    const buttonDisabled = downloadState ? ' disabled aria-disabled="true"' : '';

    return `<article class="sb-surface p-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="truncate text-sm font-semibold text-[var(--fg)]">${escapeHtml(file.name)}</p><p class="mt-1 text-2xs text-[var(--fg-muted)]">${formatFileSize(file.size)} · ${escapeHtml(file.username)} · ${formatTime(file.createdAt)}</p></div><button type="button" class="secondary-button !min-h-8 !px-2.5 !text-2xs whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60" data-download="${escapeHtml(file.storedName)}"${buttonDisabled}>${buttonLabel}</button></div>${progressMarkup}</article>`;
  }

  function bindDownloadButtons() {
    fileList.querySelectorAll('[data-download]').forEach((button) => {
      button.addEventListener('click', () => {
        const storedName = button.getAttribute('data-download');
        const file = state.files.find((item) => item.storedName === storedName);
        if (file) {
          onDownloadFile(file);
        }
      });
    });
  }

  function renderFiles() {
    fileList.innerHTML = state.files.length
      ? state.files.map(renderFile).join('')
      : '<div class="mt-3 rounded-3xl border border-dashed border-slate-200/80 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">拖拽或点击上传文件，团队成员会实时看到。</div>';

    bindDownloadButtons();
  }

  function setFiles(files) {
    state.files = Array.isArray(files) ? [...files] : [];
    renderFiles();
  }

  function appendFile(file) {
    state.files.unshift(file);
    state.files = state.files.slice(0, 100);
    renderFiles();
  }

  function updateUploadProgress({ active, progress = 0, fileName = '' }) {
    state.uploadState = { active, progress, fileName };
    uploadProgress.classList.toggle('hidden', !active);
    uploadProgressBar.style.width = `${progress}%`;
    uploadProgressText.textContent = active ? `${fileName} · ${progress}%` : '';
  }

  function updateDownloadProgress(storedName, progress, options = {}) {
    if (progress >= 100) {
      state.downloads.delete(storedName);
    } else {
      const normalizedProgress = Math.max(0, Math.min(100, Number(progress) || 0));
      const indeterminate = Boolean(options.indeterminate);
      const label = options.label || (indeterminate ? '正在下载…' : `下载中 ${normalizedProgress}%`);
      state.downloads.set(storedName, {
        progress: normalizedProgress,
        indeterminate,
        label,
      });
    }
    renderFiles();
  }

  function handleFiles(fileListLike) {
    const [file] = Array.from(fileListLike || []);

    if (file) {
      onUploadFile(file);
      uploadInput.value = '';
    }
  }

  function init() {
    uploadForm.addEventListener('submit', (event) => {
      event.preventDefault();
      handleFiles(uploadInput.files);
    });

    uploadInput.addEventListener('change', () => handleFiles(uploadInput.files));

    uploadDropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      uploadDropzone.classList.add('border-amber-400');
    });

    uploadDropzone.addEventListener('dragleave', () => {
      uploadDropzone.classList.remove('border-amber-400');
    });

    uploadDropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      uploadDropzone.classList.remove('border-amber-400');
      handleFiles(event.dataTransfer.files);
    });

    uploadDropzone.addEventListener('click', () => uploadInput.click());
    renderFiles();
  }

  return {
    appendFile,
    init,
    setFiles,
    updateDownloadProgress,
    updateUploadProgress,
  };
}

export { createFilesModule };
