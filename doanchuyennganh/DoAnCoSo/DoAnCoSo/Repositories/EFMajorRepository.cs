using DoAnCoSo.DataAccess;
using DoAnCoSo.Models;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.Repositories
{
    public class EFMajorRepository : IMajorRepository
    {
        private readonly ApplicationDbContext _context;

        public EFMajorRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Major>> GetAllAsync()
        {
            return await _context.Majors
                .Include(m => m.AdmissionScores)
                    .ThenInclude(a => a.University)
                .Include(m => m.AdmissionScores)
                    .ThenInclude(a => a.ExamBlock)
                .ToListAsync();
        }

        public async Task<Major?> GetByIdAsync(int id)
        {
            return await _context.Majors
                .Include(m => m.AdmissionScores)
                    .ThenInclude(a => a.University)
                .Include(m => m.AdmissionScores)
                    .ThenInclude(a => a.ExamBlock)
                .FirstOrDefaultAsync(m => m.Id == id);
        }

        public async Task<IEnumerable<Major>> SearchAsync(string? keyword, int? examBlockId, decimal? minScore, decimal? maxScore, string? city)
        {
            var query = _context.Majors
                .Include(m => m.AdmissionScores)
                    .ThenInclude(a => a.University)
                .Include(m => m.AdmissionScores)
                    .ThenInclude(a => a.ExamBlock)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                keyword = keyword.ToLower();
                query = query.Where(m => 
                    m.Name.ToLower().Contains(keyword) ||
                    m.Description.ToLower().Contains(keyword) ||
                    m.Code != null && m.Code.ToLower().Contains(keyword));
            }

            if (examBlockId.HasValue)
            {
                query = query.Where(m => m.AdmissionScores.Any(a => a.ExamBlockId == examBlockId.Value));
            }

            if (minScore.HasValue || maxScore.HasValue || !string.IsNullOrWhiteSpace(city))
            {
                query = query.Where(m => m.AdmissionScores.Any(a =>
                    (!minScore.HasValue || a.Score >= minScore.Value) &&
                    (!maxScore.HasValue || a.Score <= maxScore.Value) &&
                    (string.IsNullOrWhiteSpace(city) || a.University.City == city)
                ));
            }

            return await query.ToListAsync();
        }

        public async Task AddAsync(Major major)
        {
            _context.Majors.Add(major);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Major major)
        {
            _context.Majors.Update(major);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var major = await _context.Majors.FindAsync(id);
            if (major != null)
            {
                _context.Majors.Remove(major);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Major>> GetPopularMajorsAsync(int count = 10)
        {
            return await _context.Majors
                .Include(m => m.AdmissionScores)
                    .ThenInclude(a => a.University)
                .OrderByDescending(m => m.Favorites.Count)
                .Take(count)
                .ToListAsync();
        }
    }
}

