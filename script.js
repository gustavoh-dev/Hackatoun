const initialCases = [
  {
    id: 1,
    name: "Marcos do Viaduto",
    location: "Santo Amaro",
    need: "Abrigo",
    priority: "Alta",
    status: "Aguardando",
    notes: "Prefere abrigo proximo ao centro e esta sem alimentacao desde a manha.",
    photo: ""
  },
  {
    id: 2,
    name: "Lia",
    location: "Boa Vista",
    need: "Saude",
    priority: "Alta",
    status: "Em Atendimento",
    notes: "Relata febre e ja foi sinalizada para avaliacao na rede parceira.",
    photo: ""
  },
  {
    id: 3,
    name: "Seu Paulo",
    location: "Bairro do Recife",
    need: "Documentos",
    priority: "Baixa",
    status: "Resolvido",
    notes: "Recebeu orientacao para segunda via e apoio no deslocamento.",
    photo: ""
  },
  {
    id: 4,
    name: "Nanda",
    location: "Afogados",
    need: "Alimentacao",
    priority: "Media",
    status: "Aguardando",
    notes: "Aguardando kit de alimentacao e contato com equipe de referencia.",
    photo: ""
  }
];

const STORAGE_KEY = "geoacolhe-recife-cases";
const cases = loadCases();

const mapPoints = {
  "porto-digital": {
    title: "Porto Digital",
    description: "Base de articulacao com equipes parceiras para escuta inicial e encaminhamento de acolhimento.",
    occupied: 18,
    available: 7,
    lat: -8.0631,
    lng: -34.8711
  },
  "casa-zero": {
    title: "Casa Zero",
    description: "Ponto de apoio com foco em alimentacao, orientacao e conexao com servicos da rede local.",
    occupied: 11,
    available: 9,
    lat: -8.0584,
    lng: -34.8738
  },
  "centro-recife": {
    title: "Centro do Recife",
    description: "Area com maior fluxo de abordagens e vagas rotativas para cuidado emergencial e pernoite.",
    occupied: 24,
    available: 4,
    lat: -8.0629,
    lng: -34.8807
  }
};

const statusFlow = ["Aguardando", "Em Atendimento", "Resolvido"];

const form = document.getElementById("caseForm");
const caseList = document.getElementById("caseList");
const metricShelter = document.getElementById("metricShelter");
const metricAssisted = document.getElementById("metricAssisted");
const metricAlerts = document.getElementById("metricAlerts");
const mapTitle = document.getElementById("mapTitle");
const mapDescription = document.getElementById("mapDescription");
const mapOccupied = document.getElementById("mapOccupied");
const mapAvailable = document.getElementById("mapAvailable");
const realMap = document.getElementById("realMap");
const photoInput = document.getElementById("photo");
const cameraInput = document.getElementById("cameraInput");
const photoPreview = document.getElementById("photoPreview");
const openCameraBtn = document.getElementById("openCameraBtn");
const cameraModal = document.getElementById("cameraModal");
const closeCameraModal = document.getElementById("closeCameraModal");
const cameraVideo = document.getElementById("cameraVideo");
const cameraCanvas = document.getElementById("cameraCanvas");
const capturePhotoBtn = document.getElementById("capturePhotoBtn");
const useGalleryFallbackBtn = document.getElementById("useGalleryFallbackBtn");
const cameraFallback = document.getElementById("cameraFallback");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");
let pendingPhoto = "";
let activeStream = null;
let leafletMap = null;
const pointMarkers = {};

function loadCases() {
  const storedCases = window.localStorage.getItem(STORAGE_KEY);
  if (!storedCases) return [...initialCases];

  try {
    const parsedCases = JSON.parse(storedCases);
    return Array.isArray(parsedCases) ? parsedCases : [...initialCases];
  } catch {
    return [...initialCases];
  }
}

function saveCases() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

function getStatusClass(status) {
  if (status === "Aguardando") return "status-aguardando";
  if (status === "Em Atendimento") return "status-em-atendimento";
  return "status-resolvido";
}

