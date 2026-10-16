// ==================== UTILITY FUNCTIONS ====================
function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function showAlert(message, type = 'info', timeoutMs = 5000) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-secondary btn-small';
    closeBtn.textContent = 'Đóng';
    closeBtn.style.marginLeft = '0.75rem';
    closeBtn.addEventListener('click', () => {
        if (prefersReducedMotion()) {
            alertDiv.remove();
            return;
        }
        alertDiv.style.opacity = '0';
        alertDiv.style.transform = 'translateY(-6px)';
        setTimeout(() => alertDiv.remove(), 200);
    });

    alertDiv.appendChild(messageSpan);
    alertDiv.appendChild(closeBtn);

    const container = document.querySelector('.main-content .container') || document.querySelector('.main-content') || document.body;
    container.insertBefore(alertDiv, container.firstChild);

    if (timeoutMs > 0) {
        setTimeout(() => {
            if (!alertDiv.isConnected) return;
            if (prefersReducedMotion()) {
                alertDiv.remove();
                return;
            }
            alertDiv.style.opacity = '0';
            alertDiv.style.transform = 'translateY(-6px)';
            setTimeout(() => alertDiv.remove(), 200);
        }, timeoutMs);
    }
}

// ==================== FORM VALIDATION ====================
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return true;
    
    const inputs = form.querySelectorAll('input[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.style.borderColor = '#f08080';
            isValid = false;
        } else {
            input.style.borderColor = '';
        }
    });
    
    return isValid;
}

