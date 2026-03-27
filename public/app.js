const API_URL = 'http://localhost:3000/api';
let globalSettings = {};

// DOM Elements
const views = {
    dashboard: document.getElementById('view-dashboard'),
    settings: document.getElementById('view-settings')
};
const navItems = {
    dashboard: document.getElementById('nav-dashboard'),
    settings: document.getElementById('nav-settings')
};

// Navigation
function switchView(viewName) {
    Object.values(views).forEach(v => v.style.display = 'none');
    Object.values(navItems).forEach(n => n.classList.remove('active'));
    
    views[viewName].style.display = 'block';
    navItems[viewName].classList.add('active');
    
    if (viewName === 'dashboard') loadLogs();
}

navItems.dashboard.addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
navItems.settings.addEventListener('click', (e) => { e.preventDefault(); switchView('settings'); });

// Toast
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Load Settings
async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        const settings = await res.json();
        globalSettings = settings;
        
        // Apply CSS vars
        document.body.style.setProperty('--color-ontime', settings.color_ontime);
        document.body.style.setProperty('--color-late', settings.color_late);
        document.body.style.setProperty('--color-absent', settings.color_absent);
        
        // Update inputs
        document.getElementById('setting-time').value = settings.official_time;
        document.getElementById('setting-color-ontime').value = settings.color_ontime;
        document.getElementById('setting-color-late').value = settings.color_late;
        document.getElementById('setting-color-absent').value = settings.color_absent;
    } catch (e) {
        console.error("Error loading settings", e);
    }
}

// Save Settings
document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-settings');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    
    const newSettings = {
        official_time: document.getElementById('setting-time').value,
        color_ontime: document.getElementById('setting-color-ontime').value,
        color_late: document.getElementById('setting-color-late').value,
        color_absent: document.getElementById('setting-color-absent').value
    };
    
    try {
        await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSettings)
        });
        await loadSettings();
        showToast("Configuración guardada correctamente");
    } catch (e) {
        showToast("Error al guardar");
    } finally {
        btn.innerHTML = 'Guardar Cambios';
    }
});

// Load Logs
async function loadLogs() {
    const name = document.getElementById('filter-name').value;
    const dateFilter = document.getElementById('filter-date').value;
    
    let queryParams = [];
    if (name) queryParams.push(`name=${encodeURIComponent(name)}`);
    
    if (dateFilter === 'today') {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        queryParams.push(`date=${yyyy}-${mm}-${dd}`); // Matches ISO YYYY-MM-DD
    } else if (dateFilter === 'week') {
        const today = new Date();
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        queryParams.push(`startDate=${lastWeek.toISOString()}`);
        queryParams.push(`endDate=${today.toISOString()}`);
    }

    const qs = queryParams.length ? '?' + queryParams.join('&') : '';
    
    document.getElementById('table-loading').style.display = 'block';
    document.querySelector('#attendance-table tbody').innerHTML = '';
    
    try {
        const res = await fetch(`${API_URL}/logs${qs}`);
        const logs = await res.json();
        renderTable(logs);
    } catch (e) {
        console.error("Error loading logs", e);
    } finally {
        document.getElementById('table-loading').style.display = 'none';
    }
}

document.getElementById('btn-search').addEventListener('click', loadLogs);

// Sync Data
document.getElementById('btn-sync').addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`${API_URL}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const data = await res.json();
        if(data.success) {
            showToast(data.message || "Sincronización completada");
            loadLogs();
        } else {
            showToast("Error devuelto por servidor");
        }
    } catch (e) {
        showToast("Error de conexión al sincronizar");
    } finally {
        btn.innerHTML = ogHtml;
        btn.disabled = false;
    }
});

// Calculate Status
function calcStatus(timestamp) {
    if (!globalSettings.official_time) return { label: 'Asistencia', class: 'status-ontime' };
    
    const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {hour12: false, hour: "numeric", minute: "numeric"}); 
    // Wait, ISO format string contains the local time for the timezone. "2026-03-27T08:30:00-06:00"
    // Let's parse strictly from the string to ignore timezone shifts by JS parsing.
    const timePortion = timestamp.split('T')[1].substring(0, 5); // "08:30"
    
    if (timePortion > globalSettings.official_time) {
        return { label: 'Retardo', class: 'status-late' };
    }
    return { label: 'A Tiempo', class: 'status-ontime' };
}

// Render Table
function renderTable(logs) {
    const tbody = document.querySelector('#attendance-table tbody');
    tbody.innerHTML = '';
    
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:gray;">No se encontraron registros</td></tr>';
        return;
    }
    
    logs.forEach(log => {
        const dateObj = new Date(log.timestamp);
        const formattedDate = dateObj.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        
        // Use the raw ISO string for exact device time (ignoring local PC timezones)
        const timePortion = log.timestamp.split('T')[1].substring(0, 5);
        
        const status = calcStatus(log.timestamp);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="employee-info">
                    <div class="avatar"><i class="fa-solid fa-user"></i></div>
                    <div>
                        <div class="emp-name">${log.name || 'Desconocido'}</div>
                        <div class="emp-id">ID: ${log.person_id}</div>
                    </div>
                </div>
            </td>
            <td>
                <div style="font-weight: 500">${timePortion} hrs</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary)">${formattedDate}</div>
            </td>
            <td>${log.attendance_status === 'checkIn' ? 'Lectura Entrada' : log.attendance_status}</td>
            <td>
                <span class="status-badge ${status.class}">${status.label}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Init
window.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    loadLogs();
});
