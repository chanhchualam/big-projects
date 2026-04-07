// ==================== UTILITY FUNCTIONS ====================
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(alertDiv, mainContent.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
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
        showAlert('Vui lòng nhập từ khóa tìm kiếm', 'info');
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
});

// ==================== EXPORT FUNCTIONS ====================
function exportToCSV() {
    // Implementation for exporting data to CSV
    console.log('Exporting to CSV...');
}

function printResults() {
    window.print();
}
