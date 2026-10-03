// =========================================================================
// TEMPELKAN URL WEB APP GOOGLE SCRIPT ANDA DI ANTARA TANDA KUTIP DI BAWAH INI:
// =========================================================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxlxY6leORa18CaKmBDgg54JSvMKyVrno5r1BhHXHipGdgnEX4Lw2OuuW9XA_P80szejQ/exec";

let tipeAktif = 'masuk';
let transaksiList = JSON.parse(localStorage.getItem('dompetku_transaksi')) || [];
let chartInstance = null;

const kategoriPilihan = {
    masuk: ['Gaji', 'Bonus', 'Investasi', 'Hadiah', 'Lain-lain'],
    keluar: ['Makanan & Minuman', 'Bensin', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Lain-lain']
};

// Set tanggal default hari ini
document.getElementById('tanggal').valueAsDate = new Date();
updateKategoriDropdown();

function setTipe(tipe) {
    tipeAktif = tipe;
    const btnMasuk = document.getElementById('btnMasuk');
    const btnKeluar = document.getElementById('btnKeluar');

    if (tipe === 'masuk') {
        btnMasuk.className = "py-2.5 text-sm font-semibold rounded-lg bg-emeraldBase text-white transition-all shadow";
        btnKeluar.className = "py-2.5 text-sm font-semibold rounded-lg text-slate-400 transition-all hover:text-white";
    } else {
        btnKeluar.className = "py-2.5 text-sm font-semibold rounded-lg bg-rose-600 text-white transition-all shadow";
        btnMasuk.className = "py-2.5 text-sm font-semibold rounded-lg text-slate-400 transition-all hover:text-white";
    }
    updateKategoriDropdown();
}

function updateKategoriDropdown() {
    const select = document.getElementById('kategori');
    select.innerHTML = '';
    kategoriPilihan[tipeAktif].forEach(kat => {
        const opt = document.createElement('option');
        opt.value = kat;
        opt.textContent = kat;
        select.appendChild(opt);
    });
}

function formatRupiahInput(input) {
    let value = input.value.replace(/[^,\d]/g, '').toString();
    let split = value.split(',');
    let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa);
    let ribuan = split[0].substr(sisa).match(/\d{3}/gi);

    if (ribuan) {
        let separator = sisa ? '.' : '';
        rupiah += separator + ribuan.join('.');
    }
    input.value = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
}

function parseNominal(str) {
    return parseInt(str.replace(/\./g, '')) || 0;
}

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
}

async function tambahTransaksi(e) {
    e.preventDefault();
    
    const nominalRaw = document.getElementById('nominal').value;
    const nominal = parseNominal(nominalRaw);
    const kategori = document.getElementById('kategori').value;
    const tanggal = document.getElementById('tanggal').value;
    const catatan = document.getElementById('catatan').value || '-';

    const dataBaru = {
        id: Date.now(),
        tanggal,
        tipe: tipeAktif,
        kategori,
        nominal,
        catatan
    };

    // Simpan ke LocalStorage web
    transaksiList.unshift(dataBaru);
    localStorage.setItem('dompetku_transaksi', JSON.stringify(transaksiList));

    // Reset Form
    document.getElementById('formTransaksi').reset();
    document.getElementById('tanggal').valueAsDate = new Date();
    setTipe('masuk');

    updateUI();

    // Kirim otomatis ke Google Sheets
    if (SCRIPT_URL && SCRIPT_URL !== "https://script.google.com/macros/s/AKfycbxlxY6leORa18CaKmBDgg54JSvMKyVrno5r1BhHXHipGdgnEX4Lw2OuuW9XA_P80szejQ/exec") {
        kirimKeGoogleSheets(dataBaru);
    }
}

async function kirimKeGoogleSheets(data) {
    const syncDot = document.getElementById('syncDot');
    const syncText = document.getElementById('syncText');
    
    syncDot.className = "w-2 h-2 rounded-full bg-amber-500 animate-pulse";
    syncText.textContent = "Menyinkronkan...";

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tanggal: data.tanggal,
                tipe: data.tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
                kategori: data.kategori,
                nominal: data.nominal,
                catatan: data.catatan
            })
        });
        syncDot.className = "w-2 h-2 rounded-full bg-emerald-500";
        syncText.textContent = "Tersinkron ke Sheets";
    } catch (error) {
        console.error(error);
        syncDot.className = "w-2 h-2 rounded-full bg-rose-500";
        syncText.textContent = "Gagal Sinkron";
    }
}

function hapusTransaksi(id) {
    transaksiList = transaksiList.filter(t => t.id !== id);
    localStorage.setItem('dompetku_transaksi', JSON.stringify(transaksiList));
    updateUI();
}

function updateUI() {
    renderRiwayat();
    hitungRingkasan();
    updateChart();
}

function hitungRingkasan() {
    let totalMasuk = 0;
    let totalKeluar = 0;

    transaksiList.forEach(t => {
        if (t.tipe === 'masuk') totalMasuk += t.nominal;
        else totalKeluar += t.nominal;
    });

    let saldo = totalMasuk - totalKeluar;

    document.getElementById('totalSaldo').textContent = formatRupiah(saldo);
    document.getElementById('totalMasuk').textContent = formatRupiah(totalMasuk);
    document.getElementById('totalKeluar').textContent = formatRupiah(totalKeluar);
}

function renderRiwayat() {
    const tbody = document.getElementById('tabelTransaksi');
    const filterTipe = document.getElementById('filterTipe').value;
    const keyword = document.getElementById('pencarian').value.toLowerCase();

    tbody.innerHTML = '';

    let filtered = transaksiList.filter(t => {
        let matchTipe = filterTipe === 'semua' || t.tipe === filterTipe;
        let matchKeyword = t.catatan.toLowerCase().includes(keyword) || t.kategori.toLowerCase().includes(keyword);
        return matchTipe && matchKeyword;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-500">Belum ada data transaksi.</td></tr>`;
        return;
    }

    filtered.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-800/40 transition-all border-b border-slate-800/40";
        tr.innerHTML = `
            <td class="py-3.5 text-xs text-slate-300">${t.tanggal}</td>
            <td class="py-3.5"><span class="px-2.5 py-1 text-xs rounded-full ${t.tipe === 'masuk' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50' : 'bg-rose-900/40 text-rose-400 border border-rose-800/50'}">${t.kategori}</span></td>
            <td class="py-3.5 text-slate-300">${t.catatan}</td>
            <td class="py-3.5 text-right font-bold ${t.tipe === 'masuk' ? 'text-emerald-400' : 'text-slate-100'}">${t.tipe === 'masuk' ? '+' : '-'} ${formatRupiah(t.nominal)}</td>
            <td class="py-3.5 text-center">
                <button onclick="hapusTransaksi(${t.id})" class="text-slate-500 hover:text-rose-400 transition-colors p-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    let pengeluaranPerKat = {};
    transaksiList.filter(t => t.tipe === 'keluar').forEach(t => {
        pengeluaranPerKat[t.kategori] = (pengeluaranPerKat[t.kategori] || 0) + t.nominal;
    });

    let labels = Object.keys(pengeluaranPerKat);
    let data = Object.values(pengeluaranPerKat);

    if (chartInstance) {
        chartInstance.destroy();
    }

    if (labels.length === 0) {
        labels = ['Belum ada pengeluaran'];
        data = [1];
    }

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#047857', '#d97706', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        boxWidth: 12,
                        font: { family: 'Plus Jakarta Sans', size: 11 }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

updateUI();