// ==================== API CALLS ====================
async function rateNganh(nganhId) {
    const rating = document.getElementById('rating-select').value;
    const review = document.getElementById('review-text').value;
    
    try {
        const response = await fetch(`/major/api/rating/${nganhId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                rating: parseInt(rating),
                review: review
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('Đánh giá của bạn đã được lưu!', 'success');
            // Reset form
            document.getElementById('rating-select').value = '5';
            document.getElementById('review-text').value = '';
        } else {
            showAlert(data.error || 'Có lỗi xảy ra', 'danger');
        }
    } catch (error) {
        showAlert('Lỗi kết nối: ' + error.message, 'danger');
    }
}

async function getUserScores() {
    try {
        const response = await fetch('/student/api/scores');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching scores:', error);
        return [];
    }
}

// ==================== DYNAMIC CONTENT LOADING ====================
function loadMajorsByKhoi(khoiId) {
    const majorsContainer = document.getElementById('majors-container');
    
    fetch(`/major/api/by-khoi/${khoiId}`)
        .then(response => response.json())
        .then(data => {
            majorsContainer.innerHTML = '';
            data.forEach(major => {
                const div = document.createElement('div');
                div.className = 'major-item';
                div.innerHTML = `
                    <h4>${major.name}</h4>
                    <p>Điểm chuan: ${major.diem_chuan || 'N/A'}</p>
                    <a href="/major/${major.id}" class="btn btn-secondary">Xem Chi Tiết</a>
                `;
                majorsContainer.appendChild(div);
            });
        })
        .catch(error => {
            console.error('Error loading majors:', error);
            majorsContainer.innerHTML = '<p>Không thể tải danh sách ngành</p>';
        });
}

// ==================== SEARCH FUNCTIONALITY ====================
function searchMajors() {
    const keyword = document.getElementById('search-input').value;
    
    if (keyword.trim() === '') {
        showAlert('Nhập từ khóa để tìm ngành (ví dụ: "công nghệ", "kinh tế")', 'info');
        return;
    }
    
    window.location.href = `/major/search?q=${encodeURIComponent(keyword)}`;
}

// ==================== CHARTS & VISUALIZATION ====================
function drawScoreChart(scores) {
    const canvas = document.getElementById('score-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const maxScore = Math.max(...scores);
    
    // Simple bar chart
    const barWidth = canvas.width / scores.length;
    
    ctx.fillStyle = '#0066cc';
    scores.forEach((score, index) => {
        const height = (score / maxScore) * (canvas.height - 50);
        ctx.fillRect(
            index * barWidth + 10,
            canvas.height - height - 30,
            barWidth - 20,
            height
        );
    });
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', function() {
    // Page entrance
    if (!prefersReducedMotion()) {
        document.body.classList.add('page-enter');
        requestAnimationFrame(() => {
            document.body.classList.remove('page-enter');
        });
    }

    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(el => {
        el.addEventListener('mouseenter', function() {
            const tooltip = this.getAttribute('data-tooltip');
            const div = document.createElement('div');
            div.className = 'tooltip';
            div.textContent = tooltip;
            document.body.appendChild(div);
            
            const rect = this.getBoundingClientRect();
            div.style.left = (rect.left + rect.width / 2) + 'px';
            div.style.top = (rect.top - 40) + 'px';
        });
        
        el.addEventListener('mouseleave', function() {
            const tooltip = document.querySelector('.tooltip');
            if (tooltip) tooltip.remove();
        });
    });
    
    // Form submission validation
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const required = this.querySelectorAll('[required]');
            let hasErrors = false;
            
            required.forEach(field => {
                if (!field.value.trim()) {
                    field.style.borderColor = '#f08080';
                    hasErrors = true;
                }
            });
            
            if (hasErrors) {
                e.preventDefault();
                showAlert('Vui lòng điền đầy đủ tất cả các trường bắt buộc', 'danger');
            }
        });
    });

    // Search input: press Enter to search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchMajors();
            }
        });
    }

    // Live search on majors list page
    const majorsGrid = document.getElementById('majors-grid');
    const majorsPagination = document.getElementById('majors-pagination');
    const majorsEmpty = document.getElementById('majors-empty');
    const searchBtn = document.getElementById('search-btn');

    if (searchInput && majorsGrid) {
        const originalGridHtml = majorsGrid.innerHTML;
        const originalPaginationHtml = majorsPagination ? majorsPagination.innerHTML : '';

        let debounceTimer = null;
        let lastQuery = '';

        function setLoading(isLoading) {
            if (!searchBtn) return;
            searchBtn.disabled = isLoading;
            searchBtn.textContent = isLoading ? 'Đang tìm…' : 'Tìm Kiếm';
        }

        function resetMajorsList() {
            majorsGrid.innerHTML = originalGridHtml;
            if (majorsPagination) majorsPagination.innerHTML = originalPaginationHtml;
            if (majorsPagination) majorsPagination.style.display = '';
            if (majorsEmpty) majorsEmpty.style.display = 'none';
        }

        function renderMajors(items) {
            if (!items || items.length === 0) {
                majorsGrid.innerHTML = '';
                if (majorsPagination) majorsPagination.style.display = 'none';
                if (majorsEmpty) majorsEmpty.style.display = '';
                return;
            }

            if (majorsPagination) majorsPagination.style.display = 'none';
            if (majorsEmpty) majorsEmpty.style.display = 'none';

            majorsGrid.innerHTML = items.map((m) => {
                const school = m.school_name || 'N/A';
                const diemChuan = (m.diem_chuan !== null && m.diem_chuan !== undefined && m.diem_chuan !== '') ? m.diem_chuan : 'N/A';
                const khoi = m.khoi_thi || 'N/A';
                const chiTieu = (m.chi_tieu !== null && m.chi_tieu !== undefined && m.chi_tieu !== '') ? m.chi_tieu : 'N/A';
                const moTa = m.mo_ta ? `<p class="description">${escapeHtml(m.mo_ta)}</p>` : '';

                return `
                    <div class="major-card">
                        <h3>${escapeHtml(m.name)}</h3>
                        <p class="school-name">${escapeHtml(school)}</p>

                        <div class="major-info">
                            <span class="info-item"><strong>Điểm Chuan:</strong> ${escapeHtml(String(diemChuan))}</span>
                            <span class="info-item"><strong>Khối Thi:</strong> ${escapeHtml(String(khoi))}</span>
                            <span class="info-item"><strong>Chỉ Tiêu:</strong> ${escapeHtml(String(chiTieu))}</span>
                        </div>

                        ${moTa}

                        <a href="/major/${m.id}" class="btn btn-secondary">Xem Chi Tiết</a>
                    </div>
                `;
            }).join('');
        }

        function escapeHtml(str) {
            return String(str)
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        async function doLiveSearch(query) {
            const q = (query || '').trim();
            if (q.length === 0) {
                resetMajorsList();
                return;
            }

            lastQuery = q;
            setLoading(true);
            try {
                const resp = await fetch(`/major/api/search?q=${encodeURIComponent(q)}`);
                const data = await resp.json();
                if (lastQuery !== q) return; // stale response
                renderMajors(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Live search error:', err);
                showAlert('Không thể tìm kiếm lúc này. Hãy thử lại.', 'danger');
            } finally {
                setLoading(false);
            }
        }

        searchInput.addEventListener('input', () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                doLiveSearch(searchInput.value);
            }, 260);
        });
    }

    // Button ripple
    document.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('.btn') : null;
        if (!btn) return;
        if (prefersReducedMotion()) return;

        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    });

    // Subtle card tilt (cute-cool)
    if (!prefersReducedMotion()) {
        const tiltTargets = document.querySelectorAll(
            '.feature-card, .dashboard-card, .major-card, .result-card, .recommendation-item, .info-section'
        );

        tiltTargets.forEach((card) => {
            let rafId = null;

            function onMove(ev) {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    const r = card.getBoundingClientRect();
                    const px = (ev.clientX - r.left) / r.width;
                    const py = (ev.clientY - r.top) / r.height;
                    const rotY = (px - 0.5) * 8;
                    const rotX = (0.5 - py) * 8;
                    card.style.transform = `translateY(-6px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
                    card.style.transition = 'transform 80ms linear';
                });
            }

            function onLeave() {
                if (rafId) cancelAnimationFrame(rafId);
                card.style.transition = 'transform 200ms ease';
                card.style.transform = '';
            }

            card.addEventListener('pointermove', onMove);
            card.addEventListener('pointerleave', onLeave);
        });
    }
});

// ==================== EXPORT FUNCTIONS ====================
function exportToCSV() {
    // Implementation for exporting data to CSV
    console.log('Exporting to CSV...');
}

function printResults() {
    window.print();
}