function getPriorityClass(priority) {
  if (priority === "Alta") return "priority-alta";
  if (priority === "Media") return "priority-media";
  return "priority-baixa";
}

// Atualiza os indicadores principais com base nos dados salvos no navegador.
function renderMetrics() {
  if (!metricShelter || !metricAssisted || !metricAlerts) return;

  const totalShelter = Object.values(mapPoints).reduce((sum, point) => sum + point.available, 0);
  const assistedToday = cases.filter((item) => item.status !== "Aguardando").length;
  const activeAlerts = cases.filter((item) => item.status === "Aguardando" || item.priority === "Alta").length;

  metricShelter.textContent = totalShelter;
  metricAssisted.textContent = assistedToday;
  metricAlerts.textContent = activeAlerts;
}

function createCaseCard(item) {
  return `
    <article class="grid gap-3 px-4 py-4 md:grid-cols-[1.6fr_0.9fr_1fr_0.9fr_1fr_0.9fr] md:items-center">
      <div class="flex gap-3">
        <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-sky-50 text-[11px] font-semibold text-slate-400">
          ${item.photo
            ? `<img src="${item.photo}" alt="Foto de ${item.name}" class="h-full w-full object-cover">`
            : "Sem foto"}
        </div>
        <div>
          <p class="text-sm font-bold text-navy">${item.name}</p>
          <p class="mt-1 text-xs text-slate-500 md:hidden">Bairro: ${item.location}</p>
          <p class="mt-2 text-xs leading-relaxed text-slate-500">${item.notes || "Sem observacoes registradas."}</p>
        </div>
      </div>
      <div class="text-sm text-slate-600">
        <span class="md:hidden font-semibold text-slate-500">Bairro: </span>${item.location}
      </div>
      <div class="text-sm text-slate-600">
        <span class="md:hidden font-semibold text-slate-500">Necessidade: </span>${item.need}
      </div>
      <div>
        <span class="priority-badge ${getPriorityClass(item.priority || "Baixa")}">${item.priority || "Baixa"}</span>
      </div>
      <div>
        <span class="status-badge ${getStatusClass(item.status)}">${item.status}</span>
      </div>
      <div>
        <button
          type="button"
          data-case-id="${item.id}"
          class="change-status-btn inline-flex w-full items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold text-white transition focus:outline-none focus:ring-4 focus:ring-sky-100"
        >
          Mudar Status
        </button>
      </div>
    </article>
  `;
}

function getFilteredCases() {
  const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const statusValue = statusFilter ? statusFilter.value : "";
  const priorityValue = priorityFilter ? priorityFilter.value : "";

  return cases.filter((item) => {
    const matchesSearch =
      !searchValue ||
      item.name.toLowerCase().includes(searchValue) ||
      (item.notes || "").toLowerCase().includes(searchValue);

    const matchesStatus = !statusValue || item.status === statusValue;
    const matchesPriority = !priorityValue || (item.priority || "Baixa") === priorityValue;

    return matchesSearch && matchesStatus && matchesPriority;
  });
}

// Renderiza a lista completa apos criacao, filtro ou alteracao de status.
function renderCases() {
  if (!caseList) return;

  const filteredCases = getFilteredCases();
  if (!filteredCases.length) {
    caseList.innerHTML = `
      <div class="px-4 py-8 text-center text-sm text-slate-500">
        Nenhum caso encontrado com os filtros atuais.
      </div>
    `;
    return;
  }

  caseList.innerHTML = filteredCases.map(createCaseCard).join("");
}

function resetForm() {
  if (!form || !photoPreview) return;

  form.reset();
  document.getElementById("status").value = "Aguardando";
  const priorityField = document.getElementById("priority");
  if (priorityField) priorityField.value = "Baixa";

  pendingPhoto = "";
  updatePhotoPreview("");
}

function updatePhotoPreview(imageSrc) {
  if (!photoPreview) return;

  if (!imageSrc) {
    photoPreview.className = "flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-sky-50 text-xs font-semibold text-slate-400";
    photoPreview.innerHTML = "Sem foto";
    return;
  }

  photoPreview.className = "h-16 w-16 overflow-hidden rounded-2xl bg-sky-50";
  photoPreview.innerHTML = `<img src="${imageSrc}" alt="Pre-visualizacao da foto" class="h-full w-full object-cover">`;
}

function stopCameraStream() {
  if (!activeStream) return;
  activeStream.getTracks().forEach((track) => track.stop());
  activeStream = null;
}

function closeCameraDialog() {
  if (!cameraModal) return;

  cameraModal.classList.add("hidden");
  cameraModal.classList.remove("flex");
  stopCameraStream();

  if (cameraVideo) {
    cameraVideo.srcObject = null;
    cameraVideo.classList.add("hidden");
  }

  if (cameraFallback) {
    cameraFallback.classList.remove("hidden");
    cameraFallback.textContent = "Aguardando permissao da camera.";
  }
}

async function openDesktopCamera() {
  if (!cameraModal || !cameraVideo || !cameraFallback) return false;

  cameraModal.classList.remove("hidden");
  cameraModal.classList.add("flex");
  cameraFallback.classList.remove("hidden");
  cameraFallback.textContent = "Solicitando acesso a webcam...";

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraFallback.textContent = "Este navegador nao oferece suporte direto a webcam. Use a galeria.";
    return false;
  }

  try {
    activeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    cameraVideo.srcObject = activeStream;
    cameraVideo.classList.remove("hidden");
    cameraFallback.classList.add("hidden");
    await cameraVideo.play();
    return true;
  } catch {
    cameraFallback.textContent = "Nao foi possivel acessar a camera. Verifique as permissoes ou use a galeria.";
    return false;
  }
}

async function handleOpenCamera() {
  const isTouchDevice = window.matchMedia("(max-width: 768px)").matches || "ontouchstart" in window;

  if (isTouchDevice && cameraInput) {
    cameraInput.click();
    return;
  }

  await openDesktopCamera();
}

// Adiciona um novo assistido e envia para a pagina de acompanhamento.
function handleFormSubmit(event) {
  event.preventDefault();

  const newCase = {
    id: Date.now(),
    name: form.name.value.trim(),
    location: form.location.value,
    need: form.need.value,
    priority: form.priority.value,
    status: form.status.value,
    notes: form.notes.value.trim(),
    photo: pendingPhoto
  };

  if (!newCase.name || !newCase.location || !newCase.need || !newCase.status || !newCase.priority) {
    return;
  }

  cases.unshift(newCase);
  saveCases();
  renderCases();
  renderMetrics();
  resetForm();
  window.location.href = "casos.html";
}

// Le a imagem localmente para pre-visualizacao e uso temporario no cadastro.
function handlePhotoPreview(event) {
  if (!photoPreview) return;

  const file = event.target.files?.[0];
  if (!file) {
    pendingPhoto = "";
    updatePhotoPreview("");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    pendingPhoto = typeof reader.result === "string" ? reader.result : "";
    updatePhotoPreview(pendingPhoto);
  };
  reader.readAsDataURL(file);
}

function handleCapturePhoto() {
  if (!cameraVideo || !cameraCanvas) return;
  if (!activeStream || cameraVideo.videoWidth === 0 || cameraVideo.videoHeight === 0) return;

  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;

  const context = cameraCanvas.getContext("2d");
  if (!context) return;

  context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
  pendingPhoto = cameraCanvas.toDataURL("image/jpeg", 0.92);
  updatePhotoPreview(pendingPhoto);
  closeCameraDialog();
}

// Avanca o status seguindo o fluxo operacional.
function handleStatusChange(event) {
  const button = event.target.closest(".change-status-btn");
  if (!button) return;

  const caseId = Number(button.dataset.caseId);
  const caseItem = cases.find((item) => item.id === caseId);
  if (!caseItem) return;

  const currentIndex = statusFlow.indexOf(caseItem.status);
  const nextIndex = (currentIndex + 1) % statusFlow.length;
  caseItem.status = statusFlow[nextIndex];

  saveCases();
  renderCases();
  renderMetrics();
}

// Atualiza o painel lateral e sincroniza o mapa real com o ponto selecionado.
function updateMapInfo(locationKey) {
  const point = mapPoints[locationKey];
  if (!point || !mapTitle || !mapDescription || !mapOccupied || !mapAvailable) return;

  mapTitle.textContent = point.title;
  mapDescription.textContent = point.description;
  mapOccupied.textContent = point.occupied;
  mapAvailable.textContent = point.available;

  if (leafletMap && pointMarkers[locationKey]) {
    leafletMap.flyTo([point.lat, point.lng], 15, { duration: 0.8 });
    pointMarkers[locationKey].openPopup();
  }
}

function createMapIcon(label) {
  return L.divIcon({
    className: "",
    html: `
      <div class="map-pin">
        <span class="map-pin__dot"></span>
        <span class="map-pin__label">${label}</span>
      </div>
    `,
    iconSize: [128, 24],
    iconAnchor: [18, 12],
    popupAnchor: [50, -8]
  });
}

function initRealMap() {
  if (!realMap || typeof L === "undefined") return;

  leafletMap = L.map(realMap, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([-8.0628, -34.8770], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(leafletMap);

  Object.entries(mapPoints).forEach(([key, point]) => {
    const marker = L.marker([point.lat, point.lng], {
      icon: createMapIcon(point.title)
    }).addTo(leafletMap);

    marker.bindPopup(`
      <div style="min-width:180px">
        <p style="margin:0;font-weight:700;color:#1f2937">${point.title}</p>
        <p style="margin:6px 0 0;color:#64748b;font-size:12px;line-height:1.45">${point.description}</p>
        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
          <div style="border-radius:12px;background:#f1f5f9;padding:8px 10px">
            <span style="display:block;color:#64748b">Ocupadas</span>
            <strong style="color:#1f2937">${point.occupied}</strong>
          </div>
          <div style="border-radius:12px;background:#e0f2fe;padding:8px 10px">
            <span style="display:block;color:#64748b">Livres</span>
            <strong style="color:#0077B6">${point.available}</strong>
          </div>
        </div>
      </div>
    `);

    marker.on("click", () => updateMapInfo(key));
    pointMarkers[key] = marker;
  });

  setTimeout(() => leafletMap.invalidateSize(), 150);
}

if (form) {
  form.addEventListener("submit", handleFormSubmit);
}

if (photoInput) {
  photoInput.addEventListener("change", handlePhotoPreview);
}

if (cameraInput) {
  cameraInput.addEventListener("change", handlePhotoPreview);
}

if (openCameraBtn) {
  openCameraBtn.addEventListener("click", handleOpenCamera);
}

if (closeCameraModal) {
  closeCameraModal.addEventListener("click", closeCameraDialog);
}

if (capturePhotoBtn) {
  capturePhotoBtn.addEventListener("click", handleCapturePhoto);
}

if (useGalleryFallbackBtn && photoInput) {
  useGalleryFallbackBtn.addEventListener("click", () => {
    closeCameraDialog();
    photoInput.click();
  });
}

if (cameraModal) {
  cameraModal.addEventListener("click", (event) => {
    if (event.target === cameraModal) {
      closeCameraDialog();
    }
  });
}

if (caseList) {
  caseList.addEventListener("click", handleStatusChange);
}

if (searchInput) {
  searchInput.addEventListener("input", renderCases);
}

if (statusFilter) {
  statusFilter.addEventListener("change", renderCases);
}

if (priorityFilter) {
  priorityFilter.addEventListener("change", renderCases);
}

window.addEventListener("beforeunload", stopCameraStream);

renderCases();
renderMetrics();
initRealMap();
updateMapInfo("porto-digital");
